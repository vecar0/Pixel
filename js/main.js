// 진입점: 화면 흐름(타이틀 → 아레나 → 보스), 고정 스텝 루프, 효과음 연결
import { createWorld, tick, groundAt } from './core/world.js?v=mwztnyz8';
import { Renderer } from './render.js?v=mwztnyz8';
import { Input } from './input.js?v=mwztnyz8';
import { Sfx } from './sfx.js?v=mwztnyz8';
import { stepLoop } from './loop.js?v=mwztnyz8';
import { spawnEnemy } from './core/enemies.js?v=mwztnyz8';
import { defaultSave, SAVE_KEY, UNLOCKS, OILS, DARK_RULES, DARK_MAX, buy, relicPool, oilsOwned, recordRun, dailySeed } from './core/meta.js?v=mwztnyz8';
import { ENEMY_DEFS, AFFINITY, nameOf } from './core/enemies.js?v=mwztnyz8';
import { icon, RELIC_TONE } from './icons.js?v=mwztnyz8';
import { installPixelUI, roundBtn, gaugeBtn } from './pixelui.js?v=mwztnyz8';
import { startTitleScene } from './titlescene.js?v=mwztnyz8';
installPixelUI();
import { CFG } from './core/config.js?v=mwztnyz8';
import { SPELLS, STAT_SPELL, SPELL_TAGS, SPELL_PERK, SPELL_ELEMENT, STAT_ELEMENT, ENCHANT, awakenPick, elementSpell } from './core/spells.js?v=mwztnyz8';
import { STATS, STAT_BY_ID, tiersOn, weakOn, nextTier, PAIRS, OPP, canTrain, RESONANCES, resonancesOf, MASTERY, statNumbers, STAT_MAX, STAT_START, T_ABILITY, T_MASTER } from './core/stats.js?v=mwztnyz8';
import { takeTrain, runSpell, awaken } from './core/run.js?v=mwztnyz8';
import { GIMMICK_HINT } from './core/gimmick.js?v=mwztnyz8';
import { LAMP_COLORS, LIGHT_SHAPES, shrineCost, shapeChoices, lightShrine } from './core/light.js?v=mwztnyz8';
import { REGIONS, CHALLENGES, advanceRegion, regionOf, challengeDone, setRegion, RELICS, ROOM_TYPES, newRun, relicOffer, rand, takeRelic, nextStage, stageOf, applyRelics, applyStats, enterRoom, roomCleared, buildRoomWorld, saveFromWorld } from './core/run.js?v=mwztnyz8';

const $ = s => document.querySelector(s);
const ui = $('#ui'), touch = $('#touch');
const R = new Renderer($('#game'));
const input = new Input(touch);
const sfx = new Sfx();
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const showTouch = () => touch.classList.toggle('hidden', !TOUCH);
input.onAny = () => sfx.unlock();
// 터치 버튼: 픽셀 아이콘 + 작은 이름. 마법은 비용만큼 빛이 차오르면 켜지고, 기름병은 남은 개수
const TB = { attack: ['sword', 'bone', '공격'], parry: ['parry', 'amber', '패링'], roll: ['roll', 'moon', '회피'], jump: ['jump', 'moon', '점프'], skill: ['ember', 'amber', '등불'], flask: ['flask', 'heal', ''], pause: ['pause', 'bone', ''] };
for (const [k, [ic, t, name]] of Object.entries(TB)) { const b = $('#b-' + k); b.setAttribute('aria-label', b.textContent); b.innerHTML = icon(ic, t) + (name ? `<small>${name}</small>` : '') + (k === 'flask' ? '<b>3</b>' : ''); }
let hudKey = '';
const setGauge = (el, color, frac, glow) => { const u = `url(${gaugeBtn(color, frac, { glow })})`; if (el._g !== u) { el._g = u; el.style.setProperty('--g', u); } };   // 픽셀 게이지 테두리
function syncTouch() {
  const p = world.player, Lp = p.lamp || { st: 'held', t: 0 }, key = Lp.st + '/' + ((Lp.t / 20) | 0) + '/' + p.flasks;
  if (key === hudKey) return; hudKey = key;
  const b = $('#b-skill');                                             // 등불 버튼: 들고 있으면 '던지기'(길게 = 조준), 던졌으면 '회수' + 남은 빛 시간
  if (b) {
    const out = Lp.st !== 'held', lab = b.querySelector('small');
    if (lab) lab.textContent = out ? '회수' : '던지기';
    const fr = Lp.st === 'placed' ? Math.max(0, 1 - Lp.t / (CFG.lantern.placedF + 180 * ((p.shapes || {}).long || 0))) : out ? 1 : 1;
    b.style.setProperty('--p', (fr * 100).toFixed(1)); setGauge(b, out ? '#8fc8ff' : '#ffb347', fr, !out); b.classList.toggle('ready', !out); b.classList.toggle('lit', out);
  }
  const f = $('#b-flask'); f.querySelector('b').textContent = p.flasks; f.classList.toggle('empty', p.flasks <= 0);
  const ff = Math.min(1, p.flasks / Math.max(1, p.maxFlasks)); f.style.setProperty('--p', (ff * 100).toFixed(1)); setGauge(f, '#7fe08a', ff, false);   // 남은 기름병 = 픽셀 테두리 게이지
}

// 저장 (등불 조각·해금·기록·설정)
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) return { ...defaultSave(), ...s, records: { ...defaultSave().records, ...s.records }, settings: { ...defaultSave().settings, ...s.settings } }; } catch (e) { } return defaultSave(); }
let save = loadSave();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } }
let bossesKilled = [], practice = false;

const DEATH_F = 230;   // 사망 연출 길이(틱): 쓰러짐 90 → 등불이 꺼짐 → 글자
let deathT = 0;
let run = null, mode = 'title', world = createWorld({ room: 'arena' }), acc = 0, last = performance.now(), slowT = 0;
// 테스트·디버그용 훅
const lk = window.__lk = { get tut() { return tut; }, get world() { return world; }, get mode() { return mode; }, get run() { return run; }, setRoom, start, R, step: () => step(), spawn: (k, x, y) => spawnEnemy(world, k, x, y), gotoBoss: reg => { setRegion(run, reg); enterRoom(run, 'boss'); play(); },
  screens: { reward: () => rewardScreen(() => {}), prep: () => prepScreen(), practice: () => practiceScreen(), records: () => recordsScreen(), settings: () => settingsScreen(), camp: () => campMenu(), pause: () => overlay('pause'), rest: () => restScreen(), shop: () => shopScreen(), intro: () => regionIntro(), result: () => finish(false) } };   // 테스트용: 화면 바로 열기

function screen(html) { input.clear(); R.hud = !html; ui.innerHTML = html ? `<div class="screen">${html}</div>` : ''; }
function bind(id, fn) { const b = document.getElementById(id); if (b) b.addEventListener('pointerup', e => { e.preventDefault(); sfx.unlock(); sfx.play('click'); fn(); }); }

