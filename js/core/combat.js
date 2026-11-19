// 판정: 리라 공격 → 적, 적 공격 → 리라(패링/피격), 자세 게이지, 필살
import { CFG } from './config.js';
import { attackBox, invulnerable, overlap } from './player.js';

const PR = CFG.parry, PO = CFG.poise;

// 적 히트박스 하나를 리라에게 판정. 반환: 'perfect'|'normal'|'hit'|'ignored'
// hitbox = { src, owner, x,y,w,h, dmg, parryable, dir }  (src.done이면 이미 처리된 공격)
export function resolveEnemyHit(w, hb) {
  const p = w.player;
  if (hb.src.done || p.state === 'dead' || !overlap(p, hb)) return 'ignored';
  const front = hb.dir === -p.face;
  if (p.state === 'parry' && p.stateT < PR.normalF && hb.parryable && front) {
    const perfect = p.stateT < PR.perfectF;
    hb.src.done = true;
    p.parryOk = true; p.recoverWait = PR.successRecoverF;
    p.light = Math.min(CFG.light.max, p.light + (perfect ? CFG.light.perfect : CFG.light.normal) * p.mods.lightMul);
    if (perfect && p.mods.chain) p.chainN = Math.min(5, p.chainN + 1);          // 불씨 연쇄
    if (perfect && p.mods.echo) w.projectiles.push({                           // 반향: 앞으로 검기
      x: p.face > 0 ? p.x + p.w : p.x - 24, y: p.y + 18, w: 24, h: 14, vx: p.face * 6, vy: 0,
      dmg: 1.5, parryable: true, owner: 'player', life: 50, echo: true, src: {} });
    w.hitstop = Math.max(w.hitstop, perfect ? PR.hitstopPerfect : PR.hitstopNormal);
    if (perfect) { p.perfectParries++; w.shake = 8; }
    const o = hb.owner;
    if (o && o.poiseMax) addPoise(w, o, perfect ? PO.perfect : PO.normal);
    if (o && perfect && !o.boss && o.st) {   // 완벽 패링: 일반 적은 공격이 끊기고 튕겨나며 잠깐 무방비
      o.st = 'idle'; o.stT = 0; o.atk = null; o.srcs = []; o.staggerT = PR.staggerF;
      o.kvx = Math.sign((o.x + o.w / 2) - (p.x + p.w / 2) || p.face) * PR.staggerPush;
    }
    w.events.push({ type: 'parry', perfect, x: p.face > 0 ? p.x + p.w : p.x, y: p.y + 14 });
    return perfect ? 'perfect' : 'normal';
  }
  if (invulnerable(p)) {
    if (p.state === 'roll' && p.mods.afterglow && !hb.src.glow) { hb.src.glow = true; p.crit = true; w.events.push({ type: 'afterglow', x: p.x + p.w / 2, y: p.y }); }
    return 'ignored';
  }
  hb.src.done = true;
  p.hp -= hb.dmg; p.chainN = 0;
  p.iframes = CFG.player.iframesHurt;
  p.buffer = null;
  p.vx = (hb.dir || -p.face) * 1.5; p.vy = -2;
  if (p.hp <= 0) { p.hp = 0; p.state = 'dead'; p.stateT = 0; w.over = true; }
  else { p.state = 'hurt'; p.stateT = 0; }
  w.shake = Math.max(w.shake, 5);
  w.events.push({ type: 'hurt', x: p.x + p.w / 2, y: p.y + 10 });
  return 'hit';
}

export function addPoise(w, e, frac) {
  if (!e.poiseMax || e.stunT > 0) return;
  e.poise = Math.min(1, e.poise + frac);
  e.poiseRegenT = PO.regenDelayF;
  if (e.poise >= 1) {
    // 그로기: 하던 공격은 취소 → 풀린 뒤엔 반드시 새 예고부터 (예고 없는 공격 방지)
    e.stunT = PO.stunF; e.st = 'idle'; e.stT = 0; e.atk = null; e.srcs = []; e.cd = 40;
    w.events.push({ type: 'stun', x: e.x + e.w / 2, y: e.y });
  }
}

export function damageEnemy(w, e, dmg, poiseFrac = 0) {
  if (e.dead) return;
  e.hp -= dmg;
  e.flash = 6;
  addPoise(w, e, poiseFrac);
  if (e.hp <= 0) {
    e.hp = 0; e.dead = true;
    w.player.light = Math.min(CFG.light.max, w.player.light + CFG.light.kill * w.player.mods.lightMul);
    w.events.push({ type: 'kill', x: e.x + e.w / 2, y: e.y + e.h / 2, boss: !!e.boss });
  }
}

// 리라 공격 판정 (한 번 휘두를 때 적마다 1회)
export function resolvePlayerAttacks(w) {
  const p = w.player, box = attackBox(p);
  if (!box) return;
  for (const e of w.enemies) {
    if (e.dead || e.hitBy === p.swing || !overlap(box, e)) continue;
    e.hitBy = p.swing;
    if (e.stunT > 0) {                      // 그로기 → 처형
      e.stunT = 0; e.poise = 0;
      damageEnemy(w, e, Math.round(e.maxHp * PO.executeFrac * p.mods.execMul));
      w.hitstop = Math.max(w.hitstop, 10); w.shake = 10;
      w.events.push({ type: 'execute', x: e.x + e.w / 2, y: e.y + e.h / 2 });
    } else {
      const mul = (1 + 0.1 * p.chainN) * (p.crit ? 2 : 1);
      if (p.crit) { p.crit = false; w.events.push({ type: 'crit', x: e.x + e.w / 2, y: e.y }); }
      damageEnemy(w, e, Math.round(CFG.attack.dmg[p.combo] * mul), PO.hit);
      if (p.combo === 2 && p.mods.flame) e.burnT = 180;                       // 화염 칼날
      w.hitstop = Math.max(w.hitstop, CFG.attack.hitstop[p.combo]);
      e.kvx = p.face * CFG.attack.push[p.combo] * (e.boss ? 0.15 : 1);
      if (p.combo === 2) w.shake = Math.max(w.shake, 6);
      w.events.push({ type: 'attackHit', x: e.x + e.w / 2, y: e.y + e.h / 2, combo: p.combo, face: p.face });
    }
  }
}

// 필살: 반경 내 적 피해 + 적 탄 소거
export function resolveUlt(w) {
  const p = w.player, cx = p.x + p.w / 2;
  for (const e of w.enemies)
    if (!e.dead && Math.abs(e.x + e.w / 2 - cx) <= CFG.ult.radius) damageEnemy(w, e, CFG.ult.dmg);
  w.projectiles = w.projectiles.filter(b => b.owner !== 'enemy');
  w.shake = 12;
}

// 적 자세 게이지 회복·그로기 시간
export function updatePoise(e) {
  if (e.stunT > 0) { if (--e.stunT === 0) e.poise = 0; return; }
  if (e.poiseRegenT > 0) e.poiseRegenT--;
  else if (e.poise > 0) e.poise = Math.max(0, e.poise - PO.regenPerF);
}
