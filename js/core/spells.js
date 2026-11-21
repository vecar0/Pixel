// 등불 마법: 1칸. 어떤 마법을 쓰는지는 스탯 빌드가 정한다 (아래 spellFor). 빛 게이지를 소모
// 연출은 모두 pixelfx 마법 이펙트 (fx: 쓰는 이펙트). 수치는 config.js의 CFG.skill
export const SPELLS = {
  bolt:    { name: '등불 탄',   icon: 'ember',       tone: 'amber', fx: 'fire/fireball',            desc: '등불에서 불덩이를 쏜다. 가까운 적을 쫓아가 맞고 터진다' },
  lance:   { name: '얼음 창',   icon: 'sword',       tone: 'moon',  fx: 'ice/ice-lance',            desc: '얼음 창을 던진다. 적을 쫓아가며 여러 적을 꿰뚫는다' },
  pillar:  { name: '화염 기둥', icon: 'ult',         tone: 'ember', fx: 'fire/flame-pillar',        desc: '가장 가까운 적 발밑이 갈라지며 불기둥이 솟는다' },
  thunder: { name: '빛기둥', icon: 'afterglow', tone: 'amber', fx: 'holy/holy-pillar', desc: '가장 가까운 적 자리에 하늘에서 빛기둥이 꽂혀 자세를 크게 무너뜨린다' },
  stars:   { name: '고드름 비', icon: 'afterglow',   tone: 'moon',  fx: 'ice/icicle-fall',         desc: '앞쪽 넓은 땅에 고드름이 세 차례 쏟아져 여럿을 한꺼번에 친다' },
  meteor:  { name: '운석',      icon: 'ember',       tone: 'ember', fx: 'fire/meteor',              desc: '가장 가까운 적에게 운석이 떨어져 크게 폭발한다' },
  ring: { name: '귀화 고리', icon: 'ult', tone: 'void', fx: 'fire/fire-ring', desc: '리라 주변으로 검보랏빛 귀화가 퍼지고, 날아오던 적 탄을 모두 지운다' },
  ward: { name: '빛의 결계', icon: 'parry', tone: 'amber', fx: 'holy/divine-shield', desc: '금빛 결계가 몸을 감싸 주변 적을 밀쳐 내고, 5초 동안 모든 패링이 완벽 판정이 된다' },
  spear: { name: '귀화 창', icon: 'executioner', tone: 'void', fx: 'arcane/arcane-beam', desc: '등불의 귀화를 한 줄로 모아 앞으로 쏴, 일직선의 적을 모두 꿰뚫는다' },
  chain: { name: '연쇄 번개', icon: 'afterglow', tone: 'ember', fx: 'lightning/chain-lightning', desc: '앞쪽 가까운 적 셋에게 번개가 차례로 옮겨 간다' },
  blast: { name: '뇌전 폭발', icon: 'elite', tone: 'ember', fx: 'lightning/thunderclap', desc: '가장 가까운 적 자리에 벼락 덩어리가 떨어져 크게 터진다' },
  tornado: { name: '불꽃 회오리', icon: 'ult',       tone: 'ember', fx: 'fire/fire-tornado',        desc: '가장 가까운 적 자리에 불꽃 회오리가 일어 세 번 연달아 태운다' },
  spikes:  { name: '서리 가시', icon: 'roll',        tone: 'moon',  fx: 'ice/ice-spikes',           desc: '앞쪽 바닥을 따라 얼음 가시가 솟아 줄지어 선 적을 모두 찌른다' },
  smite: { name: '심판', icon: 'parry', tone: 'amber', fx: 'holy/smite', desc: '가장 가까운 적 머리 위로 빛의 망치가 떨어져 자세를 크게 무너뜨린다' },
  wisps: { name: '도깨비불', icon: 'ember', tone: 'void', fx: 'fire/fireball', desc: '등불에서 검보랏빛 도깨비불 셋이 흩어져 날아가 각자 가까운 적을 쫓는다' },
  thorns: { name: '가시 덩굴', icon: 'heart', tone: 'heal', fx: 'nature/thorns', desc: '앞쪽 바닥에서 가시 덩굴이 솟아 적을 찌르고 발을 묶는다 (자세 피해 큼)' },
  drain: { name: '흡전', icon: 'afterglow', tone: 'ember', fx: 'lightning/zap-hit', desc: '가장 가까운 적에게 전격을 꽂아 기운을 빨아들여, 맞히면 체력 1을 되찾는다' },
  heal: { name: '생명의 꽃', icon: 'heart', tone: 'heal', fx: 'nature/healing-bloom', desc: '발밑에 생명의 꽃이 피어 체력을 2 되찾는다' },
  sanctum: { name: '생명의 숲', icon: 'vigor', tone: 'heal', fx: 'nature/thorns', desc: '리라 양옆 바닥에서 덩굴이 솟아 주변 적을 치고, 꽃이 피어 체력을 1 되찾는다' },
};
// 스탯별 마법 속성: 같은 스탯의 마법 셋은 모두 같은 속성 (이펙트 색·종류가 통일)
export const STAT_ELEMENT = { str: '화염', agi: '얼음', wil: '빛', lmp: '귀화', vit: '생명', fury: '번개' };
export const SPELL_ELEMENT = { bolt: '등불' };
// 마법 효과: 그 스탯을 올렸을 때의 장점을 키우거나(▲), 반대로 내려간 스탯의 약점을 메운다(▼). combat.js spellPerk와 짝
export const SPELL_PERK = {
  pillar: '▼민첩 보완 · 맞은 적 2초 발 묶음 (보스 1초)', tornado: '▼민첩 보완 · 적을 회오리 쪽으로 끌어와 묶음', meteor: '▲힘 강화 · 5초간 검 공격 피해 +30%',
  lance: '▼힘 보완 · 맞은 적 3초 취약 (받는 피해 +25%)', spikes: '▼힘 보완 · 맞은 적 3초 둔화 + 2초 취약', stars: '▼힘 보완 · 맞은 적 둔화 + 3초 취약',
  ward: '▼등불 보완 · 결계 중 패링마다 빛 +10', smite: '▼등불 보완 · 맞히면 빛 8 돌려받음', thunder: '▲의지 강화 · 4초간 완벽 패링 판정 +2프레임 · 빛 6 환급',
  ring: '▼의지 보완 · 시전 직후 잠깐 무적', wisps: '▼의지 보완 · 맞은 적의 공격 예고를 끊음 (보스 제외)', spear: '▲등불 강화 · 맞힌 적마다 빛 12 돌려받음',
  heal: '▼투지 보완 · 5초간 검 공격 피해 +25%', thorns: '▼투지 보완 · 2.5초 발 묶음 + 취약', sanctum: '▲생명 강화 · 10초간 피해를 한 번 막는 보호막',
  chain: '▲투지 강화 · 다음 검 공격 확정 치명타', drain: '▼생명 보완 · 맞히면 체력 1 회복', blast: '▼생명 보완 · 이 마법으로 처치하면 체력 1 (최대 2)',
};
// 마을 기름 → 기본 마법 (7 이상인 스탯이 없을 때)
// 마법 특성 태그 (설명 카드에 표시)
export const SPELL_TAGS = { bolt: ['유도'], lance: ['유도', '관통'], pillar: ['조준', '범위'], thunder: ['조준', '자세 파괴'], stars: ['넓은 범위', '3연타'], tornado: ['조준', '3연타'], spikes: ['앞쪽 직선', '바닥'], smite: ['조준', '자세 파괴'], wisps: ['유도', '3발'], thorns: ['앞쪽 직선', '자세 피해'], drain: ['조준', '흡혈 1'],
  meteor: ['조준', '큰 범위', '무적'], ring: ['주변', '탄 지우기', '무적'], ward: ['주변', '완벽 패링 5초', '무적'], spear: ['관통 광선', '무적'],
  chain: ['조준', '최대 3명'], blast: ['조준', '큰 범위', '무적'], heal: ['회복 2'], sanctum: ['주변', '회복 1', '무적'] };
