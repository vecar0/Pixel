// 진입점: 화면 흐름(타이틀 → 아레나 → 보스), 고정 스텝 루프, 효과음 연결
import { createWorld, tick } from './core/world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sfx } from './sfx.js';
import { stepLoop } from './loop.js';
import { spawnEnemy } from './core/enemies.js';
import { defaultSave, SAVE_KEY, UNLOCKS, OILS, DARK_RULES, buy, relicPool, oilsOwned, recordRun, dailySeed } from './core/meta.js';
import { ENEMY_DEFS } from './core/enemies.js';
import { icon, RELIC_TONE } from './icons.js';
import { CFG } from './core/config.js';
import { SPELLS, STAT_SPELL, spellFor } from './core/spells.js';
import { STATS, STAT_BY_ID, tierOf, PAIRS, OPP, canTrain } from './core/stats.js';
import { takeTrain, runSpell } from './core/run.js';
import { REGIONS, CHALLENGES, advanceRegion, regionOf, challengeDone, setRegion, RELICS, ROOM_TYPES, newRun, relicOffer, takeRelic, nextStage, stageOf, applyRelics, applyStats, enterRoom, roomCleared, buildRoomWorld, saveFromWorld } from './core/run.js';

const $ = s => document.querySelector(s);
const ui = $('#ui'), touch = $('#touch');
const R = new Renderer($('#game'));
const input = new Input(touch);
const sfx = new Sfx();
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const showTouch = () => touch.classList.toggle('hidden', !TOUCH);
input.onAny = () => sfx.unlock();
// 터치 버튼: 픽셀 아이콘 + 작은 이름. 마법은 비용만큼 빛이 차오르면 켜지고, 기름병은 남은 개수
const TB = { attack: ['sword', 'bone', '공격'], parry: ['parry', 'amber', '패링'], roll: ['roll', 'moon', '회피'], jump: ['jump', 'moon', '점프'], skill: ['ember', 'amber', '마법'], flask: ['flask', 'heal', ''], pause: ['pause', 'bone', ''] };
for (const [k, [ic, t, name]] of Object.entries(TB)) { const b = $('#b-' + k); b.setAttribute('aria-label', b.textContent); b.innerHTML = icon(ic, t) + (name ? `<small>${name}</small>` : '') + (k === 'flask' ? '<b>3</b>' : ''); }
let hudKey = '';
function syncTouch() {
  const p = world.player, key = (p.light | 0) + '/' + p.flasks + '/' + (p.spells || []).join();
  if (key === hudKey) return; hudKey = key;
  ['skill'].forEach((id, i) => {                               // 마법 버튼: 끼운 마법 그림, 비용만큼 차오르면 사용 가능
    const sp = (p.spells || [])[i], b = $('#b-' + id);
    if (b.dataset.spell !== String(sp)) { b.dataset.spell = String(sp); b.innerHTML = sp ? icon(SPELLS[sp].icon, SPELLS[sp].tone) + `<small>${SPELLS[sp].name.replace('등불 ', '')}</small>` : '<small>빈 칸</small>'; }
    if (!sp) { b.style.setProperty('--fill', '0%'); b.classList.remove('ready'); return; }
    const cost = Math.round(CFG.skill[sp].cost * (p.mods.costMul || 1));
    b.style.setProperty('--fill', Math.min(100, p.light / cost * 100) + '%'); b.classList.toggle('ready', p.light >= cost);
  });
  const f = $('#b-flask'); f.querySelector('b').textContent = p.flasks; f.classList.toggle('empty', p.flasks <= 0);
}

// 저장 (등불 조각·해금·기록·설정)
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) return { ...defaultSave(), ...s, records: { ...defaultSave().records, ...s.records }, settings: { ...defaultSave().settings, ...s.settings } }; } catch (e) { } return defaultSave(); }
let save = loadSave();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } }
let bossesKilled = [], practice = false;

let run = null, mode = 'title', world = createWorld({ room: 'arena' }), acc = 0, last = performance.now(), slowT = 0;
// 테스트·디버그용 훅
const lk = window.__lk = { get world() { return world; }, get mode() { return mode; }, get run() { return run; }, setRoom, start, R, step: () => step(), spawn: (k, x, y) => spawnEnemy(world, k, x, y), gotoBoss: reg => { setRegion(run, reg); enterRoom(run, 'boss'); play(); } };

