# 배경 3장(먼 배경·중간층·바닥)을 게임용으로: python3 mkbg.py <n> <midkey: magenta|green>
import sys, numpy as np
from PIL import Image
n, key = sys.argv[1], sys.argv[2]; A = '../../assets/'
far = Image.open(f'far{n}.png').convert('RGB')
far.resize((840, 360), Image.BOX).quantize(64, method=Image.Quantize.MEDIANCUT).convert('RGB').save(A + f'bg{n}-far.png')
mid = np.array(Image.open(f'mid{n}.png').convert('RGB')).astype(int); r, g, b = mid[..., 0], mid[..., 1], mid[..., 2]
k = (r > 170) & (b > 170) & (g < 120) if key == 'magenta' else (g > 170) & (r < 120) & (b < 120)
m = Image.fromarray(np.dstack([mid, np.where(k, 0, 255)]).astype(np.uint8)); m = m.crop(m.getbbox())
m = m.resize((int(m.width * 0.42), int(m.height * 0.42)), Image.NEAREST)
a = np.array(m); rr, gg, bb = [a[..., i].astype(int) for i in range(3)]
a[((rr > 150) & (bb > 150) & (gg < 130)) if key == 'magenta' else ((gg > 150) & (rr < 130) & (bb < 130)), 3] = 0
Image.fromarray(a).save(A + f'bg{n}-mid.png')
gr = Image.open(f'ground{n}.png').convert('RGB'); ga = np.array(gr).astype(int); lum = ga.mean(2)
top = [y for y in range(ga.shape[0]) if (lum[y] > 55).mean() > 0.3][0]
strip = gr.crop((0, max(0, top - 30), gr.width, gr.height)); s = 0.3
strip = strip.resize((int(strip.width * s), int(strip.height * s)), Image.BOX).quantize(48).convert('RGBA')
sa = np.array(strip); L = sa[..., :3].astype(int).mean(2)
for y in range(int(30 * s)): sa[y, L[y] < 45, 3] = 0
Image.fromarray(sa).save(A + f'bg{n}-ground.png'); print(n, 'ok', m.size, strip.size)
