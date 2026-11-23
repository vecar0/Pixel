# 리라 합성: 몸 동작(무기 없음) + 딱딱한 낫(손에 붙여 회전) + 코드 사슬·등불 + 베기 궤적
# usage: python3 tools/art/compose_lira.py [anim ...]   → art/lira2/comp/<anim>-<i>.png, art/lira2/comp/<anim>.gif
import sys, os, math, glob, json
import numpy as np
from PIL import Image
from scipy.ndimage import label

R = os.path.join(os.path.dirname(__file__), '../../art/lira2/')
OUT = R + 'comp/'; os.makedirs(OUT, exist_ok=True)
SCY = Image.open(R + 'scythe.png').convert('RGBA')
MASTER = Image.open(R + 'master-final.png').convert('RGBA')
LAN = MASTER.crop((76, 89, 89, 102))            # 원본 등불 그림
STAFF_TOP, STAFF_BOT = (69, 30), (54, 95)       # 낫 그림 안 자루 위·아래 끝
S_ANG = math.degrees(math.atan2(STAFF_TOP[1] - STAFF_BOT[1], STAFF_TOP[0] - STAFF_BOT[0]))   # 그림 속 자루 방향(아래→위)
_sa = np.asarray(SCY); _ys, _xs = np.where(_sa[..., 3] > 0)
_k = np.argmin(_xs); TIP = (int(_xs[_k]), int(_ys[_k]))        # 낫날 끝 (가장 왼쪽 픽셀)
INK, CH1, CH2 = (14, 12, 16, 255), (58, 56, 64, 255), (140, 138, 150, 255)

# 동작별 낫 안무: ang = 자루 방향(손→날 쪽, 화면 각도, 0=앞 -90=위), grip = 자루를 쥔 위치(0=날 쪽 끝 1=아랫끝)
#   lan = 등불 상태: 'hang' 허리에 매달림 · ('throw',k) 던져 나감 · ('orbit',k) 머리 위 회전 · ('whip',k) 채찍처럼 뻗음
#   trail = 베기 궤적을 그릴 프레임
CHOREO = {
  'idle':    dict(ang=[-80, -81, -82, -81, -80, -79, -78, -79], grip=0.38, trail=[]),
  'run':     dict(ang=[-150] * 8, grip=0.45, trail=[]),
  'sweep':   dict(ang=[-150, -165, -120, -50, 5, 40, 0, -75], grip=0.6, trail=[3, 4, 5]),
  'rise':    dict(ang=[165, 170, 120, 30, -60, -100, -95, -80], grip=0.55, trail=[3, 4, 5]),
  'spin':    dict(ang=[-90, -50, -10, 30, 70, 110, 150, 195, 250, 0], grip=0.6, trail=[2, 3, 4, 5, 6, 7, 8]),
  'hook':    dict(ang=[-60, -30, -12, -8, -40, -65, -78, -80], grip=0.7, trail=[1, 2, 4]),
  'reap':    dict(ang=[-105, -115, -120, -40, 35, 60, 70, 70], grip=0.55, trail=[3, 4, 5]),
  'throw':   dict(ang=[-80] * 8, grip=0.38, lan=[('hang', 0)] * 3 + [('throw', k / 4) for k in range(1, 5)] + [('throw', 1.0)], trail=[]),
  'recall':  dict(ang=[-80] * 8, grip=0.38, lan=[('throw', 1.0), ('throw', 1.0)] + [('throw', 1 - k / 5) for k in range(1, 5)] + [('hang', 0), ('hang', 0)], trail=[]),
  'whip':    dict(ang=[-80, -120, -140, -60, 10, 30, -30, -80], grip=0.5, lan=[('hang', 0)] * 2 + [('whip', k) for k in (0.2, 0.6, 1.0, 0.9, 0.5)] + [('hang', 0)], trail=[]),
  'pendulum':dict(ang=[-75] * 10, grip=0.4, lan=[('orbit', i / 10) for i in range(10)], trail=[]),
  'vault':   dict(ang=[90, 95, 100, 100, 95, 90, -80, -80], grip=0.3, trail=[]),
  'block':   dict(ang=[-60, -32, -25, -25, -25, -30], grip=0.5, trail=[]),
  'jump':    dict(ang=[-95, -100, -105, -105, -100, -95, -88, -80], grip=0.4, trail=[]),
  'hurt':    dict(ang=[-80, -100, -112, -95, -85, -80], grip=0.4, trail=[]),
  'death':   dict(ang=[-80, -70, -45, -10, 5, 8, 8, 8], grip=0.4, trail=[]),
  'execute': dict(ang=[160, 170, -100, -120, -120, 30, 60, 70, 70, -80], grip=0.55, trail=[5, 6]),
}

