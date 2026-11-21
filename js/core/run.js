// 한 판(런)의 진행: 서약 → 방 → 각인 → 문 선택 → … → 보스. 순수 로직 (DOM 없음)
import { CFG } from './config.js?v=mwqhrbhm';
import { createWorld } from './world.js?v=mwqhrbhm';
import { ELITE_MODS, ENEMY_DEFS } from './enemies.js?v=mwqhrbhm';
import { startStats, statMods, train } from './stats.js?v=mwqhrbhm';
import { OIL_SPELL, OIL_EL, spellFor, elementSpell, awakenPick } from './spells.js?v=mwqhrbhm';
import { populateArena, parTime } from './level.js?v=mwqhrbhm';

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

// 스테이지 순서는 정해져 있다 (고르지 않음). 상점·휴식도 걸어 들어가는 스테이지
const ROUTE = ['combat', 'combat', 'rest', 'elite', 'shop', 'boss'];
const SHORT_ROUTE = ['combat', 'rest', 'boss'];     // 지역 1 단축 (종지기 3회 처치 후)
// 지역 6곳. 지역마다 적 구성·보스·배경·체력 배수가 다르다
export const REGIONS = [
  { id: 1, name: '이끼 묘지', bg: 'bg1', enemies: ['ghoul', 'moth'], boss: 'bellBoss', route: ROUTE, hp: 1.0 },
  { id: 2, name: '침수 대성당', bg: 'bg2', enemies: ['spearman', 'priest', 'ghoul'], boss: 'saint', route: ROUTE, hp: 1.3 },
  { id: 3, name: '유리 광산', bg: 'bg3', enemies: ['shellguard', 'moth', 'spearman'], boss: 'spider', route: ROUTE, hp: 1.6 },
  { id: 4, name: '꺼진 태양의 심연', bg: 'bg4', enemies: ['assassin', 'shellguard', 'priest'], boss: 'shadow', route: ROUTE, hp: 2.0 },
  { id: 5, name: '잿불 용광로', bg: 'bg5', enemies: ['shellguard', 'spearman', 'assassin'], boss: 'forge', route: ROUTE, hp: 2.4 },
  { id: 6, name: '별 없는 왕좌', bg: 'bg6', enemies: ['assassin', 'priest', 'shellguard', 'spearman'], boss: 'king', route: ['combat', 'rest', 'elite', 'shop', 'boss'], hp: 2.8 },
];

// 이번 판 도전 (출발 시 1개)
export const CHALLENGES = [
  { id: 'perfect30', name: '완벽 패링 30회', test: r => r.perfect >= 30 },
  { id: 'exec3', name: '처형 3회', test: r => r.executes >= 3 },
  { id: 'nohitBoss', name: '보스를 맞지 않고 쓰러뜨리기', test: r => r.noHitBoss },
  { id: 'noFlask', name: '기름병 없이 지역 하나 돌파', test: r => r.noFlaskRegion },
];

export const ROOM_TYPES = {
  combat: { name: '전투', icon: '⚔' }, elite: { name: '엘리트', icon: '☠' },
  rest: { name: '휴식', icon: '🕯' }, shop: { name: '상점', icon: '⚖' }, boss: { name: '보스', icon: '🔔' },
};

// opts: { dark: 어둠 단계 0~10, pool: 해금된 각인 목록, oil, shortcut: 지역1 단축, daily }
export function newRun(seed = (Math.random() * 1e9) | 0, opts = {}) {
  const r = { seed, rng: seed >>> 0 || 1, region: 1, roomIdx: 0, length: 6, relics: [], oath: null,
    embers: 0, hp: null, flasks: null, room: 'combat', perfect: 0, executes: 0, kills: 0, t: 0, score: 0, scoreLog: {}, tutorial: !!opts.tutorial,
    dark: opts.dark || 0, pool: opts.pool || Object.keys(RELICS), oil: opts.oil || 'refined', daily: !!opts.daily,
    stats: startStats(), element: null, baseSpell: OIL_SPELL[opts.oil || 'refined'] || 'bolt', lastUp: null, shortcut: !!opts.shortcut, noHitBoss: false, noFlaskRegion: false, regionFlasksUsed: 0, shards: 0, done: [] };
  r.variants = REGIONS.map(() => null);
  for (const g of REGIONS) { const v = ENEMY_DEFS[g.boss].variants; r.variants[g.id - 1] = v[(rand(r) * v.length) | 0]; }
  r.challenge = CHALLENGES[(rand(r) * CHALLENGES.length) | 0].id;
  setRegion(r, 1);
  return r;
}

export function setRegion(r, id) {
  r.region = id; r.roomIdx = 0; r.regionFlasksUsed = 0;
  const g = REGIONS[id - 1];
  r.route = id === 1 && r.shortcut ? SHORT_ROUTE : g.route;
  r.length = r.route.length;
}
// 지금 스테이지 종류
export const stageOf = r => r.route[Math.min(r.roomIdx, r.route.length - 1)];
// 다음 스테이지로 (정해진 순서)
export function nextStage(r) { r.room = stageOf(r); return r.room; }

