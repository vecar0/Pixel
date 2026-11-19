"""몸 전체 명암 시안: 실루엣에서 '부피(높이)'를 추정해 법선을 만들고, 등불 방향 빛으로 단계 명암을 준다."""
import sys, numpy as np
from PIL import Image

def dist_field(op):
    H, W = op.shape; INF = 1e9
    d = np.where(op, INF, 0.0)
    for _ in range(2):   # 2-pass chamfer
        for y in range(H):
            for x in range(W):
                if d[y, x] == 0: continue
                m = d[y, x]
                if y > 0: m = min(m, d[y-1, x] + 1)
                if x > 0: m = min(m, d[y, x-1] + 1)
                if y > 0 and x > 0: m = min(m, d[y-1, x-1] + 1.4)
                if y > 0 and x < W-1: m = min(m, d[y-1, x+1] + 1.4)
                d[y, x] = m
        for y in range(H-1, -1, -1):
            for x in range(W-1, -1, -1):
                if d[y, x] == 0: continue
                m = d[y, x]
                if y < H-1: m = min(m, d[y+1, x] + 1)
                if x < W-1: m = min(m, d[y, x+1] + 1)
                if y < H-1 and x < W-1: m = min(m, d[y+1, x+1] + 1.4)
                if y < H-1 and x > 0: m = min(m, d[y+1, x-1] + 1.4)
                d[y, x] = m
    return d

def blur(a, r):
    k = 2 * r + 1; p = np.pad(a, r, mode='edge'); c = p.cumsum(0).cumsum(1)
    c = np.pad(c, ((1, 0), (1, 0)))
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)

def normals(img, R=14, br=5):
    a = np.array(img.convert('RGBA')).astype(float); op = a[..., 3] > 96
    h = np.minimum(dist_field(op), R) / R
    h = np.sqrt(np.clip(h, 0, 1) * (2 - np.clip(h, 0, 1)))    # 둥근 단면
    h = blur(h, br) * op
    gy, gx = np.gradient(h)
    n = np.dstack([-gx * 6, -gy * 6, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    return a, op, n

def shade(img, L, levels, warm, cool, lit_k, sh_k):
    a, op, n = normals(img)
    L = np.array(L, float); L /= np.linalg.norm(L)
    I_local = (n * L).sum(2)                # 작은 굴곡 (주름·머리 가닥)
    # 몸 단위 부피: 실루엣을 크게 뭉갠 '덩어리'의 기울기 → 빛 쪽 절반/그늘 쪽 절반
    big = blur(op.astype(float), 12); gy2, gx2 = np.gradient(big)
    nb = np.dstack([-gx2 * 14, -gy2 * 14, np.ones_like(big)]); nb /= np.linalg.norm(nb, axis=2, keepdims=True)
    I_big = (nb * L).sum(2)
    I = 0.45 * I_local + 0.8 * I_big - 0.38
    q = np.digitize(I, levels)              # 0..len(levels)
    rgb = a[..., :3].copy(); out = rgb.copy()
    steps = len(levels)
    for s in range(steps + 1):
        m = (q == s) & op
        t = s / steps                       # 0 그늘 → 1 빛
        if t < 0.5:                         # 그늘: 어둡게 + 차가운 보라로
            k = (0.5 - t) * 2 * sh_k
            out[m] = rgb[m] * (1 - 0.45 * k) * (1 - 0.25 * k) + np.array(cool) * 0.25 * k
        elif t > 0.5:                       # 빛: 밝게 + 등불 호박색으로
            k = (t - 0.5) * 2 * lit_k
            out[m] = rgb[m] * (1 + 0.3 * k) * (1 - 0.14 * k) + np.array(warm) * 0.14 * k
    a[..., :3] = np.clip(out, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')

if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    im = Image.open(src)
    L = (0.75, 0.15, 0.65)   # 등불: 앞(오른쪽), 살짝 아래에서
    S = {
      'A': dict(levels=[-0.15, 0.2, 0.55], warm=(255, 190, 120), cool=(40, 30, 80), lit_k=0.9, sh_k=0.8),   # 부드러운 3단
      'B': dict(levels=[0.2], warm=(255, 180, 100), cool=(20, 14, 50), lit_k=1.0, sh_k=1.2),              # 강한 2단
      'C': dict(levels=[0.0, 0.5], warm=(255, 210, 160), cool=(60, 50, 90), lit_k=0.55, sh_k=0.55),          # 은은
    }
    for k, o in S.items(): shade(im, L, **o).save(f'{out}_{k}.png')
