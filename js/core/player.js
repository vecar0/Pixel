// 리라: 이동·점프·공격·패링·회피·기름병·등불 마법 상태기계 (순수 로직)
import { CFG } from './config.js?v=mwqg4kpo';
import { statMods, startStats } from './stats.js?v=mwqg4kpo';

const P = CFG.player, A = CFG.attack, PR = CFG.parry, RO = CFG.roll, FL = CFG.flurry;
export const ACTIONS = ['attack', 'parry', 'roll', 'jump', 'skill', 'flask'];


export function createPlayer(x, y) {
  return {
    x, y, w: P.w, h: P.h, vx: 0, vy: 0, face: 1,
    onGround: false, coyote: 0, jumpCut: false, airAttacked: false,
    hp: P.hp, maxHp: P.hp, spells: ['bolt'], castCount: 0, aegisReady: true, galeT: 0, light: 0, flasks: CFG.flask.charges, maxFlasks: CFG.flask.charges,
    relics: new Set(), mods: { rollMul: 1, iExtra: 0, airJumps: 0, execMul: 1, lightMul: 1, ...statMods(startStats()) }, airLeft: 0, chainN: 0, crit: false,
    state: 'idle', stateT: 0, combo: 0, comboT: 0,
    iframes: 0, buffer: null,
    parryOk: false, recoverWait: 0, dropT: 0, perfectParries: 0, rollDir: 1, swing: 0,
  };
}

function setState(p, s) { p.state = s; p.stateT = 0; }

export function invulnerable(p) {
  if (p.iframes > 0) return true;
  if (p.state === 'roll') return p.stateT >= RO.iStart && p.stateT <= RO.iEnd + p.mods.iExtra;
  if (p.state === 'execute') return true;                   // 처형 중 무적
  if (p.state === 'flurry') return p.stateT <= FL.iEnd;        // 반격 연참: 베는 동안 무적
  return p.state === 'cast' && (!!CFG.skill[p.spell].inv || !!p.mods.spellInv);   // 등불 16: 모든 마법 시전 중 무적   // 큰 마법 시전 중 무적
}

// 반격 연참의 지금 타 번호 (판정 중이 아니면 -1)
export const flurryHit = p => FL.hits.findIndex(h => p.stateT >= h && p.stateT < h + FL.activeF);
export function attackBox(p) {
  if (p.state === 'flurry') {                                    // 반격 연참: 앞쪽, 타마다 판정
    const k = flurryHit(p); if (k < 0) return null;
    const rg = FL.range + (k === FL.hits.length - 1 ? 14 : 0);
    return { x: p.face > 0 ? p.x + p.w - 6 : p.x - rg + 6, y: p.y + 2, w: rg, h: p.h - 4 };
  }
  if (p.state !== 'attack') return null;
  if (p.stateT < A.startupF || p.stateT >= A.startupF + A.activeF) return null;
  const rg = Math.round(A.range * (p.mods.rangeMul || 1)), x = p.face > 0 ? p.x + p.w : p.x - rg;   // 힘 18: 공격 범위
  return { x, y: p.y + 4, w: rg, h: p.h - 8 };
}

// 지금 이 행동을 시작할 수 있나
function canAct(p, action) {
  const t = p.stateT;
  switch (p.state) {
    case 'idle': case 'run': case 'jump': return true;
    case 'attack': return t >= A.startupF + A.activeF;            // 후딜만 캔슬 가능
    case 'parry': return p.parryOk && p.recoverWait <= 0;        // 성공 후 4틱 뒤 (히트스톱 포함)
    default: return false;                                        // roll·hurt·flask·cast·dead
  }
}

