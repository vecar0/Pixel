// 적 공용 상태기계: idle(접근) → telegraph(예고) → active(판정) → recover(후딜) → idle
// 적 객체에는 함수를 넣지 않는다 (structuredClone 가능 = 테스트 봇이 미래를 미리 볼 수 있음)
// 공격 종류는 데이터로: reach(근접) · dash(2D 돌진) · charge(가로 돌진) · bolt(조준탄) · wave(바닥 충격파)
//                      · rain(낙하 파편) · beam(긴 광선) · ring(몸 주변 고리)
import { clipBeam } from './gimmick.js?v=mwp8gn8l';
import { CFG } from './config.js?v=mwp8gn8l';
import { moveAndCollide, overlap } from './player.js?v=mwp8gn8l';
import { BOSSES, bossPick, bossWant } from './boss.js?v=mwp8gn8l';

export const ENEMY_DEFS = {
  ghoul: {
    hp: 30, w: 24, h: 54, speed: 1.05, range: 54, cooldown: [40, 80],
    attacks: { slash: { name: 'slash', telegraphF: 20, activeF: 4, recoverF: 24, dmg: 1, parryable: true, reach: 46 } },
  },
  moth: {
    hp: 12, w: 20, h: 16, speed: 1.6, fly: true, oneHit: true, range: 190, cooldown: [60, 110],   // oneHit: 무엇에 맞든 한 방
    attacks: { dash: { name: 'dash', telegraphF: 18, activeF: 24, recoverF: 30, dmg: 1, parryable: true, dashSpeed: 6.6 } },
  },
  // 지역 2: 침수 대성당
  spearman: {
    hp: 40, w: 24, h: 58, speed: 0.9, range: 74, cooldown: [45, 85],
    attacks: {
      thrust: { name: 'thrust', telegraphF: 20, activeF: 5, recoverF: 26, dmg: 1, parryable: true, reach: 62, height: 22 },
      triple: { name: 'triple', telegraphF: 22, activeF: 4, recoverF: 32, dmg: 1, parryable: true, reach: 62, height: 22, hits: 3, gapF: 16 },
    },
  },
  priest: {
    hp: 25, w: 24, h: 56, speed: 0.7, range: 280, keepAway: 140, cooldown: [70, 110],
    attacks: { bolts: { name: 'bolts', telegraphF: 24, activeF: 1, recoverF: 40, dmg: 1, parryable: true, hits: 3, gapF: 22, bolt: { speed: 2.8, w: 10, h: 10 } } },
  },
  // 지역 3: 유리 광산
  shellguard: {
    hp: 70, w: 34, h: 54, speed: 0.6, range: 60, shield: true, cooldown: [50, 90],
    attacks: {
      bash: { name: 'bash', telegraphF: 22, activeF: 5, recoverF: 28, dmg: 1, parryable: true, reach: 40 },
      grab: { name: 'grab', telegraphF: 26, activeF: 6, recoverF: 36, dmg: 2, parryable: false, reach: 34 },
    },
  },
  // 지역 4: 꺼진 태양의 심연
  assassin: {
    hp: 35, w: 22, h: 52, speed: 1.4, range: 46, blink: true, cooldown: [70, 120],
    attacks: { cut: { name: 'cut', telegraphF: 18, activeF: 4, recoverF: 26, dmg: 1, parryable: true, reach: 40 } },
  },
  ...BOSSES,
};

// 엘리트 수식어 (판마다 무작위)
export const ELITE_MODS = {
  swift: { name: '가속', desc: '빠르고 쉴 틈이 적다' },
  split: { name: '분열', desc: '쓰러지면 나방 둘이 나온다' },
  iron:  { name: '강철', desc: '체력이 높고 자세가 잘 무너지지 않는다' },
  shield: { name: '수호 방패', desc: '정면 공격을 막는 빛의 방패 (3번 맞거나 완벽 패링하면 깨지고 크게 비틀거림)' },
  mirage: { name: '분신', desc: '자기와 똑같은 분신 둘을 만든다 (분신은 한 방, 빛 테두리가 있는 쪽이 진짜)' },
};
export const ELITE = { barrier: 3, barrierRegenF: 600, breakStaggerF: 100, mirageF: 480, decoys: 2 };

