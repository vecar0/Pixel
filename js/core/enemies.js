// 적 공용 상태기계: idle(접근) → telegraph(예고) → active(판정) → recover(후딜) → idle
// 적 객체에는 함수를 넣지 않는다 (structuredClone 가능 = 테스트 봇이 미래를 미리 볼 수 있음)
// 공격 종류는 데이터로: reach(근접) · dash(2D 돌진) · charge(가로 돌진) · bolt(조준탄) · wave(바닥 충격파)
//                      · rain(낙하 파편) · beam(긴 광선) · ring(몸 주변 고리)
import { clipBeam } from './gimmick.js?v=mwzt5ovx';
import { CFG } from './config.js?v=mwzt5ovx';
import { lightSources } from './light.js?v=mwzt5ovx';
import { moveAndCollide, overlap } from './player.js?v=mwzt5ovx';
import { BOSSES, bossPick, bossWant } from './boss.js?v=mwzt5ovx';

export const ENEMY_DEFS = {
  // 소울류 조정: 적 하나하나가 위협 (체력↑ · 공격 2~3종 · 늦게 내려치는 공격 · 콤보) / flinch: 맞으면 움찔(예고 초반 끊김), 연타당하면 버티고 반격
  ghoul: { flinch: true,
    hp: 55, w: 24, h: 54, speed: 1.05, range: 54, cooldown: [40, 90],
    attacks: {
      slash: { name: 'slash', telegraphF: 20, activeF: 4, recoverF: 24, dmg: 1, parryable: true, reach: 46 },
      double: { name: 'double', telegraphF: 22, activeF: 4, recoverF: 34, dmg: 1, parryable: true, reach: 46, hits: 2, gapF: 16 },          // 두 번 할퀴기
      lunge: { name: 'lunge', telegraphF: 26, delay: 22, activeF: 5, recoverF: 48, dmg: 2, parryable: true, reach: 58 },                    // 늦게 내려치기 (예고가 길었다 짧았다, 크게 빗나가면 긴 틈)
    },
  },
  moth: {
    hp: 12, w: 20, h: 16, speed: 1.6, fly: true, oneHit: true, range: 190, cooldown: [60, 110],   // oneHit: 무엇에 맞든 한 방
    attacks: { dash: { name: 'dash', telegraphF: 18, activeF: 24, recoverF: 30, dmg: 1, parryable: true, dashSpeed: 6.6 } },
  },
  // 지역 2: 침수 대성당
  spearman: {
    hp: 75, w: 24, h: 58, speed: 0.9, range: 74, cooldown: [45, 90],
    attacks: {
      thrust: { name: 'thrust', telegraphF: 20, delay: 14, activeF: 5, recoverF: 26, dmg: 1, parryable: true, reach: 62, height: 22 },   // 찌르기: 때때로 한 박자 늦게
      triple: { name: 'triple', telegraphF: 22, activeF: 4, recoverF: 40, dmg: 1, parryable: true, reach: 62, height: 22, hits: 3, gapF: 16 },
      sweep: { name: 'sweep', telegraphF: 30, activeF: 6, recoverF: 50, dmg: 2, parryable: false, reach: 70, height: 22 },                 // 휩쓸기: 패링 불가 → 구르기로 넘기고 긴 틈을 벌함
    },
  },
  priest: { flinch: true,
    hp: 40, w: 24, h: 56, speed: 0.7, range: 280, keepAway: 140, cooldown: [70, 110],
    attacks: { bolts: { name: 'bolts', telegraphF: 24, activeF: 1, recoverF: 40, dmg: 1, parryable: true, hits: 3, gapF: 22, bolt: { speed: 2.8, w: 10, h: 10 } },
      shove: { name: 'shove', telegraphF: 18, activeF: 4, recoverF: 30, dmg: 1, parryable: true, reach: 38, near: 60 } },              // 가까이 붙으면 지팡이로 밀침
  },
  // 지역 3: 유리 광산
  shellguard: {
    hp: 110, w: 34, h: 54, speed: 0.6, range: 60, shield: true, cooldown: [50, 95],
    attacks: {
      bash: { name: 'bash', telegraphF: 22, activeF: 5, recoverF: 28, dmg: 1, parryable: true, reach: 40 },
      grab: { name: 'grab', telegraphF: 26, activeF: 6, recoverF: 44, dmg: 2, parryable: false, reach: 34 },
      crush: { name: 'crush', telegraphF: 34, delay: 18, activeF: 6, recoverF: 60, dmg: 2, parryable: true, reach: 46 },               // 크게 내려찍기 (늦게, 빗나가면 긴 틈)
    },
  },
  // 지역 4: 꺼진 태양의 심연
  assassin: { darkSight: true, flinch: true,
    hp: 60, w: 22, h: 52, speed: 1.4, range: 46, blink: true, cooldown: [60, 110],
    attacks: { cut: { name: 'cut', telegraphF: 18, delay: 12, activeF: 4, recoverF: 26, dmg: 1, parryable: true, reach: 40 },
      frenzy: { name: 'frenzy', telegraphF: 20, activeF: 3, recoverF: 46, dmg: 1, parryable: true, reach: 40, hits: 3, gapF: 16 } },      // 빠른 3연속 베기 → 끝나면 긴 틈
  },
  ...BOSSES,
};
// 변종 (그림은 원래 적, 색만 다시 칠하고 성질이 다름): sprite = 그림을 빌릴 적, tint = 덧칠 색
const V = (base, o) => ({ ...ENEMY_DEFS[base], sprite: base, ...o, attacks: { ...ENEMY_DEFS[base].attacks, ...(o.attacks || {}) } });
Object.assign(ENEMY_DEFS, {
  ghoulRot: V('ghoul', { tint: '#8fd060', hp: 45, speed: 1.4, cooldown: [24, 56] }),                                        // 썩은 구울: 빠르고 쉴 틈 없이 몰아침
  priestDrowned: V('priest', { tint: '#4fc0d8', hp: 50, attacks: { bolts: { ...ENEMY_DEFS.priest.attacks.bolts, hits: 5, gapF: 16 } } }),   // 익사한 순례자: 물탄 5발
  mothCrystal: V('moth', { tint: '#c890ff', oneHit: false, hp: 22, attacks: { dash: { ...ENEMY_DEFS.moth.attacks.dash, dashSpeed: 8 } } }),   // 수정 나방: 두 대 맞아야, 더 빠른 돌진
  shadeAssassin: V('assassin', { tint: '#6a4ab8', hp: 75, attacks: { frenzy: { ...ENEMY_DEFS.assassin.attacks.frenzy, hits: 4 } } }),   // 그늘 암살자: 더 단단하고 4연속
  emberGuard: V('shellguard', { tint: '#ff7a3a', hp: 130, attacks: { crush: { ...ENEMY_DEFS.shellguard.attacks.crush, wave: { w: 18, h: 14, speed: 3.4, life: 70 } } } }),   // 잿불 수호자: 내려찍으면 불길이 바닥을 탐
  starSpear: V('spearman', { tint: '#9ad8ff', hp: 90, speed: 1.05, attacks: { thrust: { ...ENEMY_DEFS.spearman.attacks.thrust, reach: 74, delay: 18 } } }),   // 별빛 창병: 더 길고 빠른 찌르기
});
export const baseOf = k => (ENEMY_DEFS[k] && ENEMY_DEFS[k].sprite) || k;   // 그림·이펙트를 빌릴 원래 적