function start(w, p, action, inp) {
  switch (action) {
    case 'jump':
      if (inp.down && p.onGround && standingOnOneWay(w, p)) { p.dropT = 10; p.onGround = false; return true; }  // 발판 내려가기
      if (!(p.onGround || p.coyote > 0)) {
        if (p.airLeft <= 0) return false;
        p.airLeft--;                                 // 두 번째 날개: 공중 점프
      }
      p.vy = -Math.sqrt(2 * CFG.GRAV * P.jumpMaxH); p.onGround = false; p.coyote = 0; p.jumpCut = false;
      if (p.state !== 'idle' && p.state !== 'run') setState(p, 'jump');
      return true;
    case 'attack': {
      const stunNear = w.enemies.some(e => !e.dead && e.stunT > 0 && Math.abs((e.x + e.w / 2) - (p.x + p.w / 2)) < 90);   // 그로기 적이 가까우면 연참 대신 처형
      if (p.counterT > 0 && p.onGround && !stunNear) { p.counterT = 0; useSwing(p); setState(p, 'flurry'); w.events.push({ type: 'flurryStart', x: p.x + p.w / 2, y: p.y + p.h, face: p.face }); return true; }   // 완벽 패링 직후 = 반격 연참
      if (!p.onGround && p.airAttacked) return false;
      const chain = (p.state === 'attack') || p.comboT > 0;
      p.combo = chain ? (p.combo + 1) % 3 : 0;
      if (!p.onGround) { p.airAttacked = true; p.combo = 0; }
      p.swing++; useSwing(p); setState(p, 'attack'); return true;
    }
    case 'parry': setState(p, 'parry'); p.parryOk = false; p.recoverWait = 0; return true;
    case 'roll':
      p.rollDir = inp.left ? -1 : inp.right ? 1 : p.face; p.face = p.rollDir;
      setState(p, 'roll'); return true;
    case 'flask':
      if (p.flasks <= 0 || p.hp >= p.maxHp) return false;
      setState(p, 'flask'); return true;
    case 'skill': {                                 // 등불 마법 = 불꽃 두르기: 빛을 써서 검에 속성 불꽃 (두른 중에 누르면 시간을 다시 채움). 마법은 속성 게이지가 터질 때 저절로 나간다
      const cost = Math.round(CFG.enchant.cost * (p.mods.costMul || 1));
      if (p.light < cost) return false;
      p.light -= cost; p.spell = 'enchant'; p.elB = 0; setState(p, 'cast'); w.events.push({ type: 'castStart', spell: 'enchant', el: p.element || null }); return true;
    }
  }
  return false;
}

