// 월드 생성과 한 틱 진행. DOM 없음 → Node에서 그대로 테스트
import { CFG } from './config.js?v=mwqg9aps';
import { gimmickProps, updateGimmick, breakVeil, GIMMICK } from './gimmick.js?v=mwqg9aps';
import { updateLevel, dropPickups } from './level.js?v=mwqg9aps';
import { createPlayer, updatePlayer, overlap } from './player.js?v=mwqg9aps';
import { spawnEnemy, updateEnemy, ENEMY_DEFS, makeElite, updateElite } from './enemies.js?v=mwqg9aps';
import { resolveEnemyHit, resolvePlayerAttacks, resolveSkill, landSkill, updatePoise, damageEnemy, updateExecute, spellPerk, relightFlash } from './combat.js?v=mwqg9aps';
import { ACTIONS } from './player.js?v=mwqg9aps';

export const BOSS_DEATH_F = 160, BOSS_FALL_F = 96;   // 보스 사망 연출 길이 · 마지막 폭발 시점 (틱)
// 보스마다 다른 넓은 무대 (폭 1600). 벽·바닥 + 언덕(높이 있는 바닥) + 통과 발판
const walls = W => [{ x: -40, y: 0, w: 40, h: 360 }, { x: W, y: 0, w: 40, h: 360 }, { x: -40, y: 300, w: W + 80, h: 60 }];
const plat = (x, y, w = 120) => ({ x, y, w, h: 8, oneWay: true });
const hill = (x, w, h) => ({ x, y: 300 - h, w, h });
export const BOSS_ARENAS = {
  bellBoss: { width: 1600, solids: [...walls(1600), hill(80, 200, 34), hill(1320, 200, 34), plat(330, 194), plat(1150, 194)], spawn: { x: 320, y: 230 } },   // 묘지 예배당: 양쪽 무덤 언덕 (가운데 위는 대종)
  saint:    { width: 1600, solids: [...walls(1600), hill(200, 260, 44), hill(1140, 260, 44), plat(560, 192), plat(920, 192), plat(740, 120, 120)], spawn: { x: 520, y: 230 } },    // 침수 성당: 양쪽 제단 (물이 차면 피난처)
  spider:   { width: 1600, solids: [...walls(1600), hill(660, 280, 26), plat(220, 196), plat(420, 140), plat(1060, 140), plat(1260, 196), plat(740, 100, 120)], spawn: { x: 160, y: 230 } },   // 유리 광산: 가운데 바위 둔덕, 계단식 발판
  shadow:   { width: 1600, solids: [...walls(1600), plat(420, 194), plat(620, 140), plat(860, 140), plat(1060, 194)], spawn: { x: 160, y: 230 } },   // 무너진 성소: 가운데 높은 발판 둘
  forge:    { width: 1600, solids: [...walls(1600), plat(300, 194), plat(1180, 194), plat(740, 126, 120)], spawn: { x: 160, y: 230 } },   // 용광로: 양쪽 증기 밸브(420·1180) 사이 넓은 바닥
  king:     { width: 1600, solids: [...walls(1600), hill(960, 200, 24), plat(480, 192), plat(1040, 186)], spawn: { x: 160, y: 230 } },   // 왕좌의 방: 가운데 낮은 단 · 사슬 닻 셋
};
export const EMPTY_INPUT = Object.freeze({
  left: false, right: false, down: false, jumpHeld: false,
  jump: false, attack: false, parry: false, roll: false, skill: false, flask: false,
  snuff: false,
});

const ROOMS = {
  arena: {
    width: 1280,
    solids: [
      { x: -40, y: 0, w: 40, h: 360 }, { x: 1280, y: 0, w: 40, h: 360 },
      { x: -40, y: 300, w: 1360, h: 60 },
      { x: 340, y: 210, w: 150, h: 8, oneWay: true },
      { x: 820, y: 210, w: 150, h: 8, oneWay: true },
    ],
    spawn: { x: 160, y: 230 },   // 왼쪽 아래 스틱 뒤에 가리지 않게
  },
  boss: {                                                          // 기본 보스방 (BOSS_ARENAS가 없을 때)
    width: 1120,
    solids: [
      { x: -40, y: 0, w: 40, h: 360 }, { x: 1120, y: 0, w: 40, h: 360 },
      { x: -40, y: 300, w: 1200, h: 60 },
      { x: 170, y: 218, w: 120, h: 8, oneWay: true }, { x: 500, y: 196, w: 120, h: 8, oneWay: true }, { x: 830, y: 218, w: 120, h: 8, oneWay: true },
    ],
    spawn: { x: 160, y: 230 },
  },
};

