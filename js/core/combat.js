// 판정: 리라 공격 → 적, 적 공격 → 리라(패링/피격), 자세 게이지, 등불 마법
import { hitGimmick, gimmickDamageMul } from './gimmick.js?v=mwqh1f3g';
import { hitLevel } from './level.js?v=mwqh1f3g';
import { STAT_SPELL } from './spells.js?v=mwqh1f3g';
import { CFG } from './config.js?v=mwqh1f3g';
import { ENEMY_DEFS, ELITE, AFFINITY, affinity, DARK_REACT, telegraphOf } from './enemies.js?v=mwqh1f3g';
import { attackBox, invulnerable, overlap, flurryHit } from './player.js?v=mwqh1f3g';

const PR = CFG.parry, PO = CFG.poise;

// 적 히트박스 하나를 리라에게 판정. 반환: 'perfect'|'normal'|'hit'|'ignored'
// hitbox = { src, owner, x,y,w,h, dmg, parryable, dir }  (src.done이면 이미 처리된 공격)
export function resolveEnemyHit(w, hb) {
  const p = w.player;
  const front = hb.dir === -p.face;
  // 탄 패링: 패링 자세일 때는 몸 앞 PR.projReach 만큼, 위아래로 PR.projPad 만큼 넓게 받아낸다 (몸에 닿기 직전 탄도 막힘)
  const guard = hb.proj && p.state === 'parry' && front && hb.parryable && p.stateT < PR.normalF + (p.lagTicks || 0)
    ? { x: p.face > 0 ? p.x : p.x - PR.projReach, y: p.y - PR.projPad, w: p.w + PR.projReach, h: p.h + PR.projPad * 2 } : p;
  if (hb.src.done || p.state === 'dead' || !overlap(guard, hb)) return 'ignored';
  const lag = p.lagTicks || 0;                                   // 설정의 타이밍 보정 (터치 지연만큼 판정창을 늘림)
  if (p.state === 'parry' && p.stateT < PR.normalF + lag && hb.parryable && front) {
    const perfect = p.stateT < Math.min(PR.normalF, Math.max(2, PR.perfectF + (p.mods.perfectExtra || 0) + (p.sharpT > 0 ? 2 : 0))) + lag || p.blueT > 0 || p.mods.allPerfect;   // 의지: 점마다 ±1프레임   // 결계·의지 10: 모든 패링이 완벽
    hb.src.done = true;
    p.parryOk = true; p.recoverWait = PR.successRecoverF;
    p.light = Math.min(CFG.light.max, p.light + (perfect ? CFG.light.perfect : CFG.light.normal) * p.mods.lightMul + (perfect ? 0 : p.mods.parryLight || 0));   // 의지 12: 일반 패링 빛 +5
    if (perfect && p.mods.chain) p.chainN = Math.min(5, p.chainN + 1);          // 불씨 연쇄
    const RES = p.mods.res || {};
    if (perfect) p.counterT = CFG.flurry.window;
    if (perfect && hb.owner && hb.owner.barrier > 0) breakBarrier(w, hb.owner);       // 완벽 패링은 강적 방패를 한 번에 깸                                   // 반격 기회: 이 안에 공격하면 회전 베기
    if (perfect && RES.riposte) p.riposte = true;                                // 공명 철벽 반격
    if (perfect && RES.retribute) p.crit = true;
    if (p.blueT > 0) p.light = Math.min(CFG.light.max, p.light + 10);           // 빛의 결계: 막을 때마다 빛 (낮은 등불 보완)                                 // 공명 응징
    if (perfect && p.mods.echo) w.projectiles.push({                           // 반향: 앞으로 검기
      x: p.face > 0 ? p.x + p.w : p.x - 24, y: p.y + 18, w: 24, h: 14, vx: p.face * 6, vy: 0,
      dmg: 1.5, parryable: true, owner: 'player', life: 50, echo: true, src: {} });
    w.hitstop = Math.max(w.hitstop, perfect ? PR.hitstopPerfect : PR.hitstopNormal);
    if (perfect) { p.perfectParries++; w.shake = 8; }
    const o = hb.owner;
    if (o && p.enchantT > 0 && (p.element || null) === 'wil') elBuild(w, o, perfect ? 60 : 30);   // 빛 점화: 패링으로 게이지
    if (o && o.poiseMax) addPoise(w, o, (perfect || p.mods.normalAsPerfect ? PO.perfect : PO.normal) * (p.mods.poiseMul || 1));   // 의지 16
    if (o && perfect && !o.boss && o.st) {   // 완벽 패링: 일반 적은 공격이 끊기고 튕겨나며 잠깐 무방비
      o.st = 'idle'; o.stT = 0; o.atk = null; o.srcs = []; o.staggerT = Math.round(PR.staggerF * (p.mods.staggerMul || 1));
      o.kvx = Math.sign((o.x + o.w / 2) - (p.x + p.w / 2) || p.face) * PR.staggerPush;
    }
    w.events.push({ type: 'parry', perfect, x: p.face > 0 ? p.x + p.w : p.x, y: p.y + 14 });
    return perfect ? 'perfect' : 'normal';
  }
  if (invulnerable(p)) {
    if (p.state === 'roll' && p.mods.afterglow && !hb.src.glow) { hb.src.glow = true; p.crit = true; w.events.push({ type: 'afterglow', x: p.x + p.w / 2, y: p.y }); }
    if (p.state === 'roll' && p.enchantT > 0 && p.element === 'agi' && hb.owner && !hb.src.frosted) { hb.src.frosted = true; elBuild(w, hb.owner, 50); }   // 얼음 점화: 구르기로 흘리면 게이지
    if (p.state === 'roll' && (p.mods.res || {}).deflect && !hb.src.deflected) { hb.src.deflected = true; p.light = Math.min(CFG.light.max, p.light + 15); w.events.push({ type: 'resonance', id: 'deflect' }); }   // 공명 흘려 막기
    return 'ignored';
  }
  hb.src.done = true;
  if (p.shieldT > 0) {                                                         // 성광 기둥 보호막: 한 번 막음
    p.shieldT = 0; p.iframes = 30; w.hitstop = Math.max(w.hitstop, 6);
    w.events.push({ type: 'aegis', x: p.x + p.w / 2, y: p.y + 20 }); return 'blocked';
  }
  if ((p.mods.res || {}).aegis && p.aegisReady) {                              // 공명 수호: 방마다 한 번 피해를 막음
    p.aegisReady = false; p.iframes = 30; w.hitstop = Math.max(w.hitstop, 6);
    w.events.push({ type: 'aegis', x: p.x + p.w / 2, y: p.y + 20 }); return 'blocked';
  }
  p.hp -= hb.dmg; p.chainN = 0; p.hitChain = 0; p.hurtCount = (p.hurtCount || 0) + 1;
  if (p.enchantT > 0 && p.element === 'vit' && hb.owner && !hb.owner.dead && hb.owner.hp != null) elBuild(w, hb.owner, 55);   // 생명 점화: 받은 피해가 불꽃이 됨
  p.iframes = Math.round(CFG.player.iframesHurt * (p.mods.hurtIMul || 1));   // 생명 18
  p.buffer = null;
  p.vx = (hb.dir || -p.face) * 1.5; p.vy = -2;
  if (p.hp <= 0) { p.hp = 0; p.iframes = 0; p.state = 'dead'; p.stateT = 0; w.over = true; w.events.push({ type: 'dead', x: p.x + p.w / 2, y: p.y + p.h }); }
  else { p.state = 'hurt'; p.stateT = 0; }
  w.shake = Math.max(w.shake, 5);
  w.events.push({ type: 'hurt', x: p.x + p.w / 2, y: p.y + 10 });
  return 'hit';
}