// 다시 켜기 시작 (땅·공중 어디서든). 끝나면 섬광 (world가 relightFlash 처리)
// 두르기 = 휘두를 수 있는 횟수 (베기·연참 시작마다 1). 마지막 한 번은 그 베기가 끝날 때까지 불꽃이 남는다
export const enchMax = p => Math.round(CFG.enchant.swings * (p.mods.enchDur || 1));
function useSwing(p) {
  if (!(p.enchantT > 0) || p.enchLast) return;
  if (--p.enchantT <= 0) { p.enchantT = 0.5; p.enchLast = true; }
}
function relight(w, p) { p.dark = false; p.darkT = 0; p.buffer = null; setState(p, 'relight'); w.events.push({ type: 'relight', x: p.x + p.w / 2, y: p.y + p.h / 2 }); }
export function updatePlayer(w, inp) {
  const p = w.player;
  if (p.state === 'dead') return;
  p.stateT++;
  if (p.iframes > 0) p.iframes--;
  if (p.recoverWait > 0) p.recoverWait--;
  if (p.dropT > 0) p.dropT--;
  if (p.blueT > 0) p.blueT--;
  if (p.enchLast && p.state !== 'attack' && p.state !== 'flurry') { p.enchLast = false; p.enchantT = 0; w.events.push({ type: 'enchantEnd' }); }   // 마지막으로 두른 베기가 끝나면 불꽃이 꺼짐
  // 소등: 버튼 한 번에 끄기 / 다시 누르면(또는 시간이 다 되면) 다시 켬 → 무방비 동작 뒤 섬광
  const SN = CFG.snuff; if (p.snuffCd > 0) p.snuffCd--; if (p.noiseT > 0) p.noiseT--;
  if (inp.snuff && p.state !== 'dead' && p.state !== 'relight' && p.state !== 'execute') {
    if (p.dark) relight(w, p);
    else if (!(p.snuffCd > 0)) { p.dark = true; p.darkT = SN.maxF + (p.mods.darkExtra || 0); w.events.push({ type: 'snuff', x: p.x + p.w / 2, y: p.y + p.h / 2 }); }
  }
  if (p.dark) { p.light = Math.min(CFG.light.max, p.light + SN.regen * (p.mods.lightMul || 1)); if (--p.darkT <= 0) relight(w, p); }   // 어둠 속에선 빛이 고임
  if (p.dark && ((p.state === 'roll' && p.stateT === 1) || (p.state === 'jump' && p.stateT === 1))) { p.noiseT = 12; p.noiseR = SN.noiseRun * (p.mods.quietMul || 1); }   // 어둠 속: 걸음은 조용(살금살금), 구르기·점프는 소리
  if (p.powT > 0) p.powT--; if (p.sharpT > 0) p.sharpT--; if (p.shieldT > 0) p.shieldT--;   // 마법 효과 타이머 (공격 강화 · 패링 판정 · 보호막)
  if (p.comboT > 0) p.comboT--;
  if (p.counterT > 0) p.counterT--;
  if (p.execChainT > 0 && --p.execChainT === 0) p.execChain = 0;

  // 새 입력 → 버퍼 (마지막 입력 우선)
  for (const a of ACTIONS) if (inp[a]) p.buffer = { action: a, t: P.bufferF };

  // 상태 시간 종료 처리
  const t = p.stateT;
  if (p.state === 'attack' && p.combo === 2 && t === A.startupF && p.mods.str7)          // 힘 7: 3타 검기
    w.projectiles.push({ x: p.face > 0 ? p.x + p.w : p.x - 24, y: p.y + 18, w: 24, h: 14, vx: p.face * 6, vy: 0, pdmg: Math.round(8 * p.mods.atkMul), owner: 'player', life: 32, echo: true, src: {} });
  if (p.state === 'attack' && t >= A.startupF + A.activeF + A.recoveryF + (p.mods.atkLag || 0)) { p.comboT = A.comboWindowF; setState(p, 'idle'); }
  if (p.state === 'flurry') {
    const k = FL.hits.indexOf(t);
    if (k >= 0) { p.swing++; w.events.push({ type: 'flurryHit', k, x: p.x + p.w / 2, y: p.y + p.h, face: p.face }); }   // 타마다 새 휘두름 (같은 적을 여러 번)
    if (t >= FL.totalF) { p.comboT = 0; setState(p, 'idle'); }
  }
  if (p.state === 'parry' && (p.parryOk ? t >= PR.normalF : t >= PR.normalF + PR.whiffF + (p.mods.whiffLag || 0))) setState(p, 'idle');
  if (p.state === 'roll' && t >= RO.totalF + RO.endLagF + (p.mods.rollLag || 0)) {
    const RES = p.mods.res || {};
    if (p.mods.agi10) p.crit = true;                                          // 민첩 10: 구르기 직후 치명타
    if (RES.gale) p.galeT = 40;                                                // 공명 질풍
    if (RES.emberStep) w.projectiles.push({ x: p.x + p.w / 2 - 6, y: p.y + 20, w: 12, h: 10, vx: p.face * 5, vy: 0, spd: 5, homing: true, pdmg: 8, poise: 0.05, owner: 'player', life: 90, bolt: 'lamp', hits: [], src: {} });   // 공명 잔불 걸음
    setState(p, 'idle');
  }
  if (p.galeT > 0) p.galeT--;
  if (p.state === 'hurt' && t >= P.hurtStunF) setState(p, 'idle');
  if (p.state === 'flask' && t >= Math.round(CFG.flask.useF * (p.mods.flaskSpeed || 1))) {   // 생명 12: 빨리 마심
    const hp0 = p.hp; p.flasks--; p.flasksUsed = (p.flasksUsed || 0) + 1; p.hp = Math.min(p.maxHp, p.hp + Math.max(1, CFG.flask.heal + (p.mods.flaskBonus || 0)));
    w.events.push({ type: 'heal', amount: p.hp - hp0, from: hp0, x: p.x + p.w / 2, y: p.y + p.h }); setState(p, 'idle');
  }
  if (p.state === 'execute' && !p.chainNext && t >= (p.execMode === 'chain' ? CFG.execute.chainTotalF : CFG.execute.totalF)) { setState(p, 'idle'); p.execMode = null; }
  if (p.state === 'relight' && t >= CFG.snuff.relightF + (p.mods.relightLag || 0)) {   // 다시 켬: 섬광
    setState(p, 'idle'); p.snuffCd = CFG.snuff.cdF; w.events.push({ type: 'relightFlash' });
  }
  if (p.state === 'cast') {
    const S = CFG.skill[p.spell];
    if (t === S.fireF) { if (p.spell === 'enchant') { p.enchantT = enchMax(p); p.enchLast = false; p.healBurst = 0;
      if ((p.mods.res || {}).warmLamp && ++p.castCount % 3 === 0 && p.hp < p.maxHp) { const h0 = p.hp; p.hp++; w.events.push({ type: 'heal', amount: 1, from: h0, x: p.x + p.w / 2, y: p.y + p.h }); }   // 공명 따스한 등불: 두르기 3번마다
      w.events.push({ type: 'enchant', el: p.element || null, x: p.x + p.w / 2, y: p.y + 24, face: p.face }); } else w.events.push({ type: 'skill', spell: p.spell, x: p.x + p.w / 2, y: p.y + 24, face: p.face }); }
    if (t >= S.castF) setState(p, 'idle');
  }

  // 버퍼 소비
  if (p.buffer) {
    const b = p.buffer;
    if (canAct(p, b.action) && start(w, p, b.action, inp)) p.buffer = null;
    else if (--b.t <= 0) p.buffer = null;
  }

  // 가로 이동
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  const free = p.state === 'idle' || p.state === 'run' || p.state === 'jump';
  if (p.state === 'roll') {
    p.vx = t < RO.totalF ? p.rollDir * RO.dist * p.mods.rollMul / RO.totalF : 0;
  } else if (free || p.state === 'flask') {
    const spd = P.speed * (p.mods.speedMul || 1) * (p.slowMul || 1) * (p.dark ? 0.7 * (p.mods.darkSpeed || 1) : 1), max = p.state === 'flask' && !(p.mods.res || {}).enduring ? spd * 0.3 : spd;   // 공명 질긴 걸음 · slowMul: 물에 잠긴 바닥   // 어둠 속은 살금살금 (그림자 18: 더 빠르게)
    if (dir) {
      p.vx += dir * spd / P.accelF;
      if (Math.abs(p.vx) > max) p.vx = Math.sign(p.vx) * max;
      if (free) p.face = dir;
    } else {
      const d = P.speed / P.decelF;
      p.vx = Math.abs(p.vx) <= d ? 0 : p.vx - Math.sign(p.vx) * d;
    }
  } else if (p.state === 'flurry' && p.onGround) {
    p.vx = t < FL.hits[FL.hits.length - 1] + 2 ? p.face * FL.lunge : 0;   // 앞으로 파고들며 벤다
  } else if (p.state === 'attack' && p.onGround && t < A.startupF + A.activeF) {
    p.vx = p.face * A.lunge;   // 휘두를 때 앞으로 살짝 내딛기
  } else if (p.onGround) {
    p.vx = 0;  // 공격·패링·피격 중 지상은 멈춤
  }

  // 가변 점프
  if (p.vy < 0 && !inp.jumpHeld && !p.jumpCut) { p.vy *= 0.5; p.jumpCut = true; }

  // 중력 + 충돌
  p.vy = Math.min(CFG.MAX_FALL, p.vy + CFG.GRAV * (p.vy > 0 ? CFG.FALL_MULT : 1));
  const wasAir = !p.onGround, fallV = p.vy;
  moveAndCollide(w, p, inp);

  if (p.onGround && wasAir) w.events.push({ type: 'land', x: p.x + p.w / 2, y: p.y + p.h, v: fallV });
  if (p.onGround) { p.coyote = P.coyoteF; p.airAttacked = false; p.airLeft = p.mods.airJumps; }
  else if (p.coyote > 0) p.coyote--;

  if (p.state === 'idle' || p.state === 'run' || p.state === 'jump')
    p.state = !p.onGround ? 'jump' : Math.abs(p.vx) > 0.1 ? 'run' : 'idle';
}

