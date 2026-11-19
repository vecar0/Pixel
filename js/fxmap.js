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
const AMBIENT = {
  1: { world: [['fire/candle', 0.15, 300], ['fire/candle', 0.55, 300], ['fire/candle', 0.85, 300], ['critters/wisp', 0.35, 180], ['critters/wisp', 0.75, 150], ['critters/bat', 0.6, 70]],
       screen: ['weather/fog', 'weather/fireflies'], boss: [['fire/brazier', 0.1, 300], ['fire/brazier', 0.9, 300]] },
  2: { world: [['water/drip', 0.2, 40], ['water/drip', 0.5, 30], ['water/drip', 0.8, 40], ['water/ripples', 0.3, 302], ['water/ripples', 0.7, 302], ['fire/candle', 0.45, 300], ['critters/ghost', 0.65, 150]],
       screen: ['weather/god-rays'], boss: [['water/waterfall', 0.04, 220], ['water/waterfall', 0.96, 220], ['water/whirlpool', 0.5, 304]] },
  3: { world: [['fire/torch', 0.15, 290], ['fire/torch', 0.5, 290], ['fire/torch', 0.85, 290], ['pickups/crystal-shard', 0.3, 290], ['pickups/crystal-shard', 0.7, 290], ['ice/ice-crystal', 0.6, 290], ['critters/bat', 0.4, 60]],
       screen: ['weather/fog'], boss: [['arcane/rune-circle', 0.5, 300], ['ice/ice-crystal', 0.1, 290], ['ice/ice-crystal', 0.9, 290]] },
  4: { world: [['shadow/shadow-flames', 0.2, 300], ['shadow/shadow-flames', 0.6, 300], ['fire/spirit-flame', 0.4, 300], ['fire/spirit-flame', 0.85, 300], ['critters/eyeball', 0.3, 120], ['critters/flying-skull', 0.75, 100], ['shadow/eclipse', 0.5, 80]],
       screen: ['weather/aurora'], boss: [['shadow/black-hole', 0.5, 70], ['shadow/necro-skulls', 0.15, 300], ['shadow/necro-skulls', 0.85, 300]] },
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
  'melee/sword-slash', 'melee/uppercut', 'melee/spin-slash', 'impacts/hit-spark', 'impacts/crit-hit', 'impacts/parry', 'impacts/impact-frame', 'impacts/blunt-hit',
  'impacts/shield-block', 'impacts/heavy-landing', 'impacts/ground-slam', 'nature/quake', 'ui/damage-number', 'ui/crit-number', 'ui/heart-lost', 'ui/combo-counter',
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
    preload(['melee/sword-slash', 'melee/uppercut', 'melee/spin-slash', 'impacts/hit-spark', 'impacts/crit-hit', 'impacts/parry', 'ui/damage-number', 'transitions/iris', 'transitions/slash-wipe', 'transitions/pixel-dissolve']);
  }

  // 방에 들어올 때: 배경 생물·불빛·날씨 + 장면 전환
  enterRoom(w, region, boss) {
    const R = this.R, a = AMBIENT[region] || AMBIENT[1];
    R.weather.clear(); this.seen = new WeakSet(); this.elites = new WeakSet(); this.prevLight = 0; this.streak = 0;
    for (const [id, fx, y] of (boss ? a.boss : a.world)) R.fx.spawn(id, w.width * fx, y, { light: 0.6 });
    for (const id of a.screen) R.weather.spawn(id, 160, 170, {});   // 날씨 원점 = 화면 하단 중앙 (meta.origin)
    R.trans.clear(); R.trans.spawn(boss ? 'transitions/slash-wipe' : 'transitions/pixel-dissolve', 0, 0, { skip: boss ? 0.5 : 0.55 });
  }

  events(w) {
    const R = this.R, F = R.fx, p = w.player, feet = p.y + p.h;
    for (const ev of w.events) switch (ev.type) {
      case 'parry':
        if (ev.perfect) {
          F.spawn('impacts/parry', ev.x, feet); R.trans.spawn('impacts/impact-frame', 0, 0, { light: 0.5 });
          this.streak++; if (this.streak >= 3) F.spawn('ui/combo-counter', p.x + p.w / 2, p.y - 20, { count: this.streak, label: 'PARRY', palette: ['#2a1204', '#5a2a08', '#8c4a10', '#d07a1e', '#ffa63a', '#ffd27a', '#fff0c8', '#ffffff'], key: 'combo' + this.streak });
        } else F.spawn('impacts/hit-spark', ev.x, feet, { height: feet - ev.y, flip: p.face > 0, palette: GOLD });
        break;
      case 'attackHit':
        F.spawn(ev.combo === 2 ? 'impacts/crit-hit' : 'impacts/hit-spark', ev.x, ev.y + 20, { height: 20, flip: ev.face < 0 });
        if (ev.crit) F.spawn('ui/crit-number', ev.x, ev.y - 10, { text: String(ev.dmg), label: 'CRIT' });
        else F.spawn('ui/damage-number', ev.x + (Math.random() * 10 - 5), ev.y - 6, { text: String(ev.dmg), palette: ['#1a0e04', '#4a2a0c', '#8c5a14', '#d09a1e', '#ffc63a', '#ffe27a', '#fff6c8', '#ffffff'] });
        break;
      case 'execute': F.spawn('impacts/crit-hit', ev.x, ev.y + 30); F.spawn('explosions/implosion', ev.x, ev.y + 20, { palette: AMBER, life: 60 }); R.trans.spawn('impacts/impact-frame', 0, 0, {}); break;
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
        if (ev.boss) { F.spawn('lightning/lightning-strike', ev.x, ev.y, { life: 90 }); R.trans.spawn('impacts/impact-frame', 0, 0, {}); }
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
      if (b.echo) F.spawn('projectiles/energy-disc', 0, 0, { follow: b, palette: AMBER, flip: b.vx < 0 });
      else if (b.wave) F.spawn(b.src?.kind === 'saint' ? 'water/wave-crash' : 'impacts/ground-slam', 0, 0, { follow: b, dy: 6, palette: b.src?.kind === 'saint' ? undefined : DUST, light: 0.5 });
      else if (b.shard) F.spawn('ice/ice-crystal', 0, 0, { follow: b, palette: LILAC });
      else if (b.bolt && BOLT[b.bolt]) F.spawn(BOLT[b.bolt][0], 0, 0, { follow: b, flip: b.vx < 0, ...BOLT[b.bolt][1] });
    }
    for (const e of w.enemies) {
      if (e.elite && !this.elites.has(e)) { this.elites.add(e); F.spawn('arcane/rune-circle', 0, 0, { follow: e, dy: e.h / 2, palette: ['#2a0808', '#5a1010', '#902020', '#d03a2a', '#ff6a4a', '#ffb090', '#ffe8e0'], light: 0.5 }); }
      if (e.burnT > 0 && !this.burning.get(e)) { this.burning.set(e, true); F.spawn('status/burning', 0, 0, { follow: e, dy: e.h / 2, life: e.burnT, actor: R.actorOf(e), flip: e.face > 0 }); }
      if (!(e.burnT > 0)) this.burning.delete(e);
    }
    if (p.chainN >= 3) F.spawn('status/rage', 0, 0, { follow: p, dy: p.h / 2, key: 'rage', life: 90, actor: R.actorOf(p), flip: p.face < 0 });
    else F.stopKey('rage');
    if (p.light >= 100 && this.prevLight < 100) F.spawn('lightning/spark-arc', 0, 0, { follow: p, palette: AMBER, life: 50, key: 'full' });
    this.prevLight = p.light;
  }
}
