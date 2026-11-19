// pixelfx 이펙트 레이어: 월드 좌표로 이펙트를 띄우고 한 장의 캔버스로 합성
import { createFrame, clearFrame, createFx, PAL } from './vendor/pixelfx/core/index.js';
import * as slash from './vendor/pixelfx/fx/melee/sword-slash.js';
import * as hitSpark from './vendor/pixelfx/fx/impacts/hit-spark.js';
import * as parry from './vendor/pixelfx/fx/impacts/parry.js';
import * as crit from './vendor/pixelfx/fx/impacts/crit-hit.js';
import * as poof from './vendor/pixelfx/fx/spawn/poof.js';
import * as fireRing from './vendor/pixelfx/fx/fire/fire-ring.js';
import * as groundSlam from './vendor/pixelfx/fx/impacts/ground-slam.js';
import * as stunned from './vendor/pixelfx/fx/status/stunned.js';

// 등불 팔레트: 앰버 · 주황 · 크림
const AMBER = ['#4a1a0c', '#8c3414', '#d0661e', '#ffa63a', '#ffd27a', '#fff0c8', '#ffffff'];
const SPARK = ['#fff6c8', '#ffd86b', '#ff9a2a', '#e8561d'];

const KINDS = {
  slash: [slash, { palette: AMBER, sparks: SPARK }],
  hit: [hitSpark, {}],
  parry: [parry, {}],
  crit: [crit, {}],
  poof: [poof, { palette: PAL.smoke }],
  fireRing: [fireRing, {}],
  slam: [groundSlam, { palette: PAL.dust }],
  stunned: [stunned, {}],
};

export class FxLayer {
  constructor() { this.list = []; this.cv = document.createElement('canvas'); this.ctx = this.cv.getContext('2d'); this.n = 0; this.dirty = true; this.cam = 0; this.has = false; }

  resize(w, h) {
    this.frame = createFrame(w, h); this.img = new ImageData(w, h);
    this.cv.width = w; this.cv.height = h;
  }

  spawn(kind, x, y, opts = {}) {
    const [mod, base] = KINDS[kind];
    const { life, ...rest } = opts;
    const fx = createFx(mod, { ...base, x: Math.round(x), y: Math.round(y), seed: (Math.random() * 1e6) | 0, ...rest });
    fx.life = life ?? Infinity;   // 틱 수: 지나면 서서히 끔 (긴 이펙트 비용 절약)
    this.list.push(fx); this.dirty = true;
    return fx;
  }

  update(dt) {
    for (const fx of this.list) { fx.update(dt); if (--fx.life <= 0) fx.stop(); }
    this.list = this.list.filter(fx => !fx.done());
  }

  clear() { this.list.length = 0; this.has = false; }

  // pixelfx 이펙트는 30fps로 만들어졌다 → 합성도 2프레임에 한 번, 사이 프레임은 이전 결과를 카메라만 보정해 재사용
  draw(g, camX, dx, dy) {
    if (!this.list.length) { this.has = false; return; }
    if (++this.n % 2 && !this.dirty && this.has) { g.drawImage(this.cv, dx + this.cam - Math.round(camX), dy); return; }
    this.dirty = false;
    const f = this.frame; f.ox = Math.round(camX); f.oy = 0; this.cam = f.ox;
    clearFrame(f);
    // 이펙트가 닿을 수 있는 영역만 합성 (전체 화면 합성은 폰에서 무겁다)
    let x0 = f.w, y0 = f.h, x1 = 0, y1 = 0;
    for (const fx of this.list) {
      fx.draw(f);
      const [w, h] = fx.meta.size, o = fx.options, cx = o.x - f.ox;
      x0 = Math.min(x0, cx - w); x1 = Math.max(x1, cx + w);
      y0 = Math.min(y0, o.y - h); y1 = Math.max(y1, o.y + h * 0.5);
    }
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(f.w, Math.ceil(x1)); y1 = Math.min(f.h, Math.ceil(y1));
    if (x1 <= x0 || y1 <= y0) { this.has = false; return; }
    compositeRect(f, this.img.data, x0, y0, x1, y1);
    this.ctx.clearRect(0, 0, f.w, f.h);
    this.ctx.putImageData(this.img, 0, 0, x0, y0, x1 - x0, y1 - y0);
    g.drawImage(this.cv, dx, dy); this.has = true;
  }
}

// pixelfx composite()의 투명 배경 버전을 사각형 영역에만 적용
function compositeRect(f, out, x0, y0, x1, y1) {
  const C = f.color, L = f.light, W = f.w;
  for (let y = y0; y < y1; y++) for (let i = y * W + x0, e = y * W + x1; i < e; i++) {
    const c = C[i], l = L[i] & 0xffffff, j = i * 4;
    let r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255, a = c >>> 24;
    if (l) {
      const lr = l & 255, lg = (l >>> 8) & 255, lb = (l >>> 16) & 255;
      if (a < 255) {
        const pa = a / 255, pr = r * pa + lr, pg = g * pa + lg, pb = b * pa + lb;
        const na = Math.min(1, Math.max(pa, Math.max(lr, lg, lb) / 255));
        if (na > 0) { r = Math.min(255, pr / na); g = Math.min(255, pg / na); b = Math.min(255, pb / na); a = na * 255; }
      } else { r = Math.min(255, r + lr); g = Math.min(255, g + lg); b = Math.min(255, b + lb); }
    }
    out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = a;
  }
}
