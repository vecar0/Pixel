// 한 판(런)의 진행: 서약 → 방 → 각인 → 문 선택 → … → 보스. 순수 로직 (DOM 없음)
import { CFG } from './config.js';
import { createWorld } from './world.js';

// 결정적 난수 (런 상태에 저장)
export function rand(r) { r.rng = (r.rng * 1664525 + 1013904223) >>> 0; return r.rng / 4294967296; }

// 각인: 실력을 "다르게 표현"하게 하는 것 위주. tag는 서약과 맞으면 더 자주 나옴
export const RELICS = {
  echo:       { name: '반향',        tag: 'parry',   desc: '완벽 패링 시 앞으로 불꽃 검기를 날린다' },
  chain:      { name: '불씨 연쇄',   tag: 'parry',   desc: '완벽 패링마다 공격력 +10% (최대 5중첩, 맞으면 초기화)' },
  wick:       { name: '등불 심지',   tag: 'parry',   desc: '빛 게이지 획득 +50%' },
  afterglow:  { name: '잔광',        tag: 'dodge',   desc: '구르기로 공격을 흘리면 다음 공격이 치명타 (2배)' },
  shadow:     { name: '그림자 걸음', tag: 'dodge',   desc: '구르기 거리 +40%, 무적 +3프레임' },
  wings:      { name: '두 번째 날개', tag: 'dodge',  desc: '공중 점프 1회' },
  executioner:{ name: '처형자',      tag: 'execute', desc: '처형 피해 2배' },
  flame:      { name: '화염 칼날',   tag: 'execute', desc: '3타째 공격이 화상을 남긴다 (3초간 초당 3)' },
  vigor:      { name: '순례자의 인내', tag: 'any',   desc: '최대 체력 +1' },
  oil:        { name: '기름 주머니', tag: 'any',     desc: '기름병 +1' },
};

export const OATHS = [
  { id: 'parry',   name: '패링의 서약', desc: '막아내는 자. 반향을 들고 시작', start: 'echo' },
  { id: 'dodge',   name: '그림자의 서약', desc: '흘려내는 자. 그림자 걸음을 들고 시작', start: 'shadow' },
  { id: 'execute', name: '처형의 서약', desc: '끝내는 자. 처형자를 들고 시작', start: 'executioner' },
];

export const ROOM_TYPES = {
  combat: { name: '전투', icon: '⚔' }, elite: { name: '엘리트', icon: '☠' },
  rest: { name: '휴식', icon: '🕯' }, shop: { name: '상점', icon: '⚖' }, boss: { name: '보스', icon: '🔔' },
};

export function newRun(seed = (Math.random() * 1e9) | 0) {
  return { seed, rng: seed >>> 0 || 1, region: 1, roomIdx: 0, length: 6, relics: [], oath: null,
    embers: 0, hp: null, flasks: null, room: 'combat', perfect: 0, kills: 0, t: 0 };
}

export function chooseOath(r, id) {
  const o = OATHS.find(o => o.id === id); r.oath = id;
  if (o && !r.relics.includes(o.start)) r.relics.push(o.start);
}

// 각인 3택1: 가진 것 제외, 서약과 같은 계열은 3배 확률
export function relicOffer(r, n = 3) {
  const pool = Object.keys(RELICS).filter(k => !r.relics.includes(k));
  const out = [];
  while (out.length < n && pool.length) {
    const wts = pool.map(k => RELICS[k].tag === r.oath ? 3 : 1);
    let x = rand(r) * wts.reduce((a, b) => a + b, 0), i = 0;
    while ((x -= wts[i]) > 0) i++;
    out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
  }
  return out;
}

export function takeRelic(r, id) { if (RELICS[id] && !r.relics.includes(id)) r.relics.push(id); }

// 다음 방 문 2개 (보스 직전엔 보스 문 하나)
export function doorOffer(r) {
  if (r.roomIdx >= r.length - 1) return ['boss'];
  const bag = ['combat', 'combat', 'elite', 'rest', 'shop'];
  const a = bag[(rand(r) * bag.length) | 0];
  let b; do b = bag[(rand(r) * bag.length) | 0]; while (b === a);
  return [a, b];
}

export function enterRoom(r, type) { r.room = type; }

export function roomCleared(r) {
  r.embers += r.room === 'elite' ? 20 : 10;
  r.roomIdx++;
}

// 리라에게 각인 효과를 얹는다
export function applyRelics(p, relics) {
  const has = k => relics.includes(k);
  p.relics = new Set(relics);
  p.maxHp = CFG.player.hp + (has('vigor') ? 1 : 0);
  p.maxFlasks = CFG.flask.charges + (has('oil') ? 1 : 0);
  p.mods = {
    rollMul: has('shadow') ? 1.4 : 1, iExtra: has('shadow') ? 3 : 0, airJumps: has('wings') ? 1 : 0,
    execMul: has('executioner') ? 2 : 1, lightMul: has('wick') ? 1.5 : 1,
    echo: has('echo'), chain: has('chain'), afterglow: has('afterglow'), flame: has('flame'),
  };
}

// 방 배치 3종 (발판 위치만 다름)
const LAYOUTS = [
  [{ x: 340, y: 210, w: 150, h: 8 }, { x: 820, y: 210, w: 150, h: 8 }],
  [{ x: 520, y: 200, w: 220, h: 8 }],
  [{ x: 260, y: 220, w: 120, h: 8 }, { x: 600, y: 170, w: 120, h: 8 }, { x: 940, y: 220, w: 120, h: 8 }],
];

export function buildRoomWorld(r) {
  const type = r.room;
  let w;
  if (type === 'boss') w = createWorld({ room: 'boss' });
  else {
    const L = LAYOUTS[(rand(r) * LAYOUTS.length) | 0];
    const solids = [
      { x: -40, y: 0, w: 40, h: 360 }, { x: 1280, y: 0, w: 40, h: 360 }, { x: -40, y: 300, w: 1360, h: 60 },
      ...L.map(s => ({ ...s, oneWay: true })),
    ];
    w = createWorld({ room: 'arena', solids });
    const lvl = r.roomIdx;                         // 뒤로 갈수록 적이 늘어난다
    const xs = () => 480 + ((rand(r) * 700) | 0);
    const wave = n => Array.from({ length: n }, () => [rand(r) < 0.35 ? 'moth' : 'ghoul', xs()]);
    w.waves = [wave(2 + (lvl > 2 ? 1 : 0)), wave(2 + (lvl > 1 ? 1 : 0))];
    if (lvl > 3) w.waves.push(wave(3));
    if (type === 'elite') w.waves = [[['ghoul', 760, 'elite'], ['ghoul', 980]], [['moth', 700], ['ghoul', 900, 'elite']]];
  }
  const p = w.player;
  applyRelics(p, r.relics);
  p.hp = r.hp == null ? p.maxHp : Math.min(r.hp, p.maxHp);
  p.flasks = r.flasks == null ? p.maxFlasks : r.flasks;
  return w;
}

// 방을 나갈 때 리라 상태를 런에 저장
export function saveFromWorld(r, w) {
  r.hp = w.player.hp; r.flasks = w.player.flasks; r.perfect += w.player.perfectParries;
}