export function rng(w) {           // 결정적 난수 (월드에 상태 저장)
  w.seed = (w.seed * 1664525 + 1013904223) >>> 0;
  return w.seed / 4294967296;
}

export const EMERGE_F = 48;   // 웨이브 적이 땅에서 솟아오르는 시간 (0.8초)
export function spawnEnemy(w, kind, x, y, opt = {}) {
  const d = ENEMY_DEFS[kind], hpMul = opt.hpMul || 1;
  const e = {
    kind, x, y, w: d.w, h: d.h, vx: 0, vy: 0, face: -1, onGround: false,
    hp: Math.round(d.hp * hpMul), maxHp: Math.round(d.hp * hpMul), boss: !!d.boss, poise: 0, poiseMax: !!d.poise || !d.oneHit, poiseRes: d.boss ? 1 : CFG.poise.mobRes, stunT: 0,   // 일반 적도 그로기 (나방 제외)
    poiseRegenT: 0,
    st: 'idle', stT: 0, atk: null, srcs: [], cd: 30, spawnT: opt.emerge ? EMERGE_F : 0, hitBy: -1, flash: 0, kvx: 0, staggerT: 0,
    shield: !!d.shield, counter: !!d.counter,
    speed: d.speed, range: d.range, cdMul: 1, mods: [], forceNext: null, variant: opt.variant || null, dashDx: 0, dashDy: 0,
  };
  w.enemies.push(e);
  if (w.events) w.events.push({ type: 'spawn', kind, x: x + d.w / 2, y: y + d.h, boss: !!d.boss });
  return e;
}

export function makeElite(e, mod) {
  e.elite = true; e.poiseMax = true; e.mods = [mod];
  e.hp = e.maxHp = Math.round(e.maxHp * (mod === 'iron' ? 3.5 : 2.5));
  if (mod === 'swift') { e.speed *= 1.6; e.cdMul = 0.5; }
  if (mod === 'iron') e.poiseRes = 0.6;
  if (mod === 'shield') { e.barrier = e.barrierMax = ELITE.barrier; e.barrierCd = 0; }   // 수호 방패
  if (mod === 'mirage') e.mirageT = 40;                                                // 분신: 곧 첫 분신
}
// 강적 기믹 매 틱: 방패 재생, 분신 만들기 (분신은 체력 1, 나방처럼 한 방)
export function updateElite(w, e) {
  if (e.barrierMax && e.barrier <= 0 && --e.barrierCd <= 0) { e.barrier = e.barrierMax; w.events.push({ type: 'barrierUp', x: e.x + e.w / 2, y: e.y }); }
  if (e.mods && e.mods.includes('mirage') && !e.decoy && e.stunT <= 0 && --e.mirageT <= 0) {
    e.mirageT = ELITE.mirageF;
    const alive = w.enemies.filter(o => o.master === e && !o.dead).length;
    for (let k = alive; k < ELITE.decoys; k++) {
      const x = Math.max(40, Math.min(w.width - 40 - e.w, e.x + (k ? 1 : -1) * (90 + 30 * k)));
      const d = spawnEnemy(w, e.kind, x, e.y, { hpMul: 1, emerge: true });
      d.hp = d.maxHp = 1; d.decoy = true; d.master = e; d.poiseMax = false;
      w.events.push({ type: 'mirage', x: x + e.w / 2, y: e.y + e.h / 2 });
    }
  }
  if (e.decoy && (!e.master || e.master.dead)) { e.dead = true; w.events.push({ type: 'kill', kind: e.kind, x: e.x + e.w / 2, y: e.y + e.h / 2, decoy: true, dummy: true }); }   // 진짜가 쓰러지면 분신도 사라짐
}

