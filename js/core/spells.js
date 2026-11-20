// 등불 마법: 1칸. 어떤 마법을 쓰는지는 스탯 빌드가 정한다 (아래 spellFor). 빛 게이지를 소모
// 연출은 모두 pixelfx 마법 이펙트 (fx: 쓰는 이펙트). 수치는 config.js의 CFG.skill
export const SPELLS = {
  bolt:    { name: '등불 탄',   icon: 'ember',       tone: 'amber', fx: 'fire/fireball',            desc: '등불에서 불덩이를 쏜다. 가까운 적을 쫓아가 맞고 터진다' },
  lance:   { name: '얼음 창',   icon: 'sword',       tone: 'moon',  fx: 'ice/ice-lance',            desc: '얼음 창을 던진다. 적을 쫓아가며 여러 적을 꿰뚫는다' },
  pillar:  { name: '화염 기둥', icon: 'ult',         tone: 'ember', fx: 'fire/flame-pillar',        desc: '가장 가까운 적 발밑이 갈라지며 불기둥이 솟는다' },
  thunder: { name: '낙뢰',      icon: 'afterglow',   tone: 'moon',  fx: 'lightning/lightning-strike', desc: '가장 가까운 적에게 벼락이 떨어져 자세를 크게 무너뜨린다' },
  stars:   { name: '별똥비',    icon: 'afterglow',   tone: 'amber', fx: 'arcane/star-fall',         desc: '앞쪽 넓은 땅에 별이 쏟아져 여럿을 한꺼번에 친다' },
  meteor:  { name: '운석',      icon: 'ember',       tone: 'ember', fx: 'fire/meteor',              desc: '가장 가까운 적에게 운석이 떨어져 크게 폭발한다' },
  ring:    { name: '불꽃 고리', icon: 'ult',         tone: 'ember', fx: 'fire/fire-ring',           desc: '리라 주변으로 불꽃이 퍼지고, 날아오던 적 탄을 모두 지운다' },
  ward:    { name: '푸른 결계', icon: 'parry',       tone: 'moon',  fx: 'holy/divine-shield',       desc: '주변을 얼리고, 5초 동안 모든 패링이 완벽 판정이 된다' },
  spear:   { name: '흑염 창',   icon: 'executioner', tone: 'ember', fx: 'arcane/arcane-beam',       desc: '앞으로 검은 광선을 쏴 일직선의 적을 모두 꿰뚫는다' },
  chain:   { name: '연쇄 번개', icon: 'afterglow',   tone: 'moon',  fx: 'lightning/chain-lightning', desc: '앞쪽 가까운 적 셋에게 번개가 차례로 옮겨 간다' },
  blast:   { name: '암흑 폭발', icon: 'elite',       tone: 'ember', fx: 'shadow/dark-explosion',    desc: '가장 가까운 적 자리에서 검은 별이 터진다' },
  heal:    { name: '치유의 빛', icon: 'heart',       tone: 'heal',  fx: 'holy/heal',                desc: '빛이 몸을 감싸 체력을 2 되찾는다' },
  sanctum: { name: '성광 기둥', icon: 'vigor',       tone: 'heal',  fx: 'holy/holy-pillar',         desc: '빛기둥이 내려와 주변 적을 치고 체력을 1 되찾는다' },
};
// 마을 기름 → 기본 마법 (7 이상인 스탯이 없을 때)
// 마법 특성 태그 (설명 카드에 표시)
export const SPELL_TAGS = { bolt: ['유도'], lance: ['유도', '관통'], pillar: ['조준', '범위'], thunder: ['조준', '자세 파괴'], stars: ['넓은 범위'],
  meteor: ['조준', '큰 범위', '무적'], ring: ['주변', '탄 지우기', '무적'], ward: ['주변', '완벽 패링 5초', '무적'], spear: ['관통 광선', '무적'],
  chain: ['조준', '최대 3명'], blast: ['조준', '큰 범위', '무적'], heal: ['회복 2'], sanctum: ['주변', '회복 1', '무적'] };
export const OIL_SPELL = { refined: 'bolt', blue: 'ward', black: 'spear' };
// 스탯 → 마법: [7 이상, 10]
export const STAT_SPELL = { str: ['pillar', 'meteor'], agi: ['lance', 'stars'], wil: ['ward', 'thunder'], lmp: ['ring', 'spear'], vit: ['heal', 'sanctum'], fury: ['chain', 'blast'] };
// 지금 빌드의 마법: 가장 높은 스탯(7 이상)이 정한다. 동점이면 마지막으로 올린 스탯, 그래도 같으면 표 순서
export function spellFor(stats, base = 'bolt', lastUp = null) {
  const ids = Object.keys(STAT_SPELL), top = Math.max(...ids.map(k => stats[k]));
  if (top < 7) return base;
  const k = ids.filter(k => stats[k] === top).sort((a, b) => (b === lastUp) - (a === lastUp))[0];
  return STAT_SPELL[k][top >= 10 ? 1 : 0];
}
