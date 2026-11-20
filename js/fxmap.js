// 게임 상황 → pixelfx 이펙트 연결표. 렌더러가 매 틱 events()·tick()을 부른다
// (pixelfx 244종 중 이 게임 분위기에 맞는 것을 상황마다 골라 씀. 총기·SF 계열은 제외)
import { preload } from './fx.js';
import { groundAt } from './core/world.js';

// 팔레트 (어둠 → 밝음)
const AMBER = ['#4a1a0c', '#8c3414', '#d0661e', '#ffa63a', '#ffd27a', '#fff0c8', '#ffffff'];
const SPARK = ['#fff6c8', '#ffd86b', '#ff9a2a', '#e8561d'];
const GOLD = ['#4a2a0c', '#8c5a14', '#d09a1e', '#ffc63a', '#ffe27a', '#fff6c8', '#ffffff'];
const VIOLET = ['#1a0a2a', '#3a1660', '#6a2aa0', '#9a4ae0', '#c890ff', '#f0e0ff', '#ffffff'];
const GREY = ['#1a1820', '#3a3640', '#5e5866', '#8a8494', '#b8b2c2', '#e4e0ea', '#ffffff'];
const LILAC = ['#1e1430', '#3c2a5c', '#6a4e96', '#9a7ccc', '#c8b0f0', '#ece2ff', '#ffffff'];
const CYAN = ['#0a1e2a', '#14405a', '#22708e', '#3aa6c0', '#7cd8e8', '#cef4fa', '#ffffff'];
const CFG_INV = { ring: 1, ward: 1, spear: 1, meteor: 1, sanctum: 1 };   // 큰 마법만 시전 예고 빛
const HIT = ['#1a0e06', '#3a2410', '#6a4420', '#9a6a34', '#c4955a', '#e0bc88', '#f0dcb8'];   // 기본 타격: 흰빛 없는 톤
const ICE = ['#081a2a', '#10345a', '#1e5a8c', '#3a8cc8', '#7ac0f0', '#c0e8ff', '#ffffff'];
const DUST = ['#1c1610', '#33281c', '#4f3f2c', '#6e5a40', '#927a58', '#b89f78', '#dcc8a2'];

// 지역별 배경 생물·불빛 (월드 고정 위치의 반복 이펙트) + 화면 날씨
// 배경 장식: 게임 요소(아이템·함정·적·마법진·떠다니는 생물)처럼 보이는 것은 쓰지 않는다. 바닥 장식은 방 가장자리, 벽 장식은 벽 높이에.
// [id, x비율, y] — 배경 레이어(어둠 아래)에 그려져 캐릭터보다 뒤로 물러나 보인다
const AMBIENT = {
  1: { world: [['fire/candle', 0.03, 300], ['fire/candle', 0.97, 300]],
       screen: ['weather/fog', 'weather/fireflies'], boss: [['fire/brazier', 0.03, 300], ['fire/brazier', 0.97, 300]] },
  2: { world: [['water/drip', 0.2, 40], ['water/drip', 0.5, 30], ['water/drip', 0.8, 40], ['fire/candle', 0.03, 300], ['fire/candle', 0.97, 300]],
       screen: ['weather/god-rays'], boss: [['water/waterfall', 0.04, 220], ['water/waterfall', 0.96, 220], ['water/drip', 0.5, 30]] },
  3: { world: [['fire/torch', 0.04, 250], ['fire/torch', 0.96, 250]],
       screen: ['weather/fog'], boss: [['fire/torch', 0.04, 250], ['fire/torch', 0.96, 250]] },
  4: { world: [['fire/spirit-flame', 0.03, 300], ['fire/spirit-flame', 0.97, 300]],
       screen: ['weather/aurora'], boss: [['shadow/shadow-flames', 0.03, 300], ['shadow/shadow-flames', 0.97, 300]] },
};

// 적 등장 · 공격 · 쓰러짐
const SPAWN = { ghoul: 'spawn/summon-rise', moth: 'spawn/poof', spearman: 'water/splash', priest: 'water/geyser', shellguard: 'nature/earth-spike', assassin: 'shadow/shadow-tendrils' };
const STRIKE = { ghoul: ['melee/claw-swipe', GREY], moth: ['melee/claw-swipe', DUST], spearman: ['melee/thrust', CYAN], shellguard: ['melee/hammer-smash', LILAC], assassin: ['melee/dagger-flurry', VIOLET],
  bellBoss: ['melee/heavy-cleave', DUST], spider: ['melee/claw-swipe', LILAC], shadow: ['melee/sword-slash', VIOLET], saint: ['melee/spear-sweep', CYAN] };
