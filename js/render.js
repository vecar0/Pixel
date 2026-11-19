// 회색 상자 렌더러: world를 읽기만 한다
import { CFG } from './core/config.js';
import { attackBox } from './core/player.js';
import { ENEMY_DEFS, telegraphOf } from './core/enemies.js';

const C = {
  bg0: '#0b0910', bg1: '#15111d', pillar: '#1d1826', ground: '#2a2433', groundTop: '#4a4058',
  lira: '#ece6f4', amber: '#ffb347', amberHi: '#ffe0a0', red: '#ff4f5e', sky: '#7fd4ff', yellow: '#ffe45c',
  ghoul: '#6d7380', moth: '#a39673', boss: '#5a6370', white: '#ffffff', ink: '#0b0910',
};
const MAX_PARTICLES = 400;

export class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.dark = document.createElement('canvas'); this.dctx = this.dark.getContext('2d');
    this.parts = []; this.rings = [];
    this.debug = /debug=1/.test(location.search);
    this.resize();
  }

  resize() {
    const H = CFG.VIEW_H, ih = innerHeight, iw = innerWidth;
    let s = ih / H; if (s >= 2) s = Math.floor(s);
    this.vw = Math.min(CFG.VIEW_W_MAX, Math.max(CFG.VIEW_W, Math.floor(iw / s)));
    this.cv.width = this.vw; this.cv.height = H;
    this.dark.width = this.vw; this.dark.height = H;
    this.cv.style.width = Math.round(this.vw * s) + 'px';
    this.cv.style.height = Math.round(H * s) + 'px';
    this.ctx.imageSmoothingEnabled = false;
  }

  // 이번 틱 이벤트 → 파티클
  spawnFx(w) {
    for (const ev of w.events) {
      if (ev.type === 'parry') {
        this.rings.push({ x: ev.x, y: ev.y, r: 4, max: ev.perfect ? 46 : 22, life: ev.perfect ? 16 : 9, col: ev.perfect ? C.amberHi : C.amber });
        this.burst(ev.x, ev.y, ev.perfect ? 22 : 8, ev.perfect ? [C.amberHi, C.amber, C.white] : [C.amber], ev.perfect ? 4 : 2.5);
      } else if (ev.type === 'attackHit') this.burst(ev.x, ev.y, 6, [C.white, C.yellow], 2);
      else if (ev.type === 'execute') { this.burst(ev.x, ev.y, 30, [C.amberHi, C.red, C.white], 5); this.rings.push({ x: ev.x, y: ev.y, r: 6, max: 70, life: 20, col: C.red }); }
      else if (ev.type === 'hurt') this.burst(ev.x, ev.y, 10, [C.red], 2.5);
      else if (ev.type === 'kill') this.burst(ev.x, ev.y, 16, ['#8a8494', '#5a5466', C.amber], 3);
      else if (ev.type === 'ultStart') { const p = w.player; this.rings.push({ x: p.x + p.w / 2, y: p.y + 20, r: 10, max: CFG.ult.radius, life: 24, col: C.amber }); }
      else if (ev.type === 'stun') this.rings.push({ x: ev.x, y: ev.y, r: 4, max: 30, life: 14, col: C.yellow });
    }
  }
  burst(x, y, n, cols, sp) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= MAX_PARTICLES) this.parts.shift();
      const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random());
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 14 + Math.random() * 14, col: cols[i % cols.length] });
    }
  }
  stepFx() {
    for (const p of this.parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.vx *= 0.94; p.life--; }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const r of this.rings) { r.r += (r.max - r.r) * 0.3; r.life--; }
    this.rings = this.rings.filter(r => r.life > 0);
  }

  draw(w) {
    const g = this.ctx, H = CFG.VIEW_H, vw = this.vw;
    const camX = Math.max(0, Math.min(w.width - vw, w.player.x + w.player.w / 2 - vw * 0.4));
    const sh = w.shake > 0 ? Math.min(4, w.shake / 2) : 0;
    const ox = Math.round(-camX + (Math.random() - 0.5) * 2 * sh), oy = Math.round((Math.random() - 0.5) * 2 * sh);

    // 배경 + 패럴랙스 기둥
    const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, C.bg1); grd.addColorStop(1, C.bg0);
    g.fillStyle = grd; g.fillRect(0, 0, vw, H);
    g.fillStyle = C.pillar;
    for (let i = -1; i < 12; i++) { const x = Math.round(i * 140 - (camX * 0.4) % 140); g.fillRect(x, 40, 36, 260); }

    g.save(); g.translate(ox, oy);
    g.fillStyle = C.ground;
    for (const s of w.solids) { g.fillRect(s.x, s.y, s.w, s.h); }
    g.fillStyle = C.groundTop;
    for (const s of w.solids) g.fillRect(s.x, s.y, s.w, 2);
    g.restore();

    // 어둠: 리라 랜턴 주변만 밝다 (적·예고·탄은 이 위에 그려서 절대 가려지지 않음)
    const d = this.dctx, p = w.player;
    d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, vw, H);
    d.fillStyle = 'rgba(4,2,8,0.62)'; d.fillRect(0, 0, vw, H);
    d.globalCompositeOperation = 'destination-out';
    const lx = p.x + p.w / 2 + ox + p.face * 8, ly = p.y + 18 + oy, lr = 110 + p.light * 0.9;
    const lg = d.createRadialGradient(lx, ly, 10, lx, ly, lr); lg.addColorStop(0, 'rgba(0,0,0,1)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = lg; d.fillRect(0, 0, vw, H);
    g.drawImage(this.dark, 0, 0);
    // 따뜻한 랜턴 빛
    g.globalCompositeOperation = 'lighter';
    const wg = g.createRadialGradient(lx, ly, 2, lx, ly, lr * 0.7); wg.addColorStop(0, 'rgba(255,170,70,0.22)'); wg.addColorStop(1, 'rgba(255,170,70,0)');
    g.fillStyle = wg; g.fillRect(0, 0, vw, H);
    g.globalCompositeOperation = 'source-over';

    g.save(); g.translate(ox, oy);
    for (const e of w.enemies) this.drawEnemy(g, w, e);
    this.drawPlayer(g, w);
    for (const b of w.projectiles) {
      g.fillStyle = b.owner === 'player' ? C.amberHi : b.parryable ? C.white : C.red;
      g.fillRect(Math.round(b.x), Math.round(b.y), b.w, b.h);
      if (!b.parryable && b.owner === 'enemy') { g.strokeStyle = C.white; g.strokeRect(Math.round(b.x) + 0.5, Math.round(b.y) + 0.5, b.w - 1, b.h - 1); }
    }
    for (const r of this.rings) { g.strokeStyle = r.col; g.globalAlpha = Math.min(1, r.life / 8); g.lineWidth = 2; g.beginPath(); g.arc(r.x, r.y, r.r, 0, Math.PI * 2); g.stroke(); }
    g.globalAlpha = 1; g.lineWidth = 1;
    for (const q of this.parts) { g.fillStyle = q.col; g.fillRect(Math.round(q.x), Math.round(q.y), 2, 2); }
    if (this.debug) {
      g.strokeStyle = '#0f0'; for (const h of w.hitboxes) g.strokeRect(h.x + 0.5, h.y + 0.5, h.w, h.h);
      const ab = attackBox(p); if (ab) { g.strokeStyle = '#ff0'; g.strokeRect(ab.x + 0.5, ab.y + 0.5, ab.w, ab.h); }
    }
    g.restore();
    this.drawHud(g, w);
  }

  drawPlayer(g, w) {
    const p = w.player, x = Math.round(p.x), y = Math.round(p.y);
    if (p.iframes > 0 && (w.t >> 2) % 2 && p.state !== 'hurt') return;
    const inv = p.state === 'roll' && p.stateT >= CFG.roll.iStart && p.stateT <= CFG.roll.iEnd;
    g.globalAlpha = inv ? 0.45 : 1;
    const h = p.state === 'roll' ? 22 : p.h, yy = y + p.h - h;
    g.fillStyle = p.state === 'hurt' ? C.red : C.lira; g.fillRect(x, yy, p.w, h);
    // 포니테일 (진행 반대쪽)
    g.fillStyle = '#c9c4d6'; g.fillRect(p.face > 0 ? x - 5 : x + p.w, yy + 4, 5, 10);
    // 앰버 눈
    g.fillStyle = C.amber; g.fillRect(p.face > 0 ? x + p.w - 5 : x + 2, yy + 6, 3, 2);
    // 상태 테두리
    const col = { attack: C.yellow, parry: C.amber, roll: C.sky, flask: '#8f8', ult: C.amberHi }[p.state];
    if (col) { g.strokeStyle = col; g.strokeRect(x - 0.5, yy - 0.5, p.w + 1, h + 1); }
    g.globalAlpha = 1;
    // 랜턴 (왼손 = 앞쪽 아래)
    const lx = p.face > 0 ? x + p.w + 1 : x - 7, ly = yy + 20;
    g.fillStyle = C.amberHi; g.fillRect(lx, ly, 6, 7);
    // 패링 판정창 표시
    if (p.state === 'parry' && p.stateT < CFG.parry.normalF) {
      const perfect = p.stateT < CFG.parry.perfectF;
      g.strokeStyle = perfect ? C.amberHi : C.amber; g.lineWidth = perfect ? 3 : 1.5;
      g.beginPath(); const cx = x + p.w / 2;
      g.arc(cx, y + 20, 26, p.face > 0 ? -1.1 : Math.PI - 1.1 + 0.0, p.face > 0 ? 1.1 : Math.PI + 1.1); g.stroke(); g.lineWidth = 1;
    }
    const ab = attackBox(p);
    if (ab) { g.fillStyle = 'rgba(255,240,180,0.55)'; g.fillRect(ab.x, ab.y + 8, ab.w, 6); }
  }

  drawEnemy(g, w, e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const d = ENEMY_DEFS[e.kind];
    g.fillStyle = e.flash > 0 ? C.white : C[e.kind === 'bellBoss' ? 'boss' : e.kind] || '#777';
    g.fillRect(x, y, e.w, e.h);
    g.fillStyle = C.red; g.fillRect(e.face > 0 ? x + e.w - 5 : x + 2, y + 6, 3, 2);   // 눈
    if (e.kind === 'bellBoss') { g.fillStyle = '#8c7a52'; g.fillRect(e.face > 0 ? x + e.w : x - 22, y + 20, 22, 26); }  // 종
    if (!d) return;
    const a = e.atk && d.attacks[e.atk];
    if (e.st === 'telegraph' && a) {
      const left = telegraphOf(e, a) - e.stT;
      const blink = left < 10 ? (w.t >> 1) % 2 : (w.t >> 2) % 2;
      const col = a.parryable ? C.white : C.red;
      g.strokeStyle = col; g.lineWidth = 2;
      if (blink) g.strokeRect(x - 1, y - 1, e.w + 2, e.h + 2);
      if (!a.parryable) { g.fillStyle = 'rgba(255,79,94,0.25)'; g.fillRect(x - 3, y - 3, e.w + 6, e.h + 6); }
      g.lineWidth = 1;
      g.fillStyle = col; g.fillRect(x + e.w / 2 - 1, y - 12, 3, 7); g.fillRect(x + e.w / 2 - 1, y - 4, 3, 2);   // !
    }
    if (e.st === 'active') for (const h of w.hitboxes) if (h.owner === e) {
      g.fillStyle = h.parryable ? 'rgba(255,255,255,0.35)' : 'rgba(255,79,94,0.45)'; g.fillRect(h.x, h.y, h.w, h.h);
    }
    if (e.stunT > 0) { g.fillStyle = C.yellow; for (let i = 0; i < 3; i++) g.fillRect(x + e.w / 2 - 10 + i * 9 + Math.round(Math.sin(w.t * 0.2 + i) * 2), y - 10, 3, 3); }
    if (!e.boss && e.hp < e.maxHp) { g.fillStyle = '#000'; g.fillRect(x, y - 5, e.w, 2); g.fillStyle = C.red; g.fillRect(x, y - 5, Math.round(e.w * e.hp / e.maxHp), 2); }
  }

  drawHud(g, w) {
    const p = w.player;
    for (let i = 0; i < CFG.player.hp; i++) { g.fillStyle = i < p.hp ? C.red : '#3a2a34'; g.fillRect(10 + i * 13, 10, 10, 10); }
    g.fillStyle = '#2a2230'; g.fillRect(10, 25, 80, 6);
    g.fillStyle = p.light >= CFG.light.max ? (w.t >> 3) % 2 ? C.amberHi : C.amber : C.amber; g.fillRect(10, 25, Math.round(80 * p.light / CFG.light.max), 6);
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
