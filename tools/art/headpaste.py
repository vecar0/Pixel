"""Paste the master's head back onto each frame where it matches best (detail restore).
usage: python3 headpaste.py <master.png> X0,Y0,X1,Y1 <in_dir> <out_dir> [min_match=0.55]"""
import sys, glob, os
import numpy as np
from PIL import Image
master, box, src, dst = sys.argv[1:5]
mm = float(sys.argv[5]) if len(sys.argv) > 5 else 0.55
x0, y0, x1, y1 = map(int, box.split(','))
m = np.array(Image.open(master).convert('RGBA')).astype(int)
hb = m[y0:y1, x0:x1]; hm = hb[..., 3] > 0; h, w = hm.shape
os.makedirs(dst, exist_ok=True)
for f in sorted(glob.glob(os.path.join(src, '*.png'))):
    a = np.array(Image.open(f).convert('RGBA')).astype(int); H, W = a.shape[:2]
    best = (0, 0, 0)
    for y in range(H - h):
        for x in range(W - w):
            p = a[y:y+h, x:x+w]; pm = p[..., 3] > 0
            if (hm & pm).sum() < hm.sum() * 0.8: continue
            r = ((np.abs(p[..., :3] - hb[..., :3]).sum(-1) < 60) & hm & pm).sum() / hm.sum()
            if r > best[0]: best = (r, x, y)
    r, x, y = best
    if r >= mm:
        p = a[y:y+h, x:x+w]
        fire = (p[..., 0] > 150) & (p[..., 0] - p[..., 2] > 70) & (p[..., 3] > 0)
        put = hm & ~fire
        p[put] = hb[put]
    Image.fromarray(a.astype(np.uint8)).save(os.path.join(dst, os.path.basename(f)))
    print(os.path.basename(f), round(r, 2), 'pasted' if r >= mm else 'skip')
