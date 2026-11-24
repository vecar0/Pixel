"""Keep all detail; only (1) recolour thick white patches to the cape's dark tones,
(2) erase the small extra lantern (every orange blob except the main lantern).
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
    # (2) extra lantern: orange blobs other than the largest
    org = al & (rgb[..., 0] > 150) & (rgb[..., 0] - rgb[..., 2] > 70)
    lab, n = ndimage.label(ndimage.binary_dilation(org, structure=K8, iterations=3), structure=K8)
    lab = lab * org
    kill = np.zeros_like(al)
    if n > 1:
        sz = ndimage.sum(org, lab, range(1, n + 1))
        ys, xs = np.nonzero(al); fy = ys.max(); fx = xs[ys >= fy - 3].mean()
        main = 1 + int(np.argmax(sz))
        com = ndimage.center_of_mass(org, lab, range(1, n + 1))
        for i, (cy, cx) in enumerate(com, 1):
            if i == main or sz[i-1] < 3 or sz[i-1] > 40: continue
            low = cy >= fy - 25                      # near the feet: the pole lantern
            side = cy >= fy - 38 and abs(cx - fx) > 25  # swinging out at the side
            if low or side:
                kill |= ndimage.binary_dilation(lab == i, structure=K8, iterations=2) & al
        # don't eat the main lantern or bright skin
        kill &= ~ndimage.binary_dilation(lab == main, structure=K8)
    if kill.any():
        src = al & ~kill
        # fill from nearest pixel that is either untouched body or empty
        ref = ~kill
        _, (iy, ix) = ndimage.distance_transform_edt(~ref, return_indices=True)
        a[kill] = a[iy[kill], ix[kill]]
        al = a[..., 3] > 0
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
