"""Body-only GIF -> pixel frames on the master grid + rigid scythe through both fists.
usage: scythe_comp.py <body.png> <scythe.png> <grip json> <in.gif> <out_dir> [blade=up|fwd|down]"""
import sys, os, json, math, collections
import numpy as np
from PIL import Image, ImageSequence
from scipy import ndimage
body_p, sc_p, grip_s, gif, out = sys.argv[1:6]
pref = sys.argv[6] if len(sys.argv) > 6 else 'up'
ANG = [float(x) for x in sys.argv[7].split(',')] if len(sys.argv) > 7 else None
K8 = np.ones((3, 3), bool)
LAN = None
if os.environ.get('LANTERN'):
    lp, lj = os.environ['LANTERN'].split(',')
    LAN = np.array(Image.open(lp)).astype(int); LAN_AT = np.array(json.load(open(lj))['attach'], float)
B = np.array(Image.open(body_p)).astype(int); bh = np.nonzero(B[..., 3].any(1))[0]; BODY_H = bh[-1] - bh[0] + 1
S = np.array(Image.open(sc_p)).astype(int)
g = json.loads(grip_s); G1 = np.array(g['upper'], float); G2 = np.array(g['lower'], float)

fr = [np.asarray(f.convert('RGB')).astype(float) for f in ImageSequence.Iterator(Image.open(gif))]
H, W, _ = fr[0].shape
bd = np.concatenate([fr[0][0], fr[0][-1], fr[0][:, 0], fr[0][:, -1]])
bg = np.median(bd, axis=0)
def mask(a): return np.abs(a - bg).sum(2) > 40
hs = []
for a in fr:
    r = np.nonzero(mask(a).sum(1) >= 3)[0]; hs.append(r[-1] - r[0] + 1)
cell = np.percentile(hs, 75) / BODY_H
def pix(a):
    ny, nx = int(H / cell), int(W / cell)
    o = np.zeros((ny, nx, 3)); m = np.zeros((ny, nx), bool)
    mk = mask(a)
    for j in range(ny):
        for i in range(nx):
            y0, x0 = j * cell, i * cell
            sl = (slice(int(y0 + cell * .25), int(y0 + cell * .75) + 1), slice(int(x0 + cell * .25), int(x0 + cell * .75) + 1))
            mm = mk[sl]
            if mm.mean() >= .5:
                o[j, i] = np.median(a[sl][mm], axis=0); m[j, i] = True
    # drop specks, fill tiny holes
    lab, n = ndimage.label(m, K8)
    if n:
        sz = ndimage.sum(m, lab, range(1, n + 1)); keep = np.zeros(n + 1, bool); keep[1:] = sz >= 20; m &= keep[lab]
    return o, m
def fists(o, m):
    rb = o[..., 0] - o[..., 2]; L = .3 * o[..., 0] + .59 * o[..., 1] + .11 * o[..., 2]
    skin = m & (rb > 15) & (L > 150)
    ys = np.nonzero(m.any(1))[0]; top = ys[0]; bh = ys[-1] - ys[0]
    lab, n = ndimage.label(skin, K8); c = []
    for i in range(1, n + 1):
        yy, xx = np.nonzero(lab == i)
        if len(yy) < 4: continue
        cy, cx = yy.mean(), xx.mean()
        # face: upper part of the body, near the hair; fists sit at the edge of the body mass
        c.append((len(yy), cy, cx, i))
    # face = skin blob nearest the head centre (top 40%) with most pixels
    xs_head = np.nonzero(m[top:top + int(bh * .3)].any(0))[0]; hx = xs_head.mean() if len(xs_head) else 0
    face = None
    cand = [t for t in c if t[1] < top + bh * .42 and abs(t[2] - hx) < bh * .18]
    if cand: face = max(cand, key=lambda t: t[0])
    rest = sorted([t for t in c if t is not face], key=lambda t: -t[0])[:2]
    return [np.array([t[2], t[1]]) for t in rest], [lab == t[3] for t in rest]
