// 스탯 6종 = 반대 스탯 3쌍. 판마다 모두 5에서 시작, 0~10.
// 단련: 한 쌍에서 한쪽을 +1 하면 반대쪽이 -1 (쌍의 합은 늘 10). 7·10에서 능력, 3 이하에서 약점
export const STAT_MIN = 0, STAT_MAX = 10, STAT_START = 5;

export const STATS = [
  { id: 'str', name: '힘', icon: 'sword', tone: 'ember', per: '점마다 공격 피해 ±12%',
    t7: '3타에 검기가 나간다', t10: '처형하면 주변 적 자세 +40%', low: '공격 후딜 +4프레임' },
  { id: 'agi', name: '민첩', icon: 'roll', tone: 'moon', per: '점마다 이동·구르기 ±6%, 무적 ±1프레임',
    t7: '구르기 후딜 없음 (연속 구르기)', t10: '구르기 직후 첫 공격이 치명타', low: '구르기 후딜 +6프레임' },
  { id: 'wil', name: '의지', icon: 'parry', tone: 'amber', per: '점마다 완벽 패링 판정 ±1프레임, 자세 피해 ±12%',
    t7: '완벽 패링한 적이 1.5배 오래 무방비', t10: '모든 패링이 완벽 판정', low: '헛 패링 후딜 +6프레임' },
  { id: 'lmp', name: '등불', icon: 'ult', tone: 'amber', per: '점마다 마법 피해 ±15%, 빛 획득 ±10%',
    t7: '등불 탄이 두 발', t10: '처치할 때마다 빛 +15', low: '마법 비용 +25%' },
  { id: 'vit', name: '생명', icon: 'heart', tone: 'red', per: '점마다 최대 체력 ±1',
    t7: '기름병 회복 +1', t10: '기름병 +1개', low: '기름병 회복 -1' },
  { id: 'fury', name: '투지', icon: 'afterglow', tone: 'ember', per: '5 넘는 점마다 치명타 확률 +6%',
    t7: '적을 쓰러뜨리면 다음 공격이 치명타', t10: '치명타 피해 3배', low: '처형 피해 -30%' },
];
export const STAT_BY_ID = Object.fromEntries(STATS.map(s => [s.id, s]));
// 반대 스탯 쌍: 묵직함↔날렵함, 막기↔마법, 버티기↔몰아치기
export const PAIRS = [['str', 'agi'], ['wil', 'lmp'], ['vit', 'fury']];
export const OPP = Object.fromEntries(PAIRS.flatMap(([a, b]) => [[a, b], [b, a]]));

export const startStats = () => Object.fromEntries(STATS.map(s => [s.id, STAT_START]));
export const clampStat = v => Math.max(STAT_MIN, Math.min(STAT_MAX, Math.round(v)));
// 구간: 'low' | 'mid' | 't7' | 't10'
export const tierOf = v => v >= 10 ? 't10' : v >= 7 ? 't7' : v <= 3 ? 'low' : 'mid';

// 단련: up +1, 반대 스탯 -1. 이미 끝(10)이면 아무 일도 없음
export const canTrain = (stats, up) => stats[up] < STAT_MAX && stats[OPP[up]] > STAT_MIN;
export function train(stats, up) {
  if (!canTrain(stats, up)) return stats;
  stats[up] += 1; stats[OPP[up]] -= 1;
  return stats;
}

// 스탯 → 리라 보정값 (p.mods에 합쳐짐)
export function statMods(s) {
  const d = k => s[k] - STAT_START, low = k => s[k] <= 3;
  return {
    atkMul: Math.max(0.4, 1 + 0.12 * d('str')), atkLag: low('str') ? 4 : 0, str7: s.str >= 7, str10: s.str >= 10,
    speedMul: 1 + 0.06 * d('agi'), rollStat: 1 + 0.06 * d('agi'), rollI: d('agi'), rollLag: low('agi') ? 6 : s.agi >= 7 ? -6 : 0, agi10: s.agi >= 10,
    poiseMul: Math.max(0.4, 1 + 0.12 * d('wil')), perfectExtra: d('wil'), staggerMul: s.wil >= 7 ? 1.5 : 1, allPerfect: s.wil >= 10, whiffLag: low('wil') ? 6 : 0,
    spellMul: Math.max(0.4, 1 + 0.15 * d('lmp')), lightStat: Math.max(0.5, 1 + 0.1 * d('lmp')), lmp7: s.lmp >= 7, lmp10: s.lmp >= 10, costMul: low('lmp') ? 1.25 : 1,
    hpBonus: d('vit'), flaskBonus: s.vit >= 7 ? 1 : low('vit') ? -1 : 0, flaskCount: s.vit >= 10 ? 1 : 0,
    critChance: Math.max(0, 0.06 * d('fury')), killCrit: s.fury >= 7, critMul: s.fury >= 10 ? 3 : 2, furyExec: low('fury') ? 0.7 : 1,
  };
}
