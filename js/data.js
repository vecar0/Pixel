// 게임 데이터 (순수 데이터 — 브라우저/Node 공용)

export const TILE = 16;
export let VIEW_W = 480;
export function setViewW(w) { VIEW_W = w; }
export const VIEW_H = 270;
export const ROOM_H = 17; // 타일 행 수

export const RARITY = [
  { name: '일반', color: '#e8e8f0' },
  { name: '고급', color: '#6fe07a' },
  { name: '희귀', color: '#5cb8ff' },
  { name: '영웅', color: '#c07aff' },
  { name: '전설', color: '#ffa53a' },
];

export const HEROES = {
  miyu: {
    id: 'miyu', name: '미유', title: '고양이 후드 게이머', hp: 6, armor: 5, energy: 180, crit: 5, speed: 112,
    weapon: 'blaster', cost: 0, color: '#3ff0e2',
    skill: { name: '콤보 러시', cd: 10, dur: 6, desc: '6초 동안 공격 속도 2배, 발사체 +1. 적을 처치할 때마다 지속시간 +1초.' },
    story: '방과 후 오락실에서 살던 프로게이머 지망생. 반응속도만큼은 누구에게도 안 진다.',
  },
  luna: {
    id: 'luna', name: '루나', title: '별 마녀', hp: 5, armor: 4, energy: 260, crit: 10, speed: 104,
    weapon: 'stardust', cost: 200, color: '#b58cff',
    skill: { name: '유성우', cd: 12, dur: 0, desc: '화면 안의 적들에게 유성 12개를 떨어뜨린다. 시전 시 에너지 30 회복.' },
    story: '별을 세다 지하로 떨어진 견습 마녀. 에너지가 넉넉해서 화려한 무기를 오래 쓴다.',
  },
  haru: {
    id: 'haru', name: '하루', title: '토끼귀 메이드 검사', hp: 8, armor: 6, energy: 140, crit: 5, speed: 116,
    weapon: 'cookieblade', cost: 350, color: '#ff4f5f',
    skill: { name: '대시 베기', cd: 5, dur: 0, desc: '조준 방향으로 순간 돌진하며 경로의 적을 벤다. 돌진 중 무적, 탄을 지운다.' },
    story: '저택 경비를 맡은 메이드. 검 한 자루면 총알도 썰어버린다.',
  },
};
export const HERO_ORDER = ['miyu', 'luna', 'haru'];

