// 레벨 요소: 수집품(불씨·회복·빛 구슬) · 항아리 · 가시 · 불기둥 분출구 · 움직이는 발판 · 레버와 철문 · 보물 상자 · 방 목표 시간
// 모두 데이터(w.level)로 들고 있고 tick마다 updateLevel. DOM 없음 → Node 테스트 가능
import { CFG } from './config.js?v=mwvmp0sz';
import { overlap } from './player.js?v=mwvmp0sz';

export const LV = {
  pickup: { magnetR: 96, magnetF: 24, life: 1200, grav: 0.35 },
  urn: { w: 22, h: 30 },
  spikes: { h: 12 },
  vent: { period: 260, warnF: 60, fireF: 50, w: 28, h: 120, enemyDmg: 30 },
  mover: { speed: 0.9 },
  chest: { embers: [15, 25] },
  par: { base: 40, perWave: 14 },          // 방 목표 시간(초) = base + 웨이브 수 × perWave
};

const gnd = (w, x) => {                      // x 위치의 바닥 높이 (언덕 포함)
  let y = 300;
  for (const s of w.solids) if (!s.oneWay && s.h > 8 && s.y >= 180 && x >= s.x && x <= s.x + s.w) y = Math.min(y, s.y);
  return y;
};

export function initLevel(w) {
  w.level = w.level || { pickups: [], urns: [], spikes: [], vents: [], movers: [], levers: [], gates: [], chests: [] };
  return w.level;
}

// 수집품 떨구기: kind = 'ember'(불씨, 점수·화폐) | 'heal'(체력 1) | 'light'(빛 +35)
export function dropPickups(w, x, y, n, kind = 'ember') {
  const L = initLevel(w);
  for (let i = 0; i < n; i++) {
    w.seed = (w.seed * 1664525 + 1013904223) >>> 0; const r = w.seed / 4294967296;
    L.pickups.push({ kind, x: x - 4, y: y - 4, w: 8, h: 8, vx: (r - 0.5) * 3, vy: -3 - r * 2, t: 0 });
  }
}

// 리라 공격이 닿은 레벨 오브젝트 (항아리 깨기 · 레버 당기기 · 상자 열기). 휘두를 때 한 번
export function hitLevel(w, box) {
  const L = w.level; if (!L) return;
  for (const u of L.urns) if (!u.broken && overlap(box, u)) {
    u.broken = true; w.events.push({ type: 'urnBreak', x: u.x + u.w / 2, y: u.y + u.h / 2 });
    dropPickups(w, u.x + u.w / 2, u.y + 6, u.loot === 'heal' || u.loot === 'light' ? 1 : 2 + (u.x % 3), u.loot || 'ember');
  }
  for (const v of L.levers) if (!v.on && overlap(box, { x: v.x - 12, y: v.y - 30, w: 24, h: 30 })) {
    v.on = true; w.events.push({ type: 'lever', x: v.x, y: v.y });
    for (const g of L.gates) if (g.id === v.gate) { g.open = true; g.t = 0; w.events.push({ type: 'gateOpen', x: g.x, y: g.y }); }
  }
  for (const c of L.chests) if (!c.open && overlap(box, { x: c.x - 16, y: c.y - 26, w: 32, h: 26 })) {
    c.open = true; w.events.push({ type: 'chestOpen', x: c.x, y: c.y - 14 });
    const [lo, hi] = LV.chest.embers; dropPickups(w, c.x, c.y - 20, 6, 'ember'); dropPickups(w, c.x, c.y - 20, 1, 'heal'); dropPickups(w, c.x, c.y - 20, 1, 'light');
    c.bonus = lo + ((c.x * 7) % (hi - lo + 1)); w.events.push({ type: 'chestEmbers', n: c.bonus });
  }
}

