// 영구 진행 (등대 마을): 등불 조각으로 "선택지"만 해금. 영구 스탯 강화는 없다 (기획서 10장)
export const SAVE_KEY = 'lantern-keeper-v1';
export const START_RELICS = ['echo', 'shadow', 'executioner', 'vigor', 'oil', 'chain'];
export const UNLOCKS = [
  { id: 'relic:wick', kind: 'relic', relic: 'wick', name: '각인: 등불 심지', cost: 4 },
  { id: 'relic:afterglow', kind: 'relic', relic: 'afterglow', name: '각인: 잔광', cost: 4 },
  { id: 'relic:wings', kind: 'relic', relic: 'wings', name: '각인: 두 번째 날개', cost: 6 },
  { id: 'relic:flame', kind: 'relic', relic: 'flame', name: '각인: 화염 칼날', cost: 6 },
  { id: 'oil:blue', kind: 'oil', oil: 'blue', name: '랜턴 기름: 청유', cost: 8, desc: '푸른 결계(5초간 모든 패링 완벽)로 시작' },
  { id: 'oil:black', kind: 'oil', oil: 'black', name: '랜턴 기름: 흑유', cost: 8, desc: '흑염 창(관통 광선)으로 시작' },
  { id: 'practice', kind: 'practice', name: '연습장', cost: 3, desc: '쓰러뜨린 보스와 다시 싸워 패턴을 익힌다' },
];
export const OILS = { refined: { name: '정제유', desc: '기본 마법: 등불 탄 (14 이상 스탯이 없을 때)' }, blue: { name: '청유', desc: '기본 마법: 푸른 결계 (14 이상 스탯이 없을 때)' }, black: { name: '흑유', desc: '기본 마법: 흑염 창 (14 이상 스탯이 없을 때)' } };
export const DARK_RULES = [
  '', '적 체력 +8%', '적 체력 +16%', '전투방에 엘리트 등장', '전투방 웨이브 +1', '기름병 -1',
  '적 체력 +48%', '적 체력 +56%', '적 체력 +64%', '적 체력 +72%', '적 체력 +80% · 최후의 어둠',
];

export function defaultSave() {
  return { shards: 0, unlocked: [], oil: 'refined', dark: 0, darkUnlocked: 0, bossKills: {}, cleared: false,
    records: { bestDark: -1, fastest: 0, perfectTotal: 0, runs: 0, wins: 0, noHitBosses: [], challenges: 0 },
    daily: {}, settings: { offsetMs: 0, sound: true, music: true } };
}

export const relicPool = s => [...START_RELICS, ...UNLOCKS.filter(u => u.kind === 'relic' && s.unlocked.includes(u.id)).map(u => u.relic)];
export const oilsOwned = s => ['refined', ...UNLOCKS.filter(u => u.kind === 'oil' && s.unlocked.includes(u.id)).map(u => u.oil)];

export function buy(s, id) {
  const u = UNLOCKS.find(u => u.id === id);
  if (!u || s.unlocked.includes(id) || s.shards < u.cost) return false;
  s.shards -= u.cost; s.unlocked.push(id); return true;
}

// 런 결과를 저장에 반영: 조각, 보스 기록, 어둠 단계 해금, 기록
export function recordRun(s, r, { won, bossesKilled = [] }) {
  s.records.runs++; s.records.perfectTotal += r.perfect;
  for (const b of bossesKilled) s.bossKills[b] = (s.bossKills[b] || 0) + 1;
  let gain = r.shards + bossesKilled.length * 2;
  if (r.challengeDone) { gain += 2; s.records.challenges++; }
  s.shards += gain;
  if (won) {
    s.records.wins++; s.cleared = true;
    s.records.bestDark = Math.max(s.records.bestDark, r.dark);
    s.darkUnlocked = Math.min(10, Math.max(s.darkUnlocked, r.dark + 1));
    if (!s.records.fastest || r.t < s.records.fastest) s.records.fastest = r.t;
  }
  return gain;
}

// 오늘의 시련: 날짜로 시드 고정 (모두 같은 서약·각인·수식어 순서)
export function dailySeed(date = new Date()) {
  const k = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  let h = k; h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return { key: String(k), seed: (h ^ (h >>> 16)) >>> 0 };
}
