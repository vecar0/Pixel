// 검수: 실제 브라우저(폰 가로)에서 한 판 전체를 진행하며 콘솔 에러·경고·404를 모은다. node tests/playthrough.mjs [스크린샷 폴더]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = process.argv[2] || path.join(root, 'tests', 'shots'); fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/json' };
const missing = [];
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html'; fs.readFile(path.join(root, u), (e, d) => { if (e) { missing.push(u); r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(u)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage(), errs = [], log = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
const tap = sel => p.evaluate(s => { const el = document.querySelector(s); if (!el) throw new Error('없음 ' + s); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); }, sel);
const mode = () => p.evaluate(() => window.__lk.mode);
const run = () => p.evaluate(() => ({ room: window.__lk.run.room, idx: window.__lk.run.roomIdx, region: window.__lk.run.region }));
const until = async (fn, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await p.waitForTimeout(100); } return false; };
const fail = m => { throw new Error(m); };

await p.goto(`http://localhost:${srv.address().port}/`); await p.waitForTimeout(800);
await tap('#go'); await p.waitForTimeout(300);                                  // 타이틀 → 마을
(await mode()) === 'town' || fail('마을 아님');
await p.keyboard.press('Enter'); await p.waitForTimeout(300);                    // 마을에서 Enter = 바로 출발 → 지역 입장
(await mode()) === 'intro' || fail('지역 입장 아님');
let stages = 0;
for (let guard = 0; guard < 2000; guard++) {
  const m = await mode();
  if (m === 'intro') { await tap('#go'); await p.waitForTimeout(400); continue; }
  if (m === 'transition') { await p.waitForTimeout(150); continue; }               // 아이리스가 닫히는 중
  if (m === 'finish' || (await p.evaluate(() => !!document.querySelector('.card.result')))) break;
  if (m !== 'play') fail('예상 못한 화면 ' + m);
  await until(async () => !(await p.evaluate(() => window.__lk.R.irisBusy() || !!window.__lk.R.cine)), 8000);   // 전환 연출 끝까지
  const st = await run(); stages++; log.push(`지역${st.region} ${st.idx + 1}번째 ${st.room}`);
  await p.screenshot({ path: path.join(out, `run-${String(stages).padStart(2, '0')}-${st.region}-${st.room}.png`) });
  if (st.room === 'rest' || st.room === 'shop') {
    await p.evaluate(() => { const w = window.__lk.world; w.player.x = w.props[0].x - 11; }); await p.waitForTimeout(150);
    await p.keyboard.press('j'); await p.waitForTimeout(250);
    (await mode()) === st.room || fail(st.room + ' 창이 안 열림');
    await tap(st.room === 'rest' ? '[data-id=heal]' : '[data-id=leave]'); await p.waitForTimeout(250);
  } else {
    // 전투: 리라는 무적, 적을 차례로 처치 (웨이브 포함)
    await p.evaluate(() => { window.__lk.world.player.iframes = 1e9; });
    const done = await until(async () => {
      await p.evaluate(async () => { const { damageEnemy } = await import('/js/core/combat.js'); const w = window.__lk.world; for (const e of w.enemies) if (!(e.spawnT > 0)) damageEnemy(w, e, 99999); });
      const md = await mode(); return md !== 'play' || await p.evaluate(() => !!window.__lk.world.rewarded);
    }, 20000);
    done || fail('방을 못 끝냄 ' + JSON.stringify(st) + ' ' + await p.evaluate(() => { const w = window.__lk.world; return JSON.stringify({ en: w.enemies.map(e => [e.kind, e.hp, e.spawnT, Math.round(e.x), Math.round(e.y), e.st]), waves: w.waves.length, cl: w.cleared, rw: w.rewarded, over: w.over, iris: window.__lk.R.irisBusy(), cine: !!window.__lk.R.cine, t: w.t }); }));
    const md = await mode();
    if (st.room === 'boss') {
      if (md !== 'won') fail('보스 뒤 won 아님: ' + md);
      if (await p.evaluate(() => !!document.querySelector('#next'))) { await tap('#next'); await p.waitForTimeout(300); await tap('.pick'); await p.waitForTimeout(300); continue; }
      break;                                                                  // 마지막 보스 → 결과 화면
    }
    md === 'play' || fail('방을 비운 뒤 바로 보상 화면이 뜸(출구 뒤로 미뤄야 함): ' + md);
    await p.waitForTimeout(300);
  }
  (await mode()) === 'play' || fail('방으로 안 돌아옴: ' + (await mode()) + ' ' + JSON.stringify(st) + ' ' + log.slice(-3).join('|') + ' html=' + (await p.evaluate(() => document.querySelector('#ui').innerText.slice(0, 120))));
  await p.evaluate(() => { const w = window.__lk.world; window.__oldW = w; w.player.x = w.props.find(o => o.kind === 'exit').x; });
  // 출구 → 아이리스가 검게 닫힘 → (전투방이면 단련, 강적방이면 각인) → 새 방
  let rewarded = false;
  const moved = await until(async () => {
    if (await mode() === 'relic') {
      const closed = await p.evaluate(() => window.__lk.R.irisClock >= 1.02);
      closed || fail('보상 화면이 아이리스가 닫히기 전에 뜸');
      if (await p.evaluate(() => !!document.querySelector('[data-up]'))) {
        for (let k = 0; k < 4 && await p.evaluate(() => document.querySelector('#train').disabled); k++) { await tap('.arw:not([disabled]):not(.back)'); await p.waitForTimeout(100); }
        await tap('#train');
      }
      else await tap('.pick');
      rewarded = true; await p.waitForTimeout(150);
    }
    return p.evaluate(() => window.__lk.world !== window.__oldW);
  }, 12000);
  moved || fail('출구로 못 나감 ' + JSON.stringify(st));
  if ((st.room === 'combat' || st.room === 'elite') && !rewarded) fail('출구 뒤 보상 화면 없음 ' + JSON.stringify(st));
}
await p.waitForTimeout(500); await p.screenshot({ path: path.join(out, 'run-end.png') });
const end = await p.evaluate(() => document.querySelector('.card.result h2')?.textContent || '');
console.log(log.join('\n'));
console.log(`스테이지 ${stages}개 진행, 결과: ${end}`);
console.log('콘솔 에러/경고:', errs.length, JSON.stringify(errs.slice(0, 5)));
console.log('404:', JSON.stringify([...new Set(missing)]));
await browser.close(); srv.close();
process.exit(stages === 23 && end && !errs.length && !missing.length ? 0 : 1);
