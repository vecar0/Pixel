// 월드 생성과 한 틱 진행. DOM 없음 → Node에서 그대로 테스트
import { CFG } from './config.js';
import { createPlayer, updatePlayer, overlap } from './player.js';
import { spawnEnemy, updateEnemy } from './enemies.js';
import { resolveEnemyHit, resolvePlayerAttacks, resolveUlt, updatePoise, damageEnemy } from './combat.js';

export const EMPTY_INPUT = Object.freeze({
  left: false, right: false, down: false, jumpHeld: false,
  jump: false, attack: false, parry: false, roll: false, ult: false, flask: false,
});

const ROOMS = {
  arena: {
    width: 1280,
    solids: [
      { x: -40, y: 0, w: 40, h: 360 }, { x: 1280, y: 0, w: 40, h: 360 },
      { x: -40, y: 300, w: 1360, h: 60 },
      { x: 360, y: 230, w: 120, h: 8, oneWay: true },
      { x: 820, y: 230, w: 120, h: 8, oneWay: true },
    ],
    spawn: { x: 80, y: 250 },
  },
  boss: {
    width: 720,
    solids: [
      { x: -40, y: 0, w: 40, h: 360 }, { x: 720, y: 0, w: 40, h: 360 },
      { x: -40, y: 300, w: 800, h: 60 },
    ],
    spawn: { x: 80, y: 250 },
  },
};

export function createWorld({ room = 'arena', solids, spawn, width } = {}) {
  const def = ROOMS[room] || { width: width || 2000, solids: [], spawn: { x: 100, y: 250 } };
  const sp = spawn || def.spawn;
  const w = {
    room, t: 0, hitstop: 0, shake: 0,
    width: width || def.width,
    solids: solids || def.solids,
    player: createPlayer(sp.x, sp.y),
    enemies: [], projectiles: [], hitboxes: [], fx: [], events: [],
    camX: 0, over: false, won: false, cleared: false, seed: 12345,
    waves: [], waveDelay: 0,
  };
  if (room === 'arena') w.waves = [[['ghoul', 520], ['ghoul', 600], ['moth', 700]], [['ghoul', 900], ['moth', 1000]]];
  if (room === 'boss') spawnEnemy(w, 'bellBoss', 480, 200);
  updateCamera(w);
  return w;
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
  for (const [kind, x] of w.waves.shift()) spawnEnemy(w, kind, x, kind === 'moth' ? 180 : 250);
}

export function tick(w, inp) {
  w.events.length = 0;
  w.t++;
  if (w.hitstop > 0) {          // 히트스톱: 세계는 멈추고 입력만 버퍼에 쌓음
    w.hitstop--;
    const p = w.player;
    if (p.recoverWait > 0) p.recoverWait--;
    for (const a of ['attack', 'parry', 'roll', 'jump', 'ult', 'flask'])
      if (inp[a]) p.buffer = { action: a, t: CFG.player.bufferF };
    return;
  }
  if (w.shake > 0) w.shake--;
  w.hitboxes.length = 0;

  updatePlayer(w, inp);
  if (w.events.some(e => e.type === 'ultStart')) resolveUlt(w);

  for (const e of w.enemies) {
    if (e.dead) continue;
    if (e.flash > 0) e.flash--;
    updatePoise(e);
    if (e.stunT > 0) continue;
    updateEnemy(w, e);
  }
  updateProjectiles(w);

  resolvePlayerAttacks(w);
  for (const hb of w.hitboxes) resolveEnemyHit(w, hb);
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
      const e = w.enemies.find(e => !e.dead && overlap(b, e));
      if (e) { damageEnemy(w, e, b.dmg * 15, CFG.poise.normal); b.dead = true; }
    }
  }
  w.projectiles = w.projectiles.filter(b => !b.dead);
}
