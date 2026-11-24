"""Chain composited moves with scythe hand-off transitions (twirl re-grip / toss-and-catch / bridge).
usage: combo.py <out_dir> <spec json>   spec: [["move","v15/reap",0,6], ["twirl",4], ["move",...], ["toss",5], ["bridge",2] ...]"""
import sys, os, json, math, glob
import numpy as np
from PIL import Image
from scipy import ndimage
OUT, spec = sys.argv[1], json.loads(sys.argv[2])
sys.argv = ['reap_comp', 'body-v12.png', 'scythe-v12-nolan.png', '{"upper":[76.9,68.3],"lower":[72.7,84.4]}',
            'v15/raw/idle.gif', '/tmp/_x', ','.join(['0'] * 64), ','.join(['r'] * 64)]
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reap_comp.py')).read().split('PAD = 70')[0]
exec(src)
CW, CH, AX, AY = 380, 360, 170, 320
def load(d):
    meta = json.load(open(d + '/meta.json'))['frames']
    fx = np.median([m['feet'][0] for m in meta]); fy = np.median([m['feet'][1] for m in meta])
    return meta, np.array([AX - fx, AY - fy])
def layer(img, off):
    c = np.zeros((CH, CW, 4), int); h, w = img.shape[:2]; ox, oy = int(round(off[0])), int(round(off[1]))
    y0, x0 = max(0, oy), max(0, ox); y1, x1 = min(CH, oy + h), min(CW, ox + w)
    if y1 > y0 and x1 > x0: c[y0:y1, x0:x1] = img[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
    return c
def arr(p): return np.array(Image.open(p).convert('RGBA')).astype(int)
def smear(res, f0, t0, f1, t1, pal):
    acc = np.zeros((CH, CW), float)
    for i in range(40):
        t = i / 40
        if t < .55: continue
        p = blade_pts(f0 + (f1 - f0) * t, t0 + (t1 - t0) * t)
        xi = np.clip(np.round(p[:, 0]).astype(int), 0, CW - 1); yi = np.clip(np.round(p[:, 1]).astype(int), 0, CH - 1)
        acc[yi, xi] = np.maximum(acc[yi, xi], t)
    acc = ndimage.grey_closing(acc, size=(3, 3)); sm = (acc > 0) & (res[..., 3] == 0)
    idx = np.where(acc > .85, 2, np.where(acc > .7, 1, 0)); res[sm, :3] = pal[idx[sm]]; res[sm, 3] = 255
GREY = np.array([[110, 110, 124], [180, 180, 194], [240, 240, 252]])
frames = []; last = None; IMP = [0]   # last = dict(body, hands, grip, th, off)
items = []
for it in spec:
    if it[0] == 'move':
        d, a, b = it[1], it[2], it[3]; meta, off = load(d)
        items.append(('move', d, list(range(a, b + 1)), meta, off))
    else: items.append(tuple(it))
for n, it in enumerate(items):
    if it[0] == 'move':
        _, d, idxs, meta, off = it
        off = off + np.array([IMP[0], 0])
        seen_f = False
        for i in idxs:
            r_ = meta[i].get('role', '')
            if r_ in ('S', 's', 'f') and not seen_f: IMP[0] += 3
            ms = meta[i].get('ms', 100)
            if r_ == 'f' and not seen_f: ms += 80; seen_f = True      # hitstop
            frames.append((layer(arr(d + '/frame_%03d.png' % i), off + np.array([IMP[0], 0])), ms))
        off = off + np.array([IMP[0], 0])
        i = idxs[-1]; last = dict(d=d, i=i, meta=meta[i], off=off)
        continue
    kind, cnt = it[0], it[1]
    if kind == 'circle':
        # ["circle", dir, [frame idxs], extra_turns, end_angle_deg]: scythe sweeps a full circle around her
        cd, cidx, turns, end_deg = it[1], it[2], it[3], it[4]
        cmeta, coff = load(cd); coff = coff + np.array([IMP[0], 0])
        gA = np.array(last['meta']['grip']) + last['off']; tA = last['meta']['th']
        tB = math.radians(end_deg); dd = (tB - tA) % (2 * math.pi) + 2 * math.pi * turns
        pf, pt = gA, tA; nfr = len(cidx)
        for j, ci in enumerate(cidx):
            t = (j + 1) / nfr; te = 1 - (1 - t) ** 2          # fast start, eases into the top
            body = layer(arr(cd + '/body_%03d.png' % ci), coff)
            hands = layer(arr(cd + '/hands_%03d.png' % ci)[..., :1].repeat(4, -1), coff)[..., 0] > 0
            g = np.array(cmeta[ci]['grip']) + coff
            th = tA + dd * te; res = body.copy()
            acc = np.zeros((CH, CW), float)
            for i in range(36):
                u = i / 35; p = blade_pts(pf + (g - pf) * u, pt + (th - pt) * u)
                xi = np.clip(np.round(p[:, 0]).astype(int), 0, CW - 1); yi = np.clip(np.round(p[:, 1]).astype(int), 0, CH - 1)
                acc[yi, xi] = np.maximum(acc[yi, xi], .2 + .8 * u)
            acc = ndimage.grey_closing(acc, size=(4, 4)); sm = (acc > 0) & (res[..., 3] == 0)
            idx = np.where(acc > .8, 2, np.where(acc > .5, 1, 0)); res[sm, :3] = GREY[idx[sm]]; res[sm, 3] = 255
            sc = place(g, g, th, CH, CW, Sa=(S_NOBLADE if j < nfr - 1 else S)); m_ = sc[..., 3] > 0
            if 'B' in it: m_ &= body[..., 3] == 0
            res[m_] = sc[m_]
            res[hands] = body[hands]
            frames.append((res, 45 if j < nfr - 1 else 90)); pf, pt = g, th
        last = dict(d=cd, i=cidx[-1], meta=dict(cmeta[cidx[-1]], th=th), off=coff)
        continue
    nxt = items[n + 1]
    if nxt[0] == 'circle':
        cm_, co_ = load(nxt[1]); nd, ni, nmeta, noff = nxt[1], nxt[2][0], cm_[nxt[2][0]], co_
    else: nd, ni, nmeta, noff = nxt[1], nxt[2][0], nxt[3][nxt[2][0]], nxt[4]
    noff = noff + np.array([IMP[0], 0])
    gA = np.array(last['meta']['grip']) + last['off']; gB = np.array(nmeta['grip']) + noff
    tA = last['meta']['th']; tB = nmeta['th']
    d = (tB - tA + math.pi) % (2 * math.pi) - math.pi
    spins = {'twirl': 2 * math.pi, 'toss': 4 * math.pi, 'bridge': 0}[kind]
    if kind == 'twirl' and len(it) > 2: spins = 2 * math.pi * it[2]
    height = 38
    if kind == 'toss' and len(it) > 2: height = it[2]; spins = 2 * math.pi * (it[3] if len(it) > 3 else 2)
    bodyA = layer(arr(last['d'] + '/body_%03d.png' % last['i']), last['off'])
    handA = layer(arr(last['d'] + '/hands_%03d.png' % last['i'])[..., :1].repeat(4, -1), last['off'])[..., 0] > 0
    bodyB = layer(arr(nd + '/body_%03d.png' % ni), noff)
    handB = layer(arr(nd + '/hands_%03d.png' % ni)[..., :1].repeat(4, -1), noff)[..., 0] > 0
    pf, pt = gA, tA
    for j in range(1, cnt + 1):
        t = j / (cnt + 1); te = t * t * (3 - 2 * t)
        fm = gA + (gB - gA) * te; th = tA + (d + spins) * t
        if kind == 'toss': fm = fm + np.array([0, -height * math.sin(math.pi * t)])
        body, hands = (bodyA, handA) if t < .5 else (bodyB, handB)
        res = body.copy()
        if kind != 'bridge': smear(res, pf, pt, fm, th, GREY)
        sc = place(fm, fm, th, CH, CW); sm = sc[..., 3] > 0
        if 'B' in it: sm &= body[..., 3] == 0
        res[sm] = sc[sm]
        if kind != 'toss' or t > .8: res[hands] = body[hands]
        frames.append((res, 45 if kind != 'bridge' else 60)); pf, pt = fm, th
os.makedirs(OUT, exist_ok=True)
for f in glob.glob(OUT + '/*.png'): os.remove(f)
for i, (im, ms) in enumerate(frames): Image.fromarray(im.astype(np.uint8)).save(OUT + '/frame_%03d.png' % i)
json.dump([int(ms * float(os.environ.get('TSCALE', '1'))) for _, ms in frames], open(OUT + '/timing.json', 'w'))
bg = np.array([40, 38, 52, 255])
pics = []
for im, ms in frames:
    c = np.where(im[..., 3:4] > 0, im, bg).astype(np.uint8)
    pics.append(Image.fromarray(c).convert('RGB').resize((CW * 3, CH * 3), Image.NEAREST))
TS = float(os.environ.get('TSCALE', '1'))
durs = [int(ms * TS) for _, ms in frames]; durs[-1] = 700
pics[0].save(OUT + '/preview.gif', save_all=True, append_images=pics[1:], duration=durs, loop=0)
print('frames', len(frames))