export function breakBarrier(w, e) {
  e.barrier = 0; e.barrierCd = ELITE.barrierRegenF; e.staggerT = ELITE.breakStaggerF; e.st = 'idle'; e.atk = null; e.srcs = [];
  addPoise(w, e, 0.35); w.hitstop = Math.max(w.hitstop, 8); w.shake = Math.max(w.shake, 8);
  w.events.push({ type: 'barrierBreak', x: e.x + e.w / 2, y: e.y + e.h / 2 });
}
export function addPoise(w, e, frac) {
  if (!e.poiseMax || e.stunT > 0) return;
  e.poise = Math.min(1, e.poise + frac * (e.poiseRes || 1));
  e.poiseRegenT = PO.regenDelayF;
  if (e.poise >= 1) {
    // 그로기: 하던 공격은 취소 → 풀린 뒤엔 반드시 새 예고부터 (예고 없는 공격 방지)
    e.stunT = Math.round((e.boss ? PO.stunF : PO.mobStunF) * ((w.player && w.player.mods.stunMul) || 1)); e.st = 'idle';   // 의지 18 e.stT = 0; e.atk = null; e.srcs = []; e.cd = 40;
    w.events.push({ type: 'stun', x: e.x + e.w / 2, y: e.y });
  }
}

// 반환값: 실제로 들어간 피해 (보스 기믹 배율 반영). raw = 기믹 배율 무시 (기믹 자체 피해)
export function damageEnemy(w, e, dmg, poiseFrac = 0, raw = false) {
  if (e.dead) return 0;
  if (e.roarT > 0) return 0;                                           // 2막 포효 중엔 무적
  if (!raw && e.boss) { const k = gimmickDamageMul(w, e); if (k !== 1) { dmg = Math.round(dmg * k); poiseFrac *= k; if (k < 1 && dmg > 0) w.events.push({ type: 'resist', x: e.x + e.w / 2, y: e.y, veil: !!e.veil, kind: e.kind }); } }
  if (ENEMY_DEFS[e.kind]?.oneHit && dmg > 0) dmg = e.hp;              // 나방: 한 방
  if (e.brittleT > 0 && dmg > 0) dmg = Math.round(dmg * (e.boss ? 1.15 : 1.25));   // 마법 효과: 취약(얼음·덩굴)
  e.hp -= dmg;
  e.flash = 6;
  addPoise(w, e, poiseFrac);
  const D = ENEMY_DEFS[e.kind];
  if (D && D.flinch && !e.boss && dmg > 0 && !(e.stunT > 0) && !e.dead) {      // 잔챙이: 맞으면 움찔 (예고 초반이면 공격이 끊김). 1초 안에 3번 맞으면 버티고(강인도) 곧장 반격
    e.hitN = (e.hitT > 0 ? e.hitN || 0 : 0) + 1; e.hitT = 60;
    if (e.armorT > 0) {}
    else if (e.hitN >= 3) { e.armorT = 50; e.hitN = 0; if (e.st === 'idle') e.cd = Math.min(e.cd || 0, 4); w.events.push({ type: 'enrage', x: e.x + e.w / 2, y: e.y }); }
    else if (e.st === 'idle' || (e.st === 'telegraph' && e.stT < telegraphOf(e, D.attacks[e.atk]) * 0.4)) { e.st = 'idle'; e.stT = 0; e.atk = null; e.staggerT = Math.max(e.staggerT || 0, 12); }
  }
  if (e.hp <= 0) {
    e.hp = 0; e.dead = true;
    w.player.light = Math.min(CFG.light.max, w.player.light + CFG.light.kill * w.player.mods.lightMul + (w.player.mods.lmp10 ? 15 : 0));   // 등불 10: 처치마다 빛 +15
    if (w.player.mods.killCrit) w.player.crit = true;                   // 투지 7: 처치하면 다음 공격 치명타
    w.events.push({ type: 'kill', kind: e.kind, x: e.x + e.w / 2, y: e.y + e.h / 2, boss: !!e.boss, elite: !!e.elite, dummy: !!e.dummy || !!e.decoy, decoy: !!e.decoy, ent: e });   // ent: 쓰러지는 모습을 그리려고 (렌더러 전용)
  }
  return dmg;
}