// 무기. kind: gun | melee
// colors: [몸체, 보조, 발광, 어두운부분, 손잡이]
export const WEAPONS = {
  blaster:     { name: '픽셀 블래스터', shape: 'blaster', rarity: 0, kind: 'gun', dmg: 3, rate: 4.5, energy: 0, spread: 5, shots: 1, speed: 280, bullet: 'pix', bcolor: '#3ff0e2', colors: ['#ff6fb8', '#ffd1e6', '#3ff0e2', '#3a3550'], start: true },
  stardust:    { name: '별가루 지팡이', shape: 'wand', rarity: 0, kind: 'gun', dmg: 4, rate: 3.2, energy: 0, spread: 3, shots: 1, speed: 220, bullet: 'star', bcolor: '#ffd75a', homing: 2.2, colors: ['#ffd75a', '#fff0a0', '#ffffff', '#3a2a6a', '#7a4ab8'], start: true },
  cookieblade: { name: '쿠키 커터 블레이드', shape: 'katana', rarity: 0, kind: 'melee', dmg: 7, rate: 2.6, energy: 0, range: 34, arc: 120, colors: ['#e8ecff', '#ffffff', '#ff8fae', '#2a2030', '#e8334a'], start: true },

  pistol:      { name: '골목 권총', shape: 'pistol', rarity: 0, kind: 'gun', dmg: 4, rate: 3.5, energy: 0.5, spread: 4, shots: 1, speed: 300, bullet: 'dot', bcolor: '#ffe08a', colors: ['#8a90a8', '#c8cce0', '#ffe08a', '#3a3550', '#6b4a32'] },
  revolver:    { name: '카우걸 리볼버', shape: 'revolver', rarity: 0, kind: 'gun', dmg: 8, rate: 1.8, energy: 1, spread: 2, shots: 1, speed: 360, bullet: 'dot', bcolor: '#ffd75a', crit: 10, colors: ['#9aa0b8', '#d8dcf0', '#ffd75a', '#3a3550', '#8a5a32'] },
  glove:       { name: '냥냥 펀치', shape: 'glove', rarity: 0, kind: 'melee', dmg: 6, rate: 4, energy: 0, range: 24, arc: 80, colors: ['#ff8fae', '#ffd1e6', '#ffffff', '#3a3550'] },
  watergun:    { name: '물총', shape: 'bubble', rarity: 0, kind: 'gun', dmg: 2, rate: 8, energy: 0.3, spread: 8, shots: 1, speed: 240, bullet: 'drop', bcolor: '#7ad8ff', colors: ['#5cc8ff', '#c8f0ff', '#ffffff', '#2a4a8a'] },

  dualpistol:  { name: '쌍권총', shape: 'pistol', rarity: 1, kind: 'gun', dmg: 3, rate: 6, energy: 0.6, spread: 6, shots: 2, fan: 6, speed: 310, bullet: 'dot', bcolor: '#ff9f5a', colors: ['#ff9f5a', '#ffd0a0', '#ffffff', '#3a2a2a', '#3a2a2a'] },
  shotgun:     { name: '펌프 샷건', shape: 'shotgun', rarity: 1, kind: 'gun', dmg: 3, rate: 1.5, energy: 2, spread: 4, shots: 6, fan: 26, speed: 300, bullet: 'dot', bcolor: '#ffb347', knock: 2, colors: ['#6a6a7a', '#a0a0b0', '#ffb347', '#2a2a3a', '#8a4a2a'] },
  smg:         { name: '기관단총', shape: 'smg', rarity: 1, kind: 'gun', dmg: 2, rate: 11, energy: 0.4, spread: 9, shots: 1, speed: 330, bullet: 'dot', bcolor: '#ffe08a', colors: ['#4a4a5a', '#7a7a8a', '#ffe08a', '#1a1a2a', '#3a3a4a'] },
  spear:       { name: '은빛 창', shape: 'spear', rarity: 1, kind: 'melee', dmg: 10, rate: 2, energy: 0, range: 52, arc: 34, colors: ['#e8ecff', '#ffffff', '#ffffff', '#3a3550', '#8a5a32'] },
  hammer:      { name: '뿅망치', shape: 'hammer', rarity: 1, kind: 'melee', dmg: 15, rate: 1.2, energy: 0, range: 32, arc: 140, knock: 3, shake: 3, colors: ['#ff5a7a', '#ff9fb0', '#ffe08a', '#3a2030', '#ffd75a'] },

  laser:       { name: '레이저 라이플', shape: 'laser', rarity: 2, kind: 'gun', dmg: 6, rate: 3, energy: 1.5, spread: 1, shots: 1, speed: 560, bullet: 'laser', bcolor: '#ff4fd8', pierce: 3, colors: ['#2a2a4a', '#4a4a7a', '#ff4fd8', '#14142a'] },
  bubble:      { name: '버블건', shape: 'bubble', rarity: 2, kind: 'gun', dmg: 5, rate: 4, energy: 1, spread: 10, shots: 1, speed: 150, bullet: 'bubble', bcolor: '#aef3ff', bounce: 3, colors: ['#ff8fd0', '#ffd1ee', '#aef3ff', '#5a2a6a'] },
  beamsword:   { name: '빔 소드', shape: 'beamsword', rarity: 2, kind: 'melee', dmg: 11, rate: 2.4, energy: 1, range: 38, arc: 120, wave: true, colors: ['#3ff0e2', '#ffffff', '#7af0ff', '#3a3a4a', '#8a8aa0'] },
  boomerang:   { name: '별 부메랑', shape: 'boomerang', rarity: 2, kind: 'gun', dmg: 7, rate: 1.8, energy: 1, spread: 0, shots: 1, speed: 260, bullet: 'boomer', bcolor: '#ffd75a', pierce: 99, colors: ['#ffd75a', '#fff0a0', '#ff8fae', '#6a4a1a'] },
  frost:       { name: '냉동 광선', shape: 'laser', rarity: 2, kind: 'gun', dmg: 3, rate: 7, energy: 0.7, spread: 3, shots: 1, speed: 420, bullet: 'ice', bcolor: '#aef3ff', slow: 1.2, colors: ['#e0f8ff', '#ffffff', '#5cc8ff', '#2a4a7a'] },

  rocket:      { name: '로켓 런처', shape: 'rocket', rarity: 3, kind: 'gun', dmg: 16, rate: 0.9, energy: 4, spread: 2, shots: 1, speed: 230, bullet: 'rocket', bcolor: '#ff8a3a', explode: 40, shake: 4, colors: ['#5a7a4a', '#8aaa6a', '#ff8a3a', '#2a3a2a', '#3a3a2a'] },
  sniper:      { name: '저격총 「매의 눈」', shape: 'sniper', rarity: 3, kind: 'gun', dmg: 26, rate: 0.85, energy: 3, spread: 0, shots: 1, speed: 720, bullet: 'laser', bcolor: '#ffffff', pierce: 6, crit: 25, colors: ['#3a3a4a', '#6a6a7a', '#ff3355', '#1a1a2a', '#5a3a2a'] },
  scythe:      { name: '달빛 대낫', shape: 'scythe', rarity: 3, kind: 'melee', dmg: 18, rate: 1.5, energy: 0, range: 46, arc: 200, colors: ['#c8c8ff', '#ffffff', '#b07aff', '#2a2040', '#4a3a6a'] },
  meteorstaff: { name: '유성 지팡이', shape: 'staff', rarity: 3, kind: 'gun', dmg: 6, rate: 2.2, energy: 2.5, spread: 20, shots: 3, fan: 30, speed: 200, bullet: 'star', bcolor: '#ff9f5a', homing: 4, colors: ['#ff6a3a', '#ffd75a', '#ffffff', '#3a2a1a', '#6a4a2a'] },
  spreadlaser: { name: '산탄 레이저', shape: 'laser', rarity: 3, kind: 'gun', dmg: 4, rate: 1.4, energy: 3, spread: 2, shots: 7, fan: 40, speed: 520, bullet: 'laser', bcolor: '#7aff9a', pierce: 1, colors: ['#2a4a3a', '#4a7a5a', '#7aff9a', '#142a1a'] },

  plasma:      { name: '플라즈마 캐논', shape: 'cannon', rarity: 4, kind: 'gun', dmg: 34, rate: 0.75, energy: 6, spread: 0, shots: 1, speed: 190, bullet: 'plasma', bcolor: '#b07aff', explode: 56, pierce: 99, shake: 5, colors: ['#3a2a6a', '#6a4aa0', '#e0b0ff', '#1a1430'] },
  rainbow:     { name: '무지개 개틀링', shape: 'gatling', rarity: 4, kind: 'gun', dmg: 3, rate: 18, energy: 0.6, spread: 10, shots: 1, speed: 380, bullet: 'rainbow', bcolor: '#ffffff', colors: ['#ff6fb8', '#ffd1e6', '#7af0ff', '#3a2a4a'] },
  thunder:     { name: '번개 지팡이', shape: 'staff', rarity: 4, kind: 'gun', dmg: 12, rate: 2, energy: 3, spread: 0, shots: 1, speed: 500, bullet: 'bolt', bcolor: '#fff36a', chain: 4, colors: ['#5cc8ff', '#fff36a', '#ffffff', '#1a2a4a', '#3a4a6a'] },
  galaxy:      { name: '은하수 대검', shape: 'beamsword', rarity: 4, kind: 'melee', dmg: 24, rate: 1.7, energy: 1, range: 50, arc: 160, wave: true, colors: ['#b07aff', '#ffffff', '#ff6fd8', '#1a1030', '#ffd75a'] },
};
export const WEAPON_POOL = Object.keys(WEAPONS).filter(k => !WEAPONS[k].start);

