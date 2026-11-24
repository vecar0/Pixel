"""Generated pixel-art image -> true 1x sprite: find the art's cell grid, sample each cell's
centre, flood-remove the flat background. usage: pixelize.py in.png out.png [cell]"""
import sys, collections
import numpy as np
from PIL import Image
from scipy import ndimage
a = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)
H, W, _ = a.shape
def score(s, ph, g):
    i = np.round(np.arange(ph, len(g) - 1, s)).astype(int); return g[i].mean()
gx = np.abs(np.diff(a, axis=1)).sum(2).sum(0); gy = np.abs(np.diff(a, axis=0)).sum(2).sum(1)
import os
if os.environ.get('PH'):
    s = float(sys.argv[3]); phx, phy = map(float, os.environ['PH'].split(','))
elif len(sys.argv) > 3:
    s = float(sys.argv[3]); phx = max(((score(s, p, gx), p) for p in np.arange(0, s, .25)))[1]
    phy = max(((score(s, p, gy), p) for p in np.arange(0, s, .25)))[1]
else:
    best = None
    for s in np.arange(4, 12, 0.05):
        bx = max((score(s, p, gx), p) for p in np.arange(0, s, .25))
        by = max((score(s, p, gy), p) for p in np.arange(0, s, .25))
        v = (bx[0] + by[0]) / 2
        if best is None or v > best[0]: best = (v, s, bx[1], by[1])
    _, s, phx, phy = best
# cell boundaries are at the gradient peaks: centre = boundary + s/2
nx = int((W - phx) / s) - 1; ny = int((H - phy) / s) - 1
o = np.zeros((ny, nx, 3))
for j in range(ny):
    for i in range(nx):
        x0 = phx + 1 + i * s; y0 = phy + 1 + j * s
        c = a[int(y0 + s * .3):int(y0 + s * .7) + 1, int(x0 + s * .3):int(x0 + s * .7) + 1].reshape(-1, 3)
        o[j, i] = np.median(c, axis=0)
b = np.concatenate([o[0], o[-1], o[:, 0], o[:, -1]])
bg = np.median(b, axis=0)
near = np.abs(o - bg).sum(2) < 24
lab, n = ndimage.label(near)
edge_l = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bgm = np.isin(lab, list(edge_l))
# enclosed bg pockets (between arm and pole etc.)
lab2, n2 = ndimage.label(near & ~bgm)
for k in range(1, n2 + 1):
    if (lab2 == k).sum() >= 4: bgm |= lab2 == k
al = ~bgm
# halo: outline cells still close to the background colour (anti-alias residue) -> peel
for _ in range(3):
    pad = np.pad(al, 1)
    edge = al & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    sat_ = o.max(2) - o.min(2)
    halo = edge & (((np.abs(o - bg).sum(2) < 90) & (o.mean(2) > 120)) | ((sat_ < 30) & (o.mean(2) > 100) & (o.mean(2) < 195)))
    if not halo.any(): break
    al &= ~halo
ys, xs = np.nonzero(al)
if not os.environ.get('NOCROP'):
    o = o[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; al = al[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
print('phase', phx, phy, 'crop', ys.min(), xs.min())
out = np.zeros(o.shape[:2] + (4,), np.uint8); out[..., :3] = o.round().clip(0, 255); out[..., 3] = al * 255
# palette: 32 colours, no dither (clean flat shading)
rgb = out[..., :3].astype(int); satm = (rgb.max(-1) - rgb.min(-1)) > 45
def quant(mask, k):
    px = out[..., :3][mask]
    if len(px) == 0: return
    q = Image.fromarray(px[None]).quantize(colors=k, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out[..., :3][mask] = np.asarray(q)[0]
quant(al & ~satm, 24); quant(al & satm, 12)
Image.fromarray(out).save(sys.argv[2])
print('cell', round(s, 2), 'size', out.shape[1], 'x', out.shape[0], 'colours', len(np.unique(out[al][:, :3], axis=0)))
