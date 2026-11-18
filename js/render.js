// 렌더러: 내부 해상도 480x270, 정수 배율로 크게 그린 뒤 화면에 맞춘다
import { TILE, VIEW_W, VIEW_H, WEAPONS, RARITY, HEROES, BUFFS, setViewW } from './data.js';
import { T_SOLID, T_PLAT, T_SPIKE, T_DOOR, FLOOR_ROW } from './level.js';
import * as A from './art.js';

const FONT = '"Galmuri11", "Galmuri9", monospace';

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.k = 2;
    this.heroes = {};
    for (const id of Object.keys(HEROES)) this.heroes[id] = A.buildHero(id);
    this.enemies = A.buildEnemies();
    this.props = A.buildProps();
    this.tiles = A.THEMES.map((t, i) => A.buildTiles(t, i));
    this.bgs = A.THEMES.map((t, i) => A.buildBackground(t, i));
    this.weapons = {};
    for (const [id, w] of Object.entries(WEAPONS)) {
      const s = A.buildWeaponSprite(w.shape, w.colors);
      this.weapons[id] = { ...s, l: A.flipCanvas(s.c) };
    }
    this.ebow = A.buildWeaponSprite('bow', ['#b07a3a', '#e0c08a', '#ffffff', '#3a2a1a']);
    this.eshield = A.buildWeaponSprite('shield', ['#7a7f9e', '#b0b4cc', '#ffd75a', '#3a3a50']);
    this.white = new Map();
    this.circles = new Map();
    this.roomCanvas = null; this.roomRef = null;
    this.t = 0;
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth, H = window.innerHeight;
    setViewW(Math.max(480, Math.min(640, Math.round(VIEW_H * W / H))));
    const s = Math.min(W / VIEW_W, H / VIEW_H);
    this.k = Math.max(1, Math.ceil(s * dpr));
    this.cv.width = VIEW_W * this.k; this.cv.height = VIEW_H * this.k;
    this.cv.style.width = Math.floor(VIEW_W * s) + 'px';
    this.cv.style.height = Math.floor(VIEW_H * s) + 'px';
    this.scale = s;
  }

  whiteOf(c) {
    let w = this.white.get(c);
    if (!w) { w = A.tintCanvas(c, '#ffffff'); this.white.set(c, w); }
    return w;
  }
  circle(r, color) {
    const key = r + color;
    let c = this.circles.get(key);
    if (!c) {
      const s = r * 2 + 3; c = document.createElement('canvas'); c.width = s; c.height = s;
      const g = c.getContext('2d');
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        const d = Math.hypot(x - s / 2 + 0.5, y - s / 2 + 0.5);
        if (d <= r + 0.6) { g.fillStyle = d > r - 0.9 ? A.OUTLINE : d < r * 0.45 ? '#ffffff' : color; g.fillRect(x, y, 1, 1); }
      }
      this.circles.set(key, c);
    }
    return c;
  }

  bakeRoom(game) {
    const R = game.room, T = this.tiles[game.theme], th = A.THEMES[game.theme];
    const c = document.createElement('canvas'); c.width = R.W * TILE; c.height = R.H * TILE;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const at = (x, y) => (x < 0 || y < 0 || x >= R.W || y >= R.H) ? 1 : R.t[y * R.W + x];
    let seed = R.seed;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    // 장식 (바닥 위 소품)
    for (const d of R.deco) this.drawDeco(g, game.theme, d.x * TILE, d.y * TILE + TILE, d.k, th);
    for (let y = 0; y < R.H; y++) for (let x = 0; x < R.W; x++) {
      const v = at(x, y);
      if (v === T_SOLID) {
        const top = at(x, y - 1) !== T_SOLID && at(x, y - 1) !== T_DOOR && y > 1;
        g.drawImage(top ? T.top[(rnd() * 3) | 0] : T.solid[(rnd() * 3) | 0], x * TILE, y * TILE);
        // 그림자 경계
        if (at(x - 1, y) !== T_SOLID && x > 0) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x * TILE, y * TILE, 1, TILE); }
        if (at(x + 1, y) !== T_SOLID && x < R.W - 1) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x * TILE + 15, y * TILE, 1, TILE); }
        if (at(x, y + 1) !== T_SOLID && y < R.H - 1) { g.fillStyle = A.OUTLINE; g.fillRect(x * TILE, y * TILE + 15, TILE, 1); }
      } else if (v === T_PLAT) g.drawImage(T.plat, x * TILE, y * TILE);
      else if (v === T_SPIKE) g.drawImage(T.spike, x * TILE, y * TILE);
    }
    // 왼쪽 닫힌 문
    this.drawDoor(g, 0, (FLOOR_ROW - 3) * TILE, false, th, true);
    this.roomCanvas = c; this.roomRef = R;
  }

  drawDeco(g, ti, x, y, k, th) {
    const px = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(x + dx, y - dy - h, w, h); };
    const O = A.OUTLINE;
    if (ti === 0) {
      if (k === 0) { px(3, 0, 10, 2, O); px(4, 2, 8, 1, O); px(5, 3, 6, 9, O); px(6, 3, 4, 8, th.top); px(6, 7, 4, 1, '#ffffff'); }
      else if (k === 1) { px(1, 0, 14, 12, O); px(2, 1, 12, 10, '#3b2a6e'); px(3, 6, 10, 1, '#5a4a9e'); px(4, 3, 3, 2, th.top2); }
      else if (k === 2) { px(5, 0, 6, 6, O); px(6, 1, 4, 4, '#7a4a2a'); px(3, 6, 10, 6, O); px(4, 7, 8, 4, '#5fe07a'); px(6, 11, 4, 3, '#5fe07a'); }
      else { px(7, 0, 2, 14, O); px(2, 14, 12, 7, O); px(3, 15, 10, 5, th.top); px(4, 17, 8, 1, '#ffffff'); }
    } else if (ti === 1) {
      if (k === 0) { px(6, 0, 4, 5, O); px(7, 0, 2, 5, '#f6e3c8'); px(2, 5, 12, 5, O); px(3, 6, 10, 3, '#5fe07a'); px(5, 7, 2, 1, '#ffffff'); }
      else if (k === 1) { px(5, 0, 6, 10, O); px(6, 0, 4, 9, '#3aff9a'); px(7, 2, 1, 6, '#c8ffd0'); px(2, 0, 4, 6, O); px(3, 0, 2, 5, '#2ad07a'); }
      else if (k === 2) { px(1, 0, 14, 6, O); px(2, 0, 12, 5, '#3a5a4a'); px(3, 3, 5, 1, '#5a7a6a'); }
      else for (let i = 0; i < 6; i++) px(1 + i * 2 + (i % 2), 0, 1, 3 + (i % 3) * 2, '#4fc96a');
    } else if (ti === 2) {
      if (k === 0) { px(3, 0, 10, 14, O); px(4, 0, 8, 13, '#8a4a2a'); px(4, 3, 8, 1, '#5a2a1a'); px(4, 9, 8, 1, '#5a2a1a'); px(6, 5, 3, 2, '#ffb347'); }
      else if (k === 1) { px(1, 0, 14, 11, O); px(2, 0, 12, 10, '#a07a4a'); px(2, 0, 12, 1, '#6a4a2a'); px(2, 5, 12, 1, '#6a4a2a'); px(7, 0, 1, 10, '#6a4a2a'); }
      else if (k === 2) { px(0, 0, 16, 5, O); px(1, 1, 14, 3, '#8a8a9a'); px(1, 1, 14, 1, '#c0c0d0'); }
      else { px(6, 0, 4, 8, O); px(7, 0, 2, 7, '#c0c0d0'); px(4, 7, 8, 3, O); px(5, 8, 6, 1, '#ffb347'); }
    } else {
      if (k === 0) { px(6, 0, 4, 3, O); px(7, 3, 2, 6, O); px(7, 3, 2, 5, '#f6e3c8'); px(7, 9, 2, 3, '#ffb347'); px(7, 11, 2, 1, '#ffffff'); }
      else if (k === 1) { px(4, 0, 8, 7, O); px(5, 1, 6, 5, '#eeeadc'); px(6, 3, 1, 2, O); px(9, 3, 1, 2, O); }
      else if (k === 2) { px(4, 0, 8, 10, O); px(5, 1, 6, 8, '#5a1024'); px(6, 2, 4, 6, '#a8203a'); px(7, 10, 2, 3, O); }
      else { px(7, 0, 2, 20, O); px(3, 12, 10, 9, O); px(4, 13, 8, 7, '#8a1040'); px(6, 15, 4, 3, '#ffd75a'); }
    }
  }

  drawDoor(g, x, y, open, th, left = false) {
    g.fillStyle = A.OUTLINE; g.fillRect(x, y - 4, 16, 52);
    g.fillStyle = th.wall2; g.fillRect(x + 1, y - 3, 14, 3);
    if (open) { g.fillStyle = '#05030a'; g.fillRect(x + 2, y, 12, 48); g.fillStyle = th.glow; g.fillRect(x + (left ? 13 : 2), y, 1, 48); }
    else {
      g.fillStyle = '#2a2236'; g.fillRect(x + 2, y, 12, 48);
      g.fillStyle = left ? '#4a4256' : th.top;
      for (let i = 0; i < 4; i++) g.fillRect(x + 3 + i * 3, y + 1, 1, 46);
      g.fillStyle = '#ffffff40'; g.fillRect(x + 3, y + 1, 1, 46);
    }
  }

  /* ───────────────────────── 메인 그리기 ───────────────────────── */
  draw(game, ui) {
    const g = this.g, k = this.k;
    this.t += 1 / 60;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    if (this.roomRef !== game.room) this.bakeRoom(game);
    const th = A.THEMES[game.theme];
    const sh = game.cam.shake;
    const sx = sh ? Math.round((Math.random() - 0.5) * sh) : 0, sy = sh ? Math.round((Math.random() - 0.5) * sh) : 0;
    const camX = Math.round(game.cam.x) - sx, camY = Math.round(game.cam.y) - sy;
    g.setTransform(k, 0, 0, k, 0, 0);
    // 배경
    const bg = this.bgs[game.theme];
    g.drawImage(bg.sky, 0, 0);
    const fx = -Math.round(camX * 0.15) % bg.W, mx = -Math.round(camX * 0.35) % bg.W;
    g.drawImage(bg.far, fx, 0); g.drawImage(bg.far, fx + bg.W, 0);
    g.drawImage(bg.mid, mx, 0); g.drawImage(bg.mid, mx + bg.W, 0);
    g.save();
    g.translate(-camX, -camY);
    g.drawImage(this.roomCanvas, 0, 0);
    const R = game.room;
    const doorOpen = R.cleared && !game.isLastRoom();
    this.drawDoor(g, (R.W - 1) * TILE, (FLOOR_ROW - 3) * TILE, doorOpen, th);
    if (doorOpen) this.arrow(g, (R.W - 2) * TILE + 4, (FLOOR_ROW - 4) * TILE, th.glow);

    this.drawProps(game, th);
    for (const pr of game.props) if (pr.kind === 'sign') {
      const lines = ui.touch ? ['왼쪽 드래그: 이동', '오른쪽 버튼: 공격·점프·스킬', '→ 문으로 전진!'] : ['A/D 이동 · W 점프 · J/클릭 공격', 'K 스킬 · Q 교체 · E 줍기/열기', '→ 문으로 전진!'];
      lines.forEach((l, i) => this.label(g, l, pr.x + 12, pr.y - 40 + i * 12, i === 2 ? '#ffd75a' : '#ffffff', 9));
    }
    for (const c of game.chests) {
      const spr = (c.open ? this.props.chestOpen : this.props.chest)[c.kind];
      g.drawImage(spr, Math.round(c.x) - 1, Math.round(c.y + c.h - spr.height + 1));
      if (!c.open && c.kind !== 'wood') this.sparkle(g, c.x + 8, c.y - 2, c.kind === 'gold' ? '#ffd75a' : '#7af0ff');
    }
    for (const it of game.items) {
      const w = this.weapons[it.id], rar = RARITY[WEAPONS[it.id].rarity];
      const bob = Math.round(Math.sin(this.t * 3 + it.x) * 1.5);
      g.fillStyle = rar.color + '55'; g.fillRect(Math.round(it.x) - 2, Math.round(it.y) + 7, 20, 1);
      g.drawImage(w.c, Math.round(it.x + 8 - w.c.width / 2), Math.round(it.y + 4 - w.c.height / 2) + bob - 4);
    }
    for (const pk of game.pickups) {
      const s = pk.kind === 'coin' ? this.props.coin : pk.kind === 'orb' ? this.props.orb : this.props.potion;
      g.drawImage(s, Math.round(pk.x - s.width / 2), Math.round(pk.y - s.height / 2));
    }
    // 적
    for (const e of game.enemies) this.drawEnemy(g, e, game);
    // 플레이어
    this.drawPlayer(g, game);
    // 근접 궤적
    for (const s of game.slashes) this.drawSlash(g, s);
    // 경고선
    for (const l of game.lines) {
      if (l.bolt) { this.bolt(g, l.x1, l.y1, l.x2, l.y2, l.color); continue; }
      if ((this.t * 20 | 0) % 2) continue;
      g.strokeStyle = l.color; g.lineWidth = l.w ? 2 : 1; g.globalAlpha = 0.7; g.setLineDash([4, 3]);
      g.beginPath(); g.moveTo(l.x1, l.y1); g.lineTo(l.x2, l.y2); g.stroke();
      g.setLineDash([]); g.globalAlpha = 1;
    }
    // 탄
    for (const b of game.bullets) this.drawBullet(g, b);
    // 파티클
    for (const q of game.particles) this.drawParticle(g, q, game);
    // 숫자
    for (const t of game.texts) this.label(g, t.str, Math.round(t.x), Math.round(t.y), t.color, t.big ? 11 : 9, 1 - Math.max(0, (t.t - t.life * 0.6) / (t.life * 0.4)));
    // 상호작용 라벨
    if (game.focus && game.state === 'play') {
      const f = game.focus;
      const txt = (ui.touch ? '' : '[E] ') + f.label;
      this.label(g, txt, Math.round(f.x), Math.round(f.y - 22 + Math.sin(this.t * 4) * 1.5), '#ffffff', 9, 1, true);
      if (f.act === 'pickup') this.weaponCard(g, f.obj.id, Math.round(f.x), Math.round(f.y - 34));
    }
    g.restore();
    // 화면 효과
    const p = game.p;
    if (p.hurtT > 0) { g.fillStyle = `rgba(255,40,70,${p.hurtT * 0.9})`; g.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (p.hp === 1 && !p.dead) { g.fillStyle = `rgba(255,0,40,${0.08 + Math.sin(this.t * 6) * 0.06})`; g.fillRect(0, 0, 6, VIEW_H); g.fillRect(VIEW_W - 6, 0, 6, VIEW_H); g.fillRect(0, 0, VIEW_W, 6); g.fillRect(0, VIEW_H - 6, VIEW_W, 6); }
    this.drawHUD(g, game, ui);
    if (ui.fade > 0) { g.fillStyle = `rgba(5,3,10,${ui.fade})`; g.fillRect(0, 0, VIEW_W, VIEW_H); }
  }

  arrow(g, x, y, c) {
    const o = Math.round(Math.sin(this.t * 5) * 2);
    g.fillStyle = A.OUTLINE; g.fillRect(x + o - 1, y - 1, 9, 9);
    g.fillStyle = c;
    for (let i = 0; i < 4; i++) g.fillRect(x + o + i, y + i, 1, 7 - i * 2);
    g.fillRect(x + o - 1 + 4, y + 3, 1, 1);
  }
  sparkle(g, x, y, c) {
    const f = (this.t * 6 | 0) % 4;
    if (f === 3) return;
    g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y - 2 - f), 1, 1 + f * 2 > 5 ? 5 : 1 + f * 2);
    g.fillRect(Math.round(x - f), Math.round(y - 2), 1 + f * 2, 1);
  }

  drawProps(game, th) {
    const g = this.g;
    for (const pr of game.props) {
      if (pr.kind === 'sign') {
        g.fillStyle = A.OUTLINE; g.fillRect(pr.x - 1, pr.y - 1, 26, 14); g.fillRect(pr.x + 11, pr.y + 12, 3, 16);
        g.fillStyle = '#a07a4a'; g.fillRect(pr.x, pr.y, 24, 12); g.fillStyle = '#7a5a32'; g.fillRect(pr.x, pr.y + 9, 24, 3);
        g.fillStyle = '#3a2a1a'; g.fillRect(pr.x + 4, pr.y + 3, 16, 1); g.fillRect(pr.x + 4, pr.y + 6, 10, 1);
      } else if (pr.kind === 'merchant') {
        const s = this.props.merchant, b = Math.round(Math.sin(this.t * 2) * 0.6);
        g.drawImage(s, Math.round(pr.x), Math.round(pr.y - s.height + 16) + b);
        this.label(g, '상인 냥냥이', pr.x + 7, pr.y - 22, '#ffd75a', 9, 1);
      } else if (pr.kind === 'shop') {
        g.fillStyle = A.OUTLINE; g.fillRect(pr.x - 3, pr.y + 9, 22, 10);
        g.fillStyle = '#5a4a7a'; g.fillRect(pr.x - 2, pr.y + 10, 20, 8); g.fillStyle = '#7a6a9a'; g.fillRect(pr.x - 2, pr.y + 10, 20, 1);
        if (!pr.sold) {
          const gd = pr.good;
          let icon;
          if (gd.kind === 'weapon') icon = this.weapons[gd.id].c;
          else if (gd.kind === 'potion') icon = this.props.potion;
          else if (gd.kind === 'energy') icon = this.props.orb;
          const bob = Math.round(Math.sin(this.t * 3 + pr.x) * 1.5);
          if (icon) g.drawImage(icon, Math.round(pr.x + 8 - icon.width / 2), Math.round(pr.y + 4 - icon.height / 2) + bob);
          else this.label(g, '?', pr.x + 8, pr.y + 7 + bob, '#ffd75a', 11, 1);
          this.label(g, String(pr.price), pr.x + 8, pr.y + 28, game.coins >= pr.price ? '#ffd75a' : '#ff6a6a', 9, 1);
        } else this.label(g, '품절', pr.x + 8, pr.y + 6, '#8a8aa0', 9, 1);
      } else if (pr.kind === 'statue') {
        const s = this.props.statue;
        g.drawImage(s, Math.round(pr.x), Math.round(pr.y + 16 - s.height));
        if (!pr.used) { g.globalAlpha = 0.4 + Math.sin(this.t * 3) * 0.2; g.drawImage(this.circle(10, '#ffd75a'), pr.x - 4, pr.y - 30); g.globalAlpha = 1; this.sparkle(g, pr.x + 7, pr.y - 22, '#ffffff'); }
      } else if (pr.kind === 'portal') {
        const f = (this.t * 8 | 0) % 4;
        const s = this.props.portal[f];
        const grow = Math.min(1, pr.t * 2);
        g.drawImage(s, Math.round(pr.x + 14 - 14 * grow), Math.round(pr.y + 20 - 20 * grow), Math.round(28 * grow), Math.round(40 * grow));
        if (grow >= 1) for (let i = 0; i < 2; i++) this.sparkle(g, pr.x + 4 + ((this.t * 37 + i * 13) % 20), pr.y + ((this.t * 23 + i * 17) % 36), '#ffffff');
      }
    }
  }

  drawEnemy(g, e, game) {
    const E = this.enemies;
    if (e.spawnT > 0) {
      const r = Math.round(4 + e.spawnT * 14);
      g.strokeStyle = e.elite ? '#ffd75a' : '#ff4f6a'; g.lineWidth = 1;
      g.beginPath(); g.arc(Math.round(e.x + e.w / 2), Math.round(e.y + e.h / 2), r, 0, Math.PI * 2); g.stroke();
      this.sparkle(g, e.x + e.w / 2, e.y + e.h / 2, '#ffffff');
      return;
    }
    let fr;
    const f2 = (e.t * 4 | 0) % 2;
    switch (e.type) {
      case 'slime': fr = E.slime[e.tint % 4][e.onGround ? (e.timer < 0.25 ? 1 : 0) : 0]; break;
      case 'bat': fr = E.bat[(e.t * 8 | 0) % 2]; break;
      case 'goblin': fr = E.goblin[Math.abs(e.vx) > 5 ? f2 : 0]; break;
      case 'skeleton': fr = E.skeleton[Math.abs(e.vx) > 5 ? f2 : 0]; break;
      case 'mage': fr = E.mage[e.state === 'cast' ? f2 : 0]; break;
      case 'drone': fr = E.drone[f2]; break;
      case 'boss': fr = E[e.boss][e.boss === 'crow' ? (e.t * 6 | 0) % 2 : (e.onGround && e.state === 'crouch') || e.state === 'slashwind' ? 1 : (e.t * 2 | 0) % 2]; break;
    }
    const c = e.face > 0 ? fr.r : fr.l;
    const x = Math.round(e.x + e.w / 2 - c.width / 2), y = Math.round(e.y + e.h - c.height + 1 + (e.type === 'boss' && e.boss === 'crow' ? 6 : 0));
    // 그림자
    if (e.type !== 'boss' || e.boss !== 'crow') { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(Math.round(e.x + 1), Math.round(e.y + e.h), e.w - 2, 2); }
    if (e.elite && e.type !== 'boss') {
      const gl = this.whiteOf(c);
      g.globalAlpha = 0.55 + Math.sin(this.t * 8) * 0.25;
      g.filter = 'none';
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.drawImage(A.tintCanvas(c, '#ffd75a'), x + dx, y + dy);
      g.globalAlpha = 1;
    }
    if (e.boss === 'maid' && e.state === 'dash') g.globalAlpha = 0.85;
    g.drawImage(e.flash > 0 ? this.whiteOf(c) : c, x, y);
    g.globalAlpha = 1;
    if (e.slowT > 0) { g.globalAlpha = 0.35; g.drawImage(A.tintCanvas(c, '#aef3ff'), x, y); g.globalAlpha = 1; }
    // 무기
    if (e.type === 'goblin') {
      const a = e.state === 'aim' ? e.aim : (e.face > 0 ? 0 : Math.PI);
      this.drawHeld(g, this.ebow.c, this.ebow.grip, e.x + e.w / 2 + e.face * 4, e.y + 11, a);
      if (e.state === 'aim' && (this.t * 16 | 0) % 2) {
        g.strokeStyle = '#ff4f6a88'; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(e.x + e.w / 2, e.y + 8);
        g.lineTo(e.x + e.w / 2 + Math.cos(a) * 140, e.y + 8 + Math.sin(a) * 140); g.stroke(); g.setLineDash([]);
      }
    } else if (e.type === 'skeleton') {
      const s = this.eshield.c;
      g.drawImage(e.face > 0 ? s : A.flipCanvas(s), Math.round(e.face > 0 ? e.x + e.w - 3 : e.x - s.width + 3), Math.round(e.y + 3));
      if (e.state === 'wind' && (this.t * 12 | 0) % 2) this.label(g, '!', e.x + e.w / 2, e.y - 6, '#ff4040', 11, 1);
    } else if (e.type === 'mage' && e.state === 'cast') {
      g.drawImage(this.circle(3, '#c07aff'), Math.round(e.x + e.w / 2 - 4), Math.round(e.y - 9));
    } else if (e.type === 'bat' && e.state === 'wind' && (this.t * 12 | 0) % 2) this.label(g, '!', e.x + e.w / 2, e.y - 6, '#ff4040', 11, 1);
    // 체력바 (일반 적, 피해 입었을 때)
    if (e.type !== 'boss' && e.hp < e.maxHp) {
      const w = Math.max(10, e.w), bx = Math.round(e.x + e.w / 2 - w / 2), by = Math.round(e.y - 5);
      g.fillStyle = A.OUTLINE; g.fillRect(bx - 1, by - 1, w + 2, 4);
      g.fillStyle = '#3a1020'; g.fillRect(bx, by, w, 2);
      g.fillStyle = e.elite ? '#ffd75a' : '#ff4f6a'; g.fillRect(bx, by, Math.max(1, Math.round(w * e.hp / e.maxHp)), 2);
    }
  }

  drawHeld(g, spr, grip, hx, hy, a) {
    g.save(); g.translate(Math.round(hx), Math.round(hy)); g.rotate(a);
    if (Math.cos(a) < 0) g.scale(1, -1);
    g.drawImage(spr, -grip[0], -grip[1]);
    g.restore();
  }

  drawPlayer(g, game) {
    const p = game.p, H = this.heroes[game.heroId];
    if (p.dead) {
      const fr = H.idle[0][p.face > 0 ? 'r' : 'l'];
      g.save(); g.translate(Math.round(p.x + p.w / 2), Math.round(p.y + p.h)); g.rotate(Math.min(1.57, p.deathT * 6) * -p.face);
      g.globalAlpha = Math.max(0, 1 - p.deathT * 0.5); g.drawImage(fr, -fr.width / 2, -fr.height + 2); g.restore(); g.globalAlpha = 1;
      return;
    }
    let set, i;
    if (!p.onGround) { set = p.vy < 0 ? H.jump : H.fall; i = 0; }
    else if (Math.abs(p.vx) > 20) { set = H.run; i = (p.anim * 10 | 0) % 4; }
    else { set = H.idle; i = (p.anim * 3 | 0) % 4; }
    const fr = set[i][p.face > 0 ? 'r' : 'l'];
    const x = Math.round(p.x + p.w / 2 - fr.width / 2), y = Math.round(p.y + p.h - fr.height + 2);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(Math.round(p.x), Math.round(p.y + p.h), p.w, 2);
    if (p.inv > 0 && p.dashT <= 0 && (p.inv * 20 | 0) % 2 === 0) g.globalAlpha = 0.35;
    if (p.skillT > 0 && game.heroId === 'miyu') { g.globalAlpha *= 0.5; g.drawImage(A.tintCanvas(fr, '#ff6fb8'), x - p.face * 3, y); g.globalAlpha = p.inv > 0 ? g.globalAlpha * 2 : 1; }
    // 무기 (몸 뒤 쪽 손잡이)
    const w = WEAPONS[p.weapons[p.cur]], ws = this.weapons[p.weapons[p.cur]];
    const [hx, hy] = game.handPos();
    let a = p.aim;
    if (w.kind === 'melee') {
      const swing = Math.max(0, p.cool) * w.rate; // 1 → 0
      a = p.aim + (swing > 0.6 ? (swing - 0.6) * 2.5 - 0.8 : -0.8 + (0.6 - swing) * 0.2) * (Math.cos(p.aim) >= 0 ? 1 : -1) * -1;
    }
    const rec = p.recoil * 2;
    g.drawImage(fr, x, y);
    if (p.shieldReady) { g.globalAlpha = 0.3 + Math.sin(this.t * 5) * 0.1; g.drawImage(this.circle(14, '#7af0ff'), Math.round(p.x + p.w / 2 - 15.5), Math.round(p.y + p.h / 2 - 16.5)); g.globalAlpha = 1; }
    this.drawHeld(g, ws.c, ws.grip, hx - Math.cos(a) * rec, hy - Math.sin(a) * rec, a);
    // 손
    g.fillStyle = A.OUTLINE; g.fillRect(Math.round(hx - 1), Math.round(hy - 1), 3, 3);
    g.fillStyle = '#ffe3d1'; g.fillRect(Math.round(hx), Math.round(hy), 1, 1);
    g.globalAlpha = 1;
  }

  drawSlash(g, s) {
    const prog = s.t / s.life;
    g.globalAlpha = 1 - prog;
    g.strokeStyle = s.color; g.lineWidth = s.enemy ? 2 : 3;
    const r = s.range * (0.7 + prog * 0.3);
    g.beginPath(); g.arc(Math.round(s.x), Math.round(s.y), r, s.a - s.arc / 2, s.a + s.arc / 2); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 1;
    g.beginPath(); g.arc(Math.round(s.x), Math.round(s.y), r - 2, s.a - s.arc / 3, s.a + s.arc / 3); g.stroke();
    g.globalAlpha = 1;
  }

  bolt(g, x1, y1, x2, y2, c) {
    g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.moveTo(x1, y1);
    for (let i = 1; i < 5; i++) { const t = i / 5; g.lineTo(x1 + (x2 - x1) * t + (Math.random() - 0.5) * 8, y1 + (y2 - y1) * t + (Math.random() - 0.5) * 8); }
    g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.stroke();
  }

  drawBullet(g, b) {
    const x = Math.round(b.x), y = Math.round(b.y);
    const a = Math.atan2(b.vy, b.vx);
    const O = A.OUTLINE;
    switch (b.kind) {
      case 'pix': g.fillStyle = O; g.fillRect(x - 2, y - 2, 5, 5); g.fillStyle = b.color; g.fillRect(x - 1, y - 1, 3, 3); g.fillStyle = '#fff'; g.fillRect(x, y, 1, 1); break;
      case 'dot': g.fillStyle = b.color; g.fillRect(x - 1, y - 1, 3, 3); g.fillStyle = '#fff'; g.fillRect(x, y, 1, 1); g.fillStyle = b.color + '66'; g.fillRect(Math.round(x - b.vx * 0.02), Math.round(y - b.vy * 0.02), 2, 2); break;
      case 'drop': g.fillStyle = b.color; g.fillRect(x - 1, y - 1, 2, 3); g.fillStyle = '#fff'; g.fillRect(x - 1, y - 1, 1, 1); break;
      case 'star': case 'meteor': {
        const r = b.kind === 'meteor' ? 4 : 2;
        if (b.kind === 'meteor') { g.fillStyle = '#ff6a3a88'; for (let i = 1; i < 5; i++) g.fillRect(Math.round(x - b.vx * 0.012 * i) - 1, Math.round(y - b.vy * 0.012 * i) - 1, 3, 3); }
        g.fillStyle = O; g.fillRect(x - r - 1, y - 1, r * 2 + 3, 3); g.fillRect(x - 1, y - r - 1, 3, r * 2 + 3);
        g.fillStyle = b.color; g.fillRect(x - r, y, r * 2 + 1, 1); g.fillRect(x, y - r, 1, r * 2 + 1);
        g.fillStyle = '#fff'; g.fillRect(x, y, 1, 1);
        break;
      }
      case 'laser': case 'ice': {
        const L = b.kind === 'laser' ? 12 : 6;
        g.strokeStyle = b.color; g.lineWidth = 3 * (b.r / 2.2);
        g.beginPath(); g.moveTo(x - Math.cos(a) * L, y - Math.sin(a) * L); g.lineTo(x, y); g.stroke();
        g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke(); break;
      }
      case 'bubble': g.drawImage(this.circle(Math.round(b.r), '#aef3ff55'), x - Math.round(b.r) - 1, y - Math.round(b.r) - 1); break;
      case 'rocket': case 'plasma': {
        const r = Math.round(b.r);
        g.drawImage(this.circle(r, b.color), x - r - 1, y - r - 1);
        if (Math.random() < 0.7) { g.fillStyle = '#ffd75a'; g.fillRect(Math.round(x - Math.cos(a) * (r + 3)), Math.round(y - Math.sin(a) * (r + 3)), 2, 2); }
        break;
      }
      case 'rainbow': g.fillStyle = `hsl(${(b.t * 900 + b.x) % 360} 100% 65%)`; g.fillRect(x - 1, y - 1, 3, 3); g.fillStyle = '#fff'; g.fillRect(x, y, 1, 1); break;
      case 'bolt': this.bolt(g, x - b.vx * 0.03, y - b.vy * 0.03, x, y, b.color); break;
      case 'boomer': {
        const s = this.weapons.boomerang.c;
        g.save(); g.translate(x, y); g.rotate(b.t * 18); g.drawImage(s, -s.width / 2, -s.height / 2); g.restore(); break;
      }
      case 'wave': {
        g.globalAlpha = Math.min(1, b.life * 4);
        g.strokeStyle = b.color; g.lineWidth = 3; g.beginPath(); g.arc(x - Math.cos(b.a) * 8, y - Math.sin(b.a) * 8, 10 * (b.r / 6), b.a - 1, b.a + 1); g.stroke();
        g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1; break;
      }
      case 'arrow': case 'knife': case 'feather': {
        const L = b.kind === 'arrow' ? 7 : 5;
        g.strokeStyle = O; g.lineWidth = 3; g.beginPath(); g.moveTo(x - Math.cos(a) * L, y - Math.sin(a) * L); g.lineTo(x, y); g.stroke();
        g.strokeStyle = b.color; g.lineWidth = 1; g.stroke();
        g.fillStyle = '#fff'; g.fillRect(x, y, 1, 1); break;
      }
      case 'wave_e': g.fillStyle = O; g.fillRect(x - 6, y - 7, 12, 8); g.fillStyle = b.color; g.fillRect(x - 5, y - 6, 10, 6); g.fillStyle = '#fff'; g.fillRect(x - 5, y - 6, 10, 1); break;
      default: {
        const r = Math.round(b.r);
        const blink = (b.t * 12 | 0) % 2;
        g.drawImage(this.circle(r, blink ? b.color : '#ffd0d8'), x - r - 1, y - r - 1);
      }
    }
  }

  drawParticle(g, q, game) {
    if (q.ghost) {
      const fr = (q.boss ? this.enemies.maid[0] : this.heroes[game.heroId].run[0])[q.face > 0 ? 'r' : 'l'];
      g.globalAlpha = (1 - q.t / q.life) * 0.5;
      const ox = q.boss ? 28 / 2 : 5, oy = q.boss ? 56 : 22;
      g.drawImage(A.tintCanvas(fr, q.boss ? '#ff2d7a' : '#ff8fd0'), Math.round(q.x + ox - fr.width / 2), Math.round(q.y + oy - fr.height + 2));
      g.globalAlpha = 1; return;
    }
    if (q.ringR) {
      g.globalAlpha = 1 - q.t / q.life; g.strokeStyle = q.c; g.lineWidth = 1;
      g.beginPath(); g.arc(Math.round(q.x), Math.round(q.y), q.ringR * (0.4 + q.t / q.life), 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; return;
    }
    if (q.boom) {
      const r = q.boom * (0.5 + q.t / q.life * 0.6);
      g.globalAlpha = 1 - q.t / q.life;
      g.fillStyle = '#ffd75a'; g.beginPath(); g.arc(Math.round(q.x), Math.round(q.y), r * 0.6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ff6a3a'; g.lineWidth = 2; g.beginPath(); g.arc(Math.round(q.x), Math.round(q.y), r, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1; return;
    }
    if (q.flash) { g.fillStyle = '#ffffff'; g.fillRect(Math.round(q.x) - 2, Math.round(q.y) - 2, 4, 4); return; }
    g.fillStyle = q.c; g.globalAlpha = Math.min(1, (1 - q.t / q.life) * 1.5);
    g.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s); g.globalAlpha = 1;
  }

  label(g, str, x, y, color, size = 9, alpha = 1, box = false) {
    g.save();
    g.globalAlpha = Math.max(0, alpha);
    g.font = `${size}px ${FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (box) {
      const w = Math.ceil(g.measureText(str).width) + 8;
      g.fillStyle = 'rgba(10,6,20,0.85)'; g.fillRect(Math.round(x - w / 2), Math.round(y - 7), w, 13);
      g.fillStyle = '#ffffff30'; g.fillRect(Math.round(x - w / 2), Math.round(y - 7), w, 1);
    } else {
      g.fillStyle = A.OUTLINE;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]) g.fillText(str, x + dx, y + dy);
    }
    g.fillStyle = color; g.fillText(str, x, y);
    g.restore();
  }
  labelL(g, str, x, y, color, size = 9) {
    g.save(); g.font = `${size}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillStyle = A.OUTLINE; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]) g.fillText(str, x + dx, y + dy);
    g.fillStyle = color; g.fillText(str, x, y); g.restore();
  }

  weaponCard(g, id, x, y) {
    const w = WEAPONS[id], rar = RARITY[w.rarity];
    const lines = [w.kind === 'melee' ? `근접 피해 ${w.dmg}` : `피해 ${w.dmg}${w.shots > 1 ? '×' + w.shots : ''}`, `에너지 ${w.energy}`, `${rar.name}`];
    const W2 = 74, H2 = 30, bx = Math.round(x - W2 / 2), by = Math.round(y - H2);
    g.fillStyle = 'rgba(10,6,20,0.9)'; g.fillRect(bx, by, W2, H2);
    g.fillStyle = rar.color; g.fillRect(bx, by, W2, 1); g.fillRect(bx, by + H2 - 1, W2, 1);
    this.labelL(g, lines[0], bx + 4, by + 7, '#ffffff', 9);
    this.labelL(g, lines[1], bx + 4, by + 17, '#5cc8ff', 9);
    this.labelL(g, lines[2], bx + 44, by + 17, rar.color, 9);
  }

  bar(g, x, y, w, val, max, col, dark, text) {
    g.fillStyle = A.OUTLINE; g.fillRect(x - 1, y - 1, w + 2, 11);
    g.fillStyle = dark; g.fillRect(x, y, w, 9);
    const fw = Math.round(w * Math.max(0, Math.min(1, val / max)));
    g.fillStyle = col; g.fillRect(x, y, fw, 9);
    g.fillStyle = '#ffffff55'; g.fillRect(x, y, fw, 1);
    g.fillStyle = '#00000033'; g.fillRect(x, y + 7, fw, 2);
    this.label(g, text, x + w / 2, y + 5, '#ffffff', 9);
  }

  drawHUD(g, game, ui) {
    const p = game.p;
    // 왼쪽 상단 패널
    g.fillStyle = 'rgba(10,6,20,0.78)'; g.fillRect(4, 4, 100, 42);
    g.fillStyle = '#ffffff22'; g.fillRect(4, 4, 100, 1);
    this.bar(g, 8, 8, 92, p.hp, game.maxHp(), '#ff4f6a', '#4a1020', `${Math.max(0, Math.ceil(p.hp))}/${game.maxHp()}`);
    this.bar(g, 8, 21, 92, p.armor, game.maxArmor(), '#a8b0c8', '#2a2c3a', `${p.armor}/${game.maxArmor()}`);
    this.bar(g, 8, 34, 92, p.energy, game.maxEnergy(), '#5cc8ff', '#10284a', `${Math.floor(p.energy)}/${game.maxEnergy()}`);
    // 코인
    g.drawImage(this.props.coin, 109, 9);
    this.labelL(g, String(game.coins), 116, 11, '#ffd75a', 9);
    if (p.shieldReady) { g.drawImage(this.circle(3, '#7af0ff'), 108, 19); }
    // 층
    const isBoss = game.floor % 5 === 0;
    this.label(g, `${game.floor}층 · ${A.THEMES[game.theme].name}`, VIEW_W / 2, 10, isBoss ? '#ff6a8a' : '#ffffff', 9);
    const n = game.plan.length, dw = 8;
    for (let i = 0; i < n; i++) {
      const x = Math.round(VIEW_W / 2 - (n * dw) / 2 + i * dw), y = 18;
      const tp = game.plan[i];
      g.fillStyle = A.OUTLINE; g.fillRect(x, y, 6, 6);
      g.fillStyle = i < game.roomIdx ? '#6a6a8a' : i === game.roomIdx ? '#ffffff' : tp === 'boss' ? '#ff4f6a' : tp === 'shop' ? '#ffd75a' : tp === 'chest' ? '#5cc8ff' : tp === 'statue' ? '#c07aff' : '#3a3a5a';
      g.fillRect(x + 1, y + 1, 4, 4);
    }
    // 보스 체력
    if (game.boss && game.boss.hp > 0) {
      const b = game.boss, w = 200, x = VIEW_W / 2 - w / 2, y = 36;
      this.label(g, b.def.name, VIEW_W / 2, y - 4, '#ff6a8a', 9);
      g.fillStyle = A.OUTLINE; g.fillRect(x - 1, y + 3, w + 2, 6);
      g.fillStyle = '#3a1020'; g.fillRect(x, y + 4, w, 4);
      g.fillStyle = b.phase === 2 ? '#ff2d55' : '#ff6a8a'; g.fillRect(x, y + 4, Math.round(w * b.hp / b.maxHp), 4);
    }
    // 남은 적
    if (game.room.locked && game.room.type === 'combat' && !game.boss) {
      const alive = game.enemies.filter(e => e.hp > 0).length;
      this.label(g, `웨이브 ${Math.max(1, game.room.wave)}/${game.room.waves} · 남은 적 ${alive}`, VIEW_W / 2, 32, '#ffb0c0', 9);
    }
    // 무기 / 스킬 (PC: 오른쪽 아래)
    if (!ui.touch) {
      const w = WEAPONS[p.weapons[p.cur]], ws = this.weapons[p.weapons[p.cur]];
      const bx = VIEW_W - 92, by = VIEW_H - 34;
      g.fillStyle = 'rgba(10,6,20,0.78)'; g.fillRect(bx, by, 88, 30);
      g.fillStyle = RARITY[w.rarity].color; g.fillRect(bx, by, 88, 1);
      g.drawImage(ws.c, Math.round(bx + 18 - ws.c.width / 2), Math.round(by + 12 - ws.c.height / 2));
      this.labelL(g, w.name, bx + 4, by + 24, RARITY[w.rarity].color, 9);
      this.labelL(g, `⚡${w.energy}`, bx + 58, by + 10, '#5cc8ff', 9);
      if (p.weapons[1]) this.labelL(g, '[Q]교체', bx + 50, by - 6, '#aaaacc', 9);
      // 스킬
      const sx = VIEW_W - 116, sy = VIEW_H - 22;
      const ready = p.skillCd <= 0;
      g.drawImage(this.circle(10, ready ? HEROES[game.heroId].color : '#3a3a5a'), sx - 11, sy - 11);
      if (!ready) this.label(g, String(Math.ceil(p.skillCd)), sx, sy + 1, '#ffffff', 11);
      else this.label(g, 'K', sx, sy + 1, '#140c1c', 11);
    }
  }
}
