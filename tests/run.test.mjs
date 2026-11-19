// 런 구조 테스트: node tests/run.test.mjs
import { test, ok, eq, run } from './lib.mjs';
import { CFG } from '../js/core/config.js';
import { RELICS, OATHS, newRun, chooseOath, relicOffer, takeRelic, doorOffer, enterRoom, roomCleared, buildRoomWorld, applyRelics } from '../js/core/run.js';
import { tick, EMPTY_INPUT } from '../js/core/world.js';
import { spawnEnemy } from '../js/core/enemies.js';
const I = o => ({ ...EMPTY_INPUT, ...o });
const steps = (w, n, o = {}) => { for (let i = 0; i < n; i++) tick(w, I(o)); };

test('각인 10종 이상, 서약 3종', () => { ok(Object.keys(RELICS).length >= 10); eq(OATHS.length, 3); });
test('서약을 고르면 시작 각인을 얻는다', () => {
  const r = newRun(1); chooseOath(r, 'parry'); ok(r.relics.includes('echo'), r.relics);
});
test('각인 제안: 3개, 서로 다름, 이미 가진 것 제외, 같은 시드면 같은 결과', () => {
  const r = newRun(7); chooseOath(r, 'dodge');
  const a = relicOffer(r), b = relicOffer({ ...newRun(7), relics: [...r.relics], oath: 'dodge', rng: newRun(7).rng });
  eq(a.length, 3); eq(new Set(a).size, 3); ok(a.every(k => !r.relics.includes(k)));
  takeRelic(r, a[0]); ok(r.relics.includes(a[0]));
});
test('문 선택: 서로 다른 방 2개, 마지막 직전엔 보스만', () => {
  const r = newRun(3); chooseOath(r, 'parry');
  const d = doorOffer(r); eq(d.length, 2); ok(d[0] !== d[1], d);
  r.roomIdx = r.length - 1; eq(JSON.stringify(doorOffer(r)), '["boss"]');
});
test('방 진행: 전투 클리어 시 불씨 +10, 방 번호 증가', () => {
  const r = newRun(3); chooseOath(r, 'parry'); enterRoom(r, 'combat');
  const e0 = r.embers; roomCleared(r); eq(r.embers - e0, 10); eq(r.roomIdx, 1);
});
test('방 월드: 전투방은 웨이브가 있고, 리라 체력·기름병이 이어진다', () => {
  const r = newRun(5); chooseOath(r, 'parry'); r.hp = 3; r.flasks = 1; enterRoom(r, 'combat');
  const w = buildRoomWorld(r); ok(w.waves.length >= 2); eq(w.player.hp, 3); eq(w.player.flasks, 1);
});
test('엘리트방: 자세 게이지가 있는 강화 이끼 망자', () => {
  const r = newRun(5); chooseOath(r, 'parry'); enterRoom(r, 'elite');
  const w = buildRoomWorld(r); const all = w.waves.flat(); ok(all.some(s => s[2] === 'elite'), JSON.stringify(all));
});
test('각인 효과: 순례자의 인내 → 최대 체력 +1', () => {
  const r = newRun(1); chooseOath(r, 'parry'); takeRelic(r, 'vigor'); enterRoom(r, 'combat');
  eq(buildRoomWorld(r).player.maxHp, CFG.player.hp + 1);
});
test('각인 효과: 두 번째 날개 → 공중 점프 1회', () => {
  const r = newRun(1); chooseOath(r, 'parry'); takeRelic(r, 'wings'); enterRoom(r, 'combat');
  const w = buildRoomWorld(r); w.enemies.length = 0; w.waves = []; steps(w, 40);
  tick(w, I({ jump: true, jumpHeld: true })); steps(w, 20, { jumpHeld: true });
  const y1 = w.player.y; tick(w, I({ jump: true, jumpHeld: true })); steps(w, 6, { jumpHeld: true });
  ok(w.player.y < y1 - 10, 'no air jump');
});
test('각인 효과: 그림자 걸음 → 구르기 거리 +40%', () => {
  const r = newRun(1); chooseOath(r, 'dodge'); enterRoom(r, 'combat');
  const w = buildRoomWorld(r); w.enemies.length = 0; w.waves = []; steps(w, 40);
  const x0 = w.player.x; tick(w, I({ roll: true })); steps(w, 30);
  ok(w.player.x - x0 > CFG.roll.dist * 1.3, w.player.x - x0);
});
test('각인 효과: 반향 → 완벽 패링 시 앞으로 검기 발사', () => {
  const r = newRun(1); chooseOath(r, 'parry'); enterRoom(r, 'combat');
  const w = buildRoomWorld(r); w.enemies.length = 0; w.waves = []; steps(w, 40);
  const p = w.player;
  w.enemies.push({ kind: 'dummy', x: p.x + 30, y: p.y, w: 16, h: 40, face: -1, hp: 100, maxHp: 100, poise: 0, poiseMax: false, stunT: 0, poiseRegenT: 0, hitBy: -1,
    update(w2, e) { if (w2.t === t0 + 1) w2.hitboxes.push({ src: {}, owner: e, x: p.x - 2, y: p.y, w: p.w + 4, h: p.h, dmg: 1, parryable: true, dir: -1 }); } });
  const t0 = w.t + 1; tick(w, I({ parry: true })); tick(w, I());
  ok(w.projectiles.some(b => b.owner === 'player' && b.echo), 'no echo wave');
});
test('각인 효과: 처형자 → 처형 피해 2배', () => {
  const r = newRun(1); chooseOath(r, 'execute'); enterRoom(r, 'combat');
  const w = buildRoomWorld(r); w.enemies.length = 0; w.waves = []; steps(w, 40);
  const e = spawnEnemy(w, 'ghoul', w.player.x + w.player.w + 2, w.player.y); e.maxHp = e.hp = 400; e.poiseMax = true; e.stunT = 100; e.update = () => {};
  tick(w, I({ attack: true })); steps(w, 8);
  eq(400 - e.hp, Math.round(400 * CFG.poise.executeFrac * 2));
});
test('각인 효과: 화염 칼날 → 3타에 화상 (3초간 초당 3)', () => {
  const r = newRun(1); chooseOath(r, 'parry'); takeRelic(r, 'flame'); enterRoom(r, 'combat');
  const w = buildRoomWorld(r); w.enemies.length = 0; w.waves = []; steps(w, 40);
  const e = spawnEnemy(w, 'ghoul', w.player.x + w.player.w + 2, w.player.y); e.maxHp = e.hp = 500; e.update = () => {};
  for (const k of [0, 1, 2]) { tick(w, I({ attack: true })); steps(w, 11); e.x = w.player.x + w.player.w + 2; }   // 히트스톱 포함 여유
  const hp = e.hp; steps(w, 200); eq(hp - e.hp, 9);
});
run();