// 보스 격파 후: 다음 지역으로 (체력 전부 회복). 마지막이면 false
export function advanceRegion(r) {
  if (r.regionFlasksUsed === 0) r.noFlaskRegion = true;
  r.shards += 3;
  if (r.region >= REGIONS.length) return false;
  setRegion(r, r.region + 1); r.hp = null; r.flasks = null; r.room = 'combat';   // 새 지역: 체력·기름병 가득
  return true;
}

export const regionOf = r => REGIONS[r.region - 1];
export const challengeDone = r => CHALLENGES.find(c => c.id === r.challenge).test(r);

export function chooseOath(r, id) {
  const o = OATHS.find(o => o.id === id); r.oath = id;
  if (o && !r.relics.includes(o.start)) r.relics.push(o.start);
}

// 각인 3택1: 가진 것 제외, 서약과 같은 계열은 3배 확률
// 단련: up +1, 반대 스탯 -1 (스탯 찍기 화면에서 한 점씩)
export function takeTrain(r, up) { train(r.stats, up); r.lastUp = up; }
// 지금 빌드가 쓰는 마법
export const runSpell = r => elementSpell(r.stats, r.element, r.baseSpell);   // 지금 '풀기' 마법
// 단련 뒤: 아직 각성 전이고 14 이상 스탯이 생기면 그 속성으로 각성 (새로 각성했으면 속성 키를 돌려줌)
export function awaken(r) { if (r.element) return null; const el = awakenPick(r.stats, r.lastUp); if (el) r.element = el; return el; }

// 스탯 보정 적용 (각인 보정 뒤에 합침)
export function applyStats(p, stats) {
  const m = statMods(stats);
  p.stats = { ...stats };
  p.mods = { ...p.mods, ...m, lightMul: p.mods.lightMul * m.lightStat, rollMul: p.mods.rollMul * m.rollStat, iExtra: p.mods.iExtra + m.rollI, airJumps: (p.mods.airJumps || 0) + m.airJump };
  p.maxHp = Math.max(1, p.maxHp + m.hpBonus); p.maxFlasks += m.flaskCount;
}