function play() {
  deathT = 0; R.death = 0;
  world = buildRoomWorld(run); R.runInfo = run; R.region = run.region;
  R.reset(); R.dir.preloadRegion(run.region); R.dir.enterRoom(world, run.region, run.room === 'boss');
  const ST = { combat: '전투', elite: '강적', shop: '떠돌이 상인', rest: '작은 등불', boss: ENEMY_DEFS[regionOf(run).boss].name };
  if (run.room === 'boss') { R.startCine(ST.boss, `${regionOf(run).name}의 대등을 지키는 자`); R.banner = null; }
  else R.banner = { s: ST[run.room] || '', sub: `${regionOf(run).name} · ${run.roomIdx + 1} / ${run.length}`, t: 150, dur: 150 };
  if (run.justAwakened) { const el = run.justAwakened; run.justAwakened = null; R.banner = { s: `등불 각성 — ${STAT_ELEMENT[el]}`, sub: `${ENCHANT[el].name} · 마법 버튼으로 검에 불꽃을 붙이고 베어 속성을 터뜨려라`, t: 220, dur: 220 }; }
  world.player.lagTicks = Math.max(0, Math.min(6, Math.round(save.settings.offsetMs / 16.7)));   // 타이밍 보정
  if (world.player.roomHealed) R.healFx(world.player, 1, world.player.hp - 1);                 // 생명 16
  sfx.musicFor(run.region, run.room === 'boss'); acc = 0; slowT = 0; mode = 'play'; screen(''); showTouch();
  tut = world.tutorial ? { step: 0, x0: world.player.x, t: 0, hurt: 0 } : null; if (tut) { R.banner = { s: '첫 순례', sub: '하나씩 해 보세요', t: 150, dur: 150 }; tutStep(0); } }