def place(Sa, F_up, F_lo, H_, W_, th=None):
    # rotation+translation (no scale) mapping G1->F_up, G2->F_lo (best fit on the axis)
    if th is None:
        ga = math.atan2(*(G2 - G1)[::-1]); fa = math.atan2(*(F_lo - F_up)[::-1]); th = fa - ga
    gm = (G1 + G2) / 2; fm = (F_up + F_lo) / 2
    out = np.zeros((H_, W_, 4), int)
    c, s = math.cos(th), math.sin(th)
    yy, xx = np.mgrid[:H_, :W_]
    # inverse map: dest -> source
    dx, dy = xx - fm[0], yy - fm[1]
    sx = c * dx + s * dy + gm[0]; sy = -s * dx + c * dy + gm[1]
    sxi, syi = np.round(sx).astype(int), np.round(sy).astype(int)
    ok = (sxi >= 0) & (sxi < Sa.shape[1]) & (syi >= 0) & (syi < Sa.shape[0])
    out[ok] = Sa[syi[ok], sxi[ok]]
    if LAN is not None:
        # hang the lantern straight down from the rotated attach point
        ax, ay = LAN_AT - gm
        px = fm[0] + c * ax - s * ay; py = fm[1] + s * ax + c * ay
        ly, lx = np.nonzero(LAN[..., 3] > 0)
        ty = np.round(ly - LAN_AT[1] + py).astype(int); tx = np.round(lx - LAN_AT[0] + px).astype(int)
        ok2 = (ty >= 0) & (ty < H_) & (tx >= 0) & (tx < W_)
        out[ty[ok2], tx[ok2]] = LAN[ly[ok2], lx[ok2]]
    return out, th
os.makedirs(out, exist_ok=True)
prev = None; meta = []
PAD = 60
for k, a in enumerate(fr):
    o, m = pix(a)
    ny, nx = m.shape
    cv = np.zeros((ny + 2 * PAD, nx + 2 * PAD, 4), int)
    cv[PAD:PAD + ny, PAD:PAD + nx, :3] = o.round(); cv[PAD:PAD + ny, PAD:PAD + nx, 3] = m * 255
    fs, fm = fists(o, m)
    if ANG is not None:
        if len(fs) == 2: mid = (fs[0] + fs[1]) / 2 + PAD
        elif len(fs) == 1: mid = fs[0] + PAD
        mid = mid if prev is None or 'pm' not in dir() else mid
        pm = mid
        sc, _ = place(S, mid, mid, *cv.shape[:2], th=math.radians(ANG[k])); prev = ANG[k]
        best = (0, sc, prev, mid, mid)
    elif len(fs) == 2 and np.linalg.norm(fs[0] - fs[1]) >= 3:
        A, Bp = fs[0] + PAD, fs[1] + PAD
        best = None
        for up, lo in ((A, Bp), (Bp, A)):
            sc, th = place(S, up, lo, *cv.shape[:2])
            # blade head = transformed top of scythe sprite (row 0..20)
            hy, hx = np.nonzero(sc[..., 3] > 0)
            head = np.array([hx[hy < np.percentile(hy, 100)].mean(), 0])
            th_d = math.degrees(th)
            score = 0
            if prev is not None: score = -abs((th_d - prev + 180) % 360 - 180)
            else:
                # first frame: blade towards preference: compare where the blade tip mass lies
                bm = (sc[..., 3] > 0); yy, xx = np.nonzero(bm)
                cy = yy.mean(); score = -cy if pref == 'up' else (cy if pref == 'down' else xx.mean())
            if best is None or score > best[0]: best = (score, sc, th_d, up, lo)
        _, sc, prev, up, lo = best
    else:
        sc = place(S, *last_ul, *cv.shape[:2])[0] if prev is not None else np.zeros_like(cv)
    if len(fs) == 2 and ANG is None: last_ul = (best[3], best[4])
    # layer: body, scythe over, fists on top
    res = cv.copy()
    sm = sc[..., 3] > 0; res[sm] = sc[sm]
    for f in fm:
        ff = np.zeros(cv.shape[:2], bool); ff[PAD:PAD + ny, PAD:PAD + nx] = ndimage.binary_dilation(f, K8)
        ff &= cv[..., 3] > 0; res[ff] = cv[ff]
    Image.fromarray(res.astype(np.uint8)).save(os.path.join(out, 'frame_%03d.png' % k))
    yb, xb = np.nonzero(m)
    meta.append({'frame': k, 'fists': [f.tolist() for f in fs], 'angle': prev,
                 'feet': [float(np.median(xb[yb >= yb.max() - 3])) + PAD, float(yb.max()) + PAD]})
json.dump({'cell': cell, 'frames': meta}, open(os.path.join(out, 'meta.json'), 'w'), indent=1)
print('cell', round(cell, 2), 'frames', len(fr), [round(x['angle'] or 0) for x in meta])
