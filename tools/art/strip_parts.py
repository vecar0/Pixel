"""Keep all detail; only (1) recolour thick white patches to the cape's dark tones,
(2) erase the lantern that hangs at the blade tip (largest orange blob) and its flame.
usage: python3 strip_parts.py <in_dir> <out_dir>"""
import sys, glob, os
import numpy as np
from PIL import Image
from scipy import ndimage
K8 = np.ones((3, 3), bool)

def run(a):
    al = a[..., 3] > 0
    rgb = a[..., :3].astype(int)
    l = 0.3*rgb[..., 0] + 0.59*rgb[..., 1] + 0.11*rgb[..., 2]
    sat = rgb.max(-1) - rgb.min(-1)
    rb0 = rgb[..., 0] - rgb[..., 2]
    skinmid0 = al & (rb0 > 40) & (rb0 < 100) & (l > 135) & (l < 190)
    ys, xs = np.nonzero(al); fy = ys.max(); fx = xs[ys >= fy - 3].mean()
    yy, xx = np.mgrid[:al.shape[0], :al.shape[1]]
    eyezone = (yy > fy - 70) & (yy < fy - 45) & (np.abs(xx - fx) < 22)
    # (2) blade-tip lantern: the largest orange blob (eyes excluded)
    org = al & (rgb[..., 0] > 150) & (rgb[..., 0] - rgb[..., 2] > 70)
    eyes0 = org & eyezone
    le, ne = ndimage.label(eyes0, structure=K8)
    if ne:
        se = ndimage.sum(eyes0, le, range(1, ne + 1)); small = np.zeros(ne + 1, bool); small[1:] = se <= 25
        eyes0 = small[le] & eyes0
    org &= ~eyes0
    lab, n = ndimage.label(ndimage.binary_dilation(org, structure=K8, iterations=3), structure=K8)
    lab = lab * org
    kill = np.zeros_like(al)
    if n >= 1:
        sz = ndimage.sum(org, lab, range(1, n + 1))
        ys, xs = np.nonzero(al); fy = ys.max(); fx = xs[ys >= fy - 3].mean()
        main = 1 + int(np.argmax(sz))       # the blade-tip lantern + its flame
        kill |= ndimage.binary_dilation(lab == main, structure=K8, iterations=3) & al
        kill &= ~ndimage.binary_dilation(eyes0, structure=np.ones((5, 5), bool), iterations=3)
    if kill.any():
        # body = largest connected piece; floating lantern bits are deleted,
        # flame lying on the blade/pole is repainted in the blade's greys
        lb, nb_ = ndimage.label(al, structure=K8)
        szb = ndimage.sum(al, lb, range(1, nb_ + 1))
        body = lb == (1 + int(np.argmax(szb)))
        floating = ndimage.binary_dilation(org & ~body, structure=K8, iterations=2) & ~body
        dele = (kill | floating) & ~body
        a[dele, 3] = 0
        onb = kill & body & org
        if onb.any():
            t = ((l[onb] - 100) / 155.0).clip(0, 1)
            g = (30 + t * 70).astype(int)
            a[onb, 0] = g; a[onb, 1] = g; a[onb, 2] = (g + 4).clip(0, 255)
        # trim the ragged smoke left where the flame stuck out of the blade
        zone = ndimage.binary_dilation(kill & body, structure=K8, iterations=1)
        for _ in range(4):
            op = a[..., 3] > 0
            nbc = ndimage.convolve(op.astype(int), np.ones((3, 3), int), mode='constant') - op
            rm = zone & op & (nbc <= 4)
            if not rm.any(): break
            a[rm, 3] = 0
        # warm brown fringe of the flame on the body -> grey as well
        fr = kill & body & ~org & ((rgb[..., 0] - rgb[..., 2]) > 30)
        if fr.any():
            g = (l[fr] * 0.6).astype(int).clip(20, 120)
            a[fr, 0] = g; a[fr, 1] = g; a[fr, 2] = (g + 4).clip(0, 255)
        al = a[..., 3] > 0
        lab2, n2 = ndimage.label(al, structure=K8)
        if n2 > 1:
            sz2 = ndimage.sum(al, lab2, range(1, n2 + 1))
            k2 = np.zeros(n2 + 1, bool); k2[1:] = sz2 >= 25; al &= k2[lab2]; a[~al, 3] = 0
        rgb = a[..., :3].astype(int); l = 0.3*rgb[..., 0]+0.59*rgb[..., 1]+0.11*rgb[..., 2]
        sat = rgb.max(-1) - rgb.min(-1)
    # (1) white patches: bright, unsaturated, in thick regions (thin blade highlight survives)
    rb = rgb[..., 0] - rgb[..., 2]
    # face guard: eyes are small amber blobs at head height; protect around them
    ys, xs = np.nonzero(al); fy = ys.max(); fx = xs[ys >= fy - 3].mean()
    yy, xx = np.mgrid[:al.shape[0], :al.shape[1]]
    eyes = al & (rgb[..., 0] > 150) & (rb > 70) & (yy > fy - 70) & (yy < fy - 45) & (np.abs(xx - fx) < 30)
    lab, n = ndimage.label(eyes, structure=K8)
    if n:
        sz = ndimage.sum(eyes, lab, range(1, n + 1))
        ok = np.zeros(n + 1, bool); ok[1:] = sz <= 25; eyes = ok[lab] & eyes
    face = ndimage.binary_dilation(eyes, structure=np.ones((5, 5), bool), iterations=3)
    skinmid = al & (rb > 40) & (rb < 100) & (l > 135) & (l < 190)   # mid skin tones
    nearskin = ndimage.binary_dilation(skinmid, structure=K8, iterations=2)
    wh = al & ~face & (l > 150) & (((sat < 45) & (rb < 25)) | ((rb < 45) & ~nearskin))
    thick = ndimage.binary_opening(wh, structure=np.ones((2, 2), bool))
    zone = ndimage.binary_dilation(thick, structure=K8, iterations=3) & wh
    if zone.any():
        # map 150..255 -> dark cape greys, keeping relative shading
        t = (l[zone] - 150) / 105.0
        g = (38 + t * 42).astype(int)
        a[zone, 0] = g; a[zone, 1] = g; a[zone, 2] = (g + 6).clip(0, 255)
    # (3) stray light flecks: small bright clusters (not face, not the long blade edge)
    al = a[..., 3] > 0
    rgb = a[..., :3].astype(int); l = 0.3*rgb[..., 0]+0.59*rgb[..., 1]+0.11*rgb[..., 2]
    br = al & ~face & (l > 120) & ((rgb.max(-1) - rgb.min(-1)) < 60)
    lb, nb_ = ndimage.label(br, structure=K8)
    if nb_:
        sz = ndimage.sum(br, lb, range(1, nb_ + 1))
        rb3 = rgb[..., 0] - rgb[..., 2]
        smid = al & (rb3 > 40) & (rb3 < 100) & (l > 120) & (l < 190)
        touch = ndimage.binary_dilation(smid, structure=K8)
        hit = ndimage.maximum(touch, lb, range(1, nb_ + 1))
        cream = ndimage.mean((l > 200).astype(float), lb, range(1, nb_ + 1))
        sm = np.zeros(nb_ + 1, bool)
        sm[1:] = (sz <= 5) | ((sz <= 14) & (np.asarray(hit) == 0)) | ((sz <= 20) & (np.asarray(cream) >= 0.7))
        fleck = sm[lb] & br
        dark = al & ~br
        if fleck.any() and dark.any():
            _, (iy, ix) = ndimage.distance_transform_edt(~dark, return_indices=True)
            a[fleck, :3] = a[iy[fleck], ix[fleck], :3]
    # (3b) rust specks: warm dark pixels away from fire/face become neutral grey (same lightness)
    al = a[..., 3] > 0
    rgb = a[..., :3].astype(int); l = 0.3*rgb[..., 0]+0.59*rgb[..., 1]+0.11*rgb[..., 2]
    fire = al & (rgb[..., 0] > 150) & (rgb[..., 0] - rgb[..., 2] > 70)
    nearfire = ndimage.binary_dilation(fire, structure=K8, iterations=3)
    rust = np.zeros_like(al)  # disabled: kept brown detail (straps, shading)
    if rust.any():
        g = l[rust].astype(int)
        a[rust, 0] = g; a[rust, 1] = g; a[rust, 2] = (g + 2).clip(0, 255)
    # (4) lone odd pixels: a pixel unlike all of its neighbours takes their typical colour
    for _ in range(2):
        al = a[..., 3] > 0
        rgb = a[..., :3].astype(int)
        H, W = al.shape
        fire = (rgb[..., 0] > 150) & (rgb[..., 0] - rgb[..., 2] > 70)
        P = np.pad(rgb, ((1, 1), (1, 1), (0, 0)))
        PA = np.pad(al, 1)
        offs = [(dy, dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]
        nbr = np.stack([P[1+dy:1+dy+H, 1+dx:1+dx+W] for dy, dx in offs])      # 8,H,W,3
        nal = np.stack([PA[1+dy:1+dy+H, 1+dx:1+dx+W] for dy, dx in offs])     # 8,H,W
        d = np.abs(nbr - rgb[None]).sum(-1)                                   # colour distance
        similar = ((d < 70) & nal).sum(0)
        cnt = nal.sum(0)
        L = 0.3*rgb[..., 0]+0.59*rgb[..., 1]+0.11*rgb[..., 2]
        nL = 0.3*nbr[..., 0]+0.59*nbr[..., 1]+0.11*nbr[..., 2]
        medL = np.nanmedian(np.where(nal, nL, np.nan), axis=0)
        lone = al & (cnt >= 6) & ~face & ~fire & (similar == 0)
        if not lone.any(): break
        # replacement: the neighbour closest to the neighbours' median colour
        med = np.median(np.where(nal[..., None], nbr, np.nan), axis=0)
        dm = np.abs(nbr - np.nan_to_num(med)[None]).sum(-1) + (~nal) * 9999
        pick = dm.argmin(0)
        ys, xs = np.nonzero(lone)
        a[ys, xs, :3] = nbr[pick[ys, xs], ys, xs]
    # (5) silhouette: spurs out, notches in, odd outline pixels toned to the outline
    H, W = a.shape[:2]
    offs = [(dy, dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]
    def stack(arr):
        P = np.pad(arr, ((1, 1), (1, 1)) + ((0, 0),) * (arr.ndim - 2))
        return np.stack([P[1+dy:1+dy+H, 1+dx:1+dx+W] for dy, dx in offs])
    for _ in range(2):
        al = a[..., 3] > 0
        nal = stack(al); cnt = nal.sum(0)
        # spur: <=2 neighbours that touch each other (a bump, not a 1px line)
        spur = al & (cnt <= 1)
        two = al & (cnt == 2)
        if two.any():
            idx = np.argsort(~nal, axis=0)[:2]           # positions of the two neighbours
            o = np.array(offs)
            p1 = o[idx[0]]; p2 = o[idx[1]]
            adj = np.abs(p1 - p2).max(-1) <= 1
            spur |= two & adj
        spur &= ~face
        a[spur, 3] = 0
        # notch: empty pixel enclosed by >=6 body neighbours
        al = a[..., 3] > 0
        nal = stack(al); cnt = nal.sum(0)
        notch = ~al & (cnt >= 6)
        if notch.any():
            nbr = stack(a[..., :3].astype(int))
            med = np.median(np.where(nal[..., None], nbr, np.nan), axis=0)
            dm = np.abs(nbr - np.nan_to_num(med)[None]).sum(-1) + (~nal) * 9999
            pick = dm.argmin(0)
            ys, xs = np.nonzero(notch)
            a[ys, xs, :3] = nbr[pick[ys, xs], ys, xs]; a[ys, xs, 3] = 255
    # outline pixels much lighter than every other outline neighbour -> darkest neighbour
    al = a[..., 3] > 0
    rgb = a[..., :3].astype(int)
    pad = np.pad(al, 1)
    edge = al & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    L = 0.3*rgb[..., 0]+0.59*rgb[..., 1]+0.11*rgb[..., 2]
    nL = stack(L); ne = stack(edge); nal = stack(al)
    fire = (rgb[..., 0] > 150) & (rgb[..., 0] - rgb[..., 2] > 70)
    simedge = (ne & (np.abs(nL - L[None]) < 40)).sum(0)
    minL = np.nanmin(np.where(nal, nL, np.nan), axis=0)
    sat = rgb.max(-1) - rgb.min(-1)
    grey_fringe = edge & (sat < 40) & (L > 35) & (L < 165) & (L > minL + 25)
    odd = edge & ~face & ~fire & (simedge == 0) & (L > minL + 60)
    if odd.any():
        nbr = stack(rgb)
        darkest = np.where(nal, nL, 9999).argmin(0)
        ys, xs = np.nonzero(odd)
        a[ys, xs, :3] = nbr[darkest[ys, xs], ys, xs]
    return a

src, dst = sys.argv[1:3]
os.makedirs(dst, exist_ok=True)
for f in sorted(glob.glob(os.path.join(src, '*.png'))):
    a = np.array(Image.open(f).convert('RGBA'))
    Image.fromarray(run(a)).save(os.path.join(dst, os.path.basename(f)))
print('ok', dst)
