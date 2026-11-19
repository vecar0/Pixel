// 진입점: 화면 흐름(타이틀 → 아레나 → 보스), 고정 스텝 루프, 효과음 연결
import { createWorld, tick } from './core/world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sfx } from './sfx.js';
import { stepLoop } from './loop.js';
import { spawnEnemy } from './core/enemies.js';
import { defaultSave, SAVE_KEY, UNLOCKS, OILS, DARK_RULES, buy, relicPool, oilsOwned, recordRun, dailySeed } from './core/meta.js';
import { ENEMY_DEFS } from './core/enemies.js';
import { REGIONS, CHALLENGES, advanceRegion, regionOf, challengeDone, setRegion, RELICS, OATHS, ROOM_TYPES, newRun, chooseOath, relicOffer, takeRelic, doorOffer, enterRoom, roomCleared, buildRoomWorld, saveFromWorld } from './core/run.js';

const $ = s => document.querySelector(s);
const ui = $('#ui'), touch = $('#touch');
const R = new Renderer($('#game'));
const input = new Input(touch);
const sfx = new Sfx();
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const showTouch = () => touch.classList.toggle('hidden', !TOUCH);
input.onAny = () => sfx.unlock();

// 저장 (등불 조각·해금·기록·설정)
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) return { ...defaultSave(), ...s, records: { ...defaultSave().records, ...s.records }, settings: { ...defaultSave().settings, ...s.settings } }; } catch (e) { } return defaultSave(); }
let save = loadSave();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } }
let bossesKilled = [], practice = false;

let run = null, mode = 'title', world = createWorld({ room: 'arena' }), acc = 0, last = performance.now(), slowT = 0;
// 테스트·디버그용 훅
const lk = window.__lk = { get world() { return world; }, get mode() { return mode; }, setRoom, start, R, step: () => step(), spawn: (k, x, y) => spawnEnemy(world, k, x, y), gotoBoss: reg => { setRegion(run, reg); enterRoom(run, 'boss'); play(); } };

function screen(html) { input.clear(); ui.innerHTML = html ? `<div class="screen">${html}</div>` : ''; }
function bind(id, fn) { const b = document.getElementById(id); if (b) b.addEventListener('pointerup', e => { e.preventDefault(); sfx.unlock(); fn(); }); }

function play() {
  world = buildRoomWorld(run); R.runInfo = run; R.region = run.region;
  R.reset(); R.dir.preloadRegion(run.region); R.dir.enterRoom(world, run.region, run.room === 'boss');
  world.player.lagTicks = Math.max(0, Math.min(6, Math.round(save.settings.offsetMs / 16.7)));   // 타이밍 보정
  sfx.musicFor(run.region, run.room === 'boss'); acc = 0; slowT = 0; mode = 'play'; screen(''); showTouch(); }
// 디버그·테스트용: 방 바로 열기
function setRoom(room) { if (!run) { run = newRun(); chooseOath(run, 'parry'); } enterRoom(run, room === 'arena' ? 'combat' : room); play(); }
// 빠른 시작 (패링의 서약)
function start() { run = newRun(); chooseOath(run, 'parry'); enterRoom(run, 'combat'); bossesKilled = []; practice = false; play(); }
function newPilgrimage(opts = {}) {
  bossesKilled = []; practice = false;
  run = newRun(opts.seed, { dark: save.dark, pool: relicPool(save), oil: save.oil, shortcut: (save.bossKills.bellBoss || 0) >= 3, daily: !!opts.daily });
}

const relicCard = (id, extra = '') => `<button class="pick" data-id="${id}"><b>${RELICS[id].name}</b><span>${RELICS[id].desc}</span>${extra}</button>`;
function bindPicks(fn) { for (const b of ui.querySelectorAll('.pick')) b.addEventListener('pointerup', e => { e.preventDefault(); sfx.unlock(); fn(b.dataset.id); }); }
const runStat = () => `<div class="stat">지역 ${run.region} · 방 ${run.roomIdx + 1}/${run.length} · 완벽 패링 ${run.perfect + (world ? world.player.perfectParries : 0)} · 불씨 ${run.embers} · 각인 ${run.relics.length}</div>`;