export const ENEMIES = {
  slime:    { name: '젤리 슬라임', hp: 7, w: 14, h: 11, speed: 46, ai: 'hopper', contact: 1, coin: [1, 2], gravity: true, from: 1 },
  bat:      { name: '박쥐', hp: 5, w: 14, h: 8, speed: 70, ai: 'bat', contact: 1, coin: [1, 2], gravity: false, from: 1 },
  goblin:   { name: '고블린 사수', hp: 11, w: 12, h: 16, speed: 42, ai: 'archer', contact: 1, coin: [1, 3], gravity: true, from: 2, weapon: 'bow' },
  skeleton: { name: '해골 방패병', hp: 20, w: 12, h: 18, speed: 34, ai: 'shield', contact: 1, coin: [2, 3], gravity: true, from: 3, weapon: 'shield' },
  mage:     { name: '버섯 마법사', hp: 13, w: 12, h: 16, speed: 30, ai: 'mage', contact: 1, coin: [2, 3], gravity: true, from: 4 },
  drone:    { name: '정찰 드론', hp: 9, w: 14, h: 10, speed: 60, ai: 'drone', contact: 1, coin: [2, 3], gravity: false, from: 6 },
};

export const BOSSES = [
  { id: 'king', name: '킹 슬라임', hp: 360, w: 56, h: 52, sprite: 'king' },
  { id: 'crow', name: '기계 까마귀 K-9', hp: 330, w: 48, h: 40, sprite: 'crow' },
  { id: 'maid', name: '그림자 메이드장', hp: 400, w: 28, h: 56, sprite: 'maid' },
];