// 리라 공격 판정 (한 번 휘두를 때 적마다 1회)
export function resolvePlayerAttacks(w) {
  const p = w.player, box = attackBox(p);
  if (!box) return;
  if (p.state === 'flurry' ? CFG.flurry.hits.includes(p.stateT) : p.stateT === CFG.attack.startupF) { hitGimmick(w, box); hitLevel(w, box); }   // 보스 기믹·항아리·레버·상자 (휘두를 때 한 번)              // 보스방 기믹 오브젝트 (휘두를 때 한 번)
  for (const e of w.enemies) {
    if (e.dead || e.spawnT > 0 || e.hitBy === p.swing || !overlap(box, e)) continue;
    e.hitBy = p.swing;
    const front = Math.sign((p.x + p.w / 2) - (e.x + e.w / 2)) === e.face;
    if (e.shield && front && e.st !== 'active' && e.stunT <= 0 && p.state !== 'flurry') {   // 반격 연참은 방패를 넘긴다       // 갑각 파수꾼: 정면 방패
      w.hitstop = Math.max(w.hitstop, 3); p.vx = -p.face * 2; e.poise = Math.min(1, e.poise + 0);
      w.events.push({ type: 'block', x: e.face > 0 ? e.x + e.w : e.x, y: e.y + e.h / 2 }); continue;
    }
    if (e.barrier > 0 && front && p.state !== 'flurry') {                // 강적 수호 방패: 정면은 막힘, 3번 맞으면 깨짐 (반격 연참은 넘김)
      e.barrier--; w.hitstop = Math.max(w.hitstop, 4); p.vx = -p.face * 2;
      if (e.barrier <= 0) breakBarrier(w, e); else w.events.push({ type: 'barrierHit', x: e.face > 0 ? e.x + e.w : e.x, y: e.y + e.h / 2, left: e.barrier });
      continue;
    }
    if (e.counter && !e.exposed && p.state !== 'flurry' && front && e.st === 'idle' && e.stunT <= 0) {   // 빛 속에선 반격 못 함        // 흑염의 순례자: 리라의 공격을 패링
      w.seed = (w.seed * 1664525 + 1013904223) >>> 0;
      if (w.seed / 4294967296 < 0.4) {
        w.hitstop = Math.max(w.hitstop, 6); w.shake = 6;
        p.state = 'hurt'; p.stateT = CFG.player.hurtStunF - 8; p.buffer = null;   // 8틱 경직 (피해 없음)
        e.atk = 'counter'; e.st = 'telegraph'; e.stT = 0;
        w.events.push({ type: 'enemyParry', x: e.face > 0 ? e.x + e.w : e.x, y: e.y + 20 });
        w.events.push({ type: 'telegraph', boss: true, parryable: true });
        continue;
      }
    }
    if (e.executing) continue;
    const behind = Math.sign((p.x + p.w / 2) - (e.x + e.w / 2)) === -e.face;   // 리라가 적 등 뒤에 있음
    if (!e.boss && e.unaware && (behind || p.mods.shadow20) && !(e.stunT > 0)) {   // 암살: 리라를 못 본 적의 등 뒤 (그림자 20: 어둠 속이면 어디서든)
      if (!e.elite || p.mods.shadowElite) { e.stunT = 1; e.poise = 1; w.events.push({ type: 'assassinate', x: e.x + e.w / 2, y: e.y }); }
      else { addPoise(w, e, 0.6); w.events.push({ type: 'assassinate', x: e.x + e.w / 2, y: e.y, elite: true }); }
    }
    if (e.stunT > 0) {                      // 그로기 → 처형 모션 시작 (피해는 베는 순간에)
      p.state = 'execute'; p.stateT = 0; p.execTarget = e; p.buffer = null; e.executing = true; p.execMode = null; p.chainNext = null;
      w.events.push({ type: 'executeStart', x: e.x + e.w / 2, y: e.y + e.h / 2 });
      return;
    } else {
      const RES = p.mods.res || {}, cc = (p.mods.critChance || 0) + (RES.gale && p.galeT > 0 ? 0.35 : 0) + (p.hp <= p.maxHp / 2 ? p.mods.lowHpCrit || 0 : 0);   // 투지 18
      if (!p.crit && cc) { w.seed = (w.seed * 1664525 + 1013904223) >>> 0; if (w.seed / 4294967296 < cc) p.crit = true; }   // 투지·질풍: 치명타 확률
      p.galeT = 0;
      const wasCrit = p.crit, mul = (1 + 0.1 * p.chainN) * (p.crit ? (p.mods.critMul || 2) : 1) * (p.mods.atkMul || 1)
        * (p.riposte ? 1.6 : 1) * (RES.grit && p.hp <= p.maxHp / 3 ? 1.4 : 1) * (p.powT > 0 ? 1 + (p.powK || 0) : 1) * (p.enchantT > 0 ? CFG.enchant.dmgMul * AFF_DMG[affinity(e, p.element) + 1] : 1);   // 상성: 약점 +20% · 저항 -15%   // 점화한 검은 피해 +12%   // 마법 효과: 공격 강화   // 공명 철벽 반격·버팀
      p.riposte = false;
      if (p.crit) { p.crit = false; w.events.push({ type: 'crit', x: e.x + e.w / 2, y: e.y }); }
      const spin = p.state === 'flurry', FL = CFG.flurry, fk = spin ? Math.max(0, flurryHit(p)) : 0, last = spin && fk === FL.hits.length - 1;
      const base = spin ? FL.dmg[fk] : CFG.attack.dmg[p.combo], pz = spin ? FL.poise[fk] : PO.hit * (p.combo === 2 ? p.mods.str3Poise || 1 : 1);   // 힘 16: 3타 자세 2배
      const dealt = damageEnemy(w, e, Math.round(base * mul), pz * (p.mods.poiseMul || 1));
      if (wasCrit && p.mods.critLight) p.light = Math.min(CFG.light.max, p.light + p.mods.critLight);   // 투지 16
      if (!e.dead) p.hitChain = (p.hitChain || 0) + 1;
      if (p.dark) { p.noiseT = 20; p.noiseR = CFG.snuff.noiseAtk * (p.mods.quietMul || 1); }   // 어둠 속에서 베면 소리가 나 다른 적이 돌아봄 (휘두르는 것만으론 소리 없음)
      if (p.enchantT > 0 && p.element && !e._affShown && affinity(e, p.element)) { e._affShown = true; w.events.push({ type: 'affinity', x: e.x + e.w / 2, y: e.y, el: p.element, aff: affinity(e, p.element) }); }   // 처음 벨 때 '약점'/'저항' 표시
      if (p.enchantT > 0 && !e.dead) elBuild(w, e, meleeBuild(p, e, spin, last, wasCrit));   // 점화한 불꽃: 속성마다 다른 방식으로 게이지
      if (p.combo === 2 && (p.mods.flame || RES.emberEdge)) e.burnT = 180;   // 화염 칼날 각인·공명 불꽃 칼날                       // 화염 칼날
      w.hitstop = Math.max(w.hitstop, spin ? FL.hitstop[fk] : CFG.attack.hitstop[p.combo]);
      e.kvx = p.face * (spin ? (last ? 7 : 1.2) : CFG.attack.push[p.combo]) * (e.boss ? 0.15 : 1);   // 연참: 앞 타는 붙잡아 두고 마지막에 날림
      if (p.combo === 2 || last) w.shake = Math.max(w.shake, last ? 9 : 6);
      w.events.push({ type: 'attackHit', x: e.x + e.w / 2, y: e.y + e.h / 2, combo: spin ? (last ? 2 : 0) : p.combo, face: p.face, dmg: dealt, crit: !!wasCrit, flurry: spin });
    }
  }
}

