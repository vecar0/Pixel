// 빛과 실체 (설계: 「빛 속에서만 벨 수 있다」)
// 적은 그림자다. 등불 빛 안에 0.3초 머물면 실체가 되어 베이고, 빛을 0.5초 벗어나면 다시 그림자가 된다.
// 등불: 들기(리라 둘레 빛) · 던지기(떨어진 자리 6초 빛) · 회수(되돌아오는 길의 그림자 1초 실체화)
import { CFG } from './config.js?v=mwzt5ovx';

const L = () => CFG.lantern;

export function createLamp() {
  return { st: 'held', x: 0, y: 0, t: 0, holdT: 0, aim: CFG.lantern.throwDist, fx: 0, fy: 0, tx: 0, ty: 0, offT: 0 };
}

// 성장(등잔의 빛 모양)이 바꾸는 값들
const shape = (p, k) => (p.shapes && p.shapes[k]) || 0;
export const lightMul = p => (1 + 0.2 * Math.min(3, shape(p, 'wide'))) * (p.bigLamp ? 1 + 0.15 * p.bigLamp : 1);

function hand(p) { return { x: p.x + p.w / 2 + p.face * 10, y: p.y + 30 }; }

function groundY(w, x) {
  let y = 300;
  for (const s of w.solids) if (!s.oneWay && s.h > 8 && x >= s.x && x <= s.x + s.w && s.y >= 120) y = Math.min(y, s.y);
  return y;
}

function throwLamp(w, p, dist) {
  const Lp = p.lamp, h = hand(p);
  const tx = Math.max(24, Math.min(w.width - 24, h.x + p.face * dist));
  Object.assign(Lp, { st: 'fly', t: 0, fx: h.x, fy: h.y, tx, ty: groundY(w, tx) - 12, x: h.x, y: h.y, holdT: 0 });
  p.aiming = false;
  w.events.push({ type: 'lampThrow', x: h.x, y: h.y, tx, face: p.face });
}
export function recallLamp(w, p) {
  const Lp = p.lamp; if (Lp.st !== 'placed' && Lp.st !== 'fly') return;
  Object.assign(Lp, { st: 'back', t: 0, fx: Lp.x, fy: Lp.y });
  w.events.push({ type: 'lampRecall', x: Lp.x, y: Lp.y });
}

// 매 틱: 등불 입력과 움직임
export function updateLamp(w, inp) {
  const p = w.player, Lp = p.lamp; if (!Lp) return;
  if (Lp.offT > 0) Lp.offT--;
  if (w.temps) { for (const t of w.temps) t.life--; w.temps = w.temps.filter(t => t.life > 0); }
  const busy = p.state === 'dead' || p.state === 'execute' || p.state === 'hurt';
  if (Lp.st === 'held') {
    const h = hand(p); Lp.x = h.x; Lp.y = h.y;
    if (inp.lamp && !busy) { Lp.holdT = 1; Lp.aim = L().throwDist; }
    else if (Lp.holdT > 0) {
      if (inp.lampHeld && !busy) {
        Lp.holdT++;
        if (Lp.holdT > L().tapF) {                                   // 길게 누르면 조준: 앞쪽 방향키 = 멀리, 뒤쪽 = 가까이
          p.aiming = true;
          const fwd = p.face > 0 ? inp.right : inp.left, back = p.face > 0 ? inp.left : inp.right;
          Lp.aim = Math.max(L().aimMin, Math.min(L().aimMax, Lp.aim + (fwd ? L().aimSpeed : 0) - (back ? L().aimSpeed : 0)));
        }
      } else if (busy) { Lp.holdT = 0; p.aiming = false; }
      else throwLamp(w, p, Lp.holdT > L().tapF ? Lp.aim : L().throwDist);
    }
    return;
  }
  p.aiming = false; Lp.holdT = 0;
  Lp.t++;
  if (Lp.st === 'fly') {
    const k = Math.min(1, Lp.t / L().flyF);
    Lp.x = Lp.fx + (Lp.tx - Lp.fx) * k; Lp.y = Lp.fy + (Lp.ty - Lp.fy) * k - 46 * Math.sin(Math.PI * k);
    if (k >= 1) { Lp.st = 'placed'; Lp.t = 0; w.events.push({ type: 'lampLand', x: Lp.x, y: Lp.y }); }
    else if (inp.lamp) recallLamp(w, p);
  } else if (Lp.st === 'placed') {
    if (shape(p, 'follow')) { const cx = p.x + p.w / 2; Lp.x += Math.sign(cx - Lp.x) * Math.min(0.45, Math.abs(cx - Lp.x)); Lp.y = groundY(w, Lp.x) - 12; }   // 따라오는 빛
    if (inp.lamp || Lp.t >= L().placedF + 180 * shape(p, 'long')) recallLamp(w, p);
  } else if (Lp.st === 'back') {
    const h = hand(p), k = Math.min(1, Lp.t / L().recallF);
    Lp.x = Lp.fx + (h.x - Lp.fx) * k; Lp.y = Lp.fy + (h.y - Lp.fy) * k;
    for (const e of w.enemies) if (!e.dead && Math.hypot(e.x + e.w / 2 - Lp.x, e.y + e.h / 2 - Lp.y) < 34 + e.w / 2)   // 끌려오는 등불이 지나간 그림자 → 1초 실체화
      e.burnSolidT = Math.max(e.burnSolidT || 0, L().recallSolidF);
    if (shape(p, 'linger') && Lp.t % 3 === 0) (w.temps = w.temps || []).push({ x: Lp.x, y: Lp.y, r: 46, life: 120 });   // 남는 빛
    if (k >= 1) { Lp.st = 'held'; Lp.t = 0; w.events.push({ type: 'lampCatch', x: h.x, y: h.y }); }
  }
}