// 대화창: 초상·이름·한 글자씩 나오는 대사. 누르면(또는 Enter) 다 보이고, 다시 누르면 다음 줄 → 끝나면 then()
const TALK = {
  keeper: { name: '등대지기 노라', img: 'assets/keeper.png', lines: [
    ['등대의 불이 꺼진 지 오래야.', '네 등불로 여섯 대등을 다시 켜 주렴.'],
    ['기름은 제단에서 골라 가렴.', '기름에 따라 각성 전 등불 불꽃의 성질이 달라지지.'],
    ['허수아비로 손을 풀고 가렴.', '패링은 적이 번쩍이는 그 순간이 전부야.'],
    ['어둠이 깊을수록 보상도 크다네.', '자신이 생기면 제단에서 어둠을 올려 봐.'],
    ['방마다 목표 시간이 있어.', '빨리 정리하면 불씨를 더 얹어 주지.'],
    ['완벽하게 막아 낸 직후 바로 베어 봐.', '앞으로 파고들며 네 번 연달아 베는 반격이 나간단다.'],
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
  () => `적은 그림자 — 등불 빛 안에서만 베여요. 번쩍이는 순간 패링 ${K('K', '패링')} — 막힌 그림자는 빛에 데어 실체가 돼요`,
  () => `구르기 ${K('L · Shift', '회피')} — 무적으로 피하고 적을 지나갈 수 있어요`,
  () => `등불 ${K('U · I', '등불')} 탭 = 던지기 · 길게 = 조준 · 다시 탭 = 회수 — 무너진 적은 빛 속에서 처형해 빛 조각을 얻어요`,
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
function start() { run = newRun(); R.seenKind = {}; enterRoom(run, 'combat'); bossesKilled = []; practice = false; play(); R.irisMode = null; R.trans.clear(); }   // 테스트용 빠른 시작: 전환 연출 생략
function newPilgrimage(opts = {}) {
  bossesKilled = []; practice = false;
  run = newRun(opts.seed, { dark: save.dark, pool: relicPool(save), oil: save.oil, shortcut: false, daily: !!opts.daily, tutorial: !save.records.runs && !save.tutorialDone });  R.seenKind = {};   // 첫 순례 = 튜토리얼 방
}

function bindPicks(fn) { for (const b of ui.querySelectorAll('.pick, [data-id]')) b.addEventListener('pointerup', e => { e.preventDefault(); sfx.unlock(); sfx.play('click'); if (!b.disabled) fn(b.dataset.id); }); }
const cost = (n, tone = 'amber') => `<em>${icon('ember', tone)}${n}</em>`;
// 런 상태 띠: 지역 · 방 진행(마름모) · 불씨 · 지금 마법
const runStat = () => {
  const RI = { combat: ['combat', 'bone'], elite: ['elite', 'ember'], shop: ['shop', 'amber'], rest: ['rest', 'heal'], boss: ['boss', 'ember'] };
  const path = run.route.map((t, i) => `<b class="${i < run.roomIdx ? 'done' : i === run.roomIdx ? 'now' : ''}">${icon(...(RI[t] || RI.combat))}</b>`).join('');
  return `<div class="runbar"><span>${regionOf(run).name}</span><span class="path">${path}</span>
    <span class="em">${icon('ember', 'amber')}${run.embers}</span>
    ${CFG.legacy ? `<span class="spells" title="등불 속성 · 점화 단계">${icon('ember', elTone(run.element))}${run.element ? `${STAT_ELEMENT[run.element]} · ${TIER_NAME[enchTier(run.stats, run.element)]}` : '각성 전'}</span>` : `<span class="spells" title="빛 조각 · 등잔 색">${icon('wick', 'amber')}조각 ${world && world.player && world.player.shards != null ? world.player.shards : run.shards || 0}${run.color ? ' · ' + LAMP_COLORS[run.color].name : ''}</span>`}</div>`;
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
    <div class="sc-tags"><i class="el">${SPELL_ELEMENT[id] || ''} 속성</i>${(SPELL_TAGS[id] || []).map(t => `<i>${t}</i>`).join('')}</div>
    <div class="sc-desc">${S.desc}${delay}</div>${SPELL_PERK[id] ? `<div class="sc-perk">${SPELL_PERK[id]}</div>` : ''}</div></div>`;
}
// 불꽃 점화 카드: 각성 속성 · 게이지가 찼을 때 효과
const TIER_NAME = ['각성 전', '각성', '개화', '극의'];
const elTone = el => el ? SPELLS[STAT_SPELL[el][0]].tone : 'amber';
const enchTier = (st, el) => !el ? 0 : st[el] >= 20 ? 3 : st[el] >= 17 ? 2 : st[el] >= 14 ? 1 : 0;
const tierText = (el, t) => !el || t < 1 ? '점화한 칼로 3대 → 약한 화상' : t === 1 ? `점화한 칼로 3대 → ${ENCHANT[el].desc}` : `${ENCHANT[el].burst} 1.5배 + 적에게 마법 각인 → 그 적을 처형하면 「${SPELLS[STAT_SPELL[el][t >= 3 ? 2 : 1]].name}」`;
// 불꽃 점화 카드: 속성 · 단계 사다리 (14 각성 → 17 개화: 폭발 때 속성 마법 → 20 극의: 최종 마법)
const enchantCard = () => { const el = run.element || null, E = ENCHANT[el], t = enchTier(run.stats, el);
  const ladder = el ? [1, 2, 3].map(k => `<div class="${t >= k ? '' : 'dim'}">${[0, 14, 17, 20][k]} ${TIER_NAME[k]} — ${tierText(el, k)}</div>`).join('') : '<div>스탯 하나가 14가 되면 그 속성으로 각성</div>';
  return `<div class="spellcard t-${elTone(el)}"><div class="niche">${icon('ember', elTone(el))}</div><div class="sc-body"><div class="sc-top"><small>${el ? `등불 속성 · ${STAT_ELEMENT[el]} · ${TIER_NAME[t]}` : '각성 전'}</small><b>${E.name}</b><span class="sc-cost">빛 ${CFG.enchant.cost}</span></div><div class="sc-desc">마법 버튼으로 검에 불꽃을 붙여 피해 +12% (빛 10 이상이면 점화하고, 휘두를 때마다 빛 8 — 빛이 바닥나면 꺼짐). 점화한 칼로 3대 치면 속성 효과가 터진다 (보스는 5대). 소등했다 다시 켜면 섬광이 주변 게이지를 한 번에 채운다</div><div class="sc-perk">${ladder}</div></div></div>`; };
const spellMap = () => `<div class="sc-map"><b>마법</b> 마법 버튼 = 검에 불꽃 점화(빛 10 이상이면 점화, 휘두를 때마다 빛 8). 점화한 칼로 3대 치면 속성 효과가 터진다(보스 5대). 스탯이 처음 14가 되면 그 속성으로 각성(휴식방에서만 변경) · 17 개화: 터진 적에게 마법 각인, 그 적을 처형하면 속성 마법 · 20 극의: 최종 마법 — ${PAIRS.flat().map(k => `${STAT_BY_ID[k].name}(${STAT_ELEMENT[k]}) ${STAT_SPELL[k].slice(1).map(id => SPELLS[id].name).join('/')}`).join(' · ')}</div>`;
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
  const el1 = run.element || awakenPick(draft, lastUp), t0 = enchTier(run.stats, run.element), t1 = enchTier(draft, el1);
  if (!run.element && el1) notes.push(`<b class="res">등불 각성 — ${STAT_ELEMENT[el1]}</b> ${ENCHANT[el1].name}: ${ENCHANT[el1].desc}`);
  else if (t1 > t0) notes.push(`<b class="res">점화 ${TIER_NAME[t1]}</b> ${tierText(el1, t1)}`); else if (t1 < t0) notes.push(`<b class="bad">점화 단계 내려감</b> ${tierText(el1, t1)}`);
  return `<div class="tprev"><div class="tls">${lines.join('')}</div>${notes.map(n => `<div class="note">${n}</div>`).join('')}
    </div>`;
}
// 단련: 점수를 ▲▼ 화살표로 자유롭게 찍고(반대 화살표로 되돌림) '단련 완료'로 확정. 전투방·강적방·보스 모두 1점씩 (각인은 없음)
function rewardScreen(after, draft = null, lastUp = null, total = 1) {   // 단련은 한 번에 1점
  mode = 'relic'; touch.classList.add('hidden');
  if (!draft && !PAIRS.some(([a, b]) => canTrain(run.stats, a) || canTrain(run.stats, b))) return after();   // 더 찍을 곳이 없으면 넘어감
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
    const el = awaken(run); if (el) run.justAwakened = el;              // 처음 14에 닿은 스탯으로 등불 각성
    after();
  });
}

// ‹ 값 › 스테퍼 (셀렉트 박스 대신, 엄지로 누르기 쉽게)
const chip = (id, label, sub, canPrev, canNext) => `<div class="chip"><button id="${id}-p" ${canPrev ? '' : 'disabled'} aria-label="이전">‹</button><div>${label}<small>${sub}</small></div><button id="${id}-n" ${canNext ? '' : 'disabled'} aria-label="다음">›</button></div>`;

// 픽셀 제목: 작은 글씨(갈무리 굵게 11px)를 비트맵으로 찍어 한 줄씩 금빛→주황→잉걸 색, 1px 어두운 테두리·윗면 빛·아래 그림자 → CSS가 정수배로 키움
function drawLogo(cv, text) {
  if (!cv) return;
  const go = () => {
    const S = 12, GAP = 2, t = document.createElement('canvas'), tg = t.getContext('2d'); tg.font = `${S}px Galmuri11`;
    const chars = [...text], cw = chars.map(c => Math.ceil(tg.measureText(c).width)), tw = cw.reduce((a, b) => a + b, 0) + GAP * (chars.length - 1) + 2, th = S + 3;
    t.width = tw; t.height = th; tg.font = `${S}px Galmuri11`; tg.textBaseline = 'top'; tg.fillStyle = '#fff';
    let cx = 1; chars.forEach((c, i) => { tg.fillText(c, cx, 1); cx += cw[i] + GAP; });             // 글자 사이 2px
    const src = tg.getImageData(0, 0, tw, th).data, m0 = (x, y) => x >= 0 && y >= 0 && x < tw && y < th && src[(y * tw + x) * 4 + 3] > 110;
    const K = 2, MW = tw * K, MH = th * K, M = (x, y) => m0(Math.floor(x / K), Math.floor(y / K)) && x >= 0 && y >= 0;   // 획을 2배로 (굵고 또렷하게)
    let y0 = MH, y1 = 0; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (M(x, y)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const P = 2, W = MW + P * 2, H = MH + P * 2 + 1; cv.width = W; cv.height = H;
    const g = cv.getContext('2d'), out = g.createImageData(W, H), put = (x, y, c) => { if (x < -P || y < -P || x >= MW + P || y >= MH + P + 1) return; const i = ((y + P) * W + x + P) * 4; out.data[i] = c[0]; out.data[i + 1] = c[1]; out.data[i + 2] = c[2]; out.data[i + 3] = 255; };
    const RAMP = [[255, 240, 196], [255, 222, 140], [255, 196, 92], [255, 166, 60], [236, 128, 38], [200, 92, 24]];
    const OUT = [38, 14, 6], SHADOW = [10, 5, 4];
    for (let y = -P; y < MH + P; y++) for (let x = -P; x < MW + P; x++) if (!M(x, y) && (M(x - 1, y - 2) || M(x, y - 2))) put(x, y, SHADOW);   // 아래 그림자
    for (let y = -1; y <= MH; y++) for (let x = -1; x <= MW; x++) if (!M(x, y) && (M(x - 1, y) || M(x + 1, y) || M(x, y - 1) || M(x, y + 1))) put(x, y, OUT);   // 1px 테두리
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (M(x, y)) {
      const k = (y - y0) / Math.max(1, y1 - y0); let c = RAMP[Math.min(RAMP.length - 1, Math.floor(k * RAMP.length))];
      if (!M(x, y - 1)) c = c.map(v => Math.min(255, v + 22));            // 획 윗면: 살짝 밝게
      else if (!M(x, y + 1)) c = c.map((v, i) => Math.round(v * (i ? 0.72 : 0.85)));   // 획 아랫면: 살짝 어둡게 (도톰한 느낌)
      put(x, y, c);
    }
    g.putImageData(out, 0, 0);
    const want = Math.min(innerHeight * 0.2, innerWidth * 0.11), scale = Math.max(1, Math.floor(want / H));   // 정수배로만 키움 (픽셀 크기 고르게)
    cv.style.height = H * scale + 'px'; cv.style.width = W * scale + 'px'; cv.classList.add('on');
  };
  (document.fonts && document.fonts.load ? document.fonts.load('12px Galmuri11').then(go, go) : Promise.resolve().then(go));
}
// 타이틀: 왼쪽은 등불을 든 리라 장면(캔버스), 오른쪽은 제목. 화면 어디를 눌러도 시작
let stopTitle = null;
function title() {
  mode = 'title'; touch.classList.add('hidden'); sfx.musicFor(0);
  screen(`<div class="titlescene" id="go"><canvas id="tcv" width="480" height="270"></canvas>
    <div class="tlogo"><div class="tl-pre">꺼져 가는 지하 왕국에서</div><h1 aria-label="등불지기"><canvas id="tlogo-cv"></canvas></h1>
      <div class="tl-rule"><i></i><b></b><i></i></div><div class="tl-sub">마지막 등불을 든 순례자, 리라</div></div>
    <div class="tl-start"><span>화면을 눌러 시작</span></div>
    <div class="help">이동 A·D · 점프 W · 공격 J · 패링 K · 회피 L · 등불 U/I (길게 = 조준) · 기름병 Q · Enter 시작</div><div class="tl-ver">v${(window.__V || '').slice(-4)}</div></div>`);
  stopTitle && stopTitle(); stopTitle = startTitleScene($('#tcv'));
  drawLogo($('#tlogo-cv'), '등불지기');
  bind('go', town);
}
// 등대 마을: 왼쪽은 리라와 기록, 오른쪽은 출발 · 조정 · 메뉴
// 마을: 걸어 다니는 방. 왼쪽부터 등대지기의 창고(해금) · 허수아비(연습 상대) · 순례 제단(출발 준비) · 모닥불(기록·연습장·설정), 오른쪽 끝 길 = 순례 준비
const TOWN_W = 1250;                                               // 좁혀서 촘촘하게 (기능 소품 간격 ~150)
// 마을 장식 (상호작용 없음): 통·상자 더미 · 가로등 · 손수레 · 벤치와 화분 — 빈 곳을 채워 사람 사는 동네처럼
const TOWN_DECO = [['deco-barrels', 70], ['lamp', 140], ['urn', 190], ['deco-bench', 345], ['urn', 392], ['lamp', 495], ['deco-cart', 625], ['urn', 760], ['lamp', 775], ['deco-barrels', 915], ['lamp', 1060], ['urn', 1110], ['post', 1150], ['deco-barrels', 1205], ['lamp', 1230]];
function buildTown() {
  const W = TOWN_W, w = createWorld({ room: 'haven', width: W, solids: [{ x: -40, y: 0, w: 40, h: 360 }, { x: W, y: 0, w: 40, h: 360 }, { x: -40, y: 300, w: W + 80, h: 60 }], spawn: { x: 180, y: 240 } });   // 화면 왼쪽 끝(폰 노치·스틱) 뒤에 가리지 않게
  w.haven = 'town'; w.town = true; w.decor = TOWN_DECO.map(([img, x]) => ({ img, x }));
  // 기능은 하나씩: 이야기 · 보스 연습 · 준비(어둠·기름) · 기록과 오늘의 시련 · 쉬기(설정) · 출발
  w.props = [
    { kind: 'keeper', x: 255, label: '등대지기 (이야기)' },
    { kind: 'rack', x: 430, label: '연습장 (보스 연습)' },
    { kind: 'altar', x: 700, label: '순례 제단 (어둠·기름)' },
    { kind: 'board', x: 850, label: '게시판 (기록·오늘의 시련)' },
    { kind: 'campfire', x: 990, label: '모닥불 (설정)' },
    { kind: 'exit', x: W - 160, label: '순례 길 → 출발' },
  ];
  townDummy(w);
  return w;
}
function townDummy(w) {   // 허수아비: 공격하지 않는 연습 상대 (쓰러지면 다시 선다)
  const e = spawnEnemy(w, 'ghoul', 555, 300 - ENEMY_DEFS.ghoul.h - 2, { hpMul: 30 });
  e.cd = 1e9; e.speed = 0; e.dummy = true; e.spawnT = 0;
}
function town() {
  if (stopTitle) { stopTitle(); stopTitle = null; }
  mode = 'town'; sfx.musicFor(0); practice = false;
  if (!world || !world.town) {
    world = buildTown(); run = null; R.runInfo = null; R.region = 0;
    R.reset(); R.dir.preloadRegion(1); R.dir.enterRoom(world, 1, false);
    R.banner = { s: '등대 마을', sub: '오른쪽 끝이 순례 길', t: 170, dur: 170 };
    R.say('등대지기·연습장·제단·게시판·모닥불 앞에서 공격 버튼 · 오른쪽 길로 출발', 260);
  }
  world.exited = false;
  if (world.player.x > TOWN_W - 240) world.player.x = TOWN_W - 240;   // 출구(W-160) 바로 앞에 (닿으면 곧장 출발하지 않게)
  deathT = 0; R.death = 0; R.cine = null; if (R.irisMode === 'close') R.irisMode = null;   // 전투에서 남은 연출 상태가 마을 리라를 가리지 않게
  const tp = world.player; tp.iframes = 0; if (tp.state === 'dead' || tp.state === 'ghost' || !(tp.y < 300)) { tp.state = 'idle'; tp.stateT = 0; tp.x = 180; tp.y = 300 - tp.h; tp.vx = tp.vy = 0; }
  screen(''); showTouch(); last = performance.now(); acc = 0;
}
// 모닥불: 기록·연습장·설정
function campMenu() {
  mode = 'camp'; touch.classList.add('hidden');
  screen(`<div class="card"><h2>모닥불</h2><div class="quote">불가에 앉아 잠시 쉰다</div><div class="menu">
    <button class="row-btn" data-id="settings">${icon('wick', 'bone')}<span><b>설정</b><small>타이밍 보정 · 소리</small></span></button>
    <button class="row-btn" data-id="title">${icon('pause', 'bone')}<span><b>타이틀로</b><small>처음 화면</small></span></button>
    </div><div class="btns"><button class="btn alt" data-id="back">닫기</button></div></div>`);
  bindPicks(id => { if (id === 'back') town(); else if (id === 'records') recordsScreen(); else if (id === 'practice') practiceScreen(); else if (id === 'settings') settingsScreen(); else if (id === 'title') { world = null; title(); } });
}
function prepScreen() {   // 순례 제단: 어둠 단계·랜턴 기름 고르기 (출발은 오른쪽 길, 오늘의 시련은 게시판)
  mode = 'prep'; touch.classList.add('hidden');
  const d = dailySeed(), dailyDone = save.daily[d.key], oils = oilsOwned(save), oi = Math.max(0, oils.indexOf(save.oil)), r = save.records;
  screen(`<div class="town">
    <div class="hero"><h2>순례 제단</h2><img class="lira" alt="리라" src="assets/lira.png">
      <div class="shards">${icon('afterglow', 'amber')}최고 점수 ${save.records.bestScore || 0}</div>
      <div class="stats">순례 ${r.runs}회 · 귀환 ${r.wins}회<br>완벽 패링 누적 ${r.perfectTotal}</div></div>
    <div class="acts">
      <div class="line">고른 설정으로 오른쪽 끝 길에서 출발합니다</div>
      <div class="tune">
        ${chip('dark', `어둠 ${save.dark}`, save.dark ? DARK_RULES[save.dark] : '기본 난이도', save.dark > 0, save.dark < DARK_MAX)}
        ${chip('oil', `랜턴 기름: ${OILS[save.oil].name}`, OILS[save.oil].desc, oi > 0, oi < oils.length - 1)}
      </div>
      <div class="btns"><button class="btn" data-id="back">정했다</button></div>
    </div></div>`);
  const step = (id, fn) => { bind(id + '-p', () => { fn(-1); persist(); prepScreen(); }); bind(id + '-n', () => { fn(1); persist(); prepScreen(); }); };
  step('dark', k => { save.dark = Math.max(0, Math.min(DARK_MAX, save.dark + k)); });   // 어둠 단계는 처음부터 모두
  step('oil', k => { save.oil = oils[Math.max(0, Math.min(oils.length - 1, oi + k))]; });
  bindPicks(id => { if (id === 'back') town(); });
}
function practiceScreen() {
  mode = 'practice';
  const bosses = REGIONS;   // 처음부터 모든 보스 연습 가능
  screen(`<div class="card wide"><h2>연습장</h2><div class="line">기록되지 않는 연습. 패턴과 기믹을 익히세요</div><div class="picks grid3">
    ${bosses.map(g => `<button class="pick small t-ember" data-id="${g.id}"><div class="niche">${icon('boss', 'ember')}</div><b>${ENEMY_DEFS[g.boss].name}</b><span>${g.name}</span></button>`).join('') || '<div class="line">아직 쓰러뜨린 보스가 없다. 지역 보스를 쓰러뜨리면 여기서 다시 싸울 수 있다</div>'}
    </div><div class="btns"><button class="btn alt" data-id="back">돌아가기</button></div></div>`);
  bindPicks(id => { if (id === 'back') return town(); newPilgrimage(); setRegion(run, +id); enterRoom(run, 'boss'); practice = true; play(); });
}
function recordsScreen() {
  mode = 'records'; const r = save.records;
  screen(`<div class="card"><h2>게시판</h2><div class="quote">순례자들의 기록과 오늘의 시련이 붙어 있다</div>
    <div class="tally"><span><b>${r.bestDark < 0 ? '-' : r.bestDark}</b>최고 어둠</span><span><b>${r.fastest ? (r.fastest / 60 / 60).toFixed(1) + '분' : '-'}</b>최단 귀환</span><span><b>${r.perfectTotal}</b>완벽 패링</span><span><b>${r.challenges}</b>도전 성공</span></div>
    <div class="picks">${REGIONS.map(g => { const n = save.bossKills[g.boss] || 0, nh = r.noHitBosses.includes(g.boss);
      return `<div class="pick door small ${n ? 't-amber' : ''}" style="cursor:default"><div class="niche">${icon(n ? 'boss' : 'lock', n ? 'amber' : 'bone')}</div><b>${n ? ENEMY_DEFS[g.boss].name : '???'}</b><span>처치 ${n}${nh ? ' · 무피격' : ''}</span></div>`; }).join('')}</div>
    <div class="btns"><button class="btn" id="daily">${icon('boss', 'amber')}오늘의 시련 ${save.daily[dailySeed().key] ? '(재도전 · 기록만)' : '도전'}</button><button class="btn alt" id="back">돌아가기</button></div></div>`);
  bind('back', town);
  bind('daily', () => { const d = dailySeed(); newPilgrimage({ seed: d.seed, daily: true }); save.daily[d.key] = true; persist(); startPilgrimage(); });
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
function startPilgrimage() { if (!run || run.roomIdx) newPilgrimage(); enterRoom(run, 'combat'); regionIntro(); }
// 다음 스테이지: 정해진 순서대로 바로 들어간다 (들어갈 때 아이리스가 열림)
function goNext() {
  const prev = world && world.player.spells[0]; nextStage(run); play();
  const now = world.player.spells[0];
  if (prev && now !== prev) R.say(`새 마법 「${SPELLS[now].name}」 — ${SPELLS[now].desc}`);
}
// 출구로 나갈 때: 아이리스가 리라 쪽으로 닫힌 뒤 다음 스테이지
// 아이리스로 화면을 검게 닫은 뒤 then() (마을 출발·방 이동·보스 포탈 공통)
function irisThen(then) {
  mode = 'transition'; touch.classList.add('hidden'); R.iris(world, 'close');
  const wait = () => { if (R.irisClock >= 1.02) then(); else { R.stepFx(world); requestAnimationFrame(wait); } };
  requestAnimationFrame(wait);
}
function leaveRoom() {
  mode = 'transition'; touch.classList.add('hidden'); R.iris(world, 'close');
  const closed = () => {                                                  // 완전히 닫힌 검은 화면에서 남은 보상을 고른 뒤 다음 방
    const k = run.pending; run.pending = null;
    if (k === 'bossWon') return overlay('won');                          // 보스 포탈 → 격파 화면 → 단련 1점 → 다음 지역
    if (k === 'train') rewardScreen(goNext); else if (k === 'train1') rewardScreen(goNext, null, null, 1); else if (k === 'train2') rewardScreen(goNext, null, null, 1); else goNext();
  };
  const wait = () => { if (R.irisClock >= 1.02) closed(); else { R.stepFx(world); requestAnimationFrame(wait); } };
  requestAnimationFrame(wait);
}
// 휴식(모닥불 앞에서): 한 번만, 셋 중 하나. 상황에 따라 답이 달라지게 (다쳤으면 치료, 기름이 바닥이면 기름, 멀쩡하면 단련)
// 등불 다시 붙이기: 휴식방에서만 등불 속성을 바꿀 수 있다 (14 이상인 다른 스탯). 휴식 선택과 별개로 무료
// 이 지역 적들의 상성 (속성을 고를 때 참고): '약점 구울·나방 · 저항 창병'
function regionAff(el) {
  const g = regionOf(run); if (!g || !el) return '';
  const kinds = [...new Set([...g.enemies, g.boss])], pick = t => kinds.filter(k => (AFFINITY[k] || {})[t]?.includes(el)).map(nameOf).join('·');
  const wk = pick('weak'), rs = pick('resist');
  return [wk && `약점 ${wk}`, rs && `저항 ${rs}`].filter(Boolean).join(' · ') || '이 지역엔 상성 없음';
}
const attuneTargets = () => Object.keys(STAT_SPELL).filter(k => run.stats[k] >= 14 && k !== run.element);
function attuneScreen() {
  const p = world.player, list = attuneTargets();
  screen(`<div class="card wide"><h2>등불 다시 붙이기</h2><div class="quote">지금: ${run.element ? `${STAT_ELEMENT[run.element]} (${regionAff(run.element)})` : '각성 전'} — 어떤 불꽃으로 탈까</div><div class="picks">
    ${list.map(k => { const sp = elementSpell(run.stats, k, run.baseSpell), S = SPELLS[sp]; return `<button class="pick door t-${S.tone}" data-id="${k}"><div class="niche">${icon(S.icon, S.tone)}</div><b>${STAT_ELEMENT[k]} · ${ENCHANT[k].name}</b><span>${tierText(k, enchTier(run.stats, k))}</span><span class="aff">${regionAff(k)}</span></button>`; }).join('')}
    </div><div class="btns"><button class="btn alt" data-id="back">그대로 둔다</button></div></div>`);
  bindPicks(id => {
    if (id !== 'back' && STAT_SPELL[id]) { run.element = id; p.element = id; p.spells = [runSpell(run)]; p.enchantT = 0; hudKey = ''; R.say(`등불이 ${STAT_ELEMENT[id]}의 불꽃으로 탄다`); sfx.play('ignite'); }
    restScreen();
  });
}
// 등잔: 빛 조각을 부어 켠다 → ① 색 (칼과 빛이 그림자에게 하는 일) ② 빛 모양 둘 중 하나
function shrineScreen() {
  const p = world.player, o = world.props.find(q => q.kind === 'lamp' && Math.abs(q.x - (p.x + p.w / 2)) < 60);
  if (!o) return; if (o.lit) { R.say('이미 켜진 등잔이다'); return; }
  const cost = shrineCost(p);
  if ((p.shards || 0) < cost) { R.say(`꺼진 등잔 — 빛 조각 ${cost}개가 필요하다 (지금 ${p.shards || 0}) · 빛 속에서 처형하면 모인다`, 200); return; }
  mode = 'rest'; touch.classList.add('hidden');
  const colorCard = k => { const C = LAMP_COLORS[k]; return `<button class="pick door t-${C.tone}" data-id="${k}"><div class="niche">${icon(C.ic, C.tone)}</div><b>${C.name}${p.color === k ? ' (지금)' : ''}</b><span>빛: ${C.light}<br>칼: ${C.blade}</span></button>`; };
  screen(`<div class="card wide"><h2>등잔에 불을 붙인다</h2><div class="quote">빛 조각 ${cost}개를 붓는다 (남는 조각 ${p.shards - cost}) — 먼저 빛의 색을 고른다</div><div class="picks">${Object.keys(LAMP_COLORS).map(colorCard).join('')}</div>
    <div class="btns"><button class="btn alt" data-id="back">그만둔다</button></div></div>`);
  bindPicks(col => {
    if (col === 'back') { resume(); return; }
    const sh = shapeChoices(p);
    screen(`<div class="card wide"><h2>빛의 모양</h2><div class="quote">둘 중 하나 — 겹쳐 쌓인다</div><div class="picks">${sh.map(k => `<button class="pick door t-amber" data-id="${k}"><div class="niche">${icon('wick', 'amber')}</div><b>${LIGHT_SHAPES[k].name}</b><span>${LIGHT_SHAPES[k].desc}${(p.shapes || {})[k] ? ` (지금 ${(p.shapes || {})[k]})` : ''}</span></button>`).join('')}</div></div>`);
    bindPicks(shp => { lightShrine(world, o, col, shp); resume(); sfx.play('ignite'); R.say(`등잔이 켜졌다 — ${LAMP_COLORS[col].name}의 빛 · ${LIGHT_SHAPES[shp].name}`, 200); });
  });
}
function restScreen() {
  const p = world.player, fire = world.props.find(o => o.kind === 'campfire');
  if (fire.used) { R.say('불씨가 잦아들었다. 오른쪽 길로 나아가자'); return; }
  mode = 'rest'; touch.classList.add('hidden');
  const oilTo = Math.min(p.maxFlasks + 1, p.flasks + 1);
  screen(`<div class="card wide"><h2>작은 등불</h2><div class="quote">모닥불 곁에서 잠시 숨을 고른다 — 하나만 고를 수 있다</div>${runStat()}<div class="picks">
    <button class="pick door t-red" data-id="heal" ${p.hp >= p.maxHp ? 'disabled' : ''}><div class="niche">${icon('heart', 'red')}</div><b>몸을 추스른다</b><span>체력 가득 (${p.hp} → ${p.maxHp})</span></button>
    <button class="pick door t-heal" data-id="oil" ${oilTo <= p.flasks ? 'disabled' : ''}><div class="niche">${icon('flask', 'heal')}</div><b>기름을 짠다</b><span>기름병 +1 (${p.flasks} → ${oilTo})</span></button>
    ${CFG.legacy ? `<button class="pick door t-amber" data-id="train"><div class="niche">${icon('vigor', 'amber')}</div><b>검을 벼린다</b><span>단련 1점 (나갈 때)</span></button>` : ''}</div>
    <div class="btns">${CFG.legacy && attuneTargets().length ? '<button class="btn alt" data-id="attune">등불 다시 붙이기 (속성 변경)</button>' : ''}<button class="btn alt" data-id="back">그냥 지나간다</button></div></div>`);
  bindPicks(id => {
    if (id === 'attune') return attuneScreen();
    const hp0 = p.hp;
    if (id === 'heal') p.hp = p.maxHp; else if (id === 'oil') p.flasks = oilTo; else if (id === 'train') run.pending = 'train1';
    if (id !== 'back') fire.used = true;
    resume();
    if (id === 'heal') { R.healFx(p, p.hp - hp0, hp0); R.dir.events({ events: [{ type: 'heal' }], player: p, t: world.t }); sfx.play('heal'); }
    if (id === 'oil') { R.say(`기름병을 채웠다 (${p.flasks}개)`); sfx.play('heal'); }
    if (id === 'train') { R.say('검을 벼렸다 — 나가면 단련 1점'); sfx.play('click'); }
  });
}
// 상점(상인 앞에서): 매번 다른 물건 몇 가지. 물건마다 한 번만, 기름병은 살수록 비싸짐 → 불씨로 다 살 수는 없다 (고르는 재미)
const WARES = {
  flask:  { name: '기름병', tone: 'heal', ic: 'flask', desc: p => `기름병 +1 (지금 ${p.flasks})`, price: r => 35 + 15 * (r.flaskBuys || 0) },
  salve:  { name: '연고', tone: 'red', ic: 'heart', desc: p => `체력 +2 (${p.hp} → ${Math.min(p.maxHp, p.hp + 2)})`, price: r => 30 + 6 * r.region, ok: p => p.hp < p.maxHp },
  wick:   { name: '불쏘시개', tone: 'amber', ic: 'ember', desc: p => `스킬 게이지 가득 (${p.light | 0} → 100)`, price: r => 28 + 5 * r.region, ok: p => p.light < 100 },
  whet:   { name: '숫돌', tone: 'amber', ic: 'vigor', desc: () => '단련 1점 (나갈 때)', price: r => 70 + 15 * r.region, ok: () => run.pending !== 'train1' },
};
function shopStock(r) { r.flaskBuys = 0; return { wares: CFG.legacy ? ['flask', 'salve', 'wick', 'whet'] : ['flask', 'salve'], sold: [] }; }   // 각인은 팔지 않음 (소모품·단련만)
function shopScreen() {
  mode = 'shop'; touch.classList.add('hidden');
  const st = world.props.find(o => o.kind === 'merchant');
  st.stock = st.stock || shopStock(run);
  const p = world.player, S = st.stock;
  const ware = id => { const W = WARES[id], pr = W.price(run), sold = S.sold.includes(id), ok = !sold && run.embers >= pr && (!W.ok || W.ok(p));
    return `<button class="pick t-${W.tone}" data-id="w:${id}" ${ok ? '' : 'disabled'}><div class="niche">${icon(W.ic, W.tone)}</div><b>${W.name}${sold ? ' (팔림)' : ''}</b><span>${W.desc(p)}</span>${cost(pr)}</button>`; };
  screen(`<div class="card wide"><h2>떠돌이 상인</h2><div class="quote">"좋은 물건은 하나씩뿐이야. 잘 골라."</div>${runStat()}<div class="picks">
    ${S.wares.map(ware).join('')}
    </div><div class="btns"><button class="btn alt" data-id="leave">닫기</button></div></div>`);
  bindPicks(id => {
    if (id === 'leave') return resume();
    if (id.startsWith('w:')) {
      const k = id.slice(2), W = WARES[k], pr = W.price(run);
      if (S.sold.includes(k) || run.embers < pr || (W.ok && !W.ok(p))) return shopScreen();
      run.embers -= pr;
      if (k === 'flask') { p.flasks++; p.maxFlasks = Math.max(p.maxFlasks, p.flasks); run.flaskBuys = (run.flaskBuys || 0) + 1; if (run.flaskBuys >= 3) S.sold.push(k); }
      else { S.sold.push(k); if (k === 'salve') p.hp = Math.min(p.maxHp, p.hp + 2); else if (k === 'wick') p.light = 100; else if (k === 'whet') run.pending = 'train1'; }
      sfx.play('heal');
    }
    shopScreen();
  });
}

function overlay(kind) {
  mode = kind; touch.classList.add('hidden');
  if (kind === 'cleared') {
    // 방을 비우면 출구만 열린다. 보상(단련)은 출구로 나가 아이리스가 검게 닫힌 뒤 찍는다 (leaveRoom). 강적방도 1점
    world.rewarded = world.counted = true; run.pending = CFG.legacy ? (run.room === 'combat' ? 'train' : 'train2') : null; roomCleared(run);
    const fp = world.player, oilGot = fp.flasks < fp.maxFlasks; if (oilGot) fp.flasks++;   // 방을 비우면 기름병 1개 다시 채움
    addScore('room', 100);
    const sec = world.t / 60, par = world.par || 0, fast = par && sec <= par;
    const bonus = fast ? Math.round(200 * (1 - sec / par)) + 20 : 0;
    if (fast) { addScore('time', bonus); run.embers += 5; }
    resume(); R.say((fast ? `빠른 정리! ${Math.ceil(sec)}초 / 목표 ${par}초 · 점수 +${bonus} · 불씨 +5 — ` : '') + (oilGot ? '기름병 +1 · ' : '') + (CFG.legacy ? '출구가 열렸다 — 나가면 단련 1점' : '출구가 열렸다' + (world.props.some(o => o.kind === 'lamp' && !o.lit) ? ' · 꺼진 등잔이 있다' : '')), fast ? 240 : 150);
  } else if (kind === 'won') {
    saveFromWorld(run, world);
    const boss = regionOf(run).boss;
    if (practice) { screen(`<div class="card"><h2>연습 완료</h2><button class="btn" id="back">마을로</button></div>`); return bind('back', town); }
    bossesKilled.push(boss);
    if (run.noHitBoss && !save.records.noHitBosses.includes(boss)) save.records.noHitBosses.push(boss);
    run.noHitBoss = run.noHitBoss || false;
    if (advanceRegion(run)) {
      screen(`<div class="card intro"><div class="region">${ENEMY_DEFS[boss].name} 격파</div><h2>대등이 다시 켜졌다</h2><div class="line">체력이 모두 회복되었다. 더 깊은 곳으로.</div>${runStat()}<button class="btn" id="next">계속</button></div>`);
      bind('next', () => CFG.legacy ? rewardScreen(regionIntro, null, null, 1) : regionIntro());   // 보스 보상: 단련 1점 (점수는 늘 한 번에 1점)
    } else finish(true);
  } else if (kind === 'dead') {
    if (practice) { screen(`<div class="card"><h2>연습 실패</h2><button class="btn" id="again">다시</button><button class="btn alt" id="back">마을로</button></div>`); bind('again', play); return bind('back', town); }
    saveFromWorld(run, world); finish(false);
  } else if (kind === 'pause') {
    if (!CFG.legacy) {                                                    // 새 설계: 등불 성장만 보여 줌
      const p = world.player, sh = Object.entries(p.shapes || {}).map(([k, n]) => LIGHT_SHAPES[k].name + (n > 1 ? ' ×' + n : '')).join(' · ') || '없음';
      screen(`<div class="card">${runStat()}<h2>잠시 멈춤</h2><div class="quote">빛 조각 ${p.shards || 0} · 켠 등잔 ${p.shrinesLit || 0} · 다음 등잔 ${shrineCost(p)}</div>
        <div class="line">빛의 색: <b>${p.color ? LAMP_COLORS[p.color].name : '없음'}</b>${p.color ? ` — 빛: ${LAMP_COLORS[p.color].light} · 칼: ${LAMP_COLORS[p.color].blade}` : ''}</div>
        <div class="line">빛의 모양: ${sh}${p.bigLamp ? ` · 큰 등잔 ${p.bigLamp} (빛 +${15 * p.bigLamp}%)` : ''}</div>
        <div class="line" style="opacity:.75">등불 버튼: 탭 = 던지기 · 길게 = 조준 · 던진 뒤 탭 = 회수 · 그림자는 빛 안에서만 베인다</div>
        <div class="btns"><button class="btn" id="resume">계속</button><button class="btn alt" id="home">순례 포기</button></div></div>`);
      bind('resume', resume); bind('home', () => { saveFromWorld(run, world); finish(false); }); return;
    }
    screen(`<div class="card board pausecard">${runStat()}<div class="sboard"><div>${statGrid()}${spellMap()}</div>
      <div class="spanel"><h2>잠시 멈춤</h2>${enchantCard()}${resonanceBlock()}
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
function regionIntro() {                                                 // 새 지역: 버튼 없이 바로 들어가고, 화면에 지역 이름만 잠깐
  const g = regionOf(run), ch = CHALLENGES.find(c => c.id === run.challenge), first = g.id === 1;
  play();
  R.banner = { s: g.name, sub: `${g.id}번째 지역`, t: 170, dur: 170, y: 110 };
  if (first && ch) R.say(`${run.daily ? '오늘의 시련 · ' : ''}어둠 ${run.dark} · 이번 판 도전: ${ch.name}`, 220);
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
    if (ev.type === 'flurryStart' && navigator.vibrate) navigator.vibrate(20);
    if (ev.type === 'flurryHit') sfx.play(ev.k === 3 ? 'hit3' : 'swing');
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
      if (ev.type === 'interact') { sfx.play('click'); if (ev.kind === 'keeper') talk('keeper', town); else if (ev.kind === 'rack') practiceScreen(); else if (ev.kind === 'altar') prepScreen(); else if (ev.kind === 'board') recordsScreen(); else if (ev.kind === 'campfire') campMenu(); }
      if (ev.type === 'exit') { newPilgrimage(); irisThen(startPilgrimage); }   // 오른쪽 길 = 출발 (제단에서 고른 설정으로)
      continue;
    }
    if (ev.type === 'interact') { if (ev.kind === 'merchant') { if (run && !run.metMerchant) { run.metMerchant = true; talk('merchant', shopScreen); } else shopScreen(); } else if (ev.kind === 'campfire') restScreen(); else if (ev.kind === 'lamp') shrineScreen(); }
    if (ev.type === 'exit' && w.room === 'boss') { run.pending = 'bossWon'; leaveRoom(); return; }   // 보스 포탈
    if (ev.type === 'exit') { saveFromWorld(run, w); if (!w.counted) roomCleared(run); leaveRoom(); return; }
    if (ev.type === 'win') R.say(practice ? '포탈이 열렸다 — 들어가면 마을로' : '포탈이 열렸다 — 들어가면 다음 지역으로', 240);
    if (ev.type === 'bossDying') { slowT = 0; if (navigator.vibrate) navigator.vibrate([80, 60, 160]); }
    if (ev.type === 'bossFall') { sfx.play('slam'); sfx.play('ult'); }
    if (ev.type === 'bellRelease') sfx.play('telegraph');
    if (ev.type === 'bellTrap' || ev.type === 'bellMiss') sfx.play('slam');
    if (ev.type === 'veilBreak' || ev.type === 'mirrorReflect') sfx.play('execute');
    if (ev.type === 'veilUp') sfx.play('heal');
    if (ev.type === 'beaconLit') sfx.play('ignite');
    if (ev.type === 'phase2') { sfx.play('slam'); sfx.play('ult'); slowT = 50; if (navigator.vibrate) navigator.vibrate([60, 40, 120]); }
    if (ev.type === 'debris') sfx.play('telegraph');
    if (ev.type === 'snuff') sfx.play('roll'); if (ev.type === 'relight') sfx.play('click'); if (ev.type === 'flash') sfx.play('ignite');   // 소등 · 다시 켜기 · 섬광
    if (ev.type === 'steam') sfx.play('roll'); if (ev.type === 'quench' || ev.type === 'chainsBroken') sfx.play('execute'); if (ev.type === 'heatUp' || ev.type === 'anchorRise') sfx.play('ignite'); if (ev.type === 'anchorHit') sfx.play(ev.broke ? 'slam' : 'hit');
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
  checkViewport();
  try { frameBody(now); } catch (e) { console.error(e); }   // 한 프레임의 에러가 게임 전체를 멈추지 않게
  requestAnimationFrame(frame);
}
function frameBody(now) {
  const dt = now - last; last = now;
  if (mode === 'title' && input.take('confirm')) town();
  if (mode === 'town' && world && world.town) {                          // 마을 걷기
    if (input.take('confirm')) { newPilgrimage(); irisThen(startPilgrimage); }
    else if (input.take('pause')) campMenu();
    else if (!R.irisBusy()) {
      acc = stepLoop(acc, dt, () => { tick(world, input.read()); onEvents(world); R.spawnFx(world); R.stepFx(world); if (TOUCH) syncTouch();
        if (!world.enemies.length) townDummy(world); for (const e of world.enemies) { e.cd = 1e9; e.poiseRegenT = 0; } });
    } else R.stepFx(world);
  }
  if (mode === 'play' && deathT) {                                     // 사망 연출: 세계는 멈추고 리라 쓰러짐 → 등불이 꺼짐 → 결과
    deathT += dt / (1000 / CFG.TICK); world.player.stateT = Math.floor(deathT); R.death = deathT; R.stepFx(world);
    { const pl = world.player, gy = groundAt(world, pl.x, pl.w); if (pl.y + pl.h < gy) pl.y = Math.min(gy - pl.h, pl.y + 6); }   // 공중에서 죽으면 바닥까지 떨어져 쓰러짐
    if (deathT > DEATH_F) { deathT = 0; R.death = 0; overlay('dead'); }
  } else if (mode === 'play') {
    if (input.take('pause')) overlay('pause');
    else {
      if (R.irisBusy() || R.stepCine()) { R.stepFx(world); acc = 0; touch.classList.add('hidden'); world.wasCine = true; }   // 아이리스·보스 등장 연출 동안은 세계 정지, 버튼 숨김
      else {
        if (world.wasCine) { world.wasCine = false; showTouch(); if (run && run.room === 'boss' && !world.hinted) { world.hinted = true; const b = world.enemies.find(e => e.boss); if (b && GIMMICK_HINT[b.kind]) R.say(GIMMICK_HINT[b.kind], 360); } }   // 보스 기믹 힌트
        const rate = world.bossDeath && world.bossDeath.t < 120 ? 0.4 : world.player.state === 'execute' && !world.hitstop ? CFG.execute.slow :   // 보스 사망: 슬로모션
           slowT > 0 && !world.hitstop ? 0.45 : 1;   // 처형 중 슬로모션, 완벽 패링 직후 잠깐 슬로
        acc = stepLoop(acc, dt * rate, step); tutTick();
      }
      if (world.over && !deathT) { deathT = 1; touch.classList.add('hidden'); sfx.stopMusic && sfx.stopMusic(); }   // 사망 연출 시작
      else if (world.cleared && !world.rewarded) overlay('cleared');
    }
  } else if (mode === 'pause' && input.take('pause')) resume();
  else if (mode !== 'play' && mode !== 'title' && input.take('confirm')) document.querySelector('#ui .btn, #ui .pick')?.dispatchEvent(new PointerEvent('pointerup'));
  R.draw(world);
  }

$('#b-pause').addEventListener('pointerup', () => mode === 'play' ? overlay('pause') : mode === 'town' && campMenu());
addEventListener('resize', () => R.resize());
// 폰: 회전·주소창 접힘 뒤에 resize가 늦거나 빠지는 경우가 있어 화면 크기가 바뀌면 매 프레임 다시 맞춤 (검은 띠·찌그러짐 방지)
if (window.visualViewport) visualViewport.addEventListener('resize', () => R.resize());
addEventListener('orientationchange', () => setTimeout(() => R.resize(), 250));
let lastVP = '';
function checkViewport() { const k = innerWidth + 'x' + innerHeight; if (k !== lastVP) { lastVP = k; R.resize(); } }
// 전투 중 세로로 돌리면 일시정지 (안내 화면 뒤에서 싸움이 계속되지 않게)
const portrait = matchMedia('(orientation: portrait) and (pointer: coarse)');
portrait.addEventListener('change', () => { if (portrait.matches && mode === 'play') overlay('pause'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') overlay('pause'); });
touch.addEventListener('contextmenu', e => e.preventDefault());

sfx.on = save.settings.sound; sfx.musicOn = save.settings.music;
title();
requestAnimationFrame(frame);
