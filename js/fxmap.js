// 게임 상황 → pixelfx 이펙트 연결표. 렌더러가 매 틱 events()·tick()을 부른다
// (pixelfx 244종 중 이 게임 분위기에 맞는 것을 상황마다 골라 씀. 총기·SF 계열은 제외)
import { preload } from './fx.js?v=mwzt5ovx';
import { CFG } from './core/config.js?v=mwzt5ovx';
import { groundAt } from './core/world.js?v=mwzt5ovx';
import { baseOf } from './core/enemies.js?v=mwzt5ovx';

// 팔레트 (어둠 → 밝음)
const AMBER = ['#4a1a0c', '#8c3414', '#d0661e', '#ffa63a', '#ffd27a', '#fff0c8', '#ffffff'];
const SPARK = ['#fff6c8', '#ffd86b', '#ff9a2a', '#e8561d'];
const GOLD = ['#4a2a0c', '#8c5a14', '#d09a1e', '#ffc63a', '#ffe27a', '#fff6c8', '#ffffff'];
const VIOLET = ['#1a0a2a', '#3a1660', '#6a2aa0', '#9a4ae0', '#c890ff', '#f0e0ff', '#ffffff'];
const GREY = ['#1a1820', '#3a3640', '#5e5866', '#8a8494', '#b8b2c2', '#e4e0ea', '#ffffff'];
const LILAC = ['#1e1430', '#3c2a5c', '#6a4e96', '#9a7ccc', '#c8b0f0', '#ece2ff', '#ffffff'];
const GREEN = ['#0a1a0c', '#16361a', '#24582a', '#3a8a3a', '#6ac25a', '#b4ec8a', '#f0ffe0'];
const TEAL = ['#04161a', '#0a3438', '#11606a', '#1aa0a8', '#5ae0d8', '#b8fff4', '#ffffff'];   // 도깨비불: 푸른 귀화
const SHADE = ['#06020c', '#14081e', '#2a1040', '#4a1a6a', '#7a2ea0', '#c070e0', '#f0d0ff'];   // 흑염: 검보라
const GHOST = ['#020104', '#0a0414', '#180a2a', '#2c1048', '#48206e', '#74409e', '#b498d6'];   // 귀화(등불): 어두운 보랏빛 영혼불 — 얼음(푸른빛)과 겹치지 않게
const VOLT = ['#1a1404', '#4a3a08', '#8a6e10', '#d0b020', '#ffe24a', '#fff6a8', '#ffffff'];   // 번개(투지): 노란 전격
const HELL = ['#0c0204', '#2a0408', '#5a0a10', '#961618', '#d02a1e', '#ff5a30', '#ffb08a'];   // 함정·위험 불 (검붉음)
const CYAN = ['#0a1e2a', '#14405a', '#22708e', '#3aa6c0', '#7cd8e8', '#cef4fa', '#ffffff'];
// 마법별 색 (마법진·모이는 빛). 함수라서 아래쪽 팔레트 상수를 써도 됨
const elPal = el => ({ str: AMBER, agi: ICE, wil: GOLD, lmp: GHOST, vit: GREEN, fury: VOLT })[el] || AMBER;   // 점화한 불꽃 속성 → 팔레트
const palOf = sp => ({ bolt: AMBER, wisps: GHOST, pillar: AMBER, tornado: AMBER, meteor: AMBER, ring: GHOST, lance: ICE, spikes: ICE, stars: ICE, ward: GOLD, thunder: GOLD, chain: VOLT,
  smite: GOLD, spear: GHOST, blast: VOLT, heal: GREEN, sanctum: GREEN, thorns: GREEN, drain: VOLT })[sp] || AMBER;   // 스탯 속성별 색: 힘 화염 · 민첩 얼음 · 의지 빛 · 등불 귀화 · 생명 자연 · 투지 번개
const HIT = ['#1a0e06', '#3a2410', '#6a4420', '#9a6a34', '#c4955a', '#e0bc88', '#f0dcb8'];   // 기본 타격: 흰빛 없는 톤
const ICE = ['#081a2a', '#10345a', '#1e5a8c', '#3a8cc8', '#7ac0f0', '#c0e8ff', '#ffffff'];
const BLOOD = ['#14040a', '#3a0a14', '#6a101c', '#a01824', '#d42a30', '#ff5a50', '#ff9a8a', '#ffe6de'];
const NO_IRON = [0, 0, 0, 0, 0];                                        // 화로 불만 (쇠 받침대는 그리지 않음 — 제단·등대 그림에 이미 그릇이 있음)
const DUST = ['#1c1610', '#33281c', '#4f3f2c', '#6e5a40', '#927a58', '#b89f78', '#dcc8a2'];

