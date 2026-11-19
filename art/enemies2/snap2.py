# 생성된 포즈 그림을 '기준 그림의 픽셀 크기(cell)'로 다시 읽는다 (격자 위상은 자동 탐색).
# 사용: python3 snap2.py <pose.png> <master_sprite.png> <cellx> <celly> <key:green|magenta> <out.png>
import sys, numpy as np
from PIL import Image
src, mpath, cx, cy, key, out = sys.argv[1:7]; cx, cy = float(cx), float(cy)
im = np.array(Image.open(src).convert('RGB')).astype(int)
if mpath == 'self':   # 그림 자체에서 48색 팔레트
    q = Image.open(src).convert('RGB').quantize(48); pal = np.array(q.getpalette()[:48 * 3]).reshape(-1, 3).astype(int)
else:
    M = np.array(Image.open(mpath).convert('RGBA')); pal = np.unique(M[M[..., 3] > 0][:, :3], axis=0).astype(int)
H, W = im.shape[:2]
def iskey(c):
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    return (g > 150) & (r < 120) & (b < 120) if key == 'green' else (r > 150) & (b > 150) & (g < 110)
best = None
for ox in np.linspace(0, cx, 6, endpoint=False):
    for oy in np.linspace(0, cy, 6, endpoint=False):
        xs = np.arange(ox + cx / 2, W, cx).astype(int); ys = np.arange(oy + cy / 2, H, cy).astype(int)
        q = int(cx / 4)
        a = im[np.ix_(ys, xs)]; b = im[np.ix_(np.clip(ys + q, 0, H - 1), np.clip(xs + q, 0, W - 1))]
        err = np.abs(a - b).sum()
        if best is None or err < best[0]: best = (err, ox, oy)
_, ox, oy = best
xs = np.arange(ox + cx / 2, W, cx).astype(int); ys = np.arange(oy + cy / 2, H, cy).astype(int)
cells = im[np.ix_(ys, xs)]
k = iskey(cells)
d = ((cells[..., None, :] - pal[None, None]) ** 2).sum(-1); idx = d.argmin(-1)
outa = np.zeros(cells.shape[:2] + (4,), np.uint8); outa[..., :3] = pal[idx]; outa[..., 3] = np.where(k, 0, 255)
a = outa[..., 3] > 0; nb = np.zeros_like(a, int)
nb[1:] += a[:-1]; nb[:-1] += a[1:]; nb[:, 1:] += a[:, :-1]; nb[:, :-1] += a[:, 1:]
outa[a & (nb <= 1)] = 0
img = Image.fromarray(outa); img = img.crop(img.getbbox()); img.save(out); print(out, img.size)
