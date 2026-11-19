// 렌더러: world를 읽기만 한다. 리라 임시 실루엣 + 적 상자 + pixelfx 이펙트 + 화면 연출
import { CFG } from './core/config.js';
import { attackBox } from './core/player.js';
import { ENEMY_DEFS, telegraphOf } from './core/enemies.js';
import { FxLayer } from './fx.js';

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
    this.fx = new FxLayer();
    this.parts = []; this.texts = [];
    this.ghosts = [];             // 회피 잔상
    this.tail = null;             // 포니테일 스프링
    this.lantern = { a: 0, v: 0 };
    this.squash = 0; this.flash = 0; this.zoom = 0; this.stunFx = new Map();
    this.debug = /debug=1/.test(location.search);
    // 리라 픽셀 그림 (Higgsfield: 리라 디자인 + 사용자 샘플 화풍 → forge pixel_look로 픽셀 격자 맞춤). 기준점: 발 중앙 (43, 85)
    this.liraImg = new Image(); this.liraImg.src = 'assets/lira.png';
    // 동작 포즈 (Higgsfield 포즈 생성 → 기준 리라 격자로 읽음). 모두 132x111, 발 기준점 (69, 111)
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
    this.fx.resize(this.vw, H);
    this.cv.style.width = Math.round(this.vw * s) + 'px';
    this.cv.style.height = Math.round(H * s) + 'px';
    this.ctx.imageSmoothingEnabled = false;
  }

  reset() { this.fx.clear(); this.parts = []; this.texts = []; this.ghosts = []; this.tail = null; this.stunFx.clear(); }

  // 이번 틱 이벤트 → 이펙트
  spawnFx(w) {
    const p = w.player, feet = p.y + p.h;
    if (p.state === 'attack' && p.stateT === CFG.attack.startupF - 1) {
      const c = p.combo;
      this.fx.spawn('slash', p.x + p.w / 2 - p.face * 4, feet, { flip: p.face < 0, radius: [34, 36, 44][c], angle: [0, -0.35, 0.2][c] * p.face });
    }
    for (const ev of w.events) {
      if (ev.type === 'parry') {
        if (ev.perfect) {
          this.fx.spawn('parry', ev.x, feet, {});
          this.flash = 1; this.zoom = 1;
          this.texts.push({ x: ev.x, y: p.y - 6, t: 0, s: '완벽!' });
        } else this.fx.spawn('hit', ev.x, feet, { height: feet - ev.y, flip: p.face > 0, palette: ['#4a2a0c', '#8c5a14', '#d09a1e', '#ffc63a', '#ffe27a', '#fff6c8', '#ffffff'] });
      } else if (ev.type === 'attackHit') {
        const e = { x: ev.x, y: ev.y };
        if (ev.combo === 2) this.fx.spawn('crit', e.x, ev.y + 20, { flip: ev.face < 0 });
        else this.fx.spawn('hit', e.x, ev.y + 20, { height: 20, flip: ev.face < 0 });
        this.burst(ev.x, ev.y, 4, ['#ffffff', C.amberHi], 2);
      } else if (ev.type === 'execute') {
        this.fx.spawn('crit', ev.x, ev.y + 30, {}); this.flash = 0.7;
        this.texts.push({ x: ev.x, y: ev.y - 40, t: 0, s: '처형!' });
      } else if (ev.type === 'hurt') { this.burst(ev.x, ev.y, 12, [C.red, '#ffffff'], 2.5); this.flash = -0.5; }
      else if (ev.type === 'kill') this.fx.spawn('poof', ev.x, ev.y + 16, {});
      else if (ev.type === 'ultStart') this.fx.spawn('fireRing', p.x + p.w / 2, feet, { life: 80 });
      else if (ev.type === 'slam') { const b = w.enemies.find(e => e.boss); if (b) this.fx.spawn('slam', b.x + b.w / 2, b.y + b.h, { light: 0.6, life: 70 }); }
      else if (ev.type === 'land') {
        this.squash = Math.min(1, ev.v / 7);
        if (ev.v > 3) { this.dust(ev.x - 4, ev.y, -1, 5); this.dust(ev.x + 4, ev.y, 1, 5); }
      }
    }
    // 달리기 먼지
    if (p.state === 'run' && w.t % 9 === 0) this.dust(p.x + p.w / 2 - p.face * 5, feet, -p.face, 2);
    // 회피 잔상
    if (p.state === 'roll' && p.stateT < CFG.roll.totalF && p.stateT % 3 === 0) this.ghosts.push({ x: p.x, y: p.y, face: p.face, life: 12 });
    // 보스 그로기 별
    for (const e of w.enemies) {
      const has = this.stunFx.get(e);
      if (e.stunT > 0 && !has) this.stunFx.set(e, this.fx.spawn('stunned', e.x + e.w / 2, e.y - 2, {}));
      if (has) { has.options.x = Math.round(e.x + e.w / 2); has.options.y = Math.round(e.y - 2); if (e.stunT <= 0 || e.dead) { has.stop(); this.stunFx.delete(e); } }
    }
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
    if (!frozen) this.fx.update(1 / CFG.TICK);
    for (const p of this.parts) { p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= 0.92; p.life--; }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const g of this.ghosts) g.life--;
    this.ghosts = this.ghosts.filter(g => g.life > 0);
    for (const t of this.texts) t.t++;
    this.texts = this.texts.filter(t => t.t < 40);
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
    const camX = Math.max(0, Math.min(w.width - vw, p.x + p.w / 2 - vw * 0.4));
    const sh = w.shake > 0 ? Math.min(5, w.shake / 2) : 0;
    const sx = Math.round((Math.random() - 0.5) * 2 * sh), sy = Math.round((Math.random() - 0.5) * 2 * sh);
    const ox = Math.round(-camX) + sx, oy = sy;

    g.save();
    // 완벽 패링 줌인: 리라를 중심으로 살짝 당김
    if (this.zoom > 0.02) {
      const z = 1 + this.zoom * 0.07, cx = p.x + p.w / 2 + ox, cy = p.y + 20 + oy;
      g.translate(cx, cy); g.scale(z, z); g.translate(-cx, -cy);
    }

    const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, C.bg1); grd.addColorStop(1, C.bg0);
    g.fillStyle = grd; g.fillRect(-20, -20, vw + 40, H + 40);
    g.fillStyle = C.pillar;
    for (let i = -1; i < 12; i++) { const x = Math.round(i * 140 - (camX * 0.4) % 140); g.fillRect(x, 40, 36, 260); }

    g.save(); g.translate(ox, oy);
    g.fillStyle = C.ground; for (const s of w.solids) g.fillRect(s.x, s.y, s.w, s.h);
    g.fillStyle = C.groundTop; for (const s of w.solids) g.fillRect(s.x, s.y, s.w, 2);
    g.restore();

    // 어둠: 리라 랜턴 주변만 밝다 (적·예고·탄은 이 위에 그려서 절대 가려지지 않음)
    const d = this.dctx;
    d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, vw, H);
    d.fillStyle = 'rgba(4,2,8,0.62)'; d.fillRect(0, 0, vw, H);
    d.globalCompositeOperation = 'destination-out';
    const lx = p.x + p.w / 2 + ox + p.face * 8, ly = p.y + 18 + oy, lr = 110 + p.light * 0.9;
    const lg = d.createRadialGradient(lx, ly, 10, lx, ly, lr); lg.addColorStop(0, 'rgba(0,0,0,1)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = lg; d.fillRect(0, 0, vw, H);
    g.drawImage(this.dark, 0, 0);
    g.globalCompositeOperation = 'lighter';
    const wg = g.createRadialGradient(lx, ly, 2, lx, ly, lr * 0.7); wg.addColorStop(0, 'rgba(255,170,70,0.22)'); wg.addColorStop(1, 'rgba(255,170,70,0)');
    g.fillStyle = wg; g.fillRect(0, 0, vw, H);
    g.globalCompositeOperation = 'source-over';

    g.save(); g.translate(ox, oy);
    for (const e of w.enemies) this.drawEnemy(g, w, e);
    for (const gh of this.ghosts) { g.globalAlpha = gh.life / 12 * 0.45; this.drawLira(g, w, { ...p, x: gh.x, y: gh.y, face: gh.face, state: 'ghost' }); }
    g.globalAlpha = 1;
    this.drawLira(g, w, p);
    for (const b of w.projectiles) {
      g.fillStyle = b.owner === 'player' ? C.amberHi : b.parryable ? C.white : C.red;
      g.fillRect(Math.round(b.x), Math.round(b.y), b.w, b.h);
      if (!b.parryable && b.owner === 'enemy') { g.strokeStyle = C.white; g.strokeRect(Math.round(b.x) + 0.5, Math.round(b.y) + 0.5, b.w - 1, b.h - 1); }
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
      const k = t.t / 40, y = t.y + oy - 14 * Math.min(1, t.t / 8) - k * 6;
      g.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
      g.fillStyle = '#2a1204'; g.fillText(t.s, t.x + ox + 1, y + 1);
      g.fillStyle = C.amberHi; g.fillText(t.s, t.x + ox, y);
    }
    g.globalAlpha = 1; g.textAlign = 'left';
    g.restore();

    // 화면 번쩍: 완벽 패링은 흰색, 피격은 붉은색
    if (this.flash > 0.01) { g.fillStyle = `rgba(255,248,230,${this.flash * 0.45})`; g.fillRect(0, 0, vw, H); }
    if (this.flash < -0.01) { g.fillStyle = `rgba(255,40,60,${-this.flash * 0.35})`; g.fillRect(0, 0, vw, H); }
    this.drawHud(g, w);
  }

  // 리라 임시 실루엣 (진짜 그림은 Higgsfield 단계에서 교체)
  drawLira(g, w, p) {
    if (p.state !== 'ghost' && p.iframes > 0 && (w.t >> 2) % 2 && p.state !== 'hurt') return;
    const f = p.face, cx = Math.round(p.x + p.w / 2), feet = Math.round(p.y + p.h);
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

  // 적 그림 (Higgsfield → 픽셀 격자). 원본은 왼쪽을 봄
  enemyFrame(w, e, d) {
    const S = this.enemySprites; if (!S || !S[e.kind]) return null;
    const F = S[e.kind]; let n;
    if (e.kind === 'moth') n = e.st === 'active' ? 'down' : e.st === 'telegraph' ? 'up' : (w.t >> 2) & 1 ? 'up' : 'down';
    else if (e.st === 'telegraph') n = 'wind';
    else if (e.st === 'active' || (e.st === 'recover' && e.stT < 12)) n = e.kind === 'ghoul' ? 'slash' : 'strike';
    else n = 'idle';
    const f = F[n]; return f && f.img.complete && f.img.naturalWidth ? f : null;
  }

  drawEnemySprite(g, w, e, d, f, k) {
    const a = e.atk && d && d.attacks[e.atk];
    let img = f.img;
    if (e.flash > 3) img = this.tinted('#ffffff', img);
    else if (e.st === 'telegraph' && a && ((w.t >> (telegraphOf(e, a) - e.stT < 10 ? 1 : 2)) & 1)) img = this.tinted(a.parryable ? '#ffffff' : '#ff4f5e', img);
    else if (e.staggerT > 0 && (w.t >> 2) & 1) img = this.tinted('#9aa0ad', img);
    const cx = Math.round(e.x + e.w / 2), base = e.kind === 'moth' ? Math.round(e.y + e.h / 2) : Math.round(e.y + e.h);
    g.save(); g.translate(cx, base); g.scale((e.face > 0 ? -1 : 1) * (1 + k * 0.15), 1 - k * 0.1);
    g.drawImage(img, -f.ax, -f.ay);
    g.restore();
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
        // 1타·3타: 치켜듦 → 휘두르는 중 → 앞으로 / 2타: 반대 순서(올려베기)
        const seq = p.combo === 1 ? ['atk2', 'atkmid', 'atk1'] : ['atk1', 'atkmid', 'atk2'];
        n = seq[t < A.startupF - 1 ? 0 : t < A.startupF + 1 ? 1 : 2]; break;
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
      if (!a.parryable) { g.fillStyle = 'rgba(255,79,94,0.25)'; g.fillRect(x - 3, y - 3, ew + 6, eh + 6); }
      g.lineWidth = 1;
      g.fillStyle = col; g.fillRect(Math.round(e.x + e.w / 2) - 1, e.y - 12, 3, 7); g.fillRect(Math.round(e.x + e.w / 2) - 1, e.y - 4, 3, 2);
    }
    if (e.st === 'active') for (const h of w.hitboxes) if (h.owner === e) {
      g.fillStyle = h.parryable ? 'rgba(255,255,255,0.35)' : 'rgba(255,79,94,0.45)'; g.fillRect(h.x, h.y, h.w, h.h);
    }
    if (!e.boss && e.hp < e.maxHp) { g.fillStyle = '#000'; g.fillRect(Math.round(e.x), Math.round(e.y) - 5, e.w, 2); g.fillStyle = C.red; g.fillRect(Math.round(e.x), Math.round(e.y) - 5, Math.round(e.w * e.hp / e.maxHp), 2); }
  }

  drawHud(g, w) {
    const p = w.player;
    for (let i = 0; i < CFG.player.hp; i++) { g.fillStyle = i < p.hp ? C.red : '#3a2a34'; g.fillRect(10 + i * 13, 10, 10, 10); }
    g.fillStyle = '#2a2230'; g.fillRect(10, 25, 80, 6);
    g.fillStyle = p.light >= CFG.light.max && (w.t >> 3) % 2 ? C.amberHi : C.amber; g.fillRect(10, 25, Math.round(80 * p.light / CFG.light.max), 6);
    for (let i = 0; i < CFG.flask.charges; i++) { g.fillStyle = i < p.flasks ? '#7fe08a' : '#2a3a2c'; g.fillRect(96 + i * 8, 25, 5, 6); }
    g.fillStyle = C.amberHi; g.font = '10px Galmuri9, monospace'; g.textBaseline = 'top';
    g.fillText('완벽 패링 ' + p.perfectParries, 10, 36);
    const boss = w.enemies.find(e => e.boss);
    if (boss) {
      const bw = Math.min(360, this.vw - 80), bx = Math.round((this.vw - bw) / 2), by = CFG.VIEW_H - 26;
      g.fillStyle = C.white; g.fillText('무덤종', bx, by - 12);
      g.fillStyle = '#2a2230'; g.fillRect(bx, by, bw, 6); g.fillStyle = C.red; g.fillRect(bx, by, Math.round(bw * boss.hp / boss.maxHp), 6);
      g.fillStyle = '#2a2230'; g.fillRect(bx, by + 8, bw, 3); g.fillStyle = boss.stunT > 0 ? C.white : C.yellow; g.fillRect(bx, by + 8, Math.round(bw * (boss.stunT > 0 ? 1 : boss.poise)), 3);
    }
  }
}
