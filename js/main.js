// 진입점: 메뉴, 게임 루프, 저장
import { HEROES, HERO_ORDER, WEAPONS, RARITY, BUFFS, PERKS, SAVE_KEY, defaultSave, VIEW_W, VIEW_H } from './data.js';
import { Game } from './sim.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Audio8 } from './audio.js';
import * as A from './art.js';

const $ = s => document.querySelector(s);
const cv = $('#game');
const ui = $('#ui');
const touchRoot = $('#touch');

/* ── 저장 ── */
function load() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) return { ...defaultSave(), ...s }; } catch (e) { }
  return defaultSave();
}
let save = load();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } }

const audio = new Audio8();
audio.sound = save.sound; audio.music = save.music;
let R, input, game = null;
let mode = 'title';
const view = { touch: false, fade: 0 };
let selected = save.last && HEROES[save.last] ? save.last : 'miyu';

/* ── 유틸 ── */
function html(s) { ui.innerHTML = s; }
function heroCanvas(id, scale, sticker = false) {
  const h = R.heroes[id];
  let c = h.idle[0].r;
  if (sticker) c = A.stickerCanvas(c);
  const out = A.scaleCanvas(c, scale);
  out.className = 'pix';
  return out;
}
function toast(main, sub = '', cls = '') {
  const t = $('#toast');
  t.className = cls; t.innerHTML = main + (sub ? `<small>${sub}</small>` : '');
  requestAnimationFrame(() => t.classList.add('on'));
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 1800);
}
function click(sel, fn) { const el = typeof sel === 'string' ? ui.querySelector(sel) : sel; if (el) el.addEventListener('click', e => { e.stopPropagation(); audio.init(); audio.play('ui'); fn(e); }); }

/* ── 화면: 타이틀 ── */
function showTitle() {
  mode = 'title'; game = null; touchRoot.classList.add('hidden');
  audio.setTheme(0);
  html(`<div class="screen title">
    <div class="chars" id="tchars"></div>
    <h1>NEON <span>PAW</span></h1>
    <div class="sub">무한 지하 아케이드</div>
    <button class="btn" id="go">시작하기</button>
    <div class="rec">최고 기록 ${save.best}층 · 보석 <span class="gem">◆${save.gems}</span> · 도전 ${save.runs}회</div>
    <div class="rec blink">${view.touch ? '화면을 터치하세요' : 'Enter / 클릭'}</div>
  </div>`);
  const box = $('#tchars');
  for (const id of HERO_ORDER) box.appendChild(heroCanvas(id, 6, true));
  click('#go', showSelect);
  ui.querySelector('.title').addEventListener('click', () => { audio.init(); showSelect(); });
}