function screen(html) { input.clear(); R.hud = !html; ui.innerHTML = html ? `<div class="screen">${html}</div>` : ''; }
function bind(id, fn) { const b = document.getElementById(id); if (b) b.addEventListener('pointerup', e => { e.preventDefault(); sfx.unlock(); fn(); }); }

function play() {
  world = buildRoomWorld(run); R.runInfo = run; R.region = run.region;
  R.reset(); R.dir.preloadRegion(run.region); R.dir.enterRoom(world, run.region, run.room === 'boss');
  const ST = { combat: '전투', elite: '강적', shop: '떠돌이 상인', rest: '작은 등불', boss: ENEMY_DEFS[regionOf(run).boss].name };
  if (run.room === 'boss') { R.startCine(ST.boss, `${regionOf(run).name}의 대등을 지키는 자`); R.banner = null; }
  else R.banner = { s: ST[run.room] || '', sub: `${regionOf(run).name} · ${run.roomIdx + 1} / ${run.length}`, t: 150, dur: 150 };
  world.player.lagTicks = Math.max(0, Math.min(6, Math.round(save.settings.offsetMs / 16.7)));   // 타이밍 보정
  sfx.musicFor(run.region, run.room === 'boss'); acc = 0; slowT = 0; mode = 'play'; screen(''); showTouch(); }
// 디버그·테스트용: 방 바로 열기
function setRoom(room) { if (!run) { run = newRun(); } enterRoom(run, room === 'arena' ? 'combat' : room); play(); }
// 빠른 시작 (패링의 서약)
function start() { run = newRun(); enterRoom(run, 'combat'); bossesKilled = []; practice = false; play(); R.irisMode = null; R.trans.clear(); }   // 테스트용 빠른 시작: 전환 연출 생략
function newPilgrimage(opts = {}) {
  bossesKilled = []; practice = false;
  run = newRun(opts.seed, { dark: save.dark, pool: relicPool(save), oil: save.oil, shortcut: (save.bossKills.bellBoss || 0) >= 3, daily: !!opts.daily });
}

const relicCard = (id, extra = '') => { const r = RELICS[id], t = RELIC_TONE[r.tag] || 'bone';
  return `<button class="pick t-${t}" data-id="${id}"><div class="niche">${icon(id, t)}</div><b>${r.name}</b><span>${r.desc}</span>${extra}</button>`; };
