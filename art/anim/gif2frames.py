# GIF 애니메이션 → 게임용 1배 프레임들 + 기준점 JSON
# 사용: python3 gif2frames.py <name> <gif> <key:green|magenta> <scale> <palette_png> [prefix]
# - 키 색을 투명으로, 같은 배율로 줄이고(면적 평균), 팔레트 색으로 맞춰 픽셀 느낌 유지
# - 기준점: 발(가장 아래 행) / 몸통 중앙(위 30~55% 행의 중앙값)
import sys, json, numpy as np
from PIL import Image, ImageSequence
name, gif, key, scale, palp = sys.argv[1:6]; prefix = sys.argv[6] if len(sys.argv) > 6 else 'lira'
scale = float(scale)
P = np.array(Image.open(palp).convert('RGBA')); pal = np.unique(P[P[..., 3] > 0][:, :3], axis=0).astype(int)
frames = [f.convert('RGB') for f in ImageSequence.Iterator(Image.open(gif))]
out = []
for i, f in enumerate(frames):
    a = np.array(f).astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = (g > 150) & (r < 140) & (b < 140) if key == 'green' else (r > 150) & (b > 150) & (g < 130)
    rgba = np.dstack([a, np.where(k, 0, 255)]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA'); W, H = im.size
    sm = im.resize((max(1, round(W * scale)), max(1, round(H * scale))), Image.BOX)
    s = np.array(sm).astype(int); alpha = s[..., 3] > 140
    d = ((s[..., None, :3] - pal[None, None]) ** 2).sum(-1); col = pal[d.argmin(-1)]
    o = np.zeros_like(s, dtype=np.uint8); o[..., :3] = col; o[..., 3] = np.where(alpha, 255, 0)
    img = Image.fromarray(o, 'RGBA'); bb = img.getbbox(); img = img.crop(bb)
    al = np.array(img)[..., 3] > 0; Hh, Ww = al.shape
    rows = np.where(al.any(1))[0]; ay = int(rows[-1]) + 1
    xs = np.where(al[int(Hh * 0.3):int(Hh * 0.55)].any(0))[0]
    band = al[int(Hh * 0.3):int(Hh * 0.55)]; cols = np.where(band)[1]; ax = int(np.median(cols))
    fn = f'{prefix}-{name}-{i}.png'; img.save('../../assets/' + fn)
    out.append({'src': 'assets/' + fn, 'ax': ax, 'ay': ay, 'w': Ww, 'h': Hh})
print(name, len(out), [o['h'] for o in out])
db = '../../assets/anims.json'
try: J = json.load(open(db))
except Exception: J = {}
J.setdefault(prefix, {})[name] = out
json.dump(J, open(db, 'w'), indent=1)
