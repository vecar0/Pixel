"""도트 정리: AI 생성 스프라이트를 '손으로 찍은' 느낌으로.
1) 같은 캐릭터의 모든 프레임이 공유하는 제한 팔레트(k색)로 양자화 → 프레임 간 색 깜빡임·노이즈 명암 제거
2) 외톨이 점(같은 색 이웃 0개)은 주변 다수색으로 → 명암이 덩어리(클러스터)로
3) 실루엣 1px 삐침 제거
4) 셀아웃 외곽선: 실루엣 가장자리 픽셀을 그 재질색의 어두운 톤으로 → 형태가 또렷
사용: python3 pixclean.py <k> <원본폴더> <출력폴더> 파일...
"""
import sys, os
from PIL import Image
import numpy as np

def kmeans(px, k, it=20, seed=1):
    rng = np.random.default_rng(seed)
    # 밝기 순으로 고르게 초기화 (어두운 색이 뭉개지지 않게)
    lum = px @ np.array([0.3, 0.59, 0.11])
    order = np.argsort(lum); c = px[order[np.linspace(0, len(px) - 1, k).astype(int)]].astype(float)
    for _ in range(it):
        d = ((px[:, None, :] - c[None]) ** 2).sum(-1); lab = d.argmin(1)
        for j in range(k):
            m = lab == j
            if m.any(): c[j] = px[m].mean(0)
    return c

def nearest(a, pal):
    d = ((a[..., None, :].astype(float) - pal[None, None]) ** 2).sum(-1); return d.argmin(-1)

def clean(img, pal):
    a = np.array(img.convert('RGBA')); H, W = a.shape[:2]
    op = a[..., 3] > 96
    idx = nearest(a[..., :3], pal); idx[~op] = -1
    # 3) 떠 있는 점 제거 (상하좌우 불투명 이웃 0개)
    n = np.zeros_like(idx)
    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)): n += np.roll(np.roll(idx >= 0, dy, 0), dx, 1)
    idx[(idx >= 0) & (n == 0)] = -1
    # 2) 노이즈 점 → 다수색. 단, 주변색과 많이 다른 점(눈·하이라이트·불빛)은 그대로
    out = idx.copy(); P = pal.astype(float)
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            v = idx[y, x]
            if v < 0: continue
            nb = np.delete(idx[y-1:y+2, x-1:x+2].ravel(), 4)
            if (nb == v).sum(): continue
            nb = nb[nb >= 0]
            if not len(nb): continue
            m = np.bincount(nb).argmax()
            if ((P[v] - P[m]) ** 2).sum() ** 0.5 < 48: out[y, x] = m
    idx = out
    rgb = np.zeros((H, W, 4), np.uint8); col = pal.astype(np.uint8)
    rgb[idx >= 0, :3] = col[idx[idx >= 0]]; rgb[idx >= 0, 3] = 255
    # 4) 은은한 셀아웃: 투명과 맞닿은 가장자리만, 밝은 재질은 한 톤 어둡게, 어두운 재질은 거의 검정
    opq = idx >= 0
    edge = opq & ~(np.roll(opq, 1, 0) & np.roll(opq, -1, 0) & np.roll(opq, 1, 1) & np.roll(opq, -1, 1))
    c = rgb[..., :3].astype(float); lum = c @ np.array([0.3, 0.59, 0.11])
    dark = np.where((lum > 110)[..., None], c * 0.66, np.where((lum > 45)[..., None], c * 0.55, c * 0.7))
    rgb[edge, :3] = np.clip(dark[edge], 0, 255).astype(np.uint8)
    return Image.fromarray(rgb, 'RGBA')

def palette(px, k):
    # 무채색(머리·옷·검)과 유채색(눈·피부·불빛·가죽)을 따로 뽑아 포인트 색이 묻히지 않게
    mx, mn = px.max(1), px.min(1); sat = (mx - mn) / np.maximum(mx, 1)
    chroma = px[(sat > 0.22) & (mx > 40)]; grey = px[~((sat > 0.22) & (mx > 40))]
    kc = max(4, min(k // 2, int(round(k * 0.4))))
    parts = [kmeans(grey, k - kc)]
    if len(chroma) > kc: parts.append(kmeans(chroma, kc))
    return np.concatenate(parts)

if __name__ == '__main__':
    k, src, dst, files = int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4:]
    os.makedirs(dst, exist_ok=True)
    allpx = []
    for f in files:
        a = np.array(Image.open(os.path.join(src, f)).convert('RGBA')).reshape(-1, 4)
        allpx.append(a[a[:, 3] > 96][:, :3])
    px = np.concatenate(allpx).astype(float)
    if len(px) > 60000: px = px[np.random.default_rng(0).choice(len(px), 60000, replace=False)]
    pal = palette(px, k)
    for f in files: clean(Image.open(os.path.join(src, f)), pal).save(os.path.join(dst, f))
    print('palette', k, 'files', len(files))
