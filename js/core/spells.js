// 등불 마법 (주문서): 1칸. 판 중 보상으로 얻어 바꿔 끼운다. 빛 게이지를 소모
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
};
// 마을 기름 → 판 시작 마법
export const OIL_SPELL = { refined: 'bolt', blue: 'ward', black: 'spear' };
