"""Big-scythe compositor v2: body GIF (two fists apart on an invisible pole) -> pixel frames
+ rigid scythe whose angle follows the fist line, smear arcs on swing frames, retimed.
usage: reap_comp.py <body.png> <scythe.png> <grip json> <in.gif> <out_dir> <hint angles> <roles>
roles per GIF frame: r=ready a=anticipation s=swing f=follow-through h=hold x=skip"""
import sys, os, json, math
import numpy as np
from PIL import Image, ImageSequence
from scipy import ndimage
body_p, sc_p, grip_s, gif, out, hints, roles = sys.argv[1:8]
HINT = [float(x) for x in hints.split(',')]; ROLE = roles.split(',')
K8 = np.ones((3, 3), bool)
B = np.array(Image.open(body_p)).astype(int); r = np.nonzero(B[..., 3].any(1))[0]; BODY_H = r[-1] - r[0] + 1
S = np.array(Image.open(sc_p)).astype(int)
g = json.loads(grip_s); G1 = np.array(g['upper'], float); G2 = np.array(g['lower'], float)
GA = math.atan2(*(G2 - G1)[::-1]); GM = (G1 + G2) / 2
LAN = None
if os.environ.get('LANTERN'):
    lp, lj = os.environ['LANTERN'].split(',')
    LAN = np.array(Image.open(lp)).astype(int); LAN_AT = np.array(json.load(open(lj))['attach'], float)
fr = [np.asarray(f.convert('RGB')).astype(float) for f in ImageSequence.Iterator(Image.open(gif))]
H, W, _ = fr[0].shape
def mask(a):
    bgc = np.median(np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]), axis=0)
    near = np.abs(a - bgc).sum(2) < 18
    lab, n = ndimage.label(near)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    return ~np.isin(lab, list(edge))
hs = [(lambda rr: rr[-1] - rr[0] + 1)(np.nonzero(mask(a).sum(1) >= 3)[0]) for a in fr]
cell = np.percentile(hs, 75) / BODY_H
def pix(a):
    ny, nx = int(H / cell), int(W / cell); o = np.zeros((ny, nx, 3)); m = np.zeros((ny, nx), bool); mk = mask(a)
    for j in range(ny):
        for i in range(nx):
            y0, x0 = j * cell, i * cell
            sl = (slice(int(y0 + cell * .25), int(y0 + cell * .75) + 1), slice(int(x0 + cell * .25), int(x0 + cell * .75) + 1))
            mm = mk[sl]
            if mm.mean() >= .5: o[j, i] = np.median(a[sl][mm], axis=0); m[j, i] = True
    lab, n = ndimage.label(m, K8)
    if n:
        sz = ndimage.sum(m, lab, range(1, n + 1)); keep = np.zeros(n + 1, bool); keep[1:] = sz >= 20; m &= keep[lab]
    return o, m
def fists(o, m):
    rb = o[..., 0] - o[..., 2]; L = .3 * o[..., 0] + .59 * o[..., 1] + .11 * o[..., 2]
    sk = m & (rb > 15) & (L > 150)
    ys = np.nonzero(m.any(1))[0]; top, bh = ys[0], ys[-1] - ys[0]
    lab, n = ndimage.label(ndimage.binary_dilation(sk, K8) & m, K8); c = []
    for i in range(1, n + 1):
        reg = (lab == i) & sk; yy, xx = np.nonzero(reg)
        if len(yy) >= 4: c.append((np.array([xx.mean(), yy.mean()]), reg, len(yy)))
    hx = np.nonzero(m[top:top + int(bh * .25)].any(0))[0].mean()
    face_c = [t for t in c if top + bh * .14 < t[0][1] < top + bh * .4]
    if face_c:
        near = [t for t in face_c if abs(t[0][0] - hx) < bh * .18] or face_c
        face = max(near, key=lambda t: t[2]); c = [t for t in c if t is not face]
    # thighs: wide skin between skirt and stockings, near the body's middle column, lower half
    midx = np.median(np.nonzero(m[top + int(bh * .5):top + int(bh * .7)])[1]) if bh > 0 else 0
    c = [t for t in c if t[2] >= 8]
    c = [t for t in c if not (top + bh * .55 < t[0][1] < top + bh * .8 and abs(t[0][0] - midx) < bh * .12)]
    return c