function bindPicks(fn) { for (const b of ui.querySelectorAll('.pick, [data-id]')) b.addEventListener('pointerup', e => { e.preventDefault(); sfx.unlock(); if (!b.disabled) fn(b.dataset.id); }); }
const cost = (n, tone = 'amber') => `<em>${icon('ember', tone)}${n}</em>`;
// 런 상태 띠: 지역 · 방 진행(마름모) · 불씨 · 각인 아이콘
const runStat = () => {
  const RI = { combat: ['combat', 'bone'], elite: ['elite', 'ember'], shop: ['shop', 'amber'], rest: ['rest', 'heal'], boss: ['boss', 'ember'] };
  const path = run.route.map((t, i) => `<b class="${i < run.roomIdx ? 'done' : i === run.roomIdx ? 'now' : ''}">${icon(...(RI[t] || RI.combat))}</b>`).join('');
  return `<div class="runbar"><span>${regionOf(run).name}</span><span class="path">${path}</span>
    <span class="em">${icon('ember', 'amber')}${run.embers}</span>
    <span class="spells" title="지금 마법">${icon(SPELLS[runSpell(run)].icon, SPELLS[runSpell(run)].tone)}${SPELLS[runSpell(run)].name}</span>
    <span class="relics">${run.relics.map(k => icon(k, RELIC_TONE[RELICS[k].tag])).join('')}</span></div>`;
};
// 스탯 표: 반대 스탯 3쌍을 한 줄씩 (왼쪽 스탯 ▸ 저울 ◂ 오른쪽 스탯), 지금 구간의 능력/약점
const TIER_TXT = { t7: '7', t10: '10', low: '약점' };
const tierLine = s => { const v = run.stats[s.id], T = tierOf(v); return T === 'mid' ? s.per : T === 'low' ? '약점: ' + s.low : `${TIER_TXT[T]}: ${s[T]}`; };
function pairRow(a, b, sel, st = run.stats) {
  const A = STAT_BY_ID[a], B = STAT_BY_ID[b], va = st[a];
  const cells = Array.from({ length: 10 }, (_, i) => `<i class="${i < va ? 'l' : 'r'}${i === 4 ? ' mid' : ''}"></i>`).join('');
  const side = (S, id, dir) => `<button class="sside ${dir} ${sel === id ? 'on' : ''}" data-up="${id}" ${canTrain(run.stats, id) ? '' : 'disabled'}>${icon(S.icon, S.tone)}<b>${S.name}</b><em>${st[id]}</em></button>`;
  return `<div class="spair">${side(A, a, 'L')}<div class="scale t-${A.tone}-${B.tone}">${cells}</div>${side(B, b, 'R')}
    ${sel === undefined ? `<small class="sl">${tierLine(A)}</small><small class="sr">${tierLine(B)}</small>` : ''}</div>`;   // 설명 줄은 일시정지 표에서만 (단련 화면은 아래 미리 보기가 대신)
}
function statBlock() {
  const sp = SPELLS[runSpell(run)];
  return `<div class="stats5">${PAIRS.map(([a, b]) => pairRow(a, b, undefined)).join('')}
    <div class="srow cur">${icon(sp.icon, sp.tone)}<b>마법</b><span>${sp.name} — 가장 높은 스탯(7 이상)이 마법을 정한다</span></div></div>`;
}
// 단련 미리 보기: 무엇이 오르고 내리는지, 구간이 바뀌면 생기고 잃는 능력, 마법 변화
function trainPreview(up) {
  const down = OPP[up], U = STAT_BY_ID[up], D = STAT_BY_ID[down], u0 = run.stats[up], u1 = u0 + 1, d0 = run.stats[down], d1 = d0 - 1;
  const notes = [];
  if (tierOf(u1) !== tierOf(u0)) notes.push(tierOf(u1) === 'mid' ? `${U.name} 약점 해소` : `<b>${U.name} ${TIER_TXT[tierOf(u1)]}</b>: ${U[tierOf(u1)]}`);
  if (tierOf(d1) !== tierOf(d0)) notes.push(tierOf(d1) === 'low' ? `<b class="bad">${D.name} 약점</b>: ${D.low}` : `${D.name} ${TIER_TXT[tierOf(d0)]} 능력 잃음`);
  const s0 = runSpell(run), s1 = spellFor({ ...run.stats, [up]: u1, [down]: d1 }, run.baseSpell, up);
  if (s1 !== s0) notes.push(`${icon(SPELLS[s1].icon, SPELLS[s1].tone)}<b>마법</b>: ${SPELLS[s0].name} → ${SPELLS[s1].name}`);
  return `<div class="tprev"><div>${U.name} ${u0} → <strong>${u1}</strong> · ${D.name} ${d0} → ${d1}</div><small>${U.per}</small>${notes.map(n => `<div class="note">${n}</div>`).join('')}</div>`;
}
// 전투방 보상: 스탯 1점 찍기 (반대 스탯이 1 내려감). 엘리트·보스는 각인 3택1
function rewardScreen(after, sel = null) {
  mode = 'relic'; touch.classList.add('hidden');
  if (!PAIRS.some(([a, b]) => canTrain(run.stats, a) || canTrain(run.stats, b))) return relicScreen(after);
  screen(`<div class="card statup"><h2>단련 1점</h2><div class="line">한쪽을 올리면 반대쪽이 1 내려간다</div>${runStat()}
    <div class="stats5">${PAIRS.map(([a, b]) => pairRow(a, b, sel)).join('')}</div>
    ${sel ? trainPreview(sel) : '<div class="tprev empty">올릴 스탯을 누르세요</div>'}
    <div class="btns"><button class="btn" id="train" ${sel ? '' : 'disabled'}>단련</button></div></div>`);
  for (const b of ui.querySelectorAll('[data-up]')) b.addEventListener('pointerup', e => { e.preventDefault(); sfx.unlock(); if (!b.disabled) rewardScreen(after, b.dataset.up); });
  bind('train', () => { if (sel) { takeTrain(run, sel); after(); } });
}
function takeReward(id, after) { takeRelic(run, id); after(); }

