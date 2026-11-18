// 브라우저 검수: node tests/e2e.mjs [출력폴더]
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = process.argv[2] || path.join(root, 'tests', 'shots'); fs.mkdirSync(out, { recursive: true });
const types = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webmanifest':'application/json' };
const srv = http.createServer((q,r)=>{ let u=decodeURIComponent(q.url.split('?')[0]); if(u.endsWith('/')) u+='index.html'; const f=path.join(root,u); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);r.end();return;} r.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'}); r.end(d); }); }).listen(0);
const url = `http://localhost:${srv.address().port}/`;
let pass=0, fail=0; const ok=(c,n,i='')=>{ if(c){pass++;console.log('  ✔',n);} else {fail++;console.log('  ✘',n,i);} };
const b = await chromium.launch();
async function run(label, ctxOpts, fn) {
  const ctx = await b.newContext(ctxOpts); const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(700);
  await fn(p);
  ok(errs.length===0, `${label}: 콘솔 에러 0건`, JSON.stringify(errs.slice(0,5)));
  await ctx.close();
}
const shot = (p, n) => p.screenshot({ path: path.join(out, n + '.png') });

await run('PC', { viewport:{width:1280,height:720} }, async p => {
  await shot(p,'1_title');
  ok(await p.evaluate(()=>window.__neon.mode)==='title', '타이틀 화면');
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>window.__neon.mode)==='select', '선택 화면 진입');
  ok(await p.locator('.stat').count()===4, '스탯 바 4개');
  ok(await p.locator('.slot').count()===3, '캐릭터 슬롯 3개');
  ok(await p.locator('.slot.locked').count()===2, '잠긴 캐릭터 2명');
  await shot(p,'2_select');
  await p.locator('.slot').nth(1).click(); await p.waitForTimeout(200); await shot(p,'2b_select_locked');
  await p.locator('.slot').nth(0).click(); await p.waitForTimeout(200);
  await p.click('#start'); await p.waitForTimeout(500);
  ok(await p.evaluate(()=>window.__neon.mode)==='play', '게임 시작');
  await p.keyboard.down('d'); await p.waitForTimeout(900); await p.keyboard.up('d');
  const x = await p.evaluate(()=>window.__neon.game.p.x);
  ok(x > 60, '키보드로 이동', x);
  await shot(p,'3_start_room');
  // 다음 방(전투)까지 이동
  await p.keyboard.down('d'); await p.waitForTimeout(3500);
  await p.keyboard.down('j'); await p.waitForTimeout(1500);
  await shot(p,'4_combat');
  await p.keyboard.up('d');
  for (let i=0;i<6;i++){ await p.keyboard.press('w'); await p.waitForTimeout(300); await p.keyboard.down('a'); await p.waitForTimeout(400); await p.keyboard.up('a'); await p.keyboard.down('d'); await p.waitForTimeout(400); await p.keyboard.up('d'); }
  await shot(p,'5_combat2');
  await p.keyboard.up('j');
  const st = await p.evaluate(()=>{ const g=window.__neon.game; return {room:g.room.type, locked:g.room.locked, kills:g.kills, enemies:g.enemies.length}; });
  ok(st.room==='combat' && (st.locked || st.kills>0), '전투방에서 문 잠김/교전', JSON.stringify(st));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(await p.evaluate(()=>window.__neon.mode)==='pause', '일시정지');
  await shot(p,'6_pause');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // 버프 선택 화면 강제 확인
  await p.evaluate(()=>{ const g=window.__neon.game; g.openPick('statue'); });
  await p.waitForTimeout(300);
  ok(await p.evaluate(()=>window.__neon.mode)==='pick', '버프 카드 화면');
  await shot(p,'7_pick');
  await p.keyboard.down('1'); await p.waitForTimeout(100); await p.keyboard.up('1'); await p.waitForTimeout(200);
  ok(await p.evaluate(()=>Object.keys(window.__neon.game.taken).length)>=1, '버프 선택 반영');
  // 보스 층으로 점프해서 그리기 확인
  for (const f of [5,10,15]) {
    await p.evaluate((f)=>{ const g=window.__neon.game; g.god=true; g.startFloor(f); g.roomIdx=g.plan.length-1; g.loadRoom(); }, f);
    await p.waitForTimeout(2600); await shot(p,`8_boss_${f}`);
    ok(await p.evaluate(()=>!!window.__neon.game.boss), `${f}층 보스 등장`);
  }
  // 상점/석상/테마
  await p.evaluate(()=>{ const g=window.__neon.game; g.startFloor(7); g.plan[1]='shop'; g.roomIdx=1; g.loadRoom(); g.coins=999; });
  await p.waitForTimeout(400); await shot(p,'9_shop');
  await p.evaluate(()=>{ const g=window.__neon.game; g.startFloor(17); g.roomIdx=1; g.plan[1]='combat'; g.loadRoom(); g.p.x=120; });
  await p.waitForTimeout(2200); await shot(p,'10_castle');
  // 사망 → 결과
  await p.evaluate(()=>{ const g=window.__neon.game; g.god=false; g.p.inv=0; g.p.armor=0; g.p.hp=1; g.mods.revives=0; g.p.shieldReady=false; g.p.dashT=0; g.hurtPlayer(1); });
  await p.waitForTimeout(2200);
  ok(await p.evaluate(()=>window.__neon.mode)==='over', '사망 후 결과 화면');
  await shot(p,'11_over');
  const saved = await p.evaluate(()=>JSON.parse(localStorage.getItem('neonpaw_save_v1')));
  ok(saved && saved.best>=17 && saved.runs===1, '기록 저장 (localStorage)', JSON.stringify(saved));
  // 성능: 최악 장면
  await p.click('#again'); await p.waitForTimeout(300);
  const fps = await p.evaluate(async()=>{
    const g=window.__neon.game; g.god=true; g.startFloor(10); g.roomIdx=g.plan.length-1; g.loadRoom();
    await new Promise(r=>setTimeout(r,1800));
    for(let i=0;i<25;i++) g.addEnemy(['slime','bat','goblin','mage','drone'][i%5], 80+i*15, 100).spawnT=0;
    for(let i=0;i<300;i++) g.eShoot(g.enemies[i%g.enemies.length], i*0.37, 30, {});
    for(let i=0;i<40;i++) g.spark(200,150,'#fff',10);
    let n=0; const t0=performance.now();
    await new Promise(r=>{ const f=()=>{ n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
    return n/((performance.now()-t0)/1000);
  });
  await shot(p,'12_stress');
  ok(fps > 50, `최악 장면 FPS ${fps.toFixed(1)}`);
});

await run('모바일', { viewport:{width:844,height:390}, isMobile:true, hasTouch:true, deviceScaleFactor:2 }, async p => {
  await p.tap('.title'); await p.waitForTimeout(300);
  await shot(p,'m1_select');
  await p.tap('#start'); await p.waitForTimeout(500);
  ok(await p.locator('#touch').isVisible(), '터치 컨트롤 표시');
  const box = await p.locator('#stickzone').boundingBox();
  const cx = box.x+110, cy = box.y+box.height*0.7;
  await p.evaluate(({cx,cy})=>{ const z=document.querySelector('#stickzone'); const o={pointerId:7,clientX:cx,clientY:cy,bubbles:true,pointerType:'touch'}; z.dispatchEvent(new PointerEvent('pointerdown',o)); z.dispatchEvent(new PointerEvent('pointermove',{...o,clientX:cx+50})); }, {cx,cy});
  await p.waitForTimeout(900);
  const x = await p.evaluate(()=>window.__neon.game.p.x);
  ok(x > 60, '가상 스틱으로 이동', x);
  await p.evaluate(()=>{ const b=document.querySelector('#b-jump'); b.dispatchEvent(new PointerEvent('pointerdown',{pointerId:8,bubbles:true})); });
  await p.waitForTimeout(150);
  ok(await p.evaluate(()=>window.__neon.game.p.vy<0 || !window.__neon.game.p.onGround), '점프 버튼');
  await p.evaluate(()=>{ const b=document.querySelector('#b-jump'); b.dispatchEvent(new PointerEvent('pointerup',{pointerId:8,bubbles:true})); });
  await p.evaluate(()=>{ const b=document.querySelector('#b-skill'); b.dispatchEvent(new PointerEvent('pointerdown',{pointerId:9,bubbles:true})); b.dispatchEvent(new PointerEvent('pointerup',{pointerId:9,bubbles:true})); });
  await p.waitForTimeout(150);
  ok(await p.evaluate(()=>window.__neon.game.p.skillCd>0), '스킬 버튼');
  await p.waitForTimeout(1500);
  await shot(p,'m2_play');
});
await b.close(); srv.close();
console.log(`\n결과: ${pass} 통과 / ${fail} 실패`); process.exit(fail?1:0);