def _scale2x(a):
    H_, W_ = a.shape[:2]; P = np.pad(a, ((1, 1), (1, 1), (0, 0)), mode='edge')
    B = P[:-2, 1:-1]; D = P[1:-1, :-2]; E = a; F = P[1:-1, 2:]; Hh = P[2:, 1:-1]
    eq = lambda x, y: (x == y).all(-1)
    c = ~eq(B, Hh) & ~eq(D, F)
    E0 = np.where((c & eq(D, B))[..., None], D, E); E1 = np.where((c & eq(B, F))[..., None], F, E)
    E2 = np.where((c & eq(D, Hh))[..., None], D, E); E3 = np.where((c & eq(Hh, F))[..., None], F, E)
    o = np.zeros((H_ * 2, W_ * 2, a.shape[2]), a.dtype)
    o[0::2, 0::2] = E0; o[0::2, 1::2] = E1; o[1::2, 0::2] = E2; o[1::2, 1::2] = E3
    return o
_UP = {}
def _up8(Sa):
    k = id(Sa)
    if k not in _UP: _UP[k] = _scale2x(_scale2x(_scale2x(Sa)))
    return _UP[k]
def place(F_up, F_lo, th, H_, W_, Sa=S, lantern=True, slide=0.0):
    fm = (F_up + F_lo) / 2
    ax_ = (G1 - G2) / np.linalg.norm(G1 - G2); cs_, sn_ = math.cos(th), math.sin(th)
    fm = fm + slide * np.array([cs_ * ax_[0] - sn_ * ax_[1], sn_ * ax_[0] + cs_ * ax_[1]]); out = np.zeros((H_, W_, 4), int); c, s = math.cos(th), math.sin(th)
    yy, xx = np.mgrid[:H_, :W_]; dx, dy = xx - fm[0], yy - fm[1]
    # RotSprite-style: sample the 8x scale2x-upscaled sprite (keeps lines and curves clean)
    U = _up8(Sa)
    sxf = c * dx + s * dy + GM[0] + .5; syf = -s * dx + c * dy + GM[1] + .5
    ux = np.floor(sxf * 8).astype(int); uy = np.floor(syf * 8).astype(int)
    ok = (ux >= 0) & (ux < U.shape[1]) & (uy >= 0) & (uy < U.shape[0]); out[ok] = U[uy[ok], ux[ok]]
    if LAN is not None and lantern:
        ax, ay = LAN_AT - GM; px = fm[0] + c * ax - s * ay; py = fm[1] + s * ax + c * ay
        ly, lx = np.nonzero(LAN[..., 3] > 0)
        ty = np.round(ly - LAN_AT[1] + py).astype(int); tx = np.round(lx - LAN_AT[0] + px).astype(int)
        ok2 = (ty >= 0) & (ty < H_) & (tx >= 0) & (tx < W_); out[ty[ok2], tx[ok2]] = LAN[ly[ok2], lx[ok2]]
    return out
# blade mask in sprite space: the bright/blade part = rows above the grip, far from the pole line
yy, xx = np.mgrid[:S.shape[0], :S.shape[1]]
_L = .3 * S[..., 0] + .59 * S[..., 1] + .11 * S[..., 2]
BLADE = (S[..., 3] > 0) & (yy < G1[1] - 18) & (_L > 120)      # the bright cutting edge only
BLADE_ALL = (S[..., 3] > 0) & (yy < G1[1] - 18)
S_NOBLADE = S.copy(); S_NOBLADE[BLADE_ALL] = 0
def blade_all_pts(fm, th, slide=0.0):
    ax_ = (G1 - G2) / np.linalg.norm(G1 - G2); c, s = math.cos(th), math.sin(th)
    fm = fm + slide * np.array([c * ax_[0] - s * ax_[1], s * ax_[0] + c * ax_[1]])
    ys, xs = np.nonzero(BLADE_ALL); dx, dy = xs - GM[0], ys - GM[1]
    return np.stack([fm[0] + c * dx - s * dy, fm[1] + s * dx + c * dy], 1)
def blade_pts(fm, th):
    ys, xs = np.nonzero(BLADE); c, s = math.cos(th), math.sin(th)
    dx, dy = xs - GM[0], ys - GM[1]
    return np.stack([fm[0] + c * dx - s * dy, fm[1] + s * dx + c * dy], 1)