export const OIL_EL = { refined: null, blue: 'wil', black: 'lmp' };   // 각성 전 등불 기름 = 각성 전 두르기 속성
export const OIL_SPELL = { refined: 'bolt', blue: 'ward', black: 'spear' };
// 스탯 → 마법: [14 이상, 17 이상, 20]
export const SPELL_AT = [14, 17, 20];
export const STAT_SPELL = { str: ['pillar', 'tornado', 'meteor'], agi: ['lance', 'spikes', 'stars'], wil: ['ward', 'smite', 'thunder'], lmp: ['ring', 'wisps', 'spear'], vit: ['heal', 'thorns', 'sanctum'], fury: ['chain', 'drain', 'blast'] };
// 지금 빌드의 마법: 가장 높은 스탯(14 이상)이 정한다. 동점이면 마지막으로 올린 스탯, 그래도 같으면 표 순서
for (const [k, ids] of Object.entries(STAT_SPELL)) for (const id of ids) SPELL_ELEMENT[id] = STAT_ELEMENT[k];
// 등불 각성: 스탯이 처음 14에 닿으면 그 스탯의 속성으로 등불이 각성 (판 동안 고정, 휴식방에서만 다시 붙이기)
// 마법의 중심은 '불꽃 두르기': 검에 속성 불꽃을 두르고 베기마다 속성 게이지를 쌓는다. 두른 불꽃을 '풀면' 그 속성 마법이 나간다
export const ENCHANT = {
  null: { name: '등불 불꽃', burst: '화상 (약)', desc: '게이지가 차면 약한 화상' },
  str:  { name: '화염 두르기', burst: '화상', desc: '게이지가 차면 4초 동안 불탄다 (초당 피해)' },
  agi:  { name: '냉기 두르기', burst: '빙결', desc: '게이지가 차면 얼어붙어 멈추고, 받는 피해 +25%' },
  wil:  { name: '빛 두르기', burst: '심판의 빛', desc: '게이지가 차면 자세가 크게 무너진다' },
  lmp:  { name: '귀화 두르기', burst: '혼 뽑기', desc: '게이지가 차면 빛 게이지 +30, 적은 둔해진다' },
  vit:  { name: '생명 두르기', burst: '흡수', desc: '게이지가 차면 체력 1 회복 (방마다 2번)' },
  fury: { name: '번개 두르기', burst: '방전', desc: '게이지가 차면 주변 적 둘에게 전격 + 경직' },
};
// 각성 속성을 고름: 14 이상 중 마지막으로 올린 스탯, 없으면 가장 높은 스탯
export function awakenPick(stats, lastUp) {
  const ids = Object.keys(STAT_SPELL).filter(k => stats[k] >= 14);
  if (!ids.length) return null;
  if (lastUp && ids.includes(lastUp)) return lastUp;
  return ids.sort((a, b) => stats[b] - stats[a])[0];
}
// 풀기 마법: 각성 속성 스탯이 14·17·20이면 그 단계 마법, 아니면 기본(기름) 마법
export function elementSpell(stats, el, base = 'bolt') {
  if (!el || stats[el] < 14) return base;
  return STAT_SPELL[el][stats[el] >= 20 ? 2 : stats[el] >= 17 ? 1 : 0];
}
export function spellFor(stats, base = 'bolt', lastUp = null) {
  const ids = Object.keys(STAT_SPELL), top = Math.max(...ids.map(k => stats[k]));
  if (top < 14) return base;
  const k = ids.filter(k => stats[k] === top).sort((a, b) => (b === lastUp) - (a === lastUp))[0];
  return STAT_SPELL[k][top >= 20 ? 2 : top >= 17 ? 1 : 0];
}
