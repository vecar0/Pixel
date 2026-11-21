import { readdirSync } from 'fs';
import { spawnSync } from 'child_process';
// 검수(QA): 진행이 막히는 함정 시뮬레이션. node tests/qa.test.mjs
import { test, ok, eq, run } from './lib.mjs';
import { CFG } from '../js/core/config.js';
import { newRun, nextStage, buildRoomWorld, roomCleared, stageOf } from '../js/core/run.js';
import { tick, EMPTY_INPUT } from '../js/core/world.js';
import { spawnEnemy, ENEMY_DEFS } from '../js/core/enemies.js';
import { damageEnemy } from '../js/core/combat.js';
const I = o => ({ ...EMPTY_INPUT, ...o });

// 함정 A(배치 교착 → 여기선 지형 교착): 오른쪽으로 걷기 + 막히면 점프만으로 출구까지 갈 수 있는가 (60개 시드)
test('지형: 모든 전투방에서 오른쪽 걷기+점프만으로 출구에 도착 (60 시드)', () => {
  const fails = [];
  for (let seed = 1; seed <= 60; seed++) {
    const r = newRun(seed); nextStage(r);
    const w = buildRoomWorld(r); w.enemies.length = 0; w.waves = []; w.player.hp = 99;
    let t = 0, lastX = 0, stuck = 0;
    for (; t < 2400 && !w.exited; t++) {
      const p = w.player; stuck = Math.abs(p.x - lastX) < 0.5 ? stuck + 1 : 0; lastX = p.x;
      tick(w, I({ right: true, jump: stuck > 3 && t % 20 === 0, jumpHeld: stuck > 3 }));
    }
    if (!w.exited) fails.push(seed + '@' + Math.round(w.player.x));
  }
  eq(fails.join(','), '');
});

// 함정 B(도착 판정): 적이 언덕 너머 리라에게 실제로 다가와 공격을 시작하는가
test('적 이동: 오른쪽 끝에서 생긴 적이 지형을 넘어 리라에게 와서 공격 (지역별 근접 적, 60 시드)', () => {
  const fails = [];
  for (let seed = 1; seed <= 60; seed++) {
    const r = newRun(seed); nextStage(r);
    const w = buildRoomWorld(r); w.enemies.length = 0; w.waves = []; w.player.hp = 999;
    const kind = ['ghoul', 'spearman', 'shellguard', 'assassin'][seed % 4], d = ENEMY_DEFS[kind];
    const e = spawnEnemy(w, kind, w.width - 120, 300 - d.h - 40);
    let attacked = false;
    for (let t = 0; t < 2400 && !attacked; t++) { tick(w, I()); if (e.st === 'telegraph' || e.st === 'active') attacked = true; }
    if (!attacked) fails.push(`${seed}:${kind}@${Math.round(e.x)}`);
  }
  eq(fails.join(','), '');
});

test('상호작용 도착 판정: 상인·모닥불 앞(반경 안) 어디서든 공격 버튼이 통한다', () => {
  for (const [idx, kind] of [[2, 'campfire'], [4, 'merchant']]) {
    const r = newRun(3); r.roomIdx = idx; nextStage(r);
    const w = buildRoomWorld(r); for (let i = 0; i < 20; i++) tick(w, I());
    const o = w.props[0];
    for (const dx of [-50, -20, 0, 20, 50]) {
      w.player.x = o.x + dx - w.player.w / 2; tick(w, I());
      tick(w, I({ attack: true })); ok(w.events.some(e => e.type === 'interact' && e.kind === kind), `${kind} dx=${dx}`);
    }
  }
});

test('보스방: 양쪽 끝까지 걸어서 닿고, 보스를 쓰러뜨리면 사망 연출 → 포탈 → 들어가면 나감', () => {
  const r = newRun(5); r.roomIdx = 5; nextStage(r); eq(r.room, 'boss');
  const w = buildRoomWorld(r); w.player.hp = 999; const b = w.enemies[0]; b.update = () => {};
  for (let t = 0; t < 600 && w.player.x > 60; t++) tick(w, I({ left: true, jump: t % 30 === 0, jumpHeld: true }));   // 언덕은 점프로 넘음
  ok(w.player.x <= 60, 'left end');
  for (let t = 0; t < 900 && w.player.x < w.width - 100; t++) tick(w, I({ right: true, jump: t % 30 === 0, jumpHeld: true, roll: t % 40 === 20 }));   // 보스 몸은 걸어서 못 지나감 → 구르기로
  ok(w.player.x >= w.width - 100, 'right end ' + w.player.x);
  damageEnemy(w, b, 99999); for (let i = 0; i < 3; i++) tick(w, I()); ok(!w.won && w.bossDeath, '사망 연출 중');
  for (let i = 0; i < 170; i++) tick(w, I()); ok(w.won, 'won');
  const portal = w.props.find(o => o.kind === 'exit' && o.portal); ok(portal, '포탈');
  w.player.x = portal.x - w.player.w / 2; let ex = false; for (let i = 0; i < 3; i++) { tick(w, I()); ex ||= w.events.some(e => e.type === 'exit'); } ok(ex, '포탈로 나감');
});

test('한 판 전체 경로: 지역 4개의 정해진 스테이지를 끝까지 진행 가능', () => {
  const r = newRun(11), seen = [];
  for (let reg = 1; reg <= 4; reg++) {
    for (let i = 0; i < r.length; i++) { seen.push(nextStage(r)); const w = buildRoomWorld(r); ok(w.player.hp > 0); roomCleared(r); }
    if (reg < 4) { r.roomIdx = 0; r.region++; r.route = r.region === 4 ? ['combat', 'rest', 'elite', 'shop', 'boss'] : r.route; r.length = r.route.length; }
  }
  eq(seen.filter(s => s === 'boss').length, 4); eq(seen.length, 23);
});

test('모든 JS 파일 문법 검사 (줄 중간 // 주석이 코드를 삼키는 실수 방지)', () => {
  const files = [...readdirSync(new URL('../js/', import.meta.url)).filter(f => f.endsWith('.js')).map(f => 'js/' + f), ...readdirSync(new URL('../js/core/', import.meta.url)).filter(f => f.endsWith('.js')).map(f => 'js/core/' + f)];
  for (const f of files) { const r = spawnSync(process.execPath, ['--check', new URL('../' + f, import.meta.url).pathname]); ok(r.status === 0, f + ' ' + String(r.stderr).split('\n').slice(0, 4).join(' ')); }
});
run();
