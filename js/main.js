// 진입점: 화면 흐름(타이틀 → 아레나 → 보스), 고정 스텝 루프, 효과음 연결
import { createWorld, tick } from './core/world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sfx } from './sfx.js';
import { stepLoop } from './loop.js';
import { spawnEnemy } from './core/enemies.js';
import { defaultSave, SAVE_KEY, UNLOCKS, OILS, DARK_RULES, DARK_MAX, buy, relicPool, oilsOwned, recordRun, dailySeed } from './core/meta.js';
import { ENEMY_DEFS } from './core/enemies.js';
import { icon, RELIC_TONE } from './icons.js';
import { installPixelUI, roundBtn } from './pixelui.js';
import { startTitleScene } from './titlescene.js';
installPixelUI();
import { CFG } from './core/config.js';
import { SPELLS, STAT_SPELL, SPELL_TAGS, spellFor } from './core/spells.js';
import { STATS, STAT_BY_ID, tiersOn, weakOn, nextTier, PAIRS, OPP, canTrain, RESONANCES, resonancesOf, MASTERY, statNumbers, STAT_MAX, STAT_START, T_ABILITY, T_MASTER } from './core/stats.js';
import { takeTrain, runSpell } from './core/run.js';
import { GIMMICK_HINT } from './core/gimmick.js';
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
    const f = Math.round(Math.min(1, p.light / cost) * 12) / 12;            // 빛이 비용만큼 차오르는 픽셀 원 (12단계)
    b.style.setProperty('--img', `url(${roundBtn('#ffb347', { fill: f })})`); b.classList.toggle('ready', p.light >= cost);
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
const lk = window.__lk = { get tut() { return tut; }, get world() { return world; }, get mode() { return mode; }, get run() { return run; }, setRoom, start, R, step: () => step(), spawn: (k, x, y) => spawnEnemy(world, k, x, y), gotoBoss: reg => { setRegion(run, reg); enterRoom(run, 'boss'); play(); } };

function screen(html) { input.clear(); R.hud = !html; ui.innerHTML = html ? `<div class="screen">${html}</div>` : ''; }
function bind(id, fn) { const b = document.getElementById(id); if (b) b.addEventListener('pointerup', e => { e.preventDefault(); sfx.unlock(); sfx.play('click'); fn(); }); }

function play() {
  world = buildRoomWorld(run); R.runInfo = run; R.region = run.region;
  R.reset(); R.dir.preloadRegion(run.region); R.dir.enterRoom(world, run.region, run.room === 'boss');
  const ST = { combat: '전투', elite: '강적', shop: '떠돌이 상인', rest: '작은 등불', boss: ENEMY_DEFS[regionOf(run).boss].name };
  if (run.room === 'boss') { R.startCine(ST.boss, `${regionOf(run).name}의 대등을 지키는 자`); R.banner = null; }
  else R.banner = { s: ST[run.room] || '', sub: `${regionOf(run).name} · ${run.roomIdx + 1} / ${run.length}`, t: 150, dur: 150 };
  world.player.lagTicks = Math.max(0, Math.min(6, Math.round(save.settings.offsetMs / 16.7)));   // 타이밍 보정
  if (world.player.roomHealed) R.healFx(world.player, 1, world.player.hp - 1);                 // 생명 16
  sfx.musicFor(run.region, run.room === 'boss'); acc = 0; slowT = 0; mode = 'play'; screen(''); showTouch();
  tut = world.tutorial ? { step: 0, x0: world.player.x, t: 0, hurt: 0 } : null; if (tut) { R.banner = { s: '첫 순례', sub: '하나씩 해 보세요', t: 150, dur: 150 }; tutStep(0); } }