// 속성 상성: 점화한 속성이 약점이면 게이지 1.6배·피해 +20%, 저항이면 게이지 절반·피해 -15%
//   화염(str) 빛(wil) 얼음(agi) 귀화(lmp) 생명(vit) 번개(fury)
export const AFFINITY = {
  ghoul: { weak: ['wil', 'str'], resist: ['agi'] },        // 무덤 구울: 빛과 불에 사그라듦, 차가운 시체라 얼음엔 무덤덤
  moth: { weak: ['str', 'agi'], resist: [] },              // 나방: 불에 타고 얼면 떨어짐
  spearman: { weak: ['fury', 'wil'], resist: ['agi'] },    // 물에 잠긴 창병: 젖은 뼈에 번개, 찬물에 익숙
  priest: { weak: ['fury', 'lmp'], resist: ['wil'] },      // 순례자: 물빛 구슬은 번개와 어둠에 약하고 빛엔 강함
  shellguard: { weak: ['vit', 'fury'], resist: ['str'] },  // 갑각수호자: 뿌리가 수정 틈을 가르고 번개가 울림, 불엔 단단
  assassin: { weak: ['wil', 'str'], resist: ['lmp'] },     // 암살자: 빛에 드러나고, 어둠은 제 편
  bellBoss: { weak: ['wil'], resist: ['lmp'] },
  saint: { weak: ['fury', 'lmp'], resist: ['wil'] },
  spider: { weak: ['vit'], resist: ['agi'] },
  shadow: { weak: ['wil'], resist: ['lmp'] },
  forge: { weak: ['agi'], resist: ['str'] },              // 용광로: 식히면 갈라짐
  king: { weak: ['str'], resist: ['agi'] },               // 꺼진 태양의 왕: 다시 붙는 불에 약함
  ghoulRot: { weak: ['str', 'wil'], resist: ['vit'] }, priestDrowned: { weak: ['fury'], resist: ['agi', 'wil'] }, mothCrystal: { weak: ['fury'], resist: ['agi'] },
  shadeAssassin: { weak: ['wil'], resist: ['lmp'] }, emberGuard: { weak: ['agi'], resist: ['str'] }, starSpear: { weak: ['lmp'], resist: ['wil'] },
};
export const ENEMY_NAME = { ghoul: '구울', moth: '나방', spearman: '창병', priest: '순례자', shellguard: '갑각수호자', assassin: '암살자', ghoulRot: '썩은 구울', priestDrowned: '익사한 순례자', mothCrystal: '수정 나방', shadeAssassin: '그늘 암살자', emberGuard: '잿불 수호자', starSpear: '별빛 창병' };
export const nameOf = k => ENEMY_NAME[k] || (ENEMY_DEFS[k] && ENEMY_DEFS[k].name) || k;
export function affinity(e, el) {                          // 1 약점 · -1 저항 · 0 보통
  if (!CFG.legacy) return 0;                                  // 새 설계: 상성 없음
  const A = el && AFFINITY[e.kind]; if (!A) return 0;
  return A.weak.includes(el) ? 1 : A.resist.includes(el) ? -1 : 0;
}
// 빛·어둠 반응 (보스 제외): 적마다 소등에 다르게 반응한다
//   나방: 빛을 쫓아 밝을 땐 빠르고, 어둠에선 아무것도 못 봄 · 구울: 귀가 밝아 소리를 멀리서 들음
//   갑각수호자: 귀가 어두움 · 창병: 어둠 속에서 리라를 찾아내면 주변에 경보 · 암살자: 어둠을 보지만 섬광에 눈이 멂
export const DARK_REACT = {
  moth: { name: '빛을 쫓음', desc: '밝으면 빠르게 달려들고, 어둠에선 아무것도 못 봄', hear: 0, litSpeed: 1.35 },
  ghoul: { name: '밝은 귀', desc: '어둠 속 소리를 멀리서 들음', hear: 1.5 },
  shellguard: { name: '둔한 귀', desc: '어둠 속 소리를 잘 못 들음', hear: 0.6 },
  spearman: { name: '경계병', desc: '어둠 속에서 리라를 찾아내면 주변에 경보', alarm: 220 },
  assassin: { name: '어둠눈', desc: '어둠도 보지만 다시 켜는 섬광에 눈이 멂', flashBlind: 180 },
  priest: { name: '물빛 구슬', desc: '어둠 속에서도 가까이 오면 보임' },
  ghoulRot: { name: '썩은 코', desc: '소리를 아주 멀리서 듣고 쉬지 않고 달려듦', hear: 1.8 },
  priestDrowned: { name: '물빛 구슬', desc: '어둠 속에서도 가까이 오면 보임 · 물탄 5발' },
  mothCrystal: { name: '빛을 쫓음', desc: '밝으면 빠르게 달려들고 두 대 맞아야 떨어짐', hear: 0, litSpeed: 1.4 },
  shadeAssassin: { name: '어둠눈', desc: '어둠도 보지만 섬광에 눈이 멂 · 4연속 베기', flashBlind: 150 },
  emberGuard: { name: '둔한 귀', desc: '내려찍으면 불길이 바닥을 타고 퍼짐', hear: 0.6 },
  starSpear: { name: '경계병', desc: '어둠 속에서 찾아내면 주변에 경보 · 긴 찌르기', alarm: 260 },
};

