// 스탯 6종 = 반대 스탯 3쌍. 판마다 모두 10에서 시작, 0~20 (쌍의 합 20).
// 단련: 한 쌍에서 한쪽을 +1 하면 반대쪽이 -1 (쌍의 합은 늘 10). 7·10에서 능력, 3 이하에서 약점
export const STAT_MIN = 0, STAT_MAX = 20, STAT_START = 10;
export const T_ABILITY = 14, T_MASTER = 20, T_WEAK = 6;   // 능력 구간 · 극의 · 약점

// tiers: 12·14·16·18·20에서 열리는 능력 / weak: 6 이하·3 이하 약점 (값 이하이면 붙음)
export const STATS = [
  { id: 'str', name: '힘', icon: 'sword', tone: 'ember', per: '점마다 공격 피해 ±6%',
    tiers: [[12, '처형 피해 +25%'], [14, '3타에 검기가 나간다'], [16, '3타 자세 피해 2배'], [18, '공격 범위 +25%'], [20, '처형하면 주변 적 자세 +40%']],
    weak: [[6, '공격 후딜 +4프레임'], [3, '공격 피해 추가 -15%']] },
  { id: 'agi', name: '민첩', icon: 'roll', tone: 'moon', per: '점마다 이동·구르기 ±3%, 2점마다 무적 ±1프레임',
    tiers: [[12, '이동 속도 +8%'], [14, '구르기 후딜 없음 (연속 구르기)'], [16, '구르기 무적 +2프레임'], [18, '공중 점프 1회'], [20, '구르기 직후 첫 공격이 치명타']],
    weak: [[6, '구르기 후딜 +6프레임'], [3, '이동 속도 -10%']] },
  { id: 'wil', name: '의지', icon: 'parry', tone: 'amber', per: '2점마다 완벽 패링 ±1프레임, 점마다 자세 피해 ±6%',
    tiers: [[12, '일반 패링도 빛 +5 더'], [14, '완벽 패링한 적이 1.5배 오래 무방비'], [16, '일반 패링도 완벽 패링만큼 자세 피해'], [18, '그로기 시간 +50%'], [20, '모든 패링이 완벽 판정']],
    weak: [[6, '헛 패링 후딜 +6프레임'], [3, '완벽 패링 판정 추가 -1프레임']] },
  { id: 'lmp', name: '등불', icon: 'ult', tone: 'amber', per: '점마다 마법 피해 ±7.5%, 빛 획득 ±5%',
    tiers: [[12, '두르기 빛 -10%'], [14, '두르기 시간 +50%'], [16, '두르는 동작 중 무적'], [18, '두르기 빛 -20% (12와 합쳐 -20%)'], [20, '처치할 때마다 빛 +15']],
    weak: [[6, '두르기 빛 +25%'], [3, '빛 획득 추가 -20%']] },
  { id: 'vit', name: '생명', icon: 'heart', tone: 'red', per: '2점마다 최대 체력 ±1',
    tiers: [[12, '기름병을 30% 빨리 마신다'], [14, '기름병 회복 +1'], [16, '새 방에 들어갈 때 체력 1 회복'], [18, '맞은 뒤 무적 시간 +50%'], [20, '기름병 +1개']],
    weak: [[6, '기름병 회복 -1'], [3, '기름병 -1개']] },
  { id: 'fury', name: '투지', icon: 'afterglow', tone: 'ember', per: '10 넘는 점마다 치명타 확률 +3%',
    tiers: [[12, '치명타 피해 2.5배'], [14, '적을 쓰러뜨리면 다음 공격이 치명타'], [16, '치명타가 나면 빛 +10'], [18, '체력 절반 이하일 때 치명타 확률 +20%'], [20, '치명타 피해 3배']],
    weak: [[6, '처형 피해 -30%'], [3, '공격 피해 추가 -10%']] },
];
export const STAT_BY_ID = Object.fromEntries(STATS.map(s => [s.id, s]));
// 반대 스탯 쌍: 묵직함↔날렵함, 막기↔마법, 버티기↔몰아치기
export const PAIRS = [['str', 'agi'], ['wil', 'lmp'], ['vit', 'fury']];
export const OPP = Object.fromEntries(PAIRS.flatMap(([a, b]) => [[a, b], [b, a]]));