/* ── 화면: 캐릭터 선택 ── */
let selAnim = null;
function showSelect() {
  mode = 'select'; game = null; touchRoot.classList.add('hidden');
  audio.setTheme(0);
  const h = HEROES[selected];
  const locked = !save.unlocked[selected];
  const w = WEAPONS[h.weapon];
  const maxs = { hp: 10, armor: 8, energy: 300, crit: 20 };
  const stat = (n, v, m, c) => `<div class="stat"><span>${n}</span><div class="b"><i style="width:${Math.min(100, v / m * 100)}%;--c:${c}"></i></div><span>${v}</span></div>`;
  html(`<div class="screen select" style="--hc:${h.color}">
    <div class="sel-top">
      <button class="btn alt" id="back">◀</button>
      <div class="chip">최고 ${save.best}층</div>
      <div class="sp"></div>
      <div class="chip gem">◆ ${save.gems}</div>
      <button class="btn alt" id="lab">연구소</button>
      <button class="btn alt" id="help">조작법</button>
    </div>
    <div class="sel-main">
      <div class="stagebox"><div class="floor"></div><canvas id="bigc" class="pix"></canvas>
        ${locked ? `<div class="lock"><div>🔒 잠김</div><button class="btn gold" id="unlock" ${save.gems < h.cost ? 'disabled' : ''}>◆${h.cost} 해금</button></div>` : ''}
      </div>
      <div class="info panel">
        <h2>${h.name}</h2>
        <div class="ttl">${h.title}</div>
        ${stat('HP', h.hp + (save.perks.hp || 0), maxs.hp, '#ff4f6a')}
        ${stat('아머', h.armor, maxs.armor, '#a8b0c8')}
        ${stat('에너지', h.energy + (save.perks.energy || 0) * 30, maxs.energy, '#5cc8ff')}
        ${stat('치명타', h.crit, maxs.crit, '#ffd75a')}
        <div class="wrow"><span>기본 무기</span><span id="wic"></span><span style="color:${RARITY[w.rarity].color}">${w.name}</span></div>
        <div class="sk"><b>★ ${h.skill.name}</b> · 쿨다운 ${h.skill.cd}초<br>${h.skill.desc}</div>
        <div class="story">${h.story}</div>
      </div>
    </div>
    <div class="sel-bot">
      <div class="slots" id="slots"></div>
      <button class="btn" id="start" ${locked ? 'disabled' : ''}>출발 ▶</button>
    </div>
  </div>`);
  // 큰 캐릭터 (대기 모션)
  const big = $('#bigc'); const H = R.heroes[selected];
  big.width = H.w; big.height = H.h;
  const bg = big.getContext('2d'); let fi = 0;
  clearInterval(selAnim);
  const drawBig = () => { bg.clearRect(0, 0, big.width, big.height); bg.drawImage(H.idle[fi % 4].r, 0, 0); fi++; };
  drawBig(); selAnim = setInterval(drawBig, 330);
  const wi = A.scaleCanvas(R.weapons[h.weapon].c, 2); $('#wic').appendChild(wi);
  const slots = $('#slots');
  for (const id of HERO_ORDER) {
    const d = document.createElement('div');
    d.className = 'slot' + (id === selected ? ' on' : '') + (save.unlocked[id] ? '' : ' locked');
    d.appendChild(heroCanvas(id, 2));
    if (!save.unlocked[id]) { const l = document.createElement('span'); l.className = 'lk'; l.textContent = '◆' + HEROES[id].cost; d.appendChild(l); }
    click(d, () => { selected = id; showSelect(); });
    slots.appendChild(d);
  }
  click('#back', showTitle);
  click('#lab', showLab);
  click('#help', () => showHelp(showSelect));
  click('#unlock', () => { if (save.gems >= h.cost) { save.gems -= h.cost; save.unlocked[selected] = true; persist(); audio.play('buff'); showSelect(); } });
  click('#start', () => startRun(selected));
}

function showLab() {
  mode = 'lab';
  const rows = PERKS.map(pk => {
    const lv = save.perks[pk.id] || 0, max = lv >= pk.max, cost = pk.cost[lv];
    return `<div class="perk"><div><b>${pk.name}</b> <span class="lv">Lv.${lv}/${pk.max}</span><div class="d">${pk.desc}</div></div>
      <button class="btn ${max ? 'alt' : 'gold'}" data-perk="${pk.id}" ${max || save.gems < cost ? 'disabled' : ''}>${max ? '완료' : '◆' + cost}</button></div>`;
  }).join('');
  html(`<div class="screen dim"><div class="box panel"><h3>연구소 <span class="gem" style="font-size:14px">◆ ${save.gems}</span></h3>
    <div class="help">층을 클리어하면 보석을 얻어요. 보석으로 영구 강화를 연구하세요.</div>${rows}
    <div class="row"><button class="btn alt" id="close">닫기</button></div></div></div>`);
  for (const b of ui.querySelectorAll('[data-perk]')) click(b, () => {
    const pk = PERKS.find(p => p.id === b.dataset.perk), lv = save.perks[pk.id] || 0;
    if (lv < pk.max && save.gems >= pk.cost[lv]) { save.gems -= pk.cost[lv]; save.perks[pk.id] = lv + 1; persist(); audio.play('buff'); showLab(); }
  });
  click('#close', showSelect);
}