function title() {
  mode = 'title'; touch.classList.add('hidden'); sfx.musicFor(0);
  screen(`<div class="title">
    <h1>등불지기</h1><div class="sub">꺼져 가는 지하 왕국, 마지막 등불을 든 순례자</div>
    <div class="help">패링 K · 공격 J · 회피 L · 점프 W · 필살 I · 기름병 Q</div>
    <button class="btn" id="go">등대 마을로</button></div>`);
  bind('go', town);
}
// 등대 마을: 출발 · 오늘의 시련 · 해금 · 기름 · 어둠 단계 · 연습장 · 기록 · 설정
function town() {
  mode = 'town'; touch.classList.add('hidden'); sfx.musicFor(0);
  const d = dailySeed(), dailyDone = save.daily[d.key];
  const darkOpts = Array.from({ length: save.darkUnlocked + 1 }, (_, i) => `<option value="${i}" ${i === save.dark ? 'selected' : ''}>어둠 ${i}${i ? ' · ' + DARK_RULES[i] : ' (기본)'}</option>`).join('');
  const oilOpts = oilsOwned(save).map(k => `<option value="${k}" ${k === save.oil ? 'selected' : ''}>${OILS[k].name} — ${OILS[k].desc}</option>`).join('');
  screen(`<div class="card wide town"><h2>등대 마을</h2><div class="line">등불 조각 ${save.shards} · 순례 ${save.records.runs}회 · 귀환 ${save.records.wins}회</div>
    <div class="row"><label>어둠 단계 <select id="dark">${darkOpts}</select></label><label>랜턴 기름 <select id="oil">${oilOpts}</select></label></div>
    <div class="picks">
      <button class="pick" data-id="go"><b>순례를 떠난다</b><span>서약을 고르고 지하로</span></button>
      <button class="pick" data-id="daily"><b>오늘의 시련</b><span>${dailyDone ? '오늘은 이미 도전했다 (기록용 재도전 가능)' : '모두 같은 조합 · 하루 한 번'}</span></button>
      <button class="pick" data-id="shop"><b>등대지기의 창고</b><span>등불 조각으로 해금</span></button>
      ${save.unlocked.includes('practice') ? '<button class="pick" data-id="practice"><b>연습장</b><span>쓰러뜨린 보스와 다시</span></button>' : ''}
      <button class="pick" data-id="records"><b>기록</b><span>최고 어둠 단계 · 최단 시간</span></button>
      <button class="pick" data-id="settings"><b>설정</b><span>타이밍 보정 · 소리</span></button>
    </div></div>`);
  $('#dark').addEventListener('change', e => { save.dark = +e.target.value; persist(); });
  $('#oil').addEventListener('change', e => { save.oil = e.target.value; persist(); });
  bindPicks(id => {
    if (id === 'go') { newPilgrimage(); oathScreen(); }
    else if (id === 'daily') { newPilgrimage({ seed: d.seed, daily: true }); save.daily[d.key] = true; persist(); oathScreen(); }
    else if (id === 'shop') unlockScreen();
    else if (id === 'practice') practiceScreen();
    else if (id === 'records') recordsScreen();
    else if (id === 'settings') settingsScreen();
  });
}
function unlockScreen() {
  mode = 'unlock';
  screen(`<div class="card wide"><h2>등대지기의 창고</h2><div class="line">등불 조각 ${save.shards}</div><div class="picks">
    ${UNLOCKS.map(u => `<button class="pick" data-id="${u.id}" ${save.unlocked.includes(u.id) ? 'disabled' : ''}><b>${u.name}</b><span>${u.desc || (u.relic ? RELICS[u.relic].desc : '')}</span><em>${save.unlocked.includes(u.id) ? '해금됨' : '조각 ' + u.cost}</em></button>`).join('')}
    <button class="pick" data-id="back"><b>돌아가기</b></button></div></div>`);
  bindPicks(id => { if (id === 'back') return town(); if (buy(save, id)) { persist(); sfx.play('kill'); } unlockScreen(); });
}
function practiceScreen() {
  mode = 'practice';
  const bosses = REGIONS.filter(g => save.bossKills[g.boss]);
  screen(`<div class="card wide"><h2>연습장</h2><div class="line">기록되지 않는 연습. 패턴을 익히세요</div><div class="picks">
    ${bosses.map(g => `<button class="pick" data-id="${g.id}"><b>${ENEMY_DEFS[g.boss].name}</b><span>${g.name}</span></button>`).join('') || '<div class="line">아직 쓰러뜨린 보스가 없다</div>'}
    <button class="pick" data-id="back"><b>돌아가기</b></button></div></div>`);
  bindPicks(id => { if (id === 'back') return town(); newPilgrimage(); chooseOath(run, 'parry'); setRegion(run, +id); enterRoom(run, 'boss'); practice = true; play(); });
}
function recordsScreen() {
  mode = 'records'; const r = save.records;
  screen(`<div class="card wide"><h2>기록</h2>
    <div class="line">최고 어둠 단계 ${r.bestDark < 0 ? '-' : r.bestDark} · 최단 귀환 ${r.fastest ? (r.fastest / 60 / 60).toFixed(1) + '분' : '-'}</div>
    <div class="line">완벽 패링 누적 ${r.perfectTotal} · 도전 성공 ${r.challenges} · 무피격 보스 ${r.noHitBosses.length ? r.noHitBosses.map(k => ENEMY_DEFS[k].name).join(', ') : '-'}</div>
    <div class="line">보스 처치: ${REGIONS.map(g => `${ENEMY_DEFS[g.boss].name} ${save.bossKills[g.boss] || 0}`).join(' · ')}</div>
    <button class="btn" id="back">돌아가기</button></div>`);
  bind('back', town);
}
// 설정: 타이밍 보정 (박자 탭으로 측정) · 소리
function settingsScreen() {
  mode = 'settings'; const st = save.settings;
  screen(`<div class="card wide"><h2>설정</h2>
    <div class="row"><label>타이밍 보정 <input id="off" type="range" min="-50" max="100" step="10" value="${st.offsetMs}"> <b id="offv">${st.offsetMs}ms</b></label></div>
    <div class="line">폰 터치가 늦게 느껴지면 값을 올리세요. 패링 판정창이 그만큼 늘어납니다.</div>
    <div class="row"><label><input id="snd" type="checkbox" ${st.sound ? 'checked' : ''}> 효과음</label><label><input id="mus" type="checkbox" ${st.music ? 'checked' : ''}> 배경음악</label></div>
    <button class="btn" id="cal">박자 맞춰 측정</button><button class="btn alt" id="back">돌아가기</button>
    <div class="line" id="calmsg"></div></div>`);
  $('#off').addEventListener('input', e => { st.offsetMs = +e.target.value; $('#offv').textContent = st.offsetMs + 'ms'; persist(); });
  $('#snd').addEventListener('change', e => { st.sound = e.target.checked; sfx.on = st.sound; persist(); });
  $('#mus').addEventListener('change', e => { st.music = e.target.checked; sfx.musicOn = st.music; sfx.musicFor(0); persist(); });
  bind('back', town); bind('cal', calibrate);
}
// 측정 도우미: 0.6초 간격 '틱' 8번에 맞춰 화면을 탭 → 평균 지연
function calibrate() {
  mode = 'calibrate'; const beats = [], taps = [], T = 600, t0 = performance.now() + 800;
  screen(`<div class="card wide"><h2>박자에 맞춰 탭!</h2><div class="line">'틱' 소리가 날 때마다 아무 곳이나 누르세요 (8번)</div><div class="big" id="cnt">준비</div></div>`);
  for (let i = 0; i < 8; i++) { beats.push(t0 + i * T); setTimeout(() => { sfx.play('telegraph'); const c = $('#cnt'); if (c) c.textContent = i + 1; }, t0 + i * T - performance.now()); }
  const onTap = e => { taps.push(e.timeStamp || performance.now()); };
  ui.addEventListener('pointerdown', onTap);
  setTimeout(() => {
    ui.removeEventListener('pointerdown', onTap);
    const deltas = taps.map(t => { const b = beats.reduce((a, x) => Math.abs(x - t) < Math.abs(a - t) ? x : a); return t - b; }).filter(d => Math.abs(d) < 250);
    if (deltas.length >= 4) { deltas.sort((a, b) => a - b); const med = deltas[deltas.length >> 1]; save.settings.offsetMs = Math.max(-50, Math.min(100, Math.round(med / 10) * 10)); persist(); }
    settingsScreen(); const m = $('#calmsg'); if (m) m.textContent = deltas.length >= 4 ? `측정 완료: ${save.settings.offsetMs}ms` : '탭이 너무 적어요. 다시 해보세요';
  }, t0 + 8 * T + 400 - performance.now());
}
function oathScreen() {
  mode = 'oath'; touch.classList.add('hidden'); if (!run || run.relics.length) newPilgrimage();
  const ch = CHALLENGES.find(c => c.id === run.challenge);
  screen(`<div class="card wide"><h2>서약을 고르세요${run.daily ? ' · 오늘의 시련' : ''}</h2><div class="line">이번 판 도전: ${ch.name} (성공 시 등불 조각 +2) · 어둠 ${run.dark}</div><div class="picks">${OATHS.map(o => `<button class="pick" data-id="${o.id}"><b>${o.name}</b><span>${o.desc}</span></button>`).join('')}</div></div>`);
  bindPicks(id => { chooseOath(run, id); enterRoom(run, 'combat'); regionIntro(); });
}
function relicScreen(after) {
  mode = 'relic'; touch.classList.add('hidden');
  const offer = relicOffer(run);
  if (!offer.length) return after();
  screen(`<div class="card wide"><h2>각인을 하나 고르세요</h2>${runStat()}<div class="picks">${offer.map(id => relicCard(id)).join('')}</div></div>`);
  bindPicks(id => { takeRelic(run, id); after(); });
}
function doorScreen() {
  mode = 'door'; touch.classList.add('hidden');
  const doors = doorOffer(run);
  screen(`<div class="card wide"><h2>다음 길</h2>${runStat()}<div class="picks">${doors.map(t => `<button class="pick door" data-id="${t}"><i>${ROOM_TYPES[t].icon}</i><b>${ROOM_TYPES[t].name}</b></button>`).join('')}</div></div>`);
  bindPicks(t => { enterRoom(run, t); if (t === 'rest') restScreen(); else if (t === 'shop') shopScreen(); else play(); });
}
function restScreen() {
  mode = 'rest'; const maxHp = 5 + (run.relics.includes('vigor') ? 1 : 0), maxF = 3 + (run.relics.includes('oil') ? 1 : 0);
  screen(`<div class="card wide"><h2>작은 등불 · 휴식</h2><div class="line">등불 곁에서 잠시 숨을 고릅니다</div>${runStat()}<div class="picks">
    <button class="pick" data-id="heal"><b>몸을 추스른다</b><span>체력 +2</span></button>
    <button class="pick" data-id="oil"><b>기름을 채운다</b><span>기름병 가득</span></button></div></div>`);
  bindPicks(id => { if (id === 'heal') run.hp = Math.min(maxHp, (run.hp ?? maxHp) + 2); else run.flasks = maxF; roomCleared(run); run.embers -= 10; doorScreen(); });
}
function shopScreen() {
  mode = 'shop'; const offer = relicOffer(run, 2);
  const draw = () => {
    screen(`<div class="card wide"><h2>떠돌이 상인</h2><div class="line">"불씨만 있으면 뭐든 내주지."</div>${runStat()}<div class="picks">
      ${offer.map(id => relicCard(id, `<em>불씨 30</em>`)).join('')}
      <button class="pick" data-id="flask"><b>기름병 1개</b><span>기름병 +1</span><em>불씨 15</em></button>
      <button class="pick" data-id="leave"><b>떠난다</b><span>다음 길로</span></button></div></div>`);
    bindPicks(id => {
      if (id === 'leave') { roomCleared(run); run.embers -= 10; return doorScreen(); }
      if (id === 'flask' && run.embers >= 15) { run.embers -= 15; run.flasks = (run.flasks ?? 3) + 1; }
      else if (RELICS[id] && run.embers >= 30) { run.embers -= 30; takeRelic(run, id); offer.splice(offer.indexOf(id), 1); }
      draw();
    });
  };
  draw();
}