export const startStats = () => Object.fromEntries(STATS.map(s => [s.id, STAT_START]));
export const clampStat = v => Math.max(STAT_MIN, Math.min(STAT_MAX, Math.round(v)));
// 구간: 'low' | 'mid' | 't7' | 't10'

// 단련: up +1, 반대 스탯 -1. 이미 끝(20)이면 아무 일도 없음
export const canTrain = (stats, up) => stats[up] < STAT_MAX && stats[OPP[up]] > STAT_MIN;
export function train(stats, up) {
  if (!canTrain(stats, up)) return stats;
  stats[up] += 1; stats[OPP[up]] -= 1;
  return stats;
}

// 스탯 → 리라 보정값 (p.mods에 합쳐짐)
export function statMods(s) {
  const d = k => (s[k] - STAT_START) / 2, at = (k, n) => s[k] >= n, lo = (k, n) => s[k] <= n;   // d: 2점 = 예전 1단계
  return {
    atkMul: Math.max(0.4, 1 + 0.12 * d('str')) * (lo('str', 3) ? 0.85 : 1) * (lo('fury', 3) ? 0.9 : 1), atkLag: lo('str', 6) ? 4 : 0,
    execBonus: at('str', 12) ? 1.25 : 1, str7: at('str', 14), str3Poise: at('str', 16) ? 2 : 1, rangeMul: at('str', 18) ? 1.25 : 1, str10: at('str', 20),
    speedMul: (1 + 0.06 * d('agi')) * (at('agi', 12) ? 1.08 : 1) * (lo('agi', 3) ? 0.9 : 1), rollStat: 1 + 0.06 * d('agi'),
    rollI: Math.trunc(d('agi')) + (at('agi', 16) ? 2 : 0), rollLag: lo('agi', 6) ? 6 : at('agi', 14) ? -6 : 0, airJump: at('agi', 18) ? 1 : 0, agi10: at('agi', 20),
    poiseMul: Math.max(0.4, 1 + 0.12 * d('wil')), perfectExtra: Math.trunc(d('wil')) - (lo('wil', 3) ? 1 : 0), parryLight: at('wil', 12) ? 5 : 0,
    staggerMul: at('wil', 14) ? 1.5 : 1, normalAsPerfect: at('wil', 16), stunMul: at('wil', 18) ? 1.5 : 1, allPerfect: at('wil', 20), whiffLag: lo('wil', 6) ? 6 : 0,
    spellMul: Math.max(0.4, 1 + 0.15 * d('lmp')), lightStat: Math.max(0.5, 1 + 0.1 * d('lmp')) * (lo('lmp', 3) ? 0.8 : 1),
    costMul: lo('lmp', 6) ? 1.25 : at('lmp', 18) ? 0.8 : at('lmp', 12) ? 0.9 : 1, lmp7: at('lmp', 14), enchDur: at('lmp', 14) ? 1.5 : 1, spellInv: at('lmp', 16), lmp10: at('lmp', 20),
    hpBonus: Math.trunc(d('vit')), flaskSpeed: at('vit', 12) ? 0.7 : 1, flaskBonus: at('vit', 14) ? 1 : lo('vit', 6) ? -1 : 0, roomHeal: at('vit', 16),
    hurtIMul: at('vit', 18) ? 1.5 : 1, flaskCount: (at('vit', 20) ? 1 : 0) - (lo('vit', 3) ? 1 : 0),
    critChance: Math.max(0, 0.06 * d('fury')), critMul: at('fury', 20) ? 3 : at('fury', 12) ? 2.5 : 2, killCrit: at('fury', 14), critLight: at('fury', 16) ? 10 : 0,
    lowHpCrit: at('fury', 18) ? 0.2 : 0, furyExec: lo('fury', 6) ? 0.7 : 1,
    res: Object.fromEntries(resonancesOf(s).map(r => [r.id, true])),   // 공명
  };
}
// 지금 열린 능력·붙은 약점 / 다음 능력까지
export const tiersOn = (st, v) => st.tiers.filter(([n]) => v >= n);
export const weakOn = (st, v) => st.weak.filter(([n]) => v <= n);
export const nextTier = (st, v) => st.tiers.find(([n]) => v < n) || null;

