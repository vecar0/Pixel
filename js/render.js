// 렌더러: world를 읽기만 한다. 리라 임시 실루엣 + 적 상자 + pixelfx 이펙트 + 화면 연출
import { clipBeam } from './core/gimmick.js?v=mwvri6pt';
import { CFG } from './core/config.js?v=mwvri6pt';
import { attackBox } from './core/player.js?v=mwvri6pt';
import { ENEMY_DEFS, telegraphOf, recoverOf, EMERGE_F, affinity, DARK_REACT, nameOf, baseOf } from './core/enemies.js?v=mwvri6pt';
import { SPELLS } from './core/spells.js?v=mwvri6pt';
import { nearProp, groundAt, BOSS_DEATH_F, BOSS_FALL_F } from './core/world.js?v=mwvri6pt';
import { FxLayer, ScreenFx, actorFromImage } from './fx.js?v=mwvri6pt';
import { FxDirector } from './fxmap.js?v=mwvri6pt';
import { iconCanvas } from './icons.js?v=mwvri6pt';
import { bodyShade } from './shade.js?v=mwvri6pt';
import { lightSources } from './core/light.js?v=mwvri6pt';
import { ChainSim } from './chain.js?v=mwvri6pt';
// 기본 공격 베기: [pixelfx id, 앞쪽 오프셋, 높이 오프셋] — 스프라이트 칼 궤적 자리에 맞춤
const CINE = { in: 40, out: 150, out2: 185, end: 220 };   // 보스 등장 연출 틱: 페이드인 · 유지 · 페이드아웃 · 전체 방 페이드인
const IRIS_SPEED = 0.6;   // 스테이지 전환 아이리스 속도 (1 = pixelfx 원래 속도)
const SLASH = [['melee/sword-slash', 22, 0], ['melee/uppercut', 20, 0], ['melee/spear-sweep', 64, -26]];
const STEEL = ['#14121c', '#2a2838', '#4a4860', '#7a7890', '#b0aec4', '#dcdae8', '#ffffff'];   // 은빛 칼 (색 과하지 않게)
// 점화한 불꽃 속성별 색 (속성 = 각성한 스탯): 칼 궤적·등불빛·게이지
const EYE_COL = { moth: '#ee8b18', priest: '#86bbc4', bellBoss: '#d5f0ea', forge: '#f4b92f', shadow: '#a93ad4', spider: '#ca82d9', ghoul: '#cfd8a0', spearman: '#e7e0cf', assassin: '#d8b8a8', shellguard: '#f0d8ed', saint: '#d8f0ff', king: '#c8d0c0' };   // 눈 색이 따로 없는 적(빈 눈구멍·투구)의 희미한 눈빛
const EL_RGB = { null: '255,170,70', str: '255,166,58', agi: '122,192,240', wil: '255,214,120', lmp: '150,92,196', vit: '127,224,138', fury: '255,226,74' };
const EL_SLASH = {
  null: ['#4a1a0c', '#8c3414', '#d0661e', '#ffa63a', '#ffd27a', '#fff0c8', '#ffffff'], str: ['#4a1a0c', '#8c3414', '#d0661e', '#ffa63a', '#ffd27a', '#fff0c8', '#ffffff'],   // 속성 이펙트(fxmap AMBER·ICE·GOLD·GHOST·GREEN·VOLT)와 같은 팔레트
  agi: ['#081a2a', '#10345a', '#1e5a8c', '#3a8cc8', '#7ac0f0', '#c0e8ff', '#ffffff'], wil: ['#4a2a0c', '#8c5a14', '#d09a1e', '#ffc63a', '#ffe27a', '#fff6c8', '#ffffff'],
  lmp: ['#020104', '#0a0414', '#180a2a', '#2c1048', '#48206e', '#74409e', '#b498d6'], vit: ['#0a1a0c', '#16361a', '#24582a', '#3a8a3a', '#6ac25a', '#b4ec8a', '#f0ffe0'],
  fury: ['#1a1404', '#4a3a08', '#8a6e10', '#d0b020', '#ffe24a', '#fff6a8', '#ffffff'] };
const AMBER7 = ['#4a1a0c', '#8c3414', '#d0661e', '#ffa63a', '#ffd27a', '#fff0c8', '#ffffff'], SPARK4 = ['#fff6c8', '#ffd86b', '#ff9a2a', '#e8561d'];

const C = {
  bg0: '#0b0910', bg1: '#15111d', pillar: '#1d1826', ground: '#2a2433', groundTop: '#4a4058',
  amber: '#ffb347', amberHi: '#ffe0a0', red: '#ff4f5e', sky: '#7fd4ff', yellow: '#ffe45c', white: '#ffffff',
  ghoul: '#6d7380', moth: '#a39673', boss: '#5a6370',
  // 리라
  hair: '#dcdcec', hairD: '#9e9cb8', skin: '#f3d9c4', cloth: '#d9cbb0', clothD: '#9c8a6c', cape: '#2c3160', capeD: '#1b1e40',
  boot: '#3a2a22', steel: '#e8eef8', eye: '#ffb347',
};
const MAX_PARTICLES = 400;

// 배경과 색감을 맞출 소품 (값 = 배경 색 쪽으로 섞는 정도). 수정·불빛처럼 스스로 빛나는 건 약하게
const PROP_GRADE = { urn: 0.5, spikes: 0.45, vent: 0.45, lever: 0.4, gate: 0.5, chest: 0.4, 'chest-open': 0.35, mover: 0.5, bell: 0.45, chain: 0.5, post: 0.5,
  mirror: 0.2, beacon: 0.5, shrine: 0.45, rack: 0.4, lamp: 0.45, 'deco-barrels': 0.45, 'deco-cart': 0.45, 'deco-bench': 0.45, keeper: 0.25, board: 0.45, scarecrow: 0.4, merchant: 0.2 };   // 인물(등대지기·상인)은 약하게
const DIM = 0.92;                                                       // 소품은 배경보다 아주 조금 어둡게 (어둠 속에 놓인 느낌)
const VQ = () => (window.__V ? '?v=' + window.__V : '');   // 그림·데이터도 새 버전으로 (캐시 버스팅)
// 그림 불러오기: 폰에서 네트워크가 잠깐 끊겨 한 번 실패하면 영영 빈 그림(캐릭터가 사라짐) → 실패하면 몇 번 다시 받는다
const loadImg = src => { const im = new Image(); let n = 0; im.onerror = () => { if (n++ < 6) setTimeout(() => { im.src = src + (src.includes('?') ? '&' : '?') + 'r=' + n; }, 600 * n); }; im.src = src; return im; };
const okImg = im => !!(im && im.complete && im.naturalWidth);
const bellOf = w => (w.props || []).find(o => o.kind === 'bell') || {};
const PHASE2_TITLE = { bellBoss: ['2막 · 무너지는 종탑', '천장에서 잔해가 떨어진다 · 대종이 더 빨리 다시 걸린다'], saint: ['2막 · 차오르는 물', '낮은 바닥에선 느려진다 · 양쪽 제단 위로'],
  spider: ['2막 · 깨어나는 광맥', '세 번째 거울이 자란다 · 천장 수정이 쏟아진다'], shadow: ['2막 · 개기일식', '더 어두워지고 등대가 짧게 탄다'] ,
  forge: ['2막 · 갈라지는 바닥', '바닥에서 쇳물이 솟는다 · 더 자주 달아오른다'], king: ['2막 · 별이 진다', '죽은 별이 떨어진다 · 닻이 더 빨리 다시 솟는다'] };
