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

await check('PC: 타이틀 → Enter(마을) → Enter(출발) → 지역 입장(서약 없음) → 플레이', PC, async p => {
  eq(await p.evaluate(() => window.__lk.mode), 'title');
  await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  eq(await p.evaluate(() => window.__lk.mode), 'town');
  await p.screenshot({ path: path.join(out, 'town.png') });
  await p.keyboard.press('Enter'); await p.waitForTimeout(2300);   // 마을을 떠날 때 아이리스가 닫힌 뒤 지역 입장
  eq(await p.evaluate(() => window.__lk.mode), 'intro');
  await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  eq(await p.evaluate(() => window.__lk.mode), 'play');
});
await check('마을: 걸어서 창고·제단·모닥불·허수아비, 오른쪽 길 = 순례 준비', PC, async p => {
  await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
  eq(await p.evaluate(() => window.__lk.mode), 'town'); ok(await p.evaluate(() => window.__lk.world.town), 'walk town');
  const at = async (kind, want) => { await p.evaluate(k => { const w = window.__lk.world; w.player.x = w.props.find(o => o.kind === k).x - 30; }, kind); await p.waitForTimeout(200);
    await p.keyboard.press('j'); await p.waitForTimeout(250);
    for (let k = 0; k < 8 && await p.evaluate(() => window.__lk.mode) === 'talk'; k++) { await p.locator('#tnext').dispatchEvent('pointerup'); await p.waitForTimeout(120); }   // 등대지기 대화
    eq(await p.evaluate(() => window.__lk.mode), want);
    await p.locator('[data-id=back], #back').first().dispatchEvent('pointerup'); await p.waitForTimeout(250); eq(await p.evaluate(() => window.__lk.mode), 'town'); };
  await p.evaluate(() => { const w = window.__lk.world; w.player.x = w.props.find(o => o.kind === 'keeper').x - 30; }); await p.waitForTimeout(200);
  await p.keyboard.press('j'); await p.waitForTimeout(250); eq(await p.evaluate(() => window.__lk.mode), 'talk');   // 등대지기: 이야기만 (해금 상점 없음)
  for (let k = 0; k < 8 && await p.evaluate(() => window.__lk.mode) === 'talk'; k++) { await p.locator('#tnext').dispatchEvent('pointerup'); await p.waitForTimeout(120); }
  eq(await p.evaluate(() => window.__lk.mode), 'town');
  await at('rack', 'practice'); await at('altar', 'prep'); await at('board', 'records'); await at('campfire', 'camp');
  ok(await p.evaluate(() => window.__lk.world.enemies.some(e => e.dummy)), 'dummy');
  await p.evaluate(() => { const w = window.__lk.world; w.player.x = w.props.find(o => o.kind === 'exit').x; }); await p.waitForTimeout(2300);
  eq(await p.evaluate(() => window.__lk.mode), 'intro');   // 오른쪽 길 = 바로 출발
});
await check('첫 순례 튜토리얼: 이동 → 점프 → 항아리 → 불씨 → (적 등장) 패링 단계', PC, async p => {
  await p.keyboard.press('Enter'); await p.waitForTimeout(1200); await p.keyboard.press('Enter'); await p.waitForTimeout(2300); await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => window.__lk.world.tutorial && window.__lk.world.holdWaves), 'tutorial room');
  const step = () => p.evaluate(() => window.__lk.tut && window.__lk.tut.step);
  await p.keyboard.down('d'); await p.waitForTimeout(900); await p.keyboard.up('d'); eq(await step(), 1);
  await p.keyboard.press('Space'); await p.waitForTimeout(400); eq(await step(), 2);
  await p.evaluate(() => { const w = window.__lk.world, u = w.level.urns[0]; w.player.x = u.x - 30; w.player.face = 1; }); await p.waitForTimeout(200);
  await p.keyboard.press('j'); await p.waitForTimeout(400); eq(await step(), 3);
  await p.waitForTimeout(2800); eq(await step(), 4); eq(await p.evaluate(() => window.__lk.world.holdWaves), false);
  ok(await p.evaluate(() => window.__lk.run.score > 0), 'score from embers');
});
await check('런: 클리어 → 출구 열림 → 아이리스 닫힘 뒤 단련 → 정해진 다음 방 → 휴식 방 모닥불·출구', PC, async p => {
  await p.evaluate(() => window.__lk.start()); await p.waitForTimeout(200);
  const exitNow = async () => { await p.evaluate(() => { const w = window.__lk.world; w.player.x = w.props.find(o => o.kind === 'exit').x; }); await p.waitForTimeout(3200); };   // 아이리스 닫힘 ~1.7초 + 열림 ~1초
  ok(await p.evaluate(() => window.__lk.world.props.find(o => o.kind === 'exit').locked), 'locked');
  await p.evaluate(() => { const w = window.__lk.world; w.enemies.length = 0; w.waves = []; });
  await p.waitForTimeout(300);
  eq(await p.evaluate(() => window.__lk.mode), 'play');                 // 방을 비우면 출구만 열림
  eq(await p.evaluate(() => window.__lk.world.props.find(o => o.kind === 'exit').locked), false);
  await p.evaluate(() => { const w = window.__lk.world; w.player.x = w.props.find(o => o.kind === 'exit').x; }); await p.waitForTimeout(2600);
  eq(await p.evaluate(() => window.__lk.mode), 'relic');                 // 아이리스가 닫힌 검은 화면에서 단련
  ok(await p.evaluate(() => window.__lk.R.irisClock >= 1.02), 'iris closed');
  eq(await p.locator('[data-up]').count(), 6);                          // 반대 스탯 3쌍
  eq(await p.locator('.scard').count(), 6);
  ok(await p.evaluate(() => new Set([...document.querySelectorAll('.scard')].map(c => c.offsetHeight)).size === 1), 'cards same height');   // 칸 크기 일정
  await p.locator('[data-info=str]').dispatchEvent('pointerup'); await p.waitForTimeout(100);
  eq(await p.locator('.spop li').count(), 7);                                 // 팝업: 능력 5 + 약점 2
  await p.locator('#popclose').dispatchEvent('pointerup', { bubbles: true }); await p.waitForTimeout(100);
  eq(await p.locator('.spop').count(), 0);
  ok(await p.locator('#train').isDisabled(), 'train enabled before spending');   // 점수가 남으면 완료 불가
  await p.locator('[data-up=str]').dispatchEvent('pointerup'); await p.waitForTimeout(120);
  await p.locator('[data-up=agi]').dispatchEvent('pointerup'); await p.waitForTimeout(120);   // 반대 화살표 = 되돌리기
  eq(await p.evaluate(() => document.querySelector('.pts b').textContent), '1');   // 단련은 1점
  await p.locator('[data-up=str]').dispatchEvent('pointerup'); await p.waitForTimeout(120);
  eq(await p.evaluate(() => document.querySelector('.pts b').textContent), '0');
  ok(await p.locator('[data-up=str]').isDisabled(), 'can over-spend');
  await p.screenshot({ path: path.join(out, 'relic.png') });
  eq(await p.evaluate(() => window.__lk.run.stats.str), 10);             // 확정 전엔 그대로
  await p.locator('#train').dispatchEvent('pointerup'); await p.waitForTimeout(200);
  eq(await p.evaluate(() => window.__lk.run.stats.str + ',' + window.__lk.run.stats.agi), '11,9');
  await p.waitForTimeout(1200);
  eq(await p.evaluate(() => window.__lk.mode), 'play');                 // 단련 뒤 다음 방
  eq(await p.evaluate(() => window.__lk.run.roomIdx), 1);
  eq(await p.evaluate(() => window.__lk.run.room), 'combat');
  await p.evaluate(() => { const w = window.__lk.world; w.enemies.length = 0; w.waves = []; }); await p.waitForTimeout(300);
  await p.evaluate(() => { const w = window.__lk.world; w.player.x = w.props.find(o => o.kind === 'exit').x; }); await p.waitForTimeout(2600);
  for (let k = 0; k < 2; k++) { await p.locator('[data-up=fury]').dispatchEvent('pointerup'); await p.waitForTimeout(100); }
  await p.locator('#train').dispatchEvent('pointerup'); await p.waitForTimeout(250);
  await p.waitForTimeout(1500); eq(await p.evaluate(() => window.__lk.run.room), 'rest');
  await p.evaluate(() => { const w = window.__lk.world; w.player.x = w.props[0].x - 11; }); await p.waitForTimeout(200);
  await p.keyboard.press('j'); await p.waitForTimeout(200);
  eq(await p.evaluate(() => window.__lk.mode), 'rest');
  await p.evaluate(() => document.querySelector('[data-id=back]').dispatchEvent(new PointerEvent('pointerup'))); await p.waitForTimeout(200);
  eq(await p.evaluate(() => window.__lk.mode), 'play');
  await exitNow(); eq(await p.evaluate(() => window.__lk.run.room), 'elite');
});
await check('PC: D 홀드 → 이동', PC, async p => {
  await p.evaluate(() => window.__lk.start()); await p.waitForTimeout(200);
  const x0 = await p.evaluate(() => window.__lk.world.player.x);
  await p.keyboard.down('d'); await p.waitForTimeout(900); await p.keyboard.up('d');
  ok(await p.evaluate(() => window.__lk.world.player.x) - x0 > 60);
});
await check('PC: K → 패링', PC, async p => {
  await p.evaluate(() => window.__lk.start()); await p.waitForTimeout(300); await watch(p);
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
for (const [reg, name] of [[2, 'saint'], [3, 'spider'], [4, 'shadow']]) await check(`지역 ${reg} 보스 ${name} 3초 진행`, PC, async p => {
  await p.evaluate(r => { const lk = window.__lk; lk.start(); lk.gotoBoss(r); }, reg); await p.waitForTimeout(3000);
  eq(await p.evaluate(() => window.__lk.world.enemies[0]?.kind), name);
  await p.screenshot({ path: path.join(out, `boss${reg}.png`) });
});
await check('보스방 3초 진행 + 스크린샷', PC, async p => {
  await p.evaluate(() => window.__lk.setRoom('boss')); await p.waitForTimeout(3000);
  eq(await p.evaluate(() => window.__lk.mode), 'play');
  await p.screenshot({ path: path.join(out, 'boss.png') });
});
await check('review: 4:3 창에서 화면이 잘리지 않음', { viewport: { width: 1024, height: 768 } }, async p => {
  await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  const r = await p.evaluate(() => { const b = document.querySelector('#game').getBoundingClientRect(); return [b.left, b.right, innerWidth]; });
  ok(r[0] >= 0 && r[1] <= r[2], JSON.stringify(r));
});
const kev = (p, type, key, code) => p.evaluate(([t, k, c]) => dispatchEvent(new KeyboardEvent(t, { key: k, code: c, bubbles: true })), [type, key, code]);
await check('review: 한글 입력 상태에서도 키 조작 (ㅏ=K)', PC, async p => {
  await kev(p, 'keydown', 'Enter', 'Enter'); await kev(p, 'keyup', 'Enter', 'Enter'); await p.waitForTimeout(250);
  for (let i = 0; i < 2; i++) { await kev(p, 'keydown', 'Enter', 'Enter'); await kev(p, 'keyup', 'Enter', 'Enter'); await p.waitForTimeout(i ? 250 : 2300); }   // 마을 → (아이리스) 출발(지역 입장) → 들어간다
  eq(await p.evaluate(() => window.__lk.mode), 'play'); await p.waitForTimeout(1300); await watch(p);   // 아이리스가 열릴 때까지
  await kev(p, 'keydown', 'ㅏ', 'KeyK'); await kev(p, 'keyup', 'ㅏ', 'KeyK'); await p.waitForTimeout(150);
  ok((await log(p)).some(l => l.s === 'parry'));
});
await check('review: 전투 중 세로로 돌리면 일시정지', PHONE, async p => {
  await p.evaluate(() => window.__lk.start()); await p.waitForTimeout(200);
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  eq(await p.evaluate(() => window.__lk.mode), 'pause');
});
await check('review: 플레이 중 누른 Enter가 사망 화면을 건너뛰지 않음', PC, async p => {
  await p.evaluate(() => window.__lk.start()); await p.waitForTimeout(200);
  await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  await p.evaluate(() => { const w = window.__lk.world; w.over = true; w.player.state = 'dead'; });
  await p.waitForTimeout(1500); ok(await p.evaluate(() => window.__lk.R.death > 0), 'death cinematic playing');   // 사망 연출 (약 3.8초)
  await p.keyboard.press('Enter'); await p.waitForTimeout(2900);
  eq(await p.evaluate(() => window.__lk.mode), 'dead');
});
await check('review: 스틱 영역 두 번째 손가락을 떼도 첫 손가락 이동 유지', PHONE, async p => {
  await p.evaluate(() => window.__lk.start()); await p.waitForTimeout(200);
  await p.evaluate(() => {
    const z = document.querySelector('#stickzone'), r = z.getBoundingClientRect(), y = r.top + r.height * 0.7;
    z.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 31, pointerType: 'touch', clientX: r.left + 100, clientY: y }));
    z.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 31, pointerType: 'touch', clientX: r.left + 140, clientY: y }));
    z.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 32, pointerType: 'touch', clientX: r.left + 200, clientY: y - 80 }));
    z.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 32, pointerType: 'touch' }));
  });
  const x0 = await p.evaluate(() => window.__lk.world.player.x); await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.__lk.world.player.x) - x0 > 20, 'stopped');
});
await check('review: 포인터 캡처를 잃으면 버튼이 눌린 채로 남지 않음', PHONE, async p => {
  await p.evaluate(() => window.__lk.start()); await p.waitForTimeout(200);
  await p.evaluate(() => { const b = document.querySelector('#b-jump'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 41, pointerType: 'touch' })); b.dispatchEvent(new PointerEvent('lostpointercapture', { bubbles: true, pointerId: 41, pointerType: 'touch' })); });
  await p.waitForTimeout(100);
  eq(await p.evaluate(() => document.querySelector('#b-jump').classList.contains('down')), false);
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