// 공명: 서로 다른 쌍의 두 스탯이 모두 14 이상이면 열리는 조합 특성 (쌍 3개 → 조합 12개)
export const RESONANCES = [
  { id: 'riposte',  a: 'str', b: 'wil',  name: '철벽 반격', desc: '완벽 패링 직후 다음 공격 피해 +60%' },
  { id: 'emberEdge',a: 'str', b: 'lmp',  name: '불꽃 칼날', desc: '3타가 적에게 화상 (3초간 초당 3)' },
  { id: 'grit',     a: 'str', b: 'vit',  name: '버팀', desc: '체력이 최대의 1/3 이하면 공격 피해 +40%' },
  { id: 'slayer',   a: 'str', b: 'fury', name: '처단', desc: '처형하면 빛 +30, 다음 공격 치명타' },
  { id: 'deflect',  a: 'agi', b: 'wil',  name: '흘려 막기', desc: '구르기로 공격을 흘리면 빛 +15' },
  { id: 'emberStep',a: 'agi', b: 'lmp',  name: '잔불 걸음', desc: '구르기가 끝날 때 작은 유도 불씨를 쏜다 (피해 8)' },
  { id: 'enduring', a: 'agi', b: 'vit',  name: '질긴 걸음', desc: '기름병을 마시는 동안 제 속도로 움직인다' },
  { id: 'gale',     a: 'agi', b: 'fury', name: '질풍', desc: '구르기 직후 첫 공격 치명타 확률 +35%' },
  { id: 'aegis',    a: 'wil', b: 'vit',  name: '수호', desc: '방마다 한 번, 맞을 피해를 막는다' },
  { id: 'retribute',a: 'wil', b: 'fury', name: '응징', desc: '완벽 패링하면 다음 공격이 치명타' },
  { id: 'warmLamp', a: 'lmp', b: 'vit',  name: '따스한 등불', desc: '불꽃 두르기 3번마다 체력 1 회복' },
  { id: 'wildfire', a: 'lmp', b: 'fury', name: '폭주 등불', desc: '속성 폭발 마법도 치명타가 난다 (투지 치명타 확률·배율 적용)' },
];
export const resonancesOf = s => RESONANCES.filter(r => s[r.a] >= T_ABILITY && s[r.b] >= T_ABILITY);
// 극의: 20에 도달한 스탯의 칭호
export const MASTERY = { str: '파쇄자', agi: '그림자', wil: '철의 의지', lmp: '등불 현자', vit: '불굴', fury: '광전사' };
// 지금 수치 (구체적인 값). 화면에 '공격 피해 112%'처럼 보여 줌
export function statNumbers(id, v) {
  const d = (v - STAT_START) / 2, t = Math.trunc(d), pct = x => Math.round(x * 100) + '%';
  switch (id) {
    case 'str': return `공격 피해 ${pct(Math.max(0.4, 1 + 0.12 * d))}`;
    case 'agi': return `이동·구르기 ${pct(1 + 0.06 * d)}, 구르기 무적 ${12 + t}프레임`;
    case 'wil': return `완벽 패링 ${Math.min(12, Math.max(2, 6 + t))}프레임, 자세 피해 ${pct(Math.max(0.4, 1 + 0.12 * d))}`;
    case 'lmp': return `마법 피해 ${pct(Math.max(0.4, 1 + 0.15 * d))}, 빛 획득 ${pct(Math.max(0.5, 1 + 0.1 * d))}`;
    case 'vit': return `최대 체력 ${Math.max(1, 5 + t)}`;
    case 'fury': return `치명타 확률 ${Math.round(Math.max(0, 6 * d))}%, 치명타 ${v >= 20 ? 3 : v >= 12 ? 2.5 : 2}배`;
  }
  return '';
}
