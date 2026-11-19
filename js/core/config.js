// 모든 수치는 여기 한 곳에. 시간 단위는 틱(1/60초), 거리 단위는 px.
export const CFG = {
  TICK: 60,
  VIEW_W: 640, VIEW_H: 360, VIEW_W_MAX: 780,
  GRAV: 0.32,          // px/틱²
  MAX_FALL: 8,
  FALL_MULT: 1.6,     // 떨어질 때 중력 배수 → 점프가 묵직하고 시원하게

  player: {
    speed: 2.5,        // 150px/s
    accelF: 2, decelF: 2,
    jumpMaxH: 72,
    coyoteF: 6, bufferF: 8,
    hp: 5, iframesHurt: 60, hurtStunF: 14,
    w: 14, h: 40,
  },
  attack: { dmg: [10, 10, 18], startupF: 4, activeF: 3, recoveryF: 10, range: 28, comboWindowF: 14, hitstop: [4, 4, 7], push: [3, 3, 5], lunge: 1.6 },
  parry: {
    perfectF: 6, normalF: 12, whiffF: 18, successRecoverF: 4, reach: 40,
    hitstopPerfect: 8, hitstopNormal: 3, staggerF: 30, staggerPush: 6,
  },
  roll: { totalF: 22, dist: 96, iStart: 2, iEnd: 13, endLagF: 6 },
  poise: { perfect: 0.25, normal: 0.08, hit: 0.02, stunF: 180, regenDelayF: 120, regenPerF: 0.002, executeFrac: 0.15 },
  light: { max: 100, perfect: 25, normal: 10, kill: 3 },
  ult: { dmg: 60, castF: 30, radius: 260 },
  flask: { charges: 3, useF: 40, heal: 2 },
  enemy: { minTelegraphF: 18, bossMinTelegraphF: 14, multiHitGapF: 16, maxAttackers: 2 },
  loop: { maxStepsPerFrame: 5 },
};