export function createWorld({ room = 'arena', solids, spawn, width, boss = 'bellBoss', variant = null, hpMul = 1 } = {}) {
  const def = (room === 'boss' && BOSS_ARENAS[boss]) || ROOMS[room] || { width: width || 2000, solids: [], spawn: { x: 100, y: 250 } };
  const sp = spawn || def.spawn || { x: 160, y: 230 };
  const w = {
    room, t: 0, hitstop: 0, shake: 0,
    width: width || def.width,
    solids: solids || def.solids,
    player: createPlayer(sp.x, sp.y),
    enemies: [], projectiles: [], hitboxes: [], fx: [], events: [],
    camX: 0, over: false, won: false, cleared: false, seed: 12345,
    waves: [], waveDelay: 0, hpMul, pending: [],
  };
  if (room === 'arena') w.waves = [[['ghoul', 520], ['ghoul', 600], ['moth', 700]], [['ghoul', 900], ['moth', 1000]]];
  if (room === 'boss') {
    spawnEnemy(w, boss, w.width * 0.68, 300 - ENEMY_DEFS[boss].h - 2, { variant, hpMul });   // 바닥 위에서 시작
    w.props = gimmickProps(boss);                                         // 보스마다 고유 기믹 오브젝트
  }
  updateCamera(w);
  return w;
}

// 쉼터: 오브젝트 가까이서 공격 버튼 = 상호작용 (휘두르지 않음), 오른쪽 출구에 닿으면 나감
export const INTERACT_R = 56;
export function nearProp(w) {
  const p = w.player, cx = p.x + p.w / 2;
  return (w.props || []).find(o => ['merchant', 'campfire', 'altar', 'keeper', 'board', 'rack'].includes(o.kind) && Math.abs(o.x - cx) < INTERACT_R) || null;
}
// 오브젝트: 상인·모닥불은 공격 버튼으로 이용, 출구는 열려 있으면 닿는 순간 나감 (전투방은 적을 다 잡아야 열림)
function propInput(w, inp) {
  const o = nearProp(w), p = w.player;
  if (o && inp.attack) { w.events.push({ type: 'interact', kind: o.kind }); inp = { ...inp, attack: false }; }
  const exit = w.props.find(o => o.kind === 'exit');
  if (exit && w.cleared) exit.locked = false;
  if (exit && !exit.locked && (exit.portal ? Math.abs(p.x + p.w / 2 - exit.x) < 22 : p.x + p.w / 2 > exit.x - 12) && !w.exited) { w.exited = true; w.events.push({ type: 'exit' }); }   // 보스 포탈은 그 자리에 들어서면
  return inp;
}

// x~x+bw 위치의 바닥 높이 (언덕 위면 언덕 윗면)
export function groundAt(w, x, bw = 1) {
  let y = 300;
  for (const s of w.solids) if (!s.oneWay && s.h > 8 && s.y >= 180 && x + bw > s.x && x < s.x + s.w) y = Math.min(y, s.y);
  return y;
}

function updateCamera(w) {
  const p = w.player, vw = CFG.VIEW_W;
  w.camX = Math.max(0, Math.min(w.width - vw, p.x + p.w / 2 - vw * 0.4));
}

// 웨이브: 적이 다 죽으면 60틱 뒤 다음 웨이브. 마지막까지 끝나면 cleared
function updateWaves(w) {
  if (w.room === 'boss') {
    if (!w.enemies.length && !w.won && (!w.bossDeath || w.bossDeath.t >= BOSS_DEATH_F)) {   // 연출이 끝나면 쓰러진 자리에 포탈이 열린다
      w.won = true; const D = w.bossDeath, x = D ? Math.max(220, Math.min(w.width - 220, D.e.x + D.e.w / 2)) : w.width / 2;
      (w.props = w.props || []).push({ kind: 'exit', x, portal: true }); w.events.push({ type: 'win', x });
    }
    return;
  }
  if (w.enemies.length || w.cleared || w.room !== 'arena' || w.holdWaves) return;   // holdWaves: 튜토리얼에서 준비될 때까지 대기
  if (!w.waves.length) { w.cleared = true; w.events.push({ type: 'cleared' }); return; }
  if (++w.waveDelay < 60) return;
  w.waveDelay = 0;
  const px = w.player.x + w.player.w / 2;
  for (let [kind, x, mod, emod] of w.waves.shift()) {
    // 리라 바로 옆(200px 안)에는 생기지 않게: 반대쪽으로 밀어 낸다
    if (Math.abs(x - px) < 200) x = px + (x >= px ? 220 : -220 - ENEMY_DEFS[kind].w);
    if (x < 40 || x > w.width - 40 - ENEMY_DEFS[kind].w) x = px < w.width / 2 ? Math.min(w.width - 60 - ENEMY_DEFS[kind].w, px + 240) : Math.max(40, px - 240 - ENEMY_DEFS[kind].w);
    const e = spawnEnemy(w, kind, x, kind === 'moth' ? 160 : groundAt(w, x, ENEMY_DEFS[kind].w) - ENEMY_DEFS[kind].h - 2, { hpMul: w.hpMul, emerge: true });
    if (mod === 'elite') makeElite(e, emod || 'iron');
  }
}