// 공격 템포: 예고·후딜에 CFG.enemy.tempo 배율 (판정 길이는 그대로)
export const telegraphOf = (e, a) => Math.round(a.telegraphF * CFG.enemy.tempo) - (e.boss && e.hp <= e.maxHp / 2 ? 4 : 0);
export const recoverOf = a => Math.round(a.recoverF * CFG.enemy.tempo);

const onScreen = (w, e) => e.x + e.w > w.camX && e.x < w.camX + CFG.VIEW_W;
const attackers = w => w.enemies.filter(e => !e.boss && !e.dead && (e.st === 'telegraph' || e.st === 'active')).length;

function setSt(e, st) { e.st = st; e.stT = 0; }

function startAttack(w, e, d, dx, name) {
  e.atk = name; e.face = Math.sign(dx) || e.face;
  setSt(e, 'telegraph');
  w.events.push({ type: 'telegraph', boss: e.boss, parryable: d.attacks[name].parryable, kind: e.kind, atk: name });
}

export function updateEnemy(w, e) {
  if (Math.abs(e.kvx) > 0.05) {          // 넉백: 벽에 막히면 멈춤
    const x0 = e.x; e.x += e.kvx; e.kvx *= 0.8;
    if (w.solids.some(s => !s.oneWay && e.x < s.x + s.w && e.x + e.w > s.x && e.y < s.y + s.h && e.y + e.h > s.y)) { e.x = x0; e.kvx = 0; }
  } else e.kvx = 0;
  if (e.update) return e.update(w, e);    // 테스트 더미
  if (e.spawnT > 0) { e.spawnT--; e.vx = 0; if (!ENEMY_DEFS[e.kind].fly) physics(w, e); return; }   // 등장 중: 행동·피격 없음
  const d = ENEMY_DEFS[e.kind], p = w.player;
  const dx = (p.x + p.w / 2) - (e.x + e.w / 2);
  e.stT++;
  if (e.staggerT > 0) { e.staggerT--; if (!d.fly) { e.vx = 0; physics(w, e); } return; }

  if (e.st === 'idle') {
    if (e.cd > 0) e.cd--;
    if (e.boss) bossMove(w, e, dx);
    else if (d.fly) mothHover(w, e, dx);
    else if (d.keepAway) keepDistance(w, e, dx, d.keepAway);
    else walkToward(w, e, dx);
    if (d.blink && e.cd <= 0 && Math.abs(dx) > 90 && Math.abs(dx) < 400 && attackers(w) < CFG.enemy.maxAttackers && onScreen(w, e)) {
      // 순간이동: 리라 등 뒤로. 예고는 새 위치에서 시작하므로 공정함
      const nx = p.x + p.w / 2 - p.face * 56 - e.w / 2;
      if (nx > 0 && nx + e.w < w.width) { e.x = nx; w.events.push({ type: 'blink', x: e.x + e.w / 2, y: e.y + e.h / 2 }); }
    }
    const want = e.boss ? bossWant(w, e, dx) : Math.abs(dx) < e.range && Math.abs(p.y - e.y) < 120;
    const tokenOk = e.boss || attackers(w) < CFG.enemy.maxAttackers;
    if (e.cd <= 0 && want && tokenOk && onScreen(w, e) && p.state !== 'dead') {
      const names = Object.keys(d.attacks);
      startAttack(w, e, d, (p.x + p.w / 2) - (e.x + e.w / 2), e.boss ? bossPick(w, e, dx) : names[(rng(w) * names.length) | 0]);
    }
  } else if (e.st === 'telegraph') {
    if (!d.fly) { e.vx = 0; physics(w, e); }
    if (e.stT >= telegraphOf(e, d.attacks[e.atk])) {
      setSt(e, 'active'); e.srcs = [];
      const a = d.attacks[e.atk];
      w.events.push({ type: 'enemyStrike', kind: e.kind, atk: e.atk, x: e.x + e.w / 2 - e.face * 14, y: e.y + e.h, face: e.face, reach: a.reach || 0 });
      if (a.dashSpeed) { const l = Math.hypot(dx, (p.y + 28) - e.y) || 1; e.dashDx = dx / l; e.dashDy = ((p.y + 28) - e.y) / l; }
      if (a.charge) e.face = Math.sign(dx) || e.face;
      if (a.wave) spawnWaves(w, e, a);
      if (a.rain) spawnRain(w, e, a);
    }
  }
  if (e.st === 'active') {   // 예고가 끝난 그 틱부터 판정
    const a = d.attacks[e.atk], hits = a.hits || 1, gap = a.gapF || 0;
    const hb = (k, x, y, w2, h2, dir) => {
      if (!e.srcs[k]) e.srcs[k] = {};
      w.hitboxes.push({ src: e.srcs[k], owner: e, x, y, w: w2, h: h2, dmg: a.dmg, parryable: a.parryable, dir });
    };
    if (a.dashSpeed) {
      e.vx = e.dashDx * a.dashSpeed; e.x += e.vx; e.y += e.dashDy * a.dashSpeed;
      hb(0, e.x, e.y, e.w, e.h, Math.sign(e.vx) || e.face);
    } else if (a.charge) {
      e.vx = e.face * a.charge; moveAndCollide(w, e);
      hb(0, e.x - 4, e.y, e.w + 8, e.h, e.face);
    } else {
      for (let k = 0; k < hits; k++) {
        const t0 = k * gap;
        if (e.stT === t0 && a.bolt) spawnBolt(w, e, a);
        if (e.stT >= t0 && e.stT < t0 + a.activeF) {
          if (a.reach) hb(k, e.face > 0 ? e.x + e.w : e.x - a.reach, e.y + e.h - (a.height || e.h), a.reach, a.height || e.h, e.face);
          if (a.beam) { const [bx, bl] = clipBeam(w, e, e.face > 0 ? e.x + e.w : e.x - a.beam.len, a.beam.len, e.y + a.beam.y, a.beam.h); e.beamX = bx; e.beamL = bl; if (bl > 0) hb(k, bx, e.y + a.beam.y, bl, a.beam.h, e.face); }   // 수정 거울에서 끊김
          if (a.ring) hb(k, e.x - a.ring, e.y - 10, e.w + a.ring * 2, e.h + 10, Math.sign(-dx) || e.face);
        }
      }
    }
    if (!d.fly && !a.charge) { e.vx = 0; physics(w, e); }
    if (e.stT >= (hits - 1) * gap + a.activeF) setSt(e, 'recover');
  } else if (e.st === 'recover') {
    if (!d.fly) { e.vx = 0; physics(w, e); }
    if (e.stT >= recoverOf(d.attacks[e.atk])) {
      setSt(e, 'idle');
      const [lo, hi] = d.cooldown; e.cd = Math.round((lo + Math.floor(rng(w) * (hi - lo))) * e.cdMul * CFG.enemy.tempo);
    }
  }
}

