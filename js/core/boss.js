// 간이 보스: 무덤종 (종을 든 묘지기 거인)
// 패턴: 종 휘두르기 / 2연 휘두르기 / 내려찍기 충격파(패링 불가). 체력 50% 이하에서 예고 -4f
export const BELL_BOSS = {
  hp: 600, w: 76, h: 110, speed: 0.95, range: 150, boss: true, poise: true, cooldown: [30, 60],
  attacks: {
    swing: { name: 'swing', telegraphF: 24, activeF: 6, recoverF: 30, dmg: 1, parryable: true, reach: 95, height: 84 },
    double: { name: 'double', telegraphF: 20, activeF: 5, recoverF: 30, dmg: 1, parryable: true, reach: 95, height: 84, hits: 2, gapF: 16 },
    slam: { name: 'slam', telegraphF: 30, activeF: 6, recoverF: 40, dmg: 2, parryable: false, wave: { w: 22, h: 18, speed: 4, life: 140 } },
  },
};

import { rng } from './enemies.js';
import { moveAndCollide } from './player.js';
import { CFG } from './config.js';

export function bellMove(w, e, dx) {
  e.face = Math.sign(dx) || e.face;
  e.vx = Math.abs(dx) > 120 ? e.face * e.speed : 0;
  e.vy = Math.min(CFG.MAX_FALL, e.vy + CFG.GRAV);
  moveAndCollide(w, e);
}

export const bellWant = (w, e, dx) => !!e.forceNext || Math.abs(dx) < e.range || rng(w) < 0.01;

export function bellPick(w, e, dx) {
  if (e.forceNext) return e.forceNext;
  if (Math.abs(dx) >= e.range) return 'slam';
  const r = rng(w);
  return r < 0.45 ? 'swing' : r < 0.8 ? 'double' : 'slam';
}

// 내려찍기: 양쪽으로 바닥을 타고 퍼지는 충격파 2개
export function bellActiveStart(w, e) {
  const a = BELL_BOSS.attacks[e.atk];
  if (!a.wave) return;
  const floorY = e.y + e.h, cx = e.x + e.w / 2;
  for (const dir of [-1, 1]) {
    w.projectiles.push({
      x: cx + dir * (e.w / 2) - (dir < 0 ? a.wave.w : 0), y: floorY - a.wave.h, w: a.wave.w, h: a.wave.h,
      vx: dir * a.wave.speed, vy: 0, dmg: a.dmg, parryable: false, owner: 'enemy', life: a.wave.life, src: e, wave: true,
    });
  }
  w.shake = 10;
  w.events.push({ type: 'slam' });
}