// 대화창: 초상·이름·한 글자씩 나오는 대사. 누르면(또는 Enter) 다 보이고, 다시 누르면 다음 줄 → 끝나면 then()
const TALK = {
  keeper: { name: '등대지기 노라', img: 'assets/keeper.png', lines: [
    ['등대의 불이 꺼진 지 오래야.', '네 등불로 네 개의 대등을 다시 켜 주렴.'],
    ['기름은 제단에서 골라 가렴.', '청유는 결계, 흑유는 검은 광선으로 시작하지.'],
    ['허수아비로 손을 풀고 가렴.', '패링은 적이 번쩍이는 그 순간이 전부야.'],
    ['어둠이 깊을수록 보상도 크다네.', '자신이 생기면 제단에서 어둠을 올려 봐.'],
    ['방마다 목표 시간이 있어.', '빨리 정리하면 불씨를 더 얹어 주지.'],
    ['완벽하게 막아 낸 직후 바로 베어 봐.', '몸을 돌리며 양쪽을 한꺼번에 베는 반격이 나간단다.'],
    ['쓰러진 적을 연달아 처형하면', '등불이 그만큼 더 밝아지지.'],
  ] },
  merchant: { name: '떠돌이 상인', img: 'assets/merchant.png', lines: [
    ['오, 손님이군. 불씨만 있으면 뭐든 내주지.'],
    ['이 근처엔 레버로 여는 작은 방이 있다더군.', '보물 상자가 잠들어 있대.'],
    ['항아리는 깨 봐. 가끔 빛 구슬이 나오거든.'],
  ] },
};
function talk(who, then, pick) {
  const T = TALK[who], lines = T.lines[pick ?? ((Math.random() * T.lines.length) | 0)];
  mode = 'talk'; touch.classList.add('hidden');
  let i = 0, shown = 0, timer = 0;
  const draw = () => {
    screen(`<div class="talkbox"><img class="portrait" src="${T.img}" alt=""><div class="talk-body"><b>${T.name}</b><p id="tline"></p></div><button class="btn next" id="tnext">${i < lines.length - 1 ? '▶' : '확인'}</button></div>`);
    const el = $('#tline'), full = lines[i]; shown = 0; clearInterval(timer);
    timer = setInterval(() => { shown++; el.textContent = full.slice(0, shown); if (shown >= full.length) clearInterval(timer); }, 28);
    const next = () => { if (shown < full.length) { shown = full.length; el.textContent = full; clearInterval(timer); return; } clearInterval(timer); if (++i < lines.length) draw(); else then(); };
    bind('tnext', next); $('.talkbox').addEventListener('pointerup', e => { if (e.target.id !== 'tnext') next(); });
  };
  draw();
}
// 튜토리얼 (첫 순례 첫 방): 한 단계씩 해 보면 다음 안내. 적은 '패링' 단계에서야 나온다
let tut = null;
const K = (key, btn) => TOUCH ? `(${btn} 버튼)` : `(${key})`;
const TUT = [
  () => `이동해 보세요 ${TOUCH ? '(왼쪽 스틱)' : '(← → 또는 A D)'}`,
  () => `점프 ${K('스페이스 · W', '점프')} — 발판에 올라갈 수 있어요`,
  () => `공격 ${K('J', '공격')} — 항아리를 깨 보세요`,
  () => '불씨를 주우면 점수와 상점 화폐가 돼요',
  () => `적의 공격이 번쩍이는 순간 패링 ${K('K', '패링')} — 완벽 패링은 빛을 크게 모아요`,
  () => `구르기 ${K('L · Shift', '회피')} — 무적으로 피하고 적을 지나갈 수 있어요`,
  () => `빛 게이지가 차면 마법 ${K('U', '마법')} — 적을 모두 쓰러뜨리면 출구가 열려요`,
];
function tutStep(n) { tut.step = n; if (n >= TUT.length) { R.say('튜토리얼 끝! 이제 순례를 이어 가세요', 200); save.tutorialDone = true; persist(); tut = null; return; } R.say(TUT[n](), 1e9); if (n === 4) world.holdWaves = false; }
function tutTick() {
  if (!tut || !world.tutorial) return;
  const p = world.player;
  if (tut.step === 0 && Math.abs(p.x - tut.x0) > 110) tutStep(1);
  else if (tut.step === 1 && !p.onGround) tutStep(2);
  else if (tut.step === 3 && ++tut.t > 150) tutStep(4);
  else if (tut.step === 6 && world.cleared) tutStep(7);
}
function tutEvent(ev) {
  if (tut.step === 2 && ev.type === 'urnBreak') { tut.t = 0; tutStep(3); }
  else if (tut.step === 4 && ev.type === 'parry') tutStep(5);
  else if (tut.step === 4 && ev.type === 'hurt' && ++tut.hurt % 2 === 0) R.say('공격 직전 몸이 번쩍이는 순간을 노려요 — ' + TUT[4](), 1e9);
  else if (tut.step === 5 && ev.type === 'rollStart') tutStep(6);
  else if (tut.step === 6 && ev.type === 'castStart') tutStep(7);
}
// 디버그·테스트용: 방 바로 열기
function setRoom(room) { if (!run) { run = newRun(); } enterRoom(run, room === 'arena' ? 'combat' : room); play(); }
// 빠른 시작 (패링의 서약)
function start() { run = newRun(); enterRoom(run, 'combat'); bossesKilled = []; practice = false; play(); R.irisMode = null; R.trans.clear(); }   // 테스트용 빠른 시작: 전환 연출 생략
function newPilgrimage(opts = {}) {
  bossesKilled = []; practice = false;
  run = newRun(opts.seed, { dark: save.dark, pool: relicPool(save), oil: save.oil, shortcut: false, daily: !!opts.daily, tutorial: !save.records.runs && !save.tutorialDone });   // 첫 순례 = 튜토리얼 방
}

const relicCard = (id, extra = '') => { const r = RELICS[id], t = RELIC_TONE[r.tag] || 'bone';
  return `<button class="pick t-${t}" data-id="${id}"><div class="niche">${icon(id, t)}</div><b>${r.name}</b><span>${r.desc}</span>${extra}</button>`; };