function overlay(kind) {
  mode = kind; touch.classList.add('hidden');
  if (kind === 'cleared') {
    saveFromWorld(run, world); roomCleared(run);
    relicScreen(doorScreen);
  } else if (kind === 'won') {
    saveFromWorld(run, world);
    const boss = regionOf(run).boss;
    if (practice) { screen(`<div class="card"><h2>연습 완료</h2><button class="btn" id="back">마을로</button></div>`); return bind('back', town); }
    bossesKilled.push(boss);
    if (run.noHitBoss && !save.records.noHitBosses.includes(boss)) save.records.noHitBosses.push(boss);
    run.noHitBoss = run.noHitBoss || false;
    if (advanceRegion(run)) {
      screen(`<div class="card wide"><h2>${ENEMY_DEFS[boss].name} 격파 — 대등이 다시 켜졌다</h2><div class="line">체력이 모두 회복되었다. 더 깊은 곳으로.</div>${runStat()}<button class="btn" id="next">계속</button></div>`);
      bind('next', () => relicScreen(regionIntro));
    } else finish(true);
  } else if (kind === 'dead') {
    if (practice) { screen(`<div class="card"><h2>연습 실패</h2><button class="btn" id="again">다시</button><button class="btn alt" id="back">마을로</button></div>`); bind('again', play); return bind('back', town); }
    saveFromWorld(run, world); finish(false);
  } else if (kind === 'pause') {
    screen(`<div class="card"><h2>일시정지</h2><button class="btn" id="resume">계속</button><button class="btn alt" id="home">처음으로</button></div>`);
    bind('resume', resume); bind('home', title);
  }
}
// 런 종료: 등불 조각 정산 → 결과 화면
function finish(won) {
  run.challengeDone = challengeDone(run);
  const gain = recordRun(save, run, { won, bossesKilled }); persist();
  const ch = CHALLENGES.find(c => c.id === run.challenge);
  screen(`<div class="card wide"><h2>${won ? '꺼진 태양이 다시 떠올랐다 — 순례 완료' : '등불이 꺼졌다'}</h2>
    <div class="line">${regionOf(run).name} · 방 ${run.roomIdx + 1} · 어둠 ${run.dark}</div>${runStat()}
    <div class="line">이번 판 도전 '${ch.name}': ${run.challengeDone ? '성공' : '실패'}</div>
    <div class="line">각인: ${run.relics.map(k => RELICS[k].name).join(', ') || '없음'}</div>
    <div class="stat">등불 조각 +${gain} (보유 ${save.shards})${won && save.darkUnlocked > run.dark ? ' · 어둠 단계 ' + save.darkUnlocked + ' 해금!' : ''}</div>
    <button class="btn" id="again">다시 순례</button><button class="btn alt" id="home">마을로</button></div>`);
  bind('again', () => { newPilgrimage(); oathScreen(); }); bind('home', town);
}
// 지역 입장 연출
function regionIntro() {
  mode = 'intro'; const g = regionOf(run);
  screen(`<div class="card wide intro"><div class="line">지역 ${g.id}</div><h2>${g.name}</h2><div class="line">이 지역의 대등을 지키는 것: ${ENEMY_DEFS[g.boss].name}</div><button class="btn" id="go">들어간다</button></div>`);
  bind('go', play);
}
function resume() { mode = 'play'; screen(''); showTouch(); last = performance.now(); acc = 0; }