// ‹ 값 › 스테퍼 (셀렉트 박스 대신, 엄지로 누르기 쉽게)
const chip = (id, label, sub, canPrev, canNext) => `<div class="chip"><button id="${id}-p" ${canPrev ? '' : 'disabled'} aria-label="이전">‹</button><div>${label}<small>${sub}</small></div><button id="${id}-n" ${canNext ? '' : 'disabled'} aria-label="다음">›</button></div>`;

function title() {
  mode = 'title'; touch.classList.add('hidden'); sfx.musicFor(0);
  screen(`<div class="title">
    <img class="sigil" alt="" src="${icon('parry', 'amber').match(/src="([^"]+)"/)[1]}">
    <h1>등불지기</h1><div class="sub">꺼져 가는 지하 왕국, 마지막 등불을 든 순례자</div>
    <button class="btn" id="go">등대 마을로</button>
    <div class="help">이동 A·D · 점프 W · 공격 J · 패링 K · 회피 L · 마법 I · 기름병 Q</div></div>`);
  bind('go', town);
}
// 등대 마을: 왼쪽은 리라와 기록, 오른쪽은 출발 · 조정 · 메뉴
function town() {
  mode = 'town'; touch.classList.add('hidden'); sfx.musicFor(0);
  const d = dailySeed(), dailyDone = save.daily[d.key], oils = oilsOwned(save), oi = Math.max(0, oils.indexOf(save.oil)), r = save.records;
  const has = id => save.unlocked.includes(id);
  screen(`<div class="town">
    <div class="hero"><h2>등대 마을</h2><img class="lira" alt="리라" src="assets/lira-idle.png">
      <div class="shards">${icon('ember', 'amber')}등불 조각 ${save.shards}</div>
      <div class="stats">순례 ${r.runs}회 · 귀환 ${r.wins}회<br>완벽 패링 누적 ${r.perfectTotal}</div></div>
    <div class="acts">
      <button class="btn go" data-id="go">${icon('parry', 'bone')}순례를 떠난다</button>
      <div class="tune">
        ${chip('dark', `어둠 ${save.dark}`, save.dark ? DARK_RULES[save.dark] : '기본 난이도', save.dark > 0, save.dark < save.darkUnlocked)}
        ${chip('oil', `랜턴 기름: ${OILS[save.oil].name}`, OILS[save.oil].desc, oi > 0, oi < oils.length - 1)}
      </div>
      <div class="menu">
        <button class="row-btn" data-id="daily">${icon('boss', 'amber')}<span><b>오늘의 시련</b><small>${dailyDone ? '오늘 도전함 · 재도전은 기록만' : '모두 같은 조합 · 하루 한 번'}</small></span></button>
        <button class="row-btn" data-id="shop">${icon('lock', 'amber')}<span><b>등대지기의 창고</b><small>등불 조각으로 해금</small></span></button>
        ${has('practice') ? `<button class="row-btn" data-id="practice">${icon('combat', 'bone')}<span><b>연습장</b><small>쓰러뜨린 보스와 다시</small></span></button>` : ''}
        <button class="row-btn" data-id="records">${icon('afterglow', 'bone')}<span><b>기록</b><small>최고 어둠 · 보스 처치</small></span></button>
        <button class="row-btn" data-id="settings">${icon('wick', 'bone')}<span><b>설정</b><small>타이밍 보정 · 소리</small></span></button>
      </div>
    </div></div>`);
  const step = (id, fn) => { bind(id + '-p', () => { fn(-1); persist(); town(); }); bind(id + '-n', () => { fn(1); persist(); town(); }); };
  step('dark', k => { save.dark = Math.max(0, Math.min(save.darkUnlocked, save.dark + k)); });
  step('oil', k => { save.oil = oils[Math.max(0, Math.min(oils.length - 1, oi + k))]; });
  bindPicks(id => {
    if (id === 'go') { newPilgrimage(); startPilgrimage(); }
    else if (id === 'daily') { newPilgrimage({ seed: d.seed, daily: true }); save.daily[d.key] = true; persist(); startPilgrimage(); }
    else if (id === 'shop') unlockScreen();
    else if (id === 'practice') practiceScreen();
    else if (id === 'records') recordsScreen();
    else if (id === 'settings') settingsScreen();
  });
}
function unlockScreen() {
  mode = 'unlock';
  const look = u => u.relic ? [u.relic, RELIC_TONE[RELICS[u.relic].tag]] : u.oil ? ['oil', u.oil === 'blue' ? 'moon' : 'ember'] : ['combat', 'bone'];
  screen(`<div class="card"><h2>등대지기의 창고</h2><div class="gain">${icon('ember', 'amber')}등불 조각 ${save.shards}</div><div class="picks">
    ${UNLOCKS.map(u => { const [ic, t] = look(u), own = save.unlocked.includes(u.id), poor = !own && save.shards < u.cost;
      return `<button class="pick small t-${t}" data-id="${u.id}" ${own || poor ? 'disabled' : ''}><div class="niche">${icon(own || !poor ? ic : 'lock', t)}</div><b>${u.name.replace(/^.*: /, '')}</b><span>${u.desc || (u.relic ? RELICS[u.relic].desc : '')}</span>${own ? '<em>해금됨</em>' : cost('조각 ' + u.cost)}</button>`; }).join('')}
    </div><div class="btns"><button class="btn alt" data-id="back">돌아가기</button></div></div>`);
  bindPicks(id => { if (id === 'back') return town(); if (buy(save, id)) { persist(); sfx.play('kill'); } unlockScreen(); });
}
function practiceScreen() {
  mode = 'practice';
  const bosses = REGIONS.filter(g => save.bossKills[g.boss]);
  screen(`<div class="card"><h2>연습장</h2><div class="line">기록되지 않는 연습. 패턴을 익히세요</div><div class="picks">
    ${bosses.map(g => `<button class="pick door t-ember" data-id="${g.id}"><div class="niche">${icon('boss', 'ember')}</div><b>${ENEMY_DEFS[g.boss].name}</b><span>${g.name}</span></button>`).join('') || '<div class="line">아직 쓰러뜨린 보스가 없다. 지역 보스를 쓰러뜨리면 여기서 다시 싸울 수 있다</div>'}
    </div><div class="btns"><button class="btn alt" data-id="back">돌아가기</button></div></div>`);
  bindPicks(id => { if (id === 'back') return town(); newPilgrimage(); setRegion(run, +id); enterRoom(run, 'boss'); practice = true; play(); });
}
function recordsScreen() {
  mode = 'records'; const r = save.records;
  screen(`<div class="card"><h2>기록</h2>
    <div class="tally"><span><b>${r.bestDark < 0 ? '-' : r.bestDark}</b>최고 어둠</span><span><b>${r.fastest ? (r.fastest / 60 / 60).toFixed(1) + '분' : '-'}</b>최단 귀환</span><span><b>${r.perfectTotal}</b>완벽 패링</span><span><b>${r.challenges}</b>도전 성공</span></div>
    <div class="picks">${REGIONS.map(g => { const n = save.bossKills[g.boss] || 0, nh = r.noHitBosses.includes(g.boss);
      return `<div class="pick door small ${n ? 't-amber' : ''}" style="cursor:default"><div class="niche">${icon(n ? 'boss' : 'lock', n ? 'amber' : 'bone')}</div><b>${n ? ENEMY_DEFS[g.boss].name : '???'}</b><span>처치 ${n}${nh ? ' · 무피격' : ''}</span></div>`; }).join('')}</div>
    <button class="btn" id="back">돌아가기</button></div>`);
  bind('back', town);
}
// 설정: 타이밍 보정 (박자 탭으로 측정) · 소리
function settingsScreen() {
  mode = 'settings'; const st = save.settings;
  screen(`<div class="card"><h2>설정</h2>
    <div><label>타이밍 보정 <input id="off" type="range" min="-50" max="100" step="10" value="${st.offsetMs}"> <b id="offv">${st.offsetMs}ms</b></label></div>
    <div class="line">폰 터치가 늦게 느껴지면 값을 올리세요. 패링 판정창이 그만큼 늘어납니다.</div>
    <div style="display:flex;gap:18px"><label><input id="snd" type="checkbox" ${st.sound ? 'checked' : ''}> 효과음</label><label><input id="mus" type="checkbox" ${st.music ? 'checked' : ''}> 배경음악</label></div>
    <div class="btns"><button class="btn" id="cal">박자 맞춰 측정</button><button class="btn alt" id="back">돌아가기</button></div>
    <div class="line" id="calmsg"></div></div>`);
  $('#off').addEventListener('input', e => { st.offsetMs = +e.target.value; $('#offv').textContent = st.offsetMs + 'ms'; persist(); });
  $('#snd').addEventListener('change', e => { st.sound = e.target.checked; sfx.on = st.sound; persist(); });
  $('#mus').addEventListener('change', e => { st.music = e.target.checked; sfx.musicOn = st.music; sfx.musicFor(0); persist(); });
  bind('back', town); bind('cal', calibrate);
}
// 측정 도우미: 0.6초 간격 '틱' 8번에 맞춰 화면을 탭 → 평균 지연
function calibrate() {
  mode = 'calibrate'; const beats = [], taps = [], T = 600, t0 = performance.now() + 800;
  screen(`<div class="card"><h2>박자에 맞춰 탭!</h2><div class="line">'틱' 소리가 날 때마다 아무 곳이나 누르세요 (8번)</div><div class="big" id="cnt">준비</div></div>`);
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
// 순례 시작: 서약 없이 바로 첫 지역으로
function startPilgrimage() { if (!run || run.relics.length || run.roomIdx) newPilgrimage(); enterRoom(run, 'combat'); regionIntro(); }
function relicScreen(after) {
  mode = 'relic'; touch.classList.add('hidden');
  const offer = relicOffer(run, 3);
  if (!offer.length) return after();
  screen(`<div class="card"><h2>각인을 하나 고르세요</h2>${runStat()}<div class="picks">${offer.map(id => relicCard(id)).join('')}</div></div>`);
  bindPicks(id => takeReward(id, after));
}
// 다음 스테이지: 정해진 순서대로 바로 들어간다 (들어갈 때 아이리스가 열림)
function goNext() { nextStage(run); play(); }
// 보상을 고른 뒤 방으로 돌아옴: 고른 각인·단련을 바로 적용, 출구가 열렸다고 알림
function backToRoom() {
  const p = world.player, hp = p.hp, fl = p.flasks;
  applyRelics(p, run.relics); applyStats(p, run.stats); p.spells = [runSpell(run)];
  p.hp = Math.min(p.maxHp, hp); p.flasks = Math.min(Math.max(p.maxFlasks, fl), fl);
  resume(); R.say('출구가 열렸다 — 오른쪽 끝으로');
}
// 출구로 나갈 때: 아이리스가 리라 쪽으로 닫힌 뒤 다음 스테이지
function leaveRoom() {
  mode = 'transition'; touch.classList.add('hidden'); R.iris(world, 'close');
  const wait = () => { if (R.irisClock >= 1.02) goNext(); else { R.stepFx(world); requestAnimationFrame(wait); } };   // 완전히 닫히면 다음 방
  requestAnimationFrame(wait);
}
// 휴식(모닥불 앞에서): 한 번만. 고르면 바로 방으로 돌아감
function restScreen() {
  const p = world.player, fire = world.props.find(o => o.kind === 'campfire');
  if (fire.used) { R.say('불씨가 잦아들었다. 오른쪽 길로 나아가자'); return; }
  mode = 'rest'; touch.classList.add('hidden');
  screen(`<div class="card"><h2>작은 등불</h2><div class="quote">모닥불 곁에서 잠시 숨을 고른다</div>${runStat()}<div class="picks">
    <button class="pick door t-red" data-id="heal"><div class="niche">${icon('heart', 'red')}</div><b>몸을 추스른다</b><span>체력 +2 (${p.hp} → ${Math.min(p.maxHp, p.hp + 2)})</span></button>
    <button class="pick door t-heal" data-id="oil"><div class="niche">${icon('flask', 'heal')}</div><b>기름을 채운다</b><span>기름병 가득 (${p.flasks} → ${p.maxFlasks})</span></button></div>
    <div class="btns"><button class="btn alt" data-id="back">그냥 지나간다</button></div></div>`);
  bindPicks(id => {
    if (id === 'heal') p.hp = Math.min(p.maxHp, p.hp + 2); else if (id === 'oil') p.flasks = p.maxFlasks;
    if (id !== 'back') fire.used = true;
    resume();
  });
}
// 상점(상인 앞에서): 여러 번 살 수 있고, 닫으면 방으로 돌아감. 각인은 산 즉시 적용
function shopScreen() {
  mode = 'shop'; touch.classList.add('hidden');
  const st = world.props.find(o => o.kind === 'merchant');
  st.offer = st.offer || relicOffer(run, 2);
  const p = world.player;
  screen(`<div class="card"><h2>떠돌이 상인</h2><div class="quote">"불씨만 있으면 뭐든 내주지."</div>${runStat()}<div class="picks">
    ${st.offer.map(id => relicCard(id, cost(30)).replace('<button', run.embers < 30 ? '<button disabled' : '<button')).join('')}
    <button class="pick t-heal" data-id="flask" ${run.embers < 15 ? 'disabled' : ''}><div class="niche">${icon('flask', 'heal')}</div><b>기름병</b><span>기름병 +1 (지금 ${p.flasks})</span>${cost(15)}</button>
    </div><div class="btns"><button class="btn alt" data-id="leave">닫기</button></div></div>`);
  bindPicks(id => {
    if (id === 'leave') return resume();
    if (id === 'flask' && run.embers >= 15) { run.embers -= 15; p.flasks++; p.maxFlasks = Math.max(p.maxFlasks, p.flasks); }
    else if (RELICS[id] && run.embers >= 30) {
      run.embers -= 30; takeRelic(run, id); st.offer.splice(st.offer.indexOf(id), 1);
      const hp = p.hp, fl = p.flasks; applyRelics(p, run.relics); applyStats(p, run.stats); p.hp = Math.min(p.maxHp, hp + (id === 'vigor' ? 1 : 0)); p.flasks = fl + (id === 'oil' ? 1 : 0);
    }
    shopScreen();
  });
}

function overlay(kind) {
  mode = kind; touch.classList.add('hidden');
  if (kind === 'cleared') {
    world.rewarded = world.counted = true; const wasCombat = run.room === 'combat'; roomCleared(run);
    if (wasCombat) rewardScreen(backToRoom); else relicScreen(backToRoom);
  } else if (kind === 'won') {
    saveFromWorld(run, world);
    const boss = regionOf(run).boss;
    if (practice) { screen(`<div class="card"><h2>연습 완료</h2><button class="btn" id="back">마을로</button></div>`); return bind('back', town); }
    bossesKilled.push(boss);
    if (run.noHitBoss && !save.records.noHitBosses.includes(boss)) save.records.noHitBosses.push(boss);
    run.noHitBoss = run.noHitBoss || false;
    if (advanceRegion(run)) {
      screen(`<div class="card intro"><div class="region">${ENEMY_DEFS[boss].name} 격파</div><h2>대등이 다시 켜졌다</h2><div class="line">체력이 모두 회복되었다. 더 깊은 곳으로.</div>${runStat()}<button class="btn" id="next">계속</button></div>`);
      bind('next', () => relicScreen(regionIntro));
    } else finish(true);
  } else if (kind === 'dead') {
    if (practice) { screen(`<div class="card"><h2>연습 실패</h2><button class="btn" id="again">다시</button><button class="btn alt" id="back">마을로</button></div>`); bind('again', play); return bind('back', town); }
    saveFromWorld(run, world); finish(false);
  } else if (kind === 'pause') {
    screen(`<div class="card"><h2>잠시 멈춤</h2>${runStat()}${statBlock()}<div class="btns"><button class="btn" id="resume">계속</button><button class="btn alt" id="home">순례 포기</button></div></div>`);
    bind('resume', resume); bind('home', () => { saveFromWorld(run, world); finish(false); });
  }
}
// 런 종료: 등불 조각 정산 → 결과 화면
function finish(won) {
  run.challengeDone = challengeDone(run);
  const gain = recordRun(save, run, { won, bossesKilled }); persist();
  const ch = CHALLENGES.find(c => c.id === run.challenge);
  const mins = run.t ? Math.floor(run.t / 3600) + '분 ' + Math.floor(run.t / 60 % 60) + '초' : '-';
  screen(`<div class="card result"><h2 class="${won ? '' : 'lost'}">${won ? '꺼진 태양이 다시 떠올랐다' : '등불이 꺼졌다'}</h2>
    <div class="line">${regionOf(run).name}, ${run.roomIdx + 1}번째 방 · 어둠 ${run.dark}</div>
    <div class="tally"><span><b>${run.perfect}</b>완벽 패링</span><span><b>${run.executes}</b>처형</span><span><b>${run.kills}</b>처치</span><span><b>${mins}</b>시간</span></div>
    ${runStat()}
    <div class="line">이번 판 도전 '${ch.name}': ${run.challengeDone ? '성공' : '실패'}</div>
    <div class="gain">${icon('ember', 'amber')}등불 조각 +${gain} (보유 ${save.shards})${won && save.darkUnlocked > run.dark ? ' · 어둠 ' + save.darkUnlocked + ' 해금' : ''}</div>
    <div class="btns"><button class="btn" id="again">다시 순례</button><button class="btn alt" id="home">마을로</button></div></div>`);
  bind('again', () => { newPilgrimage(); startPilgrimage(); }); bind('home', town);
}
// 지역 입장 연출
function regionIntro() {
  mode = 'intro'; const g = regionOf(run);
  const ch = CHALLENGES.find(c => c.id === run.challenge), first = g.id === 1;
  screen(`<div class="card intro"><div class="region">${g.id}번째 지역</div><h2>${g.name}</h2><div class="line">이곳의 대등을 지키는 것: ${ENEMY_DEFS[g.boss].name}</div>
    ${first ? `<div class="line">${run.daily ? '오늘의 시련 · ' : ''}어둠 ${run.dark} · 이번 판 도전: ${ch.name} (성공하면 등불 조각 +2)</div>` : ''}<button class="btn" id="go">들어간다</button></div>`);
  bind('go', play);
}
function resume() { mode = 'play'; screen(''); showTouch(); last = performance.now(); acc = 0; }

const SOUND = { hurt: 'hurt', kill: 'kill', execute: 'execute', slam: 'slam', telegraph: 'telegraph' };
function onEvents(w) {
  for (const ev of w.events) {
    if (ev.type === 'parry') {
      sfx.play(ev.perfect ? 'parryPerfect' : 'parryNormal');
      if (ev.perfect) { slowT = 18; if (navigator.vibrate) navigator.vibrate(35); }
    }
    else if (ev.type === 'attackHit') { sfx.play(ev.combo === 2 ? 'hit3' : 'hit'); if (navigator.vibrate) navigator.vibrate(ev.combo === 2 ? 18 : 8); }
    else if (ev.type === 'land' && ev.v > 3) sfx.play('land');
    else if (ev.type === 'castStart') sfx.play(ev.spell === 'bolt' ? 'swing' : 'ult');
    else if (SOUND[ev.type]) sfx.play(SOUND[ev.type]);
    if (ev.type === 'kill' && run) run.kills++;
    if (ev.type === 'interact') { if (ev.kind === 'merchant') shopScreen(); else if (ev.kind === 'campfire') restScreen(); }
    if (ev.type === 'exit') { saveFromWorld(run, w); if (!w.counted) roomCleared(run); leaveRoom(); return; }
    if (ev.type === 'brazier') sfx.play('execute');
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
  if (TOUCH) syncTouch();
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
      if (R.irisBusy() || R.stepCine()) { R.stepFx(world); acc = 0; touch.classList.add('hidden'); world.wasCine = true; }   // 아이리스·보스 등장 연출 동안은 세계 정지, 버튼 숨김
      else {
        if (world.wasCine) { world.wasCine = false; showTouch(); }
        acc = stepLoop(acc, slowT > 0 && !world.hitstop ? dt * 0.45 : dt, step);   // 완벽 패링 직후 잠깐 슬로모션
      }
      if (world.over) overlay('dead');
      else if (world.won) overlay('won');
      else if (world.cleared && !world.rewarded) overlay('cleared');
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