function bindPicks(fn) { for (const b of ui.querySelectorAll('.pick, [data-id]')) b.addEventListener('pointerup', e => { e.preventDefault(); sfx.unlock(); sfx.play('click'); if (!b.disabled) fn(b.dataset.id); }); }
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
// 스탯 판: 반대 스탯 쌍마다 한 칸(위 스탯 카드 · 20칸 저울 · 아래 스탯 카드). 글은 줄바꿈되어 잘리지 않는다
// 카드 한 장 = 이름·값·능력 사다리(12~20) / 지금 수치 / 다음 능력 / 약점
// 스탯 칸: 모두 같은 크기. 이름·값·능력 사다리·핵심 수치 한 줄만. 누르면 팝업으로 자세히
function statCard(S, side, st = run.stats, base = st) {
  const v = st[S.id], d = v - base[S.id], weak = weakOn(S, v).length;
  const ladder = S.tiers.map(([n]) => `<i class="tk ${v >= n ? 'on' : ''}${v >= n && base[S.id] < n ? ' new' : ''}">${n}</i>`).join('');
  return `<button class="scard ${side} ${d > 0 ? 'up' : d < 0 ? 'down' : ''}" data-info="${S.id}"><div class="sh">${icon(S.icon, S.tone)}<b>${S.name}</b><em>${v}</em>${d ? `<span class="dv">${d > 0 ? '+' : ''}${d}</span>` : ''}${weak ? '<span class="wk">약점</span>' : ''}<span class="more">ⓘ</span></div>
    <div class="ladder">${ladder}</div><div class="sn">${statNumbers(S.id, v).split(', ')[0]}</div></button>`;
}
// 스탯 팝업: 지금 수치 전부 · 점당 효과 · 능력 5단계(열림/다음) · 약점
function statPopup(id, st, base) {
  const S = STAT_BY_ID[id], v = st[id], v0 = base[id], nx = nextTier(S, v);
  const tiers = S.tiers.map(([n, d]) => `<li class="${v >= n ? 'on' : nx && nx[0] === n ? 'next' : ''}"><b>${n}</b><span>${d}</span>${v >= n ? '<i>열림</i>' : nx && nx[0] === n ? `<i>${n - v}점 더</i>` : ''}</li>`).join('');
  const weak = S.weak.map(([n, d]) => `<li class="${v <= n ? 'bad' : ''}"><b>${n}↓</b><span>${d}</span>${v <= n ? '<i>적용 중</i>' : ''}</li>`).join('');
  return `<div class="spop-bg"><div class="spop"><div class="sh">${icon(S.icon, S.tone)}<b>${S.name}</b><em>${v}</em>${v !== v0 ? `<small>(지금 ${v0} → 단련 후 ${v})</small>` : ''}${v === T_MASTER ? `<span class="ms">극의 「${MASTERY[id]}」</span>` : ''}</div>
    <div class="sn">${statNumbers(id, v)}</div><div class="per">${S.per} · 반대 스탯: ${STAT_BY_ID[OPP[id]].name}</div>
    <div class="pl">능력</div><ul class="tl5">${tiers}</ul><div class="pl">약점</div><ul class="tl5 wk">${weak}</ul>
    <button class="btn" id="popclose">닫기</button></div></div>`;
}
function bindInfo(st, base) {
  for (const b of ui.querySelectorAll('[data-info]')) b.addEventListener('pointerup', e => {
    e.preventDefault(); sfx.play('click');
    const host = ui.querySelector('.screen'); host.insertAdjacentHTML('beforeend', statPopup(b.dataset.info, st, base));
    const bg = host.querySelector('.spop-bg'), close = ev => { ev.preventDefault(); ev.stopPropagation(); bg.remove(); };
    bg.addEventListener('pointerup', ev => { if (ev.target === bg || ev.target.id === 'popclose') close(ev); });
  });
}
// 스탯 판. draft가 있으면 단련 중: 쌍 사이에 ▲(위 스탯 +1)·▼(아래 스탯 +1) 화살표, 저울에 바뀐 칸 표시
function statGrid(draft = null, left = 0) {
  const st = draft || run.stats, base = run.stats;
  return `<div class="sgrid">${PAIRS.map(([a, b]) => {
    const va = st[a], v0 = base[a];
    const cells = Array.from({ length: STAT_MAX }, (_, i) => `<i class="${i < va ? 'l' : 'r'}${i === STAT_START - 1 ? ' mid' : ''}${(i < va) !== (i < v0) ? ' ch' : ''}"></i>`).join('');
    const arrow = (id, dir) => { const refund = st[id] < base[id], can = refund || (left > 0 && canTrain(st, id));
      return `<button class="arw ${dir}${refund ? ' back' : ''}" data-up="${id}" ${can ? '' : 'disabled'} aria-label="${STAT_BY_ID[id].name} 올리기">${dir === 'u' ? '▲' : '▼'}<small>${STAT_BY_ID[id].name}</small></button>`; };
    const mid = draft ? `<div class="srow">${arrow(a, 'u')}<div class="scale2">${cells}</div>${arrow(b, 'd')}</div>` : `<div class="scale2">${cells}</div>`;
    return `<div class="scol">${statCard(STAT_BY_ID[a], 'A', st, base)}${mid}${statCard(STAT_BY_ID[b], 'B', st, base)}</div>`; }).join('')}</div>`;
}
// 공명 칩: 열린 것은 밝게(효과 포함), 하나만 더 올리면 열리는 것은 흐리게
function resonanceBlock(st = run.stats) {
  const on = resonancesOf(st).map(r => r.id), near = RESONANCES.filter(r => !on.includes(r.id) && Math.min(st[r.a], st[r.b]) >= T_ABILITY - 2 && Math.max(st[r.a], st[r.b]) >= T_ABILITY);
  if (!on.length && !near.length) return `<div class="resrow"><span class="rlabel">공명</span><small>다른 쌍의 두 스탯을 모두 14 이상으로 만들면 조합 특성이 열린다</small></div>`;
  const chip = (r, act) => `<div class="rchip ${act ? 'on' : ''}"><b>${r.name}</b> <small>${STAT_BY_ID[r.a].name}+${STAT_BY_ID[r.b].name}${act ? '' : ' 14'}</small>${act ? `<div>${r.desc}</div>` : ''}</div>`;
  return `<div class="resrow"><span class="rlabel">공명</span>${RESONANCES.filter(r => on.includes(r.id)).map(r => chip(r, true)).join('')}${near.map(r => chip(r, false)).join('')}</div>`;
}
// 마법 카드: 이름 · 빛 소모 · 실제 피해(지금 스탯 반영) · 특성 · 설명 · 착탄까지 걸리는 시간
function spellCard(id, label = '지금 마법') {
  const S = SPELLS[id], C = CFG.skill[id], p = world && world.player, mul = p ? (p.mods.spellMul || 1) : 1, cm = p ? (p.mods.costMul || 1) : 1;
  const dmg = C.dmg ? Math.round(C.dmg * mul) : 0, n = id === 'bolt' && p && p.mods.lmp7 ? ' ×2발' : id === 'chain' ? ' ×3명' : '';
  const delay = C.delay ? ` · ${(C.delay / 60).toFixed(1)}초 뒤 착탄` : '';
  return `<div class="spellcard t-${S.tone}"><div class="niche">${icon(S.icon, S.tone)}</div><div class="sc-body">
    <div class="sc-top"><small>${label}</small><b>${S.name}</b><span class="sc-cost">빛 ${Math.round(C.cost * cm)}</span>${dmg ? `<span class="sc-dmg">피해 ${dmg}${n}</span>` : ''}</div>
    <div class="sc-tags">${(SPELL_TAGS[id] || []).map(t => `<i>${t}</i>`).join('')}</div>
    <div class="sc-desc">${S.desc}${delay}</div></div></div>`;
}
const spellMap = () => `<div class="sc-map"><b>마법</b> 가장 높은 스탯이 14·17·20이면 그 스탯의 마법이 차례로 바뀐다 — ${PAIRS.flat().map(k => `${STAT_BY_ID[k].name} ${STAT_SPELL[k].map(id => SPELLS[id].name).join('/')}`).join(' · ')}</div>`;
// 단련 미리 보기: 지금(run.stats) → 찍은 뒤(draft). 바뀌는 수치, 열리고 잃는 능력·약점·공명, 마법 변화
function trainPreview(draft, lastUp) {
  const st0 = run.stats, ch = STATS.filter(S => draft[S.id] !== st0[S.id]);
  if (!ch.length) return '<div class="tprev empty">▲▼ 화살표로 점수를 찍으세요</div>';
  const lines = [], notes = [];
  for (const S of ch) {
    const v0 = st0[S.id], v1 = draft[S.id], up = v1 > v0;
    lines.push(`<span class="tl ${up ? 'up' : 'down'}">${S.name} ${v0}→<b>${v1}</b></span>`);
    for (const [n, d] of S.tiers) if (v0 < n && v1 >= n) notes.push(`<b>${S.name} ${n} 열림</b> ${d}`); else if (v0 >= n && v1 < n) notes.push(`<b class="bad">${S.name} ${n} 잃음</b> ${d}`);
    for (const [n, d] of S.weak) if (v0 <= n && v1 > n) notes.push(`<b>${S.name} 약점 해소</b> ${d}`); else if (v0 > n && v1 <= n) notes.push(`<b class="bad">${S.name} 약점</b> ${d}`);
    if (v1 === T_MASTER && v0 < T_MASTER) notes.push(`<b>극의 「${MASTERY[S.id]}」</b>`);
  }
  const r0 = resonancesOf(st0).map(r => r.id), r1 = resonancesOf(draft);
  for (const r of r1) if (!r0.includes(r.id)) notes.push(`<b class="res">공명 「${r.name}」</b> ${r.desc}`);
  for (const id of r0) if (!r1.some(r => r.id === id)) notes.push(`<b class="bad">공명 「${RESONANCES.find(r => r.id === id).name}」 잃음</b>`);
  const s0 = runSpell(run), s1 = spellFor(draft, run.baseSpell, lastUp);
  return `<div class="tprev"><div class="tls">${lines.join('')}</div>${notes.map(n => `<div class="note">${n}</div>`).join('')}
    ${s1 !== s0 ? spellCard(s1, `마법이 바뀐다 (${SPELLS[s0].name} →)`) : ''}</div>`;
}
// 전투방 보상: 단련 점수 2점을 ▲▼ 화살표로 자유롭게 찍고(반대 화살표로 되돌림) '단련 완료'로 확정. 엘리트·보스는 각인 3택1
function rewardScreen(after, draft = null, lastUp = null, total = 2) {
  mode = 'relic'; touch.classList.add('hidden');
  if (!draft && !PAIRS.some(([a, b]) => canTrain(run.stats, a) || canTrain(run.stats, b))) return relicScreen(after);
  draft = draft || { ...run.stats };
  const used = PAIRS.reduce((n, [a]) => n + Math.abs(draft[a] - run.stats[a]), 0), left = total - used;
  const stuck = left > 0 && !PAIRS.some(([a, b]) => canTrain(draft, a) || canTrain(draft, b));   // 더 찍을 곳이 없으면 남아도 완료 가능
  const pips = Array.from({ length: total }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('');
  screen(`<div class="card board train">${runStat()}<div class="sboard">${statGrid(draft, left)}
    <div class="spanel"><div class="pts ${left ? '' : 'zero'}"><span>단련 점수</span><span class="pips">${pips}</span><b>${left}</b><small>/ ${total} 남음</small></div>
    <div class="btns"><button class="btn alt" id="undo" ${used ? '' : 'disabled'}>초기화</button><button class="btn" id="train" ${left === 0 || stuck ? '' : 'disabled'}>${left === 0 || stuck ? '단련 완료' : `${left}점 더 찍기`}</button></div>
    <div class="hint">▲▼로 찍기 · <span class="back">파란색</span> = 되돌리기<br>스탯 칸을 누르면 자세히</div>
    ${trainPreview(draft, lastUp)}</div></div></div>`);
  for (const b of ui.querySelectorAll('[data-up]')) b.addEventListener('pointerup', e => {
    e.preventDefault(); sfx.unlock(); if (b.disabled) return; sfx.play('click');
    const id = b.dataset.up, o = OPP[id], next = { ...draft, [id]: draft[id] + 1, [o]: draft[o] - 1 };
    rewardScreen(after, next, next[id] > run.stats[id] ? id : lastUp, total);
  });
  bindInfo(draft, run.stats);
  bind('undo', () => rewardScreen(after, null, null, total));
  bind('train', () => {
    if (!(left === 0 || stuck)) return;
    const raised = lastUp && draft[lastUp] > run.stats[lastUp];             // 마법 동률 판정용: 마지막으로 올린 스탯
    for (const S of STATS) for (let k = draft[S.id] - run.stats[S.id]; k > 0; k--) takeTrain(run, S.id);
    if (raised) run.lastUp = lastUp;
    after();
  });
}
function takeReward(id, after) { takeRelic(run, id); after(); }

// ‹ 값 › 스테퍼 (셀렉트 박스 대신, 엄지로 누르기 쉽게)
const chip = (id, label, sub, canPrev, canNext) => `<div class="chip"><button id="${id}-p" ${canPrev ? '' : 'disabled'} aria-label="이전">‹</button><div>${label}<small>${sub}</small></div><button id="${id}-n" ${canNext ? '' : 'disabled'} aria-label="다음">›</button></div>`;

// 타이틀: 왼쪽은 등불을 든 리라 장면(캔버스), 오른쪽은 제목. 화면 어디를 눌러도 시작
let stopTitle = null;
function title() {
  mode = 'title'; touch.classList.add('hidden'); sfx.musicFor(0);
  screen(`<div class="titlescene" id="go"><canvas id="tcv" width="240" height="135"></canvas>
    <div class="tlogo"><div class="tl-pre">꺼져 가는 지하 왕국에서</div><h1>등불지기</h1><div class="tl-rule"></div>
      <div class="tl-sub">마지막 등불을 든 순례자, 리라</div><div class="tl-start">화면을 눌러 시작</div>
      <div class="help">이동 A·D · 점프 W · 공격 J · 패링 K · 회피 L · 마법 I · 기름병 Q · Enter 시작</div></div></div>`);
  stopTitle && stopTitle(); stopTitle = startTitleScene($('#tcv'));
  bind('go', town);
}
// 등대 마을: 왼쪽은 리라와 기록, 오른쪽은 출발 · 조정 · 메뉴
// 마을: 걸어 다니는 방. 왼쪽부터 등대지기의 창고(해금) · 허수아비(연습 상대) · 순례 제단(출발 준비) · 모닥불(기록·연습장·설정), 오른쪽 끝 길 = 순례 준비
const TOWN_W = 1500;
function buildTown() {
  const W = TOWN_W, w = createWorld({ room: 'haven', width: W, solids: [{ x: -40, y: 0, w: 40, h: 360 }, { x: W, y: 0, w: 40, h: 360 }, { x: -40, y: 300, w: W + 80, h: 60 }], spawn: { x: 140, y: 240 } });
  w.haven = 'town'; w.town = true;
  w.props = [
    { kind: 'keeper', x: 300, label: '등대지기 (이야기)' },
    { kind: 'altar', x: 860, label: '순례 제단 (어둠·기름·출발)' },
    { kind: 'board', x: 1070, label: '게시판 (기록)' },
    { kind: 'campfire', x: 1270, label: '모닥불 (연습장·설정)' },
    { kind: 'exit', x: W - 70, label: '순례 길 →' },
  ];
  townDummy(w);
  return w;
}
function townDummy(w) {   // 허수아비: 공격하지 않는 연습 상대 (쓰러지면 다시 선다)
  const e = spawnEnemy(w, 'ghoul', 560, 300 - ENEMY_DEFS.ghoul.h - 2, { hpMul: 30 });
  e.cd = 1e9; e.speed = 0; e.dummy = true; e.spawnT = 0;
}
function town() {
  if (stopTitle) { stopTitle(); stopTitle = null; }
  mode = 'town'; sfx.musicFor(0); practice = false;
  if (!world || !world.town) {
    world = buildTown(); run = null; R.runInfo = null; R.region = 0;
    R.reset(); R.dir.preloadRegion(1); R.dir.enterRoom(world, 1, false);
    R.banner = { s: '등대 마을', sub: '오른쪽 끝이 순례 길', t: 170, dur: 170 };
    R.say('창고 · 허수아비 · 제단 · 모닥불 앞에서 공격 버튼', 240);
  }
  world.exited = false;
  if (world.player.x > TOWN_W - 140) world.player.x = TOWN_W - 160;
  screen(''); showTouch(); last = performance.now(); acc = 0;
}
// 모닥불: 기록·연습장·설정
function campMenu() {
  mode = 'camp'; touch.classList.add('hidden');
  screen(`<div class="card"><h2>모닥불</h2><div class="quote">불가에 앉아 지난 순례를 떠올린다</div><div class="menu">
    <button class="row-btn" data-id="records">${icon('afterglow', 'bone')}<span><b>기록</b><small>최고 어둠 · 보스 처치</small></span></button>
    <button class="row-btn" data-id="practice">${icon('combat', 'bone')}<span><b>연습장</b><small>보스와 연습 (기록 안 됨)</small></span></button>
    <button class="row-btn" data-id="settings">${icon('wick', 'bone')}<span><b>설정</b><small>타이밍 보정 · 소리</small></span></button>
    <button class="row-btn" data-id="title">${icon('pause', 'bone')}<span><b>타이틀로</b><small>처음 화면</small></span></button>
    </div><div class="btns"><button class="btn alt" data-id="back">닫기</button></div></div>`);
  bindPicks(id => { if (id === 'back') town(); else if (id === 'records') recordsScreen(); else if (id === 'practice') practiceScreen(); else if (id === 'settings') settingsScreen(); else if (id === 'title') { world = null; title(); } });
}
function prepScreen() {   // 순례 준비: 어둠·기름 고르고 출발 (마을의 등불 제단·오른쪽 길)
  mode = 'prep'; touch.classList.add('hidden');
  const d = dailySeed(), dailyDone = save.daily[d.key], oils = oilsOwned(save), oi = Math.max(0, oils.indexOf(save.oil)), r = save.records;
  screen(`<div class="town">
    <div class="hero"><h2>순례 준비</h2><img class="lira" alt="리라" src="assets/lira-idle.png">
      <div class="shards">${icon('afterglow', 'amber')}최고 점수 ${save.records.bestScore || 0}</div>
      <div class="stats">순례 ${r.runs}회 · 귀환 ${r.wins}회<br>완벽 패링 누적 ${r.perfectTotal}</div></div>
    <div class="acts">
      <button class="btn go" data-id="go">${icon('parry', 'bone')}순례를 떠난다</button>
      <div class="tune">
        ${chip('dark', `어둠 ${save.dark}`, save.dark ? DARK_RULES[save.dark] : '기본 난이도', save.dark > 0, save.dark < DARK_MAX)}
        ${chip('oil', `랜턴 기름: ${OILS[save.oil].name}`, OILS[save.oil].desc, oi > 0, oi < oils.length - 1)}
      </div>
      <div class="menu">
        <button class="row-btn" data-id="daily">${icon('boss', 'amber')}<span><b>오늘의 시련</b><small>${dailyDone ? '오늘 도전함 · 재도전은 기록만' : '모두 같은 조합 · 하루 한 번'}</small></span></button>
        <button class="row-btn" data-id="back">${icon('wick', 'bone')}<span><b>마을로 돌아가기</b><small>창고·허수아비·모닥불</small></span></button>
      </div>
    </div></div>`);
  const step = (id, fn) => { bind(id + '-p', () => { fn(-1); persist(); prepScreen(); }); bind(id + '-n', () => { fn(1); persist(); prepScreen(); }); };
  step('dark', k => { save.dark = Math.max(0, Math.min(DARK_MAX, save.dark + k)); });   // 어둠 단계는 처음부터 모두
  step('oil', k => { save.oil = oils[Math.max(0, Math.min(oils.length - 1, oi + k))]; });
  bindPicks(id => {
    if (id === 'go') { newPilgrimage(); startPilgrimage(); }
    else if (id === 'daily') { newPilgrimage({ seed: d.seed, daily: true }); save.daily[d.key] = true; persist(); startPilgrimage(); }
    else if (id === 'back') town();
  });
}
function practiceScreen() {
  mode = 'practice';
  const bosses = REGIONS;   // 처음부터 모든 보스 연습 가능
  screen(`<div class="card"><h2>연습장</h2><div class="line">기록되지 않는 연습. 패턴과 기믹을 익히세요</div><div class="picks">
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
  for (let i = 0; i < 8; i++) { beats.push(t0 + i * T); setTimeout(() => { sfx.play('click'); const c = $('#cnt'); if (c) c.textContent = i + 1; }, t0 + i * T - performance.now()); }
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
  if (!offer.length) return PAIRS.some(([a, b]) => canTrain(run.stats, a) || canTrain(run.stats, b)) ? rewardScreen(after) : after();   // 각인이 바닥나면 단련 2점으로
  screen(`<div class="card"><h2>각인을 하나 고르세요</h2>${runStat()}<div class="picks">${offer.map(id => relicCard(id)).join('')}</div></div>`);
  bindPicks(id => takeReward(id, after));
}
// 다음 스테이지: 정해진 순서대로 바로 들어간다 (들어갈 때 아이리스가 열림)
function goNext() {
  const prev = world && world.player.spells[0]; nextStage(run); play();
  const now = world.player.spells[0];
  if (prev && now !== prev) R.say(`새 마법 「${SPELLS[now].name}」 — ${SPELLS[now].desc}`);
}
// 출구로 나갈 때: 아이리스가 리라 쪽으로 닫힌 뒤 다음 스테이지
function leaveRoom() {
  mode = 'transition'; touch.classList.add('hidden'); R.iris(world, 'close');
  const closed = () => {                                                  // 완전히 닫힌 검은 화면에서 남은 보상을 고른 뒤 다음 방
    const k = run.pending; run.pending = null;
    if (k === 'train') rewardScreen(goNext); else if (k === 'relic') relicScreen(goNext); else goNext();
  };
  const wait = () => { if (R.irisClock >= 1.02) closed(); else { R.stepFx(world); requestAnimationFrame(wait); } };
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
    const hp0 = p.hp;
    if (id === 'heal') p.hp = Math.min(p.maxHp, p.hp + 2); else if (id === 'oil') p.flasks = p.maxFlasks;
    if (id !== 'back') fire.used = true;
    resume();
    if (id === 'heal') { R.healFx(p, p.hp - hp0, hp0); R.dir.events({ events: [{ type: 'heal' }], player: p, t: world.t }); sfx.play('heal'); }
    if (id === 'oil') { R.say(`기름병을 채웠다 (${p.flasks}개)`); sfx.play('heal'); }
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
    // 방을 비우면 출구만 열린다. 보상(단련·각인)은 출구로 나가 아이리스가 검게 닫힌 뒤 고른다 (leaveRoom)
    world.rewarded = world.counted = true; run.pending = run.room === 'combat' ? 'train' : 'relic'; roomCleared(run);
    addScore('room', 100);
    const sec = world.t / 60, par = world.par || 0, fast = par && sec <= par;
    const bonus = fast ? Math.round(200 * (1 - sec / par)) + 20 : 0;
    if (fast) { addScore('time', bonus); run.embers += 5; }
    resume(); R.say((fast ? `빠른 정리! ${Math.ceil(sec)}초 / 목표 ${par}초 · 점수 +${bonus} · 불씨 +5 — ` : '') + (run.pending === 'train' ? '출구가 열렸다 — 나가면 단련' : '출구가 열렸다 — 나가면 각인 선택'), fast ? 240 : 150);
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
    screen(`<div class="card board pausecard">${runStat()}<div class="sboard"><div>${statGrid()}${spellMap()}</div>
      <div class="spanel"><h2>잠시 멈춤</h2>${spellCard(runSpell(run))}${resonanceBlock()}
      <div class="btns"><button class="btn" id="resume">계속</button><button class="btn alt" id="home">순례 포기</button></div></div></div></div>`);
    bindInfo(run.stats, run.stats); bind('resume', resume); bind('home', () => { saveFromWorld(run, world); finish(false); });
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
    <div class="tally"><span><b>${run.score || 0}</b>점수${save.records.newBest ? ' · 최고 기록!' : ''}</span><span><b>${run.perfect}</b>완벽 패링</span><span><b>${run.kills}</b>처치</span><span><b>${mins}</b>시간</span></div>
    <div class="line">${Object.entries(run.scoreLog || {}).map(([k, v]) => `${SCORE_NAME[k] || k} ${v}`).join(' · ')} · 최고 점수 ${save.records.bestScore || 0}</div>
    ${runStat()}
    <div class="line">이번 판 도전 '${ch.name}': ${run.challengeDone ? '성공' : '실패'}</div>
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
// 점수: 처치 10(강적 50, 보스 500) · 완벽 패링 25 · 처형 40 · 불씨 5 · 상자 100 · 방 정리 100 · 목표 시간 보너스 최대 200
const SCORE_NAME = { kill: '처치', parry: '완벽 패링', execute: '처형', ember: '불씨 수집', chest: '보물 상자', room: '방 정리', time: '빠른 정리', boss: '보스' };
function addScore(k, n) { if (!run || !n) return; run.score = (run.score || 0) + n; run.scoreLog = run.scoreLog || {}; run.scoreLog[k] = (run.scoreLog[k] || 0) + n; }
function resume() { mode = 'play'; screen(''); showTouch(); last = performance.now(); acc = 0; }

const SOUND = { hurt: 'hurt', kill: 'kill', execute: 'execute', slam: 'slam', telegraph: 'telegraph', heal: 'heal' };
function onEvents(w) {
  for (const ev of w.events) {
    if (ev.type === 'parry') {
      sfx.play(ev.perfect ? 'parryPerfect' : 'parryNormal');
      if (ev.perfect) { slowT = 18; if (navigator.vibrate) navigator.vibrate(35); }
    }
    else if (ev.type === 'attackHit') { sfx.play(ev.combo === 2 ? 'hit3' : 'hit'); if (navigator.vibrate) navigator.vibrate(ev.combo === 2 ? 18 : 8); }
    else if (ev.type === 'land' && ev.v > 3) sfx.play('land');
    else if (ev.type === 'executeStart') { sfx.play('telegraph'); sfx.play('swing'); if (navigator.vibrate) navigator.vibrate(20); }
    else if (ev.type === 'execute') { sfx.play('execute'); if (navigator.vibrate) navigator.vibrate([40, 30, 60]); }
    else if (ev.type === 'castStart') sfx.play(ev.spell === 'bolt' ? 'bolt' : 'ult');
    else if (SOUND[ev.type]) sfx.play(SOUND[ev.type]);
    if (ev.type === 'kill' && run) { run.kills++; if (!ev.dummy) addScore(ev.boss ? 'boss' : 'kill', ev.boss ? 500 : ev.elite ? 50 : 10); }
    if (ev.type === 'parry' && ev.perfect) addScore('parry', 25);
    if (ev.type === 'execute') addScore('execute', 40);
    if (ev.type === 'execChain') { addScore('execute', 40 * ev.n); sfx.play('heal'); }
    if (ev.type === 'spinStart') { sfx.play('swing'); sfx.play('hit3'); if (navigator.vibrate) navigator.vibrate(25); }
    if (ev.type === 'barrierHit') sfx.play('parryNormal');
    if (ev.type === 'barrierBreak') sfx.play('execute');
    if (ev.type === 'mirage') sfx.play('roll');
    if (ev.type === 'pickup') { if (ev.kind === 'ember' && run) { run.embers++; addScore('ember', 5); } sfx.play(ev.kind === 'ember' ? 'click' : 'heal'); }
    if (ev.type === 'chestOpen') { addScore('chest', 100); sfx.play('ignite'); }
    if (ev.type === 'chestEmbers' && run) { run.embers += ev.n; R.say(`보물 상자 — 불씨 +${ev.n}`); }
    if (ev.type === 'urnBreak') sfx.play('hit');
    if (ev.type === 'lever' || ev.type === 'gateOpen') sfx.play(ev.type === 'lever' ? 'parryNormal' : 'slam');
    if (ev.type === 'ventFire') sfx.play('ult');
    if (w.tutorial && tut) tutEvent(ev);
    if (w.town) {                                                         // 마을
      if (ev.type === 'interact') { sfx.play('click'); if (ev.kind === 'keeper') talk('keeper', town); else if (ev.kind === 'altar') prepScreen(); else if (ev.kind === 'board') recordsScreen(); else if (ev.kind === 'campfire') campMenu(); }
      if (ev.type === 'exit') prepScreen();
      continue;
    }
    if (ev.type === 'interact') { if (ev.kind === 'merchant') { if (run && !run.metMerchant) { run.metMerchant = true; talk('merchant', shopScreen); } else shopScreen(); } else if (ev.kind === 'campfire') restScreen(); }
    if (ev.type === 'exit') { saveFromWorld(run, w); if (!w.counted) roomCleared(run); leaveRoom(); return; }
    if (ev.type === 'bellRelease') sfx.play('telegraph');
    if (ev.type === 'bellTrap' || ev.type === 'bellMiss') sfx.play('slam');
    if (ev.type === 'veilBreak' || ev.type === 'mirrorReflect') sfx.play('execute');
    if (ev.type === 'veilUp') sfx.play('heal');
    if (ev.type === 'beaconLit') sfx.play('ignite');
    if (ev.type === 'phase2') { sfx.play('slam'); sfx.play('ult'); slowT = 50; if (navigator.vibrate) navigator.vibrate([60, 40, 120]); }
    if (ev.type === 'debris') sfx.play('telegraph');
  }
  const p = w.player;
  if (p.stateT === 0 && p.state === 'attack') sfx.play('swing');
  if (p.stateT === 0 && p.state === 'roll') { sfx.play('roll'); if (tut && w.tutorial) tutEvent({ type: 'rollStart' }); }
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
  if (mode === 'town' && world && world.town) {                          // 마을 걷기
    if (input.take('confirm')) { newPilgrimage(); startPilgrimage(); }
    else if (input.take('pause')) campMenu();
    else if (!R.irisBusy()) {
      acc = stepLoop(acc, dt, () => { tick(world, input.read()); onEvents(world); R.spawnFx(world); R.stepFx(world); if (TOUCH) syncTouch();
        if (!world.enemies.length) townDummy(world); for (const e of world.enemies) { e.cd = 1e9; e.poiseRegenT = 0; } });
    } else R.stepFx(world);
  }
  if (mode === 'play') {
    if (input.take('pause')) overlay('pause');
    else {
      if (R.irisBusy() || R.stepCine()) { R.stepFx(world); acc = 0; touch.classList.add('hidden'); world.wasCine = true; }   // 아이리스·보스 등장 연출 동안은 세계 정지, 버튼 숨김
      else {
        if (world.wasCine) { world.wasCine = false; showTouch(); if (run && run.room === 'boss' && !world.hinted) { world.hinted = true; const b = world.enemies.find(e => e.boss); if (b && GIMMICK_HINT[b.kind]) R.say(GIMMICK_HINT[b.kind], 360); } }   // 보스 기믹 힌트
        const rate = world.player.state === 'execute' && !world.hitstop ? CFG.execute.slow : slowT > 0 && !world.hitstop ? 0.45 : 1;   // 처형 중 슬로모션, 완벽 패링 직후 잠깐 슬로
        acc = stepLoop(acc, dt * rate, step); tutTick();
      }
      if (world.over) overlay('dead');
      else if (world.won) overlay('won');
      else if (world.cleared && !world.rewarded) overlay('cleared');
    }
  } else if (mode === 'pause' && input.take('pause')) resume();
  else if (mode !== 'play' && mode !== 'title' && input.take('confirm')) document.querySelector('#ui .btn, #ui .pick')?.dispatchEvent(new PointerEvent('pointerup'));
  R.draw(world);
  }

$('#b-pause').addEventListener('pointerup', () => mode === 'play' ? overlay('pause') : mode === 'town' && campMenu());
addEventListener('resize', () => R.resize());
// 전투 중 세로로 돌리면 일시정지 (안내 화면 뒤에서 싸움이 계속되지 않게)
const portrait = matchMedia('(orientation: portrait) and (pointer: coarse)');
portrait.addEventListener('change', () => { if (portrait.matches && mode === 'play') overlay('pause'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') overlay('pause'); });
touch.addEventListener('contextmenu', e => e.preventDefault());

sfx.on = save.settings.sound; sfx.musicOn = save.settings.music;
title();
requestAnimationFrame(frame);
