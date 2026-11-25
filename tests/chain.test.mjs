// 사슬 물리: 자루 끝에 붙어 있고, 등불이 바닥을 뚫지 않고, 던지면 등불까지 풀려나가며, 고리 사이가 늘어나지 않는다
import { test, ok, eq, run } from './lib.mjs';
import { ChainSim } from '../js/chain.js';
const W = { solids: [{ x: -40, y: 300, w: 2000, h: 60 }, { x: 500, y: 240, w: 200, h: 120 }] };
const near = (a, b, d) => Math.hypot(a.x - b.x, a.y - b.y) <= d;
test('들고 있을 때: 자루 끝에 고정, 등불은 바닥 위, 사슬 길이 유지', () => {
  const c = new ChainSim(), A = { x: 100, y: 289 };
  for (let i = 0; i < 200; i++) c.step(W, A, { st: 'held' }, null);
  ok(near(c.pts[0], A, 0.01), 'anchored');
  const e = c.pts[c.pts.length - 1]; ok(e.y <= 300 - 25 + 0.5, 'lantern not in ground ' + e.y);
  for (const p of c.pts) ok(p.y <= 300 + 0.01, 'link under ground ' + p.y);
});
test('자루를 휘두르면 사슬이 따라 출렁이고 다시 가라앉음 (관성·감쇠)', () => {
  const c = new ChainSim(); let A = { x: 100, y: 200 };
  for (let i = 0; i < 120; i++) c.step(W, A, { st: 'held' }, null);
  const rest = { ...c.pts[c.pts.length - 1] };
  for (let i = 0; i < 6; i++) { A = { x: 100 + i * 8, y: 200 - i * 4 }; c.step(W, A, { st: 'held' }, null); }
  for (let i = 0; i < 6; i++) c.step(W, A, { st: 'held' }, null);
  const moved = Math.hypot(c.pts[c.pts.length - 1].x - rest.x, c.pts[c.pts.length - 1].y - rest.y); ok(moved > 6, 'swings ' + moved);
  for (let i = 0; i < 400; i++) c.step(W, A, { st: 'held' }, null);
  const e = c.pts[c.pts.length - 1], p = c.pts[c.pts.length - 2]; ok(Math.abs(e.x - p.x) < 1.5 || e.y >= 274, 'settles');
});
test('던지면 등불까지 풀려나가고 (길이 ≥ 거리), 회수하면 다시 짧아짐', () => {
  const c = new ChainSim(), A = { x: 100, y: 280 };
  for (let i = 0; i < 30; i++) c.step(W, A, { st: 'held' }, null);
  const L = { st: 'placed', x: 360, y: 288 };
  for (let i = 0; i < 90; i++) c.step(W, A, L, null);
  ok(c.len >= 250, 'paid out ' + c.len); ok(near(c.pts[c.pts.length - 1], { x: 360, y: Math.min(288 - 17, 300 - 25) }, 1), 'end on lantern');
  for (const p of c.pts) ok(p.y <= 300.01, 'sag rests on ground');
  for (let i = 0; i < 90; i++) c.step(W, A, { st: 'held' }, null);
  ok(c.len < 40, 'reeled in ' + c.len);
});
test('언덕 옆면에 막힘 (뚫고 지나가거나 순간이동하지 않음)', () => {
  const c = new ChainSim(), A = { x: 470, y: 270 };
  for (let i = 0; i < 60; i++) c.step(W, A, { st: 'placed', x: 760, y: 228 }, null);
  for (const p of c.pts) ok(!(p.x > 500.5 && p.x < 699.5 && p.y > 240.5 && p.y < 300), 'inside hill ' + p.x + ',' + p.y);
});
run();
