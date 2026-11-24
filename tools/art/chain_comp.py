"""Body-only GIF -> pixel frames on the master grid + rigid sickle in the front fist,
code-drawn chain to the back fist and a hanging lantern.
usage: chain_comp.py <body.png> <sickle.png> <lantern.png> <rig.json> <in.gif> <out_dir> <angles>"""
import sys, os, json, math
import numpy as np
from PIL import Image, ImageSequence
from scipy import ndimage
body_p, sk_p, ln_p, rig_p, gif, out, angs = sys.argv[1:8]
ANG = [float(x) for x in angs.split(',')]
K8 = np.ones((3, 3), bool)
B = np.array(Image.open(body_p)).astype(int); r = np.nonzero(B[..., 3].any(1))[0]; BODY_H = r[-1] - r[0] + 1
SK = np.array(Image.open(sk_p)).astype(int); LN = np.array(Image.open(ln_p)).astype(int)
rig = json.load(open(rig_p)); G = np.array(rig['grip']); BK0 = np.array(rig['back'])
LA = np.array(rig['lantern_attach']); DROP = rig['lantern_drop']
CHAIN_L = np.linalg.norm(G - BK0) * 1.15
fr = [np.asarray(f.convert('RGB')).astype(float) for f in ImageSequence.Iterator(Image.open(gif))]
H, W, _ = fr[0].shape
bg = np.median(np.concatenate([fr[0][0], fr[0][-1], fr[0][:, 0], fr[0][:, -1]]), axis=0)
def mask(a): return np.abs(a - bg).sum(2) > 40
hs = [ (lambda rr: rr[-1] - rr[0] + 1)(np.nonzero(mask(a).sum(1) >= 3)[0]) for a in fr]
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
def skin_blobs(o, m):
    rb = o[..., 0] - o[..., 2]; L = .3 * o[..., 0] + .59 * o[..., 1] + .11 * o[..., 2]
    sk = m & (rb > 15) & (L > 150)
    ys = np.nonzero(m.any(1))[0]; top, bh = ys[0], ys[-1] - ys[0]
    lab, n = ndimage.label(ndimage.binary_dilation(sk, K8) & m, K8); c = []
    for i in range(1, n + 1):
        reg = (lab == i) & sk
        yy, xx = np.nonzero(reg)
        if len(yy) >= 4: c.append((np.array([xx.mean(), yy.mean()]), reg, len(yy)))
    up = [t for t in c if top + bh * .14 < t[0][1] < top + bh * .38]
    if up:
        hx = np.nonzero(m[top:top + int(bh * .25)].any(0))[0].mean()
        face = min(up, key=lambda t: abs(t[0][0] - hx) - t[2] * .05); c = [t for t in c if t is not face]
    # front fist: rightmost; back fist: rightmost of the rest at hip height
    c = [t for t in c if t[0][1] < top + bh * .85]
    if not c: return []
    high = [t for t in c if t[0][1] < top + bh * .14]
    f = max(high, key=lambda t: t[2]) if high else max(c, key=lambda t: t[0][0])
    band = [t for t in c if t is not f and top + bh * .38 < t[0][1] < top + bh * .66 and (high or t[0][0] < f[0][0] - 2)]
    if not band: return [f]
    b = max(band, key=lambda t: t[0][0])
    return [f, b]
def chain_pts(p0, p1, L):
    d = np.linalg.norm(p1 - p0); sag = math.sqrt(max(0, L * L - d * d)) * .5
    n = max(2, int(max(d, L)))
    t = np.linspace(0, 1, n)[:, None]
    pts = p0 + (p1 - p0) * t; pts[:, 1] += sag * 4 * t[:, 0] * (1 - t[:, 0])
    return pts
def draw_chain(img, pts):
    for i, (x, y) in enumerate(pts):
        xi, yi = int(round(x)), int(round(y))
        if 0 <= yi < img.shape[0] - 1 and 0 <= xi < img.shape[1]:
            img[yi, xi] = (92, 92, 100, 255) if (i // 2) % 2 == 0 else (40, 40, 46, 255)
            if img[yi + 1, xi, 3] == 0: img[yi + 1, xi] = (14, 14, 16, 255)
def rotated(S, pivot, at, th, H_, W_):
    o = np.zeros((H_, W_, 4), int); c, s = math.cos(th), math.sin(th)
    yy, xx = np.mgrid[:H_, :W_]; dx, dy = xx - at[0], yy - at[1]
    sx = np.round(c * dx + s * dy + pivot[0]).astype(int); sy = np.round(-s * dx + c * dy + pivot[1]).astype(int)
    ok = (sx >= 0) & (sx < S.shape[1]) & (sy >= 0) & (sy < S.shape[0]); o[ok] = S[sy[ok], sx[ok]]; return o
os.makedirs(out, exist_ok=True)
PAD = 50; front = back = None; meta = []
for k, a in enumerate(fr):
    o, m = pix(a); ny, nx = m.shape
    cv = np.zeros((ny + 2 * PAD, nx + 2 * PAD, 4), int)
    cv[PAD:PAD + ny, PAD:PAD + nx, :3] = o.round(); cv[PAD:PAD + ny, PAD:PAD + nx, 3] = m * 255
    bl = skin_blobs(o, m)
    if len(bl) == 2:
        f, b = bl
        front, back = f[0] + PAD, b[0] + PAD; fmask = [f[1], b[1]]
    elif len(bl) == 1 and front is not None:
        front = bl[0][0] + PAD; fmask = [bl[0][1]]
    else: fmask = []
    res = cv.copy()
    # chain (behind), lantern
    th = math.radians(ANG[k])
    draw_chain(res, chain_pts(front, back, CHAIN_L))
    hang = chain_pts(back, back + np.array([1.5, DROP]), DROP); draw_chain(res, hang)
    lp = back + np.array([1.5, DROP])
    ly, lx = np.nonzero(LN[..., 3] > 0)
    ty = np.round(ly - LA[1] + lp[1]).astype(int); tx = np.round(lx - LA[0] + lp[0]).astype(int)
    ok = (ty >= 0) & (ty < res.shape[0]) & (tx >= 0) & (tx < res.shape[1]); res[ty[ok], tx[ok]] = LN[ly[ok], lx[ok]]
    sk = rotated(SK, G, front, th, *res.shape[:2]); sm = sk[..., 3] > 0; res[sm] = sk[sm]
    for f in fmask:
        ff = np.zeros(cv.shape[:2], bool); ff[PAD:PAD + ny, PAD:PAD + nx] = ndimage.binary_dilation(f, K8)
        ff &= cv[..., 3] > 0; res[ff] = cv[ff]
    yb, xb = np.nonzero(m)
    meta.append({'frame': k, 'front': front.tolist(), 'back': back.tolist(), 'angle': ANG[k],
                 'feet': [float(np.median(xb[yb >= yb.max() - 3])) + PAD, float(yb.max()) + PAD]})
    Image.fromarray(res.astype(np.uint8)).save(os.path.join(out, 'frame_%03d.png' % k))
json.dump({'cell': cell, 'frames': meta}, open(os.path.join(out, 'meta.json'), 'w'), indent=1)
print('cell', round(cell, 2), 'frames', len(fr))