const SOUND = { hurt: 'hurt', kill: 'kill', execute: 'execute', slam: 'slam', ultStart: 'ult', telegraph: 'telegraph' };
function onEvents(w) {
  for (const ev of w.events) {
    if (ev.type === 'parry') {
      sfx.play(ev.perfect ? 'parryPerfect' : 'parryNormal');
      if (ev.perfect) { slowT = 18; if (navigator.vibrate) navigator.vibrate(35); }
    }
    else if (ev.type === 'attackHit') { sfx.play(ev.combo === 2 ? 'hit3' : 'hit'); if (navigator.vibrate) navigator.vibrate(ev.combo === 2 ? 18 : 8); }
    else if (ev.type === 'land' && ev.v > 3) sfx.play('land');
    else if (SOUND[ev.type]) sfx.play(SOUND[ev.type]);
  }
  const p = w.player;
  if (p.stateT === 0 && p.state === 'attack') sfx.play('swing');
  if (p.stateT === 0 && p.state === 'roll') sfx.play('roll');
}

function step() {
  if (run) run.t++;
  tick(world, lk.bot ? lk.bot(world) : input.read());   // lk.bot: 데모·검수용 자동 조작
  onEvents(world);
  R.spawnFx(world); R.stepFx(world);
  if (slowT > 0 && !world.hitstop) slowT--;
}