function showHelp(back) {
  html(`<div class="screen dim"><div class="box panel"><h3>조작법</h3>
    <div class="help">
      <b>PC</b> — 이동 A/D · 점프 W/Space (공중 점프 가능 버프) · 발판 내려가기 S+점프<br>
      공격 J 또는 마우스 왼쪽 (누르고 있으면 연사, 마우스로 조준) · 스킬 K/우클릭/Shift<br>
      무기 교체 Q · 줍기·열기·구매 E · 일시정지 Esc<br><br>
      <b>모바일</b> — 왼쪽 화면 드래그로 이동(아래로 당기고 점프 = 내려가기)<br>
      오른쪽 버튼: 공격(누르고 있기) · 점프 · 스킬 · 교체 · 줍기<br><br>
      <b>팁</b> — 가까운 적을 자동 조준해요. 아머는 잠시 안 맞으면 다시 차요.<br>
      근접 무기는 적 탄을 지울 수 있어요. 에너지가 없으면 근접 치기로 싸워요.<br>
      5층마다 보스! 층을 깰 때마다 버프를 골라 나만의 빌드를 만드세요.
    </div>
    <div class="row"><button class="btn alt" id="close">닫기</button></div></div></div>`);
  click('#close', back);
}

/* ── 게임 시작 ── */
function startRun(id) {
  clearInterval(selAnim);
  save.last = id; save.runs++; persist();
  game = new Game({ hero: id, perks: save.perks });
  mode = 'play'; html('');
  touchRoot.classList.toggle('hidden', !view.touch);
  updateTouchIcons();
  view.fade = 1;
  audio.init();
  handleEvents();
}

function showPick() {
  mode = 'pick';
  const src = game.pick.source;
  const title = src === 'portal' ? `${game.floor}층 클리어! 보상 선택` : src === 'statue' ? '축복 석상: 하나를 고르세요' : '수상한 버프 카드';
  const cards = game.pick.choices.map((b, i) => {
    const n = game.taken[b.id] || 0;
    return `<div class="card panel" tabindex="0" data-i="${i}"><div class="ic">${b.icon}</div><div class="nm">${b.name}</div><div class="ds">${b.desc}</div>
      <div class="cnt">${n ? `보유 ${n} → ${n + 1}` : '새 버프'}</div><div class="key">${view.touch ? '' : `[${i + 1}]`}</div></div>`;
  }).join('');
  html(`<div class="screen dim pick"><h3>${title}</h3><div class="cards">${cards}</div></div>`);
  for (const c of ui.querySelectorAll('.card')) click(c, () => choose(+c.dataset.i));
}
function choose(i) {
  if (mode !== 'pick') return;
  audio.play('uiok');
  game.choose(i);
  html(''); mode = 'play';
  handleEvents();
}

function buildList() {
  const ids = Object.keys(game.taken);
  if (!ids.length) return '<span>없음</span>';
  return ids.map(id => { const b = BUFFS.find(x => x.id === id); return `<span>${b.icon} ${b.name}${game.taken[id] > 1 ? ' ×' + game.taken[id] : ''}</span>`; }).join('');
}