export function updateLevel(w, damageEnemy) {
  const L = w.level; if (!L) return;
  const p = w.player, P = LV.pickup, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  // 수집품: 튀어 오른 뒤 바닥에 멈추고, 잠시 뒤 가까우면 리라에게 빨려 온다
  for (const q of L.pickups) {
    q.t++;
    const dx = cx - (q.x + 4), dy = cy - (q.y + 4), d = Math.hypot(dx, dy);
    if (q.t > P.magnetF && d < P.magnetR && p.state !== 'dead') { q.vx = dx / d * 5; q.vy = dy / d * 5; q.x += q.vx; q.y += q.vy; }
    else {
      q.vy = Math.min(6, q.vy + P.grav); q.x += q.vx; q.y += q.vy; q.vx *= 0.96;
      const g = gnd(w, q.x + 4); if (q.y + 8 > g) { q.y = g - 8; q.vy = -q.vy * 0.35; q.vx *= 0.7; if (Math.abs(q.vy) < 0.6) q.vy = 0; }
      q.x = Math.max(4, Math.min(w.width - 12, q.x));
    }
    if (q.t > 10 && overlap(q, p)) { q.got = true; w.events.push({ type: 'pickup', kind: q.kind, x: q.x + 4, y: q.y + 4 });
      if (q.kind === 'heal' && p.hp < p.maxHp) { const h0 = p.hp; p.hp++; w.events.push({ type: 'heal', amount: 1, from: h0, x: cx, y: p.y + p.h }); }
      if (q.kind === 'light') p.light = Math.min(CFG.light.max, p.light + 15); }
    if (q.t > P.life) q.got = true;
  }
  L.pickups = L.pickups.filter(q => !q.got);
  // 가시: 밟으면 피해 1 + 튕겨 오름 (구르기 무적·피격 무적이면 무시)
  for (const s of L.spikes) w.hitboxes.push({ src: {}, owner: null, x: s.x, y: 300 - LV.spikes.h, w: s.w, h: LV.spikes.h, dmg: 1, parryable: false, dir: 1, hazard: 'spikes' });
  // 불기둥 분출구: 대기 → 연기 예고 → 분출 (리라와 적 모두 맞음)
  for (const v of L.vents) {
    const T = (w.t + v.off) % LV.vent.period, warn = LV.vent.period - LV.vent.warnF - LV.vent.fireF;
    v.st = T < warn ? 'idle' : T < warn + LV.vent.warnF ? 'warn' : 'fire';
    if (T === warn + LV.vent.warnF - 30) w.events.push({ type: 'ventFire', x: v.x });   // 불기둥 그림이 솟는 데 걸리는 시간만큼 먼저 띄움
    if (v.st === 'fire') {
      if (T === warn + LV.vent.warnF) { v.src = {}; v.hit = []; }
      const box = { x: v.x - LV.vent.w / 2, y: 300 - LV.vent.h, w: LV.vent.w, h: LV.vent.h };
      w.hitboxes.push({ src: v.src || {}, owner: null, ...box, dmg: 1, parryable: false, dir: 1, hazard: 'vent' });
      for (const e of w.enemies) if (!e.dead && !e.boss && !(e.spawnT > 0) && !v.hit.includes(e) && overlap(box, e)) { v.hit.push(e); damageEnemy(w, e, LV.vent.enemyDmg, 0.2); w.events.push({ type: 'attackHit', x: e.x + e.w / 2, y: e.y + e.h / 2, combo: 0, face: 1, dmg: LV.vent.enemyDmg, crit: false, spell: 'vent' }); }
    }
  }
  // 움직이는 발판: 좌우 왕복, 위에 선 리라를 함께 옮김
  for (const m of L.movers) {
    const s = m.solid, dx = m.dir * LV.mover.speed;
    const on = p.onGround && Math.abs(p.y + p.h - s.y) <= 1 && p.x + p.w > s.x && p.x < s.x + s.w;
    s.x += dx; if (s.x <= m.x0 || s.x >= m.x1) m.dir *= -1;
    if (on) p.x += dx;
  }
  // 철문: 열리면 위로 올라가고 판정(solid)이 사라짐
  for (const g of L.gates) if (g.open && g.solid) { g.t++; g.lift = (g.lift || 0) + 4; if (g.t > 34) { w.solids.splice(w.solids.indexOf(g.solid), 1); g.solid = null; } }
}

// 방 목표 시간 (초). 전투·강적 방에서 이 안에 정리하면 보너스
export const parTime = w => LV.par.base + (w.waveCount || 2) * LV.par.perWave;

