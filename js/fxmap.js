// 게임 상황 → pixelfx 이펙트 연결표. 렌더러가 매 틱 events()·tick()을 부른다
// (pixelfx 244종 중 이 게임 분위기에 맞는 것을 상황마다 골라 씀. 총기·SF 계열은 제외)
import { preload } from './fx.js';

// 팔레트 (어둠 → 밝음)
const AMBER = ['#4a1a0c', '#8c3414', '#d0661e', '#ffa63a', '#ffd27a', '#fff0c8', '#ffffff'];
const SPARK = ['#fff6c8', '#ffd86b', '#ff9a2a', '#e8561d'];
const GOLD = ['#4a2a0c', '#8c5a14', '#d09a1e', '#ffc63a', '#ffe27a', '#fff6c8', '#ffffff'];
const VIOLET = ['#1a0a2a', '#3a1660', '#6a2aa0', '#9a4ae0', '#c890ff', '#f0e0ff', '#ffffff'];
const GREY = ['#1a1820', '#3a3640', '#5e5866', '#8a8494', '#b8b2c2', '#e4e0ea', '#ffffff'];
const LILAC = ['#1e1430', '#3c2a5c', '#6a4e96', '#9a7ccc', '#c8b0f0', '#ece2ff', '#ffffff'];
const CYAN = ['#0a1e2a', '#14405a', '#22708e', '#3aa6c0', '#7cd8e8', '#cef4fa', '#ffffff'];
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
const STRIKE = { ghoul: ['melee/claw-swipe', GREY], spearman: ['melee/thrust', CYAN], shellguard: ['melee/hammer-smash', LILAC], assassin: ['melee/dagger-flurry', VIOLET],
  bellBoss: ['melee/heavy-cleave', DUST], spider: ['melee/claw-swipe', LILAC], shadow: ['melee/sword-slash', VIOLET], saint: ['melee/spear-sweep', CYAN] };