SLIDE = [float(x) for x in os.environ['SLIDE'].split(',')] if os.environ.get('SLIDE') else None
PAD = 70; hold_ref = None; frames = []; prev_sl = 0.0; prev_th = None; prev_fm = None
for k, a in enumerate(fr):
    if ROLE[k] == 'x': continue
    o, m = pix(a); ny, nx = m.shape
    cv = np.zeros((ny + 2 * PAD, nx + 2 * PAD, 4), int)
    cv[PAD:PAD + ny, PAD:PAD + nx, :3] = o.round(); cv[PAD:PAD + ny, PAD:PAD + nx, 3] = m * 255
    c = sorted(fists(o, m), key=lambda t: -t[2])[:2]
    hint = math.radians(HINT[k])
    if os.environ.get('ONEFIST') and c:
        if 'hold_ref' not in dir() or hold_ref is None: hold_ref = min(c, key=lambda t: t[0][1])[0]
        keep = min(c, key=lambda t: np.linalg.norm(t[0] - hold_ref)); hold_ref = keep[0]
        thrower = [t for t in c if t is not keep]
        c = [keep] + thrower; c_one = True
    else: c_one = False
    if len(c) == 2 and not c_one and np.linalg.norm(c[0][0] - c[1][0]) >= 6:
        best = None
        for up, lo in ((c[0], c[1]), (c[1], c[0])):
            th = math.atan2(*(lo[0] - up[0])[::-1]) - GA
            d = abs((th - hint + math.pi) % (2 * math.pi) - math.pi)
            if best is None or d < best[0]: best = (d, th, up[0] + PAD, lo[0] + PAD)
        _, th, fu, fl = best
        if best[0] > math.radians(70) or os.environ.get('FIXED'): th = hint      # fist line disagrees badly with the move: trust the hint
        fm = (fu + fl) / 2
    elif c:
        th = hint; fm = c[0][0] + PAD
    else:
        th = hint; fm = prev_fm
    yb, xb = np.nonzero(m); feet = np.array([np.median(xb[yb >= yb.max() - 3]), yb.max()]) + PAD
    TH = [float(x) for x in os.environ.get('THROW', '').split(',')] if os.environ.get('THROW') else None
    tp = TH[k] if TH else -1
    if ROLE[k] == 'd':
        best = None
        for t_ in (-GA, math.pi - GA):               # shaft flat on the ground, two ways round
            f_ = feet + np.array([14, 0])
            sc_ = place(f_, f_, t_, *cv.shape[:2], lantern=False); ys_ = np.nonzero(sc_[..., 3] > 0)[0]
            bl = blade_pts(f_, t_)[:, 1].mean()
            if best is None or bl < best[0]: best = (bl, t_, ys_.max())
        th = best[1]; fm = feet + np.array([14, 0]) + np.array([0, feet[1] - best[2]])
    if os.environ.get('OVR'): th += math.radians(float(os.environ['OVR'].split(',')[k]))
    if ROLE[k] != 'd':
        for dt in [0] + [d * sg for d in range(5, 95, 5) for sg in (1, -1)]:
            t2 = th + math.radians(dt)
            if blade_pts(fm, t2)[:, 1].max() <= feet[1] + 2: th = t2; break
    sl = SLIDE[k] if SLIDE else 0.0
    sc = place(fm, fm, th, *cv.shape[:2], Sa=(S_NOBLADE if ROLE[k] == 'S' else S), lantern=(tp < 0) and ROLE[k] != 'd', slide=sl)
    res = cv.copy()
    if tp >= 0 and LAN is not None:
        # lantern thrown: starts at the rear (non-scythe) hand, flies forward; chain from the pole end
        hand = (c[-1][0] + PAD) if len(c) else fm
        lp = hand + np.array([60 * tp, -6 * math.sin(tp * math.pi)])
        cpos = fm + np.array([math.cos(th) * (G2 - GM)[0] - math.sin(th) * (G2 - GM)[1], math.sin(th) * (G2 - GM)[0] + math.cos(th) * (G2 - GM)[1]]) * 2.2
        n = int(np.linalg.norm(lp - cpos)) + 2
        for i in range(n):
            q = cpos + (lp - cpos) * i / n; q[1] += 3 * math.sin(math.pi * i / n) * (1 - tp)
            xi, yi = int(round(q[0])), int(round(q[1]))
            if 0 <= yi < res.shape[0] - 1 and 0 <= xi < res.shape[1] and res[yi, xi, 3] == 0:
                res[yi, xi] = (92, 92, 100, 255) if (i // 2) % 2 == 0 else (40, 40, 46, 255)
        ly, lx = np.nonzero(LAN[..., 3] > 0)
        ty = np.round(ly - LAN_AT[1] + lp[1]).astype(int); tx = np.round(lx - LAN_AT[0] + lp[0]).astype(int)
        ok3 = (ty >= 0) & (ty < res.shape[0]) & (tx >= 0) & (tx < res.shape[1]); res[ty[ok3], tx[ok3]] = LAN[ly[ok3], lx[ok3]]
    # smear: area swept by the blade since the previous frame (swing frames only)
    if ROLE[k] == 'S' and prev_th is not None:      # one big crescent replaces the blade
        acc = np.zeros(cv.shape[:2], float); dth = (th - prev_th + math.pi) % (2 * math.pi) - math.pi
        for i in range(40):
            t = .15 + .85 * i / 39; p = blade_all_pts(prev_fm + (fm - prev_fm) * t, prev_th + dth * t, prev_sl + (sl - prev_sl) * t)
            xi = np.clip(np.round(p[:, 0]).astype(int), 0, cv.shape[1] - 1); yi = np.clip(np.round(p[:, 1]).astype(int), 0, cv.shape[0] - 1)
            acc[yi, xi] = np.maximum(acc[yi, xi], t)
        acc = ndimage.grey_closing(acc, size=(3, 3)); sm = acc > 0
        band = np.where(acc > .8, 250, np.where(acc > .5, 200, 135))
        col = np.stack([band, band, band + 10], -1).clip(0, 255)
        res[sm, :3] = col[sm]; res[sm, 3] = 255
    if ROLE[k] in ('s', 'f') and prev_th is not None:
        steps = 36; acc = np.zeros(cv.shape[:2], float)
        dth = (th - prev_th + math.pi) % (2 * math.pi) - math.pi
        for i in range(steps):
            t = i / steps; p = blade_pts(prev_fm + (fm - prev_fm) * t, prev_th + dth * t)
            xi = np.clip(np.round(p[:, 0]).astype(int), 0, cv.shape[1] - 1); yi = np.clip(np.round(p[:, 1]).astype(int), 0, cv.shape[0] - 1)
            if t < .3: continue                      # trail only the last part of the arc
            acc[yi, xi] = np.maximum(acc[yi, xi], t)
        acc = ndimage.grey_closing(acc, size=(3, 3))
        sm = acc > 0
        # 3-step banded gradient: dark grey tail -> light -> white near the blade
        band = np.where(acc > .75, 245, np.where(acc > .5, 190, 120))
        col = np.stack([band, band, band + 12], -1).clip(0, 255)
        if ROLE[k] == 'f': col = col * .8
        put = sm & (res[..., 3] == 0)
        res[put, :3] = col[put]; res[put, 3] = 255
    smk = sc[..., 3] > 0
    if ROLE[k] == 'd' or os.environ.get('BEHIND'): smk &= cv[..., 3] == 0
    res[smk] = sc[smk]
    for t in (c if ROLE[k] != 'd' else []):
        ff = np.zeros(cv.shape[:2], bool); ff[PAD:PAD + ny, PAD:PAD + nx] = ndimage.binary_dilation(t[1], K8)
        ff &= cv[..., 3] > 0; res[ff] = cv[ff]
    yb, xb = np.nonzero(m)
    hm = np.zeros(cv.shape[:2], bool)
    for t in (c if ROLE[k] != 'd' else []):
        hm[PAD:PAD + ny, PAD:PAD + nx] |= ndimage.binary_dilation(t[1], K8)
    hm &= cv[..., 3] > 0
    frames.append({'img': res, 'body': cv.copy(), 'hands': hm, 'grip': [float(fm[0]), float(fm[1])], 'th': th, 'slide': sl,
                   'role': ROLE[k], 'angle': math.degrees(th), 'fists': len(c),
                   'feet': [float(np.median(xb[yb >= yb.max() - 3])) + PAD, float(yb.max()) + PAD]})
    prev_th, prev_fm, prev_sl = th, fm, sl
os.makedirs(out, exist_ok=True)
DUR = {'S': 45, 'r': 120, 'a': 220, 's': 50, 'f': 280, 'h': 120, 'l': 140, 'n': 80, 'j': 100, 'd': 150, 'T': 70}
meta = []
for i, f in enumerate(frames):
    Image.fromarray(f['img'].astype(np.uint8)).save(os.path.join(out, 'frame_%03d.png' % i))
    Image.fromarray(f['body'].astype(np.uint8)).save(os.path.join(out, 'body_%03d.png' % i))
    Image.fromarray((f['hands'] * 255).astype(np.uint8)).save(os.path.join(out, 'hands_%03d.png' % i))
    meta.append({k: v for k, v in f.items() if k not in ('img', 'body', 'hands')} | {'ms': DUR[f['role']]})
json.dump({'cell': cell, 'frames': meta}, open(os.path.join(out, 'meta.json'), 'w'), indent=1)
print('cell', round(cell, 2), [(m['role'], round(m['angle']), m['fists']) for m in meta])
