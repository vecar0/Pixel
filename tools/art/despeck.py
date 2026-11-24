"""Clean pixel_motion frames: drop detached specks/streaks and white edge fringe.
usage: python3 despeck.py <in_dir> <out_dir> [min_blob=40]"""
import sys, glob, os
import numpy as np
from PIL import Image
from scipy import ndimage

def clean(a, min_blob):
    al = a[..., 3] > 0
    # 1) remove small detached blobs (8-connected)
    lab, n = ndimage.label(al, structure=np.ones((3, 3)))
    if n:
        sizes = ndimage.sum(al, lab, range(1, n + 1))
        keep = np.zeros(n + 1, bool); keep[1:] = sizes >= min_blob
        al &= keep[lab]
    if os.environ.get('BLOBS_ONLY'):
        out = a.copy(); out[..., 3] = np.where(al, 255, 0); return out
    # 2) peel bright, low-saturation pixels on the outline (repeat: thin streaks)
    rgb = a[..., :3].astype(int)
    bright = (rgb.min(-1) > 150) & (rgb.max(-1) - rgb.min(-1) < 60)
    for _ in range(2):
        nb = ndimage.convolve(al.astype(int), np.ones((3, 3), int), mode='constant') - al
        edge = al & bright & (nb <= 4)
        al &= ~edge
    # 3) any single pixel with <=1 neighbour
    nb = ndimage.convolve(al.astype(int), np.ones((3, 3), int), mode='constant') - al
    al &= ~(nb <= 1)
    out = a.copy(); out[..., 3] = np.where(al, 255, 0)
    return out

src, dst = sys.argv[1], sys.argv[2]
mb = int(sys.argv[3]) if len(sys.argv) > 3 else 40
os.makedirs(dst, exist_ok=True)
for f in sorted(glob.glob(os.path.join(src, '*.png'))):
    a = np.array(Image.open(f).convert('RGBA'))
    Image.fromarray(clean(a, mb)).save(os.path.join(dst, os.path.basename(f)))
print('ok', dst)