// 지금 빛이 닿는 곳 (원 목록)
export function lightSources(w) {
  const p = w.player, Lp = p && p.lamp, out = [];
  if (Lp && !(Lp.offT > 0)) {
    const m = lightMul(p);
    if (Lp.st === 'held') {
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      if (shape(p, 'beam')) { out.push({ x: cx + p.face * 50, y: cy, r: L().heldR * m * 0.95, src: 'held' }); out.push({ x: cx - p.face * 10, y: cy, r: L().heldR * m * 0.6, src: 'held' }); }   // 빛줄기: 앞으로 길게, 뒤는 좁게
      else out.push({ x: cx, y: cy, r: L().heldR * m, src: 'held' });
    } else if (Lp.st === 'placed' && shape(p, 'split')) {
      for (const k of [-1, 1]) out.push({ x: Lp.x + k * 62, y: Lp.y, r: 70 * m, src: 'lamp' });   // 갈라지는 빛
    } else out.push({ x: Lp.x, y: Lp.y, r: L().thrownR * m * (Lp.st === 'fly' ? 0.7 : 1), src: 'lamp' });
  }
  for (const t of w.temps || []) out.push({ x: t.x, y: t.y, r: t.r, src: 'temp' });
  for (const o of w.props || []) if (o.kind === 'lamp' && o.lit) out.push({ x: o.x, y: 300 - 30, r: 70, src: 'shrine' });   // 켠 등잔도 둘레를 밝힘
  return out;
}

export function inLight(w, x, y, pad = 0, S = lightSources(w)) {
  for (const s of S) if (Math.hypot(x - s.x, y - s.y) <= s.r + pad) return true;
  return false;
}
export const enemyInLight = (w, e, S) => inLight(w, e.x + e.w / 2, e.y + e.h / 2, Math.min(e.w, e.h) * 0.35, S);

