// 렌더러: world를 읽기만 한다. 리라 임시 실루엣 + 적 상자 + pixelfx 이펙트 + 화면 연출
import { CFG } from './core/config.js';
import { attackBox } from './core/player.js';
import { ENEMY_DEFS, telegraphOf, recoverOf, EMERGE_F } from './core/enemies.js';
import { nearProp } from './core/world.js';
import { FxLayer, ScreenFx, actorFromImage } from './fx.js';
import { FxDirector } from './fxmap.js';
import { iconCanvas } from './icons.js';
import { bodyShade } from './shade.js';
// 기본 공격 베기: [pixelfx id, 앞쪽 오프셋, 높이 오프셋] — 스프라이트 칼 궤적 자리에 맞춤
const CINE = { in: 40, out: 150, out2: 185, end: 220 };   // 보스 등장 연출 틱: 페이드인 · 유지 · 페이드아웃 · 전체 방 페이드인
const IRIS_SPEED = 0.6;   // 스테이지 전환 아이리스 속도 (1 = pixelfx 원래 속도)
const SLASH = [['melee/sword-slash', 22, 0], ['melee/uppercut', 20, 0], ['melee/spear-sweep', 64, -26]];
const STEEL = ['#14121c', '#2a2838', '#4a4860', '#7a7890', '#b0aec4', '#dcdae8', '#ffffff'];   // 은빛 칼 (색 과하지 않게)
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

