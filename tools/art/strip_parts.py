"""Keep all detail; only (1) recolour thick white patches to the cape's dark tones,
(2) erase the lantern that hangs at the blade tip (largest orange blob) and its flame.
usage: python3 strip_parts.py <in_dir> <out_dir>"""
import sys, glob, os
import numpy as np
from PIL import Image
from scipy import ndimage
K8 = np.ones((3, 3), bool)

def run(a):
    al = a[..., 3] > 0
    rgb = a[..., :3].astype(int)
    l = 0.3*rgb[..., 0] + 0.59*rgb[..., 1] + 0.11*rgb[..., 2]
    sat = rgb.max(-1) - rgb.min(-1)
    rb0 = rgb[..., 0] - rgb[..., 2]
    skinmid0 = al & (rb0 > 40) & (rb0 < 100) & (l > 135) & (l < 190)
    ys, xs = np.nonzero(al); fy = ys.max(); fx = xs[ys >= fy - 3].mean()
    yy, xx = np.mgrid[:al.shape[0], :al.shape[1]]
    eyezone = (yy > fy - 70) & (yy < fy - 45) & (np.abs(xx - fx) < 22)
    # (2) blade-tip lantern: the largest orange blob (eyes excluded)
    org = al & (rgb[..., 0] > 150) & (rgb[..., 0] - rgb[..., 2] > 70)
    eyes0 = org & eyezone
    le, ne = ndimage.label(eyes0, structure=K8)
    if ne:
        se = ndimage.sum(eyes0, le, range(1, ne + 1)); small = np.zeros(ne + 1, bool); small[1:] = se <= 25
        eyes0 = small[le] & eyes0
    org &= ~eyes0
    lab, n = ndimage.label(ndimage.binary_dilation(org, structure=K8, iterations=3), structure=K8)
    lab = lab * org
    kill = np.zeros_like(al)
    if n >= 1:
        sz = ndimage.sum(org, lab, range(1, n + 1))
        ys, xs = np.nonzero(al); fy = ys.max(); fx = xs[ys >= fy - 3].mean()
        main = 1 + int(np.argmax(sz))       # the blade-tip lantern + its flame
        kill |= ndimage.binary_dilation(lab == main, structure=K8, iterations=3) & al
        kill &= ~ndimage.binary_dilation(eyes0, structure=np.ones((5, 5), bool), iterations=3)
    if kill.any():
        # body = largest connected piece; floating lantern bits are deleted,
        # flame lying on the blade/pole is repainted in the blade's greys
        lb, nb_ = ndimage.label(al, structure=K8)
        szb = ndimage.sum(al, lb, range(1, nb_ + 1))
        body = lb == (1 + int(np.argmax(szb)))
        floating = ndimage.binary_dilation(org & ~body, structure=K8, iterations=2) & ~body
        dele = (kill | floating) & ~body
        a[dele, 3] = 0
        onb = kill & body & org
        if onb.any():
            t = ((l[onb] - 100) / 155.0).clip(0, 1)
            g = (30 + t * 70).astype(int)
            a[onb, 0] = g; a[onb, 1] = g; a[onb, 2] = (g + 4).clip(0, 255)
        # warm brown fringe of the flame on the body -> grey as well
        fr = kill & body & ~org & ((rgb[..., 0] - rgb[..., 2]) > 30)
        if fr.any():
            g = (l[fr] * 0.6).astype(int).clip(20, 120)
            a[fr, 0] = g; a[fr, 1] = g; a[fr, 2] = (g + 4).clip(0, 255)
        al = a[..., 3] > 0
        lab2, n2 = ndimage.label(al, structure=K8)
        if n2 > 1:
            sz2 = ndimage.sum(al, lab2, range(1, n2 + 1))
            k2 = np.zeros(n2 + 1, bool); k2[1:] = sz2 >= 25; al &= k2[lab2]; a[~al, 3] = 0
        rgb = a[..., :3].astype(int); l = 0.3*rgb[..., 0]+0.59*rgb[..., 1]+0.11*rgb[..., 2]
        sat = rgb.max(-1) - rgb.min(-1)
    # (1) white patches: bright, unsaturated, in thick regions (thin blade highlight survives)
    rb = rgb[..., 0] - rgb[..., 2]
    # face guard: eyes are small amber blobs at head height; protect around them
    ys, xs = np.nonzero(al); fy = ys.max(); fx = xs[ys >= fy - 3].mean()
    yy, xx = np.mgrid[:al.shape[0], :al.shape[1]]
    eyes = al & (rgb[..., 0] > 150) & (rb > 70) & (yy > fy - 70) & (yy < fy - 45) & (np.abs(xx - fx) < 30)
    lab, n = ndimage.label(eyes, structure=K8)
    if n:
        sz = ndimage.sum(eyes, lab, range(1, n + 1))
        ok = np.zeros(n + 1, bool); ok[1:] = sz <= 25; eyes = ok[lab] & eyes
    face = ndimage.binary_dilation(eyes, structure=np.ones((5, 5), bool), iterations=3)
    skinmid = al & (rb > 40) & (rb < 100) & (l > 135) & (l < 190)   # mid skin tones
    nearskin = ndimage.binary_dilation(skinmid, structure=K8, iterations=2)
    wh = al & ~face & (l > 150) & (((sat < 45) & (rb < 25)) | ((rb < 45) & ~nearskin))
    thick = ndimage.binary_opening(wh, structure=np.ones((2, 2), bool))
    zone = ndimage.binary_dilation(thick, structure=K8, iterations=3) & wh
    if zone.any():
        # map 150..255 -> dark cape greys, keeping relative shading
        t = (l[zone] - 150) / 105.0
        g = (38 + t * 42).astype(int)
        a[zone, 0] = g; a[zone, 1] = g; a[zone, 2] = (g + 6).clip(0, 255)
    return a

src, dst = sys.argv[1:3]
os.makedirs(dst, exist_ok=True)
for f in sorted(glob.glob(os.path.join(src, '*.png'))):
    a = np.array(Image.open(f).convert('RGBA'))
    Image.fromarray(run(a)).save(os.path.join(dst, os.path.basename(f)))
print('ok', dst)