// 지역별 배경 생물·불빛 (월드 고정 위치의 반복 이펙트) + 화면 날씨
// 배경 장식: 게임 요소(아이템·함정·적·마법진·떠다니는 생물)처럼 보이는 것은 쓰지 않는다. 바닥 장식은 방 가장자리, 벽 장식은 벽 높이에.
// [id, x비율, y] — 배경 레이어(어둠 아래)에 그려져 캐릭터보다 뒤로 물러나 보인다
const AMBIENT = {
  1: { world: [['fire/candle', 0.03, 300], ['fire/candle', 0.97, 300]],
       screen: ['weather/fog', 'weather/fireflies'], boss: [['fire/candle', 0.03, 300], ['fire/candle', 0.97, 300]] },   // 보스방 양끝: 장식 촛불 (기믹 아님)
  2: { world: [['water/drip', 0.2, 40], ['water/drip', 0.5, 30], ['water/drip', 0.8, 40], ['fire/candle', 0.03, 300], ['fire/candle', 0.97, 300]],
       screen: ['weather/god-rays'], boss: [['water/waterfall', 0.04, 220], ['water/waterfall', 0.96, 220], ['water/drip', 0.5, 30]] },
  3: { world: [['fire/torch', 0.04, 250], ['fire/torch', 0.96, 250]],
       screen: ['weather/fog'], boss: [['fire/torch', 0.04, 250], ['fire/torch', 0.96, 250]] },
  4: { world: [['fire/spirit-flame', 0.03, 300], ['fire/spirit-flame', 0.97, 300]],
       screen: ['weather/aurora'], boss: [['shadow/shadow-flames', 0.03, 300], ['shadow/shadow-flames', 0.97, 300]] },
  5: { world: [['fire/brazier', 0.03, 300], ['fire/brazier', 0.97, 300]],
       screen: ['weather/fog'], boss: [['fire/brazier', 0.03, 300], ['fire/brazier', 0.97, 300]] },   // 용광로: 양끝 화로 · 연기
  6: { world: [['fire/spirit-flame', 0.03, 300], ['fire/spirit-flame', 0.97, 300]],
       screen: ['weather/fog', 'weather/shooting-stars'], boss: [['fire/spirit-flame', 0.03, 300], ['fire/spirit-flame', 0.97, 300]] },   // 왕좌: 푸른 귀화 · 떨어지는 별
};

// 적 등장 · 공격 · 쓰러짐
const SPAWN = { ghoul: 'spawn/summon-rise', moth: 'spawn/poof', spearman: 'water/splash', priest: 'water/geyser', shellguard: 'nature/earth-spike', assassin: 'shadow/shadow-tendrils' };
// 적 공격 궤적은 리라가 쓰는 베기(sword-slash·uppercut·spear-sweep·heavy-cleave·double-slash)와 절대 겹치지 않게 — 한눈에 '내 공격 / 적 공격' 구분
const STRIKE = { ghoul: ['melee/claw-swipe', GREY], spearman: ['melee/thrust', CYAN], shellguard: ['impacts/blunt-hit', LILAC], assassin: ['melee/dagger-flurry', VIOLET],
  bellBoss: ['impacts/ground-slam', DUST], spider: ['melee/scythe-reap', LILAC], shadow: ['melee/spin-slash', VIOLET], saint: ['melee/whip-crack', CYAN], forge: ['melee/hammer-smash', AMBER], king: ['impacts/impact-frame', CYAN] };   // 적 11종 모두 서로 다른 궤적
const DEATH = { ghoul: ['shadow/necro-skulls', GREY], moth: ['holy/feather-burst', DUST], spearman: ['water/rain-splash'], priest: ['water/bubbles'], shellguard: ['explosions/dirt-explosion', LILAC], assassin: ['shadow/hex-sigil', VIOLET] };   // 적 죽음: 보스 기믹(물결·얼음 깨짐·연기)·처형 고리와 겹치지 않게   // 처형 고리(implosion)와 겹치지 않게
// 착탄 순간 2단 연출 (마법 레이어, 2배 굵은 픽셀): [이펙트, 옵션] 여러 개 + 화면 번쩍 세기
const LAND = {
  pillar:  [[['impacts/ground-slam', { palette: AMBER }], ['fire/fire-ring', { light: 0.3 }]], 0.35],
  tornado: [[['impacts/hit-spark', { palette: AMBER, height: 30 }]], 0.15],
  meteor:  [[['explosions/big-explosion', { palette: AMBER, light: 0.6 }], ['nature/quake', { palette: DUST }]], 0.8],
  stars:   [[['ice/snowflake-burst', { light: 0.3 }]], 0.2],
  smite:   [[['holy/sunburst', { palette: GOLD, dy: -40, life: 50 }]], 0.6],
  thunder: [[['holy/sunburst', { palette: GOLD, light: 0.5 }], ['impacts/ground-slam', { palette: GOLD }]], 0.7],   // 빛기둥 착탄
  blast:   [[['explosions/plasma-explosion', { palette: VOLT, light: 0.6 }], ['lightning/zap-hit', { palette: VOLT, light: 0.5 }]], 0.75],   // 뇌전 폭발
  spikes:  [[['ice/frost-nova', { light: 0.3 }]], 0.3],
  thorns:  [[['impacts/hit-spark', { palette: GREEN, height: 26, light: 0.3 }], ['nature/quake', { palette: DUST }]], 0.25],   // 덩굴이 땅을 뚫고 나온 자리
};
const BOLT = { lance: ['ice/ice-lance', { light: 0.3 }], wisp: ['fire/fireball', { palette: GHOST, light: 0.35 }], lamp: ['fire/fireball', { palette: ['#3a1204', '#7a2a08', '#c0560e', '#ff9a2a', '#ffcf6a', '#fff0c8', '#ffffff'], light: 0.4 }], priest: ['water/water-orb', { radius: 7, dy: 52 }], saint: ['projectiles/arrow', { palette: CYAN }], king: ['arcane/arcane-orb', { palette: CYAN, dy: 50 }], bellBoss: ['projectiles/plasma-shot', { palette: DUST }], shadow: ['shadow/void-orb', { dy: 62 }] };   // 성녀 물창 = 화살 모양(리라 얼음 창과 구분), 무덤종 종소리 = 흙빛 구슬(리라 번개와 구분)

