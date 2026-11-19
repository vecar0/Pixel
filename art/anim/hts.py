import sys, numpy as np
from PIL import Image, ImageSequence
for g in sys.argv[1:]:
    hs = []
    for f in ImageSequence.Iterator(Image.open(g)):
        a = np.array(f.convert('RGB')).astype(int); k = (a[..., 1] > 150) & (a[..., 0] < 140) & (a[..., 2] < 140)
        ys = np.where((~k).any(1))[0]; hs.append(int(ys[-1] - ys[0]))
    print(g, hs)