// 버프 (층 클리어 보상). stack: 최대 중첩
export const BUFFS = [
  { id: 'dmg', name: '화력 강화', icon: '⚔', desc: '모든 피해 +20%', stack: 9, apply: m => { m.dmgMul += 0.2; } },
  { id: 'rate', name: '속사', icon: '»', desc: '공격 속도 +18%', stack: 9, apply: m => { m.rateMul += 0.18; } },
  { id: 'multi', name: '분열탄', icon: '⁂', desc: '총 발사체 +1 (발당 피해 -10%)', stack: 3, apply: m => { m.extraShots += 1; m.dmgMul *= 0.9; } },
  { id: 'crit', name: '날카로운 눈', icon: '◎', desc: '치명타 확률 +10%', stack: 6, apply: m => { m.crit += 10; } },
  { id: 'critdmg', name: '치명 강타', icon: '✦', desc: '치명타 피해 +60%', stack: 5, apply: m => { m.critMul += 0.6; } },
  { id: 'hp', name: '튼튼한 몸', icon: '♥', desc: '최대 HP +2 (즉시 회복)', stack: 9, apply: (m, p) => { m.maxHp += 2; p.hp += 2; } },
  { id: 'armor', name: '강화 아머', icon: '⛨', desc: '최대 아머 +2', stack: 9, apply: m => { m.maxArmor += 2; } },
  { id: 'battery', name: '배터리 팩', icon: '⚡', desc: '최대 에너지 +60 (즉시 충전)', stack: 9, apply: (m, p) => { m.maxEnergy += 60; p.energy += 60; } },
  { id: 'eco', name: '절약 모드', icon: '♻', desc: '에너지 소모 -25%', stack: 3, apply: m => { m.costMul *= 0.75; } },
  { id: 'cd', name: '쿨타임 감소', icon: '⏱', desc: '스킬 쿨다운 -20%', stack: 4, apply: m => { m.cdMul *= 0.8; } },
  { id: 'speed', name: '날쌘 발', icon: '➶', desc: '이동 속도 +15%', stack: 3, apply: m => { m.speedMul += 0.15; } },
  { id: 'jump', name: '이단 점프', icon: '⇈', desc: '공중 점프 +1회', stack: 2, apply: m => { m.jumps += 1; } },
  { id: 'vamp', name: '흡혈 고양이', icon: '❤', desc: '처치 시 5% 확률로 HP +1', stack: 4, apply: m => { m.healChance += 0.05; } },
  { id: 'absorb', name: '에너지 흡수', icon: '◆', desc: '처치 시 에너지 +5', stack: 5, apply: m => { m.energyOnKill += 5; } },
  { id: 'gold', name: '황금 손', icon: '$', desc: '코인 획득 +50%', stack: 4, apply: m => { m.coinMul += 0.5; } },
  { id: 'velocity', name: '고속탄', icon: '→', desc: '탄속 +35%, 피해 +5%', stack: 3, apply: m => { m.bulletSpeedMul += 0.35; m.dmgMul += 0.05; } },
  { id: 'pierce', name: '관통탄', icon: '⇥', desc: '탄이 적 1명을 더 관통', stack: 3, apply: m => { m.pierce += 1; } },
  { id: 'bounce', name: '도탄', icon: '↯', desc: '탄이 벽에 1번 더 튕김', stack: 3, apply: m => { m.bounce += 1; } },
  { id: 'boom', name: '폭발탄', icon: '✹', desc: '명중 시 15% 확률 폭발', stack: 4, apply: m => { m.explodeChance += 0.15; } },
  { id: 'regen', name: '아머 재생', icon: '⟳', desc: '아머 재생 속도 2배', stack: 2, apply: m => { m.armorRegenMul *= 2; } },
  { id: 'thorns', name: '가시 갑옷', icon: '✳', desc: '피격 시 주변 적에게 15 피해', stack: 3, apply: m => { m.thorns += 15; } },
  { id: 'magnet', name: '자석', icon: 'U', desc: '아이템 흡수 범위 +70', stack: 2, apply: m => { m.magnet += 70; } },
  { id: 'shield', name: '보호막', icon: '◯', desc: '방마다 첫 피격 1회 무효', stack: 1, apply: m => { m.roomShield = true; } },
  { id: 'revive', name: '부활의 깃털', icon: '✚', desc: '사망 시 1회 HP 절반으로 부활', stack: 1, apply: m => { m.revives += 1; } },
  { id: 'big', name: '거대탄', icon: '●', desc: '탄 크기 +50%, 피해 +12%', stack: 3, apply: m => { m.bulletSize += 0.5; m.dmgMul += 0.12; } },
  { id: 'knock', name: '밀쳐내기', icon: '⇤', desc: '넉백 2배, 피해 +8%', stack: 2, apply: m => { m.knockMul *= 2; m.dmgMul += 0.08; } },
  { id: 'homing', name: '유도탄', icon: '⤳', desc: '탄이 적을 살짝 따라감', stack: 3, apply: m => { m.homing += 2.2; } },
  { id: 'hunter', name: '거물 사냥꾼', icon: '☠', desc: '엘리트·보스 피해 +40%', stack: 3, apply: m => { m.bigDmgMul += 0.4; } },
  { id: 'blade', name: '검기 확장', icon: '⚔', desc: '근접 범위 +30%, 근접 피해 +25%', stack: 3, apply: m => { m.meleeRange += 0.3; m.meleeDmg += 0.25; } },
  { id: 'skill', name: '스킬 마스터', icon: '★', desc: '스킬 지속 +40%, 스킬 피해 +40%', stack: 3, apply: m => { m.skillDur += 0.4; m.skillDmg += 0.4; } },
  { id: 'iframe', name: '잔상 회피', icon: '≈', desc: '피격 후 무적 시간 +0.4초', stack: 2, apply: m => { m.iframe += 0.4; } },
  { id: 'coupon', name: '단골 쿠폰', icon: '%', desc: '상점 가격 -30%', stack: 2, apply: m => { m.discount = Math.min(0.6, m.discount + 0.3); } },
];