// 등불 마법 (스킬). 등장 중인 적은 맞지 않는다
const liveOf = w => w.enemies.filter(e => !e.dead && !(e.spawnT > 0));
function spellHit(w, e, dmg, poise, spell) {
  const p = w.player; let crit = false;
  if ((p.mods.res || {}).wildfire && p.mods.critChance) { w.seed = (w.seed * 1664525 + 1013904223) >>> 0; if (w.seed / 4294967296 < p.mods.critChance) { crit = true; dmg = Math.round(dmg * (p.mods.critMul || 2)); } }   // 공명 폭주 등불
  const wasDead = e.dead; dmg = damageEnemy(w, e, dmg, poise); spellPerk(w, e, spell, !wasDead && e.dead);
  w.hitstop = Math.max(w.hitstop, 3);                                   // 마법도 맞는 순간 멈칫 (손맛)
  w.events.push({ type: 'attackHit', x: e.x + e.w / 2, y: e.y + e.h / 2, combo: 1, face: w.player.face, dmg, crit, spell });
}
// 마법 효과: 올린 스탯의 장점을 키우거나, 내려간 반대 스탯의 약점을 메운다 (spells.js의 perk 설명과 짝)
// 적에게: rootT 발 묶음 · slowT 둔화 · brittleT 취약(받는 피해 +25%) · 예고 끊기 / 리라에게: 빛 환급 · 회복
export function spellPerk(w, e, spell, killed) {
  const p = w.player, B = e.boss ? 0.5 : 1, refund = n => { p.light = Math.min(CFG.light.max, p.light + n); };
  switch (spell) {
    case 'pillar': e.rootT = Math.max(e.rootT || 0, 120 * B); break;                         // 힘↑ 민첩↓: 느린 발 대신 적을 묶음
    case 'tornado': if (!e.boss) e.kvx = Math.sign((e.pullX ?? e.x) - e.x) * 3; e.rootT = Math.max(e.rootT || 0, 60 * B); break;
    case 'lance': e.brittleT = Math.max(e.brittleT || 0, 180); break;                         // 민첩↑ 힘↓: 약한 칼 대신 취약
    case 'spikes': e.slowT = Math.max(e.slowT || 0, 180); e.brittleT = Math.max(e.brittleT || 0, 120); break;
    case 'stars': e.slowT = Math.max(e.slowT || 0, 150); e.brittleT = Math.max(e.brittleT || 0, 180); break;
    case 'smite': refund(8); break;                                                          // 의지↑ 등불↓: 비싼 마법값 환급
    case 'thunder': refund(6); break;
    case 'wisps': if (!e.boss && e.st === 'telegraph') { e.st = 'idle'; e.stT = 0; e.cd = 40; w.events.push({ type: 'interrupt', x: e.x + e.w / 2, y: e.y }); } break;   // 등불↑ 의지↓: 막기 대신 끊기
    case 'spear': refund(12); break;
    case 'thorns': e.rootT = Math.max(e.rootT || 0, 150 * B); e.brittleT = Math.max(e.brittleT || 0, 150); break;   // 생명↑ 투지↓: 약한 공격 대신 취약
    case 'blast': if (killed && (p.blastHeal || 0) < 2 && p.hp < p.maxHp) { p.blastHeal = (p.blastHeal || 0) + 1; const h0 = p.hp; p.hp++; w.events.push({ type: 'heal', amount: 1, from: h0, x: p.x + p.w / 2, y: p.y + p.h, spell: true }); } break;   // 투지↑ 생명↓: 처치로 회복
  }
}
// 속성마다 게이지가 쌓이는 방식 = 그 스탯의 싸움 방식
//  화염(힘): 큰 한 방(3타·연참 마무리)  얼음(민첩): 구르기로 흘리기(패링·피격 쪽에서)  빛(의지): 패링(패링 쪽에서)
//  귀화(그림자): 등 뒤·어둠 속 공격  생명: 맞기(피격 쪽에서)  번개(투지): 맞지 않고 이어 때릴수록, 치명타
const AFF_BUILD = [0.5, 1, 1.6], AFF_DMG = [0.85, 1, 1.2];   // [저항, 보통, 약점]
function meleeBuild(p, e, spin, last, crit) {
  const behind = Math.sign((p.x + p.w / 2) - (e.x + e.w / 2)) === -e.face;
  switch (p.element || null) {
    case 'str': return spin ? (last ? 50 : 8) : p.combo === 2 ? 50 : 8;
    case 'agi': return 12;
    case 'wil': return 8;
    case 'lmp': return behind || p.dark || e.unaware ? 45 : 8;
    case 'vit': return 12;
    case 'fury': return 6 + 5 * Math.min(8, p.hitChain || 0) + (crit ? 30 : 0);
    default: return 18;
  }
}
// 속성 게이지: 점화한 검으로 벨 때마다 쌓이고, 가득 차면 속성 효과가 터진다 (보스는 훨씬 많이 필요)
export function elBuild(w, e, amt) {
  const p = w.player, E = CFG.enchant, el = p.element || null;
  e.elB = (e.elB || 0) + amt * AFF_BUILD[affinity(e, el) + 1]; e.elK = el;   // 상성: 약점 1.6배 · 저항 절반
  if (e.elB < (e.boss ? E.needBoss : E.need[p.enchTier || 0])) return;
  e.elB = 0; const B = e.boss ? 0.4 : 1, cx = e.x + e.w / 2, cy = e.y + e.h / 2, T = p.enchTier >= 2 ? 1.5 : 1;   // 17 이상: 폭발 1.5배
  switch (el) {
    case 'str': e.burnT = Math.max(e.burnT || 0, Math.round(241 * T)); addPoise(w, e, (e.boss ? 0.15 : 0.35) * T);   // 화염 폭발: 주변까지 터짐
      for (const o of liveOf(w)) if (o !== e && Math.abs(o.x + o.w / 2 - cx) < 90 && Math.abs(o.y - e.y) < 80) { damageEnemy(w, o, Math.round(20 * T), 0.2); o.burnT = Math.max(o.burnT || 0, 121); }
      break;                                       // 화상: 초당 3 × 4초
    case 'agi': e.staggerT = Math.max(e.staggerT || 0, Math.round(90 * B)); e.brittleT = Math.max(e.brittleT || 0, 180); e.frozenT = Math.round(90 * B); break;   // 빙결
    case 'wil': addPoise(w, e, (e.boss ? 0.3 : 0.7) * T); break;                                          // 심판의 빛: 자세 붕괴
    case 'lmp': p.light = Math.min(CFG.light.max, p.light + Math.round(30 * T)); e.slowT = Math.max(e.slowT || 0, 150); if (!e.boss) e.blindT = Math.round(150 * T); break;   // 혼 뽑기: 빛을 빼앗고 눈을 멀게 (리라를 놓침 → 암살로)   // 혼 뽑기
    case 'vit': for (const o of liveOf(w)) if (Math.abs(o.x + o.w / 2 - (p.x + p.w / 2)) < 90) damageEnemy(w, o, Math.round(16 * T), 0.15);   // 가시 반격
      if ((p.healBurst || 0) < 2 && p.hp < p.maxHp) { p.healBurst = (p.healBurst || 0) + 1; const h0 = p.hp; p.hp++; w.events.push({ type: 'heal', amount: 1, from: h0, x: p.x + p.w / 2, y: p.y + p.h }); } break;   // 흡수
    case 'fury': p.crit = true; for (const o of liveOf(w).filter(o => o !== e && Math.abs(o.x + o.w / 2 - cx) < 170).slice(0, 2)) { damageEnemy(w, o, 22, 0.15); o.staggerT = Math.max(o.staggerT || 0, 20); w.events.push({ type: 'zap', x0: cx, y0: cy, x1: o.x + o.w / 2, y1: o.y + o.h / 2 }); } e.staggerT = Math.max(e.staggerT || 0, 20); break;   // 방전
    default: e.burnT = Math.max(e.burnT || 0, 121);                                                  // 등불 불꽃: 약한 화상
  }
  w.events.push({ type: 'elBurst', el, x: cx, y: cy, boss: !!e.boss, ent: e });
  const sp = el && p.enchTier >= 2 ? STAT_SPELL[el][p.enchTier >= 3 ? 2 : 1] : null;   // 17: 속성 마법 · 20: 최종 마법 → 적에게 '마법 각인'. 그 적을 처형하면 처형 끝에 마법이 터진다
  if (sp && !e.dead && !e.sigil) { e.sigil = sp; e.sigilEl = el; w.events.push({ type: 'sigil', x: cx, y: e.y, spell: sp, el }); }
}
// 다시 켠 등불의 섬광: 주변 적이 눈이 부셔 휘청 (의지가 높을수록 넓게). 점화한 상태면 속성 게이지가 한 번에 차오른다
export function relightFlash(w) {
  const p = w.player, S = CFG.snuff, R = S.flashR * (p.mods.flashMul || 1), cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  for (const e of liveOf(w)) {
    if (Math.hypot(e.x + e.w / 2 - cx, (e.y + e.h / 2 - cy) * 1.4) > R + e.w / 2) continue;
    if (e.boss) addPoise(w, e, 0.18 * (p.mods.flashMul || 1)); else { e.staggerT = Math.max(e.staggerT || 0, S.flashStagger); e.st = 'idle'; e.atk = null; e.srcs = []; }
    const FB = (DARK_REACT[e.kind] || {}).flashBlind; if (FB && !e.boss) { e.blindT = Math.max(e.blindT || 0, FB); w.events.push({ type: 'dazzle', x: e.x + e.w / 2, y: e.y }); }   // 어둠눈(암살자): 섬광에 눈이 멂 → 암살 기회
    if (p.enchantT > 0) elBuild(w, e, e.boss ? CFG.enchant.needBoss * 0.5 : 999);
  }
  w.hitstop = Math.max(w.hitstop, 4); w.shake = Math.max(w.shake, 6);
  w.events.push({ type: 'flash', x: cx, y: cy, r: R, el: p.enchantT > 0 ? (p.element || null) : undefined });
}
// 가까운 적 (앞쪽 우선). 없으면 null
function nearestTarget(w, range) {
  const p = w.player, cx = p.x + p.w / 2;
  const list = liveOf(w).map(e => ({ e, dx: e.x + e.w / 2 - cx })).filter(o => Math.abs(o.dx) <= range);
  list.sort((a, b) => ((Math.sign(a.dx) === p.face ? 0 : 1000) + Math.abs(a.dx)) - ((Math.sign(b.dx) === p.face ? 0 : 1000) + Math.abs(b.dx)));
  return list[0] ? list[0].e : null;
}
export function resolveSkill(w, ev) {
  const p = w.player, S = CFG.skill[ev.spell], M = p.mods.spellMul || 1, cx = p.x + p.w / 2, PM = p.mods.poiseMul || 1;
  p.blastHeal = 0;
  const PK = { meteor: [300, 0.3], heal: [300, 0.25] }[ev.spell];          // 운석: 힘 강화 / 치유의 빛: 약한 투지 보완 — 공격 피해 +%
  if (PK) { p.powT = PK[0]; p.powK = PK[1]; }
  if (ev.spell === 'thunder') p.sharpT = 240;                            // 낙뢰: 4초 완벽 패링 +2프레임
  if (ev.spell === 'ring') p.iframes = Math.max(p.iframes, 50);           // 불꽃 고리: 약한 패링 보완 — 잠깐 무적
  if (ev.spell === 'chain') p.crit = true;                                // 연쇄 번개: 다음 공격 치명타
  if (ev.spell === 'sanctum') p.shieldT = 600;                            // 성광 기둥: 10초 보호막 1회
  if (ev.spell === 'drain') p.powT = 0;
  const aim = nearestTarget(w, 520);                                    // 자동 조준: 가장 가까운 적(앞쪽 우선) 쪽으로 돌아서 쏜다
  if (aim && !ev.auto) { p.face = Math.sign(aim.x + aim.w / 2 - cx) || p.face; ev.face = p.face; }
  else if (aim) ev.face = Math.sign(aim.x + aim.w / 2 - cx) || p.face;   // 속성 폭발 마법: 리라는 그대로, 마법만 적 쪽으로
  const live = liveOf(w);
  if (ev.spell === 'bolt' || ev.spell === 'lance' || ev.spell === 'wisps') {
    const n = S.n || (ev.spell === 'bolt' && p.mods.lmp7 ? 2 : 1);  // 등불 14: 등불 탄 두 발 · 도깨비불 3발
    const spread = n === 3 ? [-0.9, 0, 0.9] : n === 2 ? [-0.25, 0.25] : [0];
    for (let i = 0; i < n; i++) w.projectiles.push({ x: p.face > 0 ? p.x + p.w : p.x - 16, y: p.y + 18 + (n > 1 ? (i - (n - 1) / 2) * 10 : 0), w: 16, h: 12,
      vx: p.face * S.speed, vy: spread[i], pdmg: Math.round(S.dmg * M), poise: S.poise, owner: 'player',
      bolt: ev.spell === 'lance' ? 'lance' : ev.spell === 'wisps' ? 'wisp' : 'lamp', spell: ev.spell, pierce: ev.spell === 'lance', homing: !!S.homing, spd: S.speed, life: 110, hits: [], src: {} });
  } else if (S.line) {                                                 // 바닥 직선: 앞쪽 line px 안의 땅 위 적 (가시가 지나가는 시간만큼 늦게)
    const x0 = p.face > 0 ? p.x + p.w : p.x - S.line;
    ev.tx = cx; w.pending.push({ t: S.delay, spell: ev.spell, x: x0 + S.line / 2, dmg: Math.round(S.dmg * M), poise: S.poise * PM, r: S.line / 2, y0: p.y - 20, y1: p.y + p.h + 10 });
  } else if (S.delay) {                                                // 착탄형: 표적 자리에 이펙트를 먼저 띄우고, 떨어지는 순간 피해
    let tx;
    if (ev.spell === 'stars') tx = cx + p.face * S.ahead;
    else { const t = nearestTarget(w, S.range); tx = t ? t.x + t.w / 2 : cx + p.face * 120; }
    ev.tx = tx; ev.ty = 300;
    if (ev.spell === 'tornado') for (const e of live) e.pullX = tx - e.w / 2;
    (S.ticks || [0]).forEach((ox, i) => w.pending.push({ t: S.delay + i * (S.gap || 0), spell: ev.spell, x: tx + ox * p.face, dmg: Math.round(S.dmg * M), poise: S.poise * PM, r: S.radius }));
  } else if (ev.spell === 'drain') {                                   // 흡혈: 가장 가까운 적 하나, 맞히면 체력 회복
    const t = nearestTarget(w, S.range); ev.tx = t ? t.x + t.w / 2 : null;
    if (t) { spellHit(w, t, Math.round(S.dmg * M), S.poise * PM, 'drain');
      const hp0 = p.hp; p.hp = Math.min(p.maxHp, p.hp + S.heal); if (p.hp > hp0) w.events.push({ type: 'heal', amount: p.hp - hp0, from: hp0, x: cx, y: p.y + p.h, spell: true }); }
  } else if (ev.spell === 'ring') {
    for (const e of live) if (Math.abs(e.x + e.w / 2 - cx) <= S.radius && Math.abs(e.y + e.h / 2 - (p.y + p.h / 2)) < 120) spellHit(w, e, Math.round(S.dmg * M), 0.2 * PM, 'ring');
    w.projectiles = w.projectiles.filter(b => b.owner !== 'enemy');
    w.shake = Math.max(w.shake, 8);
  } else if (ev.spell === 'ward') {
    p.blueT = S.blueF;
    for (const e of live) if (Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - (p.y + p.h / 2)) <= S.radius + e.w / 2) spellHit(w, e, Math.round(S.dmg * M), 0.2 * PM, 'ward');
  } else if (ev.spell === 'chain') {                                  // 앞쪽 가까운 적부터 n명
    live.filter(e => Math.sign(e.x + e.w / 2 - cx) === p.face && Math.abs(e.x + e.w / 2 - cx) <= S.range)
      .sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx)).slice(0, S.n).forEach(e => spellHit(w, e, Math.round(S.dmg * M), S.poise * PM, 'chain'));
  } else if (ev.spell === 'heal' || ev.spell === 'sanctum') {
    const hp0 = p.hp; p.hp = Math.min(p.maxHp, p.hp + S.heal);
    w.events.push({ type: 'heal', amount: p.hp - hp0, from: hp0, x: cx, y: p.y + p.h, spell: true });
  }
  if (ev.spell === 'sanctum') {
    for (const e of live) if (Math.abs(e.x + e.w / 2 - cx) <= S.radius + e.w / 2 && Math.abs(e.y + e.h / 2 - (p.y + p.h / 2)) < 120) spellHit(w, e, Math.round(S.dmg * M), S.poise * PM, 'sanctum');
  } else if (ev.spell === 'spear') {
    const x0 = p.face > 0 ? p.x + p.w : p.x - S.len, x1 = x0 + S.len;
    for (const e of live) if (e.x + e.w > x0 && e.x < x1 && e.y < p.y + p.h && e.y + e.h > p.y) spellHit(w, e, Math.round(S.dmg * M), S.poise * PM, 'spear');
    w.shake = Math.max(w.shake, 6);
  }
}
// 지연 마법 착탄: 그 자리 반경 안의 적
export function landSkill(w, d) {
  w.events.push({ type: 'spellLand', spell: d.spell, x: d.x, r: d.r });     // 착탄 순간 연출용
  for (const e of liveOf(w)) if (Math.abs(e.x + e.w / 2 - d.x) <= d.r + e.w / 2 && (d.y0 == null || (e.y + e.h > d.y0 && e.y < d.y1))) spellHit(w, e, d.dmg, d.poise, d.spell);
  w.shake = Math.max(w.shake, d.spell === 'meteor' || d.spell === 'blast' ? 12 : 7);
  if (d.spell === 'meteor' || d.spell === 'thunder' || d.spell === 'smite' || d.spell === 'blast') w.hitstop = Math.max(w.hitstop, 5);
}