// 엘리트 수식어 (판마다 무작위)
export const ELITE_MODS = {
  swift: { name: '가속', desc: '빠르고 쉴 틈이 적다' },
  split: { name: '분열', desc: '쓰러지면 나방 둘이 나온다' },
  iron:  { name: '강철', desc: '체력이 높고 자세가 잘 무너지지 않는다' },
  shield: { name: '수호 방패', desc: '정면 공격을 막는 빛의 방패 (3번 맞거나 완벽 패링하면 깨지고 크게 비틀거림)' },
  mirage: { name: '분신', desc: '자기와 똑같은 분신 둘을 만든다 (분신은 한 방, 빛 테두리가 있는 쪽이 진짜)' },
};
export const ELITE = { barrier: 3, barrierRegenF: 600, breakStaggerF: 100, mirageF: 480, decoys: 2 };

export function rng(w) {           // 결정적 난수 (월드에 상태 저장)
  w.seed = (w.seed * 1664525 + 1013904223) >>> 0;
  return w.seed / 4294967296;
}

export const EMERGE_F = 48;   // 웨이브 적이 땅에서 솟아오르는 시간 (0.8초)
export function spawnEnemy(w, kind, x, y, opt = {}) {
  const d = ENEMY_DEFS[kind], hpMul = opt.hpMul || 1;
  const e = {
    kind, x, y, w: d.w, h: d.h, vx: 0, vy: 0, face: -1, onGround: false,
    hp: Math.round(d.hp * hpMul), maxHp: Math.round(d.hp * hpMul), boss: !!d.boss, poise: 0, poiseMax: !!d.poise || !d.oneHit, poiseRes: d.boss ? 1 : CFG.poise.mobRes, stunT: 0,   // 일반 적도 그로기 (나방 제외)
    poiseRegenT: 0,
    st: 'idle', stT: 0, atk: null, srcs: [], cd: 30, spawnT: opt.emerge ? EMERGE_F : 0, hitBy: -1, flash: 0, kvx: 0, staggerT: 0,
    shield: !!d.shield, counter: !!d.counter,
    speed: d.speed, range: d.range, cdMul: 1, mods: [], forceNext: null, variant: opt.variant || null, dashDx: 0, dashDy: 0,
  };
  w.enemies.push(e);
  if (w.events) w.events.push({ type: 'spawn', kind, x: x + d.w / 2, y: y + d.h, boss: !!d.boss });
  return e;
}

