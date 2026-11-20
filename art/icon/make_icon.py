"""앱 아이콘: 64x64 픽셀 화면에 리라(상반신+등불)와 등불빛을 그린 뒤 정수배로 키운다.
any: 꽉 찬 그림 / maskable: 안드로이드 원형·둥근 마스크용 (가운데 80% 안에 들어오게 여백)"""
from PIL import Image, ImageDraw
import math, sys
S = 64
src = Image.open('assets/lira-idle-0.png').convert('RGBA')   # 83x84 게임 스프라이트를 1:1로
def base(pad):
    im = Image.new('RGBA', (S, S), (13, 10, 17, 255)); px = im.load()
    cx, cy = 52, 42                                   # 등불 쪽에 빛
    for y in range(S):
        for x in range(S):
            d = math.hypot(x - cx, y - cy) / 40
            k = max(0, 1 - d) ** 1.6
            k = round(k * 5) / 5                      # 도트답게 단계로
            px[x, y] = (int(13 + 140 * k), int(10 + 70 * k), int(17 + 18 * k), 255)
    if pad == 0: crop = src.crop((18, 2, 82, 66))                          # 머리·상반신·등불 (64x64, 1:1)
    else: crop = src.crop((6, 0, 83, 84)).resize((S - 2 * pad, S - 2 * pad), Image.NEAREST)   # 마스크용: 전신을 안쪽에
    im.alpha_composite(crop, (pad, pad if pad else 0))
    d = ImageDraw.Draw(im)                            # 테두리: 무쇠 + 호박색 실선
    if pad == 0:
        d.rectangle([0, 0, S - 1, S - 1], outline=(46, 37, 55, 255)); d.rectangle([1, 1, S - 2, S - 2], outline=(120, 70, 30, 255))
    return im
for name, pad, size in [('icon-512.png', 0, 512), ('icon-192.png', 0, 192), ('icon-maskable-512.png', 8, 512), ('icon.png', 0, 192)]:
    base(pad).resize((size, size), Image.NEAREST).save(name)
print('ok')