export function relicOffer(r, n = 3) {
  const pool = Object.keys(RELICS).filter(k => !r.relics.includes(k) && r.pool.includes(k));
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
export function enterRoom(r, type) { r.room = type; }

export function roomCleared(r) {
  r.embers += r.room === 'elite' ? 20 : r.room === 'combat' ? 10 : 0;
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
// 전투방 지형 생성 (시드 고정): 방 길이 · 언덕(1~2단, 한 단 36px = 점프로 오름, 적은 뛰어오름) · 발판(낮은 층/높은 층)
// 규칙: 시작 지점(0~260)은 평지, 높은 발판은 아래에 디딤(언덕·낮은 발판)이 있을 때만 → 항상 올라갈 수 있다
export function genArena(r) {
  const R = () => rand(r), W = [1120, 1280, 1440, 1600][(R() * 4) | 0];
  const solids = [{ x: -40, y: 0, w: 40, h: 360 }, { x: W, y: 0, w: 40, h: 360 }, { x: -40, y: 300, w: W + 80, h: 60 }];
  const hills = [];
  let x = 300 + ((R() * 120) | 0);
  while (x < W - 260 && hills.length < 3) {
    if (R() < 0.55) {
      const hw = 160 + ((R() * 200) | 0), tier2 = hw > 260 && R() < 0.5;
      hills.push({ x, w: hw, top: tier2 ? 228 : 264 });
      solids.push({ x, y: 264, w: hw, h: 96 });
      if (tier2) solids.push({ x: x + 60, y: 228, w: hw - 120, h: 132 });
      x += hw + 140 + ((R() * 160) | 0);
    } else x += 180 + ((R() * 160) | 0);
  }
  const plats = [], baseAt = (x, w) => Math.max(...solids.filter(o => o.y < 300 && o.y > 180 && x + 10 > o.x && x + w - 10 < o.x + o.w).map(o => o.y), 0) || 300;   // 발판 전체 아래가 같은 높이일 때만 그 높이
  let px = 220 + ((R() * 120) | 0);
  while (px < W - 200) {
    const pw = 100 + ((R() * 90) | 0), prev = plats[plats.length - 1];
    const base = baseAt(px, pw), under = base < 300;
    let y = base - 96 - ((R() * 12) | 0);                                   // 낮은 층: 바닥에서 바로 점프 (머리 위로 넉넉히, 점프 112로 닿음)
    if (under) y = base - 96 - ((R() * 8) | 0);                            // 언덕 위: 언덕에서 점프해 닿는 높이 (더 높은 층)
    else if (prev && prev.y > 200 && R() < 0.45) {                          // 낮은 발판 바로 옆에 붙여 높은 층 (계단)
      px = prev.x + prev.w + 30 + ((R() * 40) | 0);
      y = Math.max(96, prev.y - 56 - ((R() * 12) | 0));
    }
    plats.push({ x: px, y, w: pw, h: 8 });
    px += pw + 90 + ((R() * 200) | 0);
  }
  solids.push(...plats.map(s => ({ ...s, oneWay: true })));
  return { width: W, solids, bgOff: (R() * 3000) | 0 };
}


export function buildRoomWorld(r) {
  const type = r.room, g = regionOf(r);
  const hpMul = g.hp * (1 + 0.08 * r.dark);                     // 어둠 단계마다 적 체력 +8%
  let w;
  if (type === 'boss') w = createWorld({ room: 'boss', boss: g.boss, variant: r.variants[r.region - 1], hpMul });
  else if (type === 'shop' || type === 'rest') {                 // 쉼터: 적 없음. 가운데 상인/모닥불, 오른쪽 끝 출구
    const W = 960;
    w = createWorld({ room: 'haven', width: W, solids: [{ x: -40, y: 0, w: 40, h: 360 }, { x: W, y: 0, w: 40, h: 360 }, { x: -40, y: 300, w: W + 80, h: 60 }] });
    w.haven = type;
    w.props = [{ kind: type === 'shop' ? 'merchant' : 'campfire', x: 480, used: false }, { kind: 'exit', x: W - 200 }];
  } else {
    const A = genArena(r);
    w = createWorld({ room: 'arena', solids: A.solids, width: A.width, hpMul });
    w.props = [{ kind: 'exit', x: A.width - 200, locked: true }];      // 출구: 적을 다 잡으면 열림 (오른쪽 끝 버튼 아래에 가리지 않게 안쪽으로)
    w.bgOff = A.bgOff;
    const lvl = r.roomIdx;                         // 뒤로 갈수록 적이 늘어난다
    const xs = () => 480 + ((rand(r) * (w.width - 600)) | 0);
    const kinds = g.enemies, mods = Object.keys(ELITE_MODS);
    const pick = () => kinds[(rand(r) * kinds.length) | 0];
    const wave = n => Array.from({ length: n }, () => [pick(), xs()]);
    w.waves = [wave(1 + (lvl > 2 ? 1 : 0)), wave(2)];                // 소울류: 적은 적게, 하나하나 단단하게 (방마다 3~4마리)
    if (r.tutorial && r.region === 1 && lvl === 0) { w.waves = [[['ghoul', 620]], [['ghoul', 760], ['moth', 900]]]; w.holdWaves = true; w.tutorial = true; }   // 첫 순례 첫 방: 튜토리얼 (적 적게, 준비되면 등장)
    if (lvl > 3 || r.dark >= 4) w.waves.push(wave(2));
    const mod = () => mods[(rand(r) * mods.length) | 0];
    if (r.dark >= 3 && rand(r) < 0.3) w.waves[1][0] = [w.waves[1][0][0], w.waves[1][0][1], 'elite', mod()];
    if (type === 'elite') { const m = w.width / 2; w.waves = [[[kinds[0], m, 'elite', mod()], [pick(), m + 220]], [[pick(), m - 80], [kinds[0], m + 140, 'elite', mod()]]]; }
    w.waveCount = w.waves.length;
    populateArena(w, r.region, lvl, () => rand(r), !!w.tutorial);
    w.par = w.tutorial ? 0 : parTime(w);                                // 방 목표 시간(초): 안에 정리하면 보너스 (튜토리얼은 없음)       // 항아리·가시·분출구·움직이는 발판·레버와 보물 상자 (지역이 깊을수록 많이)
  }
  const p = w.player;
  applyRelics(p, r.relics);
  applyStats(p, r.stats || startStats());
  p.spells = [runSpell(r)]; p.element = r.element || OIL_EL[r.oil] || null;
  const v = r.element ? r.stats[r.element] : 0; p.enchTier = !r.element ? 0 : v >= 20 ? 3 : v >= 17 ? 2 : v >= 14 ? 1 : 0;   // 점화 단계
  p.oil = r.oil;
  if (r.dark >= 5) p.maxFlasks = Math.max(1, p.maxFlasks - 1);   // 어둠 5+: 기름병 -1
  p.hp = r.hp == null ? p.maxHp : Math.min(r.hp, p.maxHp);
  p.flasks = r.flasks == null ? p.maxFlasks : r.flasks;
  p.light = Math.min(CFG.light.max, r.light || 0);                 // 스킬 게이지(빛)는 다음 방으로 이어짐
  p.enchantT = r.enchant && p.light >= CFG.enchant.swingCost ? 1 : 0;   // 점화한 상태도 다음 방·다음 지역으로 이어짐 (빛이 남아 있으면)
  if (p.mods.roomHeal && r.hp != null && p.hp < p.maxHp) { p.hp++; p.roomHealed = true; }   // 생명 16: 새 방 들어갈 때 체력 1
  return w;
}

// 방을 나갈 때 리라 상태를 런에 저장
export function saveFromWorld(r, w) {
  const p = w.player;
  r.regionFlasksUsed += p.flasksUsed || 0;
  r.hp = p.hp; r.flasks = p.flasks; r.light = p.light; r.enchant = p.enchantT > 0 && !p.enchLast ? 1 : 0; r.perfect += p.perfectParries; r.executes += p.executes || 0;
  if (r.room === 'boss' && w.won && !p.hurtCount) r.noHitBoss = true;
}
