// 모든 수치는 여기 한 곳에. 시간 단위는 틱(1/60초), 거리 단위는 px.
export const CFG = {
  TICK: 60,
  VIEW_W: 640, VIEW_H: 360, VIEW_W_MAX: 900,   // 폭이 넓은 폰(2.2:1 이상)도 양옆 검은 띠 없이
  // 리라 72px 그림에 맞춰 전체 스케일 약 1.33배 (점프 체공 시간은 그대로)
  GRAV: 0.43,          // px/틱²
  MAX_FALL: 10.5,
  FALL_MULT: 1.6,     // 떨어질 때 중력 배수 → 점프가 묵직하고 시원하게

  player: {
    speed: 3.2,        // 192px/s
    accelF: 2, decelF: 2,
    jumpMaxH: 112,
    coyoteF: 6, bufferF: 12,
    hp: 5, iframesHurt: 60, hurtStunF: 14,
    w: 22, h: 62,       // 리라 '검은 순례자' 그림(80x85)에 맞춘 몸통 판정
  },
  attack: { dmg: [10, 10, 18], startupF: 7, activeF: 4, recoveryF: 16, range: 38, comboWindowF: 18, hitstop: [4, 4, 7], push: [4, 4, 6.5], lunge: 2.1 },
  parry: {
    perfectF: 6, normalF: 12, whiffF: 18, successRecoverF: 4, reach: 40, projReach: 30, projPad: 14,   // projReach/Pad: 탄을 패링으로 받는 앞쪽·위아래 여유(px)
    hitstopPerfect: 8, hitstopNormal: 3, staggerF: 30, staggerPush: 8,
  },
  roll: { totalF: 22, dist: 128, iStart: 2, iEnd: 13, endLagF: 6 },
  poise: { perfect: 0.25, normal: 0.08, hit: 0.02, stunF: 180, mobStunF: 150, mobRes: 1.6, regenDelayF: 120, regenPerF: 0.002, executeFrac: 0.15 },   // mob*: 일반 적 그로기 (더 잘 무너지고 2.5초)
  execute: { hitF: 22, totalF: 42, slow: 0.35, chainF: 300, chainLight: 20, chainRange: 340, chainGapF: 6, chainHitF: 14, chainTotalF: 34 },   // chainRange 안에 그로기 적이 또 있으면 이어서 연속 처형 (돌진 베기)   // chainF: 이 틱 안에 다음 처형 → 연속 처형 보너스
  flurry: { window: 45, hits: [12, 20, 28, 40], activeF: 4, totalF: 50, iEnd: 42, range: 56, dmg: [10, 10, 10, 24], poise: [0.08, 0.08, 0.08, 0.3], hitstop: [3, 3, 3, 10], lunge: 2.6 },   // 완벽 패링 직후 공격 = 반격 연참 (앞으로 파고들며 4연속 베기, 마지막 일격이 큼, 도는 동안 무적)
  light: { max: 100, perfect: 25, normal: 10, kill: 3 },
  // 등불 마법 (빛 게이지 소모, 1칸). homing = 가까운 적을 쫓아감. delay = pixelfx 이펙트의 착탄 시점(틱)에 맞춘 피해 지연. inv = 시전 중 무적
  // 소등: 등불을 끄면 어둠 (적이 리라를 놓침, 등 뒤 공격 = 암살, 빛이 고임). 다시 켤 때(relightF 동안 무방비) 섬광 — 점화한 상태면 속성 섬광
  snuff: { maxF: 240, regen: 0.15, relightF: 22, cdF: 150, flashR: 120, flashStagger: 40, noiseRun: 150, noiseAtk: 210 },
  enchant: { cost: 10, swingCost: 5, dmgMul: 1.12, build: [22, 22, 36], flurryBuild: 14, need: [130, 100, 85, 70], needBoss: 260 },   // need: 단계별 필요량 (0 각성 전 · 1 각성 14 · 2 17 · 3 20)   // 불꽃 점화: 빛 10 이상이면 점화(공짜), 휘두를 때마다 빛 5, 베기 피해 +12%, 타마다 속성 게이지
  skill: {   // 위력: 처음 값의 1.4배 (화려한 연출과 함께 상향)
    enchant: { cost: 30, castF: 40, fireF: 26, dmg: 0 },   // 점화 동작: 칼을 등불에 대고(0~13) 불이 번져(14~25) 타오르는 칼로 자세(26~40). fireF에 점화 완성   // 점화 동작 (시전 자세)
    bolt:    { homing: true, cost: 20, castF: 14, fireF: 6, dmg: 28, speed: 7, poise: 0.12 },
    lance:   { homing: true, cost: 30, castF: 16, fireF: 6, dmg: 35, speed: 8, poise: 0.2 },
    pillar:  { cost: 40, castF: 18, fireF: 6, dmg: 63, range: 360, radius: 46, delay: 33, poise: 0.3 },
    thunder: { cost: 45, castF: 18, fireF: 6, dmg: 78, range: 420, radius: 56, delay: 46, poise: 0.5 },
    stars:   { cost: 50, castF: 22, fireF: 8, dmg: 34, ahead: 140, radius: 56, delay: 34, poise: 0.15, ticks: [0, -70, 70], gap: 8 },   // 고드름 3개: 표적 기준 x 오프셋, gap틱 간격
    tornado: { cost: 45, castF: 20, fireF: 7, dmg: 28, range: 400, radius: 64, delay: 18, poise: 0.12, ticks: [0, 0, 0], gap: 22 },
    spikes:  { cost: 40, castF: 18, fireF: 6, dmg: 53, line: 250, delay: 10, poise: 0.3 },
    smite:   { cost: 45, castF: 18, fireF: 6, dmg: 70, range: 420, radius: 70, delay: 24, poise: 0.55 },
    wisps:   { homing: true, cost: 40, castF: 16, fireF: 6, dmg: 25, speed: 6, n: 3, poise: 0.1 },
    thorns:  { cost: 40, castF: 18, fireF: 6, dmg: 45, line: 260, delay: 12, poise: 0.6 },
    drain:   { cost: 45, castF: 18, fireF: 6, dmg: 56, range: 260, heal: 1, poise: 0.25 },
    meteor:  { inv: true, cost: 60, castF: 24, fireF: 8, dmg: 98, range: 420, radius: 95, delay: 37, poise: 0.4 },
    ring:    { inv: true, cost: 55, castF: 24, fireF: 8, dmg: 70, radius: 175 },
    ward:    { inv: true, cost: 45, castF: 24, fireF: 8, dmg: 28, radius: 135, blueF: 300 },
    spear:   { inv: true, cost: 55, castF: 24, fireF: 8, dmg: 78, len: 320, poise: 0.4 },
    chain:   { cost: 40, castF: 18, fireF: 7, dmg: 39, range: 240, n: 3, poise: 0.2 },
    blast:   { inv: true, cost: 60, castF: 24, fireF: 8, dmg: 98, range: 420, radius: 105, delay: 31, poise: 0.4 },
    heal:    { cost: 50, castF: 26, fireF: 12, heal: 3 },
    sanctum: { inv: true, cost: 60, castF: 26, fireF: 10, dmg: 55, radius: 135, heal: 2, poise: 0.3 },
  },
  flask: { charges: 3, useF: 40, heal: 2 },
  enemy: { minTelegraphF: 18, bossMinTelegraphF: 14, multiHitGapF: 16, maxAttackers: 2, tempo: 1.25, aggro: 1800 },   // aggro: 이 거리 안이면 리라를 쫓아옴 (방 전체)   // tempo: 적 공격 템포 배율 (예고·후딜·다음 공격까지, 클수록 느림)
  loop: { maxStepsPerFrame: 5 },
};
