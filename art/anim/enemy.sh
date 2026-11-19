# 사용: bash enemy.sh <kind> <key> <targetHeight>  → walk/attack GIF를 같은 배율로 변환
k=$1; key=$2; T=$3
H=$(python3 - "$k-walk.gif" "$key" <<'PY'
import sys, numpy as np
from PIL import Image, ImageSequence
g, key = sys.argv[1:3]; hs = []
for f in ImageSequence.Iterator(Image.open(g)):
    a = np.array(f.convert('RGB')).astype(int); r, gg, b = a[..., 0], a[..., 1], a[..., 2]
    kk = (gg > 150) & (r < 140) & (b < 140) if key == 'green' else (r > 150) & (b > 150) & (gg < 130)
    ys = np.where((~kk).any(1))[0]; hs.append(ys[-1] - ys[0])
print(int(np.median(hs)))
PY
)
S=$(python3 -c "print($T/$H)")
for a in walk attack; do [ -f $k-$a.gif ] && python3 gif2frames.py $a $k-$a.gif $key $S $(ls ../../assets/$k-idle.png ../../assets/$k-up.png 2>/dev/null | head -1) $k; done