// 전투방에 레벨 요소 배치. lvl = 지역(1~4), idx = 지역 안 방 번호, rnd = 0~1 난수 함수, plats = 통과 발판 목록
export function populateArena(w, lvl, idx, rnd, tutorial = false) {
  const L = initLevel(w), W = w.width, ground = x => gnd(w, x);
  const free = (x, wd) => x > 200 && x + wd < W - 140 && !L.spikes.some(s => x < s.x + s.w + 60 && x + wd > s.x - 60) && !L.vents.some(v => Math.abs(v.x - (x + wd / 2)) < 80) && ground(x) === 300 && ground(x + wd) === 300;
  // 항아리: 바닥·언덕 곳곳 (4개 중 하나는 회복 또는 빛)
  const nUrn = tutorial ? 3 : 3 + ((rnd() * 3) | 0);
  for (let i = 0; i < nUrn; i++) {
    const x = 160 + rnd() * (W - 360), g = ground(x);
    L.urns.push({ x: Math.round(x), y: g - LV.urn.h, w: LV.urn.w, h: LV.urn.h, loot: i === nUrn - 1 ? (rnd() < 0.5 ? 'heal' : 'light') : 'ember' });   // 마지막 하나만 회복·빛
  }
  if (tutorial) return L;
  // 불기둥 분출구: 지역 2부터
  const nVent = lvl >= 2 ? Math.min(3, lvl - 1) : 0;   // 분출구를 먼저 (가시가 자리를 다 차지하지 않게)
  for (let i = 0, tries = 0; i < nVent && tries < 60; tries++) {
    const x = Math.round(300 + rnd() * (W - 600));
    if (free(x - 20, 40)) { L.vents.push({ x, off: (i * 97 + ((rnd() * 200) | 0)) % LV.vent.period, st: 'idle' }); i++; }
  }
  // 가시: 지역 1 두 번째 방부터, 지역이 깊을수록 많이
  const nSpike = lvl === 1 ? (idx > 0 ? 1 : 0) : Math.min(3, lvl);
  for (let i = 0, tries = 0; i < nSpike && tries < 40; tries++) {
    const wd = 48 + ((rnd() * 3) | 0) * 16, x = Math.round(240 + rnd() * (W - 480));
    if (free(x, wd)) { L.spikes.push({ x, w: wd }); i++; }
  }
  // 움직이는 발판: 지역 3부터 (높은 곳의 항아리로)
  if (lvl >= 3) {
    const x0 = Math.round(W * 0.35), s = { x: x0, y: 192, w: 72, h: 8, oneWay: true, mover: true };
    w.solids.push(s); L.movers.push({ solid: s, x0, x1: x0 + 220, dir: 1 });
    L.urns.push({ x: x0 + 260, y: 120 - LV.urn.h, w: LV.urn.w, h: LV.urn.h, loot: 'light', high: true });
    w.solids.push({ x: x0 + 250, y: 120, w: 60, h: 8, oneWay: true });   // 높은 선반 (움직이는 발판으로만 닿음)
  }
  // 레버와 철문: 지역 2부터 절반 확률 (지역 4는 항상). 방 왼쪽 끝 작은 방에 보물 상자
  // 철문 판정은 천장까지 (위로 넘어가지 못하게), 그림은 아래 140px
  if (lvl >= 2 && (lvl >= 4 || rnd() < 0.6)) {
    const plats = w.solids.filter(s => s.oneWay && !s.mover && s.x > 260 && s.x + s.w < W - 260 && s.y > 150);
    if (rnd() < 0.55 || !plats.length) {                                 // 왼쪽 금고: 문·상자 자리가 방마다 다름, 레버는 발판 위나 바닥 아무 곳
      const gx = 110 + ((rnd() * 110) | 0), gate = { x: gx, y: 0, w: 16, h: 300, gate: true };
      w.solids.push(gate);
      L.gates.push({ id: 1, x: gx + 8, y: 300, solid: gate, open: false, t: 0 });
      L.chests.push({ x: 40 + ((rnd() * Math.max(1, gx - 80)) | 0), y: 300, open: false });
      const plat = plats.length && rnd() < 0.6 ? plats[(rnd() * plats.length) | 0] : null;
      const lx = plat ? Math.round(plat.x + 12 + rnd() * (plat.w - 24)) : Math.round(W * (0.3 + rnd() * 0.45));
      L.levers.push({ x: lx, y: plat ? plat.y : ground(lx), on: false, gate: 1 });
    } else {                                                             // 문 없이: 높은 발판 위에 상자 (점프로 올라가 열기)
      const pl = plats[(rnd() * plats.length) | 0];
      L.chests.push({ x: Math.round(pl.x + 18 + rnd() * Math.max(1, pl.w - 36)), y: pl.y, open: false });
    }
  }
  return L;
}
