// 적 공용 상태기계: idle(접근) → telegraph(예고) → active(판정) → recover(후딜) → idle
// 적 객체에는 함수를 넣지 않는다 (structuredClone 가능 = 테스트 봇이 미래를 미리 볼 수 있음)
import { CFG } from './config.js';
import { moveAndCollide } from './player.js';
import { BELL_BOSS, bellMove, bellWant, bellPick, bellActiveStart } from './boss.js';

export const ENEMY_DEFS = {
  ghoul: {
    hp: 30, w: 18, h: 40, speed: 0.8, range: 40, cooldown: [40, 80],
    attacks: { slash: { name: 'slash', telegraphF: 20, activeF: 4, recoverF: 24, dmg: 1, parryable: true, reach: 34 } },
  },
  moth: {
    hp: 12, w: 14, h: 12, speed: 1.2, fly: true, range: 140, cooldown: [60, 110],
    attacks: { dash: { name: 'dash', telegraphF: 18, activeF: 24, recoverF: 30, dmg: 1, parryable: true, dashSpeed: 5 } },
  },
  bellBoss: BELL_BOSS,
};

export function rng(w) {           // 결정적 난수 (월드에 상태 저장)
  w.seed = (w.seed * 1664525 + 1013904223) >>> 0;
  return w.seed / 4294967296;
}

export function spawnEnemy(w, kind, x, y) {
  const d = ENEMY_DEFS[kind];
  const e = {
    kind, x, y, w: d.w, h: d.h, vx: 0, vy: 0, face: -1, onGround: false,
    hp: d.hp, maxHp: d.hp, boss: !!d.boss, poise: 0, poiseMax: !!d.poise, stunT: 0, poiseRegenT: 0,
    st: 'idle', stT: 0, atk: null, srcs: [], cd: 30, hitBy: -1, flash: 0, kvx: 0, staggerT: 0,
    speed: d.speed, range: d.range, forceNext: null, dashDx: 0, dashDy: 0,
  };
  w.enemies.push(e);
  return e;
}

export const telegraphOf = (e, a) => a.telegraphF - (e.boss && e.hp <= e.maxHp / 2 ? 4 : 0);

const onScreen = (w, e) => e.x + e.w > w.camX && e.x < w.camX + CFG.VIEW_W;
const attackers = w => w.enemies.filter(e => !e.boss && !e.dead && (e.st === 'telegraph' || e.st === 'active')).length;

function setSt(e, st) { e.st = st; e.stT = 0; }

export function updateEnemy(w, e) {
  if (Math.abs(e.kvx) > 0.05) {          // 넉백: 벽에 막히면 멈춤
    const x0 = e.x; e.x += e.kvx; e.kvx *= 0.8;
    if (w.solids.some(s => !s.oneWay && e.x < s.x + s.w && e.x + e.w > s.x && e.y < s.y + s.h && e.y + e.h > s.y)) { e.x = x0; e.kvx = 0; }
  } else e.kvx = 0;
  if (e.update) return e.update(w, e);    // 테스트 더미
  const d = ENEMY_DEFS[e.kind], p = w.player;
  const dx = (p.x + p.w / 2) - (e.x + e.w / 2);
  e.stT++;
  if (e.staggerT > 0) { e.staggerT--; if (!d.fly) { e.vx = 0; physics(w, e); } return; }

  if (e.st === 'idle') {
    if (e.cd > 0) e.cd--;
    if (e.kind === 'bellBoss') bellMove(w, e, dx);
    else if (d.fly) mothHover(w, e, dx);
    else walkToward(w, e, dx);
    const want = e.kind === 'bellBoss' ? bellWant(w, e, dx) : Math.abs(dx) < e.range && Math.abs(p.y - e.y) < 90;
    const tokenOk = e.boss || attackers(w) < CFG.enemy.maxAttackers;
    if (e.cd <= 0 && want && tokenOk && onScreen(w, e) && p.state !== 'dead') {
      e.atk = e.kind === 'bellBoss' ? bellPick(w, e, dx) : Object.keys(d.attacks)[0];
      e.face = Math.sign(dx) || e.face;
      setSt(e, 'telegraph');
      w.events.push({ type: 'telegraph', boss: e.boss, parryable: d.attacks[e.atk].parryable });
    }
  } else if (e.st === 'telegraph') {
    if (!d.fly) { e.vx = 0; physics(w, e); }
    if (e.stT >= telegraphOf(e, d.attacks[e.atk])) {
      setSt(e, 'active'); e.srcs = [];
      if (e.atk === 'dash') { const l = Math.hypot(dx, (p.y + 20) - e.y) || 1; e.dashDx = dx / l; e.dashDy = ((p.y + 20) - e.y) / l; }
      if (e.kind === 'bellBoss') bellActiveStart(w, e);
    }
  }
  if (e.st === 'active') {   // 예고가 끝난 그 틱부터 판정
    const a = d.attacks[e.atk], hits = a.hits || 1, gap = a.gapF || 0;
    if (e.atk === 'dash') {
      e.vx = e.dashDx * a.dashSpeed; e.x += e.vx; e.y += e.dashDy * a.dashSpeed;
      if (!e.srcs[0]) e.srcs[0] = {};
      w.hitboxes.push({ src: e.srcs[0], owner: e, x: e.x, y: e.y, w: e.w, h: e.h, dmg: a.dmg, parryable: a.parryable, dir: Math.sign(e.vx) || e.face });
    } else if (a.reach) {
      for (let k = 0; k < hits; k++) {
        const t0 = k * gap;
        if (e.stT >= t0 && e.stT < t0 + a.activeF) {
          if (!e.srcs[k]) e.srcs[k] = {};
          const x = e.face > 0 ? e.x + e.w : e.x - a.reach;
          w.hitboxes.push({ src: e.srcs[k], owner: e, x, y: e.y + e.h - (a.height || e.h), w: a.reach, h: a.height || e.h, dmg: a.dmg, parryable: a.parryable, dir: e.face });
        }
      }
    }
    if (!d.fly) { e.vx = 0; physics(w, e); }
    if (e.stT >= (hits - 1) * gap + a.activeF) setSt(e, 'recover');
  } else if (e.st === 'recover') {
    if (!d.fly) { e.vx = 0; physics(w, e); }
    if (e.stT >= d.attacks[e.atk].recoverF) {
      setSt(e, 'idle');
      const [lo, hi] = d.cooldown; e.cd = lo + Math.floor(rng(w) * (hi - lo));
    }
  }
}

function physics(w, e) {
  e.vy = Math.min(CFG.MAX_FALL, e.vy + CFG.GRAV);
  moveAndCollide(w, e);
}

function walkToward(w, e, dx) {
  e.face = Math.sign(dx) || e.face;
  e.vx = Math.abs(dx) > e.range * 0.6 && Math.abs(dx) < 420 ? e.face * e.speed : 0;
  physics(w, e);
}

function mothHover(w, e, dx) {
  const p = w.player;
  const side = dx > 0 ? -1 : 1;                          // 리라 기준 자기 쪽에 머묾
  const tx = p.x + side * 90, ty = p.y - 50;
  const mx = tx - e.x, my = ty - e.y, l = Math.hypot(mx, my);
  if (l > 4) { e.vx = mx / l * e.speed; e.x += e.vx; e.y += my / l * e.speed; }
  e.y += Math.sin(w.t * 0.1) * 0.3;
  e.face = Math.sign(dx) || e.face;
}