export const ALL_IDS = [...new Set([
  ...Object.values(AMBIENT).flatMap(a => [...a.world.map(x => x[0]), ...a.screen, ...a.boss.map(x => x[0])]),
  ...Object.values(STRIKE).map(x => x[0]), ...Object.values(BOLT).map(x => x[0]),
  'melee/sword-slash', 'melee/uppercut', 'melee/heavy-cleave', 'impacts/hit-spark', 'impacts/crit-hit', 'impacts/parry', 'impacts/impact-frame', 'impacts/blunt-hit',
  'impacts/shield-block', 'impacts/heavy-landing', 'impacts/ground-slam', 'nature/quake', 'ui/damage-quiet', 'ui/crit-number', 'ui/heart-lost', 'ui/combo-counter',
  'ui/quest-complete', 'ui/achievement', 'nature/healing-bloom', 'fire/fire-ring', 'holy/sunburst', 'holy/feather-burst', 'shadow/dark-explosion', 'spawn/soul-rise',
  'projectiles/energy-disc', 'ice/ice-crystal', 'water/wave-crash', 'ice/snowflake-burst', 'lightning/spark-arc', 'lightning/lightning-strike', 'status/stunned',
  'status/burning', 'status/rage', 'arcane/rune-circle', 'shadow/shadow-tendrils', 'pickups/collect-burst', 'explosions/big-explosion', 'explosions/plasma-explosion',
  'holy/holy-pillar', 'ice/icicle-fall', 'fire/spirit-flame', 'lightning/spark-arc', 'shadow/shadow-flames', 'nature/vine-whip', 'transitions/iris', 'transitions/slash-wipe', 'transitions/pixel-dissolve', 'transitions/shatter-wipe', 'transitions/burn-away',
])];

export class FxDirector {
  constructor(R) { this.R = R; this.seen = new WeakSet(); this.elites = new WeakSet(); this.burning = new WeakMap(); this.bodyFx = new WeakMap(); this.prevLight = 0; this.streak = 0; }
  preloadRegion(region) {
    const a = AMBIENT[region] || AMBIENT[1];
    preload([...a.world.map(x => x[0]), ...a.screen, ...a.boss.map(x => x[0])]);
    preload(['melee/heavy-cleave', 'explosions/implosion', 'arcane/magic-circle-cast', 'arcane/spell-charge', 'arcane/mana-burst', 'ice/ice-shatter', 'fire/brazier', 'transitions/iris', 'fire/campfire', 'arcane/portal', 'melee/sword-slash', 'melee/uppercut', 'melee/spear-sweep', 'fire/fireball', 'ice/ice-lance', 'fire/flame-pillar', 'lightning/lightning-strike', 'fire/meteor', 'arcane/star-fall', 'holy/divine-shield', 'arcane/arcane-beam', 'ice/frost-nova', 'holy/heal', 'holy/holy-pillar', 'fire/fire-tornado', 'ice/ice-spikes', 'holy/smite', 'nature/thorns', 'shadow/life-steal', 'lightning/chain-lightning', 'lightning/zap-hit', 'shadow/dark-explosion', 'holy/heal-aoe', 'explosions/small-explosion', 'ice/snowflake-burst', 'water/wave-crash', 'ice/ice-shatter', 'nature/boulder', 'spawn/poof', 'pickups/collect-burst', 'water/ripples', 'water/splash', 'melee/double-slash', 'arcane/blink-in', 'lightning/thunderclap', 'explosions/plasma-explosion', 'holy/sunburst', 'nature/healing-bloom', 'holy/feather-burst', 'explosions/big-explosion', 'explosions/implosion', 'nature/quake', 'impacts/ground-slam', 'impacts/hit-spark', 'impacts/crit-hit', 'impacts/parry', 'ui/damage-quiet', 'transitions/burn-away']);
  }

