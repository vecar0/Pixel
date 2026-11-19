// 테스트 공용: 입력 만들기, N틱 진행
import { tick, EMPTY_INPUT } from '../js/core/world.js';
export const I = (o = {}) => ({ ...EMPTY_INPUT, ...o });
export function steps(w, n, inp = {}) { for (let i = 0; i < n; i++) tick(w, I(inp)); }
// 평평한 바닥만 있는 테스트 월드용 지형
export const FLAT = [{ x: -1000, y: 300, w: 4000, h: 40 }];

// 테스트용 더미 적: w.t가 hits[] 중 하나일 때 리라 몸에 1틱짜리 공격 히트박스를 낸다
export function makeDummy(w, { hits = [], parryable = true, behind = false, poise = false, hp = 100, dmg = 1, projectile = false } = {}) {
  const p = w.player;
  const e = {
    kind: 'dummy', x: p.x + (behind ? -40 : 30), y: p.y, w: 16, h: 40, face: behind ? 1 : -1,
    hp, maxHp: hp, poise: 0, poiseMax: poise, stunT: 0, poiseRegenT: 0, hitBy: -1,
    update(w, e) {
      if (!hits.includes(w.t)) return;
      const dir = Math.sign((p.x + p.w / 2) - (e.x + e.w / 2)) || 1;
      if (projectile) {
        w.projectiles.push({ x: p.x + p.w / 2 - 3, y: p.y + 10, w: 6, h: 6, vx: 3 * dir, vy: 0, dmg, parryable, owner: 'enemy', life: 60, src: e });
      } else {
        w.hitboxes.push({ src: {}, owner: e, x: p.x - 2, y: p.y, w: p.w + 4, h: p.h, dmg, parryable, dir });
      }
    },
  };
  w.enemies.push(e);
  return e;
}