const DEATH = { ghoul: ['spawn/poof', GREY], moth: ['holy/feather-burst', DUST], spearman: ['water/splash'], priest: ['water/wave-crash'], shellguard: ['ice/ice-shatter', LILAC], assassin: ['explosions/implosion', VIOLET] };
const BOLT = { lance: ['ice/ice-lance', { light: 0.3 }], lamp: ['fire/fireball', { palette: ['#3a1204', '#7a2a08', '#c0560e', '#ff9a2a', '#ffcf6a', '#fff0c8', '#ffffff'], light: 0.4 }], priest: ['water/water-orb', { radius: 7 }], saint: ['ice/ice-lance', {}], bellBoss: ['lightning/ball-lightning', {}], shadow: ['shadow/void-orb', {}] };

export const ALL_IDS = [...new Set([
  ...Object.values(AMBIENT).flatMap(a => [...a.world.map(x => x[0]), ...a.screen, ...a.boss.map(x => x[0])]),
  ...Object.values(SPAWN), ...Object.values(STRIKE).map(x => x[0]), ...Object.values(DEATH).map(x => x[0]), ...Object.values(BOLT).map(x => x[0]),
  'melee/sword-slash', 'melee/uppercut', 'melee/heavy-cleave', 'impacts/hit-spark', 'impacts/crit-hit', 'impacts/parry', 'impacts/impact-frame', 'impacts/blunt-hit',
  'impacts/shield-block', 'impacts/heavy-landing', 'impacts/ground-slam', 'nature/quake', 'ui/damage-quiet', 'ui/crit-number', 'ui/heart-lost', 'ui/combo-counter',
  'ui/quest-complete', 'ui/achievement', 'nature/healing-bloom', 'fire/fire-ring', 'holy/sunburst', 'holy/feather-burst', 'shadow/dark-explosion', 'spawn/soul-rise',
  'projectiles/energy-disc', 'ice/ice-crystal', 'water/wave-crash', 'ice/snowflake-burst', 'lightning/spark-arc', 'lightning/lightning-strike', 'status/stunned',
  'status/burning', 'status/rage', 'arcane/rune-circle', 'arcane/blink-out', 'pickups/collect-burst', 'explosions/big-explosion', 'explosions/plasma-explosion',
  'holy/holy-pillar', 'transitions/iris', 'transitions/slash-wipe', 'transitions/pixel-dissolve', 'transitions/shatter-wipe', 'transitions/burn-away',
])];

export class FxDirector {
  constructor(R) { this.R = R; this.seen = new WeakSet(); this.elites = new WeakSet(); this.burning = new WeakMap(); this.bodyFx = new WeakMap(); this.prevLight = 0; this.streak = 0; }
  preloadRegion(region) {
    const a = AMBIENT[region] || AMBIENT[1];
    preload([...a.world.map(x => x[0]), ...a.screen, ...a.boss.map(x => x[0])]);
    preload(['transitions/iris', 'fire/campfire', 'arcane/portal', 'melee/sword-slash', 'melee/uppercut', 'melee/spear-sweep', 'fire/fireball', 'ice/ice-lance', 'fire/flame-pillar', 'lightning/lightning-strike', 'fire/meteor', 'arcane/star-fall', 'holy/divine-shield', 'arcane/arcane-beam', 'ice/frost-nova', 'holy/heal', 'holy/holy-pillar', 'impacts/hit-spark', 'impacts/crit-hit', 'impacts/parry', 'ui/damage-quiet', 'transitions/burn-away']);
  }

  // 방에 들어올 때: 배경 생물·불빛·날씨 + 장면 전환
  enterRoom(w, region, boss) {
    const R = this.R, a = AMBIENT[region] || AMBIENT[1];
    R.weather.clear(); this.seen = new WeakSet(); this.elites = new WeakSet(); this.bodyFx = new WeakMap(); this.recent = []; this.prevLight = 0; this.streak = 0;
    R.bgfx.clear(); for (const [id, fx, y] of (boss ? a.boss : a.world)) R.bgfx.spawn(id, w.width * fx, y, { light: 0.4 });
    for (const id of a.screen) R.weather.spawn(id, 160, 170, {});   // 날씨 원점 = 화면 하단 중앙 (meta.origin)
    if (w.haven) {                                                       // 쉼터 오브젝트: 모닥불(휴식) · 출구 포탈 (밝게 = 상호작용 가능)
      for (const o of w.props) {
        if (o.kind === 'campfire') { R.fx.spawn('fire/campfire', o.x, 300, { light: 0.5 }); for (const d of [-110, 110]) R.bgfx.spawn('fire/candle', o.x + d, 300, { light: 0.3 }); }
        if (o.kind === 'merchant') { R.bgfx.spawn('fire/brazier', o.x + 90, 300, { light: 0.35 }); R.bgfx.spawn('fire/candle', o.x - 100, 300, { light: 0.3 }); }
        if (o.kind === 'exit') R.fx.spawn('arcane/portal', o.x, 300, { light: 0.4, palette: AMBER });
      }
    }
    R.trans.clear(); R.iris(w, 'open');   // 방 입장: 리라를 중심으로 아이리스가 열림
  }

