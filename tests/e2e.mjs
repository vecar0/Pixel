// 브라우저 검수: node tests/e2e.mjs [스크린샷 폴더]
import { createRequire } from 'module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import http from 'http'; import fs from 'fs'; import path from 'path';
import { test, ok, eq } from './lib.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = process.argv[2] || path.join(root, 'tests', 'shots'); fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/json' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html'; fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(u)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
const url = `http://localhost:${srv.address().port}/`;
const browser = await chromium.launch();
const results = [];
async function check(name, ctxOpts, fn) {
  const ctx = await browser.newContext(ctxOpts), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(400);
  try { await fn(p); if (errs.length) throw new Error('콘솔 에러 ' + JSON.stringify(errs.slice(0, 3))); results.push([name, null]); }
  catch (e) { results.push([name, e.message]); }
  await ctx.close();
}
// 매 프레임 리라 상태 기록
const watch = p => p.evaluate(() => { window.__log = []; const f = () => { const w = window.__lk.world; window.__log.push({ s: w.player.state, x: w.player.x }); requestAnimationFrame(f); }; requestAnimationFrame(f); });
const log = p => p.evaluate(() => window.__log);
const PC = { viewport: { width: 1280, height: 720 } };
const PHONE = { ...devices['iPhone 13 landscape'] };

await check('PC: 타이틀 → Enter → 플레이', PC, async p => {
  eq(await p.evaluate(() => window.__lk.mode), 'title');
  await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  eq(await p.evaluate(() => window.__lk.mode), 'play');
});
await check('PC: D 홀드 → 이동', PC, async p => {
  await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  const x0 = await p.evaluate(() => window.__lk.world.player.x);
  await p.keyboard.down('d'); await p.waitForTimeout(900); await p.keyboard.up('d');
  ok(await p.evaluate(() => window.__lk.world.player.x) - x0 > 60);
});
await check('PC: K → 패링', PC, async p => {
  await p.keyboard.press('Enter'); await p.waitForTimeout(300); await watch(p);
  await p.keyboard.press('k'); await p.waitForTimeout(150);
  ok((await log(p)).some(l => l.s === 'parry'));
});
await check('모바일: 스틱 홀드 + 패링 탭 동시에 (멀티터치)', PHONE, async p => {
  await p.evaluate(() => window.__lk.start()); await p.waitForTimeout(300); await watch(p);
  await p.evaluate(() => {
    const z = document.querySelector('#stickzone'), r = z.getBoundingClientRect();
    const o = { bubbles: true, pointerId: 11, pointerType: 'touch', clientX: r.left + 100, clientY: r.top + r.height * 0.7 };
    z.dispatchEvent(new PointerEvent('pointerdown', o));
    z.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: o.clientX + 40 }));
  });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const b = document.querySelector('#b-parry'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 12, pointerType: 'touch' })); });
  await p.waitForTimeout(300);
  const L = await log(p);
  ok(L[L.length - 1].x - L[0].x > 20, 'no move'); ok(L.some(l => l.s === 'parry'), 'no parry');
});
await check('모바일: 0ms 짧은 탭도 패링 실행', PHONE, async p => {
  await p.evaluate(() => window.__lk.start()); await p.waitForTimeout(300); await watch(p);
  await p.evaluate(() => { const b = document.querySelector('#b-parry'), o = { bubbles: true, pointerId: 21, pointerType: 'touch' }; b.dispatchEvent(new PointerEvent('pointerdown', o)); b.dispatchEvent(new PointerEvent('pointerup', o)); });
  await p.waitForTimeout(150);
  ok((await log(p)).some(l => l.s === 'parry'));
  await p.screenshot({ path: path.join(out, 'mobile.png') });
});
await check('모바일 세로 → 가로 안내', { ...devices['iPhone 13'] }, async p => {
  ok(await p.locator('#rotate').isVisible());
});
await check('보스방 3초 진행 + 스크린샷', PC, async p => {
  await p.evaluate(() => window.__lk.setRoom('boss')); await p.waitForTimeout(3000);
  eq(await p.evaluate(() => window.__lk.mode), 'play');
  await p.screenshot({ path: path.join(out, 'boss.png') });
});
let perf = null;
await check('성능: 최악 장면 tick+렌더 평균', PC, async p => {
  perf = await p.evaluate(() => {
    const lk = window.__lk; lk.setRoom('boss'); const w = lk.world;
    w.player.hp = 1e9;
    for (let i = 0; i < 8; i++) lk.spawn(i % 2 ? 'moth' : 'ghoul', 150 + i * 60, i % 2 ? 180 : 250);
    for (let i = 0; i < 40; i++) w.projectiles.push({ x: 50 + i * 15, y: 200, w: 6, h: 6, vx: 0.1, vy: 0, dmg: 0, parryable: true, owner: 'player', life: 9999, src: {} });
    lk.R.burst(300, 200, 300, ['#fff'], 0.1);
    const t0 = performance.now(); const N = 240;
    for (let i = 0; i < N; i++) { lk.step(); if (lk.R.parts.length < 300) lk.R.burst(300, 200, 300 - lk.R.parts.length, ['#fff'], 0.1); lk.R.draw(w); }
    return (performance.now() - t0) / N;
  });
  console.log(`  ⏱ 프레임당 ${perf.toFixed(2)}ms (목표 ≤ 8ms)`);
  ok(perf <= 8, perf);
});

for (const [n, e] of results) console.log(e ? '  ✘' : '  ✔', n, e ? '— ' + e : '');
const fail = results.filter(r => r[1]).length;
console.log(`\n${results.length - fail}/${results.length} 통과`);
await browser.close(); srv.close();
if (fail) process.exit(1);