export function makeElite(e, mod) {
  e.elite = true; e.poiseMax = true; e.mods = [mod];
  e.hp = e.maxHp = Math.round(e.maxHp * (mod === 'iron' ? 3.5 : 2.5));
  if (mod === 'swift') { e.speed *= 1.6; e.cdMul = 0.5; }
  if (mod === 'iron') e.poiseRes = 0.6;
  if (mod === 'shield') { e.barrier = e.barrierMax = ELITE.barrier; e.barrierCd = 0; }   // 수호 방패
  if (mod === 'mirage') e.mirageT = 40;                                                // 분신: 곧 첫 분신
}
// 강적 기믹 매 틱: 방패 재생, 분신 만들기 (분신은 체력 1, 나방처럼 한 방)
export function updateElite(w, e) {
  if (e.barrierMax && e.barrier <= 0 && --e.barrierCd <= 0) { e.barrier = e.barrierMax; w.events.push({ type: 'barrierUp', x: e.x + e.w / 2, y: e.y }); }
  if (e.mods && e.mods.includes('mirage') && !e.decoy && e.stunT <= 0 && --e.mirageT <= 0) {
    e.mirageT = ELITE.mirageF;
    const alive = w.enemies.filter(o => o.master === e && !o.dead).length;
    for (let k = alive; k < ELITE.decoys; k++) {
      const x = Math.max(40, Math.min(w.width - 40 - e.w, e.x + (k ? 1 : -1) * (90 + 30 * k)));
      const d = spawnEnemy(w, e.kind, x, e.y, { hpMul: 1, emerge: true });
      d.hp = d.maxHp = 1; d.decoy = true; d.master = e; d.poiseMax = false;
      w.events.push({ type: 'mirage', x: x + e.w / 2, y: e.y + e.h / 2 });
    }
  }
  if (e.decoy && (!e.master || e.master.dead)) { e.dead = true; w.events.push({ type: 'kill', kind: e.kind, x: e.x + e.w / 2, y: e.y + e.h / 2, decoy: true, dummy: true }); }   // 진짜가 쓰러지면 분신도 사라짐
}

// 공격 템포: 예고·후딜에 CFG.enemy.tempo 배율 (판정 길이는 그대로)
export const telegraphOf = (e, a) => Math.round(a.telegraphF * CFG.enemy.tempo) - (e.boss && e.hp <= e.maxHp / 2 ? 4 : 0) + (a.delay ? e.tgExtra || 0 : 0);   // delay: 같은 자세로 더 오래 끌다 내려침 (막판 깜빡임은 실제 타이밍에 맞춤)
export const recoverOf = a => Math.round(a.recoverF * CFG.enemy.tempo);

const onScreen = (w, e) => e.x + e.w > w.camX && e.x < w.camX + CFG.VIEW_W;
const attackers = w => w.enemies.filter(e => !e.boss && !e.dead && (e.st === 'telegraph' || e.st === 'active')).length;

