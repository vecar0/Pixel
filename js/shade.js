// 몸 전체 명암 (A 부드러운 3단): 실루엣에서 부피(높이)를 추정해 법선을 만들고, 등불 방향 빛으로 단계 명암을 준다.
// art/shade/proto.py와 같은 계산. 이미지마다 '빛이 그림 오른쪽에서' / '왼쪽에서' 두 장을 한 번만 만든다.
const cache = new WeakMap();
const LEVELS = [-0.15, 0.2, 0.55], WARM = [255, 190, 120], COOL = [40, 30, 80], LIT_K = 0.9, SH_K = 0.8;

function chamfer(op, W, H) {
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = op[i] ? 1e9 : 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!d[i]) continue; let m = d[i];
      if (y > 0) { m = Math.min(m, d[i - W] + 1); if (x > 0) m = Math.min(m, d[i - W - 1] + 1.4); if (x < W - 1) m = Math.min(m, d[i - W + 1] + 1.4); }
      if (x > 0) m = Math.min(m, d[i - 1] + 1); d[i] = m;
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x; if (!d[i]) continue; let m = d[i];
      if (y < H - 1) { m = Math.min(m, d[i + W] + 1); if (x < W - 1) m = Math.min(m, d[i + W + 1] + 1.4); if (x > 0) m = Math.min(m, d[i + W - 1] + 1.4); }
      if (x < W - 1) m = Math.min(m, d[i + 1] + 1); d[i] = m;
    }
  }
  return d;
}
function blur(a, W, H, r) {          // 상자 흐림 (적분 영상)
  const S = new Float64Array((W + 1) * (H + 1)), o = new Float32Array(W * H);
  for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += a[y * W + x]; S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + row; } }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
    o[y * W + x] = (S[y1 * (W + 1) + x1] - S[y0 * (W + 1) + x1] - S[y1 * (W + 1) + x0] + S[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0));
  }
  return o;
}
function grad(a, W, H, x, y) {
  const g = (xx, yy) => a[Math.max(0, Math.min(H - 1, yy)) * W + Math.max(0, Math.min(W - 1, xx))];
  return [(g(x + 1, y) - g(x - 1, y)) / 2, (g(x, y + 1) - g(x, y - 1)) / 2];
}

function build(im) {
  const W = im.naturalWidth || im.width, H = im.naturalHeight || im.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const src = x.getImageData(0, 0, W, H), A = src.data, op = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) op[i] = A[i * 4 + 3] > 96 ? 1 : 0;
  const R = 14, dist = chamfer(op, W, H), h0 = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { const t = Math.min(dist[i], R) / R; h0[i] = Math.sqrt(t * (2 - t)); }
  const h = blur(h0, W, H, 5), big = blur(op, W, H, 12);
  const make = dir => {
    const L = [0.75 * dir, 0.15, 0.65], ln = Math.hypot(...L); L[0] /= ln; L[1] /= ln; L[2] /= ln;
    const out = new ImageData(W, H), O = out.data;
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const i = y * W + xx; if (!op[i]) continue;
      let [gx, gy] = grad(h, W, H, xx, y); let n = [-gx * 6, -gy * 6, 1], nl = Math.hypot(...n);
      const il = (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / nl;
      [gx, gy] = grad(big, W, H, xx, y); n = [-gx * 14, -gy * 14, 1]; nl = Math.hypot(...n);
      const ib = (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / nl;
      const I = 0.45 * il + 0.8 * ib - 0.38;
      let q = 0; for (const lv of LEVELS) if (I >= lv) q++;
      const t = q / LEVELS.length, j = i * 4;
      let r = A[j], g = A[j + 1], b = A[j + 2];
      if (t < 0.5) { const k = (0.5 - t) * 2 * SH_K, f = (1 - 0.45 * k) * (1 - 0.25 * k); r = r * f + COOL[0] * 0.25 * k; g = g * f + COOL[1] * 0.25 * k; b = b * f + COOL[2] * 0.25 * k; }
      else if (t > 0.5) { const k = (t - 0.5) * 2 * LIT_K, f = (1 + 0.3 * k) * (1 - 0.14 * k); r = r * f + WARM[0] * 0.14 * k; g = g * f + WARM[1] * 0.14 * k; b = b * f + WARM[2] * 0.14 * k; }
      O[j] = Math.min(255, r); O[j + 1] = Math.min(255, g); O[j + 2] = Math.min(255, b); O[j + 3] = 255;
    }
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.getContext('2d').putImageData(out, 0, 0); return cv;
  };
  return { R: make(1), L: make(-1) };
}
// im의 명암판: toRight = 빛이 그림 오른쪽에서. 처음 부를 때 계산
// 계산은 한 프레임에 한 장씩 (처음 보는 그림이 많아도 끊기지 않게). 준비 전엔 null → 명암 없이 그림
const queue = [], queued = new WeakSet();
function pump() { const t0 = performance.now(); while (queue.length && performance.now() - t0 < 4) { const im = queue.shift(); cache.set(im, build(im)); } if (queue.length) setTimeout(pump, 16); }
export function bodyShade(im, toRight) {
  if (!im || !(im.naturalWidth || im.width)) return null;
  const s = cache.get(im);
  if (!s) { if (!queued.has(im)) { queued.add(im); queue.push(im); if (queue.length === 1) setTimeout(pump, 0); } return null; }
  return toRight ? s.R : s.L;
}
