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
bg = np.median(np.concatenate([fr[0][0], fr[0][-1], fr[0][:, 0], fr[0][:, -1]]), axis=0)
def mask(a): return np.abs(a - bg).sum(2) > 40
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
        face = min(face_c, key=lambda t: abs(t[0][0] - hx) - t[2] * .05); c = [t for t in c if t is not face]
    # thighs: wide skin between skirt and stockings, near the body's middle column, lower half
    midx = np.median(np.nonzero(m[top + int(bh * .5):top + int(bh * .7)])[1]) if bh > 0 else 0
    c = [t for t in c if not (top + bh * .55 < t[0][1] < top + bh * .8 and abs(t[0][0] - midx) < bh * .12)]
    return c
def place(F_up, F_lo, th, H_, W_, Sa=S):
    fm = (F_up + F_lo) / 2; out = np.zeros((H_, W_, 4), int); c, s = math.cos(th), math.sin(th)
    yy, xx = np.mgrid[:H_, :W_]; dx, dy = xx - fm[0], yy - fm[1]
    sx = np.round(c * dx + s * dy + GM[0]).astype(int); sy = np.round(-s * dx + c * dy + GM[1]).astype(int)
    ok = (sx >= 0) & (sx < Sa.shape[1]) & (sy >= 0) & (sy < Sa.shape[0]); out[ok] = Sa[sy[ok], sx[ok]]
    if LAN is not None:
        ax, ay = LAN_AT - GM; px = fm[0] + c * ax - s * ay; py = fm[1] + s * ax + c * ay
        ly, lx = np.nonzero(LAN[..., 3] > 0)
        ty = np.round(ly - LAN_AT[1] + py).astype(int); tx = np.round(lx - LAN_AT[0] + px).astype(int)
        ok2 = (ty >= 0) & (ty < H_) & (tx >= 0) & (tx < W_); out[ty[ok2], tx[ok2]] = LAN[ly[ok2], lx[ok2]]
    return out
# blade mask in sprite space: the bright/blade part = rows above the grip, far from the pole line
yy, xx = np.mgrid[:S.shape[0], :S.shape[1]]
_L = .3 * S[..., 0] + .59 * S[..., 1] + .11 * S[..., 2]
BLADE = (S[..., 3] > 0) & (yy < G1[1] - 18) & (_L > 120)      # the bright cutting edge only
def blade_pts(fm, th):
    ys, xs = np.nonzero(BLADE); c, s = math.cos(th), math.sin(th)
    dx, dy = xs - GM[0], ys - GM[1]
    return np.stack([fm[0] + c * dx - s * dy, fm[1] + s * dx + c * dy], 1)
PAD = 70; frames = []; prev_th = None; prev_fm = None
for k, a in enumerate(fr):
    if ROLE[k] == 'x': continue
    o, m = pix(a); ny, nx = m.shape
    cv = np.zeros((ny + 2 * PAD, nx + 2 * PAD, 4), int)
    cv[PAD:PAD + ny, PAD:PAD + nx, :3] = o.round(); cv[PAD:PAD + ny, PAD:PAD + nx, 3] = m * 255
    c = sorted(fists(o, m), key=lambda t: -t[2])[:2]
    hint = math.radians(HINT[k])
    if len(c) == 2 and np.linalg.norm(c[0][0] - c[1][0]) >= 6:
        best = None
        for up, lo in ((c[0], c[1]), (c[1], c[0])):
            th = math.atan2(*(lo[0] - up[0])[::-1]) - GA
            d = abs((th - hint + math.pi) % (2 * math.pi) - math.pi)
            if best is None or d < best[0]: best = (d, th, up[0] + PAD, lo[0] + PAD)
        _, th, fu, fl = best
        if best[0] > math.radians(70): th = hint      # fist line disagrees badly with the move: trust the hint
        fm = (fu + fl) / 2
    elif c:
        th = hint; fm = c[0][0] + PAD
    else:
        th = hint; fm = prev_fm
    sc = place(fm, fm, th, *cv.shape[:2])
    res = cv.copy()
    # smear: area swept by the blade since the previous frame (swing frames only)
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
    smk = sc[..., 3] > 0; res[smk] = sc[smk]
    for t in c:
        ff = np.zeros(cv.shape[:2], bool); ff[PAD:PAD + ny, PAD:PAD + nx] = ndimage.binary_dilation(t[1], K8)
        ff &= cv[..., 3] > 0; res[ff] = cv[ff]
    yb, xb = np.nonzero(m)
    frames.append({'img': res, 'role': ROLE[k], 'angle': math.degrees(th), 'fists': len(c),
                   'feet': [float(np.median(xb[yb >= yb.max() - 3])) + PAD, float(yb.max()) + PAD]})
    prev_th, prev_fm = th, fm
os.makedirs(out, exist_ok=True)
DUR = {'r': 120, 'a': 220, 's': 50, 'f': 280, 'h': 120}
meta = []
for i, f in enumerate(frames):
    Image.fromarray(f['img'].astype(np.uint8)).save(os.path.join(out, 'frame_%03d.png' % i))
    meta.append({k: v for k, v in f.items() if k != 'img'} | {'ms': DUR[f['role']]})
json.dump({'cell': cell, 'frames': meta}, open(os.path.join(out, 'meta.json'), 'w'), indent=1)
print('cell', round(cell, 2), [(m['role'], round(m['angle']), m['fists']) for m in meta])