export function tick(w, inp) {
  w.events.length = 0;
  w.t++;
  if (w.hitstop > 0) {          // 히트스톱: 세계는 멈추고 입력만 버퍼에 쌓음
    w.hitstop--;
    const p = w.player;
    if (p.recoverWait > 0) p.recoverWait--;
    for (const a of ACTIONS)
      if (inp[a]) p.buffer = { action: a, t: CFG.player.bufferF };
    return;
  }
  if (w.shake > 0) w.shake--;
  w.hitboxes.length = 0;

  if (w.props) inp = propInput(w, inp);
  for (const o of w.props || []) if (o.cd > 0) o.cd--;
  updatePlayer(w, inp);
  updateExecute(w);
  for (const ev of [...w.events]) if (ev.type === 'skill') resolveSkill(w, ev); else if (ev.type === 'relightFlash') relightFlash(w);   // 다시 켠 등불의 섬광
  for (const d of w.pending) if (--d.t <= 0) landSkill(w, d);             // 지연 마법: 이펙트가 떨어지는 순간 피해
  w.pending = w.pending.filter(d => d.t > 0);

  for (const e of w.enemies) {
    if (e.dead) continue;
    if (e.flash > 0) e.flash--;
    if (e.roarT > 0) { e.roarT--; e.vx = 0; continue; }                   // 2막 포효 중: 멈춤·무적
    if (e.burnT > 0 && --e.burnT % 60 === 0) { damageEnemy(w, e, 3); if (e.dead) continue; }   // 화상
    updatePoise(e);
    if (e.elite || e.decoy) updateElite(w, e);
    if (e.dead) continue;
    if (e.stunT > 0) continue;
    updateEnemy(w, e);
  }
  if (w.room === 'boss') updateGimmick(w, damageEnemy);
  updateLevel(w, damageEnemy);
  separateBodies(w);
  updateProjectiles(w);

  resolvePlayerAttacks(w);
  for (const hb of w.hitboxes) if (resolveEnemyHit(w, hb) === 'hit' && hb.hazard) { w.player.vy = -6.5; w.player.onGround = false; }   // 가시·불기둥: 맞으면 튕겨 오름
  for (const ev of w.events) if (ev.type === 'kill' && !ev.boss && !ev.dummy && !ev.decoy) dropPickups(w, ev.x, ev.y, ev.elite ? 5 : 1 + (ev.x | 0) % 2);   // 처치: 불씨 1~2 (엘리트 5)
  for (const e of w.enemies) if (e.dead && e.mods && e.mods.includes('split'))   // 분열: 나방 둘
    for (const k of [-1, 1]) spawnEnemy(w, 'moth', e.x + k * 20, e.y - 10, { hpMul: w.hpMul });
  for (const e of w.enemies) if (e.dead && e.boss && w.room === 'boss' && !w.bossDeath) {   // 보스 쓰러짐: 사망 연출 시작 (적 탄·분출구 정리)
    w.bossDeath = { t: 0, e }; w.projectiles = w.projectiles.filter(b => b.owner !== 'enemy'); if (w.level) w.level.vents = [];
    w.events.push({ type: 'bossDying', kind: e.kind, x: e.x + e.w / 2, y: e.y + e.h / 2 });
  }
  if (w.bossDeath && w.bossDeath.t < BOSS_DEATH_F && ++w.bossDeath.t === BOSS_FALL_F) w.events.push({ type: 'bossFall', kind: w.bossDeath.e.kind, x: w.bossDeath.e.x + w.bossDeath.e.w / 2, y: w.bossDeath.e.y + w.bossDeath.e.h / 2 });
  w.enemies = w.enemies.filter(e => !e.dead);
  updateWaves(w);
  updateCamera(w);
}