function setSt(e, st) { e.st = st; e.stT = 0; }

function startAttack(w, e, d, dx, name) {
  e.atk = name; e.face = Math.sign(dx) || e.face;
  const a0 = d.attacks[name]; e.tgExtra = a0.delay && rng(w) < 0.5 ? Math.round(a0.delay * (0.5 + 0.5 * rng(w))) : 0;   // 절반은 늦게
  setSt(e, 'telegraph');
  w.events.push({ type: 'telegraph', boss: e.boss, parryable: d.attacks[name].parryable, kind: e.kind, atk: name });
}

// 적이 리라를 보는가: 밝으면 늘 봄. 소등(어둠) 중엔 보스·어둠을 보는 적만 보고, 나머지는 소리(발소리·공격)나 사제의 물빛 안에서만
export function seesPlayer(w, e) {
  const p = w.player, d = ENEMY_DEFS[e.kind];
  if (e.blindT > 0) return false;                                       // 귀화 폭발: 잠깐 눈이 멂
  if (!p.dark) return true;
  if (e.boss || d.darkSight) return true;
  const dist = Math.abs(p.x + p.w / 2 - (e.x + e.w / 2)) + Math.abs(p.y - e.y) * 0.5;
  if (baseOf(e.kind) === 'priest' && dist < 110) return true;                    // 사제의 물빛 구슬
  const R = DARK_REACT[e.kind], hear = R && R.hear !== undefined ? R.hear : 1;   // 귀가 밝은 적·어두운 적 (나방은 소리를 못 들음)
  return p.noiseT > 0 && dist < (p.noiseR || 0) * hear;
}
export function updateEnemy(w, e) {
  if (Math.abs(e.kvx) > 0.05) {          // 넉백: 벽에 막히면 멈춤
    const x0 = e.x; e.x += e.kvx; e.kvx *= 0.8;
    if (w.solids.some(s => !s.oneWay && e.x < s.x + s.w && e.x + e.w > s.x && e.y < s.y + s.h && e.y + e.h > s.y)) { e.x = x0; e.kvx = 0; }
  } else e.kvx = 0;
  if (e.update) return e.update(w, e);    // 테스트 더미
  if (e.spawnT > 0) { e.spawnT--; e.vx = 0; if (!ENEMY_DEFS[e.kind].fly) physics(w, e); return; }   // 등장 중: 행동·피격 없음
  const d = ENEMY_DEFS[e.kind], p = w.player;
  let dx = (p.x + p.w / 2) - (e.x + e.w / 2);
  e.stT++;
  if (e.blindT > 0) e.blindT--; if (e.hitT > 0) e.hitT--; if (e.armorT > 0) e.armorT--;
  const vis = seesPlayer(w, e) && !e.ghostBlind, was = e.unaware; e.unaware = !vis;   // 귀화 등잔: 빛 안의 그림자는 리라를 못 봄        // 소등: 리라를 못 보면 마지막으로 본 자리를 뒤진다
  if (vis) { e.lastX = p.x + p.w / 2; e.searchT = 0; }
  const RX = DARK_REACT[e.kind];
  if (vis && was && p.dark && RX && RX.alarm && !e.boss) {               // 경계병: 어둠 속에서 찾아내면 주변 적이 그쪽으로
    for (const o of w.enemies) if (o !== e && !o.dead && Math.abs(o.x - e.x) < RX.alarm) o.lastX = p.x + p.w / 2;
    w.events.push({ type: 'alarm', x: e.x + e.w / 2, y: e.y, r: RX.alarm });
  }
  else { const ex = e.x + e.w / 2, tx = e.lastX ?? ex; e.searchT = (e.searchT || 0) + 1; dx = Math.abs(tx - ex) > 14 ? tx - ex : ((e.searchT >> 6) & 1 ? 0.001 : -0.001); }
  if (e.frozenT > 0) e.frozenT--; if (e.rootT > 0) e.rootT--; if (e.slowT > 0) e.slowT--; if (e.brittleT > 0) e.brittleT--;   // 마법 효과: 발 묶음 · 둔화 · 취약
  if (e.staggerT > 0) { e.staggerT--; if (!d.fly) { e.vx = 0; physics(w, e); } return; }

  if (e.st === 'idle') {
    if (e.cd > 0) e.cd--;
    const sp0 = e.speed; if (e.rootT > 0) e.speed = 0; else if (e.slowT > 0) e.speed *= 0.5;   // 발 묶음 · 둔화: 이동 속도만
    if (RX && RX.litSpeed && !p.dark && !e.boss) e.speed *= RX.litSpeed;  // 나방: 등불빛을 쫓아 빨라짐
    if (e.lightSlow && e.lightSlow < 1) e.speed *= e.lightSlow;           // 얼음 등잔: 빛 안의 그림자는 느려짐
    if (!e.boss && lightReact(w, e, dx)) { /* 빛 반응이 움직임을 정함 */ }
    else if (e.boss) bossMove(w, e, dx);
    else if (d.fly) mothHover(w, e, dx);
    else if (d.keepAway) keepDistance(w, e, dx, d.keepAway);
    else walkToward(w, e, dx);
    e.speed = sp0;
    if (d.blink && e.cd <= 0 && Math.abs(dx) > 90 && Math.abs(dx) < 400 && attackers(w) < CFG.enemy.maxAttackers && onScreen(w, e)) {
      // 순간이동: 리라 등 뒤로. 예고는 새 위치에서 시작하므로 공정함
      const nx = p.x + p.w / 2 - p.face * 56 - e.w / 2;
      if (nx > 0 && nx + e.w < w.width) { e.x = nx; w.events.push({ type: 'blink', x: e.x + e.w / 2, y: e.y + e.h / 2 }); }
    }
    const want = vis && (e.boss ? bossWant(w, e, dx) : Math.abs(dx) < e.range && Math.abs(p.y - e.y) < 120);   // 못 보면 공격을 시작하지 않음
    const tokenOk = e.boss || attackers(w) < CFG.enemy.maxAttackers;
    if (e.cd <= 0 && want && tokenOk && onScreen(w, e) && p.state !== 'dead') {
      const ad = Math.abs((p.x + p.w / 2) - (e.x + e.w / 2)), names = Object.keys(d.attacks).filter(n => !d.attacks[n].near || ad < d.attacks[n].near);
      startAttack(w, e, d, (p.x + p.w / 2) - (e.x + e.w / 2), e.boss ? bossPick(w, e, dx) : names[(rng(w) * names.length) | 0]);
    }
  } else if (e.st === 'telegraph') {
    if (!d.fly) { e.vx = 0; physics(w, e); }
    if (e.stT >= telegraphOf(e, d.attacks[e.atk])) {
      setSt(e, 'active'); e.srcs = [];
      const a = d.attacks[e.atk];
      w.events.push({ type: 'enemyStrike', kind: e.kind, atk: e.atk, x: e.x + e.w / 2 - e.face * 14, y: e.y + e.h, face: e.face, reach: a.reach || 0 });
      if (a.dashSpeed) { const l = Math.hypot(dx, (p.y + 28) - e.y) || 1; e.dashDx = dx / l; e.dashDy = ((p.y + 28) - e.y) / l; }
      if (a.charge) e.face = Math.sign(dx) || e.face;
      if (a.wave) spawnWaves(w, e, a);
      if (a.rain) spawnRain(w, e, a);
    }
  }
  if (e.st === 'active') {   // 예고가 끝난 그 틱부터 판정
    const a = d.attacks[e.atk], hits = a.hits || 1, gap = a.gapF || 0;
    const hb = (k, x, y, w2, h2, dir) => {
      if (!e.srcs[k]) e.srcs[k] = {};
      w.hitboxes.push({ src: e.srcs[k], owner: e, x, y, w: w2, h: h2, dmg: a.dmg, parryable: a.parryable, dir });
    };
    if (a.dashSpeed) {
      e.vx = e.dashDx * a.dashSpeed; e.x += e.vx; e.y += e.dashDy * a.dashSpeed;
      hb(0, e.x, e.y, e.w, e.h, Math.sign(e.vx) || e.face);
    } else if (a.charge) {
      e.vx = e.face * a.charge; moveAndCollide(w, e);
      hb(0, e.x - 4, e.y, e.w + 8, e.h, e.face);
    } else {
      for (let k = 0; k < hits; k++) {
        const t0 = k * gap;
        if (e.stT === t0 && a.bolt) spawnBolt(w, e, a);
        if (e.stT >= t0 && e.stT < t0 + a.activeF) {
          if (a.reach) hb(k, e.face > 0 ? e.x + e.w : e.x - a.reach, e.y + e.h - (a.height || e.h), a.reach, a.height || e.h, e.face);
          if (a.beam) { const [bx, bl] = clipBeam(w, e, e.face > 0 ? e.x + e.w : e.x - a.beam.len, a.beam.len, e.y + a.beam.y, a.beam.h); e.beamX = bx; e.beamL = bl; if (bl > 0) hb(k, bx, e.y + a.beam.y, bl, a.beam.h, e.face); }   // 수정 거울에서 끊김
          if (a.ring) hb(k, e.x - a.ring, e.y - 10, e.w + a.ring * 2, e.h + 10, Math.sign(-dx) || e.face);
        }
      }
    }
    if (!d.fly && !a.charge) { e.vx = 0; physics(w, e); }
    if (e.stT >= (hits - 1) * gap + a.activeF) setSt(e, 'recover');
  } else if (e.st === 'recover') {
    if (!d.fly) { e.vx = 0; physics(w, e); }
    if (e.stT >= recoverOf(d.attacks[e.atk])) {
      setSt(e, 'idle');
      const [lo, hi] = d.cooldown; e.cd = Math.round((lo + Math.floor(rng(w) * (hi - lo))) * e.cdMul * CFG.enemy.tempo);
      if (!e.boss && !d.fly && !d.keepAway && rng(w) < 0.45) e.backT = 18;          // 공격 뒤 한 걸음 물러나 간격을 잼
    }
  }
}