// 처형 모션: 적 옆으로 파고들고, hitF에 벤다. 일반 적은 즉사, 보스는 최대 체력의 15%(×각인·투지)
export function updateExecute(w) {
  const p = w.player, X = CFG.execute, t = p.stateT;
  if (p.state === 'execute' && p.chainNext && !p.execTarget && t >= p.execHit + X.chainGapF) {   // 연속 처형: 다음 그로기 적에게 돌진
    const n = p.chainNext; p.chainNext = null;
    if (!n.dead) {
      p.stateT = 0; p.execTarget = n; p.execMode = 'chain'; p.vy = 0;
      w.events.push({ type: 'execDash', x0: p.x + p.w / 2, x1: n.x + n.w / 2, y: p.y + p.h, face: Math.sign(n.x - p.x) || 1 });
      w.events.push({ type: 'executeStart', x: n.x + n.w / 2, y: n.y + n.h / 2, chain: true });
      return;
    }
  }
  const e = p.execTarget;
  if (p.state !== 'execute' || !e) return;
  const hitF = p.execMode === 'chain' ? X.chainHitF : X.hitF; p.execHit = hitF;
  if (t < hitF && !e.dead) {
    const side = Math.sign((p.x + p.w / 2) - (e.x + e.w / 2)) || -1, tx = side > 0 ? e.x + e.w + 2 : e.x - p.w - 2;
    p.x += (tx - p.x) * (p.execMode === 'chain' ? 0.45 : 0.3); p.face = -side; p.vx = 0;   // 연속 처형은 빠르게 파고듦
  }
  if (t === hitF) {
    e.executing = false; e.stunT = 0; e.poise = 0; p.executes = (p.executes || 0) + 1;
    if (!e.dead) damageEnemy(w, e, e.boss ? Math.round(e.maxHp * PO.executeFrac * p.mods.execMul * (p.mods.furyExec || 1) * (p.mods.execBonus || 1)) : e.hp);
    w.hitstop = Math.max(w.hitstop, 12); w.shake = 12;
    if (p.mods.str10) for (const o of w.enemies) if (o !== e && !o.dead && Math.abs(o.x - e.x) < 320) addPoise(w, o, 0.4);   // 힘 10
    if ((p.mods.res || {}).slayer) { p.light = Math.min(CFG.light.max, p.light + 30); p.crit = true; }   // 공명 처단
    w.events.push({ type: 'execute', x: e.x + e.w / 2, y: e.y + e.h / 2, boss: !!e.boss });
    if (e.sigil) {                                                        // 마법 각인이 새겨진 적을 처형: 처형의 일격과 함께 속성 마법이 터진다
      const ev = { type: 'skill', spell: e.sigil, x: p.x + p.w / 2, y: p.y + 24, face: p.face, auto: true, exec: true }; e.sigil = null;
      w.events.push(ev); resolveSkill(w, ev);
    }
    // 연속 처형: 5초 안에 다음 처형 → 단계마다 빛 +20, 3연속부터 체력 1 (점수도 단계만큼)
    p.execChain = p.execChainT > 0 ? (p.execChain || 1) + 1 : 1; p.execChainT = X.chainF;
    if (p.execChain >= 2) {
      p.light = Math.min(CFG.light.max, p.light + X.chainLight * (p.execChain - 1));
      if (p.execChain >= 3 && p.hp < p.maxHp) { const h0 = p.hp; p.hp++; w.events.push({ type: 'heal', amount: 1, from: h0, x: p.x + p.w / 2, y: p.y + p.h }); }
      w.events.push({ type: 'execChain', n: p.execChain, x: e.x + e.w / 2, y: e.y });
    }
    p.execTarget = null;
    // 근처에 그로기 적이 또 있으면 이어서 처형 (놓치지 않게 미리 붙잡아 둠)
    const cx = e.x + e.w / 2, nx = w.enemies.filter(o => o !== e && !o.dead && o.stunT > 0 && !o.executing && Math.abs(o.x + o.w / 2 - cx) < X.chainRange && Math.abs(o.y - e.y) < 140)
      .sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx))[0];
    if (nx) { p.chainNext = nx; nx.executing = true; }
  }
}

// 적 자세 게이지 회복·그로기 시간
export function updatePoise(e) {
  if (e.stunT > 0) { if (!e.executing && --e.stunT === 0) e.poise = 0; return; }   // 처형당하는 중엔 그로기 유지
  if (e.poiseRegenT > 0) e.poiseRegenT--;
  else if (e.poise > 0) e.poise = Math.max(0, e.poise - PO.regenPerF);
}