def hands(a):
    """주먹 위치: 피부색 덩어리 중 몸 중심에서 가장 먼 것 (얼굴·허벅지 제외)"""
    m = a[..., 3] > 0; r, g, b = [a[..., i].astype(int) for i in range(3)]
    skin = m & (r > 165) & (g > 115) & (b > 90) & (r - b > 20) & (r - b < 115)
    ys, xs = np.where(m); top, bot = ys.min(), ys.max(); H = bot - top + 1
    lab, n = label(skin); best = []
    cx = np.median(xs); cy = top + H * 0.4
    face = None
    for k in range(1, n + 1):
        py, px = np.where(lab == k)
        if len(px) < 3: continue
        mx, my = px.mean(), py.mean()
        if face is None and len(px) >= 12 and my < top + H * 0.35: face = (mx, my); continue   # 얼굴
        best.append((math.hypot(mx - cx, (my - cy) * 0.8), mx, my, len(px)))
    if not best: return (cx + 10, cy)
    best.sort(reverse=True); return (best[0][1], best[0][2])

def waist(a):
    m = a[..., 3] > 0; ys, xs = np.where(m); top, bot = ys.min(), ys.max()
    y = int(top + (bot - top) * 0.52); row = np.where(m[y])[0]
    return (float(np.median(row)), float(y))