// 조준탄: 리라 허리 높이(검을 든 높이)를 향해 낮게. 기울기는 완만하게 제한해 패링 자세로 받기 쉽게
function spawnBolt(w, e, a) {
  const p = w.player, b = a.bolt;
  const sx = e.face > 0 ? e.x + e.w : e.x - b.w, sy = e.y + e.h * 0.55 - b.h / 2;
  const tx = p.x + p.w / 2, dx = tx - sx, ty0 = p.y + p.h * 0.62 - b.h / 2;
  const ty = sy + Math.max(-0.35, Math.min(0.35, (ty0 - sy) / (Math.abs(dx) || 1))) * Math.abs(dx), l = Math.hypot(dx, ty - sy) || 1;
  w.projectiles.push({ x: sx, y: sy, w: b.w, h: b.h, vx: (tx - sx) / l * b.speed, vy: (ty - sy) / l * b.speed,
    dmg: a.dmg, parryable: a.parryable, owner: 'enemy', life: 160, src: e, bolt: baseOf(e.kind) });
  w.events.push({ type: 'bolt', x: sx, y: sy });
}

// 바닥 충격파 양쪽 (패링 불가 → 점프·회피)
export function spawnWaves(w, e, a) {
  const floorY = e.y + e.h, cx = e.x + e.w / 2;
  for (const dir of [-1, 1]) {
    w.projectiles.push({
      x: cx + dir * (e.w / 2) - (dir < 0 ? a.wave.w : 0), y: floorY - a.wave.h, w: a.wave.w, h: a.wave.h,
      vx: dir * a.wave.speed, vy: 0, dmg: a.dmg, parryable: false, owner: 'enemy', life: a.wave.life, src: e, wave: true,
    });
  }
  w.shake = 10;
  w.events.push({ type: 'slam', kind: e.kind });
}

