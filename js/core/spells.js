// 등불 마법 (주문서): 판 중 보상으로 얻어 2칸에 끼운다. 빛 게이지를 소모
// 수치는 config.js의 CFG.skill, 여기는 이름·설명·그림
export const SPELLS = {
  bolt:  { name: '등불 탄',   icon: 'ember',       tone: 'amber', desc: '앞으로 불씨 구체를 쏜다' },
  lash:  { name: '등불 채찍', icon: 'chain',       tone: 'amber', desc: '좌우를 한 번에 휘감아 벤다 (자세 피해 큼)' },
  flare: { name: '섬광',      icon: 'afterglow',   tone: 'bone',  desc: '화면 안 모든 적의 자세를 무너뜨린다' },
  ring:  { name: '불꽃 고리', icon: 'ult',         tone: 'ember', desc: '주변을 폭발시키고 적 탄을 지운다 · 시전 중 무적' },
  ward:  { name: '푸른 결계', icon: 'parry',       tone: 'moon',  desc: '주변 냉기 + 5초간 모든 패링 완벽 · 시전 중 무적' },
  spear: { name: '흑염 창',   icon: 'executioner', tone: 'ember', desc: '앞으로 관통하는 광선 · 시전 중 무적' },
};
// 마을 기름 → 판 시작 때 두 번째 칸에 끼워 주는 마법
export const OIL_SPELL = { refined: 'ring', blue: 'ward', black: 'spear' };