export class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.dark = document.createElement('canvas'); this.dctx = this.dark.getContext('2d');
    this.fx = new FxLayer(); this.bgfx = new FxLayer(); this.pfx = new FxLayer(); /* pfx: 리라 베기 (리라 뒤에 그림) */ this.weather = new ScreenFx(); this.trans = new ScreenFx(); this.dir = new FxDirector(this); this.fxid = 0;
    this.parts = []; this.texts = [];
    this.ghosts = [];             // 회피 잔상
    this.tail = null;             // 포니테일 스프링
    this.lantern = { a: 0, v: 0 };
    this.squash = 0; this.flash = 0; this.zoom = 0; this.stunFx = new Map();
    this.debug = /debug=1/.test(location.search);
    // 리라 픽셀 그림 (Higgsfield: 리라 디자인 + 사용자 샘플 화풍 → forge pixel_look로 픽셀 격자 맞춤). 기준점: 발 중앙 (43, 85)
    this.liraImg = new Image(); this.liraImg.src = 'assets/lira.png';
    // 동작 포즈 (Higgsfield 포즈 생성 → 기준 리라 격자로 읽음). 모두 132x111, 발 기준점 (69, 111)
    this.bgs = {}; this.region = 1;   // 지역별 배경은 처음 쓸 때 불러온다
    // 리라 8프레임 애니메이션 (Higgsfield GIF 생성 → 게임 크기·팔레트로 변환). 프레임마다 발 기준점(ax, ay)
    fetch('assets/anims.json').then(r => r.json()).then(J => {
      for (const k in J) for (const n in J[k]) for (const f of J[k][n]) { const im = new Image(); im.src = f.src; f.img = im; }
      this.anims = J.lira; this.enemyAnims = J;
    }).catch(() => {});
    this.pose = {};
    fetch('assets/enemies.json').then(r => r.json()).then(J => {
      for (const kind in J) for (const n in J[kind]) { const im = new Image(); im.src = J[kind][n].src; J[kind][n].img = im; }
      this.enemySprites = J;
    }).catch(() => {});
    for (const n of ['idle', 'atk1', 'atkmid', 'atk2', 'parrymid', 'parry', 'hurt', 'roll', 'jump', 'fall', 'run1', 'run2', 'run3', 'run4']) {
      const im = new Image(); im.src = `assets/lira-${n}.png`; this.pose[n] = im;
    }
    this.resize();
  }

  resize() {
    const H = CFG.VIEW_H, ih = innerHeight, iw = innerWidth;
    let s = Math.min(ih / H, iw / CFG.VIEW_W); if (s >= 2) s = Math.floor(s);   // 좁은 창(4:3 등)에서도 잘리지 않게
    this.vw = Math.min(CFG.VIEW_W_MAX, Math.max(CFG.VIEW_W, Math.floor(iw / s)));
    this.cv.width = this.vw; this.cv.height = H;
    this.dark.width = this.vw; this.dark.height = H;
    this.fx.resize(this.vw, H); this.bgfx.resize(this.vw, H); this.pfx.resize(this.vw, H);
    this.cv.style.width = Math.round(this.vw * s) + 'px';
    this.cv.style.height = Math.round(H * s) + 'px';
    this.ctx.imageSmoothingEnabled = false;
  }

  reset() { this.fx.clear(); this.bgfx.clear(); this.pfx.clear(); this.weather.clear(); this.trans.clear(); this.parts = []; this.texts = []; this.ghosts = []; this.tail = null; this.stunFx.clear(); this.sayMsg = null; this.irisMode = null; this.cine = null; }

  // 이번 틱 이벤트 → 이펙트 (pixelfx 연결은 fxmap.js의 FxDirector, 여기는 화면 연출·글자·작은 입자)
  spawnFx(w) {
    const p = w.player, feet = p.y + p.h;
    // 기본 공격: 동작마다 맞는 pixelfx 베기 하나만 (1타 내려베기 · 2타 올려베기 · 3타 가로 휘두르기). 타격 불꽃은 따로 안 띄움
    if (p.state === 'attack' && p.stateT === CFG.attack.startupF) {
      const [id, dx, dy] = SLASH[p.combo] || SLASH[0];
      this.pfx.spawn(id, p.x + p.w / 2 + p.face * dx, feet + dy, { flip: p.face < 0, palette: STEEL, light: 0.15, life: 30 });
    }
    this.dir.events(w); this.dir.tick(w);
    for (const ev of w.events) {
      if (ev.type === 'parry' && ev.perfect) { this.flash = 1; this.zoom = 1; this.texts.push({ x: p.x + p.w / 2, y: p.y - 26, t: 0, s: '완벽!' }); }
      else if (ev.type === 'executeStart') { this.pfx.spawn('melee/heavy-cleave', p.x + p.w / 2 + p.face * 24, feet, { flip: p.face < 0, palette: AMBER7, light: 0.4, life: 80, speed: 0.55 }); }
      else if (ev.type === 'execute') { this.flash = 0.8; this.texts.push({ x: ev.x, y: ev.y - 40, t: 0, s: '처형!', life: 60 }); }
      else if (ev.type === 'hurt') { this.burst(ev.x, ev.y, 12, [C.red, '#ffffff'], 2.5); this.flash = -0.5; }
      else if (ev.type === 'enemyParry') this.texts.push({ x: ev.x, y: ev.y - 20, t: 0, s: '간파!' });
      else if (ev.type === 'heal') this.healFx(p, ev.amount, ev.from);
      else if (ev.type === 'land') {
        this.squash = Math.min(1, ev.v / 7);
        if (ev.v > 3) { this.dust(ev.x - 4, ev.y, -1, 5); this.dust(ev.x + 4, ev.y, 1, 5); }
      }
    }
    if (p.state === 'run' && w.t % 9 === 0) this.dust(p.x + p.w / 2 - p.face * 5, feet, -p.face, 2);   // 달리기 먼지
    if (p.state === 'roll' && p.stateT < CFG.roll.totalF && p.stateT % 3 === 0) this.ghosts.push({ x: p.x, y: p.y, face: p.face, life: 12 });   // 회피 잔상
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
    if (!frozen) { this.fx.update(1 / CFG.TICK); this.pfx.update(1 / CFG.TICK); }
    this.bgfx.update(1 / CFG.TICK);
    this.weather.update(1 / CFG.TICK); this.trans.update(1 / CFG.TICK);
    if (this.irisMode) { this.irisClock += IRIS_SPEED / CFG.TICK; if (this.irisMode === 'open' && this.irisClock >= 2.2) this.irisMode = null; }
    for (const p of this.parts) { p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= 0.92; p.life--; }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const g of this.ghosts) g.life--;
    this.ghosts = this.ghosts.filter(g => g.life > 0);
    for (const t of this.texts) t.t++;
    this.texts = this.texts.filter(t => t.t < (t.life || 40));
    if (this.healFlash > 0) this.healFlash = Math.max(0, this.healFlash - 0.025);
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
    if (p.state === 'parry' && p.stateT < 4) L.a = -p.face * 1.2;   // 패링: 랜턴을 앞으로 휘두름
  }

  draw(w) {
    const g = this.ctx, H = CFG.VIEW_H, vw = this.vw, p = w.player;
    const boss = this.cine && this.cine.focusBoss && w.enemies.find(e => e.boss);
    const camX = Math.max(0, Math.min(w.width - vw, boss ? boss.x + boss.w / 2 - vw / 2 : p.x + p.w / 2 - vw * 0.4));   // 등장 연출 중엔 보스를 비춤
    const still = this.hud === false;                                   // 메뉴 화면이 열려 있으면 뒤 배경은 멈춘 그림 (흔들림·확대 없음)
    const sh = !still && w.shake > 0 ? Math.min(5, w.shake / 2) : 0;
    const sx = Math.round((Math.random() - 0.5) * 2 * sh), sy = Math.round((Math.random() - 0.5) * 2 * sh);
    const ox = Math.round(-camX) + sx, oy = sy;

    g.save();
    // 완벽 패링 줌인: 리라를 중심으로 살짝 당김
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
    d.fillStyle = 'rgba(4,2,8,0.5)'; d.fillRect(0, 0, vw, H);
    d.globalCompositeOperation = 'destination-out';
    this.lampX = p.x + p.w / 2 + p.face * 30; this.lampY = p.y + p.h - 32; this.lampR = 110 + p.light * 0.9;   // 리라 손의 등불 = 이 세계의 광원
    const lx = this.lampX + ox, ly = this.lampY + oy, lr = this.lampR;
    const lg = d.createRadialGradient(lx, ly, 10, lx, ly, lr); lg.addColorStop(0, 'rgba(0,0,0,1)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = lg; d.fillRect(0, 0, vw, H);
    g.drawImage(this.dark, 0, 0);
    g.globalCompositeOperation = 'lighter';
    const wg = g.createRadialGradient(lx, ly, 2, lx, ly, lr * 0.7); wg.addColorStop(0, 'rgba(255,170,70,0.22)'); wg.addColorStop(1, 'rgba(255,170,70,0)');
    g.fillStyle = wg; g.fillRect(0, 0, vw, H);
    g.globalCompositeOperation = 'source-over';

    g.save(); g.translate(ox, oy);
    if (bd) this.drawPlatforms(g, w);                                     // 발판: 어둠 위에 선명하게 (밟을 수 있는 면)
    if (w.props) this.drawProps(g, w);                                    // 쉼터 오브젝트 (상인 등)
    const hideChars = this.irisBusy() || (this.cine && this.cine.hideLira);
    if (!this.irisBusy()) for (const e of w.enemies) this.drawEnemy(g, w, e);
    this.drawWarnings(g, w);
    for (const gh of this.ghosts) { g.globalAlpha = gh.life / 12 * 0.45; this.drawLira(g, w, { ...p, x: gh.x, y: gh.y, face: gh.face, state: 'ghost' }); }
    g.globalAlpha = 1;
    g.translate(-ox, -oy); this.pfx.draw(g, camX, sx, sy); g.translate(ox, oy);   // 베기는 적 위·리라 뒤: 리라 몸을 덮지 않음
    if (!hideChars) this.drawLira(g, w, p);
    if (p.state === 'flask' && !hideChars) {                             // 기름병 마시는 중: 머리 위 초록 원이 차오름
      const k = Math.min(1, p.stateT / CFG.flask.useF), cx = p.x + p.w / 2, cy = p.y - 30;
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
    for (const q of this.parts) { g.fillStyle = q.col; g.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s); }
    if (this.debug) {
      g.strokeStyle = '#0f0'; for (const h of w.hitboxes) g.strokeRect(h.x + 0.5, h.y + 0.5, h.w, h.h);
      const ab = attackBox(p); if (ab) { g.strokeStyle = '#ff0'; g.strokeRect(ab.x + 0.5, ab.y + 0.5, ab.w, ab.h); }
    }
    g.restore();

    this.fx.draw(g, camX, sx, sy);

    // 떠오르는 글자
    g.textAlign = 'center'; g.font = 'bold 12px Galmuri11, monospace';
    for (const t of this.texts) {
      const L = t.life || 40, k = t.t / L, y = t.y + oy - (t.heal ? 22 : 14) * Math.min(1, t.t / 8) - k * (t.heal ? 14 : 6);
      g.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
      if (t.heal) g.font = 'bold 20px Galmuri11, monospace';
      g.fillStyle = t.heal ? '#0e2a14' : '#2a1204'; g.fillText(t.s, t.x + ox + 1, y + 1);
      g.fillStyle = t.heal ? '#8dffa0' : C.amberHi; g.fillText(t.s, t.x + ox, y);
      if (t.heal) g.font = 'bold 12px Galmuri11, monospace';
    }
    g.globalAlpha = 1; g.textAlign = 'left';
    g.restore();

    // 화면 번쩍: 완벽 패링은 흰색, 피격은 붉은색
    if (this.flash > 0.01) { g.fillStyle = `rgba(255,248,230,${this.flash * 0.22})`; g.fillRect(0, 0, vw, H); }   // 화면 섬광은 은은하게
    if (this.healFlash > 0.01) {                                          // 회복: 가장자리부터 초록빛
      const hg = g.createRadialGradient(vw / 2, H / 2, H * 0.35, vw / 2, H / 2, vw * 0.7);
      hg.addColorStop(0, 'rgba(80,230,120,0)'); hg.addColorStop(1, `rgba(80,230,120,${0.32 * this.healFlash})`);
      g.fillStyle = hg; g.fillRect(0, 0, vw, H);
    }
    if (this.flash < -0.01) { g.fillStyle = `rgba(255,40,60,${-this.flash * 0.35})`; g.fillRect(0, 0, vw, H); }
    if (this.hud !== false && !(this.cine && this.cine.t < CINE.out2)) this.drawHud(g, w);   // 등장 연출 중엔 HUD 숨김
    for (const [m, y] of [[this.banner, 96], [this.sayMsg, H - 70]]) {     // 스테이지 이름 배너 · 안내 한 줄
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
  drawLira(g, w, p) {
    if (p.state !== 'ghost' && p.iframes > 0 && (w.t >> 2) % 2 && p.state !== 'hurt') return;
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
      if (p.state === 'attack') lean = p.stateT < A.startupF ? -0.06 : p.stateT < A.startupF + A.activeF ? 0.14 : 0.06;
      else if (p.state === 'parry' && p.stateT < CFG.parry.normalF) lean = -0.08;
      else if (p.state === 'hurt') lean = -0.18;
      else if (p.state === 'run') lean = 0.06;
      const bob = p.state === 'run' ? Math.abs(Math.sin(w.t * 0.45)) * 2 : p.state === 'idle' ? Math.sin(w.t * 0.08) * 0.6 : 0;
      g.save(); g.translate(cx, feet - bob); g.rotate(lean * f); g.scale(sx * f, sy);
      const img = p.state === 'hurt' && (w.t >> 1) % 2 ? this.tinted('#ff3c50') : this.liraImg;
      g.drawImage(img, -43, -85);
      g.restore();
      this.drawParryArc(g, p, cx, feet, f);
      return;
    }
    g.save(); g.translate(cx, feet); g.scale(sx, sy); g.translate(-cx, -feet);
    const hurt = p.state === 'hurt';
    const run = p.state === 'run' ? Math.sin(w.t * 0.45) : 0;
    const crouch = p.state === 'attack' && p.stateT < CFG.attack.startupF ? 2 : 0;
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
    const r = this.region || 1;
    if (!this.bgs[r]) { this.bgs[r] = {}; for (const n of ['far', 'mid', 'ground']) { const im = new Image(); im.src = `assets/bg${r}-${n}.png`; this.bgs[r][n] = im; } }
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
    tile(B.far, 0.2, 0, 0.45);
    tile(B.mid, 0.55, 300 - B.mid.naturalHeight + 6, 0.25);
    camX = cam0;
    // 땅과 발판
    const G = B.ground, gw = G.naturalWidth, top = 14;   // 그림 14행 = 걷는 면
    g.save(); g.translate(Math.round(-camX) + sx, sy);
    for (const s of w.solids) {
      if (s.oneWay) continue;                       // 발판은 drawPlatforms에서 어둠 위에
      else if (s.h >= 40 && s.w > 100) {
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
    g.restore();
    return true;
  }

  // 쉼터 오브젝트: 상인 그림 + 따뜻한 빛, 가까이 가면 '공격 버튼으로 ○○' 안내, 출구 안내
  drawProps(g, w) {
    if (!this.merchantImg) { this.merchantImg = new Image(); this.merchantImg.src = 'assets/merchant.png'; }
    const near = nearProp(w);
    for (const o of w.props) {
      if (o.kind === 'merchant' && this.merchantImg.naturalWidth) {
        const im = this.merchantImg, gl = g.createRadialGradient(o.x - 20, 250, 4, o.x - 20, 250, 70);
        gl.addColorStop(0, 'rgba(255,170,70,0.28)'); gl.addColorStop(1, 'rgba(255,170,70,0)');
        g.fillStyle = gl; g.fillRect(o.x - 100, 170, 200, 140);
        g.drawImage(im, Math.round(o.x - im.naturalWidth / 2), 300 - im.naturalHeight);
      }
      if (o.kind === 'exit' && o.locked) {                               // 봉인된 문: 어두운 돌 아치 + 붉은 봉인 (적을 다 잡으면 포탈로 바뀜)
        const x = Math.round(o.x), pulse = 0.4 + 0.25 * Math.sin(w.t * 0.08);
        g.fillStyle = '#1a1620'; g.fillRect(x - 22, 236, 44, 64); g.fillStyle = '#2e2838'; g.fillRect(x - 26, 232, 52, 6); g.fillRect(x - 26, 238, 6, 62); g.fillRect(x + 20, 238, 6, 62);
        g.fillStyle = `rgba(255,79,94,${pulse})`; g.fillRect(x - 1, 248, 2, 40); g.fillRect(x - 12, 266, 24, 2); g.fillRect(x - 8, 256, 16, 1); g.fillRect(x - 8, 278, 16, 1);
      }
      const label = o.kind === 'merchant' ? '상점 열기' : o.kind === 'campfire' ? (o.used ? '불씨가 잦아들었다' : '쉬기')
        : o.kind === 'brazier' ? (o.cd > 0 ? `화로 재충전 ${Math.ceil(o.cd / 60)}초` : '공격해서 화로 점화 → 보스에게 불기둥')
        : o.locked ? '적을 모두 쓰러뜨리면 열린다' : '다음 길 →';
      const pcx = w.player.x + w.player.w / 2;
      const show = o.kind === 'exit' ? pcx > o.x - 260 : o.kind === 'brazier' ? Math.abs(o.x - pcx) < 90 : o === near;
      if (!show) continue;
      const y = o.kind === 'merchant' ? 188 : o.kind === 'campfire' ? 196 : o.kind === 'brazier' ? 186 : 214, txt = o.kind === 'exit' || o.kind === 'brazier' || o.used ? label : `공격 버튼  ${label}`;
      g.font = '10px Galmuri9, monospace'; g.textBaseline = 'middle'; g.textAlign = 'center';
      const tw = g.measureText(txt).width + 14, bob = Math.round(Math.sin(w.t * 0.1) * 2), lx = Math.max(tw / 2 + 4, Math.min(w.width - tw / 2 - 4, o.x));   // 벽 가까이선 화면 안으로
      g.fillStyle = 'rgba(13,10,17,.8)'; g.fillRect(Math.round(lx - tw / 2), y - 8 + bob, Math.round(tw), 16);
      g.fillStyle = '#ffb347'; g.fillRect(Math.round(lx - tw / 2), y + 7 + bob, Math.round(tw), 1);
      g.fillStyle = '#ffe2a8'; g.fillText(txt, lx, y + bob);
      g.textAlign = 'left'; g.textBaseline = 'top';
    }
  }
  say(s) { this.sayMsg = { s, t: 150 }; }
  // 회복 연출: 큰 초록 '+N', 화면 가장자리 초록빛, 체력 바의 새로 찬 칸이 반짝임 (몸을 타고 오르는 빛은 fxmap의 holy/heal)
  healFx(p, amount, from = p.hp - amount) {
    this.texts.push({ x: p.x + p.w / 2, y: p.y - 18, t: 0, s: amount > 0 ? `+${amount}` : '체력 가득', heal: true, life: 70 });
    this.healFlash = 1; this.hpGain = { from: Math.max(0, from), to: p.hp, t: 70 };
    this.burst(p.x + p.w / 2, p.y + 30, 10, ['#7fe08a', '#d8ffd8', '#3fae5a'], 1.6);
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
    const G = this.bgs[this.region || 1]?.ground; if (!G || !G.naturalWidth) return;
    const gw = G.naturalWidth, top = 14, th = 22;
    for (const s of w.solids) {
      if (!s.oneWay) continue;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(s.x + 3, s.y + th - top + 1, s.w - 6, 4);           // 그림자
      for (let x = s.x; x < s.x + s.w; x += gw) { const ww = Math.min(gw, s.x + s.w - x); g.drawImage(G, 0, 0, ww, th, x, s.y - top, ww, th); }
      g.fillStyle = 'rgba(8,6,14,0.25)'; g.fillRect(s.x, s.y + 3, s.w, th - top - 3);               // 옆면은 살짝 어둡게
      g.fillStyle = '#e8dcc0'; g.globalAlpha = 0.75; g.fillRect(s.x + 1, s.y, s.w - 2, 1);          // 윗면 테두리
      g.globalAlpha = 0.35; g.fillRect(s.x + 1, s.y + 1, s.w - 2, 1); g.globalAlpha = 1;
      g.fillStyle = '#120e16'; g.fillRect(s.x, s.y - 1, 1, th - top + 2); g.fillRect(s.x + s.w - 1, s.y - 1, 1, th - top + 2);   // 양 끝 윤곽
    }
  }

  // 공격 예고 표시: 광선 예고선 · 고리 원 · 낙하 파편 위치 (패링 불가는 붉게)
  drawWarnings(g, w) {
    const blink = (w.t >> 2) & 1;
    for (const e of w.enemies) {
      if (e.st !== 'telegraph' || !e.atk) continue;
      const a = ENEMY_DEFS[e.kind].attacks[e.atk];
      if (a.beam) { g.fillStyle = blink ? 'rgba(255,79,94,0.5)' : 'rgba(255,79,94,0.2)'; g.fillRect(e.face > 0 ? e.x + e.w : e.x - a.beam.len, e.y + a.beam.y + a.beam.h / 2 - 1, a.beam.len, 3); }
      if (a.ring) { g.strokeStyle = blink ? 'rgba(255,79,94,0.8)' : 'rgba(255,79,94,0.35)'; g.lineWidth = 2; g.beginPath(); g.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2 + a.ring, e.h / 2 + 10, 0, 0, Math.PI * 2); g.stroke(); g.lineWidth = 1; }
    }
    for (const b of w.projectiles) if (b.shard && b.y < 0) {          // 떨어질 자리 표시
      g.fillStyle = blink ? C.white : 'rgba(255,255,255,0.4)'; g.fillRect(b.x + b.w / 2 - 1, 6, 3, 10); g.fillRect(b.x + b.w / 2 - 1, 20, 3, 3);
    }
    for (const e of w.enemies) if (e.st === 'active' && e.atk) {
      const a = ENEMY_DEFS[e.kind].attacks[e.atk];
      if (a.beam) { g.fillStyle = 'rgba(220,200,255,0.85)'; g.fillRect(e.face > 0 ? e.x + e.w : e.x - a.beam.len, e.y + a.beam.y, a.beam.len, a.beam.h); g.fillStyle = '#fff'; g.fillRect(e.face > 0 ? e.x + e.w : e.x - a.beam.len, e.y + a.beam.y + 8, a.beam.len, 5); }
      if (a.ring) { g.fillStyle = e.kind === 'shadow' ? 'rgba(120,40,170,0.55)' : 'rgba(200,170,255,0.5)'; g.beginPath(); g.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2 + a.ring, e.h / 2 + 10, 0, 0, Math.PI * 2); g.fill(); }
    }
  }

  // pixelfx actor: 상태 이펙트가 감쌀 실루엣 (서 있는 프레임 기준, 발이 원점)
  actorOf(ent) {
    if (ent === this.lastW?.player || ent.relics) {
      const f = this.anims?.idle?.[0];
      return f && f.img.naturalWidth ? actorFromImage(f.img, f.ax, f.ay) : actorFromImage(this.liraImg, 43, 85);
    }
    const f = this.enemyFrame({ t: 0 }, { kind: ent.kind, st: 'idle', vx: 0, x: 0 }, ENEMY_DEFS[ent.kind]);
    return f ? actorFromImage(f.img, f.ax, f.ay) : undefined;
  }
  // 적 그림 (Higgsfield → 픽셀 격자). 원본은 왼쪽을 봄
  enemyFrame(w, e, d) {
    const EA = this.enemyAnims && this.enemyAnims[e.kind];
    if (EA && EA.walk && EA.attack) {                       // 8프레임 애니메이션: 걷기는 이동 거리에 맞춰, 공격은 예고→판정→후딜에 맞춰
      const a = e.atk && d.attacks[e.atk], span = (lo, hi, k) => Math.min(hi, lo + Math.floor(Math.max(0, k) * (hi - lo + 1)));
      let list = EA.walk, i;
      if (e.st === 'telegraph' && a) { list = EA.attack; i = span(0, 3, e.stT / telegraphOf(e, a)); }
      else if (e.st === 'active' && a) { list = EA.attack; i = span(4, 5, e.stT / Math.max(1, (a.hits || 1) > 1 ? a.gapF : a.activeF)); }
      else if (e.st === 'recover' && a) { list = EA.attack; i = span(6, 7, e.stT / recoverOf(a)); }
      else if (e.kind === 'moth') i = ((w.t / 4) | 0) % 8;
      else i = Math.abs(e.vx) > 0.1 ? Math.floor(Math.abs(e.x) * (e.boss ? 0.06 : 0.11)) % 8 : 0;
      const f = list[i]; if (f && f.img.complete && f.img.naturalWidth) { f.anim = true; return f; }
    }
    const S = this.enemySprites; if (!S || !S[e.kind]) return null;
    const F = S[e.kind]; let n;
    if (e.kind === 'moth') n = e.st === 'active' ? 'down' : e.st === 'telegraph' ? 'up' : (w.t >> 2) & 1 ? 'up' : 'down';
    else if (e.st === 'telegraph') n = F.wind ? 'wind' : 'idle';
    else if (e.st === 'active' || (e.st === 'recover' && e.stT < 12)) n = F.slash ? 'slash' : 'strike';
    else n = 'idle';
    const f = F[n] || F.idle; return f && f.img.complete && f.img.naturalWidth ? f : null;
  }

  drawEnemySprite(g, w, e, d, f, k) {
    const a = e.atk && d && d.attacks[e.atk];
    let img = f.img;
    const hitFlash = e.flash > 3;
    if (hitFlash) { /* 아래에서 원래 그림 위에 반투명 흰색을 덧칠 */ }
    let over = null;                                       // 예고 깜빡임: 통째로 바꾸지 않고 반투명 덧칠 (눈부심 방지)
    if (e.st === 'telegraph' && a && ((w.t >> (telegraphOf(e, a) - e.stT < 10 ? 1 : 2)) & 1)) over = a.parryable ? '#ffffff' : '#ff4f5e';
    else if (e.staggerT > 0 && (w.t >> 2) & 1) img = this.tinted('#9aa0ad', img);
    const cx = Math.round(e.x + e.w / 2), base = e.kind === 'moth' ? Math.round(e.y + e.h / 2) : Math.round(e.y + e.h);
    const big = e.boss ? 0.5 : 1;                          // 큰 몸은 덜 흔들리고 묵직하게
    let ox = 0, oy = 0, rot = 0, sy = 1;
    if (f.anim) {                                          // 애니메이션이 동작을 담고 있으니 예고 막판 떨림만
      if (e.st === 'telegraph' && a && e.stT / telegraphOf(e, a) > 0.65) ox = (w.t & 2 ? 1 : -1);
    } else if (e.kind === 'moth') oy = Math.sin(w.t * 0.25 + e.x * 0.05) * 2;
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
    g.drawImage(img, -f.ax, -f.ay);
    this.applyLight(g, f.img, f.ax, f.ay, e.x + e.w / 2, e.y + e.h / 2, e.face > 0);
    if (hitFlash) { g.globalAlpha = e.flash > 5 ? 0.55 : 0.3; g.drawImage(this.tinted('#ffffff', f.img), -f.ax, -f.ay); g.globalAlpha = 1; }
    else if (over) { g.globalAlpha = over === '#ffffff' ? 0.4 : 0.5; g.drawImage(this.tinted(over, f.img), -f.ax, -f.ay); g.globalAlpha = 1; }
    g.restore();
  }

  // 상태 → 애니메이션 프레임. 공격은 칼이 앞으로 나가는 프레임(3)이 판정 시작과 맞물리게
  pickAnim(w, p) {
    const A = this.anims; if (!A) return null;
    const C2 = CFG.attack, t = p.stateT;
    const span = (lo, hi, k) => Math.min(hi, lo + Math.floor(k * (hi - lo + 1)));   // k∈[0,1) → lo..hi
    let n = 'idle', i = ((w.t / 7) | 0) % 8;
    switch (p.state) {
      case 'run': n = 'run'; i = ((w.t / 5) | 0) % 8; break;
      case 'jump': n = 'jump'; i = p.vy < -2.5 ? 3 : p.vy < 1.5 ? 5 : 7; break;
      case 'attack': {
        n = ['atk1', 'atk2', 'atk3'][p.combo] || 'atk1';
        const s0 = C2.startupF, s1 = s0 + C2.activeF, end = s1 + C2.recoveryF;
        i = t < s0 ? span(0, 2, t / s0) : t < s1 ? span(3, 4, (t - s0) / C2.activeF) : span(5, 7, (t - s1) / (end - s1));
        break;
      }
      case 'parry': {
        n = 'parry'; const W = CFG.parry.normalF;
        i = t < 2 ? 2 : t < W ? (t < W / 2 ? 3 : 4) : span(5, 7, (t - W) / CFG.parry.whiffF);
        break;
      }
      case 'execute': {                                                    // 처형: 3타 자세로 크게 베기 (느린 웅크림 → 베기 → 여운)
        const X = CFG.execute; n = 'atk3';
        i = t < X.hitF ? span(0, 2, t / X.hitF) : t < X.hitF + 5 ? (t < X.hitF + 2 ? 3 : 4) : span(5, 7, (t - X.hitF - 5) / (X.totalF - X.hitF - 5));
        break;
      }
      case 'cast': n = 'parry'; i = t < 3 ? 2 : t < CFG.skill[p.spell].castF - 4 ? 4 : 6; break;   // 등불을 앞으로 내밀어 시전
      case 'roll': case 'ghost': n = 'roll'; i = span(0, 7, (p.stateT || 0) / (CFG.roll.totalF + CFG.roll.endLagF)); break;
      case 'hurt': n = 'hurt'; i = span(0, 5, t / CFG.player.hurtStunF); break;
      case 'dead': n = 'hurt'; i = 1; break;
    }
    const f = A[n] && A[n][i];
    return f && f.img.complete && f.img.naturalWidth ? f : (A.idle && A.idle[0].img.complete ? A.idle[0] : null);
  }

  drawAnim(g, w, p, fr, cx, feet, f) {
    const sq = this.squash, sy = 1 - sq * 0.15, sx = 1 + sq * 0.12;
    const img = p.state === 'hurt' && (w.t >> 1) % 2 ? this.tinted('#ff3c50', fr.img) : fr.img;
    g.save(); g.translate(cx, feet); g.scale(sx * f, sy);
    g.drawImage(img, -fr.ax, -fr.ay);
    if (p.state !== 'ghost') this.applyLight(g, fr.img, fr.ax, fr.ay, cx, feet - 40, false, true);   // 손에 든 등불: 앞쪽 림, 등쪽 그림자
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
    const W = im.naturalWidth, H = im.naturalHeight; if (!W) return null;
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
    const perfect = p.stateT < CFG.parry.perfectF;
    g.strokeStyle = perfect ? C.amberHi : 'rgba(255,179,71,0.5)'; g.lineWidth = perfect ? 2 : 1;
    g.beginPath(); g.arc(cx, feet - 30, 34, f > 0 ? -1.1 : Math.PI - 1.1, f > 0 ? 1.1 : Math.PI + 1.1); g.stroke(); g.lineWidth = 1;
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
      g.fillStyle = (G.t >> 2) & 1 ? '#d8ffd8' : '#5fe07a'; g.fillRect(x0, hy, Math.max(0, x1 - x0), 7);
      g.strokeStyle = '#8dffa0'; g.lineWidth = 1; g.strokeRect(hx - 1.5, hy - 1.5, hw + 3, 10);
    }
    g.fillStyle = '#120e16'; for (let i = 1; i < p.maxHp; i++) g.fillRect(hx + i * 11, hy, 1, 7);
    // 빛 게이지: 랜턴 + 4칸 눈금. 가득 차면 깜빡임
    const full = p.light >= CFG.light.max, k = Math.min(1, p.light / CFG.light.max), gx = 22, gy = 25, gw = 64;
    g.drawImage(I('parry', 'amber'), 7, 21);
    g.fillStyle = '#120e16'; g.fillRect(gx - 1, gy - 1, gw + 2, 7); g.fillStyle = '#2e2537'; g.fillRect(gx, gy, gw, 5);
    // 빛 = 마법 기름. 눈금은 등불 탄·큰 마법 비용 자리, 쓸 수 있는 만큼 밝게
    const costs = (p.spells || []).filter(Boolean).map(s => Math.round(CFG.skill[s].cost * (p.mods.costMul || 1))), c1 = Math.min(...costs, 999), c2 = Math.max(...costs, 0);
    g.fillStyle = p.light >= c2 ? ((w.t >> 3) & 1 ? '#fff0c8' : '#ffb347') : p.light >= c1 ? '#e08a2a' : '#8c4a14'; g.fillRect(gx, gy, Math.round(gw * k), 5);
    g.fillStyle = '#ffd27a'; g.fillRect(gx, gy, Math.round(gw * k), 1);
    for (const c of costs) { const mx = gx + Math.round(gw * c / CFG.light.max); g.fillStyle = p.light >= c ? '#fff0c8' : '#4a3e57'; g.fillRect(mx, gy - 2, 1, 9); }
    for (let i = 0; i < Math.max(p.maxFlasks, p.flasks); i++) { g.globalAlpha = i < p.flasks ? 1 : 0.25; g.drawImage(I('flask', 'heal'), gx + gw + 3 + i * 9, gy - 4, 9, 9); }
    g.globalAlpha = 1;
    // 완벽 패링 수: 늘어나는 순간 잠깐 밝게
    if (p.perfectParries !== this.ppSeen) { this.ppSeen = p.perfectParries; this.ppT = 30; }
    if (this.ppT > 0) this.ppT--;
    g.fillStyle = this.ppT > 0 ? '#fff0c8' : '#b89a6a'; g.fillText('완벽 패링 ' + p.perfectParries + (p.chainN ? '  연쇄 ×' + p.chainN : ''), 8, 33);
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
    } else this.bossShadow = 1;
    g.restore();
  }
}