  // 방에 들어올 때: 배경 생물·불빛·날씨 + 장면 전환
  enterRoom(w, region, boss) {
    const R = this.R, a = AMBIENT[region] || AMBIENT[1];
    R.weather.clear(); this.seen = new WeakSet(); this.elites = new WeakSet(); this.bodyFx = new WeakMap(); this.recent = []; this.prevLight = 0; this.streak = 0;
    R.bgfx.clear(); for (const [id, fx, y] of (boss ? a.boss : a.world)) R.bgfx.spawn(id, w.width * fx, y, { light: 0.4 });
    for (const id of a.screen) R.weather.spawn(id, 160, 170, {});   // 날씨 원점 = 화면 하단 중앙 (meta.origin)
    if (w.haven) {                                                       // 쉼터 오브젝트: 모닥불(휴식) · 출구 포탈 (밝게 = 상호작용 가능)
      for (const o of w.props) {
        if (o.kind === 'campfire') { R.propfx.spawn('fire/campfire', o.x, 300, { light: 0.5 }); for (const d of [-110, 110]) R.bgfx.spawn('fire/candle', o.x + d, 300, { light: 0.3 }); }
        if (o.kind === 'merchant') { R.propfx.spawn('fire/brazier', o.x + 90, 300, { light: 0.35 }); R.bgfx.spawn('fire/candle', o.x - 100, 300, { light: 0.3 }); }
        if (o.kind === 'keeper' || o.kind === 'board') R.bgfx.spawn('fire/candle', o.x + (o.kind === 'keeper' ? -60 : 40), 300, { light: 0.3 });
        if (o.kind === 'altar') { R.propfx.spawn('fire/brazier', o.x - 10, 234, { light: 0.55, iron: NO_IRON }); for (const d of [-70, 70]) R.bgfx.spawn('fire/candle', o.x + d, 300, { light: 0.3 }); }   // 불: 제단 그림의 그릇(왼쪽 10px, 꼭대기) 위
      }
    }
    R.trans.clear(); if (!boss) R.iris(w, 'open');   // 방 입장: 리라를 중심으로 아이리스가 열림 (보스방은 등장 연출이 대신)
  }

