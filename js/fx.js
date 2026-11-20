// pixelfx 이펙트 레이어
// - 월드 레이어: 월드 좌표에 이펙트를 띄움. 'follow' 대상(탄·적)을 따라다니게 할 수 있음
// - 화면 레이어: 320x180 화면용 이펙트(날씨·장면 전환)를 화면 크기로 늘려 그림
// 이펙트 모듈은 처음 쓸 때 import()로 불러와 캐시한다 (pixelfx 171종 중 필요한 것만 받음)
import { createFrame, clearFrame, createFx } from './vendor/pixelfx/core/index.js';
import { rgb } from './vendor/pixelfx/core/color.js';

const mods = new Map();              // id → 모듈 (또는 로딩 중 Promise)
export function preload(ids) { for (const id of ids) load(id); }
function load(id) {
  if (!mods.has(id)) mods.set(id, import(`./vendor/pixelfx/fx/${id}.js`).then(m => { mods.set(id, m); return m; }).catch(() => { mods.set(id, null); }));
  return mods.get(id);
}

class Layer {
  constructor() { this.list = []; this.pending = []; this.cv = document.createElement('canvas'); this.ctx = this.cv.getContext('2d'); this.n = 0; this.dirty = true; this.has = false; this.cam = 0; }
  resize(w, h) { this.frame = createFrame(w, h); this.img = new ImageData(w, h); this.cv.width = w; this.cv.height = h; }
  clear() { this.list.length = 0; this.pending.length = 0; this.has = false; }

  // id: 'impacts/hit-spark' 처럼 분류/이름. opts.follow: {x,y,w,h,dead?} 객체를 따라감, opts.dx/dy: 따라갈 때 오프셋
  // opts.life: 틱 수가 지나면 서서히 끔, opts.key: 같은 키는 하나만 (중복 방지)
  spawn(id, x, y, opts = {}) {
    if (opts.key && (this.list.some(f => f.key === opts.key) || this.pending.some(p => p.opts.key === opts.key))) return null;
    const m = mods.get(id);
    if (m && !(m instanceof Promise)) return this.add(m, x, y, opts);
    if (m === null) return null;
    this.pending.push({ id, x, y, opts });
    load(id).then(() => {
      const i = this.pending.findIndex(p => p.id === id && p.x === x && p.y === y && p.opts === opts);
      if (i >= 0) { this.pending.splice(i, 1); const mm = mods.get(id); if (mm) this.add(mm, x, y, opts); }
    });
    return null;
  }
  add(m, x, y, opts) {
    const { life, follow, dx = 0, dy = 0, key, skip, speed, ...rest } = opts;
    for (const k in rest) if (rest[k] === undefined) delete rest[k];   // undefined가 이펙트 기본값을 덮지 않게
    const fx = createFx(m, { x: Math.round(x), y: Math.round(y), seed: (Math.random() * 1e6) | 0, ...rest });
    if (skip) fx.update((m.meta.duration || 1) * skip);   // 화면 전환: 덮인 상태에서 시작해 걷히는 절반만
    fx.speed = speed || 1; fx.life = life ?? Infinity; fx.follow = follow; fx.dx = dx; fx.dy = dy; fx.key = key;
    this.list.push(fx); this.dirty = true;
    return fx;
  }
  stopKey(key) { for (const f of this.list) if (f.key === key) { f.stop(); f.key = null; } }   // 끄는 중인 것은 키를 놓아 바로 새로 띄울 수 있게
  update(dt) {
    for (const fx of this.list) {
      fx.update(dt * (fx.speed || 1));
      if (--fx.life <= 0) fx.stop();
      const t = fx.follow;
      if (t) {
        if (t.dead || t.gone) fx.stop();
        else { fx.options.x = Math.round(t.x + (t.w || 0) / 2 + fx.dx); fx.options.y = Math.round(t.y + (t.h || 0) / 2 + fx.dy); }
      }
    }
    this.list = this.list.filter(fx => !fx.done());
  }
}

// 월드 레이어 (카메라 따라 스크롤). 이펙트는 30fps로 만들어졌으니 2프레임에 한 번 합성
export class FxLayer extends Layer {
  draw(g, camX, dx, dy) {
    if (!this.list.length) { this.has = false; return; }
    if (++this.n % 2 && !this.dirty && this.has) { g.drawImage(this.cv, dx + this.cam - Math.round(camX), dy); return; }
    this.dirty = false;
    const f = this.frame; f.ox = Math.round(camX); f.oy = 0; this.cam = f.ox;
    clearFrame(f);
    let x0 = f.w, y0 = f.h, x1 = 0, y1 = 0;
    for (const fx of this.list) {
      fx.draw(f);
      const [w, h] = fx.meta.size || [f.w, f.h], o = fx.options, cx = o.x - f.ox;
      x0 = Math.min(x0, cx - w); x1 = Math.max(x1, cx + w); y0 = Math.min(y0, o.y - h); y1 = Math.max(y1, o.y + h);
    }
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(f.w, Math.ceil(x1)); y1 = Math.min(f.h, Math.ceil(y1));
    if (x1 <= x0 || y1 <= y0) { this.has = false; return; }
    compositeRect(f, this.img.data, x0, y0, x1, y1);
    this.ctx.clearRect(0, 0, f.w, f.h);
    this.ctx.putImageData(this.img, 0, 0, x0, y0, x1 - x0, y1 - y0);
    g.drawImage(this.cv, dx, dy); this.has = true;
  }
}

// 화면 레이어: 320x180 화면 이펙트를 (vw x 360)으로 늘려 그림 (날씨는 배경 위, 전환은 맨 위)
export class ScreenFx extends Layer {
  constructor() { super(); this.resize(320, 180); }
  draw(g, vw, vh, alpha = 1) {
    if (!this.list.length) return;
    if (++this.n % 2 || this.dirty || !this.has) {
      this.dirty = false; const f = this.frame; f.ox = 0; f.oy = 0;
      clearFrame(f); for (const fx of this.list) fx.draw(f);
      compositeRect(f, this.img.data, 0, 0, f.w, f.h);
      this.ctx.putImageData(this.img, 0, 0); this.has = true;
    }
    g.save(); g.imageSmoothingEnabled = false; g.globalAlpha = alpha; g.drawImage(this.cv, 0, 0, vw, vh); g.restore();
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

// 내 캐릭터 실루엣을 pixelfx actor로 (설명서 "Got your own character?"):
// 상태이상(화상·기절·분노)·소멸 이펙트가 기본 더미 대신 실제 스프라이트 모양을 감싸게 한다.
// ax, ay: 이미지 안에서 발 위치(이펙트 원점). 이미지당 한 번만 계산해 캐시
const actors = new WeakMap();
export function actorFromImage(img, ax, ay) {
  if (!img || !img.naturalWidth) return undefined;
  let a = actors.get(img); if (a) return a;
  const w = img.naturalWidth, h = img.naturalHeight, c = document.createElement('canvas');
  c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, w, h).data, mask = new Uint8Array(w * h), px = new Uint32Array(w * h);
  let top = h;
  for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 96) {
    mask[i] = 1; px[i] = rgb(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    top = Math.min(top, (i / w) | 0);
  }
  const ox = -Math.round(ax), oy = -Math.round(ay);
  a = { mask: { w, h, data: mask }, pixels: px, x: ox, y: oy, w, h, k: 2, head: [0, oy + top], chest: [0, Math.round(oy + top + (ay - top) * 0.35)] };
  actors.set(img, a); return a;
}
