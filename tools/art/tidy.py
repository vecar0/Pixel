"""Tidy video-derived pixel frames toward the master's look.
- snap to master palette, flatten mottled shading (mode filter),
- smooth the silhouette, 1px dark selective outline like the master.
usage: python3 tidy.py <master.png> <in_dir> <out_dir>"""
import sys, glob, os
import numpy as np
from PIL import Image
from scipy import ndimage

K8 = np.ones((3, 3), int)

def lum(c): return 0.3 * c[..., 0] + 0.59 * c[..., 1] + 0.11 * c[..., 2]

def neigh_mode(idx, al, y, x, H, W):
    vals = {}
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == dx == 0: continue
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and al[yy, xx]:
                v = idx[yy, xx]; vals[v] = vals.get(v, 0) + 1
    if not vals: return None, 0
    v = max(vals, key=vals.get); return v, vals[v]

def tidy(a, pal):
    H, W = a.shape[:2]
    al = a[..., 3] > 0
    rgb = a[..., :3].astype(float)
    d = ((rgb[..., None, :] - pal[None, None]) ** 2).sum(-1)
    idx = d.argmin(-1)
    pl = lum(pal)
    orange = (pal[:, 0] > 150) & (pal[:, 0] - pal[:, 2] > 80)
    # flame bleed: dim/brownish warm pixels that are not real flame -> neutral of same lum
    warm = (pal[:, 0] - pal[:, 2] > 25)
    neutral = np.nonzero(~warm)[0]
    src_l = lum(rgb)
    flame = orange[idx] & (src_l > 115)
    skinp = warm & ~orange & (pl > 130)
    skin = al & skinp[idx]
    # keep warm pixels (eyes, blush, hands) near real skin clusters
    lab, n = ndimage.label(skin, structure=K8)
    if n:
        sz = ndimage.sum(skin, lab, range(1, n + 1))
        big = np.zeros(n + 1, bool); big[1:] = sz >= 5
        skin = big[lab] & skin
    nearskin = ndimage.binary_dilation(skin, structure=np.ones((7, 7)))
    bleed = al & warm[idx] & ~flame & ~nearskin
    if bleed.any():
        dl = np.abs(src_l[bleed][:, None] - pl[neutral][None])
        idx[bleed] = neutral[dl.argmin(-1)]
    # isolated flame specks (small orange blobs away from the lantern) -> neutral too
    ob = al & orange[idx]
    lab, n = ndimage.label(ob, structure=K8)
    if n:
        sz = ndimage.sum(ob, lab, range(1, n + 1))
        small = np.zeros(n + 1, bool); small[1:] = sz < 12
        sm = small[lab] & ob
        if sm.any():
            dl = np.abs(src_l[sm][:, None] - pl[neutral][None])
            idx[sm] = neutral[dl.argmin(-1)]
    # silhouette: drop thin spurs, fill notches
    for _ in range(2):
        nb = ndimage.convolve(al.astype(int), K8, mode='constant') - al
        al = (al & (nb >= 3)) | (~al & (nb >= 6))
        for y, x in zip(*np.nonzero(al & (a[..., 3] == 0))):
            m, _ = neigh_mode(idx, al, y, x, H, W)
            if m is not None: idx[y, x] = m
        a[..., 3] = np.where(al, 255, 0)
    # flatten: lone colours -> neighbourhood mode; near-lum noise -> mode
    for it in range(3):
        new = idx.copy()
        for y, x in zip(*np.nonzero(al)):
            m, c = neigh_mode(idx, al, y, x, H, W)
            if m is None or m == idx[y, x]: continue
            same = sum(1 for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                       if (dy or dx) and 0 <= y+dy < H and 0 <= x+dx < W
                       and al[y+dy, x+dx] and idx[y+dy, x+dx] == idx[y, x])
            close = abs(pl[m] - pl[idx[y, x]]) < 28 and orange[m] == orange[idx[y, x]]
            if same == 0 or (close and c >= 5 and same <= 1):
                new[y, x] = m
        idx = new
    out = np.zeros_like(a)
    out[..., :3] = pal[idx].astype(np.uint8)
    out[..., 3] = np.where(al, 255, 0)
    # selective outline: edge pixels (4-conn to empty) become darkest tone, except flame
    pad = np.pad(al, 1)
    edge = al & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    dark = pal[pl.argmin()]
    keep = orange[idx]
    o = edge & ~keep
    out[o, :3] = dark
    return out

master, src, dst = sys.argv[1:4]
m = np.array(Image.open(master).convert('RGBA'))
pal = np.unique(m[m[..., 3] > 0][:, :3], axis=0).astype(float)
os.makedirs(dst, exist_ok=True)
for f in sorted(glob.glob(os.path.join(src, '*.png'))):
    a = np.array(Image.open(f).convert('RGBA'))
    Image.fromarray(tidy(a, pal)).save(os.path.join(dst, os.path.basename(f)))
print('ok', dst, len(pal), 'colours')