// 조준탄: 리라 허리 높이(검을 든 높이)를 향해 낮게. 기울기는 완만하게 제한해 패링 자세로 받기 쉽게
function spawnBolt(w, e, a) {
  const p = w.player, b = a.bolt;
  const sx = e.face > 0 ? e.x + e.w : e.x - b.w, sy = e.y + e.h * 0.55 - b.h / 2;
  const tx = p.x + p.w / 2, dx = tx - sx, ty0 = p.y + p.h * 0.62 - b.h / 2;
  const ty = sy + Math.max(-0.35, Math.min(0.35, (ty0 - sy) / (Math.abs(dx) || 1))) * Math.abs(dx), l = Math.hypot(dx, ty - sy) || 1;
  w.projectiles.push({ x: sx, y: sy, w: b.w, h: b.h, vx: (tx - sx) / l * b.speed, vy: (ty - sy) / l * b.speed,
    dmg: a.dmg, parryable: a.parryable, owner: 'enemy', life: 160, src: e, bolt: e.kind });
  w.events.push({ type: 'bolt', x: sx, y: sy });
}

// 바닥 충격파 양쪽 (패링 불가 → 점프·회피)
export function spawnWaves(w, e, a) {
  const floorY = e.y + e.h, cx = e.x + e.w / 2;
  for (const dir of [-1, 1]) {
    w.projectiles.push({
      x: cx + dir * (e.w / 2) - (dir < 0 ? a.wave.w : 0), y: floorY - a.wave.h, w: a.wave.w, h: a.wave.h,
      vx: dir * a.wave.speed, vy: 0, dmg: a.dmg, parryable: false, owner: 'enemy', life: a.wave.life, src: e, wave: true,
    });
  }
  w.shake = 10;
  w.events.push({ type: 'slam', kind: e.kind });
}