const STEP = 16;   // 걸어서 넘는 턱 높이
// 축 분리 AABB 충돌. oneWay 발판은 위에서 떨어질 때만, 아래+점프로 통과
export function moveAndCollide(w, b, inp = {}) {
  b.x += b.vx;
  for (const s of w.solids) {
    if (s.oneWay || !overlap(b, s)) continue;
    // 낮은 턱(STEP 이하)은 걸어서 올라간다: 땅에 서 있었고, 올라선 자리가 비어 있으면
    const rise = b.y + b.h - s.y;
    if (b.onGround && rise > 0 && rise <= STEP && !w.solids.some(o => o !== s && !o.oneWay && overlap({ x: b.x, y: s.y - b.h, w: b.w, h: b.h }, o))) { b.y = s.y - b.h; continue; }
    if (b.vx > 0) b.x = s.x - b.w; else if (b.vx < 0) b.x = s.x + s.w;
    b.vx = 0;
  }
  const prevBottom = b.y + b.h;
  b.y += b.vy;
  b.onGround = false;
  for (const s of w.solids) {
    if (!overlap(b, s)) continue;
    if (s.oneWay) {
      if (b.vy < 0 || prevBottom > s.y + 0.01 || b.dropT > 0) continue;
    }
    if (b.vy >= 0) { b.y = s.y - b.h; b.onGround = true; }
    else b.y = s.y + s.h;
    b.vy = 0;
  }
}

function standingOnOneWay(w, p) {
  const feet = p.y + p.h;
  return w.solids.some(s => s.oneWay && Math.abs(feet - s.y) < 0.5 && p.x + p.w > s.x && p.x < s.x + s.w);
}

export function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