  // 이펙트 연출 규칙 (눈 아프지 않게):
  //  1) 한 틱에 '주인공' 사건이 있으면 (완벽 패링·처형·보스 처치·사망) 그 틱의 자잘한 타격 불꽃·숫자는 생략
  //  2) 같은 이펙트가 가까운 자리(28px)에서 6틱 안에 또 나오면 생략 (다단히트·연타)
  //  3) 화면에 전투 이펙트가 많으면(12개+) 중요도 낮은 것부터 생략
  //  4) 몸에 감기는 반복 이펙트(분노·게이지 가득)는 쓰지 않고 HUD로 보여 준다
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
        // 기본 공격은 베기 이펙트 하나로 끝 (타격 불꽃을 따로 얹지 않음), 마법은 마법 이펙트가 대신
        P('ui/damage-quiet', ev.x + ev.face * 6, ev.y - 22, { text: String(ev.dmg), palette: ev.crit
          ? ['#1a0508', '#4a0b12', '#8c1420', '#d42a2e', '#ff5a4a', '#ff9a86', '#ffd8cc', '#ffffff']
          : ['#1a0e04', '#4a2a0c', '#8c5a14', '#d09a1e', '#ffc63a', '#ffe27a', '#fff6c8', '#ffffff'] }, 1);
        break;
      case 'execute': P('impacts/crit-hit', ev.x, ev.y + 30, { light: 0.4 }, 3); break;
      case 'hurt': P('ui/heart-lost', p.x + p.w / 2, p.y - 8, {}, 3); break;   // 붉은 화면·파편은 렌더러가 그림
      case 'kill': {
        if (ev.boss) { P('explosions/big-explosion', ev.x, ev.y + 40, { life: 150, light: 0.5 }, 3); P('holy/holy-pillar', ev.x, ev.y + 40, { light: 0.5 }, 3); break; }
        const d = DEATH[ev.kind];
        P(d ? d[0] : 'spawn/poof', ev.x, ev.y + 16, { ...(d && d[1] ? { palette: d[1] } : {}), life: 90, light: 0.3 }, 2);
        break;
      }
      case 'spawn':
        if (ev.boss) P('lightning/lightning-strike', ev.x, ev.y, { life: 90, light: 0.5 }, 3);
        else if (SPAWN[ev.kind]) P(SPAWN[ev.kind], ev.x, ev.y, { life: 70, light: 0.3 }, 2);
        break;
      case 'enemyStrike': {                                               // 적 공격 궤적: 판정 범위를 보여 주는 정보라 유지, 빛은 약하게
        const s = STRIKE[ev.kind]; if (s) P(s[0], ev.x, ev.y, { flip: ev.face < 0, palette: s[1], life: 40, light: 0.25 }, 2);
        break;
      }
      case 'slam': P('nature/quake', ev.x || (w.enemies.find(e => e.boss)?.x ?? p.x), 300, { palette: DUST, life: 90, light: 0.3 }, 2); break;
      case 'block': P('impacts/shield-block', ev.x, ev.y + 20, { palette: LILAC, light: 0.3 }, 2); break;
      case 'blink': P('arcane/blink-out', ev.x, ev.y + 26, { palette: VIOLET, light: 0.3 }, 2); break;
      case 'enemyParry': P('impacts/parry', ev.x, ev.y + 40, { palette: VIOLET, light: 0.3 }, 3); break;
      case 'flask': P('nature/healing-bloom', ev.x, ev.y, { light: 0.3 }, 2); break;
      case 'castStart': if (CFG_INV[ev.spell]) P('holy/sunburst', 0, 0, { follow: p, dy: -10, life: 26, light: 0.3, palette: ev.spell === 'ward' ? ICE : ev.spell === 'spear' ? VIOLET : AMBER }, 3); break;
      case 'skill': {                                                      // 등불 마법: 마법마다 pixelfx 이펙트 하나 (착탄형은 표적 자리에)
        const gy = ev.tx != null ? groundAt(w, ev.tx - 10, 20) : feet;
        if (ev.spell === 'pillar') P('fire/flame-pillar', ev.tx, gy, { life: 110, light: 0.4 }, 3);
        else if (ev.spell === 'thunder') P('lightning/lightning-strike', ev.tx, gy, { life: 110, light: 0.4 }, 3);
        else if (ev.spell === 'meteor') P('fire/meteor', ev.tx, gy, { life: 150, light: 0.45, flip: ev.face < 0 }, 3);
        else if (ev.spell === 'stars') P('arcane/star-fall', ev.tx, gy, { life: 100, light: 0.4 }, 3);
        else if (ev.spell === 'ring') P('fire/fire-ring', ev.x, feet, { life: 80, light: 0.4 }, 3);
        else if (ev.spell === 'ward') { P('ice/frost-nova', ev.x, feet, { life: 60, light: 0.3 }, 3); P('holy/divine-shield', 0, 0, { follow: p, dy: p.h / 2, life: 300, key: 'blue', light: 0.25, palette: ICE }, 3); }
        else if (ev.spell === 'heal') P('holy/heal', p.x + p.w / 2, feet, { actor: R.actorOf(p), flip: p.face < 0, life: 110, light: 0.3 }, 3);
        else if (ev.spell === 'sanctum') P('holy/holy-pillar', ev.x, feet, { life: 120, light: 0.4 }, 3);
        else if (ev.spell === 'spear') P('arcane/arcane-beam', ev.x + ev.face * 6, feet, { flip: ev.face < 0, life: 40, light: 0.4, palette: VIOLET }, 3);
        break;
      }
      case 'land': if (ev.v > 7) P('impacts/heavy-landing', ev.x, ev.y, { palette: DUST, life: 40, light: 0.2 }, 1); break;
      case 'dead': P('spawn/soul-rise', ev.x, ev.y, { actor: R.actorOf(w.player), flip: w.player.face < 0 }, 3); R.trans.spawn('transitions/burn-away', 0, 0, {}); break;
      case 'afterglow': P('lightning/spark-arc', ev.x, ev.y + 20, { palette: AMBER, life: 30, light: 0.3 }, 2); break;
      case 'cleared': P('ui/quest-complete', p.x + p.w / 2, p.y - 30, {}, 3); break;
      case 'win': P('ui/achievement', p.x + p.w / 2, p.y - 40, {}, 3); break;
    }
  }
  // 매 틱: 탄에 이펙트 붙이기, 엘리트 표시, 화상
  tick(w) {
    const R = this.R, F = R.fx, p = w.player;
    for (const b of w.projectiles) {
      if (this.seen.has(b)) continue; this.seen.add(b);
      b._fx = !!(b.echo || b.wave || b.shard || (b.bolt && BOLT[b.bolt]));   // 이펙트가 붙은 탄은 임시 사각형을 안 그림
      if (b.echo) F.spawn('projectiles/energy-disc', 0, 0, { follow: b, palette: AMBER, flip: b.vx < 0 });
      else if (b.wave) F.spawn(b.src?.kind === 'saint' ? 'water/wave-crash' : 'impacts/ground-slam', 0, 0, { follow: b, dy: 6, palette: b.src?.kind === 'saint' ? undefined : DUST, light: 0.5 });
      else if (b.shard) F.spawn('ice/ice-crystal', 0, 0, { follow: b, palette: LILAC });
      else if (b.bolt && BOLT[b.bolt]) F.spawn(BOLT[b.bolt][0], 0, 0, { follow: b, flip: b.vx < 0, ...BOLT[b.bolt][1] });
    }
    // 적 몸에 감기는 상태 이펙트는 한 번에 하나만: 기절 > 화상 > 엘리트 (겹쳐 감기면 몸이 안 보임)
    for (const e of w.enemies) {
      e._fxid = e._fxid || ++R.fxid;
      const want = e.dead || e.spawnT > 0 ? null : e.stunT > 0 ? 'stun' : e.burnT > 0 ? 'burn' : e.elite ? 'elite' : null;
      if (want === (this.bodyFx.get(e) ?? null)) continue;
      F.stopKey('body' + e._fxid); this.bodyFx.set(e, want);
      const o = { follow: e, dy: e.h / 2, key: 'body' + e._fxid, actor: R.actorOf(e), flip: e.face > 0, light: 0.25 };
      if (want === 'stun') F.spawn('status/stunned', 0, 0, o);
      else if (want === 'burn') F.spawn('status/burning', 0, 0, o);
      else if (want === 'elite') F.spawn('status/rage', 0, 0, o);
    }
  }
}