function showPause() {
  if (!game || mode !== 'play') return;
  mode = 'pause';
  const w = game.p.weapons.filter(Boolean).map(id => `<span style="color:${RARITY[WEAPONS[id].rarity].color}">${WEAPONS[id].name}</span>`).join(' / ');
  html(`<div class="screen dim"><div class="box panel"><h3>일시정지</h3>
    <div class="kv"><span>층</span><span>${game.floor}층</span><span>처치</span><span>${game.kills}</span><span>코인</span><span>${game.coins}</span><span>이번 판 보석</span><span>◆${game.gemsEarned}</span></div>
    <div style="font-size:13px">무기: ${w}</div>
    <div class="buffs">${buildList()}</div>
    <div class="row">
      <button class="btn" id="resume">계속하기</button>
      <button class="btn alt" id="snd">효과음 ${audio.sound ? 'ON' : 'OFF'}</button>
      <button class="btn alt" id="mus">음악 ${audio.music ? 'ON' : 'OFF'}</button>
      <button class="btn alt" id="help">조작법</button>
      <button class="btn alt" id="quit">포기하기</button>
    </div></div></div>`);
  click('#resume', resume);
  click('#snd', () => { audio.sound = save.sound = !audio.sound; persist(); mode = 'play'; showPause(); });
  click('#mus', () => { audio.music = save.music = !audio.music; persist(); mode = 'play'; showPause(); });
  click('#help', () => showHelp(() => { mode = 'play'; showPause(); }));
  click('#quit', () => { game.p.hp = 0; game.state = 'over'; endRun(); });
}
function resume() { html(''); mode = 'play'; }

function endRun() {
  mode = 'over';
  const g = game;
  const newBest = g.floor > save.best;
  save.best = Math.max(save.best, g.floor);
  save.kills += g.kills;
  persist();
  touchRoot.classList.add('hidden');
  const m = Math.floor(g.time / 60), s = Math.floor(g.time % 60);
  html(`<div class="screen dim"><div class="box panel" style="--hc:${g.hero.color}">
    <h3>${newBest ? '🏆 신기록!' : '쓰러졌다…'}</h3>
    <div class="row" style="align-items:center"><span id="dc"></span><div class="kv" style="flex:1">
      <span>도달 층</span><span>${g.floor}층</span><span>처치</span><span>${g.kills}</span><span>보스 처치</span><span>${g.bossKills}</span>
      <span>플레이 시간</span><span>${m}분 ${s}초</span><span>획득 보석</span><span class="gem">◆${g.gemsEarned}</span></div></div>
    <div class="buffs">${buildList()}</div>
    <div class="row"><button class="btn" id="again">다시 도전</button><button class="btn alt" id="sel">캐릭터 선택</button></div>
  </div></div>`);
  $('#dc').appendChild(heroCanvas(g.heroId, 3, true));
  click('#again', () => startRun(g.heroId));
  click('#sel', showSelect);
}

/* ── 이벤트 처리 ── */
function handleEvents() {
  if (!game) return;
  for (const e of game.ev) {
    switch (e.t) {
      case 'sfx': audio.play(e.id); break;
      case 'floor': {
        const boss = e.floor % 5 === 0;
        toast(`${e.floor}층`, boss ? '⚠ 보스 층' : A.THEMES[game.theme].name, boss ? 'boss' : '');
        audio.setTheme(game.theme);
        break;
      }
      case 'room': view.fade = 0.8; break;
      case 'boss': toast(e.name, '보스 등장!', 'boss'); audio.setTheme(game.theme, true); break;
      case 'bossdown': toast('보스 격파!', '포탈로 다음 층에'); audio.setTheme(game.theme); break;
      case 'clear': if (game.room.type === 'combat') toast('방 클리어!'); break;
      case 'gems': save.gems += e.n; save.best = Math.max(save.best, game.floor); persist(); break;
      case 'pick': showPick(); break;
      case 'over': endRun(); break;
      case 'weapon': updateTouchIcons(); break;
      case 'hurt': if (navigator.vibrate && view.touch) navigator.vibrate(30); break;
    }
  }
  game.ev.length = 0;
}

