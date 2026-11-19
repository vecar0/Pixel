// 진입점: 화면 흐름(타이틀 → 아레나 → 보스), 고정 스텝 루프, 효과음 연결
import { createWorld, tick } from './core/world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sfx } from './sfx.js';
import { stepLoop } from './loop.js';
import { spawnEnemy } from './core/enemies.js';
import { RELICS, OATHS, ROOM_TYPES, newRun, chooseOath, relicOffer, takeRelic, doorOffer, enterRoom, roomCleared, buildRoomWorld, saveFromWorld } from './core/run.js';

const $ = s => document.querySelector(s);
const ui = $('#ui'), touch = $('#touch');
const R = new Renderer($('#game'));
const input = new Input(touch);
const sfx = new Sfx();
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const showTouch = () => touch.classList.toggle('hidden', !TOUCH);
input.onAny = () => sfx.unlock();

let run = null, mode = 'title', world = createWorld({ room: 'arena' }), acc = 0, last = performance.now(), slowT = 0;
// 테스트·디버그용 훅
const lk = window.__lk = { get world() { return world; }, get mode() { return mode; }, setRoom, start, R, step: () => step(), spawn: (k, x, y) => spawnEnemy(world, k, x, y) };

function screen(html) { input.clear(); ui.innerHTML = html ? `<div class="screen">${html}</div>` : ''; }
function bind(id, fn) { const b = document.getElementById(id); if (b) b.addEventListener('pointerup', e => { e.preventDefault(); sfx.unlock(); fn(); }); }

function play() { world = buildRoomWorld(run); R.runInfo = run; acc = 0; slowT = 0; R.reset(); mode = 'play'; screen(''); showTouch(); }
// 디버그·테스트용: 방 바로 열기
function setRoom(room) { if (!run) { run = newRun(); chooseOath(run, 'parry'); } enterRoom(run, room === 'arena' ? 'combat' : room); play(); }
// 빠른 시작 (패링의 서약)
function start() { run = newRun(); chooseOath(run, 'parry'); enterRoom(run, 'combat'); play(); }

const relicCard = (id, extra = '') => `<button class="pick" data-id="${id}"><b>${RELICS[id].name}</b><span>${RELICS[id].desc}</span>${extra}</button>`;
function bindPicks(fn) { for (const b of ui.querySelectorAll('.pick')) b.addEventListener('pointerup', e => { e.preventDefault(); sfx.unlock(); fn(b.dataset.id); }); }
const runStat = () => `<div class="stat">방 ${run.roomIdx + 1}/${run.length} · 완벽 패링 ${run.perfect + (world ? world.player.perfectParries : 0)} · 불씨 ${run.embers} · 각인 ${run.relics.length}</div>`;

function title() {
  mode = 'title'; touch.classList.add('hidden');
  screen(`<div class="title">
    <h1>등불지기</h1><div class="sub">꺼져 가는 지하 왕국, 마지막 등불을 든 순례자</div>
    <div class="help">패링 K · 공격 J · 회피 L · 점프 W · 필살 I · 기름병 Q</div>
    <button class="btn" id="go">순례 시작</button></div>`);
  bind('go', oathScreen);
}
function oathScreen() {
  mode = 'oath'; touch.classList.add('hidden'); run = newRun();
  screen(`<div class="card wide"><h2>서약을 고르세요</h2><div class="line">이번 순례의 방향이 정해집니다</div><div class="picks">${OATHS.map(o => `<button class="pick" data-id="${o.id}"><b>${o.name}</b><span>${o.desc}</span></button>`).join('')}</div></div>`);
  bindPicks(id => { chooseOath(run, id); enterRoom(run, 'combat'); play(); });
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
    screen(`<div class="card wide"><h2>무덤종 격파 — 첫 대등이 다시 켜졌다</h2><div class="line">"…다음 등불로."</div>${runStat()}<div class="line">각인: ${run.relics.map(k => RELICS[k].name).join(', ')}</div><button class="btn" id="again">새 순례</button><button class="btn alt" id="home">처음으로</button></div>`);
    bind('again', oathScreen); bind('home', title);
  } else if (kind === 'dead') {
    screen(`<div class="card wide"><h2>등불이 꺼졌다</h2>${runStat()}<div class="line">각인: ${run.relics.map(k => RELICS[k].name).join(', ') || '없음'}</div><button class="btn" id="again">다시 순례</button><button class="btn alt" id="home">처음으로</button></div>`);
    bind('again', oathScreen); bind('home', title);
  } else if (kind === 'pause') {
    screen(`<div class="card"><h2>일시정지</h2><button class="btn" id="resume">계속</button><button class="btn alt" id="home">처음으로</button></div>`);
    bind('resume', resume); bind('home', title);
  }
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
  tick(world, lk.bot ? lk.bot(world) : input.read());   // lk.bot: 데모·검수용 자동 조작
  onEvents(world);
  R.spawnFx(world); R.stepFx(world);
  if (slowT > 0 && !world.hitstop) slowT--;
}

function frame(now) {
  const dt = now - last; last = now;
  if (mode === 'title' && input.take('confirm')) oathScreen();
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
  requestAnimationFrame(frame);
}

$('#b-pause').addEventListener('pointerup', () => mode === 'play' && overlay('pause'));
addEventListener('resize', () => R.resize());
// 전투 중 세로로 돌리면 일시정지 (안내 화면 뒤에서 싸움이 계속되지 않게)
const portrait = matchMedia('(orientation: portrait) and (pointer: coarse)');
portrait.addEventListener('change', () => { if (portrait.matches && mode === 'play') overlay('pause'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') overlay('pause'); });
touch.addEventListener('contextmenu', e => e.preventDefault());

title();
requestAnimationFrame(frame);