// 낙하 파편: 리라 위쪽에서 떨어짐 (예고 동안 표시는 렌더가 rainMark로)
const DEBRIS_OF = { bellBoss: 'rock', spider: 'crystal', king: 'star', forge: 'molten', saint: 'water' };   // 떨어지는 것의 모양 (그림만 다름)
export function spawnRain(w, e, a) {
  const p = w.player;
  for (let i = 0; i < a.rain.n; i++) {
    const x = p.x + p.w / 2 + (i - (a.rain.n - 1) / 2) * a.rain.gap;
    w.projectiles.push({ x: x - 7, y: -20 - i * 30, w: 14, h: 18, vx: 0, vy: a.rain.speed, dmg: a.dmg,
      parryable: a.parryable, owner: 'enemy', life: 200, src: e, shard: true, debris: DEBRIS_OF[e.kind] || 'rock', spin: (i * 1.7 + w.t * 0.37) % 6.28 });
  }
}

function physics(w, e) {
  e.vy = Math.min(CFG.MAX_FALL, e.vy + CFG.GRAV);
  const want = e.vx, ground = e.onGround;
  moveAndCollide(w, e);
  // 걷다가 언덕 벽에 막히면 뛰어오른다 (언덕 높이만큼)
  if (ground && want && !e.vx && !e.boss && e.st === 'idle') {
    const wall = w.solids.find(s => !s.oneWay && s.y < e.y + e.h && s.y > e.y + e.h - 90 && (want > 0 ? Math.abs(s.x - (e.x + e.w)) < 2 : Math.abs(s.x + s.w - e.x) < 2));
    if (wall) { e.vy = -Math.sqrt(2 * CFG.GRAV * (e.y + e.h - wall.y + 10)); e.onGround = false; e.hopVx = want; }
  }
  if (!e.onGround && e.hopVx) { e.x += e.hopVx; if (w.solids.some(s => !s.oneWay && overlap(e, s))) e.x -= e.hopVx; }   // 공중에서도 앞으로
  if (e.onGround) e.hopVx = 0;
}