// 매 틱: 그림자 ↔ 실체
export function updateSolidity(w) {
  const S = lightSources(w), p = w.player, LT = L();
  for (const e of w.enemies) {
    if (e.dead) continue;
    if (CFG.legacy || e.dummy || e.update || e.noShadow) { e.solid = true; e.lit = true; e.inLightNow = true; continue; }
    const lit = enemyInLight(w, e, S);
    if (e.boss) { e.solid = true; e.inLightNow = lit; e.lit = lit; continue; }   // 보스: 몸은 늘 실체지만 빛 밖(그림자 부위)은 단단하고, 처형은 빛 안에서만
    if (lit) { e.inT = (e.inT || 0) + 1; e.outT = 0; if (e.inT >= LT.solidInF) e.lit = true; }
    else { e.outT = (e.outT || 0) + 1; e.inT = 0; if (e.outT >= LT.shadowOutF + (p.color === 'wil' ? 60 : 0)) e.lit = false; }   // 성광: 실체화 +1초
    if (e.burnSolidT > 0) e.burnSolidT--;
    const was = !!e.solid; e.solid = !!e.lit || e.burnSolidT > 0;
    e.inLightNow = lit;
    if (e.solid && !was) {
      w.events.push({ type: 'solidify', x: e.x + e.w / 2, y: e.y + e.h / 2 });
      if (p.color === 'fury') for (const o of w.enemies) if (o !== e && !o.dead && !o.solid && Math.hypot(o.x - e.x, o.y - e.y) < 120) o.burnSolidT = Math.max(o.burnSolidT || 0, 60);   // 번개: 곁의 그림자도 함께
    } else if (!e.solid && was) w.events.push({ type: 'shadowed', x: e.x + e.w / 2, y: e.y + e.h / 2 });
    if (lit && p.color === 'str' && w.t % 15 === 0 && !e.boss) e._lightBurn = true;        // 화염: 빛 안 그림자 초당 4 (world가 피해)
    e.lightSlow = lit && p.color === 'agi' ? 0.6 : 1;                                       // 얼음: 빛 안 이동 -40%
    e.ghostBlind = lit && p.color === 'lmp';                                                 // 귀화: 빛 안의 그림자는 리라를 못 봄
  }
}

// 등잔 (설계 2-2~2-4): 빛 조각을 부어 켜면 색 하나 + 빛 모양 하나
export const LAMP_COLORS = {
  str:  { name: '화염', tone: 'amber', ic: 'ember', light: '빛 안의 그림자가 탐 (초당 4)', blade: '3대마다 화상' },
  agi:  { name: '얼음', tone: 'moon', ic: 'shadow', light: '빛 안의 그림자 이동 -40%', blade: '3대마다 빙결' },
  wil:  { name: '성광', tone: 'amber', ic: 'ult', light: '실체화가 1초 더 감', blade: '3대마다 자세 붕괴' },
  lmp:  { name: '귀화', tone: 'void', ic: 'wick', light: '빛 안의 그림자가 리라를 못 봄', blade: '3대마다 눈멂' },
  vit:  { name: '생명', tone: 'heal', ic: 'heart', light: '—', blade: '처형마다 체력 1' },
  fury: { name: '번개', tone: 'amber', ic: 'chain', light: '실체화된 적 곁(120)의 그림자도 함께 실체화', blade: '3대마다 감전' },
};
export const LIGHT_SHAPES = {
  wide:   { name: '넓은 빛', desc: '빛 반경 +20% (최대 3번)', max: 3 },
  long:   { name: '오래 타는 빛', desc: '던진 빛 +3초' },
  split:  { name: '갈라지는 빛', desc: '던지면 반경 70짜리 빛 두 곳', max: 1 },
  beam:   { name: '빛줄기', desc: '든 빛이 앞으로 길게 뻗고 뒤는 좁아짐', max: 1 },
  linger: { name: '남는 빛', desc: '회수하는 길에 빛이 2초 남음', max: 1 },
  follow: { name: '따라오는 빛', desc: '던진 빛이 천천히 리라를 따라옴', max: 1 },
};
export const shrineCost = p => CFG.shrine.cost0 + CFG.shrine.costStep * (p.shrinesLit || 0);
export function shapeChoices(p, rnd = Math.random) {
  const ok = Object.keys(LIGHT_SHAPES).filter(k => ((p.shapes || {})[k] || 0) < (LIGHT_SHAPES[k].max || 99));
  const a = ok.splice((rnd() * ok.length) | 0, 1)[0], b = ok.length ? ok[(rnd() * ok.length) | 0] : null;
  return [a, b].filter(Boolean);
}
export function lightShrine(w, o, color, shapeKey) {
  const p = w.player, c = shrineCost(p); if (o.lit || p.shards < c) return false;
  p.shards -= c; p.shrinesLit = (p.shrinesLit || 0) + 1; o.lit = true;
  if (color) { p.color = color; if (!CFG.legacy) { p.element = color; p.enchantT = 1; } }
  if (shapeKey) p.shapes = { ...(p.shapes || {}), [shapeKey]: ((p.shapes || {})[shapeKey] || 0) + 1 };
  w.events.push({ type: 'shrineLit', x: o.x, y: 270, color: p.color });
  return true;
}