// 낙하 파편: 리라 위쪽에서 떨어짐 (예고 동안 표시는 렌더가 rainMark로)
export function spawnRain(w, e, a) {
  const p = w.player;
  for (let i = 0; i < a.rain.n; i++) {
    const x = p.x + p.w / 2 + (i - (a.rain.n - 1) / 2) * a.rain.gap;
    w.projectiles.push({ x: x - 7, y: -20 - i * 30, w: 14, h: 18, vx: 0, vy: a.rain.speed, dmg: a.dmg,
      parryable: a.parryable, owner: 'enemy', life: 200, src: e, shard: true });
  }
}

function physics(w, e) {
  e.vy = Math.min(CFG.MAX_FALL, e.vy + CFG.GRAV);
  const want = e.vx, ground = e.onGround;
  moveAndCollide(w, e);
  // 걷다가 언덕 벽에 막히면 뛰어오른다 (언덕 높이만큼)
  if (ground && want && !e.vx && !e.boss && e.st === 'idle') {
    const wall = w.solids.find(s => !s.oneWay && s.y < e.y + e.h && s.y > e.y + e.h - 90 && (want > 0 ? Math.abs(s.x - (e.x + e.w)) < 2 : Math.abs(s.x + s.w - e.x) < 2));
    if (wall) { e.vy = -Math.sqrt(2 * CFG.GRAV * (e.y + e.h - wall.y + 10)); e.onGround = false; e.hopVx = want; }
  }
  if (!e.onGround && e.hopVx) { e.x += e.hopVx; if (w.solids.some(s => !s.oneWay && overlap(e, s))) e.x -= e.hopVx; }   // 공중에서도 앞으로
  if (e.onGround) e.hopVx = 0;
}

function walkToward(w, e, dx) {
  e.face = Math.sign(dx) || e.face;
  e.vx = Math.abs(dx) > e.range * 0.6 && Math.abs(dx) < CFG.enemy.aggro ? e.face * e.speed : 0;
  physics(w, e);
}

function keepDistance(w, e, dx, far) {
  e.face = Math.sign(dx) || e.face;
  const ad = Math.abs(dx);
  e.vx = ad < far * 0.8 ? -e.face * e.speed : ad > e.range * 0.9 && ad < CFG.enemy.aggro ? e.face * e.speed : 0;
  physics(w, e);
}

function bossMove(w, e, dx) {
  e.face = Math.sign(dx) || e.face;
  e.vx = Math.abs(dx) > ENEMY_DEFS[e.kind].range * 0.8 ? e.face * e.speed : 0;
  physics(w, e);
}

function mothHover(w, e, dx) {
  const p = w.player;
  const side = dx > 0 ? -1 : 1;                          // 리라 기준 자기 쪽에 머묾
  const tx = p.x + side * 120, ty = p.y - 60;
  const mx = tx - e.x, my = ty - e.y, l = Math.hypot(mx, my);
  if (l > 4) { e.vx = mx / l * e.speed; e.x += e.vx; e.y += my / l * e.speed; }
  e.y += Math.sin(w.t * 0.1) * 0.3;
  e.face = Math.sign(dx) || e.face;
}
