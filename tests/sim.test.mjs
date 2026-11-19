// headless 전투 시뮬레이션 테스트: node tests/sim.test.mjs
import { test, ok, eq, run } from './lib.mjs';
import { CFG } from '../js/core/config.js';
import { createWorld, tick } from '../js/core/world.js';
import { invulnerable, attackBox } from '../js/core/player.js';
import { I, steps, FLAT } from './helpers.mjs';

const W = (o = {}) => createWorld({ room: 'test', solids: FLAT, ...o });
const settle = w => steps(w, 30); // 바닥에 내려앉기

test('config: 완벽 패링 6f', () => eq(CFG.parry.perfectF, 6));
test('config: 회피 무적 12f', () => eq(CFG.roll.iEnd - CFG.roll.iStart + 1, 12));

/* ── Task 2: 리라 기본기 ── */
test('move: 오른쪽 60틱 → x +140 이상', () => {
  const w = W(); settle(w); const x0 = w.player.x;
  steps(w, 60, { right: true });
  ok(w.player.x - x0 >= 140, w.player.x - x0);
});
function jumpHeight(holdTicks) {
  const w = W(); settle(w); const y0 = w.player.y; let top = y0;
  tick(w, I({ jump: true, jumpHeld: true }));
  for (let i = 0; i < 80; i++) { tick(w, I({ jumpHeld: i < holdTicks })); top = Math.min(top, w.player.y); }
  return y0 - top;
}
test('jump: 홀드 → 66~72px', () => { const h = jumpHeight(99); ok(h >= 66 && h <= 72, h); });
test('jump: 짧은 탭 → 40px 미만', () => { const h = jumpHeight(0); ok(h < 40, h); });
function coyote(k) {
  const w = W({ solids: [{ x: 0, y: 300, w: 200, h: 20 }, { x: -1000, y: 420, w: 4000, h: 40 }], spawn: { x: 150, y: 250 } });
  settle(w);
  let n = 0; while (w.player.onGround && n++ < 200) tick(w, I({ right: true }));
  for (let i = 1; i < k; i++) tick(w, I({ right: true }));
  tick(w, I({ jump: true, jumpHeld: true }));
  return w.player.vy < 0;
}
test('coyote: 떨어진 뒤 5틱째 점프 → 됨', () => ok(coyote(5)));
test('coyote: 8틱째 → 안 됨', () => ok(!coyote(8)));
test('attack: 3연타 combo 0,1,2 + 판정은 startup 4틱 뒤 3틱', () => {
  const w = W(); settle(w); const seen = [];
  for (let i = 0; i < 60; i++) {
    tick(w, I({ attack: i === 0 || i === 8 || i === 16 }));
    const b = attackBox(w.player);
    if (b) seen.push([i, w.player.combo]);
  }
  const combos = [...new Set(seen.map(s => s[1]))];
  eq(JSON.stringify(combos), '[0,1,2]');
  eq(JSON.stringify(seen.filter(s => s[1] === 0).map(s => s[0])), '[4,5,6]');
});
test('cancel: 공격 후딜 중 roll → 같은 틱에 roll', () => {
  const w = W(); settle(w);
  tick(w, I({ attack: true })); steps(w, 7);
  eq(w.player.state, 'attack');
  tick(w, I({ roll: true }));
  eq(w.player.state, 'roll');
});
test('roll: 22틱에 90~100px, 무적은 2~13틱만', () => {
  const w = W(); settle(w); const x0 = w.player.x; const inv = [];
  tick(w, I({ roll: true })); inv.push(invulnerable(w.player));
  for (let i = 1; i < 22; i++) { tick(w, I()); inv.push(invulnerable(w.player)); }
  const d = w.player.x - x0; ok(d >= 90 && d <= 100, d);
  eq(inv.map((v, i) => v ? i : -1).filter(i => i >= 0).join(','), '2,3,4,5,6,7,8,9,10,11,12,13');
});
test('buffer: 공격 startup 중 parry → 후딜 진입 시 parry 실행', () => {
  const w = W(); settle(w);
  tick(w, I({ attack: true })); tick(w, I({ parry: true }));
  let got = false; for (let i = 0; i < 8; i++) { tick(w, I()); if (w.player.state === 'parry') got = true; }
  ok(got);
});
test('buffer: 8틱 넘게 못 쓰면 버려짐', () => {
  const w = W(); settle(w); w.player.flasks = 3; w.player.hp = 3;
  tick(w, I({ flask: true })); tick(w, I({ parry: true }));
  steps(w, 45);
  ok(w.player.state !== 'parry', w.player.state);
});

run();