function frame(now) {
  try { frameBody(now); } catch (e) { console.error(e); }   // 한 프레임의 에러가 게임 전체를 멈추지 않게
  requestAnimationFrame(frame);
}
function frameBody(now) {
  const dt = now - last; last = now;
  if (mode === 'title' && input.take('confirm')) town();
  if (mode === 'play') {
    if (input.take('pause')) overlay('pause');
    else {
      acc = stepLoop(acc, slowT > 0 && !world.hitstop ? dt * 0.45 : dt, step);   // 완벽 패링 직후 잠깐 슬로모션
      if (world.over) overlay('dead');
      else if (world.won) overlay('won');
      else if (world.cleared) overlay('cleared');
    }
  } else if (mode === 'pause' && input.take('pause')) resume();
  else if (mode !== 'play' && mode !== 'title' && input.take('confirm')) document.querySelector('#ui .btn, #ui .pick')?.dispatchEvent(new PointerEvent('pointerup'));
  R.draw(world);
  }

$('#b-pause').addEventListener('pointerup', () => mode === 'play' && overlay('pause'));
addEventListener('resize', () => R.resize());
// 전투 중 세로로 돌리면 일시정지 (안내 화면 뒤에서 싸움이 계속되지 않게)
const portrait = matchMedia('(orientation: portrait) and (pointer: coarse)');
portrait.addEventListener('change', () => { if (portrait.matches && mode === 'play') overlay('pause'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') overlay('pause'); });
touch.addEventListener('contextmenu', e => e.preventDefault());

sfx.on = save.settings.sound; sfx.musicOn = save.settings.music;
title();
requestAnimationFrame(frame);
