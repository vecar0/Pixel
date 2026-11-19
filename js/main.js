// 진입점: 화면 흐름(타이틀 → 아레나 → 보스), 고정 스텝 루프, 효과음 연결
import { createWorld, tick } from './core/world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sfx } from './sfx.js';
import { stepLoop } from './loop.js';
import { spawnEnemy } from './core/enemies.js';

const $ = s => document.querySelector(s);
const ui = $('#ui'), touch = $('#touch');
const R = new Renderer($('#game'));
const input = new Input(touch);
const sfx = new Sfx();
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const showTouch = () => touch.classList.toggle('hidden', !TOUCH);
input.onAny = () => sfx.unlock();

let mode = 'title', world = createWorld({ room: 'arena' }), acc = 0, last = performance.now();
// 테스트·디버그용 훅
const lk = window.__lk = { get world() { return world; }, get mode() { return mode; }, setRoom, start, R, step: () => step(), spawn: (k, x, y) => spawnEnemy(world, k, x, y) };

function screen(html) { ui.innerHTML = html ? `<div class="screen">${html}</div>` : ''; }
function bind(id, fn) { const b = document.getElementById(id); if (b) b.addEventListener('pointerup', e => { e.preventDefault(); sfx.unlock(); fn(); }); }

function setRoom(room) { world = createWorld({ room }); acc = 0; mode = 'play'; screen(''); showTouch(); }
function start() { setRoom('arena'); }

function title() {
  mode = 'title'; touch.classList.add('hidden');
  screen(`<div class="title">
    <h1>등불지기</h1><div class="sub">회색 상자 · 전투 손맛 테스트</div>
    <div class="help">패링 K · 공격 J · 회피 L · 점프 W · 필살 I · 기름병 Q</div>
    <button class="btn" id="go">시작</button></div>`);
  bind('go', start);
}

function overlay(kind) {
  mode = kind; touch.classList.add('hidden');
  const p = world.player;
  const stat = `<div class="stat">완벽 패링 ${p.perfectParries}회</div>`;
  if (kind === 'cleared') {
    screen(`<div class="card"><h2>구역 정리</h2>${stat}<button class="btn" id="next">무덤종에게</button></div>`);
    bind('next', () => setRoom('boss'));
  } else if (kind === 'won') {
    screen(`<div class="card"><h2>무덤종 격파!</h2><div class="line">"…다음 등불로."</div>${stat}<button class="btn" id="again">다시</button><button class="btn alt" id="arena">아레나부터</button></div>`);
    bind('again', () => setRoom('boss')); bind('arena', start);
  } else if (kind === 'dead') {
    screen(`<div class="card"><h2>등불이 꺼졌다</h2>${stat}<button class="btn" id="again">다시</button><button class="btn alt" id="arena">아레나부터</button></div>`);
    bind('again', () => setRoom(world.room)); bind('arena', start);
  } else if (kind === 'pause') {
    screen(`<div class="card"><h2>일시정지</h2><button class="btn" id="resume">계속</button><button class="btn alt" id="home">처음으로</button></div>`);
    bind('resume', resume); bind('home', title);
  }
}
function resume() { mode = 'play'; screen(''); showTouch(); last = performance.now(); acc = 0; }

const SOUND = { attackHit: 'hit', hurt: 'hurt', kill: 'kill', execute: 'execute', slam: 'slam', ultStart: 'ult', telegraph: 'telegraph' };
function onEvents(w) {
  for (const ev of w.events) {
    if (ev.type === 'parry') { sfx.play(ev.perfect ? 'parryPerfect' : 'parryNormal'); if (ev.perfect && navigator.vibrate) navigator.vibrate(30); }
    else if (SOUND[ev.type]) sfx.play(SOUND[ev.type]);
  }
  const p = w.player;
  if (p.stateT === 0 && p.state === 'attack') sfx.play('swing');
  if (p.stateT === 0 && p.state === 'roll') sfx.play('roll');
}

function step() {
  tick(world, input.read());
  onEvents(world);
  R.spawnFx(world); R.stepFx();
}

function frame(now) {
  const dt = now - last; last = now;
  if (mode === 'title' && input.take('confirm')) start();
  if (mode === 'play') {
    if (input.take('pause')) overlay('pause');
    else {
      acc = stepLoop(acc, dt, step);
      if (world.over) overlay('dead');
      else if (world.won) overlay('won');
      else if (world.cleared) overlay('cleared');
    }
  } else if (mode === 'pause' && input.take('pause')) resume();
  else if (mode !== 'play' && mode !== 'title' && input.take('confirm')) document.querySelector('#ui .btn')?.dispatchEvent(new PointerEvent('pointerup'));
  R.draw(world);
  requestAnimationFrame(frame);
}

$('#b-pause').addEventListener('pointerup', () => mode === 'play' && overlay('pause'));
addEventListener('resize', () => R.resize());
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') overlay('pause'); });
touch.addEventListener('contextmenu', e => e.preventDefault());

title();
requestAnimationFrame(frame);