def rot(img, ang_deg, piv, k=3):
    """픽셀 그림 회전: k배 키워 그림 가운데를 축으로 돌린 뒤(잘림 없이 넓힘) 다시 줄임. 돌린 그림과 그 안의 피벗 위치를 돌려줌"""
    big = img.resize((img.width * k, img.height * k), Image.NEAREST)
    rb = big.rotate(-ang_deg, resample=Image.NEAREST, expand=True)        # 시계 방향으로 ang
    cx, cy = big.width / 2, big.height / 2; nx, ny = rb.width / 2, rb.height / 2
    c, s = math.cos(math.radians(ang_deg)), math.sin(math.radians(ang_deg))
    dx, dy = piv[0] * k + k / 2 - cx, piv[1] * k + k / 2 - cy
    px, py = nx + dx * c - dy * s, ny + dx * s + dy * c
    small = rb.resize((max(1, rb.width // k), max(1, rb.height // k)), Image.NEAREST)
    return small, (px / k, py / k)

def rotp(p, piv, ang_deg):
    c, s = math.cos(math.radians(ang_deg)), math.sin(math.radians(ang_deg)); dx, dy = p[0] - piv[0], p[1] - piv[1]
    return (dx * c - dy * s, dx * s + dy * c)

def put(c, x, y, col):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < c.width and 0 <= y < c.height: c.putpixel((x, y), col)

def chain(c, p0, p1, phase=0):
    L = math.hypot(p1[0] - p0[0], p1[1] - p0[1]); n = max(1, int(L / 2)); ux, uy = (p1[0] - p0[0]) / (L or 1), (p1[1] - p0[1]) / (L or 1); nx, ny = -uy, ux
    for i in range(n + 1):
        x, y = p0[0] + (p1[0] - p0[0]) * i / n, p0[1] + (p1[1] - p0[1]) * i / n
        if (i + phase) % 2 == 0: put(c, x, y, CH2); put(c, x + ux, y + uy, CH1)
        else: put(c, x + nx * 0.7, y + ny * 0.7, INK); put(c, x - nx * 0.7, y - ny * 0.7, CH1)

def sag(c, p0, p1, droop, phase=0):   # 늘어진 사슬 (가운데가 처짐)
    pts = []; N = 8
    for i in range(N + 1):
        t = i / N; pts.append((p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t + droop * 4 * t * (1 - t)))
    for i in range(N): chain(c, pts[i], pts[i + 1], phase + i)

def compose(anim):
    fs = sorted(glob.glob(R + f'body/{anim}-*.png'), key=lambda p: int(p.rsplit('-', 1)[1][:-4]))
    C = CHOREO[anim]; frames = []; tips = []
    W, H = 320, 240; FOOT = (150, 200)
    for i, f in enumerate(fs):
        body = Image.open(f).convert('RGBA'); a = np.asarray(body)
        ys, xs = np.where(a[..., 3] > 0); bx = int(np.median(xs)); by = ys.max()
        ox, oy = FOOT[0] - bx, FOOT[1] - by
        hx, hy = hands(a); wx, wy = waist(a)
        ang = C['ang'][min(i, len(C['ang']) - 1)]; grip = C['grip']
        gp = (STAFF_TOP[0] + (STAFF_BOT[0] - STAFF_TOP[0]) * grip, STAFF_TOP[1] + (STAFF_BOT[1] - STAFF_TOP[1]) * grip)
        rang = ang - S_ANG                                  # 그림 속 자루 방향을 원하는 방향으로
        sp, piv = rot(SCY, rang, gp)
        c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        # 낫 위치
        sx, sy = ox + hx - piv[0], oy + hy - piv[1]
        butt = rotp(STAFF_BOT, gp, rang); butt = (ox + hx + butt[0], oy + hy + butt[1])
        tip = rotp(TIP, gp, rang); tip = (ox + hx + tip[0], oy + hy + tip[1]); tips.append(tip)
        # 베기 궤적 (낫날 끝이 지나간 호): 몸 뒤에 옅게
        if i in C.get('trail', []) and i > 0:
            t0 = tips[i - 1]; hand = (ox + hx, oy + hy)
            tr = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            a0_ = math.atan2(t0[1] - hand[1], t0[0] - hand[0]); a1_ = math.atan2(tip[1] - hand[1], tip[0] - hand[0]); dA = abs((a1_ - a0_ + math.pi) % (2 * math.pi) - math.pi)
            NS = max(12, int(dA * math.hypot(tip[0] - hand[0], tip[1] - hand[1]) * 1.5))
            for s in range(NS + 1):
                t = s / NS; a0 = math.atan2(t0[1] - hand[1], t0[0] - hand[0]); a1 = math.atan2(tip[1] - hand[1], tip[0] - hand[0])
                if a1 - a0 > math.pi: a1 -= 2 * math.pi
                if a0 - a1 > math.pi: a1 += 2 * math.pi
                aa = a0 + (a1 - a0) * t; rr = math.hypot(tip[0] - hand[0], tip[1] - hand[1])
                for d in range(0, 9): put(tr, hand[0] + math.cos(aa) * (rr - d), hand[1] + math.sin(aa) * (rr - d), (235, 235, 245, int(210 * (1 - d / 9) * (0.3 + 0.7 * t))))
            c.alpha_composite(tr)
        # 허리에 감긴 사슬 (뒤쪽 반)
        lan = (C.get('lan') or [('hang', 0)] * 99)[i]
        loops = 2.5 if lan[0] == 'hang' else max(0.0, 2.5 * (1 - lan[1])) if lan[0] == 'throw' else 0.6
        rx, ry = 9, 3; back = Image.new('RGBA', (W, H), (0, 0, 0, 0)); front = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        for L in range(int(math.ceil(loops))):
            frac = min(1, loops - L); yy = oy + wy + L * 3
            for j in range(int(40 * frac)):
                th = j / 40 * 2 * math.pi; x = ox + wx + rx * math.cos(th); y = yy + ry * math.sin(th)
                put(front if math.sin(th) > 0 else back, x, y, CH2 if j % 3 == 0 else CH1 if j % 3 == 1 else INK)
        c.alpha_composite(back)
        c.alpha_composite(body, (ox, oy))
        c.alpha_composite(sp, (int(round(sx)), int(round(sy))))
        # 주먹을 낫 위에 다시 그려 자루를 쥔 것처럼
        m = a[..., 3] > 0; r_, g_, b_ = [a[..., k].astype(int) for k in range(3)]
        skin = m & (r_ > 165) & (g_ > 115) & (b_ > 90) & (r_ - b_ > 20)
        for yy2 in range(max(0, int(hy) - 4), min(a.shape[0], int(hy) + 5)):
            for xx2 in range(max(0, int(hx) - 4), min(a.shape[1], int(hx) + 5)):
                if skin[yy2, xx2]: put(c, ox + xx2, oy + yy2, tuple(int(v) for v in a[yy2, xx2]))
        c.alpha_composite(front)
        # 사슬: 자루 끝 → 허리 감김 → 등불
        wrap0 = (ox + wx + rx, oy + wy)
        sag(c, butt, wrap0, 6, i)
        hang = (ox + wx + 4 + 2 * math.sin(i * 0.8), oy + wy + 16)
        if lan[0] == 'hang': lp = hang
        elif lan[0] == 'throw': k = lan[1]; lp = (hang[0] + 120 * k, hang[1] - 40 * math.sin(k * math.pi) - 6 * k)
        elif lan[0] == 'whip': k = lan[1]; lp = (butt[0] + 100 * k, butt[1] - 30 * math.sin(k * math.pi) + 10 * k)
        else: th = lan[1] * 2 * math.pi; lp = (ox + hx + 48 * math.cos(th), oy + hy - 20 + 18 * math.sin(th))
        last = (ox + wx - 2, oy + wy + max(0, math.ceil(loops) - 1) * 3 + ry)
        if lan[0] == 'hang': sag(c, last, (lp[0], lp[1] - 6), 2, i)
        else: chain(c, (wrap0 if loops < 0.5 else last), (lp[0], lp[1] - 6), i)
        c.alpha_composite(LAN, (int(lp[0]) - 6, int(lp[1]) - 7))
        frames.append(c)
    # 모든 프레임 공통 영역으로 잘라 저장
    bb = None
    for f in frames:
        b = f.getbbox()
        if b: bb = b if bb is None else (min(bb[0], b[0]), min(bb[1], b[1]), max(bb[2], b[2]), max(bb[3], b[3]))
    meta = []
    for i, f in enumerate(frames):
        f.crop(bb).save(OUT + f'{anim}-{i}.png')
        meta.append({'ax': FOOT[0] - bb[0], 'ay': FOOT[1] - bb[1]})
    bg = [Image.new('RGBA', (bb[2] - bb[0], bb[3] - bb[1]), (60, 58, 70, 255)) for _ in frames]
    for g_, f in zip(bg, frames): g_.alpha_composite(f.crop(bb))
    big = [g_.resize((g_.width * 3, g_.height * 3), Image.NEAREST) for g_ in bg]
    big[0].save(OUT + f'{anim}.gif', save_all=True, append_images=big[1:], duration=90, loop=0)
    return meta

if __name__ == '__main__':
    names = sys.argv[1:] or list(CHOREO)
    M = {}
    for n in names: M[n] = compose(n); print(n, len(M[n]))
    json.dump(M, open(OUT + 'meta.json', 'w'))
