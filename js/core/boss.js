// 보스 4종. 공격은 enemies.js의 공용 공격 종류를 데이터로 조합한다.
// 모든 보스: 체력 50% 이하에서 예고 -4f (보스 최소 14f 보장), 판마다 변형 패턴 1개(variant)가 섞인다.
export const BOSSES = {
  // 지역 1: 무덤종 — 종을 든 묘지기 거인
  bellBoss: {
    name: '무덤종', hp: 600, w: 96, h: 150, speed: 0.95, range: 150, boss: true, poise: true, cooldown: [30, 60],
    near: ['swing', 'double', 'slam'], far: ['slam'], variants: ['sweep', 'toll', 'charge'],
    attacks: {
      swing: { name: 'swing', telegraphF: 24, activeF: 6, recoverF: 30, dmg: 1, parryable: true, reach: 95, height: 84 },
      double: { name: 'double', telegraphF: 20, activeF: 5, recoverF: 30, dmg: 1, parryable: true, reach: 95, height: 84, hits: 2, gapF: 16 },
      slam: { name: 'slam', telegraphF: 30, activeF: 6, recoverF: 40, dmg: 1, parryable: false, wave: { w: 22, h: 18, speed: 4, life: 140 } },
      sweep: { name: 'sweep', telegraphF: 28, activeF: 6, recoverF: 36, dmg: 1, parryable: true, reach: 150, height: 60 },
      toll: { name: 'toll', telegraphF: 26, activeF: 1, recoverF: 40, dmg: 1, parryable: true, hits: 3, gapF: 18, bolt: { speed: 2.6, w: 14, h: 14 } },
      charge: { name: 'charge', telegraphF: 28, activeF: 26, recoverF: 40, dmg: 1, parryable: true, charge: 5 },
    },
  },
  // 지역 2: 침수 성녀 — 물창 투척(완벽 패링 시 반사), 밀물(패링 불가), 2페이즈 3연 돌진
  saint: {
    name: '침수 성녀', hp: 700, w: 34, h: 88, speed: 1.2, range: 260, boss: true, poise: true, cooldown: [30, 55],
    near: ['spear', 'lance', 'tide'], far: ['spear', 'tide'], phase2: ['rush'], variants: ['rain', 'lance2', 'spear3'],
    attacks: {
      spear: { name: 'spear', telegraphF: 22, activeF: 1, recoverF: 34, dmg: 1, parryable: true, bolt: { speed: 5, w: 26, h: 8 } },
      lance: { name: 'lance', telegraphF: 20, activeF: 5, recoverF: 28, dmg: 1, parryable: true, reach: 70, height: 26 },
      tide: { name: 'tide', telegraphF: 32, activeF: 6, recoverF: 44, dmg: 1, parryable: false, wave: { w: 26, h: 24, speed: 3.6, life: 160 } },
      rush: { name: 'rush', telegraphF: 22, activeF: 20, recoverF: 30, dmg: 1, parryable: true, charge: 6.5 },
      rain: { name: 'rain', telegraphF: 30, activeF: 1, recoverF: 40, dmg: 1, parryable: true, rain: { n: 3, gap: 60, speed: 4 } },
      lance2: { name: 'lance2', telegraphF: 20, activeF: 4, recoverF: 30, dmg: 1, parryable: true, reach: 70, height: 26, hits: 2, gapF: 16 },
      spear3: { name: 'spear3', telegraphF: 24, activeF: 1, recoverF: 40, dmg: 1, parryable: true, hits: 3, gapF: 16, bolt: { speed: 4.4, w: 26, h: 8 } },
    },
  },
  // 지역 3: 유리 여왕거미 — 수정 광선(패링 불가 → 회피), 다리 찌르기, 천장 파편
  spider: {
    name: '유리 여왕거미', hp: 800, w: 190, h: 120, speed: 0.8, range: 180, boss: true, poise: true, cooldown: [30, 60],
    near: ['stab', 'stab2', 'beam'], far: ['beam', 'shards'], phase2: ['shards'], variants: ['ring', 'stab3', 'beam2'],
    attacks: {
      stab: { name: 'stab', telegraphF: 20, activeF: 5, recoverF: 28, dmg: 1, parryable: true, reach: 80, height: 50 },
      stab2: { name: 'stab2', telegraphF: 22, activeF: 4, recoverF: 32, dmg: 1, parryable: true, reach: 80, height: 50, hits: 2, gapF: 16 },
      beam: { name: 'beam', telegraphF: 34, activeF: 12, recoverF: 40, dmg: 1, parryable: false, beam: { len: 560, h: 22, y: 76 } },
      shards: { name: 'shards', telegraphF: 30, activeF: 1, recoverF: 40, dmg: 1, parryable: true, rain: { n: 3, gap: 70, speed: 4.5 } },
      ring: { name: 'ring', telegraphF: 30, activeF: 6, recoverF: 40, dmg: 1, parryable: false, ring: 50 },
      stab3: { name: 'stab3', telegraphF: 24, activeF: 4, recoverF: 36, dmg: 1, parryable: true, reach: 80, height: 50, hits: 3, gapF: 16 },
      beam2: { name: 'beam2', telegraphF: 30, activeF: 18, recoverF: 44, dmg: 1, parryable: false, beam: { len: 560, h: 22, y: 22 } },
    },
  },
  // 지역 4: 흑염의 순례자 — 리라의 그림자. 리라의 공격을 패링하고 반격한다
  shadow: {
    name: '흑염의 순례자', hp: 650, w: 22, h: 62, speed: 2.2, range: 70, boss: true, poise: true, counter: true, cooldown: [24, 46],
    near: ['slash3', 'dashcut', 'slash'], far: ['dashcut', 'flame'], phase2: ['nova'], variants: ['slash4', 'flame3', 'dash2'],
    attacks: {
      slash: { name: 'slash', telegraphF: 18, activeF: 4, recoverF: 22, dmg: 1, parryable: true, reach: 44 },
      slash3: { name: 'slash3', telegraphF: 18, activeF: 4, recoverF: 30, dmg: 1, parryable: true, reach: 44, hits: 3, gapF: 16 },
      dashcut: { name: 'dashcut', telegraphF: 20, activeF: 18, recoverF: 30, dmg: 1, parryable: true, charge: 7 },
      flame: { name: 'flame', telegraphF: 22, activeF: 1, recoverF: 34, dmg: 1, parryable: true, bolt: { speed: 4.6, w: 16, h: 16 } },
      counter: { name: 'counter', telegraphF: 18, activeF: 4, recoverF: 24, dmg: 1, parryable: true, reach: 48 },
      nova: { name: 'nova', telegraphF: 30, activeF: 6, recoverF: 44, dmg: 1, parryable: false, ring: 70 },
      slash4: { name: 'slash4', telegraphF: 18, activeF: 4, recoverF: 34, dmg: 1, parryable: true, reach: 44, hits: 4, gapF: 16 },
      flame3: { name: 'flame3', telegraphF: 24, activeF: 1, recoverF: 40, dmg: 1, parryable: true, hits: 3, gapF: 16, bolt: { speed: 4.2, w: 16, h: 16 } },
      dash2: { name: 'dash2', telegraphF: 22, activeF: 30, recoverF: 36, dmg: 1, parryable: true, charge: 6 },
    },
  },
};

import { rng } from './enemies.js?v=mwp8y0i4';

export const bossWant = (w, e, dx) => !!e.forceNext || Math.abs(dx) < BOSSES[e.kind].range || rng(w) < 0.012;

export function bossPick(w, e, dx) {
  if (e.forceNext) return e.forceNext;
  if (e.veil && Math.abs(dx) > 60 && rng(w) < 0.6) return rng(w) < 0.5 ? 'spear' : 'spear3';   // 장막을 두르면 물창을 더 자주 (되돌릴 기회)
  const B = BOSSES[e.kind], far = Math.abs(dx) >= B.range;
  let pool = [...(far ? B.far : B.near)];
  if (e.hp <= e.maxHp / 2 && B.phase2) pool.push(...B.phase2);
  if (e.variant) pool.push(e.variant);
  return pool[(rng(w) * pool.length) | 0];
}
