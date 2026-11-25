"""Dodge roll from the crouch body: scythe tucked along the back, whole figure rotated (RotSprite) in a forward roll.
usage: roll_comp.py <build dir> (uses <dir>/jump frame 0/7 + body_000) -> <dir>/roll"""
import sys, os, json, math
import numpy as np
from PIL import Image
D = sys.argv[1]
sys.argv = ['reap_comp', 'body-v12.png', 'scythe-v12-nolan.png', '{"upper":[76.9,68.3],"lower":[72.7,84.4]}',
            'v15/raw/idle.gif', '/tmp/_x', ','.join(['0'] * 64), ','.join(['r'] * 64)]
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reap_comp.py')).read().split('PAD = 70')[0]
exec(src)
OUTD = f'{D}/roll'; os.makedirs(OUTD, exist_ok=True)
jm = json.load(open(f'{D}/jump/meta.json'))['frames']
arr = lambda p: np.array(Image.open(p).convert('RGBA')).astype(int)
body = arr(f'{D}/jump/body_000.png'); H_, W_ = body.shape[:2]
g0 = np.array(jm[0]['grip']); feet0 = np.array(jm[0]['feet'])
tuck = math.radians(-105)                                              # 낫을 등에 붙여 뒤로 눕힘
sc = place(g0, g0, tuck, H_, W_); bm, fl = masks(g0, tuck, H_, W_)
comp = sc.copy(); bmask = bm.copy()
over = body[..., 3] > 0; comp[over] = body[over]; bmask &= ~over      # 몸이 앞, 낫은 뒤
al = comp[..., 3] > 0; ys, xs = np.nonzero(al); cy, cx = ys.mean(), xs.mean()
U = _scale2x(_scale2x(_scale2x(comp.astype(np.int64)))); MU = _scale2x(_scale2x(_scale2x(np.stack([bmask * 255] * 4, -1).astype(np.int64))))
def rot(deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    yy, xx = np.mgrid[:H_, :W_]; dx, dy = xx - cx, yy - cy
    sx = c * dx + s * dy + cx + .5; sy = -s * dx + c * dy + cy + .5
    ux, uy = np.floor(sx * 8).astype(int), np.floor(sy * 8).astype(int)
    ok = (ux >= 0) & (ux < U.shape[1]) & (uy >= 0) & (uy < U.shape[0])
    o = np.zeros_like(comp); m = np.zeros(comp.shape[:2], bool); o[ok] = U[uy[ok], ux[ok]]; m[ok] = MU[uy[ok], ux[ok], 0] > 0
    return o, m
pole0 = np.array(pole_pt(g0, tuck)); pin0 = np.array(pole_pt(g0, tuck, 0, 10))
meta = []
def save(i, img, m, feet, ms, pole=None, pin=None):
    Image.fromarray(img.astype(np.uint8)).save(f'{OUTD}/frame_{i:03d}.png')
    mk = np.zeros(img.shape[:2] + (3,), np.uint8); mk[..., 0] = m * 255; Image.fromarray(mk).save(f'{OUTD}/mask_{i:03d}.png')
    meta.append({'feet': [float(feet[0]), float(feet[1])], 'ms': ms, 'pole': pole, 'pin': pin})
def copy_from(k, i):
    im = arr(f'{D}/jump/frame_{k:03d}.png'); mk = np.array(Image.open(f'{D}/jump/mask_{k:03d}.png').convert('RGB'))[..., 0] > 0
    save(i, im, mk, jm[k]['feet'], 60, jm[k].get('pole'), jm[k].get('pin'))
copy_from(0, 0)                                                        # 웅크림
for i, deg in enumerate([60, 120, 180, 240, 300]):                     # 앞구르기: 몸 전체가 굴러감
    o, m = rot(deg); ys_, xs_ = np.nonzero(o[..., 3] > 0)
    shift = int(round(feet0[1] - ys_.max()))                            # 굴러가는 몸의 아랫면이 땅에 닿게
    o = np.roll(o, shift, 0); m = np.roll(m, shift, 0)
    a_ = math.radians(deg); c_, s_ = math.cos(a_), math.sin(a_); q = pole0 - np.array([cx, cy])
    q2 = pin0 - np.array([cx, cy])
    save(i + 1, o, m, feet0, 45, [float(cx + c_ * q[0] - s_ * q[1]), float(cy + s_ * q[0] + c_ * q[1] + shift)], [float(cx + c_ * q2[0] - s_ * q2[1]), float(cy + s_ * q2[0] + c_ * q2[1] + shift)])
copy_from(7, 6); copy_from(7, 7)                                       # 착지 웅크림 → 일어섬
json.dump({'frames': meta}, open(f'{OUTD}/meta.json', 'w'))
print('roll frames', len(meta))
