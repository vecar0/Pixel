"""Export built Lira moves (tools/art/build_lira.sh output) into the game: assets/lira-<anim>-<i>.png,
anims.json['lira'], blade.json (m blade, r1/r2 rings, o lantern flame) and eyes.json for every frame.
usage: export_lira.py <build dir e.g. art/lira2/v16> [lanternless build dir → *_nl anims]"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage
SETS = [(sys.argv[1], '')] + ([(sys.argv[2], '_nl')] if len(sys.argv) > 2 else []); ROOT = os.path.join(os.path.dirname(__file__), '../..'); AS = os.path.join(ROOT, 'assets')
def frames_of(d, idxs):
    meta = json.load(open(f'{B}/{d}/meta.json'))
    anchor = meta.get('anchor'); fm = meta['frames']
    out = []
    for i in idxs:
        feet = fm[i].get('feet') if anchor is None else anchor
        out.append((f'{B}/{d}/frame_{i:03d}.png', f'{B}/{d}/mask_{i:03d}.png', feet, fm[i].get('pole'), fm[i].get('pin')))
    return out
def anims_for():
    return {
        'idle': frames_of('idle', range(6)),
        'run': frames_of('run', range(8)),
        'jump': frames_of('jump', range(8)),
        'atk1': frames_of('reap', range(8)),
        'atk2': frames_of('c_atk2', range(1, 12)),
        'atk3': frames_of('c_atk3', range(1, 12)),
        'follow': frames_of('c_follow', range(1, 10)),
        'parry': frames_of('block', [0, 1, 1, 2, 3, 4, 5, 5]),
        'roll': frames_of('roll', range(8)),
        'hurt': frames_of('hurt', range(6)),
        'death': frames_of('death', list(range(8)) + [7, 7]),
        'exec': frames_of('exec', range(16)),
        'flurry': frames_of('exec', [int(round(x)) for x in np.linspace(0, 15, 12)]),
        'enchant': frames_of('twirl', list(range(10)) + [9, 9]),
    }
anims = json.load(open(f'{AS}/anims.json')); blade = json.load(open(f'{AS}/blade.json')); eyes = json.load(open(f'{AS}/eyes.json'))
for k in [k for k in blade if '/lira-' in k]: del blade[k]
for k in [k for k in eyes if '/lira-' in k]: del eyes[k]
def rows(mask):
    r = []
    for y in range(mask.shape[0]):
        xs = np.nonzero(mask[y])[0]
        if len(xs): r.append([int(y), [int(x) for x in xs]])
    return r
K8 = np.ones((3, 3), bool); lira = {}; cache = {}
ALL = []
for B, SUF in SETS:
    for name, lst in anims_for().items(): ALL.append((name + SUF, lst))
for name, lst in ALL:
    lira[name] = []
    for i, (fp, mp, feet, pole, pin) in enumerate(lst):
        src = f'assets/lira-{name}-{i}.png'
        im = np.array(Image.open(fp).convert('RGBA')); mk = np.array(Image.open(mp).convert('RGB'))
        al = im[..., 3] > 0; ys, xs = np.nonzero(al)
        y0, y1, x0, x1 = max(0, ys.min() - 1), ys.max() + 2, max(0, xs.min() - 1), xs.max() + 2
        crop = im[y0:y1, x0:x1]; bm = mk[y0:y1, x0:x1, 0] > 0; fl = mk[y0:y1, x0:x1, 1] > 0
        Image.fromarray(crop.astype(np.uint8)).save(os.path.join(ROOT, src))
        ax, ay = int(round(feet[0] - x0)), int(round(feet[1] - y0))
        fr_ = {'src': src, 'ax': ax, 'ay': ay, 'w': int(x1 - x0), 'h': int(y1 - y0)}
        if pole: fr_['pe'] = [round(pole[0] - x0, 1), round(pole[1] - y0, 1)]   # 낫 자루 끝 (사슬이 나오는 곳)
        if pin: fr_['pi'] = [round(pin[0] - x0, 1), round(pin[1] - y0, 1)]     # 자루 안쪽 점 (끝 → 이 점 반대쪽이 사슬이 나가는 방향)
        lira[name].append(fr_)
        d1 = ndimage.binary_dilation(bm, K8); d2 = ndimage.binary_dilation(d1, K8)
        blade[src] = {'r1': rows(d1 & ~bm), 'r2': rows(d2 & ~d1), 'm': rows(bm), 'o': rows(fl)}
        # eyes: amber pixels in the upper part of the body, away from the lantern flame
        a = crop.astype(int); amb = (a[..., 3] > 0) & (a[..., 0] > 170) & (a[..., 0] - a[..., 2] > 90) & (a[..., 1] > 70) & ~ndimage.binary_dilation(fl, K8, iterations=2) & ~bm
        top = ys.min() - y0; hgt = ys.max() - ys.min()
        yy = np.arange(amb.shape[0])[:, None]; amb &= (yy > top + hgt * .08) & (yy < top + hgt * .45)
        lab, n = ndimage.label(amb, K8)
        if n:
            sz = ndimage.sum(amb, lab, range(1, n + 1)); keep = [j + 1 for j in range(n) if sz[j] <= 12]
            pts = np.argwhere(np.isin(lab, keep))
            if len(pts):
                cy, cx = pts.mean(0).round().astype(int)
                eyes[src] = [int(cx), int(cy), [[int(x - cx), int(y - cy), '%02x%02x%02x' % tuple(a[y, x, :3])] for y, x in pts[:16]]]
anims['lira'] = lira
json.dump(anims, open(f'{AS}/anims.json', 'w'), separators=(',', ':'))
json.dump(blade, open(f'{AS}/blade.json', 'w'), separators=(',', ':'))
json.dump(eyes, open(f'{AS}/eyes.json', 'w'), separators=(',', ':'))
print({k: len(v) for k, v in lira.items()}, 'eyes', sum(1 for k in eyes if '/lira-' in k))