// 몸 충돌: 걷기·점프로는 적을 통과하지 못한다 (구르기 무적 중에는 빠져나갈 수 있음). 겹치면 리라를 가까운 쪽으로 밀어 냄
function separateBodies(w) {
  const p = w.player;
  if (p.state === 'execute' || p.state === 'dead' || p.state === 'roll') return;
  for (const e of w.enemies) {
    if (e.dead || e.spawnT > 0 || ENEMY_DEFS[e.kind]?.fly || !overlap(p, e)) continue;
    const pc = p.x + p.w / 2, ec = e.x + e.w / 2, left = pc < ec;
    let nx = left ? e.x - p.w : e.x + e.w;
    if (nx < 0 || nx + p.w > w.width) nx = left ? e.x + e.w : e.x - p.w;   // 벽에 끼면 반대쪽으로
    nx = Math.max(0, Math.min(w.width - p.w, nx));
    if (p.y + p.h - 10 < e.y && p.vy >= 0) { p.x = nx; continue; }          // 위에서 떨어지면 옆으로 미끄러짐 (머리 위에 서지 않음)
    p.x = nx; if (Math.sign(p.vx) === (left ? 1 : -1)) p.vx = 0;
  }
}

// 유도: 남은 적 중 가장 가까운 쪽으로 한 틱에 최대 0.14라디안 회전 (관통탄은 이미 맞은 적 제외)
function steer(w, b) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  let best = null, bd = 420;
  for (const e of w.enemies) {
    if (e.dead || e.spawnT > 0 || (b.hits && b.hits.includes(e))) continue;
    const d = Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy); if (d < bd) { bd = d; best = e; }
  }
  if (!best) return;
  const want = Math.atan2(best.y + best.h / 2 - cy, best.x + best.w / 2 - cx), cur = Math.atan2(b.vy, b.vx);
  let da = want - cur; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
  const a = cur + Math.max(-0.14, Math.min(0.14, da)), sp = b.spd || Math.hypot(b.vx, b.vy);
  b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
}

// 탄: 이동, 지형/수명 소멸. 적 탄은 리라 판정, 반사된 탄은 적 판정
function updateProjectiles(w) {
  for (const b of w.projectiles) {
    if (b.homing) steer(w, b);                                          // 유도탄: 가까운 적 쪽으로 방향을 틀며 날아감
    b.x += b.vx; b.y += b.vy; b.life--;
    if (b.life <= 0 || w.solids.some(s => !s.oneWay && overlap(b, s))) { b.dead = true; continue; }
    if (b.owner === 'enemy') {
      const r = resolveEnemyHit(w, { src: b, owner: b.src, x: b.x, y: b.y, w: b.w, h: b.h, dmg: b.dmg, parryable: b.parryable, dir: Math.sign(b.vx), proj: true });
      if (r === 'perfect') { b.vx *= -1.5; b.owner = 'player'; b.done = false; b.life = 90; b.reflected = true; }
      else if (r !== 'ignored') b.dead = true;
    } else {
      const e = w.enemies.find(e => !e.dead && !(e.spawnT > 0) && overlap(b, e) && !(b.hits && b.hits.includes(e)));
      if (e) {
        let dmg = b.pdmg ?? b.dmg * 15;                                     // 반사탄은 dmg×15, 마법·검기는 pdmg
        if (breakVeil(w, e, b)) { b.dead = true; dmg = damageEnemy(w, e, GIMMICK.veil.breakDmg, GIMMICK.veil.breakPoise); w.hitstop = Math.max(w.hitstop, 8); w.shake = Math.max(w.shake, 10); w.events.push({ type: 'attackHit', x: e.x + e.w / 2, y: e.y + e.h / 2, combo: 2, face: Math.sign(b.vx) || 1, dmg, crit: true }); continue; }   // 물의 장막 깨기
        const wasDead = e.dead; dmg = damageEnemy(w, e, dmg, (b.poise ?? CFG.poise.normal) * (w.player.mods.poiseMul || 1));
        if (b.spell) spellPerk(w, e, b.spell, !wasDead && e.dead);         // 마법 효과 (얼음 창 취약 · 도깨비불 예고 끊기)
        if (b.pierce) b.hits.push(e); else b.dead = true;                  // 얼음 창: 관통
        w.events.push({ type: 'attackHit', x: e.x + e.w / 2, y: e.y + e.h / 2, combo: 0, face: Math.sign(b.vx) || 1, dmg, crit: false, spell: b.bolt === 'lamp' ? 'bolt' : b.bolt === 'lance' ? 'lance' : undefined });
        if (b.homing) w.hitstop = Math.max(w.hitstop, 3);
      }
    }
  }
  w.projectiles = w.projectiles.filter(b => !b.dead);
}
