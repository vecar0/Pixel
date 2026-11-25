// 「빛 속에서만 벨 수 있다」 — 빛·실체·등불 던지기/회수·패링 데임·빛 속 처형·빛 조각·등잔
import { test, ok, eq, run } from './lib.mjs';
import { CFG } from '../js/core/config.js?v=mwutyswe';
import { createWorld, tick } from '../js/core/world.js?v=mwutyswe';
import { spawnEnemy, ENEMY_DEFS } from '../js/core/enemies.js?v=mwutyswe';
import { lightSources, lightShrine, shrineCost } from '../js/core/light.js?v=mwutyswe';
import { I, steps, FLAT } from './helpers.mjs';
const W = () => { const w = createWorld({ room: 'test', solids: FLAT }); steps(w, 30); w.player.hp = 99; return w; };
const foe = (w, dx, kind = 'ghoul') => { const e = spawnEnemy(w, kind, w.player.x + dx, 300 - ENEMY_DEFS[kind].h); e.spawnT = 0; e.cd = 1e9; e.speed = 0; return e; };
const swing = (w, n = CFG.attack.startupChainF + 4) => { tick(w, I({ attack: true })); steps(w, n); };

test('그림자는 빛 밖에선 칼이 통과하고, 든 등불 빛(90) 안에 0.3초 있으면 실체가 되어 베인다', () => {
  const w = W(), e = foe(w, 30);
  ok(e.solid === false || e.solid === undefined, 'starts as shadow'); const hp = e.hp;
  swing(w, 2); eq(e.hp, hp, 'passes through while still shadow');
  steps(w, CFG.lantern.solidInF + 4); ok(e.solid, 'solid in held light');
  e.hitBy = -1; w.player.comboT = 0; swing(w); ok(e.hp < hp, 'cut once solid');
  const far = foe(w, 400); steps(w, 40); ok(!far.solid, 'far shadow stays shadow');
});
test('등불: 탭 = 160px 던짐(0.4초) → 6초 빛 → 탭하면 회수, 던진 동안 리라 곁은 어둠·패링 불가', () => {
  const w = W(), p = w.player; p.face = 1; const x0 = p.x + p.w / 2;
  tick(w, I({ lamp: true, lampHeld: true })); tick(w, I());                  // 탭
  eq(p.lamp.st, 'fly'); steps(w, CFG.lantern.flyF + 1); eq(p.lamp.st, 'placed');
  ok(Math.abs(p.lamp.x - (x0 + 10 + 160)) < 4, 'lands ~160 ahead ' + (p.lamp.x - x0));
  const S = lightSources(w); ok(S.every(s => s.src !== 'held'), 'no held light while thrown'); eq(S[0].r, CFG.lantern.thrownR);
  tick(w, I({ parry: true })); ok(p.state !== 'parry', 'cannot parry without lantern');
  tick(w, I({ lamp: true })); eq(p.lamp.st, 'back'); steps(w, CFG.lantern.recallF + 1); eq(p.lamp.st, 'held');
});
test('등불: 길게 누르면 조준 (앞 방향키로 멀리, 60~260), 6초 지나면 저절로 돌아옴', () => {
  const w = W(), p = w.player; p.face = 1; const x0 = p.x + p.w / 2;
  tick(w, I({ lamp: true, lampHeld: true })); for (let i = 0; i < 60; i++) tick(w, I({ lampHeld: true, right: true }));
  eq(Math.round(p.lamp.aim), CFG.lantern.aimMax); eq(p.x + p.w / 2, x0, 'stands still while aiming');
  tick(w, I()); steps(w, CFG.lantern.flyF + 1); ok(Math.abs(p.lamp.x - (x0 + 10 + CFG.lantern.aimMax)) < 4, 'aimed throw');
  steps(w, CFG.lantern.placedF + CFG.lantern.recallF + 4); eq(p.lamp.st, 'held');
});
test('회수: 끌려오는 등불이 지나간 그림자는 1초 실체화', () => {
  const w = W(), p = w.player; p.face = 1; const e = foe(w, 110);
  tick(w, I({ lamp: true, lampHeld: true })); tick(w, I()); steps(w, CFG.lantern.flyF + 2);
  p.lamp.x = p.x + 260; e.inT = 0; e.lit = false; e.solid = false;
  tick(w, I({ lamp: true })); steps(w, CFG.lantern.recallF); ok(e.burnSolidT > 0 || e.solid, 'burned by passing lantern');
});
test('패링: 공격한 그림자가 빛에 데어 실체화 (완벽 3초), 빛 밖이어도', () => {
  const w = W(), p = w.player; p.face = 1; const e = foe(w, 30);
  e.update = (w2, en) => { if (w2.t === at) w2.hitboxes.push({ src: {}, owner: en, x: w2.player.x + w2.player.w - 4, y: w2.player.y, w: 20, h: 40, dmg: 1, parryable: true, dir: -1 }); };
  const at = w.t + 2; tick(w, I({ parry: true })); steps(w, 4);
  ok(e.burnSolidT >= CFG.lantern.burnPerfectF - 10, 'burned ' + e.burnSolidT);
});
test('무너진 적은 빛 안에서만 처형, 처형하면 빛 조각 (일반 3)', () => {
  const w = W(), p = w.player; p.face = 1; const e = foe(w, 30);
  steps(w, CFG.lantern.solidInF + 4); e.poise = 1; e.stunT = 200;
  swing(w, CFG.execute.totalF + 4); eq(p.shards, CFG.shards.normal); ok(e.dead, 'executed');
  const f = foe(w, 30); steps(w, CFG.lantern.solidInF + 4); f.stunT = 200; f.poise = 1;
  p.lamp.st = 'placed'; p.lamp.x = p.x - 600; p.lamp.y = 200; p.lamp.t = 0; f.burnSolidT = 999; steps(w, 2);
  p.comboT = 0; swing(w, 20); ok(p.state !== 'execute' && !f.dead, 'no execute outside light');
});
test('등잔: 빛 조각을 부어 켬 (10, 다음 +5) → 색·빛 모양, 넓은 빛이면 반경 +20%', () => {
  const w = W(), p = w.player, o = { kind: 'lamp', x: p.x, lit: false }; w.props = [o];
  p.shards = 9; ok(!lightShrine(w, o, 'str', 'wide'), 'not enough');
  p.shards = 12; ok(lightShrine(w, o, 'str', 'wide')); eq(p.shards, 2); eq(p.color, 'str'); eq(p.shapes.wide, 1); eq(shrineCost(p), 15);
  const r = lightSources(w).find(s => s.src === 'held').r; eq(Math.round(r), Math.round(CFG.lantern.heldR * 1.2));
});
run();
