// 월드 생성과 한 틱 진행. DOM 없음 → Node에서 그대로 테스트
import { CFG } from './config.js';
import { createPlayer, updatePlayer, overlap } from './player.js';
import { spawnEnemy, updateEnemy, ENEMY_DEFS, makeElite } from './enemies.js';
import { resolveEnemyHit, resolvePlayerAttacks, resolveSkill, landSkill, updatePoise, damageEnemy } from './combat.js';
import { ACTIONS } from './player.js';

export const EMPTY_INPUT = Object.freeze({
  left: false, right: false, down: false, jumpHeld: false,
  jump: false, attack: false, parry: false, roll: false, skill: false, flask: false,
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
    spawn: { x: 80, y: 230 },
  },
  boss: {
    width: 720,
    solids: [
      { x: -40, y: 0, w: 40, h: 360 }, { x: 720, y: 0, w: 40, h: 360 },
      { x: -40, y: 300, w: 800, h: 60 },
    ],
    spawn: { x: 80, y: 230 },
  },
};

export function createWorld({ room = 'arena', solids, spawn, width, boss = 'bellBoss', variant = null, hpMul = 1 } = {}) {
  const def = ROOMS[room] || { width: width || 2000, solids: [], spawn: { x: 100, y: 250 } };
  const sp = spawn || def.spawn;
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
  if (room === 'boss') spawnEnemy(w, boss, 480, 300 - ENEMY_DEFS[boss].h - 2, { variant, hpMul });   // 바닥 위에서 시작
  updateCamera(w);
  return w;
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
  if (w.room === 'boss') { if (!w.enemies.length && !w.won) { w.won = true; w.events.push({ type: 'win' }); } return; }
  if (w.enemies.length || w.cleared || w.room !== 'arena') return;
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

  updatePlayer(w, inp);
  for (const ev of [...w.events]) if (ev.type === 'skill') resolveSkill(w, ev);
  for (const d of w.pending) if (--d.t <= 0) landSkill(w, d);             // 지연 마법: 이펙트가 떨어지는 순간 피해
  w.pending = w.pending.filter(d => d.t > 0);

  for (const e of w.enemies) {
    if (e.dead) continue;
    if (e.flash > 0) e.flash--;
    if (e.burnT > 0 && --e.burnT % 60 === 0) { damageEnemy(w, e, 3); if (e.dead) continue; }   // 화상
    updatePoise(e);
    if (e.stunT > 0) continue;
    updateEnemy(w, e);
  }
  updateProjectiles(w);

  resolvePlayerAttacks(w);
  for (const hb of w.hitboxes) resolveEnemyHit(w, hb);
  for (const e of w.enemies) if (e.dead && e.mods && e.mods.includes('split'))   // 분열: 나방 둘
    for (const k of [-1, 1]) spawnEnemy(w, 'moth', e.x + k * 20, e.y - 10, { hpMul: w.hpMul });
  w.enemies = w.enemies.filter(e => !e.dead);
  updateWaves(w);
  updateCamera(w);
}

// 탄: 이동, 지형/수명 소멸. 적 탄은 리라 판정, 반사된 탄은 적 판정
function updateProjectiles(w) {
  for (const b of w.projectiles) {
    b.x += b.vx; b.y += b.vy; b.life--;
    if (b.life <= 0 || w.solids.some(s => !s.oneWay && overlap(b, s))) { b.dead = true; continue; }
    if (b.owner === 'enemy') {
      const r = resolveEnemyHit(w, { src: b, owner: b.src, x: b.x, y: b.y, w: b.w, h: b.h, dmg: b.dmg, parryable: b.parryable, dir: Math.sign(b.vx) });
      if (r === 'perfect') { b.vx *= -1.5; b.owner = 'player'; b.done = false; b.life = 90; }
      else if (r !== 'ignored') b.dead = true;
    } else {
      const e = w.enemies.find(e => !e.dead && !(e.spawnT > 0) && overlap(b, e) && !(b.hits && b.hits.includes(e)));
      if (e) {
        const dmg = b.pdmg ?? b.dmg * 15;                                   // 반사탄은 dmg×15, 마법·검기는 pdmg
        damageEnemy(w, e, dmg, (b.poise ?? CFG.poise.normal) * (w.player.mods.poiseMul || 1));
        if (b.pierce) b.hits.push(e); else b.dead = true;                  // 얼음 창: 관통
        w.events.push({ type: 'attackHit', x: e.x + e.w / 2, y: e.y + e.h / 2, combo: 0, face: Math.sign(b.vx) || 1, dmg, crit: false });
      }
    }
  }
  w.projectiles = w.projectiles.filter(b => !b.dead);
}