export function baseMods() {
  return {
    dmgMul: 1, rateMul: 1, extraShots: 0, crit: 0, critMul: 2, maxHp: 0, maxArmor: 0, maxEnergy: 0,
    costMul: 1, cdMul: 1, speedMul: 1, jumps: 1, healChance: 0, energyOnKill: 0, coinMul: 1,
    bulletSpeedMul: 1, pierce: 0, bounce: 0, explodeChance: 0, armorRegenMul: 1, thorns: 0, magnet: 44,
    roomShield: false, revives: 0, bulletSize: 1, knockMul: 1, homing: 0, bigDmgMul: 1, meleeRange: 1,
    meleeDmg: 1, skillDur: 1, skillDmg: 1, iframe: 0, discount: 0,
  };
}

// 영구 연구 (보석)
export const PERKS = [
  { id: 'hp', name: '체력 단련', desc: '시작 HP +1', max: 3, cost: [60, 140, 300] },
  { id: 'energy', name: '배터리 연구', desc: '시작 에너지 +30', max: 3, cost: [50, 120, 250] },
  { id: 'coin', name: '비상금 지갑', desc: '시작 코인 +25', max: 3, cost: [40, 100, 200] },
  { id: 'luck', name: '행운 부적', desc: '시작 시 무작위 버프 1개', max: 2, cost: [250, 600] },
  { id: 'weapon', name: '무기고 열쇠', desc: '1층 시작 방에 무기 상자', max: 1, cost: [180] },
];

export const SAVE_KEY = 'neonpaw_save_v1';
export function defaultSave() {
  return { gems: 0, unlocked: { miyu: true }, best: 0, runs: 0, kills: 0, perks: {}, last: 'miyu', sound: true, music: true, codex: {} };
}
