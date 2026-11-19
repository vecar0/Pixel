# 포즈 그림을 기준 리라와 같은 격자(요청의 cell, masterAt)로 읽어 1배 스프라이트로 만든다.
# 각 칸 가운데 영역의 중앙값 색 → 초록 키는 투명 → 기준 리라 팔레트의 가장 가까운 색으로 맞춤.
# 모든 포즈를 같은 창(기준 리라 주변 + 여유)으로 잘라서 발 기준점이 똑같게 한다.
import json, sys
import numpy as np
from PIL import Image
M = np.array(Image.open('../master/lira-black1/lira.png').convert('RGBA'))
pal = np.unique(M[M[..., 3] > 0][:, :3], axis=0).astype(int)
PAD = 26   # 기준 그림 둘레 여유 칸
for name in sys.argv[1:]:
    req = json.load(open(f'{name}-ask/request.json'))
    c = req['cell']; mx, my = req['masterAt']; mw, mh = req['master']['size']
    im = np.array(Image.open(f'{name}.png').convert('RGB')).astype(int)
    W, H = mw + PAD * 2, mh + PAD          # 아래는 발 = 바닥선, 여유 없음
    out = np.zeros((H, W, 4), np.uint8)
    for y in range(H):
        for x in range(W):
            cx, cy = mx - PAD + x, my - PAD + y
            px, py = cx * c, cy * c
            if px < 0 or py < 0 or px + c > im.shape[1] or py + c > im.shape[0]: continue
            q = c // 4
            blk = im[py + q:py + c - q, px + q:px + c - q].reshape(-1, 3)
            col = np.median(blk, axis=0)
            r, g, b = col
            if g > 150 and r < 120 and b < 120: continue          # 초록 키
            d = ((pal - col) ** 2).sum(1); out[y, x, :3] = pal[d.argmin()]; out[y, x, 3] = 255
    # 외톨이 점 제거 (이웃 4칸이 모두 비면)
    a = out[..., 3] > 0
    nb = np.zeros_like(a, int)
    nb[1:] += a[:-1]; nb[:-1] += a[1:]; nb[:, 1:] += a[:, :-1]; nb[:, :-1] += a[:, 1:]
    out[a & (nb == 0)] = 0
    Image.fromarray(out).save(f'../../assets/lira-{name}.png')
    print(name, 'cell', c, 'size', (W, H), 'opaque', int(a.sum()), 'anchor', (PAD + 43, H))