export class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.dark = document.createElement('canvas'); this.dctx = this.dark.getContext('2d');
    this.fx = new FxLayer(); this.mfx = new FxLayer(1.5) /* 마법 이펙트: 1.5배 굵은 픽셀 (캐릭터 크기에 맞춤) */; this.bgfx = new FxLayer(); this.pfx = new FxLayer(); /* pfx: 리라 베기 (리라 뒤에 그림) */ this.propfx = new FxLayer(); /* 소품에 붙은 불(모닥불·화로): 소품 바로 위, 인물 뒤 */ this.weather = new ScreenFx(); this.trans = new ScreenFx(); this.dir = new FxDirector(this); this.fxid = 0;
    this.parts = []; this.texts = [];
    this.ghosts = [];             // 회피 잔상
    this.tail = null;             // 포니테일 스프링
    this.lantern = { a: 0, v: 0 };
    this.squash = 0; this.flash = 0; this.zoom = 0; this.stunFx = new Map();
    this.debug = /debug=1/.test(location.search);
    // 리라 픽셀 그림 (Higgsfield: 리라 디자인 + 사용자 샘플 화풍 → forge pixel_look로 픽셀 격자 맞춤). 기준점: 발 중앙 (43, 85)
    this.liraImg = loadImg('assets/lira.png' + VQ());
    this.lampImg = loadImg('assets/lantern-throw.png' + VQ());   // 던진 등불
    // 동작 포즈 (Higgsfield 포즈 생성 → 기준 리라 격자로 읽음). 모두 132x111, 발 기준점 (69, 111)
    this.bgs = {}; this.region = 1;   // 지역별 배경은 처음 쓸 때 불러온다
    // 리라 8프레임 애니메이션 (Higgsfield GIF 생성 → 게임 크기·팔레트로 변환). 프레임마다 발 기준점(ax, ay)
    fetch('assets/blade.json' + VQ()).then(r => r.json()).then(J => { this.blade = J; }).catch(() => {});
    fetch('assets/eyes.json' + VQ()).then(r => r.json()).then(J => { this.eyes = J; }).catch(() => {});   // 프레임마다 실제 눈 위치 (어둠 속 눈빛)   // 프레임마다 칼날 둘레 픽셀 (점화 테두리용)
    fetch('assets/anims.json' + VQ()).then(r => r.json()).then(J => {
      for (const k in J) for (const n in J[k]) for (const f of J[k][n]) { f.img = loadImg(f.src + VQ()); }
      this.anims = J.lira; this.enemyAnims = J;
    }).catch(() => {});
    this.pose = {};
    fetch('assets/enemies.json' + VQ()).then(r => r.json()).then(J => {
      for (const kind in J) for (const n in J[kind]) { J[kind][n].img = loadImg(J[kind][n].src + VQ()); }
      this.enemySprites = J;
    }).catch(() => {});
    for (const n of ['idle', 'atk1', 'atkmid', 'atk2', 'parrymid', 'parry', 'hurt', 'roll', 'jump', 'fall', 'run1', 'run2', 'run3', 'run4']) {
      this.pose[n] = loadImg(`assets/lira-${n}.png` + VQ());
    }
    this.resize();
  }

  resize() {
    const H = CFG.VIEW_H, ih = innerHeight, iw = innerWidth;
    let s = Math.min(ih / H, iw / CFG.VIEW_W); if (s >= 2) s = Math.floor(s);   // 좁은 창(4:3 등)에서도 잘리지 않게
    this.vw = Math.min(CFG.VIEW_W_MAX, Math.max(CFG.VIEW_W, Math.floor(iw / s)));
    this.cv.width = this.vw; this.cv.height = H;
    this.dark.width = this.vw; this.dark.height = H;
    this.fx.resize(this.vw, H); this.mfx.resize(this.vw, H); this.bgfx.resize(this.vw, H); this.pfx.resize(this.vw, H); this.propfx.resize(this.vw, H);
    this.cv.style.width = Math.round(this.vw * s) + 'px';
    this.cv.style.height = Math.round(H * s) + 'px';
    this.ctx.imageSmoothingEnabled = false;
  }

  reset() { this.propfx.clear(); this.fx.clear(); this.mfx.clear(); this.bgfx.clear(); this.pfx.clear(); this.weather.clear(); this.trans.clear(); this.parts = []; this.texts = []; this.ghosts = []; this.corpses = []; this.tail = null; this.stunFx.clear(); this.sayMsg = null; this.irisMode = null; this.cine = null; this.death = 0; }

  // 이번 틱 이벤트 → 이펙트 (pixelfx 연결은 fxmap.js의 FxDirector, 여기는 화면 연출·글자·작은 입자)
  spawnFx(w) {
    const p = w.player, feet = p.y + p.h;
    // 기본 공격: 동작마다 맞는 pixelfx 베기 하나만 (1타 내려베기 · 2타 올려베기 · 3타 가로 휘두르기). 타격 불꽃은 따로 안 띄움
    if (p.state === 'attack' && p.stateT === (p.startF ?? CFG.attack.startupF) && p.enchantT > 0) {   // 기본 궤적은 낫 그림에 (큰 호 잔상), 점화했을 때만 속성 색 베기를 덧그림
      const [id, dx, dy] = SLASH[p.combo] || SLASH[0];
      this.pfx.spawn(id, p.x + p.w / 2 + p.face * dx, feet + dy, { flip: p.face < 0, palette: p.enchantT > 0 ? EL_SLASH[p.element || null] : STEEL, light: p.enchantT > 0 ? 0.35 : 0.15, life: 30 });   // 점화한 검: 속성 색 궤적
    }
    this.dir.events(w); this.dir.tick(w);
    for (const ev of w.events) {
      if (ev.type === 'parry' && ev.perfect) { this.flash = 1; this.zoom = 1; this.texts.push({ x: p.x + p.w / 2, y: p.y - 26, t: 0, s: '완벽!' }); }
      else if (ev.type === 'executeStart') { this.pfx.spawn('melee/heavy-cleave', p.x + p.w / 2 + p.face * 24, feet, { flip: p.face < 0, palette: AMBER7, light: 0.4, life: 80, speed: 0.55 }); }
      else if (ev.type === 'execDash') { this.flash = Math.max(this.flash, 0.4); this.zoom = Math.max(this.zoom || 0, 0.6); }
      else if (ev.type === 'execute') { this.flash = 0.8; this.texts.push({ x: ev.x, y: ev.y - 40, t: 0, s: '처형!', life: 60 }); }
      else if (ev.type === 'hurt') { this.burst(ev.x, ev.y, 12, [C.red, '#ffffff'], 2.5); this.flash = -0.5; }
      else if (ev.type === 'enemyParry') this.texts.push({ x: ev.x, y: ev.y - 20, t: 0, s: '간파!' });
      else if (ev.type === 'flurryStart') { this.flash = Math.max(this.flash, 0.45); this.zoom = 0.6; this.texts.push({ x: ev.x, y: ev.y - 80, t: 0, s: '반격!', life: 45 }); }
      else if (ev.type === 'flurryHit') {                                   // 연참: 캐릭터 동작이 주인공, 이펙트는 칼끝 작은 불꽃만
        this.dir.put('impacts/hit-spark', ev.x + ev.face * 40, ev.y - 6, { height: 30, flip: ev.face > 0, palette: ev.k === 3 ? AMBER7 : STEEL, life: 20, light: 0.3 }, 2);
        if (ev.k === 3) { this.flash = Math.max(this.flash, 0.5); }
      }
      else if (ev.type === 'execChain') { this.texts.push({ x: ev.x, y: ev.y - 60, t: 0, s: `연속 처형 ×${ev.n}`, life: 70 }); this.flash = Math.max(this.flash, 0.6); }
      else if (ev.type === 'barrierBreak') { this.texts.push({ x: ev.x, y: ev.y - 50, t: 0, s: '방패 깨짐!', life: 60 }); this.flash = Math.max(this.flash, 0.6); }
      else if (ev.type === 'barrierHit') this.texts.push({ x: ev.x, y: ev.y - 30, t: 0, s: `막힘 (${ev.left})`, life: 30 });
      else if (ev.type === 'bellTrap') { this.flash = 0.9; this.texts.push({ x: ev.x, y: ev.y - 90, t: 0, s: '갇혔다!', life: 70 }); }
      else if (ev.type === 'bellMiss') this.texts.push({ x: ev.x, y: 200, t: 0, s: '빗나감', life: 40 });
      else if (ev.type === 'veilUp') this.say('물의 장막 — 물창을 완벽 패링해 되돌려라');
      else if (ev.type === 'veilBreak') { this.flash = 0.9; this.zoom = 1; this.texts.push({ x: ev.x, y: ev.y - 70, t: 0, s: '장막 붕괴!', life: 70 }); }
      else if (ev.type === 'phase2') { this.flash = 1; this.zoom = 1; const P = PHASE2_TITLE[ev.kind] || ['2막', '']; this.banner = { s: P[0], sub: P[1], t: 170, dur: 170, y: 140 }; }
      else if (ev.type === 'mirrorReflect') { this.beamBack = { x0: ev.x, x1: ev.bx, y: ev.y, t: 14 }; this.flash = 0.8; this.texts.push({ x: ev.bx, y: ev.by - 70, t: 0, s: '반사!', life: 60 }); }
      else if (ev.type === 'debris' && !(this.debrisHint = this.debrisHint || {})[w.room + ev.crystal + ev.star]) { this.debrisHint[w.room + ev.crystal + ev.star] = 1; this.say(ev.crystal || ev.star ? '떨어지는 것 — 바닥의 금빛 원 자리에 떨어진다. 피하거나 패링하라' : '천장이 무너진다 — 바닥의 붉은 원 자리에 돌이 떨어진다. 비켜서라', 220); }
      else if (ev.type === 'bossDying') { this.flash = 1; this.zoom = 1; }
      else if (ev.type === 'bossFall') { this.flash = 1; this.zoom = 1; this.banner = { s: `${ENEMY_DEFS[ev.kind].name} 격파`, sub: '대등에 다시 불이 붙는다', t: 170, dur: 170, y: 120 }; }
      else if (ev.type === 'kill' && !ev.boss && ev.ent) {                 // 일반 적 쓰러짐: 지금 프레임을 붙잡아 번쩍 → 가라앉으며 흩어짐
        const e = ev.ent, f = this.enemyFrame(w, { ...e, st: 'idle', vx: 0, atk: null }, ENEMY_DEFS[e.kind]);
        if (f) (this.corpses = this.corpses || []).push({ f, x: e.x + e.w / 2, y: e.y + e.h, face: e.face, w: e.w, h: e.h, t: 0, fly: !!ENEMY_DEFS[e.kind].fly });
      }
      else if (ev.type === 'spawn' && !ev.boss) { this.reactHint(w, ev); for (let i = 0; i < 10; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 30, y: ev.y - 2, vx: (Math.random() - 0.5) * 1.2, vy: -0.4 - Math.random() * 0.8, life: 24 + Math.random() * 12, col: Math.random() < 0.5 ? '#3a3640' : '#5e5866', s: 2 }); }   // 등장: 발밑 흙먼지
      else if (ev.type === 'affinity') this.texts.push({ x: ev.x, y: ev.y - 34, t: 0, s: ev.aff > 0 ? '약점!' : '저항', life: 60, col: ev.aff > 0 ? EL_SLASH[ev.el][5] : '#8a8494' });   // 속성 상성
      else if (ev.type === 'alarm') { this.texts.push({ x: ev.x, y: ev.y - 24, t: 0, s: '경보!', life: 60, col: '#ff4f5e' }); (this.ripples = this.ripples || []).push({ x: ev.x, y: ev.y + 30, r: 6, t: 0, c: '255,79,94', max: ev.r }); }
      else if (ev.type === 'sigil') { this.texts.push({ x: ev.x, y: ev.y - 40, t: 0, s: '각인!', life: 50, col: EL_SLASH[ev.el][5] }); if (!this.sigilHint) { this.sigilHint = 1; this.say(`마법 각인 — 이 적을 처형하면 「${SPELLS[ev.spell] ? SPELLS[ev.spell].name : '마법'}」이 터진다`, 220); } }
      else if (ev.type === 'attackHit' && !ev.spell) {                     // 칼이 닿은 자리: 불티가 앞으로 튐 (점화 중이면 속성 불길)
        const pl = w.player, lit = pl.enchantT > 0, P = EL_SLASH[pl.element || null], n = (ev.combo === 2 ? 12 : 7) + (ev.crit ? 6 : 0);
        for (let i = 0; i < n; i++) { const a = (Math.random() - 0.5) * 1.6, sp = 1.2 + Math.random() * 2.4, life = 10 + Math.random() * 10;
          if (lit) (this.flames = this.flames || []).push({ x: ev.x, y: ev.y, vx: Math.cos(a) * sp * (ev.face || 1), vy: Math.sin(a) * sp - 0.6, life, max: life, ph: Math.random() * 6, P });
          else this.parts.push({ x: ev.x, y: ev.y, vx: Math.cos(a) * sp * (ev.face || 1), vy: Math.sin(a) * sp - 0.5, g: 0.12, life: life * 0.8, col: SPARK4[(Math.random() * 3) | 0], s: Math.random() < 0.3 ? 2 : 1 }); }
      }
      else if (ev.type === 'execShock') this.texts.push({ x: ev.x, y: ev.y - 24, t: 0, s: '무너짐!', life: 45, col: '#ffd27a' });   // 처형의 충격으로 흔들리던 적이 무너짐 → 연속 처형
      else if (ev.type === 'enrage') this.texts.push({ x: ev.x, y: ev.y - 24, t: 0, s: '버팀!', life: 45, col: '#ff8a5a' });   // 연타당한 적이 버티고 반격
      else if (ev.type === 'enemyStrike' && baseOf(ev.kind) === 'moth') { const e = w.enemies.find(o => baseOf(o.kind) === 'moth' && o.st === 'active' && Math.abs(o.x + o.w / 2 - ev.x) < 40); if (e) e.dustT = 24; }   // 나방 돌진: 날개 가루가 흩날림 (아래 parts)
      else if (ev.type === 'dazzle') this.texts.push({ x: ev.x, y: ev.y - 24, t: 0, s: '눈부심', life: 50, col: '#ffe9a0' });
      else if (ev.type === 'assassinate') { this.texts.push({ x: ev.x, y: ev.y - 20, t: 0, s: ev.elite ? '급습!' : '암살!', life: 50 }); this.flash = Math.max(this.flash, 0.3); }
      else if (ev.type === 'flash') { this.flash = Math.max(this.flash, 0.3); this.zoom = Math.max(this.zoom || 0, 0.15); this.lampFlash = { t: 0, el: ev.el }; }   // 다시 켬: 등불에서 작은 섬광
      else if (ev.type === 'heatUp') { this.texts.push({ x: ev.x, y: ev.y - 80, t: 0, s: '달아올랐다!', life: 60 }); this.say('거인이 달아올랐다 — 밸브 옆으로 유인해 밸브를 베어라', 200); }
      else if (ev.type === 'quench') { this.flash = ev.hot ? 0.8 : 0.3; this.texts.push({ x: ev.x, y: ev.y - 80, t: 0, s: ev.hot ? '식었다! 갑옷에 금이 갔다' : '증기!', life: 70 }); }
      else if (ev.type === 'steam' && !ev.hit) this.texts.push({ x: ev.x, y: 210, t: 0, s: '쉬익—', life: 30 });
      else if (ev.type === 'anchorHit' && ev.broke) this.texts.push({ x: ev.x, y: 200, t: 0, s: '닻이 부서졌다', life: 50 });
      else if (ev.type === 'chainsBroken') { this.flash = 1; this.texts.push({ x: ev.x, y: ev.y - 80, t: 0, s: '사슬이 끊겼다!', life: 80 }); }
      else if (ev.type === 'anchorRise') this.texts.push({ x: ev.x, y: 210, t: 0, s: '닻이 다시 솟았다', life: 50 });
      else if (ev.type === 'exposed') this.texts.push({ x: ev.x, y: ev.y - 16, t: 0, s: '드러났다!', life: 50 });
      else if (ev.type === 'beaconOut' && ev.snuffed) this.texts.push({ x: ev.x, y: 230, t: 0, s: '등대가 꺼졌다', life: 50 });
      else if (ev.type === 'resist' && w.t - (this.resistT || 0) > 40) { this.resistT = w.t; this.texts.push({ x: ev.x, y: ev.y - 10, t: 0, s: ev.veil ? '장막' : ev.kind === 'forge' ? '달군 갑옷' : ev.kind === 'king' ? '사슬' : '어둠', life: 30 }); }
      else if (ev.type === 'heal') this.healFx(p, ev.amount, ev.from);
      else if (ev.type === 'aegis') this.texts.push({ x: ev.x, y: ev.y - 30, t: 0, s: '수호!' });
      else if (ev.type === 'resonance') this.texts.push({ x: p.x + p.w / 2, y: p.y - 20, t: 0, s: '흘려 막기' });
      else if (ev.type === 'land') {
        this.squash = Math.min(1, ev.v / 7);
        if (ev.v > 3) { this.dust(ev.x - 4, ev.y, -1, 5); this.dust(ev.x + 4, ev.y, 1, 5); }
      }
    }
    if (p.state === 'run' && w.t % 9 === 0) this.dust(p.x + p.w / 2 - p.face * 5, feet, -p.face, 2);   // 달리기 먼지
  }

  dust(x, y, dir, n) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= MAX_PARTICLES) this.parts.shift();
      this.parts.push({ x, y: y - 1, vx: dir * (0.4 + Math.random() * 1.2), vy: -Math.random() * 0.8, life: 14 + Math.random() * 10, col: ['#5a5068', '#7a6e88', '#4a4258'][i % 3], g: 0.02, s: 2 + (Math.random() < 0.4) });
    }
  }
  burst(x, y, n, cols, sp) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= MAX_PARTICLES) this.parts.shift();
      const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random());
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 10 + Math.random() * 12, col: cols[i % cols.length], g: 0.15, s: 2 });
    }
  }

  // 시뮬레이션 1틱마다 (히트스톱 중엔 이펙트도 멈춤)
  stepFx(w) {
    const frozen = w.hitstop > 0;
    if (!frozen) { this.fx.update(1 / CFG.TICK); this.mfx.update(1 / CFG.TICK); this.pfx.update(1 / CFG.TICK); }
    this.bgfx.update(1 / CFG.TICK); this.propfx.update(1 / CFG.TICK);
    this.weather.update(1 / CFG.TICK); this.trans.update(1 / CFG.TICK);
    if (this.irisMode) { this.irisClock += IRIS_SPEED / CFG.TICK; if (this.irisMode === 'open' && this.irisClock >= 2.2) this.irisMode = null; }
    for (const p of this.parts) { p.x += p.vx; p.y += p.vy; p.vy += p.g || 0; p.vx *= 0.92; p.life--; }
    this.parts = this.parts.filter(p => p.life > 0);
    if (this.flames) { for (const q of this.flames) { q.ph += 0.5; q.x += q.vx + Math.sin(q.ph) * 0.3; q.y += q.vy; q.vy -= 0.035; q.vx *= 0.94; q.life--; } this.flames = this.flames.filter(q => q.life > 0); if (this.flames.length > 260) this.flames.splice(0, this.flames.length - 260); }
    const pl = w.player; if (pl.state === 'roll' && pl.stateT < CFG.roll.totalF && pl.stateT % 3 === 0) this.ghosts.push({ x: pl.x, y: pl.y, face: pl.face, life: 12 });   // 회피 잔상
    for (const e of w.enemies) if (!e.dead) {                              // 화상(burnT): 몸에서 불꽃이 오름 · 빙결(frozenT): 서리가 날림
      if (e.burnT > 0 && w.t % 3 === 0) this.parts.push({ x: e.x + Math.random() * e.w, y: e.y + e.h * (0.3 + Math.random() * 0.6), vx: (Math.random() - 0.5) * 0.3, vy: -0.8 - Math.random() * 0.6, life: 16, col: Math.random() < 0.5 ? '#ff7a2a' : '#ffd27a', s: 2 });
      if (e.frozenT > 0 && w.t % 4 === 0) this.parts.push({ x: e.x + Math.random() * e.w, y: e.y + Math.random() * e.h, vx: 0, vy: 0.3, life: 18, col: '#dff4ff', s: 1 });
    }
    if (pl.enchantT > 0 && this.lastFr && this.blade) { const D = this.blade[this.lastFr.src], M = D && D.m && D.m.length ? D.m : D && D.o; if (M && M.length) {   // 점화한 칼: 날 전체에서 불길이 타오름
      const fr = this.lastFr, f = pl.face, swing = pl.state === 'attack' || pl.state === 'flurry', n = swing ? 9 : 5, P = EL_SLASH[pl.element || null];
      for (let k = 0; k < n; k++) { const row = M[(Math.random() * M.length) | 0], px = row[1][(Math.random() * row[1].length) | 0], life = 12 + Math.random() * 14;
        (this.flames = this.flames || []).push({ x: pl.x + pl.w / 2 + f * (px - fr.ax) + (Math.random() - 0.5) * 2, y: pl.y + pl.h + (row[0] - fr.ay), vx: (Math.random() - 0.5) * 0.35 - (swing ? f * 0.6 : 0), vy: -0.4 - Math.random() * 0.7, life, max: life, ph: Math.random() * 6.28, P }); } } }
    else if (this.lastFr && this.blade && pl.state !== 'dead' && pl.state !== 'ghost' && !pl.dark) {   // 낫 날: 늘 잔불이 핥듯이 타오름 (점화하면 위처럼 크게)
      const D = this.blade[this.lastFr.src], M = D && D.m; if (M && M.length) {
        const fr = this.lastFr, f = pl.face, swing = pl.state === 'attack' || pl.state === 'flurry' || pl.state === 'execute', n = swing ? 3 : (w.t % 2 === 0 ? 1 : 0), P = EL_SLASH[null];
        for (let k = 0; k < n; k++) { const row = M[(Math.random() * M.length) | 0], px = row[1][(Math.random() * row[1].length) | 0], life = 7 + Math.random() * 8;
          (this.flames = this.flames || []).push({ x: pl.x + pl.w / 2 + f * (px - fr.ax) + (Math.random() - 0.5), y: pl.y + pl.h + (row[0] - fr.ay), vx: (Math.random() - 0.5) * 0.25 - (swing ? f * 0.4 : 0), vy: -0.35 - Math.random() * 0.5, life, max: life, ph: Math.random() * 6.28, P }); } } }
    if (pl.state === 'execute' && pl.execMode === 'chain' && pl.stateT < CFG.execute.chainHitF && pl.stateT % 2 === 0) this.ghosts.push({ x: pl.x, y: pl.y, face: pl.face, life: 14, st: 'execute', stT: pl.stateT, mode: 'chain', amber: true });   // 연속 처형 돌진 잔상
    for (const g of this.ghosts) g.life--;
    this.ghosts = this.ghosts.filter(g => g.life > 0);
    if (this.corpses) { for (const c of this.corpses) c.t++; this.corpses = this.corpses.filter(c => c.t < 24); }
    for (const t of this.texts) t.t++;
    this.texts = this.texts.filter(t => t.t < (t.life || 40));
    if (this.hpGain && --this.hpGain.t <= 0) this.hpGain = null;
    this.squash *= 0.8; this.zoom *= 0.85;
    this.flash = this.flash > 0 ? Math.max(0, this.flash - 0.18) : Math.min(0, this.flash + 0.1);
    this.stepBody(w);
  }

  // 포니테일·랜턴 2차 흔들림
  stepBody(w) {
    const p = w.player, hx = p.x + p.w / 2 - p.face * 3, hy = p.y + 5;
    if (!this.tail) this.tail = Array.from({ length: 5 }, () => ({ x: hx, y: hy, px: hx, py: hy }));
    const T = this.tail;
    T[0].x = hx; T[0].y = hy;
    for (let i = 1; i < T.length; i++) {
      const n = T[i], vx = (n.x - n.px) * 0.86, vy = (n.y - n.py) * 0.86;
      n.px = n.x; n.py = n.y; n.x += vx - p.face * 0.25; n.y += vy + 0.35;
      const a = T[i - 1], dx = n.x - a.x, dy = n.y - a.y, d = Math.hypot(dx, dy) || 1, L = 3.2;
      n.x = a.x + dx / d * L; n.y = a.y + dy / d * L;
    }
    const L = this.lantern;
    L.v += (-Math.sin(L.a) * 0.09) - p.vx * 0.012 * (p.onGround ? 1 : 0.5); L.v *= 0.9; L.a += L.v;
    if (p.state === 'parry' && p.stateT < 4) L.a = -p.face * 1.2;   // 패링: 랜턴을 앞으로 휘두르기
  }

  // 그리기 안전망: 어느 한 그림에서 오류가 나도 리라는 반드시 그린다 (마을·방에서 캐릭터가 사라지던 버그 대비)
  draw(w) {
    this._liraDone = false;
    try { this.drawFrame(w); }
    catch (err) {
      if (!this._errLogged) { this._errLogged = true; console.warn('draw error', err); }
      const g = this.ctx; for (let i = 0; i < 24; i++) g.restore();      // 쌓인 save를 모두 풀고 (남는 restore는 아무 일도 안 함)
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
      if (!this._liraDone && this._cam) { g.save(); g.translate(this._cam[0], this._cam[1]); try { this.drawLira(g, w, w.player); } catch (_) { } g.restore(); }
    }
  }
  drawFrame(w) {
    const g = this.ctx, H = CFG.VIEW_H, vw = this.vw, p = w.player;
    const boss = this.cine && this.cine.focusBoss && w.enemies.find(e => e.boss);
    const camX = Math.max(0, Math.min(w.width - vw, boss ? boss.x + boss.w / 2 - vw / 2 : p.x + p.w / 2 - vw * 0.4));   // 등장 연출 중엔 보스를 비춤
    const still = this.hud === false;                                   // 메뉴 화면이 열려 있으면 뒤 배경은 멈춘 그림 (흔들림·확대 없음)
    const sh = !still && !this.death && p.state !== 'dead' && w.shake > 0 ? Math.min(5, w.shake / 2) : 0;   // 죽는 중엔 흔들지 않음 (세계가 멈춰 흔들림이 계속되던 문제)
    const sx = Math.round((Math.random() - 0.5) * 2 * sh), sy = Math.round((Math.random() - 0.5) * 2 * sh);
    const ox = Math.round(-camX) + sx, oy = sy; this._cam = [ox, oy];

    g.save();
    // 완벽 패링 줌인: 리라를 중심으로 살짝 당김
    const dz = this.death ? Math.min(1, this.death / 60) : 0;
    if (dz > 0 && !still) { const z = 1 + dz * 0.3, cx = p.x + p.w / 2 + ox, cy = p.y + p.h - 20 + oy; g.translate(cx, cy); g.scale(z, z); g.translate(-cx, -cy); }   // 사망: 리라 쪽으로 천천히 확대
    const ex = p.state === 'execute' ? Math.min(1, p.stateT / 10) * (p.stateT > CFG.execute.totalF - 10 ? (CFG.execute.totalF - p.stateT) / 10 : 1) : 0;
    this.execK = ex;
    if (ex > 0.01 && !still) {                                            // 처형: 리라 쪽으로 22%까지 확대
      const z = 1 + ex * 0.22, cx = p.x + p.w / 2 + ox + p.face * 20, cy = p.y + 30 + oy;
      g.translate(cx, cy); g.scale(z, z); g.translate(-cx, -cy);
    } else if (this.zoom > 0.02 && !still) {
      const z = 1 + this.zoom * 0.07, cx = p.x + p.w / 2 + ox, cy = p.y + 20 + oy;
      g.translate(cx, cy); g.scale(z, z); g.translate(-cx, -cy);
    }

    const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, C.bg1); grd.addColorStop(1, C.bg0);
    g.fillStyle = grd; g.fillRect(-20, -20, vw + 40, H + 40);
    const bd = this.drawBackdrop(g, w, camX, sx, sy);
    this.bgfx.draw(g, camX, sx, sy);                                      // 배경 장식 (촛불·횃불·물방울): 어둠 아래 = 배경
    this.weather.draw(g, vw, H, 0.8);                                     // 날씨 (안개·반딧불·빛줄기·오로라)
    if (!bd) {
      g.fillStyle = C.pillar;
      for (let i = -1; i < 12; i++) { const x = Math.round(i * 140 - (camX * 0.4) % 140); g.fillRect(x, 40, 36, 260); }
      g.save(); g.translate(ox, oy);
      g.fillStyle = C.ground; for (const s of w.solids) g.fillRect(s.x, s.y, s.w, s.h);
      g.fillStyle = C.groundTop; for (const s of w.solids) g.fillRect(s.x, s.y, s.w, 2);
      g.restore();
    }

    // 어둠: 리라 랜턴 주변만 밝다 (적·예고·탄은 이 위에 그려서 절대 가려지지 않음)
    const d = this.dctx;
    d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, vw, H);
    const beacons = (w.props || []).filter(o => o.kind === 'beacon');
    d.fillStyle = beacons.length ? (w.eclipse ? 'rgba(2,1,4,0.9)' : 'rgba(4,2,8,0.78)') : w.town ? 'rgba(4,2,8,0.18)' : 'rgba(4,2,8,0.84)'; d.fillRect(0, 0, vw, H);   // 등불에서 멀면 거의 안 보임 (그림자 보스방은 더 어둡다)
    d.globalCompositeOperation = 'destination-out';
    for (const o of beacons) if (o.litT > 0) {                            // 켜진 등대: 둥근 빛 구멍
      const bx = o.x + ox, by = 248 + oy, r = 150 * Math.min(1, o.litT / 40), bg = d.createRadialGradient(bx, by, 10, bx, by, r);
      bg.addColorStop(0, 'rgba(0,0,0,1)'); bg.addColorStop(0.7, 'rgba(0,0,0,0.85)'); bg.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = bg; d.fillRect(0, 0, vw, H);
    }
    const fade = this.death ? Math.max(0.12, 1 - Math.max(0, this.death - 70) / 90) : 1;   // 죽으면 등불이 서서히 꺼짐
    this.lightS = w.town ? [{ x: p.x + p.w / 2, y: p.y + p.h / 2, r: 130, src: 'held' }] : lightSources(w);
    const Ls = [...this.lightS]; if (!w.town && p.lamp && p.lamp.st !== 'held') Ls.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, r: 30, src: 'none' });   // 등불을 던져 손이 비면 리라 곁은 거의 어둠 (몸만 겨우 보임 · 판정 없음)
    const L0 = Ls[0] || { x: p.x + p.w / 2, y: p.y + p.h / 2, r: 30 }; this.lampX = L0.x; this.lampY = L0.y; this.lampR = L0.r * fade;
    for (const L of Ls) {                                                 // 빛마다 둥근 구멍 (빛 = 벨 수 있는 곳)
      const lx = L.x + ox, ly = L.y + oy, lr = L.r * fade * 1.12;
      const lg = d.createRadialGradient(lx, ly, 8, lx, ly, lr); lg.addColorStop(0, 'rgba(0,0,0,1)'); lg.addColorStop(0.78, 'rgba(0,0,0,0.92)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = lg; d.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
    }
    const lx = this.lampX + ox, ly = this.lampY + oy, lr = this.lampR;
    if (!w.town) this.groundBand(d, w, ox, oy, 0.72);                      // 땅(걷는 면)은 어둠 속에서도 보이게
    g.drawImage(this.dark, 0, 0);
    g.globalCompositeOperation = 'lighter';
    for (const L of Ls) {                                                 // 따스한 빛 (등잔 색이 있으면 그 색)
      const x0 = L.x + ox, y0 = L.y + oy, r0 = L.r * fade, wg = g.createRadialGradient(x0, y0, 2, x0, y0, r0 * 0.75);
      wg.addColorStop(0, `rgba(${p.color ? EL_RGB[p.color] : '255,170,70'},${L.src === 'temp' ? 0.12 : 0.22})`); wg.addColorStop(1, 'rgba(255,170,70,0)');
      g.fillStyle = wg; g.fillRect(x0 - r0, y0 - r0, r0 * 2, r0 * 2);
    }
    g.globalCompositeOperation = 'source-over';
    if (!w.town) for (const L of Ls) if (L.src !== 'none' && L.src !== 'temp') {   // 빛의 가장자리: 점선 고리 (이 안의 그림자만 실체가 됨)
      const x0 = Math.round(L.x + ox), y0 = Math.round(L.y + oy), r0 = L.r * fade, n = Math.max(24, (r0 * 0.5) | 0);
      g.fillStyle = `rgba(${p.color ? EL_RGB[p.color] : '255,196,120'},0.32)`;
      for (let i = 0; i < n; i += 2) { const a0 = i / n * Math.PI * 2 + w.t * 0.004; g.fillRect(Math.round(x0 + Math.cos(a0) * r0), Math.round(y0 + Math.sin(a0) * r0 * 0.92), 2, 1); }
    }

    g.save(); g.translate(ox, oy);
    if (!w.town) this.drawGroundEdge(g, w, 0.16);                         // 멀리 있는 땅의 윤곽
    if (w.props) this.drawProps(g, w);                                    // 쉼터 오브젝트 (상인 등)
    g.translate(-ox, -oy); this.propfx.draw(g, camX, sx, sy); g.translate(ox, oy);   // 모닥불·제단 불: 소품과 한 몸으로, 인물 뒤에
    if (w.level) this.drawLevel(g, w);                                    // 항아리·가시·분출구·발판·레버·철문·상자
    const hideChars = this.irisBusy() || (this.cine && this.cine.hideLira);
    for (const e of w.enemies) if (e.dummy) {                              // 마을 허수아비 이름표
      g.font = '10px Galmuri9, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const x = Math.round(e.x + e.w / 2), y = 214;
      g.fillStyle = '#0d0a11'; for (const [ddx, ddy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.fillText('허수아비 (연습 상대)', x + ddx, y + ddy); g.fillStyle = '#cfc6dc'; g.fillText('허수아비 (연습 상대)', x, y);
      g.textAlign = 'left'; g.textBaseline = 'top';
    }
    for (const gh of this.ghosts) { g.globalAlpha = gh.life / 12 * 0.45; this.drawLira(g, w, { ...p, x: gh.x, y: gh.y, face: gh.face, state: gh.st || 'ghost', stateT: gh.stT ?? p.stateT, execMode: gh.mode, chainNext: null, iframes: 0 }); }
    g.globalAlpha = 1;
    const hasBeacon = (w.props || []).some(o => o.kind === 'beacon');
    const trapped = bellOf(w).st === 'down' && bellOf(w).trapped;           // 대종에 갇힌 보스는 종 안 (그리지 않음). 허수아비는 그림 + 맞으면 흔들림
    if (!this.irisBusy()) for (const e of w.enemies) { if (e === trapped) continue; if (e.dummy && this.img('scarecrow')) { const im = this.img('scarecrow'), k = e.flash > 0 ? Math.sin(e.flash * 1.6) * 0.12 : 0; g.save(); g.translate(e.x + e.w / 2, 300); g.rotate(k); if (e.flash > 3) g.filter = 'brightness(1.8)'; g.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight + 1); g.restore(); continue; } if (hasBeacon && e.boss && !e.exposed) g.globalAlpha = 0.55; const fk = e.solid === false ? 0 : this.farK(w, e); if (fk > 0) g.globalAlpha = Math.max(0, 1 - fk); this.drawEnemy(g, w, e); g.globalAlpha = 1; if (fk > 0.3) this.drawEyes(g, w, e, Math.min(1, fk) * 0.85); else if (e.solid === false) this.drawEyes(g, w, e, 0.9); }   // 어둠 속 그림자는 흐릿하게
    if (w.bossDeath && w.bossDeath.t < BOSS_DEATH_F) this.drawBossDeath(g, w);   // 쓰러지는 보스
    for (const e of w.enemies) if (e.elB > 0 && !e.dead && !e.boss) {        // 속성 게이지 (점화한 검으로 쌓임): 머리 위 작은 막대
      const k = Math.min(1, e.elB / CFG.enchant.hits), x = Math.round(e.x + e.w / 2 - 12), y = Math.round(e.y - 8);
      g.fillStyle = 'rgba(8,6,14,.8)'; g.fillRect(x - 1, y - 1, 26, 5); g.fillStyle = `rgb(${EL_RGB[e.elK || null]})`; g.fillRect(x, y, Math.round(24 * k), 3);
    }
    if (p.enchantT > 0 && p.element && !p.dark) for (const e of w.enemies) {   // 점화한 동안: 약점인 적 머리 위에 속성 색 ▲, 저항은 회색 ▼
      if (e.dead || e.spawnT > 0 || e.dummy || this.farK(w, e) > 0.5) continue;
      const af = affinity(e, p.element); if (!af) continue;
      const [, ey] = this.eyePos(w, e), x = Math.round(e.x + e.w / 2), y = Math.round(Math.min(e.y - 10, ey - 22) - (e.elB > 0 ? 8 : 0) - (af > 0 ? Math.abs(Math.sin(w.t * 0.12)) * 2 : 0));   // 머리 위 (그림 꼭대기 근처)
      const tri = (r, up) => { g.beginPath(); if (up) { g.moveTo(x - r, y + r * 0.6); g.lineTo(x + r, y + r * 0.6); g.lineTo(x, y - r); } else { g.moveTo(x - r, y - r * 0.6); g.lineTo(x + r, y - r * 0.6); g.lineTo(x, y + r); } g.fill(); };
      g.fillStyle = 'rgba(8,6,14,.85)'; tri(7, af > 0); g.fillStyle = af > 0 ? EL_SLASH[p.element][5] : '#8a8494'; tri(4.5, af > 0);
    }
    for (const e of w.enemies) if (e.dustT > 0 && !e.dead) {                // 나방 날개 가루: 돌진하는 동안 뒤로 옅은 가루가 떨어짐
      e.dustT--; if (w.t % 2 === 0) this.parts.push({ x: e.x + e.w / 2 - e.face * 6 + (Math.random() - 0.5) * 10, y: e.y + e.h / 2 + (Math.random() - 0.5) * 8, vx: -e.face * 0.3 + (Math.random() - 0.5) * 0.3, vy: 0.25 + Math.random() * 0.3, life: 26, col: Math.random() < 0.5 ? '#b89f78' : '#dcc8a2', s: 1 });
    }
    for (const e of w.enemies) if (e.sigil && !e.dead && this.farK(w, e) < 0.6) {   // 마법 각인: 몸 둘레를 도는 속성 색 고리 (처형하면 마법)
      const P = EL_SLASH[e.sigilEl || null], cx = e.x + e.w / 2, cy = e.y + e.h * 0.55, rx = e.w / 2 + 10, ry = 7, a0 = w.t * 0.06;
      g.strokeStyle = `rgba(${EL_RGB[e.sigilEl || null]},${0.35 + 0.15 * Math.sin(w.t * 0.15)})`; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.stroke(); g.lineWidth = 1;
      for (let i = 0; i < 12; i++) { const a = a0 + i * Math.PI / 6, x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry), sz = i % 3 ? 2 : 4; g.fillStyle = Math.sin(a) > 0 ? P[6] || P[5] : P[4]; g.fillRect(x - (sz >> 1), y - (sz >> 1), sz, sz); }
    }
    for (const e of w.enemies) if (e.barrier > 0 && !e.dead) this.drawBarrier(g, w, e);   // 강적 수호 방패
    if (w.props) this.drawGimmickFront(g, w);                             // 대종은 보스 위에 (가둠)
    this.drawWarnings(g, w);
    if (p.dark || p.state === 'relight') this.drawDarkness(g, w);         // 소등: 어둠 (적 눈빛·실루엣·소리 파문)
    g.globalAlpha = 1;
    g.translate(-ox, -oy); this.pfx.draw(g, camX, sx, sy); g.translate(ox, oy);
    if (!hideChars) this.drawLira(g, w, p);
    if (!hideChars) this.drawLampOut(g, w, p);                           // 던진 등불 + 사슬
    this._liraDone = true;
    this.drawSmear(g, w);
    if (this.flames && this.flames.length) {                               // 칼 불길: 흰 심지 → 밝은 불 → 속성 색 → 잉걸 → 연기. 어릴수록 크고 밝게 (덧칠로 빛남)
      g.globalCompositeOperation = 'lighter';
      for (const q of this.flames) { const k = 1 - q.life / q.max; if (k > 0.6) continue; const s2 = k < 0.25 ? 4 : 3; g.globalAlpha = 0.12 * (1 - k); g.fillStyle = q.P[4]; g.fillRect(Math.round(q.x) - s2, Math.round(q.y) - s2, s2 * 2, s2 * 2); }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      for (const q of this.flames) { const k = 1 - q.life / q.max, c = k < 0.12 ? q.P[6] : k < 0.3 ? q.P[5] : k < 0.5 ? q.P[4] : k < 0.68 ? q.P[3] : k < 0.85 ? q.P[2] : '#3a3440', sz = k < 0.3 ? 2 : 1;
        g.globalAlpha = k < 0.85 ? 1 : 0.5 * (1 - k) / 0.15 + 0.2; g.fillStyle = c; g.fillRect(Math.round(q.x), Math.round(q.y), sz, sz + (k < 0.5 ? 1 : 0)); }
      g.globalAlpha = 1;
    }
    const BT = this._bladeTop; if (BT && !hideChars && BT.t === w.t) {     // 칼을 불길 위에: 어두운 테두리 + 칼날 (모양 구분)
      const o = this.bladeOutline(BT.fr, BT.el), bo = this.bladeOnly(BT.fr, BT.base);
      g.save(); g.translate(BT.cx, BT.feet); g.scale(BT.sx * BT.f, BT.sy); if (o) g.drawImage(o, -BT.fr.ax, -BT.fr.ay); if (bo) g.drawImage(bo, -BT.fr.ax, -BT.fr.ay); g.restore();
    }
    if (this.lampFlash) {                                                  // 섬광: 등불에서 짧게 번쩍 (빛 + 짧은 빛살 8줄, 점화한 상태면 속성 색)
      const F = this.lampFlash, k = F.t / 18, x = this.lampX, y = this.lampY, P = EL_SLASH[F.el === undefined ? null : F.el] || EL_SLASH[null];
      const rgb = F.el === undefined ? '255,214,140' : EL_RGB[F.el || null], R = 10 + 30 * Math.min(1, k * 2);
      g.globalCompositeOperation = 'lighter';
      const gl = g.createRadialGradient(x, y, 0, x, y, R); gl.addColorStop(0, `rgba(255,250,230,${0.8 * (1 - k)})`); gl.addColorStop(0.35, `rgba(${rgb},${0.45 * (1 - k)})`); gl.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gl; g.fillRect(x - R, y - R, R * 2, R * 2);
      g.globalCompositeOperation = 'source-over';
      if (k < 0.75) for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + 0.2, r0 = 4 + 10 * k, r1 = r0 + (i & 1 ? 5 : 9) * (1 - k);
        g.fillStyle = i & 1 ? P[4] : P[5];
        for (let r = r0; r < r1; r += 1) g.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1);
      }
      g.fillStyle = '#fffbe8'; if (k < 0.4) g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      if (++F.t > 18) this.lampFlash = null;
    }
    if (p.state === 'flask' && !hideChars) {                             // 기름병 마시는 중: 머리 위 초록 원이 차오름
      const k = Math.min(1, p.stateT / (CFG.flask.useF * (p.mods.flaskSpeed || 1))), cx = p.x + p.w / 2, cy = p.y - 30;
      g.fillStyle = 'rgba(13,10,17,.7)'; g.beginPath(); g.arc(cx, cy, 8, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#7fe08a'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 6, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.stroke(); g.lineWidth = 1;
      g.drawImage(iconCanvas('flask', 'heal'), Math.round(cx - 6), Math.round(cy - 6));
    }
    for (const b of w.projectiles) {
      if (b._fx) continue;
      const bx = b.x + b.w / 2, by = b.y + b.h / 2, r = Math.max(3, Math.min(b.w, b.h) / 2);     // 이펙트 없는 탄: 사각형 대신 빛나는 구슬
      const gl = g.createRadialGradient(bx, by, 0, bx, by, r * 2.2), col = b.owner === 'player' ? '255,200,110' : b.parryable ? '235,230,255' : '255,110,120';
      gl.addColorStop(0, `rgba(${col},0.95)`); gl.addColorStop(0.45, `rgba(${col},0.5)`); gl.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gl; g.beginPath(); g.arc(bx, by, r * 2.2, 0, Math.PI * 2); g.fill();
    }
    this.drawDebris(g, w);
    for (const c of this.corpses || []) {                                  // 쓰러진 적: 4틱 하얀 번쩍임 → 20틱 동안 가라앉으며 옅어지고 조각이 흩어짐
      const T = 24, k = Math.max(0, (c.t - 4) / (T - 4)), im = c.f.img;
      g.save(); g.translate(Math.round(c.x), Math.round(c.y + (c.fly ? 0 : k * 6))); g.scale(c.face > 0 ? -1 : 1, 1 - (c.fly ? 0 : k * 0.15));
      g.globalAlpha = 1 - k; g.drawImage(c.t < 4 ? this.tinted('#ffffff', im) : im, -c.f.ax, -c.f.ay);
      if (c.t >= 4) { g.globalAlpha = (1 - k) * 0.6; g.drawImage(this.tinted('#1a1420', im), -c.f.ax, -c.f.ay); }   // 식어 가는 어두운 빛
      g.restore();
      if (c.t >= 4 && c.t % 2 === 0) for (let i = 0; i < 3; i++) this.parts.push({ x: c.x + (Math.random() - 0.5) * c.w, y: c.y - Math.random() * c.h * (1 - k), vx: (Math.random() - 0.5) * 0.8, vy: -0.3 - Math.random() * 0.6, life: 18, col: Math.random() < 0.6 ? '#2a2433' : '#8a8494', s: 2 });
    }
    g.globalAlpha = 1;
    for (const q of this.parts) { g.fillStyle = q.col; g.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s); }
    if (w.level) this.drawPickups(g, w);
    if (this.beamBack && this.beamBack.t > 0) {                            // 거울에서 거미로 되돌아가는 광선
      const B = this.beamBack, a = B.t / 14, x0 = Math.min(B.x0, B.x1), wd = Math.abs(B.x1 - B.x0); B.t--;
      g.fillStyle = `rgba(150,230,255,${0.7 * a})`; g.fillRect(x0, B.y - 9, wd, 18); g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(x0, B.y - 3, wd, 6);
    }
    if (w.water != null && w.water < 299) this.drawWater(g, w, camX, vw);   // 성녀 2막: 차오른 물 (픽셀 물)
    if (this.debug) {
      g.strokeStyle = '#0f0'; for (const h of w.hitboxes) g.strokeRect(h.x + 0.5, h.y + 0.5, h.w, h.h);
      const ab = attackBox(p); if (ab) { g.strokeStyle = '#ff0'; g.strokeRect(ab.x + 0.5, ab.y + 0.5, ab.w, ab.h); }
    }
    g.restore();

    this.fx.draw(g, camX, sx, sy); this.mfx.draw(g, camX, sx, sy);

    // 떠오르는 글자
    g.textAlign = 'center'; g.font = 'bold 12px Galmuri11, monospace';
    for (const t of this.texts) {
      if (!t.heal && !/^[+\-−]?\d/.test(t.s)) continue;                 // 글자('처형!' 같은)는 띄우지 않음 — 연출로만 알림. 숫자(회복 +1 등)만
      const L = t.life || 40, k = t.t / L, y = t.y + oy - (t.heal ? 22 : 14) * Math.min(1, t.t / 8) - k * (t.heal ? 14 : 6);
      g.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
      if (t.heal) g.font = 'bold 14px Galmuri11, monospace';
      g.fillStyle = t.heal ? '#0e2a14' : '#2a1204'; g.fillText(t.s, t.x + ox + 1, y + 1);
      g.fillStyle = t.heal ? '#8dffa0' : t.col || C.amberHi; g.fillText(t.s, t.x + ox, y);
      if (t.heal) g.font = 'bold 12px Galmuri11, monospace';
    }
    g.globalAlpha = 1; g.textAlign = 'left';
    g.restore();

    // 화면 번쩍: 완벽 패링은 흰색, 피격은 붉은색
    if (this.flash > 0.01) { g.fillStyle = `rgba(255,248,230,${this.flash * 0.22})`; g.fillRect(0, 0, vw, H); }   // 화면 섬광은 은은하게
    if (this.death) {                                                     // 사망: 가장자리부터 어두워지고, 마지막에 글자
      const d = this.death, k = Math.min(1, d / 160), vg = g.createRadialGradient(vw / 2, H * 0.62, H * (0.5 - 0.35 * k), vw / 2, H * 0.62, vw * 0.7);
      vg.addColorStop(0, 'rgba(4,2,8,0)'); vg.addColorStop(1, `rgba(4,2,8,${0.5 + 0.45 * k})`); g.fillStyle = vg; g.fillRect(0, 0, vw, H);
      if (d > 140) { const a = Math.min(1, (d - 140) / 40); g.globalAlpha = a; g.textAlign = 'center'; g.font = 'bold 22px Galmuri11, monospace'; g.fillStyle = '#000'; g.fillText('등불이 꺼졌다', vw / 2 + 1, H * 0.36 + 1); g.fillStyle = '#e8dcc0'; g.fillText('등불이 꺼졌다', vw / 2, H * 0.36); g.textAlign = 'left'; g.globalAlpha = 1; }
    }
    if (this.flash < -0.01) { g.fillStyle = `rgba(255,40,60,${-this.flash * 0.35})`; g.fillRect(0, 0, vw, H); }
    if (this.hud !== false && !this.death && !(this.cine && this.cine.t < CINE.out2)) this.drawHud(g, w);   // 등장 연출 중엔 HUD 숨김
    for (const [m, y] of [[this.banner, this.banner?.y ?? 96], [this.sayMsg, 44]]) {     // 스테이지 이름 배너 · 안내 한 줄 (안내는 화면 위쪽)
      if (!m || m.t <= 0) continue; m.t--;
      const a = Math.min(1, m.t / 30, (m.dur || 150) - m.t < 20 ? ((m.dur || 150) - m.t) / 20 : 1);
      g.save(); g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (m.sub) { g.font = '10px Galmuri9, monospace'; g.fillStyle = '#b89a6a'; g.fillText(m.sub, vw / 2, y - 24); }
      g.font = (m === this.banner ? '20px' : '11px') + ' Galmuri11, monospace'; g.fillStyle = '#ffe2a8'; g.shadowColor = 'rgba(255,170,70,.6)'; g.shadowBlur = 8;
      g.fillText(m.s, vw / 2, y); g.restore();
    }
    if (this.execK > 0.01) {                                              // 처형: 위아래 검은 띠, 가장자리 어둠
      const k = this.execK, bar = Math.round(30 * k);
      const v = g.createRadialGradient(vw / 2, H / 2, H * 0.3, vw / 2, H / 2, vw * 0.65); v.addColorStop(0, 'rgba(5,3,10,0)'); v.addColorStop(1, `rgba(5,3,10,${0.6 * k})`);
      g.fillStyle = v; g.fillRect(0, 0, vw, H);
      g.fillStyle = '#05030a'; g.fillRect(0, 0, vw, bar); g.fillRect(0, H - bar, vw, bar);
    }
    if (this.cine) this.drawCine(g, vw, H);
    this.trans.draw(g, vw, H);                                              // 장면 전환 · 임팩트 프레임 (맨 위)
  }

  // 리라 임시 실루엣 (진짜 그림은 Higgsfield 단계에서 교체)
  // 던진 등불: 손(낫 자루 끝)에서 풀려나간 사슬 + 등불 (날아가는 중·놓인 곳·되돌아오는 중)
  drawLampOut(g, w, p) {
    if (w.town && !p.lamp) return;
    const A = this.poleW || { x: p.x + p.w / 2 + p.face * 10, y: p.y + 34 };
    const C = this.chain = this.chain || new ChainSim();
    if (this.chainW !== w) { this.chainW = w; C.pts = null; this.chainT = w.t; }
    const steps = Math.max(0, Math.min(3, w.t - (this.chainT ?? w.t))); this.chainT = w.t;   // 세계 틱마다 물리 한 걸음 (화면 주사율과 무관)
    for (let i = 0; i < steps; i++) C.step(w, A, p.lamp, p.state === 'roll' || p.state === 'dead' ? null : p);
    if (!C.pts) C.step(w, A, p.lamp, p);
    const held = !p.lamp || p.lamp.st === 'held';
    C.draw(g, this.lampImg, w.t, held);
    const Lp = p.lamp;
    if (Lp && Lp.offT > 0 && (w.t >> 2) & 1) { const e = C.lanternPos(); if (e) { g.fillStyle = 'rgba(10,6,20,0.6)'; g.fillRect(Math.round(e.x) - 8, Math.round(e.y) - 14, 16, 18); } }   // 암살자에게 맞아 꺼짐
  }

  drawLira(g, w, p) {
    if (p.state !== 'ghost' && p.state !== 'dead' && p.iframes > 0 && (w.t >> 2) % 2 && p.state !== 'hurt') return;   // 죽는 중엔 깜빡이지 않음 (세계가 멈춰 깜빡임이 '안 보임'에 고정되던 버그)
    const f = p.face, cx = Math.round(p.x + p.w / 2), feet = Math.round(p.y + p.h);
    const fr = this.pickAnim(w, p);
    if (fr) { this.drawAnim(g, w, p, fr, cx, feet, f); return; }
    const poseImg = this.pickPose(w, p);
    if (poseImg) { this.drawPose(g, w, p, poseImg, cx, feet, f); return; }
    if (p.state === 'roll' || p.state === 'ghost') {     // 웅크린 구르기
      const r = 13, cy = feet - r, a = (p.stateT || 0) * 0.5 * f;
      g.fillStyle = C.cape; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = C.hair; g.fillRect(Math.round(cx + Math.cos(a) * 5) - 2, Math.round(cy + Math.sin(a) * 5) - 2, 5, 5);
      g.fillStyle = C.amberHi; g.fillRect(Math.round(cx - Math.cos(a) * 5) - 1, Math.round(cy - Math.sin(a) * 5) - 1, 3, 3);
      return;
    }
    const sq = this.squash, st = !p.onGround && p.vy < -1 ? 0.08 : 0;
    const sy = 1 - sq * 0.22 + st, sx = 1 + sq * 0.18 - st * 0.5;
    if (this.liraImg.complete && this.liraImg.naturalWidth) {
      // 상태별 기울기: 공격은 앞으로, 패링은 살짝 뒤로 버팀, 피격은 뒤로 젖힘
      const A = CFG.attack;
      let lean = 0;
      if (p.state === 'attack') { const s0 = p.startF ?? A.startupF; lean = p.stateT < s0 ? -0.06 : p.stateT < s0 + A.activeF ? 0.14 : 0.06; }
      else if (p.state === 'parry' && p.stateT < CFG.parry.normalF) lean = -0.08;
      else if (p.state === 'hurt') lean = -0.18;
      else if (p.state === 'run') lean = 0.06;
      const bob = p.state === 'run' ? Math.abs(Math.sin(w.t * 0.45)) * 2 : p.state === 'idle' ? Math.sin(w.t * 0.08) * 0.6 : 0;
      g.save(); g.translate(cx, feet - bob); g.rotate(lean * f); g.scale(sx * f, sy);
      const img = p.state === 'hurt' && (w.t >> 1) % 2 ? this.tinted('#ff3c50') : this.liraImg;
      g.drawImage(img, -47, -107);
      g.restore();
      this.drawParryArc(g, p, cx, feet, f);
      return;
    }
    g.save(); g.translate(cx, feet); g.scale(sx, sy); g.translate(-cx, -feet);
    const hurt = p.state === 'hurt';
    const run = p.state === 'run' ? Math.sin(w.t * 0.45) : 0;
    const crouch = p.state === 'attack' && p.stateT < (p.startF ?? CFG.attack.startupF) ? 2 : 0;
    const top = feet - 40 + crouch;
    // 포니테일
    if (this.tail) { g.fillStyle = C.hairD; for (const n of this.tail) g.fillRect(Math.round(n.x) - 1, Math.round(n.y) - 1, 3, 3); }
    // 망토 (뒤로 펄럭)
    const flow = Math.max(-6, Math.min(6, -p.vx * 2.4)) - f * 2 + Math.sin(w.t * 0.2) * 0.8;
    g.fillStyle = C.capeD;
    g.beginPath(); g.moveTo(cx - 4, top + 10); g.lineTo(cx + 4, top + 10); g.lineTo(cx + 4 + flow, feet - 9); g.lineTo(cx - 5 + flow * 1.3, feet - 7); g.closePath(); g.fill();
    // 다리
    g.fillStyle = C.boot;
    g.fillRect(cx - 4 + Math.round(run * 3), feet - 10, 3, 10);
    g.fillRect(cx + 1 - Math.round(run * 3), feet - 10, 3, 10);
    // 몸
    g.fillStyle = hurt ? C.red : C.cloth; g.fillRect(cx - 4, top + 11, 9, 14);
    g.fillStyle = C.clothD; g.fillRect(cx - 4, top + 22, 9, 3);              // 허리띠
    g.fillStyle = C.amber; g.fillRect(cx - f * 3, top + 22, 2, 3);            // 기름병
    // 짧은 망토 어깨
    g.fillStyle = C.cape; g.fillRect(cx - 5, top + 10, 11, 5);
    // 머리
    g.fillStyle = C.skin; g.fillRect(cx - 3, top + 2, 7, 8);
    g.fillStyle = C.hair; g.fillRect(cx - 4, top, 9, 4); g.fillRect(f > 0 ? cx - 4 : cx + 3, top, 2, 8);  // 앞머리·옆머리
    g.fillStyle = C.eye; g.fillRect(f > 0 ? cx + 2 : cx - 2, top + 5, 1, 2);
    // 랜턴 (사슬 + 등)
    const hand = { x: cx + f * 4, y: top + 17 };
    const la = this.lantern.a, lxp = hand.x + Math.sin(la) * 9 * (p.state === 'parry' ? 1.4 : 1), lyp = hand.y + Math.cos(la) * 9;
    g.strokeStyle = '#8a7a60'; g.beginPath(); g.moveTo(hand.x + 0.5, hand.y); g.lineTo(lxp + 0.5, lyp); g.stroke();
    g.fillStyle = '#5a4a32'; g.fillRect(Math.round(lxp) - 3, Math.round(lyp), 7, 8);
    g.fillStyle = p.state === 'parry' && p.stateT < CFG.parry.perfectF ? C.white : C.amberHi; g.fillRect(Math.round(lxp) - 2, Math.round(lyp) + 1, 5, 6);
    // 검
    this.drawSword(g, p, cx, top, f);
    g.restore();
    this.drawParryArc(g, p, cx, feet, f);
  }

  // 지역 1 '이끼 묘지' 배경: 먼 배경(0.2) · 중간 묘비(0.55) · 바닥/발판 타일. 좌우 반전으로 이어 붙여 이음새를 숨김
  drawBackdrop(g, w, camX, sx, sy) {
    const r = this.region ?? 1;   // 0 = 마을
    if (!this.bgs[r]) { this.bgs[r] = {}; for (const n of ['far', 'mid', 'ground']) { this.bgs[r][n] = loadImg(`assets/bg${r}-${n}.png` + VQ()); } }
    const B = this.bgs[r], ok = im => im.complete && im.naturalWidth;
    if (!ok(B.far) || !ok(B.mid) || !ok(B.ground)) return false;
    const H = CFG.VIEW_H, vw = this.vw;
    const tile = (im, k, y, dark) => {
      const iw = im.naturalWidth, off = (camX * k) % (iw * 2);
      for (let x = -off, i = 0; x < vw; x += iw, i++) {
        const flip = Math.floor((camX * k) / iw + i) & 1;
        g.save(); g.translate(Math.round(x) + sx + (flip ? iw : 0), y + sy); g.scale(flip ? -1 : 1, 1); g.drawImage(im, 0, 0); g.restore();
      }
      if (dark) { g.fillStyle = `rgba(8,6,14,${dark})`; g.fillRect(0, 0, vw, H); }
    };
    const cam0 = camX; camX += w.bgOff || 0;                       // 방마다 배경 시작 위치가 달라 풍경이 바뀐다
    tile(B.far, 0.2, 0, r === 0 ? 0.08 : 0.45);                        // 마을(0)은 밝게: 등대와 집 불빛이 보이게
    tile(B.mid, 0.55, 300 - B.mid.naturalHeight + 6, r === 0 ? 0.05 : 0.25);
    camX = cam0;
    // 땅과 발판
    const G = B.ground, gw = G.naturalWidth, top = 14;   // 그림 14행 = 걷는 면
    g.save(); g.translate(Math.round(-camX) + sx, sy);
    for (const s of w.solids) {
      if (s.oneWay) continue;                       // 발판은 drawPlatforms에서 어둠 위에
      else if (s.h >= 16 && s.w > 100) {                     // 낮은 언덕(높이 26·34)도 그림 — 안 그리면 '투명 발판'이 됨
        if (s.y < 300) {                             // 언덕: 타일을 언덕 폭으로 잘라 그리고 옆면에 그림자·윗면에 빛
          for (let x = s.x; x < s.x + s.w; x += gw) { const ww = Math.min(gw, s.x + s.w - x); g.drawImage(G, 0, 0, ww, G.naturalHeight, x, s.y - top, ww, G.naturalHeight); }
          const fg = g.createLinearGradient(0, s.y + 6, 0, 300);                 // 앞면: 아래로 갈수록 어둡게 (높이가 느껴지게)
          fg.addColorStop(0, 'rgba(8,6,14,0.15)'); fg.addColorStop(1, 'rgba(8,6,14,0.6)');
          g.fillStyle = fg; g.fillRect(s.x, s.y + 6, s.w, 300 - s.y - 6);
          g.fillStyle = 'rgba(8,6,14,0.7)'; g.fillRect(s.x, s.y + 2, 4, 300 - s.y); g.fillRect(s.x + s.w - 4, s.y + 2, 4, 300 - s.y);
          g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(s.x - 8, 296, 8, 4); g.fillRect(s.x + s.w, 296, 8, 4);
          g.fillStyle = '#e8dcc0'; g.globalAlpha = 0.6; g.fillRect(s.x + 1, s.y, s.w - 2, 1); g.globalAlpha = 1;   // 윗면 테두리 = 밟는 면
        } else for (let x = s.x - ((s.x % gw) + gw) % gw; x < s.x + s.w; x += gw) g.drawImage(G, x, s.y - top);
      }
    }
    this.drawPlatforms(g, w);                                            // 발판도 바닥과 같은 층 (같은 어둠·같은 선명도)
    g.restore();
    return true;
  }

  // 쉼터 오브젝트: 상인 그림 + 따뜻한 빛, 가까이 가면 '공격 버튼으로 ○○' 안내, 출구 안내
  drawProps(g, w) {
    if (!this.merchantImg) { this.merchantImg = new Image(); this.merchantImg.src = 'assets/merchant.png'; }
    const near = nearProp(w);
    for (const d of w.decor || []) { const im = this.img(d.img); if (im) g.drawImage(im, Math.round(d.x - im.naturalWidth / 2), 300 - im.naturalHeight + 1); }   // 마을 장식 (상호작용 없음, 소품 뒤)
    for (const o of w.props) {
      if (o.kind === 'lamp') {                                           // 등잔: 돌기둥 위 기름 그릇 (꺼지면 잿빛, 켜면 등잔 색 불꽃)
        const x = Math.round(o.x), P = EL_SLASH[o.lit ? (w.player.color || null) : null];
        g.fillStyle = '#1a1620'; g.fillRect(x - 6, 262, 12, 38); g.fillStyle = '#3a3442'; g.fillRect(x - 5, 263, 10, 36); g.fillStyle = '#54495e'; g.fillRect(x - 5, 263, 2, 36);
        g.fillStyle = '#1a1620'; g.fillRect(x - 11, 254, 22, 9); g.fillStyle = '#6e5a3e'; g.fillRect(x - 10, 255, 20, 6); g.fillStyle = '#9a8058'; g.fillRect(x - 10, 255, 20, 2);
        if (o.lit) {
          const fl = Math.sin(w.t * 0.3 + x) > 0 ? 1 : 0, gl = g.createRadialGradient(x, 246, 2, x, 246, 46);
          gl.addColorStop(0, `rgba(${EL_RGB[w.player.color || null]},0.4)`); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(x - 46, 200, 92, 92);
          g.fillStyle = P[3]; g.fillRect(x - 4, 244 - fl, 8, 10 + fl); g.fillStyle = P[5]; g.fillRect(x - 2, 247 - fl, 4, 7 + fl); g.fillStyle = P[6]; g.fillRect(x - 1, 250, 2, 3);
        } else { g.fillStyle = '#2a2430'; g.fillRect(x - 3, 251, 6, 3); }
        if (near === o && !o.lit) { const c = 10 + 5 * (w.player.shrinesLit || 0), ok = (w.player.shards || 0) >= c;
          g.font = '10px Galmuri9, monospace'; g.textAlign = 'center'; g.fillStyle = '#0d0a11'; g.fillText(`등잔 — 빛 조각 ${c} (공격)`, x + 1, 236); g.fillStyle = ok ? '#ffd27a' : '#9a8fa6'; g.fillText(`등잔 — 빛 조각 ${c} (공격)`, x, 235); }
        continue;
      }
      if (o.kind === 'merchant' && this.img('merchant')) {
        const im = this.img('merchant'), gl = g.createRadialGradient(o.x - 20, 250, 4, o.x - 20, 250, 70);
        gl.addColorStop(0, 'rgba(255,170,70,0.28)'); gl.addColorStop(1, 'rgba(255,170,70,0)');
        g.fillStyle = gl; g.fillRect(o.x - 100, 170, 200, 140);
        g.drawImage(im, Math.round(o.x - im.naturalWidth / 2), 300 - im.naturalHeight);
      }
      if (o.kind === 'exit' && o.locked) {                               // 봉인된 문: 어두운 돌 아치 + 붉은 봉인 (적을 다 잡으면 포탈로 바뀜)
        const x = Math.round(o.x), pulse = 0.4 + 0.25 * Math.sin(w.t * 0.08);
        g.fillStyle = '#1a1620'; g.fillRect(x - 22, 236, 44, 64); g.fillStyle = '#2e2838'; g.fillRect(x - 26, 232, 52, 6); g.fillRect(x - 26, 238, 6, 62); g.fillRect(x + 20, 238, 6, 62);
        g.fillStyle = `rgba(255,79,94,${pulse})`; g.fillRect(x - 1, 248, 2, 40); g.fillRect(x - 12, 266, 24, 2); g.fillRect(x - 8, 256, 16, 1); g.fillRect(x - 8, 278, 16, 1);
      }
      const label = o.label && !(o.kind === 'campfire' && o.used) ? o.label : o.kind === 'merchant' ? '상점 열기' : o.kind === 'campfire' ? (o.used ? '불씨가 잦아들었다' : '쉬기')
        : o.kind === 'rope' ? (bellOf(w).st !== 'up' ? '종이 떨어져 있다' : bellOf(w).cd > 0 ? `종 다시 거는 중 ${Math.ceil(bellOf(w).cd / 60)}초` : '공격: 고리를 베면 대종 낙하 (보스를 종 아래로!)')
        : o.kind === 'mirror' ? (o.cd > 0 ? `거울 다시 자라는 중 ${Math.ceil(o.cd / 60)}초` : '수정 거울 — 뒤에 숨으면 광선 반사')
        : o.kind === 'beacon' ? (o.litT > 0 ? `등대 ${Math.ceil(o.litT / 60)}초 — 빛 속의 그림자는 약하다` : '공격: 등대 켜기')
        : o.kind === 'bell' ? ''
        : o.locked ? '적을 모두 쓰러뜨리면 열린다' : '다음 길 →';
      const pcx = w.player.x + w.player.w / 2;
      const gim = o.kind === 'rope' || o.kind === 'mirror' || o.kind === 'beacon';
      this.drawGimmickProp(g, w, o);
      const show = o.kind === 'exit' ? pcx > o.x - 260 : gim ? Math.abs(o.x - pcx) < 90 : o.kind === 'bell' ? false : o === near;
      if (!show) continue;
      const y = o.kind === 'merchant' ? 188 : o.kind === 'campfire' ? 196 : o.kind === 'altar' ? 180 : o.kind === 'keeper' ? 192 : o.kind === 'board' ? 218 : o.kind === 'rack' ? 222 : 214, txt = o.kind === 'exit' || gim || o.used ? label : `공격 버튼  ${label}`;
      g.font = '10px Galmuri9, monospace'; g.textBaseline = 'middle'; g.textAlign = 'center';
      const tw = g.measureText(txt).width + 14, bob = Math.round(Math.sin(w.t * 0.1) * 2), lx = Math.max(tw / 2 + 4, Math.min(w.width - tw / 2 - 4, o.x));   // 벽 가까이선 화면 안으로
      g.fillStyle = '#0d0a11'; for (const [ddx, ddy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) g.fillText(txt, lx + ddx, y + bob + ddy);   // 네모 상자 없이 글자에 검은 테두리만
      g.fillStyle = '#ffe2a8'; g.fillText(txt, lx, y + bob);
      g.textAlign = 'left'; g.textBaseline = 'top';
    }
  }
  img(n) {
    this.imgs = this.imgs || {}; let im = this.imgs[n]; if (!im) { im = this.imgs[n] = loadImg(`assets/${n}.png` + VQ()); }
    if (!(im.complete && im.naturalWidth)) return null;
    return PROP_GRADE[n] ? this.graded(n, im) : im;
  }
  // 지역 배경의 색 계단 (어두움 → 밝음 5단): 배경 3층(먼·중간·바닥) 픽셀을 밝기순으로 줄 세워 구간 평균
  regionRamp(r) {
    this.ramps = this.ramps || {}; if (this.ramps[r]) return this.ramps[r];
    const B = this.bgs && this.bgs[r]; if (!B || !['far', 'mid', 'ground'].every(k => B[k] && B[k].complete && B[k].naturalWidth)) return null;
    const px = [];
    for (const k of ['far', 'mid', 'ground']) {
      const im = B[k], c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < d.length; i += 4 * 7) if (d[i + 3] > 200) px.push([d[i], d[i + 1], d[i + 2], 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]]);
    }
    px.sort((a, b) => a[3] - b[3]);
    const band = (lo, hi) => { const s = px.slice(Math.floor(px.length * lo), Math.max(Math.floor(px.length * lo) + 1, Math.floor(px.length * hi))), n = s.length; return [0, 1, 2].map(i => s.reduce((t, p) => t + p[i], 0) / n); };
    return (this.ramps[r] = [band(0, 0.08), band(0.2, 0.35), band(0.45, 0.6), band(0.75, 0.88), band(0.95, 1)]);
  }
  // 소품 그림을 지역 색감으로: 밝기는 그대로 두고 색을 배경 색 계단 쪽으로 k만큼 섞음 (그라데이션 맵). 지역마다 한 번 만들어 둠
  graded(n, im) {
    const r = this.region ?? 1, key = n + '@' + r; this.grades = this.grades || {};
    if (this.grades[key]) return this.grades[key];
    const ramp = this.regionRamp(r); if (!ramp) return im;
    const k = PROP_GRADE[n], c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0); const D = x.getImageData(0, 0, c.width, c.height), d = D.data;
    const lumR = ramp.map(q => 0.3 * q[0] + 0.59 * q[1] + 0.11 * q[2]), lo = lumR[0], hi = lumR[4];
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const L = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2], t = Math.max(0, Math.min(0.999, L / 255)) * 4, j = Math.floor(t), f = t - j;
      const a = ramp[j], b = ramp[Math.min(4, j + 1)], tone = [0, 1, 2].map(q => a[q] + (b[q] - a[q]) * f);
      const toneL = 0.3 * tone[0] + 0.59 * tone[1] + 0.11 * tone[2] || 1, keep = L / toneL;   // 밝기는 원래대로 (색만 배경 쪽으로)
      for (let q = 0; q < 3; q++) d[i + q] = Math.max(0, Math.min(255, d[i + q] * (1 - k) + tone[q] * Math.min(1.6, keep) * k)) * DIM;
    }
    x.putImageData(D, 0, 0); c.naturalWidth = c.width; c.naturalHeight = c.height; c.complete = true;
    return (this.grades[key] = c);
  }
  // 강적 수호 방패: 몸 앞쪽 빛의 육각 방패 (남은 횟수만큼 금이 덜 감)
  drawBarrier(g, w, e) {
    const f = e.face, x = Math.round(f > 0 ? e.x + e.w + 4 : e.x - 10), y = Math.round(e.y + 4), h = Math.max(30, e.h - 8), a = 0.35 + 0.25 * Math.sin(w.t * 0.12);
    g.fillStyle = `rgba(140,220,255,${a * 0.5})`; g.fillRect(x, y + 4, 6, h - 8);
    g.fillStyle = `rgba(200,245,255,${a + 0.2})`; g.fillRect(x + (f > 0 ? 4 : 0), y + 4, 2, h - 8); g.fillRect(x + 1, y + 2, 4, 2); g.fillRect(x + 1, y + h - 4, 4, 2);
    for (let k = e.barrier; k < (e.barrierMax || 3); k++) { g.fillStyle = 'rgba(20,40,60,0.9)'; g.fillRect(x + 1, y + 10 + k * (h / 4), 4, 1); g.fillRect(x + 3, y + 11 + k * (h / 4), 2, 2); }   // 금
  }
  // 픽셀 물: 2px 기둥마다 출렁이는 수면 → 반짝이는 수면선·거품 · 깊이별 3단 띠(그라데이션 없이) · 일렁이는 빛(커스틱) · 떠오르는 기포
  // 언덕(제단) 위처럼 바닥이 수면보다 높은 곳은 물이 없다
  drawWater(g, w, camX, vw) {
    const t = w.t, top = w.water, x0 = Math.max(0, Math.floor((camX - 8) / 2) * 2), x1 = Math.min(w.width, camX + vw + 8);
    const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const floorAt = x => { let y = 300; for (const s of w.solids) if (!s.oneWay && s.h > 8 && s.y >= 180 && x >= s.x && x < s.x + s.w) y = Math.min(y, s.y); return y; };
    const rise = Math.min(1, (300 - top) / 38);
    for (let x = x0; x < x1; x += 2) {
      const bottom = floorAt(x + 1);
      const wave = Math.sin(x * 0.045 + t * 0.055) * 1.6 + Math.sin(x * 0.13 - t * 0.09) * 0.8 + Math.sin(x * 0.021 + t * 0.03) * 1.2;
      const h = Math.round(top + wave * rise);
      if (bottom <= h + 1) continue;                                      // 마른 땅
      const depth = bottom - h;
      g.fillStyle = 'rgba(18,58,92,0.62)'; g.fillRect(x, h + 7, 2, Math.max(0, depth - 7));            // 깊은 물
      g.fillStyle = 'rgba(34,96,136,0.55)'; g.fillRect(x, h + 3, 2, Math.min(4, depth - 3));             // 중간
      g.fillStyle = 'rgba(70,150,190,0.6)'; g.fillRect(x, h + 1, 2, 2);                                  // 수면 바로 아래
      const slope = Math.cos(x * 0.045 + t * 0.055) * 0.07 + Math.cos(x * 0.13 - t * 0.09) * 0.1;
      g.fillStyle = slope > 0.08 ? '#e8fbff' : slope > -0.02 ? '#9ee2f5' : '#5fb4d6'; g.fillRect(x, h, 2, 1);   // 수면선: 마루는 하얀 거품
      if (slope > 0.11 && hash(x, (t >> 3)) < 0.5) { g.fillStyle = 'rgba(232,251,255,0.8)'; g.fillRect(x, h - 1, 2, 1); }
      // 커스틱: 바닥 쪽에 일렁이는 밝은 점 (8틱마다 바뀜)
      for (let k = 0; k < 2; k++) { const r = hash(x + k * 31, (t >> 3) + k * 7); if (r < 0.09 && depth > 10) { g.fillStyle = 'rgba(160,230,255,0.55)'; g.fillRect(x, Math.round(h + 6 + r * 11 * (depth - 8)), 2, 1); } }
    }
    // 기포: 바닥에서 올라와 수면에서 사라짐
    for (let i = 0; i < 18; i++) {
      const bx = Math.floor(camX / 40) * 40 + i * 47 + ((hash(i, 3) * 40) | 0), cyc = 160 + ((hash(i, 9) * 120) | 0), ph = (t + i * 37) % cyc, by = 300 - ph * 0.45;
      if (by < top + 2 || floorAt(bx) <= top + 2) continue;
      g.fillStyle = 'rgba(200,240,255,0.7)'; g.fillRect(Math.round(bx + Math.sin((t + i * 13) * 0.1) * 1.5), Math.round(by), 2, 2);
    }
  }
  // 레벨 오브젝트 (게임 그림과 같은 픽셀 소품)
  softGlow(g, x, y, r, rgb, a) {                                          // 둥근 은은한 빛 (네모 상자 대신)
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  drawLevel(g, w, again = false) {
    const L = w.level, t = w.t, I = n => this.img(n);
    for (const s of L.spikes) { const im = I('spikes'); if (im) for (let x = 0; x < s.w; x += im.naturalWidth) { const ww = Math.min(im.naturalWidth, s.w - x); g.drawImage(im, 0, 0, ww, im.naturalHeight, s.x + x, 300 - im.naturalHeight + 1, ww, im.naturalHeight); } }
    for (const v of L.vents) {
      const im = I('vent'), x = Math.round(v.x);
      if (im) g.drawImage(im, (im.naturalWidth - 40) >> 1, 0, 40, im.naturalHeight, x - 20, 300 - im.naturalHeight + 2, 40, im.naturalHeight);
      if (v.st === 'warn') {                                              // 예고: 틈새가 달아오르고 불씨·연기가 오름
        const k = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.25)), vg = g.createLinearGradient(0, 300, 0, 170); vg.addColorStop(0, `rgba(255,120,40,${0.4 * k})`); vg.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = vg; g.beginPath(); g.moveTo(x - 14, 300); g.lineTo(x - 5, 170); g.lineTo(x + 5, 170); g.lineTo(x + 14, 300); g.fill();   // 분출 예고: 아래에서 위로 옅어지는 불빛 (네모 상자 없이)
        g.fillStyle = `rgba(255,190,90,${k})`; g.fillRect(x - 16, 294, 32, 3);
        if (!again && t % 4 === 0) this.parts.push({ x: x - 10 + Math.random() * 20, y: 292, vx: (Math.random() - 0.5) * 0.4, vy: -1 - Math.random(), life: 30, col: Math.random() < 0.5 ? '#5a5060' : '#ffb347', s: 2 });
      }
    }
    for (const m of L.movers) { const im = I('mover'), s = m.solid; if (im) g.drawImage(im, Math.round(s.x + s.w / 2 - im.naturalWidth / 2), Math.round(s.y - 2)); }
    for (const u of L.urns) if (!u.broken) { const im = I('urn'); if (im) g.drawImage(im, Math.round(u.x + u.w / 2 - im.naturalWidth / 2), Math.round(u.y + u.h - im.naturalHeight + 1)); }
    for (const c of L.chests) { const im = I(c.open ? 'chest-open' : 'chest'); if (im) g.drawImage(im, Math.round(c.x - im.naturalWidth / 2), Math.round(c.y - im.naturalHeight + 1));
      if (!c.open) { const k = 0.5 + 0.5 * Math.sin(t * 0.1); this.softGlow(g, c.x, c.y - 12, 22, `255,200,90`, 0.22 * k); if (t % 40 === 0) this.parts.push({ x: c.x + (Math.random() - 0.5) * 20, y: c.y - 18, vx: 0, vy: -0.3, life: 30, col: '#ffe08a', s: 1 }); } }   // 안 연 상자: 둥근 빛 + 반짝 (네모 상자 없이)
    for (const gt of L.gates) { const im = I('gate'); if (!im || (gt.open && !gt.solid)) continue; g.drawImage(im, Math.round(gt.x - im.naturalWidth / 2), Math.round(300 - im.naturalHeight + 1 - (gt.lift || 0))); }   // 열리면 위로 올라가며 사라짐
    for (const v of L.levers) { const im = I('lever'); if (!im) continue; g.save(); g.translate(Math.round(v.x), Math.round(v.y - im.naturalHeight + 1)); if (v.on) { g.scale(-1, 1); g.filter = 'hue-rotate(110deg)'; } g.drawImage(im, -im.naturalWidth / 2, 0); g.restore();
      if (!v.on) { const k = 0.5 + 0.5 * Math.sin(t * 0.15); this.softGlow(g, v.x, v.y - 16, 18, `255,179,71`, 0.26 * k); } }   // 안 당긴 레버: 둥근 빛
  }
  drawPickups(g, w) {
    for (const q of w.level.pickups) {
      const x = Math.round(q.x + 4), y = Math.round(q.y + 4 + Math.sin((w.t + q.x) * 0.15) * (q.vy === 0 ? 1.5 : 0));
      const col = q.kind === 'heal' ? ['127,224,138', '#7fe08a', '#e6ffe8'] : q.kind === 'light' ? ['255,200,90', '#ffb347', '#fff2c8'] : ['255,150,60', '#ff9a3a', '#ffe2a8'];
      const r = q.kind === 'ember' ? 7 : 10, gl = g.createRadialGradient(x, y, 0, x, y, r);
      gl.addColorStop(0, `rgba(${col[0]},0.55)`); gl.addColorStop(1, `rgba(${col[0]},0)`); g.fillStyle = gl; g.fillRect(x - r, y - r, r * 2, r * 2);
      g.fillStyle = col[1]; if (q.kind === 'heal') { g.fillRect(x - 1, y - 3, 3, 7); g.fillRect(x - 3, y - 1, 7, 3); } else g.fillRect(x - 2, y - 2, q.kind === 'light' ? 5 : 4, q.kind === 'light' ? 5 : 4);
      g.fillStyle = col[2]; g.fillRect(x - 1, y - 1, 2, 2);
    }
  }
  // 보스 기믹 오브젝트 (보스 뒤): 쇠사슬 고리 · 수정 거울 · 빛의 등대
  drawGimmickProp(g, w, o) {
    const t = w.t;
    if (o.kind === 'rope') {                                              // 대종을 붙든 쇠사슬: 돌 말뚝(윈치)의 고리 → 종 옆구리. 종이 떨어지면 끊긴 사슬이 늘어짐
      const bell = bellOf(w), up = bell.st === 'up', post = this.img('post'), chain = this.img('chain'), left = o.x < bell.x;
      const rx = o.x, ry = 300 - 44 + 20;                                // 고리 위치 (말뚝 그림 기준)
      if (chain) {
        if (up || bell.st === 'rise') { const bx = bell.x + (left ? -40 : 40), by = (this.bellY ?? 8) + 60; this.drawChain(g, chain, rx, ry, bx, by); }
        else this.drawChain(g, chain, rx, ry, rx + (left ? 10 : -10), ry - 26);   // 끊어진 사슬 토막
      }
      if (post) { g.save(); g.translate(Math.round(rx), 300 + 1); if (!left) g.scale(-1, 1); g.drawImage(post, -30, -post.naturalHeight); g.restore(); }
      const ready = up && bell.cd <= 0;
      if (ready) { const k = 0.5 + 0.5 * Math.sin(w.t * 0.15), gl = g.createRadialGradient(rx, ry, 2, rx, ry, 22); gl.addColorStop(0, `rgba(255,179,71,${0.45 * k})`); gl.addColorStop(1, 'rgba(255,179,71,0)'); g.fillStyle = gl; g.fillRect(rx - 22, ry - 22, 44, 44); }   // 벨 수 있으면 고리가 빛남
    } else if (o.kind === 'mirror' && this.img('mirror')) {                // 수정 거울 (깨지면 바닥에서 다시 자람)
      const im = this.img('mirror'), x = Math.round(o.x - im.naturalWidth / 2), grow = o.cd > 0 ? 0.15 + 0.6 * (1 - o.cd / 900) : 1, h = Math.round(im.naturalHeight * grow);
      if (o.cd <= 0) { const gl = g.createRadialGradient(o.x, 260, 4, o.x, 260, 50); gl.addColorStop(0, 'rgba(120,220,255,0.22)'); gl.addColorStop(1, 'rgba(120,220,255,0)'); g.fillStyle = gl; g.fillRect(o.x - 50, 210, 100, 90); }
      g.globalAlpha = o.cd > 0 ? 0.55 : 1; g.drawImage(im, 0, im.naturalHeight - h, im.naturalWidth, h, x, 300 - h, im.naturalWidth, h); g.globalAlpha = 1;
    } else if ((o.kind === 'keeper' || o.kind === 'board' || o.kind === 'rack') && this.img(o.kind)) {   // 마을: 등대지기 · 게시판
      const im = this.img(o.kind); g.drawImage(im, Math.round(o.x - im.naturalWidth / 2), 300 - im.naturalHeight + 1);
    } else if (o.kind === 'altar' && this.img('shrine')) {                 // 마을 순례 제단: 등대 모양 돌 제단 (꼭대기 그릇에 늘 불)
      const im = this.img('shrine'); g.drawImage(im, Math.round(o.x - im.naturalWidth / 2), 300 - im.naturalHeight + 1);
      const gl = g.createRadialGradient(o.x, 214, 4, o.x, 214, 90); gl.addColorStop(0, 'rgba(255,170,70,0.3)'); gl.addColorStop(1, 'rgba(255,170,70,0)'); g.fillStyle = gl; g.fillRect(o.x - 80, 160, 160, 140);
    } else if (o.kind === 'valve' && this.img('valve')) {                 // 증기 밸브: 쓸 수 있으면 바퀴가 빛남, 쓰면 다시 찰 때까지 어둡게
      const im = this.img('valve'), x = Math.round(o.x - im.naturalWidth / 2);
      if (o.cd <= 0) { const k = 0.5 + 0.5 * Math.sin(t * 0.14), gl = g.createRadialGradient(o.x, 262, 3, o.x, 262, 34); gl.addColorStop(0, `rgba(255,190,110,${0.35 * k})`); gl.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gl; g.fillRect(o.x - 34, 228, 68, 68); }
      g.globalAlpha = o.cd > 0 ? 0.6 : 1; g.drawImage(im, x, 300 - im.naturalHeight + 1); g.globalAlpha = 1;
    } else if (o.kind === 'anchor' && this.img('anchor')) {               // 사슬 닻: 서 있으면 왕에게 사슬이 이어짐 · 맞을수록 금 · 부서지면 밑동만
      const im = this.img('anchor'), x = Math.round(o.x - im.naturalWidth / 2), b = w.enemies.find(e => e.kind === 'king' && !e.dead), chain = this.img('chain');
      if (o.hp > 0) {
        if (b && chain && !(b.stunT > 0)) this.drawChain(g, chain, o.x + 6, 300 - im.naturalHeight + 10, b.x + b.w / 2, b.y + b.h * 0.45);
        g.drawImage(im, x, 300 - im.naturalHeight + 1);
        const dmg = 1 - o.hp / 4; if (dmg > 0) { g.fillStyle = `rgba(10,8,16,${0.35 * dmg})`; g.fillRect(x, 300 - im.naturalHeight + 1, im.naturalWidth, im.naturalHeight); }
        const k = 0.5 + 0.5 * Math.sin(t * 0.1), gl = g.createRadialGradient(o.x, 262, 2, o.x, 262, 26); gl.addColorStop(0, `rgba(90,230,220,${0.3 * k * (o.hp / 4)})`); gl.addColorStop(1, 'rgba(90,230,220,0)'); g.fillStyle = gl; g.fillRect(o.x - 26, 236, 52, 52);
      } else { const hh = Math.round(im.naturalHeight * 0.3); g.globalAlpha = 0.7; g.drawImage(im, 0, im.naturalHeight - hh, im.naturalWidth, hh, x, 300 - hh + 1, im.naturalWidth, hh); g.globalAlpha = 1; }
    } else if (o.kind === 'beacon' && this.img('beacon')) {               // 빛의 등대: 돌 받침 + 쇠 그릇 (켜지면 불꽃은 fxmap)
      const im = this.img('beacon'), x = Math.round(o.x - im.naturalWidth / 2);
      g.drawImage(im, x, 300 - im.naturalHeight);
      if (o.litT <= 0) { const pulse = 0.5 + 0.5 * Math.sin(w.t * 0.12); g.fillStyle = `rgba(255,179,71,${0.25 + 0.4 * pulse})`; g.fillRect(Math.round(o.x) - 2, 253, 4, 3); }
    }
  }
  // 사슬 그림을 (x0,y0)→(x1,y1) 방향으로 이어 붙임
  drawChain(g, im, x0, y0, x1, y1) {
    const L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2, th = im.naturalHeight;
    g.save(); g.translate(Math.round(x0), Math.round(y0)); g.rotate(a);
    for (let d = 0; d < L; d += th) { const h = Math.min(th, L - d); g.drawImage(im, 0, 0, im.naturalWidth, h, -im.naturalWidth / 2, d, im.naturalWidth, h); }
    g.restore();
  }
  // 대종 (보스 위에 그림): 천장에 매달림 → 떨어짐(바닥에 붉은 그림자 예고) → 가둠 → 다시 올라감
  drawGimmickFront(g, w) {
    const bell = w.props.find(o => o.kind === 'bell'); if (!bell) return;
    const im = this.img('bell'); if (!im) return;
    const G = { dropF: 40, riseF: 50 }, top = 8, ground = 300 - im.naturalHeight + 4;
    let y = top;
    if (bell.st === 'drop') { const k = bell.t / G.dropF; y = top + (ground - top) * Math.max(0, (k - 0.55) / 0.45) ** 2;
      const a = 0.25 + 0.5 * k; g.fillStyle = `rgba(255,79,94,${a * 0.35})`; g.fillRect(bell.x - 66, 296, 132, 4); g.strokeStyle = `rgba(255,79,94,${a})`; g.strokeRect(bell.x - 66 + 0.5, 294.5, 132, 6); }   // 떨어질 자리
    else if (bell.st === 'down') y = ground;
    else if (bell.st === 'rise') y = ground + (top - ground) * Math.min(1, bell.t / G.riseF);
    const yy = Math.round(y + (bell.st === 'up' ? Math.sin(w.t * 0.03) * 2 : 0));
    const rattle = bell.st === 'down' && bell.trapped ? Math.round(Math.sin(w.t * 0.9) * (bell.t % 50 < 14 ? 2 : 0.6)) : 0;   // 안에서 보스가 몸부림 → 종이 덜컹
    if ((bell.st === 'up' || bell.st === 'rise') && this.img('chain')) this.drawChain(g, this.img('chain'), bell.x, yy + 6, bell.x, -20);   // 천장 사슬
    g.drawImage(im, Math.round(bell.x - im.naturalWidth / 2) + rattle, yy);
    this.bellY = yy;
  }
  say(s, t = 150) { this.sayMsg = { s, t }; }
  reactHint(w, ev) {                                                      // 처음 만나는 적: 빛·어둠 반응을 한 줄로 알려 줌 (판마다 한 번)
    const R = DARK_REACT[ev.kind]; this.seenKind = this.seenKind || {};
    if (!R || w.town || this.seenKind[ev.kind]) return; this.seenKind[ev.kind] = 1;
    this.say(`${nameOf(ev.kind)} · ${R.name} — ${R.desc}`, 220);
  }
  // 회복 연출: 큰 초록 '+N', 화면 가장자리 초록빛, 체력 바의 새로 찬 칸이 반짝임 (몸을 타고 오르는 빛은 fxmap의 holy/heal)
  healFx(p, amount, from = p.hp - amount) {
    this.texts.push({ x: p.x + p.w / 2, y: p.y - 18, t: 0, s: amount > 0 ? `+${amount}` : '체력 가득', heal: true, life: 50 });
    this.hpGain = { from: Math.max(0, from), to: p.hp, t: 40 };          // 연출은 몸의 회복 빛(pixelfx) + 작은 숫자 + 체력 바 새 칸만
  }
  // 보스 등장 연출: 보스를 비추며 페이드인 → 이름 → 페이드아웃 → 넓은 방 전체로 페이드인
  startCine(name, sub) { this.cine = { t: 0, name, sub, focusBoss: true, hideLira: true }; }
  stepCine() {
    const c = this.cine; if (!c) return false;
    c.t++; c.focusBoss = c.hideLira = c.t < CINE.out2;
    if (c.t >= CINE.end) { this.cine = null; return false; }
    return true;
  }
  drawCine(g, vw, H) {
    const c = this.cine, t = c.t, C2 = CINE;
    let black = t < C2.in ? 1 - t / C2.in : t < C2.out ? 0 : t < C2.out2 ? (t - C2.out) / (C2.out2 - C2.out) : 1 - (t - C2.out2) / (C2.end - C2.out2);
    if (t < C2.out2) {                                                   // 시네마 띠 + 이름
      const bar = Math.round(34 * Math.min(1, t / 20));
      g.fillStyle = '#05030a'; g.fillRect(0, 0, vw, bar); g.fillRect(0, H - bar, vw, bar);
      const a = Math.max(0, Math.min(1, (t - C2.in * 0.6) / 25)) * (t > C2.out ? 1 - (t - C2.out) / (C2.out2 - C2.out) : 1);
      if (a > 0) {
        g.save(); g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = '10px Galmuri9, monospace'; g.fillStyle = '#b89a6a'; g.fillText(c.sub, vw / 2, H - 92);
        g.font = 'bold 28px Galmuri11, monospace'; g.fillStyle = '#ffe2a8'; g.shadowColor = 'rgba(255,120,60,.7)'; g.shadowBlur = 12; g.fillText(c.name, vw / 2, H - 68);
        g.shadowBlur = 0; g.fillStyle = '#ff6a3d'; g.fillRect(vw / 2 - 70, H - 50, 140, 1); g.restore();
      }
    }
    if (black > 0) { g.fillStyle = `rgba(5,3,10,${Math.min(1, black)})`; g.fillRect(0, 0, vw, H); }
  }
  // 스테이지 전환 아이리스 (pixelfx transitions/iris, 320x180 화면 좌표). 중심 = 리라
  // 'open': 닫힌 상태(0.45)에서 시작해 열림 / 'close': 처음부터 → 약 1초에 완전히 닫힘
  iris(w, mode) {
    const p = w.player, vw = this.vw || CFG.VIEW_W, camX = Math.max(0, Math.min(w.width - vw, p.x + p.w / 2 - vw * 0.4));
    const focus = [Math.round((p.x + p.w / 2 - camX) / vw * 320), Math.round((p.y + 30) / CFG.VIEW_H * 180)];
    this.trans.clear();
    this.trans.spawn('transitions/iris', 0, 0, { focus, color: '#05030a', speed: IRIS_SPEED, ...(mode === 'open' ? { skip: 0.45 } : {}) });
    this.irisMode = mode; this.irisClock = mode === 'open' ? 0.45 * 2.2 : 0;    // 이펙트 시간(초): 1.0 = 완전히 닫힘, 1.6 = 거의 다 열림
  }
  // 아이리스가 진행 중이면 캐릭터를 숨기고 세계를 멈춘다
  irisBusy() { return this.irisMode === 'close' || (this.irisMode === 'open' && this.irisClock < 1.6); }

  // 발판: 바닥 타일 윗부분을 잘라 쓰되, 아래 그림자 + 윗면 밝은 테두리 + 양 끝 받침으로 '밟을 수 있는 것'임을 보여 줌
  drawPlatforms(g, w) {
    const G = this.bgs[this.region ?? 1]?.ground; if (!G || !G.naturalWidth) return;
    const gw = G.naturalWidth, top = 14, th = 22;
    for (const s of w.solids) {
      if (!s.oneWay) continue;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(s.x + 3, s.y + th - top + 1, s.w - 6, 4);           // 그림자
      for (let x = s.x; x < s.x + s.w; x += gw) { const ww = Math.min(gw, s.x + s.w - x); g.drawImage(G, 0, 0, ww, th, x, s.y - top, ww, th); }
      g.fillStyle = 'rgba(8,6,14,0.32)'; g.fillRect(s.x, s.y - top, s.w, th);                       // 발판 전체를 바닥 톤으로 한 단계 어둡게 (공중이라 빛을 덜 받음)
      g.fillStyle = 'rgba(8,6,14,0.25)'; g.fillRect(s.x, s.y + 3, s.w, th - top - 3);               // 옆면은 살짝 더 어둡게
      g.fillStyle = '#e8dcc0'; g.globalAlpha = 0.3; g.fillRect(s.x + 1, s.y, s.w - 2, 1); g.globalAlpha = 1;   // 윗면 테두리: 은은하게
      g.fillStyle = '#120e16'; g.fillRect(s.x, s.y - 1, 1, th - top + 2); g.fillRect(s.x + s.w - 1, s.y - 1, 1, th - top + 2);   // 양 끝 윤곽
    }
  }

  // 보스 사망: 흔들리며 하얗게 번쩍 → 몸 곳곳이 터짐 → 큰 폭발(BOSS_FALL_F)과 함께 아래부터 빛이 되어 흩어짐
  drawBossDeath(g, w) {
    const D = w.bossDeath, e = D.e, t = D.t, d = ENEMY_DEFS[e.kind];
    const f = this.enemyFrame(w, { ...e, st: 'idle', vx: 0, atk: null }, d); if (!f) return;
    const fall = BOSS_FALL_F, k = t < fall ? 0 : (t - fall) / (BOSS_DEATH_F - fall);   // 0 → 1: 사라짐
    const sh = t < fall ? Math.round(Math.sin(t * 1.7) * (1 + t / fall * 3)) : 0;
    g.save(); g.translate(Math.round(e.x + e.w / 2) + sh, Math.round(e.y + e.h)); g.scale(e.face > 0 ? -1 : 1, 1);
    const H = f.img.naturalHeight, keep = Math.round(H * (1 - k));                        // 위에서부터 남은 높이 (아래부터 흩어짐)
    g.globalAlpha = 1 - k * 0.4;
    if (keep > 0) g.drawImage(f.img, 0, 0, f.img.naturalWidth, keep, -f.ax, -f.ay, f.img.naturalWidth, keep);
    const flick = t < fall ? (t % 10 < 4 ? 0.65 : 0.15) + t / fall * 0.3 : 0.9;           // 하얀 번쩍임 (갈수록 강하게)
    g.globalAlpha = Math.min(1, flick) * (1 - k * 0.5);
    if (keep > 0) g.drawImage(this.tinted('#fff2d8', f.img), 0, 0, f.img.naturalWidth, keep, -f.ax, -f.ay, f.img.naturalWidth, keep);
    g.restore(); g.globalAlpha = 1;
    if (k > 0 && t % 2 === 0) for (let i = 0; i < 4; i++) this.parts.push({ x: e.x + Math.random() * e.w, y: e.y + e.h * (1 - k) + Math.random() * 10, vx: (Math.random() - 0.5) * 0.6, vy: -0.8 - Math.random() * 1.2, life: 30, col: Math.random() < 0.5 ? '#fff2d8' : '#ffb347', s: 2 });
  }
  // 속성 색으로 다시 칠한 프레임: 등불·칼에 붙은 불(o)은 늘, 칼날(m)은 점화한 동안만. 밝기를 속성 팔레트 단계로 옮김 (프레임·속성·모드마다 한 번)
  elFrame(fr, el, lit, off = false) {
    const B = this.blade && this.blade[fr.src]; if (!B || !fr.img.naturalWidth || (!el && !lit && !off)) return fr.img;
    this.elCache = this.elCache || new Map(); const key = fr.src + '|' + el + '|' + (lit ? 1 : 0) + (off ? 'x' : '');
    let c = this.elCache.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = fr.img.naturalWidth; c.height = fr.img.naturalHeight; const x = c.getContext('2d'); x.drawImage(fr.img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), P = EL_SLASH[el].map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    const paint = (rows, lo) => { for (const [y, xs] of rows) for (const px of xs) { const i = (y * c.width + px) * 4, L = (d.data[i] * 0.3 + d.data[i + 1] * 0.55 + d.data[i + 2] * 0.15) / 255, k = Math.min(P.length - 1, lo + Math.floor(L * (P.length - lo))); d.data[i] = P[k][0]; d.data[i + 1] = P[k][1]; d.data[i + 2] = P[k][2]; } };
    if (off) { for (const [y, xs] of B.o || []) for (const px of xs) { const i = (y * c.width + px) * 4; d.data[i] = 34; d.data[i + 1] = 30; d.data[i + 2] = 42; } }   // 꺼진 등불: 불꽃 자리가 검게
    else if (el) paint(B.o || [], 2);                                       // 불꽃: 어두운 끝은 2단계부터 (너무 검지 않게)
    if (lit && !fr.src.includes('enchant')) paint(B.m || [], el === 'lmp' ? 3 : 2);   // 칼날: 속성 이펙트와 같은 색으로 빛남 (귀화는 어두운 보라라 한 단계 밝게)
    x.putImageData(d, 0, 0); this.elCache.set(key, c); return c;
  }
  // 소등 화면: 거의 완전한 어둠. 적은 눈빛(못 봄 = 흐린 금빛, 봄 = 붉음, 공격 중 = 크게 깜빡)만, 리라는 희미한 실루엣, 소리는 파문으로
  // 땅 띠: 걷는 면 바로 아래 몇 줄을 어둠에서 덜어 냄 (어디가 땅·발판인지 항상 보이게)
  groundBand(c, w, ox, oy, a) {
    c.save(); c.globalCompositeOperation = 'destination-out';
    for (const s of w.solids) { if (s.h < 6 && !s.oneWay) continue; const gr = c.createLinearGradient(0, s.y - 2 + oy, 0, s.y + 12 + oy); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(s.x + ox, s.y - 2 + oy, s.w, 14); }
    c.restore();
  }
  // 등불에서 먼 적: 0 = 다 보임, 1 = 어둠에 묻힘 (눈빛만). 보스·마을·공격 중인 적은 늘 보임
  farK(w, e) {
    if (e.boss || w.town || e.dummy || w.player.dark || (w.props || []).some(o => o.kind === 'beacon')) return 0;
    if (e.st === 'telegraph' || e.st === 'active') return 0;
    const d = Math.hypot(e.x + e.w / 2 - this.lampX, e.y + e.h / 2 - this.lampY), r = this.lampR;
    return Math.max(0, Math.min(1, (d - r * 0.8) / (r * 0.45)));
  }
  eyePos(w, e) {                                                          // 실제 눈 위치 (이번 프레임에 그린 그림 기준), 없으면 머리쯤
    if (e._eye && w.t - e._eye[2] <= 1) return [Math.round(e._eye[0]), Math.round(e._eye[1])];
    return [Math.round(e.x + e.w / 2 + e.face * e.w * 0.22), Math.round(e.y + Math.min(e.h * 0.2, 22))];
  }
  // 어둠 속 눈빛: 스프라이트에 그려진 원래 눈 픽셀을 그대로 (눈 색이 따로 없는 해골·투구류는 몸 색에 맞춘 희미한 빛 두 점)
  //   못 봄 = 흐리게, 봄 = 또렷 + 은은한 빛, 공격 중 = 깜빡이며 붉은 빛 (피할 신호)
  drawEyes(g, w, e, a) {
    if (e.dead || e.spawnT > 0) return;
    const [x, y] = this.eyePos(w, e), atk = e.st === 'telegraph' || e.st === 'active', E = e._eye && w.t - e._eye[2] <= 1 ? e._eye : null;
    const px = E && E[5][2], col = px ? '#' + px[(px.length / 2) | 0][2] : (EYE_COL[baseOf(e.kind)] || '#d8c8a8');
    const rgb = [1, 3, 5].map(i => parseInt(col.slice(i, i + 2), 16)).join(','), r = e.boss ? 12 : 8;
    if (!e.unaware || atk) { const gl = g.createRadialGradient(x, y, 0, x, y, r); gl.addColorStop(0, atk ? `rgba(255,79,94,${0.5 * a})` : `rgba(${rgb},${0.35 * a})`); gl.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gl; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.globalAlpha = a * (atk ? ((w.t >> 2) & 1 ? 1 : 0.55) : e.unaware ? 0.6 : 1);
    if (E) {
      const [, , , M, f, EY] = E; g.save(); g.transform(M.a, M.b, M.c, M.d, M.e, M.f);
      if (px) for (const [dx, dy, c] of px) { g.fillStyle = '#' + c; g.fillRect(EY[0] + dx - f.ax, EY[1] + dy - f.ay, 1, 1); }
      else { g.fillStyle = col; g.fillRect(EY[0] - f.ax - 1, EY[1] - f.ay - 1, 2, 2); g.fillRect(EY[0] - f.ax - 5, EY[1] - f.ay - 1, 2, 2); }   // 그림은 왼쪽을 봄: 먼 눈은 앞(왼)쪽
      g.restore();
    } else { g.fillStyle = col; g.fillRect(x - 1, y - 1, 2, 2); g.fillRect(x - 1 + e.face * 4, y - 1, 2, 2); }
    g.globalAlpha = 1;
  }
  drawGroundEdge(g, w, a) {                                               // 걷는 면 테두리 (은은한 달빛 선)
    g.fillStyle = `rgba(200,206,232,${a})`;
    for (const s of w.solids) { if (s.h < 6 && !s.oneWay) continue; g.fillRect(s.x, s.y, s.w, 1); }
  }
  drawDarkness(g, w) {
    const p = w.player, k = p.dark ? 1 : Math.max(0, 1 - p.stateT / CFG.snuff.relightF);
    const band = w.solids.filter(s => s.h >= 6 || s.oneWay);             // 걷는 면 아래 띠는 덜 어둡게 → 땅이 보임
    g.fillStyle = `rgba(4,3,10,${0.86 * k})`; g.beginPath(); g.rect(-100, -300, w.width + 200, 900);
    for (const s of band) g.rect(s.x, s.y - 2, s.w, 16);
    g.fill('evenodd');
    for (const s of band) { const gr = g.createLinearGradient(0, s.y - 2, 0, s.y + 14); gr.addColorStop(0, `rgba(4,3,10,${0.15 * k})`); gr.addColorStop(1, `rgba(4,3,10,${0.86 * k})`); g.fillStyle = gr; g.fillRect(s.x, s.y - 2, s.w, 16); }
    this.drawGroundEdge(g, w, 0.6 * k);
    if (w.level) { g.globalAlpha = 0.55 * k; this.drawLevel(g, w, true); g.globalAlpha = 1; }   // 장애물(가시·분출구·항아리·문)은 어둠 속에서도 윤곽이 보이게
    for (const e of w.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      this.drawEyes(g, w, e, k);                                          // 원래 눈빛 그대로
      if (Math.abs(e.vx) > 0.3 && (w.t + (e.x | 0)) % 26 === 0) (this.ripples = this.ripples || []).push({ x: e.x + e.w / 2, y: e.y + e.h, r: 4, t: 0, c: '184,144,58' });   // 발소리
    }
    for (const b of w.projectiles) if (b.owner === 'enemy') { g.fillStyle = '#ff4f5e'; g.fillRect(Math.round(b.x + b.w / 2) - 1, Math.round(b.y + b.h / 2) - 1, 3, 3); }   // 날아오는 탄은 보이게
    if (p.noiseT > 0 && (w.t % 8 === 0)) (this.ripples = this.ripples || []).push({ x: p.x + p.w / 2, y: p.y + p.h, r: 6, t: 0, c: '255,226,168', max: p.noiseR || 120 });   // 내 소리 (들키는 범위)
    this.ripples = (this.ripples || []).filter(r => r.t < 30);
    for (const r of this.ripples) { r.t++; const rr = r.r + (r.max ? r.max / 30 : 1.4) * r.t; g.strokeStyle = `rgba(${r.c},${0.5 * (1 - r.t / 30)})`; g.lineWidth = 1; g.beginPath(); g.ellipse(r.x, r.y, rr, rr * 0.3, 0, 0, Math.PI * 2); g.stroke(); }
  }
  // 칼날만 (소등 중 어둠 속에 칼 불꽃만 보이게): 속성 색으로 칠한 그림에서 칼날·불꽃 픽셀만 오려 냄
  bladeOnly(fr, base) {
    const B = this.blade && this.blade[fr.src]; if (!B || !base || !fr.img.naturalWidth) return null;
    this.boCache = this.boCache || new WeakMap(); let c = this.boCache.get(base); if (c) return c;
    c = document.createElement('canvas'); c.width = fr.img.naturalWidth; c.height = fr.img.naturalHeight; const x = c.getContext('2d');
    x.beginPath(); for (const [y, xs] of [...(B.m || []), ...(fr.src.includes('enchant') ? B.o || [] : [])]) for (const px of xs) x.rect(px, y, 1, 1); x.clip(); x.drawImage(base, 0, 0);
    this.boCache.set(base, c); return c;
  }
  // 휘두르기 잔상: 베는 동안 매 프레임 칼날 픽셀(세계 좌표)을 기억했다가, 이전 몇 프레임의 칼날과 칼끝 사이를 옅은 호로 이어 그림
  captureSmear(w, p, fr, cx, feet, f, sx, sy) {
    if (this.anims && this.anims.follow) { this.smear = []; return; }   // 새 리라: 큰 호 잔상이 그림에 들어 있음
    const swing = p.state === 'attack' || p.state === 'flurry' || (p.state === 'execute' && p.stateT < 26);
    this.smear = (this.smear || []).filter(s => w.t - s.t < 5);
    if (!swing) return;
    const B = this.blade && this.blade[fr.src]; if (!B || !B.m || !B.m.length) return;
    if (this.smear.length && this.smear[this.smear.length - 1].src === fr.src && this.smear[this.smear.length - 1].x === cx) return;   // 같은 그림이면 한 번만
    const pts = []; for (const [y, xs] of B.m) for (let i = 0; i < xs.length; i += 2) pts.push([cx + f * sx * (xs[i] - fr.ax), feet + sy * (y - fr.ay)]);
    if (pts.length < 4) return;
    const hx = cx + f * 6, hy = feet - 42; let tip = pts[0], base = pts[0], dmax = -1, dmin = 1e9;   // 손잡이 쪽(몸 가까이)과 칼끝(가장 먼 곳)
    for (const q of pts) { const d = Math.hypot(q[0] - hx, q[1] - hy); if (d > dmax) { dmax = d; tip = q; } if (d < dmin) { dmin = d; base = q; } }
    this.smear.push({ t: w.t, src: fr.src, x: cx, pts, tip, base, el: p.enchantT > 0 ? (p.element || null) : undefined });
  }
  drawSmear(g, w) {
    const S = (this.smear || []).filter(s => w.t - s.t < 5); if (S.length < 2) return;
    for (let i = 1; i < S.length; i++) {
      const a = S[i - 1], b = S[i], age = w.t - a.t, k = 1 - age / 5, P = a.el !== undefined ? EL_SLASH[a.el] : null;
      g.fillStyle = P ? P[4] : '#fff3d6'; g.globalAlpha = 0.28 * k;
      g.beginPath(); g.moveTo(a.base[0], a.base[1]); g.lineTo(a.tip[0], a.tip[1]); g.lineTo(b.tip[0], b.tip[1]); g.lineTo(b.base[0], b.base[1]); g.closePath(); g.fill();   // 칼이 지나간 면
      g.strokeStyle = P ? P[6] : '#ffffff'; g.globalAlpha = 0.75 * k; g.lineWidth = 2; g.beginPath(); g.moveTo(a.tip[0], a.tip[1]); g.lineTo(b.tip[0], b.tip[1]); g.stroke();   // 칼끝 궤적
      g.fillStyle = P ? P[5] : '#ffe9b8'; g.globalAlpha = 0.35 * k; for (const q of a.pts) g.fillRect(Math.round(q[0]), Math.round(q[1]), 1, 1);   // 칼 잔상
    }
    g.globalAlpha = 1; g.lineWidth = 1;
  }
  // 칼날 테두리 그림 (프레임·속성마다 한 번 만들어 재사용): 안쪽 1px = 밝은 속성 색, 바깥 1px = 반투명
  bladeOutline(fr, el) {
    const B = this.blade && this.blade[fr.src]; if (!B || !fr.img.naturalWidth) return null;
    this.bladeCache = this.bladeCache || new Map(); const key = fr.src + '|' + el;
    let c = this.bladeCache.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = fr.img.naturalWidth; c.height = fr.img.naturalHeight; const x = c.getContext('2d'), P = EL_SLASH[el];
    x.fillStyle = '#140804'; x.globalAlpha = 1; for (const [y, xs] of B.r1) for (const px of xs) x.fillRect(px, y, 1, 1);   // 칼 둘레 1px 어두운 테두리 → 불길 속에서도 칼 모양이 또렷
    this.bladeCache.set(key, c); return c;
  }
  // 떨어지는 잔해: 무덤종 = 돌덩이(굴러 떨어지는 바위 조각), 용광로 = 쇳물 방울, 왕 = 죽은 별, 성녀 = 물방울 (수정은 fx)
  drawDebris(g, w) {
    for (const b of w.projectiles) {
      if (!b.shard || b.debris === 'crystal') continue;
      const x = b.x + b.w / 2, y = b.y + b.h / 2, t = w.t;
      g.save(); g.translate(Math.round(x), Math.round(y));
      if (b.debris === 'rock') {
        g.rotate((b.spin || 0) + t * 0.12); g.scale(1.4, 1.4);
        g.fillStyle = '#1c1820'; g.beginPath(); for (const [px, py] of [[-9, -5], [-3, -10], [6, -8], [10, -1], [6, 8], [-4, 9], [-10, 3]]) g.lineTo(px, py); g.closePath(); g.fill();   // 외곽
        g.fillStyle = '#5e5866'; g.beginPath(); for (const [px, py] of [[-7, -4], [-2, -8], [5, -6], [8, -1], [5, 6], [-3, 7], [-8, 2]]) g.lineTo(px, py); g.closePath(); g.fill();      // 돌
        g.fillStyle = '#8a8494'; g.fillRect(-5, -6, 6, 3); g.fillRect(-6, -3, 3, 3);                                                                      // 윗면 빛
        g.fillStyle = '#3a3640'; g.fillRect(1, 2, 5, 3); g.fillRect(-2, 4, 3, 2);                                                                         // 갈라진 금
        if (t % 3 === 0) this.parts.push({ x: x + (Math.random() - 0.5) * 10, y: y - 10, vx: (Math.random() - 0.5) * 0.3, vy: -0.4, life: 18, col: '#6e5a40', s: 2 });   // 흙먼지 꼬리
      } else if (b.debris === 'molten') {
        const gl = g.createRadialGradient(0, 0, 1, 0, 0, 14); gl.addColorStop(0, 'rgba(255,190,80,0.7)'); gl.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gl; g.fillRect(-14, -14, 28, 28);
        g.fillStyle = '#7a2a08'; g.fillRect(-5, -6, 10, 12); g.fillRect(-3, -10, 6, 4); g.fillStyle = '#ff8a2a'; g.fillRect(-4, -5, 8, 10); g.fillStyle = '#ffe08a'; g.fillRect(-2, -3, 3, 5);
        if (t % 2 === 0) this.parts.push({ x: x + (Math.random() - 0.5) * 6, y: y - 8, vx: 0, vy: -0.3, life: 14, col: Math.random() < 0.5 ? '#ff8a2a' : '#5a5060', s: 2 });
      } else if (b.debris === 'star') {
        g.rotate(t * 0.08); const gl = g.createRadialGradient(0, 0, 1, 0, 0, 14); gl.addColorStop(0, 'rgba(140,240,230,0.7)'); gl.addColorStop(1, 'rgba(90,220,210,0)'); g.fillStyle = gl; g.fillRect(-14, -14, 28, 28);
        g.fillStyle = '#5ae0d8'; g.fillRect(-1, -9, 3, 18); g.fillRect(-9, -1, 18, 3); g.fillStyle = '#dffff8'; g.fillRect(-2, -2, 5, 5);
        if (t % 3 === 0) this.parts.push({ x, y: y - 8, vx: (Math.random() - 0.5) * 0.4, vy: -0.3, life: 16, col: '#8ff0e6', s: 1 });
      } else {   // 물방울
        g.fillStyle = '#14405a'; g.fillRect(-4, -6, 8, 11); g.fillRect(-2, -9, 4, 3); g.fillStyle = '#7cd8e8'; g.fillRect(-3, -4, 6, 8); g.fillStyle = '#e8fbff'; g.fillRect(-2, -3, 2, 3);
      }
      g.restore();
    }
  }
  // 공격 예고 표시: 광선 예고선 · 고리 원 · 낙하 파편 위치 (패링 불가는 붉게)
  drawWarnings(g, w) {
    const blink = (w.t >> 2) & 1;
    for (const e of w.enemies) {
      if (e.st !== 'telegraph' || !e.atk) continue;
      const a = ENEMY_DEFS[e.kind].attacks[e.atk];
      if (a.beam) { const [bx, bl] = clipBeam(w, e, e.face > 0 ? e.x + e.w : e.x - a.beam.len, a.beam.len, e.y + a.beam.y, a.beam.h, true); g.fillStyle = blink ? 'rgba(255,79,94,0.5)' : 'rgba(255,79,94,0.2)'; g.fillRect(bx, e.y + a.beam.y + a.beam.h / 2 - 1, bl, 3); }   // 거울이 있으면 거기서 끊긴 예고
      if (a.ring) { g.strokeStyle = blink ? 'rgba(255,79,94,0.8)' : 'rgba(255,79,94,0.35)'; g.lineWidth = 2; g.beginPath(); g.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2 + a.ring, e.h / 2 + 10, 0, 0, Math.PI * 2); g.stroke(); g.lineWidth = 1; }
    }
    for (const b of w.projectiles) if (b.shard && b.owner === 'enemy') {   // 떨어질 자리: 바닥에 그림자 원이 점점 커지고 진해짐 (붉은색 = 피하기, 금빛 = 패링 가능)
      const bx = b.x + b.w / 2, gy = groundAt(w, b.x, b.w), k = Math.max(0, Math.min(1, 1 - (gy - (b.y + b.h)) / 240));
      const col = b.parryable ? '255,214,120' : '255,79,94', a = (0.25 + 0.55 * k) * (k > 0.7 && blink ? 0.6 : 1);
      g.fillStyle = `rgba(${col},${a * 0.35})`; g.beginPath(); g.ellipse(bx, gy - 1, 8 + 12 * k, 2.5 + 2 * k, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = `rgba(${col},${a})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(bx, gy - 1, 8 + 12 * k, 2.5 + 2 * k, 0, 0, Math.PI * 2); g.stroke(); g.lineWidth = 1;
      if (b.y < 40) { g.fillStyle = `rgba(${col},0.18)`; for (let y = Math.max(0, b.y + b.h); y < gy - 6; y += 10) g.fillRect(Math.round(bx) - 1, y, 2, 5); }   // 막 떨어지기 시작할 땐 낙하선
    }
    for (const e of w.enemies) if (e.st === 'active' && e.atk) {
      const a = ENEMY_DEFS[e.kind].attacks[e.atk];
      if (a.beam) { const bx = e.beamX ?? (e.face > 0 ? e.x + e.w : e.x - a.beam.len), bl = e.beamL ?? a.beam.len; g.fillStyle = 'rgba(220,200,255,0.85)'; g.fillRect(bx, e.y + a.beam.y, bl, a.beam.h); g.fillStyle = '#fff'; g.fillRect(bx, e.y + a.beam.y + 8, bl, 5); }
      if (a.ring) { g.fillStyle = e.kind === 'shadow' ? 'rgba(120,40,170,0.55)' : 'rgba(200,170,255,0.5)'; g.beginPath(); g.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2 + a.ring, e.h / 2 + 10, 0, 0, Math.PI * 2); g.fill(); }
    }
  }

  // pixelfx actor: 상태 이펙트가 감쌀 실루엣 (서 있는 프레임 기준, 발이 원점)
  actorOf(ent, k = 1) {
    if (ent === this.lastW?.player || ent.relics) {
      const f = this.anims?.idle?.[0];
      return f && f.img.naturalWidth ? actorFromImage(f.img, f.ax, f.ay, k) : actorFromImage(this.liraImg, 47, 107, k);
    }
    const f = this.enemyFrame({ t: 0 }, { kind: ent.kind, st: 'idle', vx: 0, x: 0 }, ENEMY_DEFS[ent.kind]);
    return f ? actorFromImage(f.img, f.ax, f.ay, k) : undefined;
  }
  // 적 그림 (Higgsfield → 픽셀 격자). 원본은 왼쪽을 봄
  enemyFrame(w, e, d) {
    const K = baseOf(e.kind), EA = this.enemyAnims && this.enemyAnims[K];   // 변종은 원래 적의 그림을 빌림
    if (EA && EA.walk && EA.attack) {                       // 8프레임 애니메이션: 걷기는 이동 거리에 맞춰, 공격은 예고→판정→후딜에 맞춰
      const a = e.atk && d.attacks[e.atk], span = (lo, hi, k) => Math.min(hi, lo + Math.floor(Math.max(0, k) * (hi - lo + 1)));
      let list = EA.walk, i;
      if (e.st === 'telegraph' && a) { list = EA.attack; i = span(0, 3, e.stT / telegraphOf(e, a)); }
      else if (e.st === 'active' && a) { list = EA.attack; i = span(4, 5, e.stT / Math.max(1, (a.hits || 1) > 1 ? a.gapF : a.activeF)); }
      else if (e.st === 'recover' && a) { list = EA.attack; i = span(6, 7, e.stT / recoverOf(a)); }
      else if (K === 'moth') i = ((w.t / 4) | 0) % 8;
      else i = Math.abs(e.vx) > 0.1 ? Math.floor(Math.abs(e.x) * (e.boss ? 0.06 : 0.11)) % 8 : 0;
      const f = list[i]; if (f && f.img.complete && f.img.naturalWidth) { f.anim = true; return f; }
    }
    const S = this.enemySprites; if (!S || !S[K]) return null;
    const F = S[K]; let n;
    if (K === 'moth') n = e.st === 'active' ? 'down' : e.st === 'telegraph' ? 'up' : (w.t >> 2) & 1 ? 'up' : 'down';
    else if (e.st === 'telegraph') n = F.wind ? 'wind' : 'idle';
    else if (e.st === 'active' || (e.st === 'recover' && e.stT < 12)) n = F.slash ? 'slash' : 'strike';
    else n = 'idle';
    const f = F[n] || F.idle; return f && f.img.complete && f.img.naturalWidth ? f : null;
  }

  drawEnemySprite(g, w, e, d, f, k) {
    const a = e.atk && d && d.attacks[e.atk], M0 = g.getTransform();
    let img = f.img;
    const hitFlash = e.flash > 3;
    if (hitFlash) { /* 아래에서 원래 그림 위에 반투명 흰색을 덧칠 */ }
    let over = null;                                       // 예고 깜빡임: 통째로 바꾸지 않고 반투명 덧칠 (눈부심 방지)
    if (e.st === 'telegraph' && a && ((w.t >> (telegraphOf(e, a) - e.stT < 10 ? 1 : 2)) & 1)) over = a.parryable ? '#ffffff' : '#ff4f5e';
    else if (e.staggerT > 0 && (w.t >> 2) & 1) img = this.tinted('#9aa0ad', img);
    const cx = Math.round(e.x + e.w / 2), base = d && d.fly ? Math.round(e.y + e.h / 2) : Math.round(e.y + e.h);
    const big = e.boss ? 0.5 : 1;                          // 큰 몸은 덜 흔들리고 묵직하게
    let ox = 0, oy = 0, rot = 0, sy = 1;
    if (f.anim) {                                          // 애니메이션이 동작을 담고 있으니 예고 막판 떨림만
      if (e.st === 'telegraph' && a && e.stT / telegraphOf(e, a) > 0.65) ox = (w.t & 2 ? 1 : -1);
    } else if (d && d.fly) oy = Math.sin(w.t * 0.25 + e.x * 0.05) * 2;
    else if (e.st === 'idle' && Math.abs(e.vx) > 0.1) {                    // 걷기: 발걸음마다 들썩 + 좌우로 기우뚱
      const ph = e.x * (e.boss ? 0.07 : 0.16);
      oy = -Math.abs(Math.sin(ph)) * (e.boss ? 3 : 2.5); rot = Math.sin(ph) * 0.05 * big;
      if (e.boss && Math.abs(Math.sin(ph)) < 0.12 && !e.stepShook) { e.stepShook = true; } else if (Math.abs(Math.sin(ph)) > 0.5) e.stepShook = false;
    } else if (e.st === 'idle') sy = 1 + Math.sin(w.t * 0.07 + e.x) * 0.012;   // 숨쉬기
    else if (e.st === 'telegraph' && a) {                                  // 예고: 뒤로 움츠림 → 막판엔 떨림
      const kk = Math.min(1, e.stT / telegraphOf(e, a));
      rot = -e.face * 0.09 * kk * big; ox = -e.face * 4 * kk * big; sy = 1 - 0.04 * kk;
      if (kk > 0.65) ox += (w.t & 2 ? 1 : -1);
    } else if (e.st === 'active') { ox = e.face * 7 * big; rot = e.face * 0.07 * big; }   // 공격: 앞으로 내딛기
    else if (e.st === 'recover' && a) {                                     // 후딜: 천천히 복귀
      const kk = 1 - Math.min(1, e.stT / recoverOf(a)); ox = e.face * 7 * big * kk * kk; rot = e.face * 0.07 * big * kk * kk;
    }
    g.save(); g.translate(cx + Math.round(ox), base + Math.round(oy)); g.rotate(rot); g.scale((e.face > 0 ? -1 : 1) * (1 + k * 0.15), (1 - k * 0.1) * sy);
    if (e.elite && !e.decoy) {                                              // 강적: 실제 프레임을 따라가는 1px 붉은 테두리 (몸 위에 겹친 그림 없이)
      const t = this.tinted(e.mods && e.mods.includes('mirage') ? '#c890ff' : '#ff5a4a', f.img), a = 0.75 + 0.25 * Math.sin(w.t * 0.12);
      g.globalAlpha = a; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.drawImage(t, -f.ax + dx, -f.ay + dy); g.globalAlpha = 1;
    }
    const sh = e.solid === false ? 1 - Math.min(1, (e.inT || 0) / CFG.lantern.solidInF) * 0.6 : 0;   // 그림자: 반투명 검은 몸 (빛에 들면 또렷해짐)
    if (sh > 0) {                                                          // 그림자: 옅은 보랏빛 테두리 + 반투명 검은 몸 (눈빛은 따로) — 어둠 속에서도 형체는 읽힘
      const rim = this.tinted('#7a68a8', f.img), wob = Math.sin(w.t * 0.15 + e.x) > 0 ? 1 : 0;
      g.globalAlpha = 0.45; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1 - wob], [0, 1]]) g.drawImage(rim, -f.ax + dx, -f.ay + dy);
      g.globalAlpha = 0.78; g.drawImage(this.tinted('#120c1c', f.img), -f.ax, -f.ay);
      g.globalAlpha = 0.22 * (1 - sh); g.drawImage(img, -f.ax, -f.ay); g.globalAlpha = 1;
    }
    else g.drawImage(img, -f.ax, -f.ay);
    if (d && d.tint && !hitFlash) { g.globalCompositeOperation = 'color'; g.globalAlpha = 0.75; g.drawImage(this.tinted(d.tint, f.img), -f.ax, -f.ay); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }   // 변종: 원래 그림을 다른 색으로
    const EY = this.eyes && this.eyes[f.src];                               // 이 프레임의 실제 눈 위치 → 세계 좌표로 기억 (어둠 속 눈빛)
    if (EY) { const M = M0.inverse().multiply(g.getTransform()), q = M.transformPoint(new DOMPoint(EY[0] - f.ax, EY[1] - f.ay)); e._eye = [q.x, q.y, w.t, M, f, EY]; }
    if (!(sh > 0)) this.applyLight(g, f.img, f.ax, f.ay, e.x + e.w / 2, e.y + e.h / 2, e.face > 0);   // 그림자는 빛을 받지 않음
    if (e.frozenT > 0) { g.globalAlpha = 0.5; g.drawImage(this.tinted('#a8dcff', f.img), -f.ax, -f.ay); g.globalAlpha = 1; }   // 빙결: 얼음빛
    if (e.hot) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.13 + 0.07 * Math.sin(w.t * 0.18); g.drawImage(this.tinted('#ff6a1a', f.img), -f.ax, -f.ay); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }   // 달아오른 갑옷
    else if (e.crackT > 0) { g.globalAlpha = 0.25; g.drawImage(this.tinted('#b8c4d0', f.img), -f.ax, -f.ay); g.globalAlpha = 1; }   // 식어서 잿빛, 금 간 갑옷
    if (hitFlash) { g.globalAlpha = e.flash > 5 ? 0.55 : 0.3; g.drawImage(this.tinted('#ffffff', f.img), -f.ax, -f.ay); g.globalAlpha = 1; }
    else if (over) { g.globalAlpha = over === '#ffffff' ? 0.4 : 0.5; g.drawImage(this.tinted(over, f.img), -f.ax, -f.ay); g.globalAlpha = 1; }
    g.restore();
  }

  // 상태 → 애니메이션 프레임. 공격은 칼이 앞으로 나가는 프레임(3)이 판정 시작과 맞물리게
  pickAnim(w, p) {
    const A = this.anims; if (!A) return null;
    const C2 = CFG.attack, t = p.stateT;
    const span = (lo, hi, k) => Math.min(hi, lo + Math.floor(k * (hi - lo + 1)));   // k∈[0,1) → lo..hi
    let n = 'idle', i = ((w.t / 9) | 0) % ((A.idle && A.idle.length) || 8);
    switch (p.state) {
      case 'run': n = 'run'; i = ((w.t / 5) | 0) % ((A.run && A.run.length) || 8); break;
      case 'jump': n = 'jump'; i = p.vy < -2.5 ? 3 : p.vy < 1.5 ? 5 : 7; break;
      case 'attack': {
        n = p.follow && A.follow ? 'follow' : ['atk1', 'atk2', 'atk3'][p.combo] || 'atk1';
        const PH = { atk1: [3, 5], atk2: [6, 8], atk3: [6, 8], follow: [5, 7] }[n] || [3, 5], N = (A[n] && A[n].length) || 8;   // 준비(+바꿔잡기) · 베기(초승달 잔상) · 여운 구간
        const s0 = p.startF ?? C2.startupF, s1 = s0 + C2.activeF, end = s1 + C2.recoveryF;
        i = t < s0 ? span(0, PH[0] - 1, t / s0) : t < s1 ? span(PH[0], PH[1] - 1, (t - s0) / C2.activeF) : span(PH[1], N - 1, (t - s1) / (end - s1));
        break;
      }
      case 'parry': {
        n = 'parry'; const W = CFG.parry.normalF;
        i = t < 2 ? 2 : t < W ? (t < W / 2 ? 3 : 4) : span(5, 7, (t - W) / CFG.parry.whiffF);
        break;
      }
      case 'execute': {                                                    // 처형: 3타 자세로 크게 베기 (느린 웅크림 → 베기 → 여운)
        const X = CFG.execute;
        if (p.execMode === 'chain' && A.flurry) { n = 'flurry'; i = t < X.chainHitF ? span(0, 1, t / X.chainHitF) : span(2, p.chainNext ? 5 : 11, (t - X.chainHitF) / (X.chainTotalF - X.chainHitF)); break; }   // 연속 처형: 돌진 → 가로 베기 → (마지막이면 뛰어올라 내려치고 착지)
        if (A.exec) { n = 'exec'; i = Math.min(A.exec.length - 1, Math.floor(t / X.totalF * A.exec.length)); break; }   // 처형: 낫을 놓고 → 발로 차 올려 → 뛰어올라 잡고 → 사선 대참격 → 착지
        n = 'atk3';
        i = t < X.hitF ? span(0, 2, t / X.hitF) : t < X.hitF + 5 ? (t < X.hitF + 2 ? 3 : 4) : span(5, 7, (t - X.hitF - 5) / (X.totalF - X.hitF - 5));
        break;
      }
      case 'flurry': {                                                     // 반격 연참: 전용 12프레임 (돌진 → 가로 베기 → 올려베기 → 두 번 베기 → 뛰어올라 내려치기 → 착지)
        if (A.flurry) { n = 'flurry'; i = Math.min(11, Math.floor(t / CFG.flurry.totalF * 12)); break; }
        n = 'atk3'; i = span(0, 7, t / CFG.flurry.totalF); break;
      }
      case 'cast': if (p.spell === 'enchant' && A.enchant) { n = 'enchant'; i = Math.min(11, Math.floor(t / CFG.skill.enchant.castF * 12)); break; }   // 점화: 칼을 등불에 대어 불을 옮김
        n = 'parry'; i = t < 3 ? 2 : t < CFG.skill[p.spell].castF - 4 ? 4 : 6; break;   // 등불을 앞으로 내밀어 시전
      case 'roll': case 'ghost': n = 'roll'; i = span(0, 7, (p.stateT || 0) / (CFG.roll.totalF + CFG.roll.endLagF)); break;
      case 'hurt': n = 'hurt'; i = span(0, 5, t / CFG.player.hurtStunF); break;
      case 'dead': if (A.death) { n = 'death'; i = Math.min(9, Math.floor(t / 9)); } else { n = 'hurt'; i = 1; } break;   // 쓰러짐 10프레임 → 마지막에 멈춤
    }
    if (p.lamp && p.lamp.st !== 'held' && A[n + '_nl']) n = n + '_nl';   // 등불을 던진 동안: 손에 등불이 없는 그림
    const f = A[n] && A[n][i];
    if (f && okImg(f.img)) return f;
    return (A[n] || []).find(q => okImg(q.img)) || (A.idle || []).find(q => okImg(q.img)) || null;   // 못 불러온 프레임은 건너뜀 (빈 그림을 그려 캐릭터가 사라지지 않게)
  }

  drawAnim(g, w, p, fr, cx, feet, f) {
    if (p === w.player) this.lastFr = fr;                                  // 칼날 불꽃 위치용 (지금 프레임)
    const sq = this.squash, sy = 1 - sq * 0.15, sx = 1 + sq * 0.12;
    if (p === w.player && fr.pe) this.poleW = { x: cx + f * sx * (fr.pe[0] - fr.ax), y: feet + sy * (fr.pe[1] - fr.ay) };   // 낫 자루 끝 (사슬이 나오는 곳)
    if (p === w.player) this.captureSmear(w, p, fr, cx, feet, f, sx, sy);
    const lit = p.enchantT > 0 || (p.state === 'cast' && p.spell === 'enchant'), off = p.dark || (p.state === 'relight' && p.stateT < CFG.snuff.relightF - 4);
    const base = p.element || lit || off ? this.elFrame(fr, p.element || null, lit && !off, off) : fr.img;   // 등불 = 속성 색, 두르면 칼도, 소등이면 등불이 꺼짐   // 등불 = 속성 색, 두르면 칼도
    const img = p.state === 'hurt' && (w.t >> 1) % 2 ? this.tinted('#ff3c50', fr.img) : base;
    const dk = p !== w.player ? 0 : p.dark ? 1 : p.state === 'relight' ? Math.max(0, 1 - p.stateT / CFG.snuff.relightF) : 0;   // 소등: 몸은 어둠에 묻히고 눈과 칼 불꽃만
    g.save(); g.translate(cx, feet); g.scale(sx * f, sy);
    if (dk > 0) g.globalAlpha = 1 - dk * 0.82;                               // 어둠 속 몬스터와 같은 정도로 흐릿하게
    g.drawImage(img, -fr.ax, -fr.ay);
    if (p.state !== 'ghost') this.applyLight(g, base, fr.ax, fr.ay, cx, feet - 40, false, true);
    g.globalAlpha = 1;
    if (dk > 0) {
      if (lit) { const bo = this.bladeOnly(fr, base); if (bo) { g.globalAlpha = dk; g.drawImage(bo, -fr.ax, -fr.ay); g.globalAlpha = 1; } }
      const E = this.eyes && this.eyes[fr.src];
      if (E) {
        const ex = E[0] - fr.ax, ey = E[1] - fr.ay;
        const gl = g.createRadialGradient(ex, ey + 1, 0, ex, ey + 1, 7); gl.addColorStop(0, `rgba(234,146,66,${0.3 * dk})`); gl.addColorStop(1, 'rgba(234,146,66,0)'); g.fillStyle = gl; g.fillRect(ex - 7, ey - 7, 14, 14);
        g.globalAlpha = dk;
        if (E[2]) for (const [dx, dy, c] of E[2]) { g.fillStyle = '#' + c; g.fillRect(ex + dx, ey + dy, 1, 1); }   // 원래 그림의 주황 눈동자 그대로
        else { g.fillStyle = '#ea9242'; g.fillRect(ex - 4, ey + 1, 2, 2); g.fillRect(ex + 3, ey + 1, 2, 2); }
        g.globalAlpha = 1;
      }
    }   // 손에 든 등불: 앞쪽 림, 등쪽 그림자 (속성 색으로 다시 칠한 그림 기준 — 원본을 덧칠하면 색이 되돌아감)
    if (p === w.player && p.enchantT > 0 && p.state !== 'ghost') this._bladeTop = { base, fr, cx, feet, f, sx, sy, el: p.element || null, t: w.t };   // 점화한 칼은 불길 위에 다시 그려 모양이 보이게 (drawBladeTop)
    else if (p === w.player) this._bladeTop = null;
    g.restore();
    this.drawParryArc(g, p, cx, feet, f);
  }

  // 상태 → 포즈 그림
  pickPose(w, p) {
    const P = this.pose, ok = im => im && im.complete && im.naturalWidth ? im : null;
    const A = CFG.attack, t = p.stateT;
    let n = 'idle';
    switch (p.state) {
      case 'run': n = ['run1', 'run3', 'run2', 'run4'][((w.t / 6) | 0) & 3]; break;   // 4프레임 달리기
      case 'jump': n = p.vy < 1 ? 'jump' : 'fall'; break;
      case 'attack': {
        // 1타·3타: 치켜듦(준비) → 앞으로 벰(판정·후딜) → 칼을 거둠
        // 2타(올려베기): 칼을 낮게 끌어(대기 자세, 몸을 숙임) → 치켜 올림 → 거둠
        const wind = p.combo === 1 ? 'idle' : 'atk1', hit = p.combo === 1 ? 'atk1' : 'atk2';
        const end = A.startupF + A.activeF + A.recoveryF;
        n = t < A.startupF ? wind : t < end - 4 ? hit : 'atkmid'; break;
      }
      case 'parry': n = t < 2 ? 'parrymid' : t < CFG.parry.normalF + 4 ? 'parry' : 'parrymid'; break;
      case 'roll': case 'ghost': n = 'roll'; break;
      case 'hurt': case 'dead': n = 'hurt'; break;
    }
    return ok(P[n]) || (n !== 'idle' && ok(P.idle));
  }

  drawPose(g, w, p, img, cx, feet, f) {
    const sq = this.squash, st = !p.onGround && p.vy < -1 ? 0.06 : 0;
    const sy = 1 - sq * 0.2 + st, sx = 1 + sq * 0.16 - st * 0.5;
    const bob = p.state === 'idle' ? Math.round(Math.sin(w.t * 0.08) * 0.8) : 0;
    let lean = 0, push = 0, crouch = 0;
    if (p.state === 'attack') {
      const A = CFG.attack, t = p.stateT, s0 = A.startupF, s1 = s0 + A.activeF, end = s1 + A.recoveryF;
      if (t < s0) { const k = t / s0; lean = -0.07 * k; crouch = 0.05 * k; }               // 준비: 뒤로 무게
      else if (t < s1) { lean = 0.1; push = 5; }                                            // 벰: 앞으로
      else { const k = 1 - (t - s1) / (end - s1); lean = 0.1 * k * k; push = 5 * k * k; }   // 복귀: 감속
      if (p.combo === 2 && t >= s0 && t < s1) { lean = 0.14; push = 8; }                    // 3타는 더 크게
    }
    g.save(); g.translate(cx, feet - bob);
    const src = p.state === 'hurt' && (w.t >> 1) % 2 ? this.tinted('#ff3c50', img) : img;
    if (p.state === 'roll' || p.state === 'ghost') {            // 공처럼 굴러감: 공 중심(그림 66,69)을 축으로, 바닥에 닿게
      const k = Math.min(1, (p.stateT || 0) / CFG.roll.totalF);
      g.translate(0, -33); g.rotate(k * Math.PI * 2 * f); g.scale(f, 1);
      g.drawImage(src, -66, -69);
    } else {
      g.scale(sx * f, sy);
      g.drawImage(src, -69, -111);
    }
    g.restore();
    this.drawParryArc(g, p, cx, feet, f);
  }

  // 리라 그림의 단색 실루엣 (피격 번쩍임용), 한 번 만들어 재사용
  // 빛 명암 마스크 (이미지당 1회): 왼/오른/위 가장자리 2px 띠. 등불 쪽은 호박색 림라이트, 반대쪽은 그림자
  shadeMasks(im) {
    this.masks = this.masks || new WeakMap();
    let M = this.masks.get(im); if (M) return M;
    const W = im.naturalWidth || im.width, H = im.naturalHeight || im.height; if (!W) return null;
    const c0 = document.createElement('canvas'); c0.width = W; c0.height = H; const x0 = c0.getContext('2d'); x0.drawImage(im, 0, 0);
    const A = x0.getImageData(0, 0, W, H).data, op = (x, y) => x >= 0 && y >= 0 && x < W && y < H && A[(y * W + x) * 4 + 3] > 96;
    const make = (col, dx, dy) => {
      const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), d = x.createImageData(W, H);
      for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
        if (!op(xx, yy)) continue;
        const open = (x, y) => !op(x, y) && !op(x + dx, y + dy) && !op(x + 2 * dx, y + 2 * dy);   // 바깥으로 3px 이상 트인 외곽만 (몸 안 작은 틈 제외)
        const a = open(xx + dx, yy + dy) ? 1 : op(xx + dx, yy + dy) && open(xx + 2 * dx, yy + 2 * dy) ? 0.45 : 0;
        // 빛 받는 쪽 절반에 몰리게: 오른쪽 띠는 그림 오른쪽일수록, 왼쪽 띠는 왼쪽일수록 진하게 (위 띠는 균일)
        const u = xx / (W - 1), ramp = dx > 0 ? Math.min(1, Math.max(0, (u - 0.3) / 0.5)) : dx < 0 ? Math.min(1, Math.max(0, (0.7 - u) / 0.5)) : 1;
        if (!a || !ramp) continue; const i = (yy * W + xx) * 4; d.data[i] = col[0]; d.data[i + 1] = col[1]; d.data[i + 2] = col[2]; d.data[i + 3] = 255 * a * ramp;
      }
      x.putImageData(d, 0, 0); return c;
    };
    const RIM = [255, 196, 120], SH = [10, 6, 18];
    M = { rimL: make(RIM, -1, 0), rimR: make(RIM, 1, 0), rimT: make(RIM, 0, -1), shL: make(SH, -1, 0), shR: make(SH, 1, 0) };
    this.masks.set(im, M); return M;
  }
  // 현재 변환(뒤집기 포함) 안에서 그린 스프라이트 위에 명암을 덧칠. flip: 화면에서 좌우가 뒤집혀 그려지는가
  applyLight(g, im, ax, ay, cx, cy, flip, self = false) {
    const M = this.shadeMasks(im); if (!M) return;
    const dx = this.lampX - cx, dy = this.lampY - cy, dist = Math.hypot(dx, dy);
    const I = self ? 0.55 : Math.max(0, 1 - dist / (this.lampR * 1.6));          // 등불에서 멀수록 약하게
    const toRight = self ? true : (dx > 0) !== flip;                              // 등불이 그림 기준 어느 쪽인가
    const prevA = g.globalAlpha;
    const B = bodyShade(im, toRight);                                             // 몸 전체 명암 (등불 쪽 밝게, 반대쪽 그늘)
    if (B) { g.globalAlpha = prevA * (self ? 0.9 : 0.35 + 0.6 * I); g.drawImage(B, -ax, -ay); g.globalAlpha = prevA; }
    if (!self && I < 0.85) { g.globalAlpha = prevA * 0.3 * (1 - I); g.drawImage(this.tinted('#0a0612', im), -ax, -ay); }   // 먼 적은 어둠에 잠김
    g.globalAlpha = prevA * 0.3; g.drawImage(toRight ? M.shL : M.shR, -ax, -ay);                                          // 등불 반대쪽 그림자
    if (I > 0.02) {
      g.globalAlpha = prevA * 0.6 * I; g.drawImage(toRight ? M.rimR : M.rimL, -ax, -ay);                                 // 등불 쪽 림라이트
      if (dy < -10) { g.globalAlpha = prevA * 0.4 * I; g.drawImage(M.rimT, -ax, -ay); }
    }
    g.globalAlpha = prevA;
  }

  tinted(col, im = this.liraImg) {
    this.tints = this.tints || new Map();
    const key = col + im.src;
    if (!this.tints.has(key)) {
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
      this.tints.set(key, c);
    }
    return this.tints.get(key);
  }

  // 패링 판정창 호 (앞쪽)
  drawParryArc(g, p, cx, feet, f) {
    if (p.state !== 'parry' || p.stateT >= CFG.parry.normalF) return;
    // 패링 자세 원호는 그리지 않음 (원이 많아 눈이 아프다는 요청) — 완벽 패링 순간의 불꽃만
  }

  drawSword(g, p, cx, top, f) {
    let ang;   // 0 = 앞으로 수평, 음수 = 위
    if (p.state === 'attack') {
      const t = p.stateT, A = CFG.attack;
      const [a0, a1] = [[-2.2, 0.7], [0.9, -1.2], [-2.5, 1.0]][p.combo];
      ang = t < A.startupF ? a0 : t < A.startupF + A.activeF ? a0 + (a1 - a0) * ((t - A.startupF + 1) / A.activeF) : a1;
    } else if (p.state === 'run') ang = 2.2; else if (p.state === 'jump') ang = 2.0; else ang = 2.4;
    const hx = cx - f * 3, hy = top + 17, L = p.state === 'attack' ? 18 : 15;
    const ex = hx + Math.cos(ang) * L * f, ey = hy + Math.sin(ang) * L;
    g.strokeStyle = C.steel; g.lineWidth = 2; g.beginPath(); g.moveTo(hx, hy); g.lineTo(ex, ey); g.stroke(); g.lineWidth = 1;
    g.fillStyle = '#6a5030'; g.fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3);
  }

  drawEnemy(g, w, e) {
    const d = ENEMY_DEFS[e.kind];
    const k = e.flash > 0 ? e.flash / 6 : 0;                 // 맞으면 찌그러짐
    const ew = e.w * (1 + k * 0.25), eh = e.h * (1 - k * 0.15);
    const x = Math.round(e.x + (e.w - ew) / 2), y = Math.round(e.y + e.h - eh);
    const spr = this.enemyFrame(w, e, d);
    if (e.spawnT > 0 && spr) {                               // 등장: 땅에서 솟아오르며 선명해짐 (나는 적은 위에서 내려옴)
      const t = 1 - e.spawnT / EMERGE_F, ease = 1 - (1 - t) * (1 - t), feet = Math.round(e.y + e.h);
      g.save();
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(e.x + e.w / 2, feet, (e.w / 2 + 8) * Math.min(1, t * 2), 4, 0, 0, Math.PI * 2); g.fill();
      if (!d.fly) { g.beginPath(); g.rect(e.x - 200, -200, e.w + 400, feet + 200 + 1); g.clip(); g.translate(0, Math.round((1 - ease) * (e.h + 6))); }
      else g.translate(0, Math.round(-(1 - ease) * 40));
      g.globalAlpha = 0.2 + 0.8 * t;
      this.drawEnemySprite(g, w, e, d, spr, 0);
      g.restore(); return;
    }
    if (spr) this.drawEnemySprite(g, w, e, d, spr, k);
    else {
    g.fillStyle = e.flash > 3 ? C.white : C[e.kind === 'bellBoss' ? 'boss' : e.kind] || '#777';
    if (e.staggerT > 0 && (w.t >> 2) % 2) g.fillStyle = '#9aa0ad';
    g.fillRect(x, y, Math.round(ew), Math.round(eh));
    g.fillStyle = C.red; g.fillRect(e.face > 0 ? x + Math.round(ew) - 5 : x + 2, y + 6, 3, 2);
    if (e.kind === 'bellBoss') { g.fillStyle = '#8c7a52'; g.fillRect(e.face > 0 ? x + Math.round(ew) : x - 22, y + 20, 22, 26); }
    }
    if (!d) return;
    const a = e.atk && d.attacks[e.atk];
    if (e.st === 'telegraph' && a) {
      const left = telegraphOf(e, a) - e.stT;
      const blink = left < 10 ? (w.t >> 1) % 2 : (w.t >> 2) % 2;
      const col = a.parryable ? C.white : C.red;
      g.strokeStyle = col; g.lineWidth = 2;
      if (blink && !spr) g.strokeRect(x - 1, y - 1, ew + 2, eh + 2);
      if (!a.parryable && !spr) { g.fillStyle = 'rgba(255,79,94,0.25)'; g.fillRect(x - 3, y - 3, ew + 6, eh + 6); }   // 그림 있는 적은 붉은 덧칠로 충분
      g.lineWidth = 1;
      g.fillStyle = col; g.fillRect(Math.round(e.x + e.w / 2) - 1, e.y - 12, 3, 7); g.fillRect(Math.round(e.x + e.w / 2) - 1, e.y - 4, 3, 2);
    }
    if (e.st === 'active' && !spr) for (const h of w.hitboxes) if (h.owner === e) {   // 그림 없는 적만: 그림 있는 적은 pixelfx 공격 궤적이 범위를 보여 줌
      g.fillStyle = h.parryable ? 'rgba(255,255,255,0.35)' : 'rgba(255,79,94,0.45)'; g.fillRect(h.x, h.y, h.w, h.h);
    }
    if (!e.boss && e.hp < e.maxHp) { g.fillStyle = '#000'; g.fillRect(Math.round(e.x), Math.round(e.y) - 5, e.w, 2); g.fillStyle = C.red; g.fillRect(Math.round(e.x), Math.round(e.y) - 5, Math.round(e.w * e.hp / e.maxHp), 2); }
    if (!e.boss && e.poiseMax && (e.poise > 0 || e.stunT > 0)) {           // 일반 적 자세 게이지 (가득 차면 그로기 → 처형 가능)
      const bw = Math.max(e.w, 24), bx = Math.round(e.x + e.w / 2 - bw / 2), by = Math.round(e.y) - 2;
      g.fillStyle = '#000'; g.fillRect(bx, by, bw, 2);
      g.fillStyle = e.stunT > 0 ? ((w.t >> 2) & 1 ? '#fff' : '#ffe2a8') : '#e8c060'; g.fillRect(bx, by, Math.round(bw * (e.stunT > 0 ? 1 : e.poise)), 2);
      if (e.stunT > 0 && !e.executing) { g.font = '9px Galmuri9, monospace'; g.textAlign = 'center'; g.fillStyle = '#ffe2a8'; g.fillText('처형!', e.x + e.w / 2, by - 12); g.textAlign = 'left'; }
    }
  }

  // HUD: 왼쪽 위 체력·빛·기름병, 가운데 위 방 진행·불씨, 아래 보스 체력
  drawHud(g, w) {
    const p = w.player, I = iconCanvas;
    g.save(); g.textBaseline = 'top'; g.font = '10px Galmuri9, monospace';
    const hs = this.vw < 760 ? 1.5 : 1.25;                     // 폰에서 읽히도록 HUD만 크게 (보스 바 제외)
    g.save(); g.scale(hs, hs); this.vw /= hs;
    const plate = (x, y, ww, hh) => { g.fillStyle = 'rgba(13,10,17,.55)'; g.fillRect(x, y, ww, hh); };
    // 체력 바: 최대 체력 1당 11px (생명 스탯을 올리면 바가 길어짐), 칸 구분선, 깎인 만큼 잠깐 흰 잔상
    const hw = p.maxHp * 11, hx = 22, hy = 9;
    plate(4, 4, Math.max(hx + hw, 112) + 8, 40);
    g.drawImage(I('heart', 'red'), 7, 6);
    this.hpShadow = Math.max(p.hp, Math.min(p.maxHp, (this.hpShadow ?? p.hp) - 0.04));
    g.fillStyle = '#120e16'; g.fillRect(hx - 1, hy - 1, hw + 2, 9);
    g.fillStyle = '#3a1820'; g.fillRect(hx, hy, hw, 7);
    g.fillStyle = '#ffd0d6'; g.fillRect(hx, hy, Math.round(hw * this.hpShadow / p.maxHp), 7);
    const low = p.hp <= Math.max(1, p.maxHp * 0.25) && (w.t >> 3) & 1;
    g.fillStyle = low ? '#ff6a78' : '#d33a4a'; g.fillRect(hx, hy, Math.round(hw * p.hp / p.maxHp), 7);
    g.fillStyle = '#ff8a94'; g.fillRect(hx, hy, Math.round(hw * p.hp / p.maxHp), 2);
    if (this.hpGain) {                                                   // 회복으로 새로 찬 칸: 초록·흰빛 깜빡임
      const G = this.hpGain, x0 = hx + Math.round(hw * G.from / p.maxHp), x1 = hx + Math.round(hw * Math.min(p.hp, G.to) / p.maxHp);
      g.globalAlpha = G.t / 40; g.fillStyle = '#9dffb0'; g.fillRect(x0, hy, Math.max(0, x1 - x0), 7); g.globalAlpha = 1;   // 새로 찬 칸만 잠깐 밝게
    }
    g.fillStyle = '#120e16'; for (let i = 1; i < p.maxHp; i++) g.fillRect(hx + i * 11, hy, 1, 7);
    // 빛 게이지: 랜턴 + 4칸 눈금. 가득 차면 깜빡임
    const gx = 22, gy = 25, gw = CFG.legacy ? 64 : 46;
    if (!CFG.legacy) {                                                    // 새 설계: 등불 상태 + 빛 조각
      const Lp = p.lamp || { st: 'held' }, P = EL_SLASH[p.color || null];
      g.drawImage(I('wick', p.color ? 'amber' : 'bone'), 7, 21);
      g.fillStyle = P[4]; g.fillText(Lp.st === 'held' ? (Lp.offT > 0 ? '꺼짐' : '손') : Lp.st === 'placed' ? '놓임' : '…', gx, gy - 3);
      if (Lp.st === 'placed') { const k2 = 1 - Lp.t / (CFG.lantern.placedF + 180 * ((p.shapes || {}).long || 0)); g.fillStyle = '#120e16'; g.fillRect(gx + 22, gy, 22, 3); g.fillStyle = P[4]; g.fillRect(gx + 22, gy, Math.round(22 * Math.max(0, k2)), 3); }
      if (p.shardsSeen !== p.shards) { this.shT = 30; p.shardsSeen = p.shards; } if (this.shT > 0) this.shT--;
      g.fillStyle = this.shT > 0 ? '#ffffff' : '#ffd27a'; g.fillRect(gx + 50 + (gw - 46), gy - 1, 3, 3); g.fillRect(gx + 51 + (gw - 46), gy - 2, 1, 5);   // 빛 조각 (작은 별)
    } else {
      const full = p.light >= CFG.light.max, k = Math.min(1, p.light / CFG.light.max);
      g.drawImage(I('parry', 'amber'), 7, 21);
      g.fillStyle = '#120e16'; g.fillRect(gx - 1, gy - 1, gw + 2, 7); g.fillStyle = '#2e2537'; g.fillRect(gx, gy, gw, 5);
      // 빛 = 점화한 칼의 기름. 눈금 = 점화할 수 있는 빛 (넘으면 밝게). 점화한 동안엔 휘두를 때마다 줄어듦
      const costs = [Math.round(CFG.enchant.cost * (p.mods.costMul || 1))], c1 = costs[0], c2 = p.enchantT > 0 ? 999 : c1;
      g.fillStyle = p.light >= c2 ? ((w.t >> 3) & 1 ? '#fff0c8' : '#ffb347') : p.light >= c1 ? '#e08a2a' : '#8c4a14'; g.fillRect(gx, gy, Math.round(gw * k), 5);
      g.fillStyle = '#ffd27a'; g.fillRect(gx, gy, Math.round(gw * k), 1);
      for (const c of costs) { const mx = gx + Math.round(gw * c / CFG.light.max); g.fillStyle = p.light >= c ? '#fff0c8' : '#4a3e57'; g.fillRect(mx, gy - 2, 1, 9); }
    }
    for (let i = 0; i < Math.max(p.maxFlasks, p.flasks); i++) { g.globalAlpha = i < p.flasks ? 1 : 0.25; g.drawImage(I('flask', 'heal'), gx + gw + 3 + i * 9, gy - 4, 9, 9); }
    g.globalAlpha = 1;
    // 완벽 패링 수: 늘어나는 순간 잠깐 밝게
    if (p.perfectParries !== this.ppSeen) { this.ppSeen = p.perfectParries; this.ppT = 30; }
    if (this.ppT > 0) this.ppT--;
    g.fillStyle = this.ppT > 0 ? '#fff0c8' : '#b89a6a'; g.fillText(CFG.legacy ? '완벽 패링 ' + p.perfectParries + (p.chainN ? '  연쇄 ×' + p.chainN : '') : '빛 조각 ' + (p.shards || 0) + '  완벽 패링 ' + p.perfectParries, 8, 33);
    // 방 진행 (마름모) + 불씨
    if (this.runInfo) {
      const r = this.runInfo, n = r.length, cx = Math.round(this.vw / 2), x0 = cx - n * 7;   // 정해진 길: 스테이지마다 아이콘
      const ICO = { combat: ['combat', 'bone'], elite: ['elite', 'ember'], shop: ['shop', 'amber'], rest: ['rest', 'heal'], boss: ['boss', 'ember'] };
      plate(x0 - 6, 3, n * 14 + 54, 18);
      for (let i = 0; i < n; i++) {
        const [ic, tone] = ICO[r.route[i]] || ICO.combat, x = x0 + i * 14;
        g.globalAlpha = i < r.roomIdx ? 0.35 : i === r.roomIdx ? 1 : 0.6;
        g.drawImage(I(ic, i === r.roomIdx ? 'amber' : tone), x, 6);
        if (i === r.roomIdx) { g.fillStyle = '#ffb347'; g.fillRect(x, 19, 12, 1); }
      }
      g.globalAlpha = 1;
      g.drawImage(I('ember', 'amber'), x0 + n * 14 + 2, 6);
      g.fillStyle = '#ffe2a8'; g.fillText(String(r.embers), x0 + n * 14 + 16, 7);
      // 점수 · 방 목표 시간 (전투·강적 방에서 정리하기 전까지)
      const sx = x0 + n * 14 + 60; plate(sx - 4, 3, 70, 18); g.fillStyle = '#cfc6dc'; g.fillText('점수 ' + (r.score || 0), sx, 7);
      if (w.par && !w.cleared && (w.room === 'arena')) {
        const sec = Math.floor(w.t / 60), left = w.par - sec, mm = v => `${Math.floor(Math.max(0, v) / 60)}:${String(Math.max(0, v) % 60).padStart(2, '0')}`;
        plate(sx + 70, 3, 64, 18); g.fillStyle = left > 10 ? '#ffe2a8' : left > 0 ? '#ff9a6a' : '#7a7088'; g.fillText((left > 0 ? '⏱ ' : '') + mm(left > 0 ? left : sec), sx + 74, 7);
      }
    }
    this.vw *= hs; g.restore();
    const boss = w.enemies.find(e => e.boss);
    if (boss) {                                               // 보스: 이름판 + 체력 + 자세
      const bw = Math.min(320, this.vw - 260), bx = Math.round((this.vw - bw) / 2), by = Math.round(44 * hs + 20), name = ENEMY_DEFS[boss.kind].name;   // 위쪽: 아래는 엄지 버튼 자리
      plate(bx - 4, by - 15, bw + 8, 30);
      g.drawImage(I('boss', 'ember'), bx, by - 14); g.fillStyle = '#ece3d3'; g.fillText(name, bx + 15, by - 12);
      g.fillStyle = '#120e16'; g.fillRect(bx - 1, by - 1, bw + 2, 8);
      g.fillStyle = '#3a1820'; g.fillRect(bx, by, bw, 6);
      const hk = boss.hp / boss.maxHp; this.bossShadow = Math.max(hk, (this.bossShadow ?? 1) - 0.004);
      g.fillStyle = '#ffd0d6'; g.fillRect(bx, by, Math.round(bw * this.bossShadow), 6);     // 깎인 체력 잔상
      g.fillStyle = '#d33a4a'; g.fillRect(bx, by, Math.round(bw * hk), 6); g.fillStyle = '#ff6a78'; g.fillRect(bx, by, Math.round(bw * hk), 2);
      g.fillStyle = '#2e2537'; g.fillRect(bx, by + 8, bw, 3);
      g.fillStyle = boss.stunT > 0 ? ((w.t >> 2) & 1 ? '#fff' : '#ffe2a8') : '#e8c060'; g.fillRect(bx, by + 8, Math.round(bw * (boss.stunT > 0 ? 1 : boss.poise)), 3);
      if (boss.stunT > 0) { g.fillStyle = '#ffe2a8'; g.textAlign = 'right'; g.fillText('처형 가능', bx + bw, by - 12); g.textAlign = 'left'; }
      if (boss.elB > 0) { g.fillStyle = `rgb(${EL_RGB[boss.elK || null]})`; g.fillRect(bx, by + 12, Math.round(bw * Math.min(1, boss.elB / CFG.enchant.hitsBoss)), 2); }   // 보스 속성 게이지
    } else this.bossShadow = 1;
    g.restore();
  }
}