function walkToward(w, e, dx) {
  e.face = Math.sign(dx) || e.face;
  const ad = Math.abs(dx);
  if (e.backT > 0) { e.backT--; e.vx = -e.face * e.speed * 1.3; }                                    // 물러나기
  else if (e.cd > 0 && ad < e.range * 1.5 && !e.unaware) e.vx = e.face * e.speed * 0.45 * Math.sin((w.t + (e.x | 0) * 3) / 34);   // 간 보기: 공격 전 앞뒤로 어르며 거리 재기
  else e.vx = ad > e.range * 0.6 && ad < CFG.enemy.aggro ? e.face * e.speed : 0;
  physics(w, e);
}

function keepDistance(w, e, dx, far) {
  e.face = Math.sign(dx) || e.face;
  const ad = Math.abs(dx);
  e.vx = ad < far * 0.8 ? -e.face * e.speed : ad > e.range * 0.9 && ad < CFG.enemy.aggro ? e.face * e.speed : 0;
  physics(w, e);
}

function bossMove(w, e, dx) {
  e.face = Math.sign(dx) || e.face;
  e.vx = Math.abs(dx) > ENEMY_DEFS[e.kind].range * 0.8 ? e.face * e.speed : 0;
  physics(w, e);
}

// 그림자들의 빛 반응 (설계 1-5). 움직임을 정했으면 true
//   구울·창병·순례자: 빛을 싫어해 공격할 때가 아니면 빛 밖으로 물러남 (가장자리를 맴돎)
//   나방: 던진 등불로 달려듦 · 암살자: 놓인 등불을 노려 끔 (2초)
function lightReact(w, e, dx) {
  const k = baseOf(e.kind), p = w.player, Lp = p.lamp; if (!Lp) return false;
  const out = Lp.st === 'placed' || Lp.st === 'fly';
  if (k === 'moth' && out) { mothHover(w, e, dx, { x: Lp.x, y: Lp.y }); return true; }
  if (k === 'assassin' && Lp.st === 'placed' && !(Lp.offT > 0) && Math.abs(Lp.x - (e.x + e.w / 2)) < Math.abs(dx) + 40) {
    const lx = Lp.x - (e.x + e.w / 2); e.face = Math.sign(lx) || e.face;
    if (Math.abs(lx) < 26) { Lp.offT = CFG.lantern.offF; e.cd = Math.max(e.cd, 70); w.events.push({ type: 'lampSnuffed', x: Lp.x, y: Lp.y }); e.vx = 0; }
    else e.vx = e.face * e.speed * 1.2;
    physics(w, e); return true;
  }
  if ((k === 'ghoul' || k === 'spearman' || k === 'priest') && e.inLightNow && !(e.burnSolidT > 0) && e.cd > 0) {
    const S = lightSources(w); let best = null, bd = 1e9;
    for (const s of S) { const dd = Math.hypot(s.x - (e.x + e.w / 2), s.y - (e.y + e.h / 2)); if (dd < bd) { bd = dd; best = s; } }
    if (best) { e.face = Math.sign(dx) || e.face; e.vx = Math.sign((e.x + e.w / 2) - best.x || -e.face) * e.speed * (k === 'priest' ? 1.2 : 1); physics(w, e); return true; }
  }
  return false;
}

function mothHover(w, e, dx, lure) {
  const p = w.player;
  const side = dx > 0 ? -1 : 1;                          // 리라 기준 자기 쪽에 머묾
  const tx = lure ? lure.x + Math.sin(w.t * 0.05 + e.x) * 30 : p.x + side * 120, ty = lure ? lure.y - 30 : p.y - 60;   // 던진 등불이 있으면 그 둘레를 맴돎
  const mx = tx - e.x, my = ty - e.y, l = Math.hypot(mx, my);
  if (l > 4) { e.vx = mx / l * e.speed; e.x += e.vx; e.y += my / l * e.speed; }
  e.y += Math.sin(w.t * 0.1) * 0.3;
  e.face = Math.sign(dx) || e.face;
}
