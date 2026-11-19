// 등불 마법: 1칸. 어떤 마법을 쓰는지는 스탯 빌드가 정한다 (아래 spellFor). 빛 게이지를 소모
// 연출은 모두 pixelfx 마법 이펙트 (fx: 쓰는 이펙트). 수치는 config.js의 CFG.skill
export const SPELLS = {
  bolt:    { name: '등불 탄',   icon: 'ember',       tone: 'amber', fx: 'fire/fireball',            desc: '앞으로 불덩이를 쏜다' },
  lance:   { name: '얼음 창',   icon: 'sword',       tone: 'moon',  fx: 'ice/ice-lance',            desc: '앞으로 꿰뚫는 얼음 창 (여러 적 관통)' },
  pillar:  { name: '화염 기둥', icon: 'ult',         tone: 'ember', fx: 'fire/flame-pillar',        desc: '앞쪽 가까운 적 발밑에서 불기둥이 솟는다' },
  thunder: { name: '낙뢰',      icon: 'afterglow',   tone: 'moon',  fx: 'lightning/lightning-strike', desc: '가장 가까운 적에게 벼락 (자세 크게 무너뜨림)' },
  stars:   { name: '별똥비',    icon: 'afterglow',   tone: 'amber', fx: 'arcane/star-fall',         desc: '앞쪽 넓은 범위에 별이 쏟아진다' },
  meteor:  { name: '운석',      icon: 'ember',       tone: 'ember', fx: 'fire/meteor',              desc: '가까운 적에게 운석이 떨어져 크게 폭발 · 시전 중 무적' },
  ring:    { name: '불꽃 고리', icon: 'ult',         tone: 'ember', fx: 'fire/fire-ring',           desc: '주변을 폭발시키고 적 탄을 지운다 · 시전 중 무적' },
  ward:    { name: '푸른 결계', icon: 'parry',       tone: 'moon',  fx: 'holy/divine-shield',       desc: '주변 냉기 + 5초간 모든 패링 완벽 · 시전 중 무적' },
  spear:   { name: '흑염 창',   icon: 'executioner', tone: 'ember', fx: 'arcane/arcane-beam',       desc: '앞으로 관통하는 광선 · 시전 중 무적' },
  heal:    { name: '치유의 빛', icon: 'heart',       tone: 'heal',  fx: 'holy/heal',                desc: '체력 2 회복' },
  sanctum: { name: '성광 기둥', icon: 'vigor',       tone: 'heal',  fx: 'holy/holy-pillar',         desc: '주변 적에게 피해 + 체력 1 회복 · 시전 중 무적' },
};
// 마을 기름 → 기본 마법 (7 이상인 스탯이 없을 때)
export const OIL_SPELL = { refined: 'bolt', blue: 'ward', black: 'spear' };
// 스탯 → 마법: [7 이상, 10]
export const STAT_SPELL = { str: ['pillar', 'meteor'], agi: ['lance', 'stars'], wil: ['ward', 'thunder'], lmp: ['ring', 'spear'], vit: ['heal', 'sanctum'] };
// 지금 빌드의 마법: 가장 높은 스탯(7 이상)이 정한다. 동점이면 마지막으로 올린 스탯, 그래도 같으면 표 순서
export function spellFor(stats, base = 'bolt', lastUp = null) {
  const ids = Object.keys(STAT_SPELL), top = Math.max(...ids.map(k => stats[k]));
  if (top < 7) return base;
  const k = ids.filter(k => stats[k] === top).sort((a, b) => (b === lastUp) - (a === lastUp))[0];
  return STAT_SPELL[k][top >= 10 ? 1 : 0];
}