  // 이펙트 연출 규칙 (눈 아프지 않게):
  //  1) 한 틱에 '주인공' 사건이 있으면 (완벽 패링·처형·보스 처치·사망) 그 틱의 자잘한 타격 불꽃·숫자는 생략
  //  2) 같은 이펙트가 가까운 자리(28px)에서 6틱 안에 또 나오면 생략 (다단히트·연타)
  //  3) 화면에 전투 이펙트가 많으면(12개+) 중요도 낮은 것부터 생략
  //  4) 몸에 감기는 반복 이펙트(분노·게이지 가득)는 쓰지 않고 HUD로 보여 준다
  // 마법 이펙트: 마법 전용 레이어(배율 k)에 띄운다
  spell(id, x, y, opts = {}) { this.R.mfx.spawn(id, x, y, opts); }
  put(id, x, y, opts = {}, prio = 1) {
    const F = this.R.fx, t = this.t;
    if (prio < 3 && F.list.length >= 12) return;
    if (prio < 3) {
      const near = this.recent.find(r => r.id === id && t - r.t < 6 && Math.abs(r.x - x) < 28 && Math.abs(r.y - y) < 28);
      if (near) return;
    }
    this.recent.push({ id, x, y, t }); if (this.recent.length > 24) this.recent.shift();
    F.spawn(id, x, y, opts);
  }
  events(w) {
    const R = this.R, p = w.player, feet = p.y + p.h, P = this.put.bind(this);
    this.t = w.t; this.recent = this.recent || [];
    const big = w.events.some(e => (e.type === 'parry' && e.perfect) || e.type === 'execute' || (e.type === 'kill' && e.boss) || e.type === 'dead');
    for (const ev of w.events) switch (ev.type) {
      case 'parry':
        if (ev.perfect) P('impacts/parry', ev.x + p.face * 28, feet, { flip: p.face < 0, light: 0.35 }, 3);   // 몸 앞 랜턴 쪽
        else P('impacts/hit-spark', ev.x + p.face * 10, feet, { height: feet - ev.y, flip: p.face > 0, palette: GOLD, light: 0.25 }, 2);
        break;
      case 'attackHit':
        if (big) break;                                                   // 처형·완벽 패링 순간엔 그 연출만
        // 기본 공격은 베기 이펙트 하나로 끝 (타격 불꽃을 따로 얹지 않음). 유도탄은 맞은 자리에서 터짐
        if (ev.spell === 'bolt') this.spell('impacts/hit-spark', ev.x, ev.y + 20, { height: 16, flip: ev.face > 0, palette: AMBER, life: 30, light: 0.55 });
        else if (ev.spell === 'lance') this.spell('ice/snowflake-burst', ev.x, ev.y + 10, { life: 40, light: 0.45 });
        else if (ev.spell === 'chain') this.spell('lightning/zap-hit', ev.x, ev.y, { flip: ev.face < 0, life: 40, light: 0.5, palette: VOLT });
        else if (ev.spell === 'drain') this.spell('lightning/zap-hit', ev.x, ev.y, { flip: ev.face < 0, life: 40, light: 0.5, palette: VOLT });
        P('ui/damage-quiet', ev.x + ev.face * 6, ev.y - 22, { text: String(ev.dmg), palette: ev.crit
          ? ['#1a0508', '#4a0b12', '#8c1420', '#d42a2e', '#ff5a4a', '#ff9a86', '#ffd8cc', '#ffffff']
          : ['#1a0e04', '#4a2a0c', '#8c5a14', '#d09a1e', '#ffc63a', '#ffe27a', '#fff6c8', '#ffffff'] }, 1);
        break;
      case 'bossFall': P('explosions/big-explosion', ev.x, ev.y + 40, { life: 150, light: 0.6 }, 3); break;   // 보스 마지막 폭발 하나만 (겹침 줄임)   // 보스 마지막 폭발 + 빛기둥
      case 'snuff': P('explosions/smoke-bomb', p.x + p.w / 2 + p.face * 30, p.y + 50, { palette: GREY, life: 30, light: 0 }, 2); break;   // 등불을 끔: 연기 한 줄기
      // 다시 켬 섬광: render.js가 등불 자리에 작게 그림
      case 'enchant': { const hx = p.x + p.w / 2 + p.face * 30; P('impacts/hit-spark', hx, p.y + 46, { height: 20, flip: p.face < 0, palette: elPal(ev.el), life: 22, light: 0.4 }, 2); break; }   // 불꽃 점화 완성: 작은 불티만 (모션이 주인공)
      case 'elBurst': {                                                   // 속성 게이지가 찼다: 속성마다 다른 상태 표시
        const pal = elPal(ev.el);
        if (ev.el === 'str' || !ev.el) P('impacts/hit-spark', ev.x, ev.y + 20, { height: 24, palette: AMBER, life: 30, light: 0.45 }, 2);   // 화상: 몸의 불꽃은 렌더러가 (burnT)
        else if (ev.el === 'agi') P('ice/snowflake-burst', ev.x, ev.y + 10, { life: 40, light: 0.4 }, 2);   // 빙결: 얼음 색은 렌더러가 (frozenT)
        else if (ev.el === 'wil') P('impacts/crit-hit', ev.x, ev.y + 20, { palette: pal, life: 40, light: 0.5 }, 3);
        else if (ev.el === 'lmp') P('shadow/soul-drain', ev.x, ev.y + 30, { palette: pal, life: 60, light: 0.35 }, 2);
        else if (ev.el === 'vit') P('nature/healing-bloom', p.x + p.w / 2, p.y + p.h, { palette: pal, life: 60, light: 0.3 }, 2);
        else if (ev.el === 'fury') P('lightning/zap-hit', ev.x, ev.y, { palette: pal, life: 40, light: 0.5 }, 3);
        break;
      }
      case 'zap': P('lightning/spark-arc', (ev.x0 + ev.x1) / 2, ev.y1 + 10, { flip: ev.x1 < ev.x0, palette: VOLT, life: 24, light: 0.4 }, 2); break;   // 방전: 옆 적으로 튐
      case 'execDash': P('melee/double-slash', (ev.x0 + ev.x1) / 2, ev.y - 30, { flip: ev.face < 0, palette: AMBER, life: 24, light: 0.35 }, 2); break;   // 연속 처형 돌진: 사라진 자리 + 가르는 궤적
      case 'execute': P('explosions/implosion', ev.x, ev.y + 20, { palette: AMBER, life: 60, light: 0.45 }, 3); break;   // 처형 한 번에 원은 하나만: 큰 고리 (원래대로)   // 처형 한 번에 원은 하나만: 큰 고리 (작은 치명타 폭발은 뺌)
      case 'hurt': P('ui/heart-lost', p.x + p.w / 2, p.y - 8, {}, 3); break;   // 붉은 화면·파편은 렌더러가 그림
      case 'kill': {
        if (ev.boss) { P('impacts/crit-hit', ev.x, ev.y + 20, { light: 0.5 }, 3); break; }   // 큰 폭발은 사망 연출 끝(bossFall)에
        break;                                                              // 일반 적: 큰 이펙트 없이 렌더러가 몸을 하얗게 번쩍인 뒤 픽셀로 흩어지게 그림 (render.corpses)
      }
      case 'spawn':
        break;                                                              // 등장: 렌더러의 '땅에서 솟아오르기'와 발밑 흙먼지만 (종류별 큰 이펙트 없음)
      case 'enemyStrike': {                                               // 적 공격 궤적: 판정 범위를 보여 주는 정보라 유지, 빛은 약하게
        const s = STRIKE[ev.kind] || STRIKE[baseOf(ev.kind)]; if (s && ev.reach > 0) P(s[0], ev.x, ev.y, { flip: ev.face < 0, palette: s[1], life: 40, light: 0.25 }, 2);   // 근접 공격만 (탄·충격파·낙하는 그 자체 이펙트가 있어 겹치지 않게)
        break;
      }
      case 'slam': P('nature/quake', ev.x || (w.enemies.find(e => e.boss)?.x ?? p.x), 300, { palette: DUST, life: 90, light: 0.3 }, 2); break;
      case 'block': P('impacts/shield-block', ev.x, ev.y + 20, { palette: LILAC, light: 0.3 }, 2); break;
      case 'blink': P('shadow/shadow-tendrils', ev.x, ev.y + 26, { palette: VIOLET, light: 0.3 }, 2); break;
      case 'enemyParry': P('impacts/ricochet', ev.x, ev.y + 30, { palette: VIOLET, light: 0.3 }, 3); break;   // 순례자가 막음: 리라 패링·방패병 막기와 다른 그림   // 적이 막음: 리라 패링(impacts/parry)과 다른 그림
      case 'heal': P('nature/healing-bloom', p.x + p.w / 2, feet, { life: 80, light: 0.3 }, 3); break;   // 발밑에서 피어오르는 회복 빛 (리라 실루엣을 덧그리는 이펙트는 쓰지 않음)
      case 'castStart': {                                                  // 시전: 손의 등불에서 짧게 불꽃이 튄다 (마법진·몸 빛 없음, 모든 마법 공통)
        const hx = p.x + p.w / 2 + p.face * 16, hy = p.y + 30;
        P('impacts/hit-spark', hx, hy + 8, { height: 8, flip: p.face < 0, palette: ev.spell === 'enchant' ? elPal(ev.el) : palOf(ev.spell), life: 22, light: 0.35 }, 2);
        break;
      }
      case 'skill': {                                                      // 등불 마법: 마법마다 고유 이펙트 (착탄형은 표적 자리에)
        const M = this.spell.bind(this), gy = ev.tx != null ? groundAt(w, ev.tx - 10, 20) : feet, f = ev.face < 0, sp = ev.spell, hx = p.x + p.w / 2 + p.face * 10;
        if (sp === 'pillar') M('fire/flame-pillar', ev.tx, gy, { life: 110, light: 0.45 });
        else if (sp === 'tornado') M('fire/fire-tornado', ev.tx, gy, { life: 100, light: 0.45 });
        else if (sp === 'meteor') M('fire/meteor', ev.tx, gy, { life: 150, light: 0.5, flip: f });
        else if (sp === 'spikes') M('ice/ice-spikes', hx, feet, { flip: f, life: 90, light: 0.4 });
        else if (sp === 'stars') {                                         // 고드름 비: 고드름이 세 차례 떨어져 꽂힌다 (착지 순간 = 피해 순간)
          const S = CFG.skill.stars, IMPACT = 0.944, DUR = 2.6;
          S.ticks.forEach((ox, i) => { const at = (S.delay + i * S.gap) / 60, x = ev.tx + ox * ev.face;
            for (const d of [-26, 0, 26]) M('ice/icicle-fall', x + d, groundAt(w, x + d - 10, 20), { life: 120, light: 0.4, skip: Math.max(0, (IMPACT - at + Math.abs(d) * 0.002) / DUR) }); });
        }
        else if (sp === 'thunder') M('holy/holy-pillar', ev.tx, gy, { life: 110, light: 0.5, palette: GOLD });   // 빛기둥
        else if (sp === 'smite') M('holy/smite', ev.tx, gy, { life: 120, light: 0.5 });
        else if (sp === 'ring') { M('fire/fire-ring', ev.x, feet, { life: 80, light: 0.5, palette: GHOST }); M('explosions/plasma-explosion', ev.x, feet, { palette: GHOST, life: 60, light: 0.5 }); R.flash = Math.max(R.flash, 0.6); }   // 귀화 고리
        else if (sp === 'ward') { M('holy/sunburst', ev.x, feet - 30, { palette: GOLD, life: 60, light: 0.45 }); R.flash = Math.max(R.flash, 0.35); M('holy/divine-shield', 0, 0, { follow: p, dy: p.h / 2 / R.mfx.k, life: 300, key: 'blue', light: 0.25, palette: GOLD }); }   // 빛의 결계
        else if (sp === 'spear') { M('arcane/arcane-beam', ev.x + ev.face * 6, feet, { flip: f, life: 50, light: 0.55, palette: GHOST }); M('fire/spirit-flame', hx, feet, { life: 45, light: 0.4, palette: GHOST }); R.flash = Math.max(R.flash, 0.5); }   // 귀화 창: 손의 귀화가 한 줄로
        else if (sp === 'chain') { R.flash = Math.max(R.flash, 0.4); M('lightning/spark-arc', hx + p.face * 10, feet - 30, { flip: f, life: 30, light: 0.45, palette: VOLT }); }   // 맞은 적마다 감전(zap-hit)
        else if (sp === 'drain') { R.flash = Math.max(R.flash, 0.3); if (ev.tx != null) M('lightning/lightning-strike', ev.tx, groundAt(w, ev.tx - 10, 20), { palette: VOLT, life: 60, light: 0.45 }); M('lightning/spark-arc', hx + p.face * 10, feet - 30, { flip: f, life: 30, light: 0.4, palette: VOLT }); }   // 흡전
        else if (sp === 'blast') M('lightning/lightning-strike', ev.tx, gy, { life: 120, light: 0.55, palette: VOLT });   // 뇌전 폭발: 벼락이 꽂힌 뒤 착탄에서 폭발
        else if (sp === 'heal') { M('nature/healing-bloom', p.x + p.w / 2, feet, { palette: GREEN, life: 90, light: 0.35 }); R.flash = Math.max(R.flash, 0.3); }   // 생명의 꽃
        else if (sp === 'thorns') { M('nature/thorns', hx, feet, { flip: f, life: 90, light: 0.35, palette: GREEN }); M('nature/vine-whip', hx, feet, { flip: f, life: 60, light: 0.3, palette: GREEN }); }   // 가시 덩굴: 덩굴이 앞으로 휘감아 뻗음
        else if (sp === 'sanctum') { for (const fl of [false, true]) M('nature/thorns', ev.x + (fl ? -16 : 16), feet, { flip: fl, life: 90, light: 0.35, palette: GREEN }); M('nature/healing-bloom', ev.x, feet, { palette: GREEN, life: 100, light: 0.35 }); R.flash = Math.max(R.flash, 0.4); }   // 생명의 숲: 양옆 덩굴 + 꽃
        break;
      }
      case 'spellLand': {                                                  // 착탄 순간: 폭발·충격파 + 화면 번쩍
        const L = LAND[ev.spell]; if (!L) break;
        const gy = groundAt(w, ev.x - 10, 20);
        for (const [id, o] of L[0]) this.spell(id, ev.x, gy, { life: 90, light: 0.45, ...o });
        R.flash = Math.max(R.flash, L[1]);
        break;
      }
      // 강적 기믹
      case 'barrierBreak': P('ice/ice-shatter', ev.x, ev.y + 30, { palette: CYAN, life: 50, light: 0.45 }, 3); break;
      case 'barrierUp': P('arcane/rune-circle', ev.x, ev.y + 40, { palette: CYAN, life: 40, light: 0.3 }, 2); break;   // 리라 빛의 결계(divine-shield)와 구분
      case 'mirage': P('shadow/void-orb', ev.x, ev.y + 20, { palette: VIOLET, life: 40, light: 0.35 }, 2); break;
      case 'barrierHit': P('impacts/shield-block', ev.x, ev.y + 20, { palette: CYAN, light: 0.3 }, 2); break;
      // 레벨 요소
      case 'urnBreak': P('spawn/poof', ev.x, ev.y + 14, { palette: DUST, life: 30, light: 0.2 }, 2); break;
      case 'ventFire': this.spell('fire/flame-pillar', ev.x, 300, { life: 85, light: 0.5, palette: HELL }); break;   // 함정 불기둥: 검붉은색 (리라 화염 기둥은 주황)
      case 'chestOpen': this.spell('holy/sunburst', ev.x, ev.y, { palette: GOLD, life: 60, light: 0.5 }); break;
      case 'gateOpen': P('nature/quake', ev.x, 300, { palette: DUST, life: 40, light: 0.2 }, 2); break;
      case 'lever': P('impacts/hit-spark', ev.x, ev.y - 10, { height: 14, palette: GOLD, life: 30, light: 0.4 }, 2); break;
      case 'pickup': if (ev.kind !== 'ember') P('pickups/collect-burst', ev.x, ev.y + 6, { palette: ev.kind === 'heal' ? undefined : AMBER, life: 30, light: 0.4 }, 2); break;
      // 보스 기믹 연출
      case 'bellRelease': P('impacts/hit-spark', ev.x, 60, { height: 20, palette: GOLD, life: 30, light: 0.4 }, 3); break;
      case 'bellTrap': this.spell('impacts/ground-slam', ev.x, 300, { palette: GOLD, life: 70, light: 0.5 }); break;
      case 'bellMiss': this.spell('impacts/ground-slam', ev.x, 300, { palette: DUST, life: 60, light: 0.3 }); break;
      case 'veilUp': { const b = w.enemies.find(e => e.boss); if (b) R.mfx.spawn('holy/divine-shield', 0, 0, { follow: b, dy: b.h * 0.42 / R.mfx.k, key: 'veil', light: 0.35, palette: CYAN }); break; }   // 1.5배 레이어: 커진 성녀 몸을 다 덮게
      case 'veilBreak': R.mfx.stopKey('veil'); this.spell('water/wave-crash', ev.x, ev.y + 40, { life: 70, light: 0.5 }); break;
      case 'mirrorReflect': this.spell('impacts/hit-spark', ev.x, ev.y + 16, { height: 16, palette: CYAN, life: 30, light: 0.5 }); break;   // 수정 거울 반사: 수정빛 불꽃 하나
      case 'beaconLit': R.propfx.spawn('fire/brazier', ev.x, 280, { light: 0.55, key: 'beacon' + ev.x, iron: NO_IRON }); break;   // 등대 불: 등대 그림과 한 몸 (인물 뒤)
      case 'beaconOut': R.propfx.stopKey('beacon' + ev.x); break;
      case 'phase2': if (ev.kind === 'saint') { for (const dx of [-400, 0, 400]) this.spell('water/wave-crash', ev.x + dx, 300, { life: 80, light: 0.4 }); break; }   // 성녀: 물이 밀려든다 (물결만)
        break;   // 2막: 블랙홀 이펙트 없음 (포효·배너·화면 연출만)
      case 'steam': this.spell('explosions/smoke-bomb', ev.x, 270, { palette: GREY, life: 70, light: 0.2 }); break;   // 증기 밸브: 연기 하나   // 증기 (사제 등장 물기둥과 구분)   // 증기 밸브
      case 'quench': this.spell('impacts/ricochet', ev.x, ev.y + 30, { palette: GREY, life: 50, light: 0.4 }); break;   // 식어서 갑옷에 금
      case 'heatUp': P('fire/fire-ring', ev.x, ev.y + 60, { life: 60, light: 0.5 }, 2); break;
      case 'anchorHit': if (ev.broke) this.spell('nature/boulder', ev.x, 300, { palette: GREY, life: 60, light: 0.3 }); else P('impacts/hit-spark', ev.x, 262, { height: 24, palette: CYAN, life: 26, light: 0.4 }, 2); break;   // 부서지면 돌무더기만
      case 'chainsBroken': this.spell('arcane/mana-burst', ev.x, ev.y + 40, { palette: CYAN, life: 80, light: 0.6 }); break;
      case 'anchorRise': P('water/whirlpool', ev.x, 300, { palette: CYAN, life: 60, light: 0.35 }, 2); break;   // 강적 방패(rune-circle)와 구분
      case 'exposed': P('impacts/hit-spark', ev.x, ev.y + 30, { height: 20, palette: GOLD, life: 30, light: 0.4 }, 2); break;
      case 'land': if (w.water != null && w.water < 296 && ev.y > w.water) { this.spell('water/splash', ev.x, w.water + 6, { life: 45, light: 0.35 }); break; }   // 물에 착지 → 물보라
        if (ev.v > 7) P('impacts/heavy-landing', ev.x, ev.y, { palette: DUST, life: 40, light: 0.2 }, 1); break;
      case 'dead': P('impacts/hit-spark', ev.x, ev.y - 30, { height: 30, palette: ['#3a0a14', '#a01824', '#ff5a50', '#ffffff'], life: 25, light: 0.3 }, 3); break;   // 쓰러지는 동작은 리라 애니메이션이 보여 줌
      case 'afterglow': P('lightning/spark-arc', ev.x, ev.y + 20, { palette: AMBER, life: 30, light: 0.3 }, 2); break;
    }
  }
  // 매 틱: 탄에 이펙트 붙이기, 엘리트 표시, 화상
  tick(w) {
    const R = this.R, F = R.fx, p = w.player;
    const D = w.bossDeath;                                                // 보스 사망 연출: 몸 곳곳에서 차례로 작은 폭발
    if (D && D.t < 96 && D.t % 14 === 6 && D.t !== this.lastBurst) { this.lastBurst = D.t; const e = D.e; this.put('explosions/small-explosion', e.x + e.w * (0.2 + ((D.t * 37) % 60) / 100), e.y + e.h * (0.25 + ((D.t * 53) % 50) / 100), { palette: AMBER, life: 40, light: 0.45 }, 2); }
    for (const b of w.projectiles) {
      if (this.seen.has(b)) continue; this.seen.add(b);
      b._fx = !!(b.echo || b.wave || b.shard || (b.bolt && BOLT[b.bolt]));   // 잔해(shard)는 drawDebris·fx가 그림   // 이펙트가 붙은 탄은 임시 사각형을 안 그림
      if (b.echo) F.spawn('projectiles/energy-disc', 0, 0, { follow: b, palette: AMBER, flip: b.vx < 0 });
      else if (b.wave) F.spawn(b.src?.kind === 'saint' ? 'water/wave-crash' : 'impacts/ground-slam', 0, 0, { follow: b, dy: 6, palette: b.src?.kind === 'saint' ? undefined : DUST, light: 0.5 });
      else if (b.shard && b.debris === 'crystal') F.spawn('ice/ice-crystal', 0, 0, { follow: b, palette: LILAC });   // 수정 파편만 이펙트, 나머지(돌·쇳물·별·물방울)는 render.drawDebris가 직접 그림
      else if (b.bolt && BOLT[b.bolt]) (b.owner === 'player' ? R.mfx : F).spawn(BOLT[b.bolt][0], 0, 0, { follow: b, flip: b.vx < 0, ...BOLT[b.bolt][1] });   // 리라 마법탄은 2배 레이어
    }
    // 물 속을 걸으면 발밑에 잔물결, 착지하면 물보라 (성녀 2막)
    if (w.water != null && w.water < 296) {
      const inWater = b => b.y + b.h > w.water + 2 && groundAt(w, b.x + b.w / 2, 1) > w.water + 2;
      if (inWater(p) && Math.abs(p.vx) > 0.5 && p.onGround && w.t % 16 === 0) this.spell('water/ripples', p.x + p.w / 2, w.water + 4, { life: 40, light: 0.25 });
      for (const e of w.enemies) if (e.boss && inWater(e) && Math.abs(e.vx) > 0.3 && w.t % 20 === 0) this.spell('water/ripples', e.x + e.w / 2, w.water + 4, { life: 40, light: 0.2 });
    }
    // 오브젝트: 열린 출구엔 포탈, 보스방 화로는 충전되면 불이 붙고 쓰면 꺼짐
    (w.props || []).forEach((o, i) => {
      if (o.kind === 'exit' && !o.locked && !o.fx) { o.fx = true; F.spawn('arcane/portal', o.x, 300, { light: 0.4, palette: AMBER }); }
    });
    // 적 몸에 감기는 상태 이펙트는 한 번에 하나만: 기절 > 화상 > 엘리트 (겹쳐 감기면 몸이 안 보임)
    for (const e of w.enemies) {
      e._fxid = e._fxid || ++R.fxid;
      const want = e.dead || e.spawnT > 0 ? null : e.stunT > 0 ? 'stun' : e.burnT > 0 ? 'burn' : null;   // 강적 표시는 렌더러의 테두리 (pixelfx 몸 감싸기는 정지 실루엣이라 움직이는 몸과 겹쳐 보였음)
      if (want === (this.bodyFx.get(e) ?? null)) continue;
      F.stopKey('body' + e._fxid); this.bodyFx.set(e, want);
      const o = { follow: e, dy: e.h / 2, key: 'body' + e._fxid, actor: R.actorOf(e), flip: e.face > 0, light: 0.25 };
      if (want === 'stun') F.spawn('status/stunned', 0, 0, o);
      else if (want === 'burn') F.spawn('status/burning', 0, 0, o);
    }
  }
}
