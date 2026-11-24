"""Execution move: kick-spin-catch-diagonal cut. Reuses reap_comp's keying/fists/placement,
adds free-flight scythe keys, kick spark, crimson crescent, and per-frame layering."""
import sys, os, math, json
import numpy as np
from PIL import Image
from scipy import ndimage
body, sc, grip, gif, out = sys.argv[1:6]
sys.argv = ['reap_comp', body, sc, grip, gif, out, ','.join(['0'] * 64), ','.join(['r'] * 64)]
src = open(os.path.join(os.path.dirname(__file__), 'reap_comp.py')).read().split('PAD = 70')[0]
exec(src)
PAD = 70
# per GIF frame: mode, hint/angle (deg), ms, layer ('front'|'behind'), smear ('', 'grey', 'red')
PLAN = [
 ('hand', 0, 120, 'front', ''), ('hand', 0, 200, 'front', ''),
 ('free', 35, 90, 'front', ''), ('free', 110, 70, 'front', 'grey'),
 ('kick', 200, 130, 'front', 'grey'),
 ('spin', 350, 50, 'front', 'grey'), ('spin', 500, 50, 'front', 'grey'), ('spin', 650, 50, 'behind', 'grey'),
 ('hand', -40, 110, 'front', 'grey'),
 ('hand', 70, 50, 'front', 'red'), ('hand', 165, 260, 'front', 'red'),
 ('hand', 230, 80, 'front', ''), ('hand', 235, 80, 'front', ''), ('hand', 235, 160, 'front', ''),
 ('hand', 235, 120, 'front', ''), ('hand', 235, 420, 'front', ''),
]
frames = []; prev_th = prev_fm = None; last_hand = None
for k, a in enumerate(fr[:len(PLAN)]):
    mode, ang, ms, layer, smear = PLAN[k]
    o, m = pix(a); ny, nx = m.shape
    cv = np.zeros((ny + 2 * PAD, nx + 2 * PAD, 4), int)
    cv[PAD:PAD + ny, PAD:PAD + nx, :3] = o.round(); cv[PAD:PAD + ny, PAD:PAD + nx, 3] = m * 255
    yb, xb = np.nonzero(m); top, bot = yb.min() + PAD, yb.max() + PAD; bh = bot - top
    cxb = np.median(xb) + PAD
    c = sorted(fists(o, m), key=lambda t: -t[2])[:2]
    th = math.radians(ang); spark = None
    if mode == 'hand':
        if len(c) == 2 and np.linalg.norm(c[0][0] - c[1][0]) >= 4: fm = (c[0][0] + c[1][0]) / 2 + PAD
        elif c: fm = c[0][0] + PAD
        else:   # relaxed: any small skin blob nearest the previous hand
            rb = o[..., 0] - o[..., 2]; L = .3 * o[..., 0] + .59 * o[..., 1] + .11 * o[..., 2]
            sk = m & (rb > 12) & (L > 140); lab, n = ndimage.label(sk, K8); best = None
            for i in range(1, n + 1):
                yy, xx = np.nonzero(lab == i)
                if len(yy) < 3: continue
                p = np.array([xx.mean(), yy.mean()]) + PAD
                if yy.mean() + PAD < top + bh * .4: continue
                d = np.linalg.norm(p - (last_hand if last_hand is not None else p))
                if best is None or d < best[0]: best = (d, p, lab == i)
            if best is not None:
                fm = best[1]; c = [(best[1] - PAD, best[2], 0)]
            else: fm = prev_fm
        last_hand = fm
    elif mode == 'free':
        base = last_hand if last_hand is not None else np.array([cxb + 15, top + bh * .45])
        fm = base + (np.array([4, 4]) if ang < 60 else np.array([10, bh * .25]))
    elif mode == 'kick':
        lower = (yb + PAD > top + bh * .3)
        i = np.argmax(xb[lower]); foot = np.array([xb[lower][i] + PAD, yb[lower][i] + PAD])
        fm = foot + np.array([2, -2]); spark = foot
    else:  # spin: rising in front of / above her
        n = ['spin'] and sum(1 for p in PLAN[:k] if p[0] == 'spin')
        fm = np.array([cxb + 14 - 4 * n, top - 6 - 10 * n])
    if prev_th is not None and mode != 'spin':     # continue the rotation the short way
        th = prev_th + ((th - prev_th + math.pi) % (2 * math.pi) - math.pi)
    if mode == 'hand':
        feet_y = bot
        for dt in [0] + [d * sg for d in range(5, 120, 5) for sg in (1, -1)]:
            t2 = th + math.radians(dt)
            if blade_pts(fm, t2)[:, 1].max() <= feet_y + 2: th = t2; break
    sc_ = place(fm, fm, th, *cv.shape[:2])
    res = cv.copy()
    if smear and prev_th is not None:
        acc = np.zeros(cv.shape[:2], float); dth = th - prev_th
        for i in range(48):
            t = i / 48
            if t < (.62 if mode in ('free', 'kick', 'spin') else .25): continue
            p = blade_pts(prev_fm + (fm - prev_fm) * t, prev_th + dth * t)
            xi = np.clip(np.round(p[:, 0]).astype(int), 0, cv.shape[1] - 1); yi = np.clip(np.round(p[:, 1]).astype(int), 0, cv.shape[0] - 1)
            acc[yi, xi] = np.maximum(acc[yi, xi], t)
        acc = ndimage.grey_closing(acc, size=(3, 3)); smk = acc > 0
        if True:
            pal = np.array([[90, 10, 24], [190, 30, 40], [255, 120, 110]])
        else:
            pal = np.array([[120, 120, 132], [190, 190, 202], [245, 245, 255]])
        idx = np.where(acc > .75, 2, np.where(acc > .5, 1, 0))
        put = smk & (res[..., 3] == 0) if mode != 'hand' else smk
        res[put, :3] = pal[idx[put]]; res[put, 3] = 255
    smk = sc_[..., 3] > 0
    if layer == 'behind': smk &= cv[..., 3] == 0
    res[smk] = sc_[smk]
    if mode == 'hand':
        for t in c:
            ff = np.zeros(cv.shape[:2], bool); ff[PAD:PAD + ny, PAD:PAD + nx] = ndimage.binary_dilation(t[1], K8)
            ff &= cv[..., 3] > 0; res[ff] = cv[ff]
    if spark is not None:   # kick impact: 8-ray pixel burst, crimson/violet
        for r_ in range(2, 9):
            for ang8 in range(0, 360, 45):
                x = int(round(spark[0] + r_ * math.cos(math.radians(ang8 + 22)))); y = int(round(spark[1] + r_ * math.sin(math.radians(ang8 + 22))))
                if 0 <= x < res.shape[1] and 0 <= y < res.shape[0]:
                    res[y, x] = (255, 90, 110, 255) if r_ < 5 else (170, 70, 220, 255)
    hm = np.zeros(cv.shape[:2], bool)
    if mode == 'hand':
        for t in c: hm[PAD:PAD + ny, PAD:PAD + nx] |= ndimage.binary_dilation(t[1], K8)
    hm &= cv[..., 3] > 0
    frames.append({'img': res, 'body': cv.copy(), 'hands': hm, 'grip': [float(fm[0]), float(fm[1])], 'th': th, 'ms': ms, 'feet': [float(np.median(xb[yb >= yb.max() - 3])) + PAD, float(bot)], 'mode': mode})
    prev_th, prev_fm = th, fm
os.makedirs(out, exist_ok=True)
meta = []
for i, f in enumerate(frames):
    Image.fromarray(f['img'].astype(np.uint8)).save(os.path.join(out, 'frame_%03d.png' % i))
    Image.fromarray(f['body'].astype(np.uint8)).save(os.path.join(out, 'body_%03d.png' % i))
    Image.fromarray((f['hands'] * 255).astype(np.uint8)).save(os.path.join(out, 'hands_%03d.png' % i))
    meta.append({k: v for k, v in f.items() if k not in ('img', 'body', 'hands')})
json.dump({'frames': meta}, open(os.path.join(out, 'meta.json'), 'w'), indent=1)
print('frames', len(frames))