function updateTouchIcons() {
  if (!game) return;
  const c = $('#b-attack-ic'), g = c.getContext('2d');
  const ws = R.weapons[game.p.weapons[game.p.cur]].c;
  g.clearRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false;
  const s = Math.min(c.width / ws.width, c.height / ws.height);
  g.drawImage(ws, (c.width - ws.width * s) / 2, (c.height - ws.height * s) / 2, ws.width * s, ws.height * s);
  $('#b-swap').classList.toggle('hidden', !game.p.weapons[1]);
}

/* ── 루프 ── */
let last = performance.now(), acc = 0;
const STEP = 1 / 60;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (game) {
    const inp = input.read((sx, sy) => {
      const r = cv.getBoundingClientRect();
      return [(sx - r.left) / r.width * VIEW_W + game.cam.x, (sy - r.top) / r.height * VIEW_H + game.cam.y];
    });
    if (mode === 'play') {
      if (inp.pausePressed || input.pressed.has('t_pause')) { showPause(); }
      else {
        acc += dt;
        let first = true;
        while (acc >= STEP) {
          game.update(STEP, first ? inp : { ...inp, jumpPressed: false, skillPressed: false, swapPressed: false, interactPressed: false });
          first = false; acc -= STEP;
          if (game.ev.length) handleEvents();
          if (mode !== 'play') break;
        }
      }
    } else if (mode === 'pick') {
      for (const k of ['1', '2', '3']) if (input.keys.has(k)) { input.keys.delete(k); choose(+k - 1); }
      acc = 0;
    } else if (mode === 'pause') { if (inp.pausePressed) resume(); acc = 0; }
    else acc = 0;
    view.fade = Math.max(0, view.fade - dt * 3);
    view.touch = input.isTouch;
    R.draw(game, view);
    if (view.touch && mode === 'play') {
      $('#b-use').classList.toggle('hidden', !game.focus);
      if (game.focus) $('#b-use').textContent = { pickup: '줍기', chest: '열기', buy: '구매', statue: '기도', portal: '이동' }[game.focus.act] || '사용';
      const p = game.p, cd = game.hero.skill.cd * game.mods.cdMul;
      const pct = p.skillCd > 0 ? 1 - p.skillCd / (cd + (p.skillT > 0 ? 0 : 0)) : 1;
      $('#b-skill').style.setProperty('--skillbg', p.skillCd > 0 ? `conic-gradient(rgba(63,240,226,.55) ${Math.max(0, pct) * 360}deg, rgba(30,20,50,.8) 0)` : 'rgba(63,240,226,.6)');
      $('#b-skill-t').textContent = p.skillCd > 0 ? Math.ceil(p.skillCd) : '스킬';
    }
  } else {
    input.read(() => [0, 0]);
    // 메뉴 배경: 타이틀/선택에선 캔버스 비움
    const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#05030a'; g.fillRect(0, 0, cv.width, cv.height);
  }
}

/* ── 시작 ── */
async function boot() {
  try { await document.fonts.load('12px Galmuri11'); await document.fonts.load('9px Galmuri9'); } catch (e) { }
  R = new Renderer(cv);
  input = new Input(cv, touchRoot);
  view.touch = input.isTouch;
  addEventListener('resize', () => R.resize());
  $('#b-pause').addEventListener('pointerdown', e => { e.preventDefault(); audio.init(); showPause(); });
  addEventListener('keydown', e => {
    audio.init();
    if (e.key === 'Enter') { if (mode === 'title') showSelect(); else if (mode === 'select' && save.unlocked[selected]) startRun(selected); }
    if (mode === 'select' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const i = HERO_ORDER.indexOf(selected); selected = HERO_ORDER[(i + (e.key === 'ArrowRight' ? 1 : HERO_ORDER.length - 1)) % HERO_ORDER.length]; showSelect();
    }
  });
  addEventListener('pointerdown', () => audio.init(), { once: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') showPause(); });
  window.__neon = { get game() { return game; }, get mode() { return mode; }, startRun, choose, save: () => save };
  showTitle();
  requestAnimationFrame(frame);
}
boot();
