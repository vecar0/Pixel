// 모든 수치는 여기 한 곳에. 시간 단위는 틱(1/60초), 거리 단위는 px.
export const CFG = {
  TICK: 60,
  VIEW_W: 640, VIEW_H: 360, VIEW_W_MAX: 780,
  // 리라 72px 그림에 맞춰 전체 스케일 약 1.33배 (점프 체공 시간은 그대로)
  GRAV: 0.43,          // px/틱²
  MAX_FALL: 10.5,
  FALL_MULT: 1.6,     // 떨어질 때 중력 배수 → 점프가 묵직하고 시원하게

  player: {
    speed: 3.2,        // 192px/s
    accelF: 2, decelF: 2,
    jumpMaxH: 96,
    coyoteF: 6, bufferF: 12,
    hp: 5, iframesHurt: 60, hurtStunF: 14,
    w: 22, h: 62,       // 리라 '검은 순례자' 그림(80x85)에 맞춘 몸통 판정
  },
  attack: { dmg: [10, 10, 18], startupF: 7, activeF: 4, recoveryF: 16, range: 38, comboWindowF: 18, hitstop: [4, 4, 7], push: [4, 4, 6.5], lunge: 2.1 },
  parry: {
    perfectF: 6, normalF: 12, whiffF: 18, successRecoverF: 4, reach: 40,
    hitstopPerfect: 8, hitstopNormal: 3, staggerF: 30, staggerPush: 8,
  },
  roll: { totalF: 22, dist: 128, iStart: 2, iEnd: 13, endLagF: 6 },
  poise: { perfect: 0.25, normal: 0.08, hit: 0.02, stunF: 180, mobStunF: 150, mobRes: 1.6, regenDelayF: 120, regenPerF: 0.002, executeFrac: 0.15 },   // mob*: 일반 적 그로기 (더 잘 무너지고 2.5초)
  execute: { hitF: 22, totalF: 42, slow: 0.35 },   // 처형 모션: 22틱째에 베고 42틱에 끝, 그동안 시간 0.35배
  light: { max: 100, perfect: 25, normal: 10, kill: 3 },
  // 등불 마법 (빛 게이지 소모, 1칸). homing = 가까운 적을 쫓아감. delay = pixelfx 이펙트의 착탄 시점(틱)에 맞춘 피해 지연. inv = 시전 중 무적
  skill: {
    bolt:    { homing: true, cost: 20, castF: 14, fireF: 6, dmg: 20, speed: 7, poise: 0.12 },
    lance:   { homing: true, cost: 30, castF: 16, fireF: 6, dmg: 25, speed: 8, poise: 0.2 },
    pillar:  { cost: 40, castF: 18, fireF: 6, dmg: 45, range: 360, radius: 40, delay: 33, poise: 0.3 },
    thunder: { cost: 45, castF: 18, fireF: 6, dmg: 56, range: 420, radius: 50, delay: 46, poise: 0.5 },
    stars:   { cost: 50, castF: 22, fireF: 8, dmg: 42, ahead: 140, radius: 110, delay: 30, poise: 0.25 },
    meteor:  { inv: true, cost: 60, castF: 24, fireF: 8, dmg: 70, range: 420, radius: 80, delay: 37, poise: 0.4 },
    ring:    { inv: true, cost: 55, castF: 24, fireF: 8, dmg: 50, radius: 150 },
    ward:    { inv: true, cost: 45, castF: 24, fireF: 8, dmg: 20, radius: 120, blueF: 300 },
    spear:   { inv: true, cost: 55, castF: 24, fireF: 8, dmg: 56, len: 320, poise: 0.4 },
    chain:   { cost: 40, castF: 18, fireF: 7, dmg: 28, range: 240, n: 3, poise: 0.2 },
    blast:   { inv: true, cost: 60, castF: 24, fireF: 8, dmg: 70, range: 420, radius: 90, delay: 31, poise: 0.4 },
    heal:    { cost: 50, castF: 26, fireF: 12, heal: 2 },
    sanctum: { inv: true, cost: 60, castF: 26, fireF: 10, dmg: 39, radius: 120, heal: 1, poise: 0.3 },
  },
  flask: { charges: 3, useF: 40, heal: 2 },
  enemy: { minTelegraphF: 18, bossMinTelegraphF: 14, multiHitGapF: 16, maxAttackers: 2, tempo: 1.25, aggro: 1800 },   // aggro: 이 거리 안이면 리라를 쫓아옴 (방 전체)   // tempo: 적 공격 템포 배율 (예고·후딜·다음 공격까지, 클수록 느림)
  loop: { maxStepsPerFrame: 5 },
};