const DEATH = { ghoul: ['spawn/poof', GREY], moth: ['holy/feather-burst', DUST], spearman: ['water/splash'], priest: ['water/wave-crash'], shellguard: ['ice/ice-shatter', LILAC], assassin: ['explosions/implosion', VIOLET] };
const BOLT = { priest: ['water/water-orb', { radius: 7 }], saint: ['ice/ice-lance', {}], bellBoss: ['lightning/ball-lightning', {}], shadow: ['shadow/void-orb', {}] };

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
  constructor(R) { this.R = R; this.seen = new WeakSet(); this.elites = new WeakSet(); this.burning = new WeakMap(); this.prevLight = 0; this.streak = 0; }
  preloadRegion(region) {
    const a = AMBIENT[region] || AMBIENT[1];
    preload([...a.world.map(x => x[0]), ...a.screen, ...a.boss.map(x => x[0])]);
    preload(['melee/sword-slash', 'melee/uppercut', 'melee/heavy-cleave', 'impacts/hit-spark', 'impacts/crit-hit', 'impacts/parry', 'ui/damage-quiet', 'transitions/iris', 'transitions/slash-wipe', 'transitions/pixel-dissolve']);
  }

  // 방에 들어올 때: 배경 생물·불빛·날씨 + 장면 전환
  enterRoom(w, region, boss) {
    const R = this.R, a = AMBIENT[region] || AMBIENT[1];
    R.weather.clear(); this.seen = new WeakSet(); this.elites = new WeakSet(); this.prevLight = 0; this.streak = 0;
    R.bgfx.clear(); for (const [id, fx, y] of (boss ? a.boss : a.world)) R.bgfx.spawn(id, w.width * fx, y, { light: 0.4 });
    for (const id of a.screen) R.weather.spawn(id, 160, 170, {});   // 날씨 원점 = 화면 하단 중앙 (meta.origin)
    R.trans.clear(); R.trans.spawn(boss ? 'transitions/slash-wipe' : 'transitions/pixel-dissolve', 0, 0, { skip: boss ? 0.5 : 0.55 });
  }

  events(w) {
    const R = this.R, F = R.fx, p = w.player, feet = p.y + p.h;
    for (const ev of w.events) switch (ev.type) {
      case 'parry':
        if (ev.perfect) {
          F.spawn('impacts/parry', ev.x + p.face * 28, feet, { flip: p.face < 0, light: 0.35 });   // 몸 앞 랜턴 쪽에서 터지게
          this.streak++; if (this.streak >= 3) F.spawn('ui/combo-counter', p.x + p.w / 2, p.y - 20, { count: this.streak, label: 'PARRY', palette: ['#2a1204', '#5a2a08', '#8c4a10', '#d07a1e', '#ffa63a', '#ffd27a', '#fff0c8', '#ffffff'], key: 'combo' + this.streak });
        } else F.spawn('impacts/hit-spark', ev.x + p.face * 10, feet, { height: feet - ev.y, flip: p.face > 0, palette: GOLD, light: 0.3 });
        break;
      case 'attackHit':
        // 타격 불꽃은 하나만, 빛 번짐은 약하게. 숫자는 별·불꽃 없는 조용한 버전 (적 머리 위로 비켜서)
        F.spawn('impacts/hit-spark', ev.x, ev.y + 20, { height: 20, flip: ev.face < 0, light: 0.3, ...(ev.combo === 2 ? { palette: AMBER } : {}) });
        F.spawn('ui/damage-quiet', ev.x + ev.face * 6 + (Math.random() * 8 - 4), ev.y - 22, { text: String(ev.dmg), palette: ev.crit
          ? ['#1a0508', '#4a0b12', '#8c1420', '#d42a2e', '#ff5a4a', '#ff9a86', '#ffd8cc', '#ffffff']
          : ['#1a0e04', '#4a2a0c', '#8c5a14', '#d09a1e', '#ffc63a', '#ffe27a', '#fff6c8', '#ffffff'] });
        break;
      case 'execute': F.spawn('impacts/crit-hit', ev.x, ev.y + 30, { light: 0.5 }); F.spawn('explosions/implosion', ev.x, ev.y + 20, { palette: AMBER, life: 60, light: 0.4 }); break;
      case 'hurt': F.spawn('impacts/blunt-hit', ev.x, ev.y + 20, { palette: ['#3a0810', '#7a1020', '#c02030', '#ff4a50', '#ff9a90', '#ffe0dc', '#ffffff'] }); F.spawn('ui/heart-lost', p.x + p.w / 2, p.y - 8); this.streak = 0; break;
      case 'kill': {
        const d = DEATH[ev.kind];
        if (ev.boss) { F.spawn('explosions/big-explosion', ev.x, ev.y + 40, { life: 150 }); F.spawn('holy/holy-pillar', ev.x, ev.y + 40, {}); R.trans.spawn('transitions/shatter-wipe', 0, 0, {}); }
        else if (d) F.spawn(d[0], ev.x, ev.y + 16, d[1] ? { palette: d[1], life: 90 } : { life: 90 });
        else F.spawn('spawn/poof', ev.x, ev.y + 16);
        F.spawn('pickups/collect-burst', ev.x, ev.y, { palette: GOLD });
        break;
      }
      case 'spawn':
        if (ev.boss) { F.spawn('lightning/lightning-strike', ev.x, ev.y, { life: 90 }); }
        else if (SPAWN[ev.kind]) F.spawn(SPAWN[ev.kind], ev.x, ev.y, { life: 70 });
        break;
      case 'enemyStrike': {
        const s = STRIKE[ev.kind]; if (!s) break;
        F.spawn(s[0], ev.x, ev.y, { flip: ev.face < 0, palette: s[1], life: 40, light: 0.7 });
        break;
      }
      case 'slam': F.spawn('nature/quake', ev.x || (w.enemies.find(e => e.boss)?.x ?? p.x), 300, { palette: DUST, life: 90 }); break;
      case 'block': F.spawn('impacts/shield-block', ev.x, ev.y + 20, { palette: LILAC }); break;
      case 'blink': F.spawn('arcane/blink-out', ev.x, ev.y + 26, { palette: VIOLET }); break;
      case 'enemyParry': F.spawn('impacts/parry', ev.x, ev.y + 40, { palette: VIOLET }); break;
      case 'flask': F.spawn('nature/healing-bloom', ev.x, ev.y); break;
      case 'ultStart':
        if (p.oil === 'blue') { F.spawn('holy/sunburst', 0, 0, { follow: p, dy: -10, life: 300, key: 'blue' }); F.spawn('holy/feather-burst', p.x + p.w / 2, feet - 30); }
        else if (p.oil === 'black') F.spawn('shadow/dark-explosion', p.x + p.w / 2 + p.face * 120, feet, { life: 80 });
        else F.spawn('fire/fire-ring', p.x + p.w / 2, feet, { life: 80 });
        break;
      case 'land': if (ev.v > 7) F.spawn('impacts/heavy-landing', ev.x, ev.y, { palette: DUST, life: 40 }); break;
      case 'dead': F.spawn('spawn/soul-rise', ev.x, ev.y, { actor: R.actorOf(w.player), flip: w.player.face < 0 }); R.trans.spawn('transitions/burn-away', 0, 0, {}); break;
      case 'stun': F.spawn('ice/snowflake-burst', ev.x, ev.y + 20, { palette: GOLD, life: 40 }); break;
      case 'crit': F.spawn('lightning/spark-arc', ev.x, ev.y, { palette: GOLD, life: 30 }); break;
      case 'afterglow': F.spawn('lightning/spark-arc', ev.x, ev.y + 20, { palette: AMBER, life: 30 }); break;
      case 'cleared': F.spawn('ui/quest-complete', p.x + p.w / 2, p.y - 30, {}); break;
      case 'win': F.spawn('ui/achievement', p.x + p.w / 2, p.y - 40, {}); break;
    }
  }

  // 매 틱: 탄에 이펙트 붙이기, 엘리트 표시, 화상·분노 상태, 빛 게이지 가득
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
    for (const e of w.enemies) {
      if (e.elite && !this.elites.has(e)) { this.elites.add(e); F.spawn('status/rage', 0, 0, { follow: e, dy: e.h / 2, actor: R.actorOf(e), flip: e.face > 0, light: 0.3 }); }   // 엘리트: 발밑 마법진(함정처럼 보임) 대신 몸을 감싼 붉은 기운
      if (e.burnT > 0 && !this.burning.get(e)) { this.burning.set(e, true); F.spawn('status/burning', 0, 0, { follow: e, dy: e.h / 2, life: e.burnT, actor: R.actorOf(e), flip: e.face > 0 }); }
      if (!(e.burnT > 0)) this.burning.delete(e);
    }
    if (p.chainN >= 3) F.spawn('status/rage', 0, 0, { follow: p, dy: p.h / 2, key: 'rage', life: 90, actor: R.actorOf(p), flip: p.face < 0 });
    else F.stopKey('rage');
    if (p.light >= 100 && this.prevLight < 100) F.spawn('lightning/spark-arc', 0, 0, { follow: p, palette: AMBER, life: 50, key: 'full' });
    this.prevLight = p.light;
  }
}
