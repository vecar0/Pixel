// 게임 시뮬레이션 (화면과 분리 — Node에서도 돌아감)
import { TILE, VIEW_W, VIEW_H, HEROES, WEAPONS, WEAPON_POOL, ENEMIES, BOSSES, BUFFS, baseMods, RARITY } from './data.js';
import { mulberry, makeRoom, floorPlan, isBossFloor, themeOf, FLOOR_ROW, T_SOLID, T_PLAT, T_SPIKE, T_DOOR } from './level.js';

const G = 980, JUMP_V = 345, MAX_FALL = 460;
const DEG = Math.PI / 180;
const MAX_BULLETS = 320, MAX_PARTICLES = 420;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const cx = e => e.x + e.w / 2, cy = e => e.y + e.h / 2;
const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

export class Game {
  constructor({ hero = 'miyu', seed = (Math.random() * 1e9) | 0, perks = {}, startFloor = 1 } = {}) {
    this.rng = mulberry(seed);
    this.seed = seed;
    this.heroId = hero;
    this.hero = HEROES[hero];
    this.perks = perks;
    this.mods = baseMods();
    this.taken = {};
    this.floor = startFloor;
    this.coins = (perks.coin || 0) * 25;
    this.kills = 0; this.gemsEarned = 0; this.time = 0; this.bossKills = 0;
    this.state = 'play';
    this.ev = [];
    this.bullets = []; this.enemies = []; this.particles = []; this.texts = []; this.pickups = [];
    this.items = []; this.chests = []; this.props = []; this.slashes = []; this.lines = [];
    this.cam = { x: 0, y: 0, shake: 0 };
    this.god = false;
    this.p = this.makePlayer();
    for (let i = 0; i < (perks.luck || 0); i++) { const c = this.buffChoices(1)[0]; if (c) this.applyBuff(c.id, true); }
    this.startFloor(startFloor);
  }

  emit(t, o = {}) { this.ev.push({ t, ...o }); }
  sfx(id) { this.ev.push({ t: 'sfx', id }); }
  shake(a) { this.cam.shake = Math.max(this.cam.shake, a); }

  /* ───────── 플레이어 ───────── */
  makePlayer() {
    const h = this.hero;
    const p = {
      x: 40, y: 0, w: 10, h: 22, vx: 0, vy: 0, onGround: false, face: 1,
      weapons: [h.weapon, null], cur: 0, cool: 0, inv: 0, armorT: 0, regenAcc: 0,
      skillCd: 0, skillT: 0, airJumps: 0, coyote: 0, jumpBuf: 0, aim: 0, anim: 0, dashT: 0, dashVX: 0, dashVY: 0,
      dashHit: new Set(), hurtT: 0, dead: false, deathT: 0, dropT: 0, target: null, noEnergyT: 0, shieldReady: false, recoil: 0,
    };
    p.hp = this.maxHp(); p.armor = this.maxArmor(); p.energy = this.maxEnergy();
    return p;
  }
  maxHp() { return this.hero.hp + (this.perks.hp || 0) + this.mods.maxHp; }
  maxArmor() { return this.hero.armor + this.mods.maxArmor; }
  maxEnergy() { return this.hero.energy + (this.perks.energy || 0) * 30 + this.mods.maxEnergy; }
  critChance(w) { return this.hero.crit + this.mods.crit + (w.crit || 0); }
  weapon() { return WEAPONS[this.p.weapons[this.p.cur]]; }

  /* ───────── 층/방 ───────── */
  startFloor(f) {
    this.floor = f;
    this.theme = themeOf(f);
    this.plan = floorPlan(f, this.rng);
    this.roomIdx = 0;
    this.loadRoom();
    this.emit('floor', { floor: f });
  }
  isLastRoom() { return this.roomIdx === this.plan.length - 1; }

  loadRoom() {
    const type = this.plan[this.roomIdx];
    this.room = makeRoom(type, this.floor, this.rng);
    this.bullets.length = 0; this.enemies.length = 0; this.pickups.length = 0; this.items.length = 0;
    this.chests.length = 0; this.props.length = 0; this.slashes.length = 0; this.lines.length = 0; this.particles.length = 0;
    const p = this.p;
    p.x = 2 * TILE + 6; p.y = FLOOR_ROW * TILE - p.h; p.vx = 0; p.vy = 0;
    p.shieldReady = this.mods.roomShield;
    this.cam.x = 0; this.boss = null;
    const R = this.room, W = R.W * TILE, gy = FLOOR_ROW * TILE;
    R.wave = 0; R.waves = 0; R.waveDelay = 0; R.bossT = 0;
    if (type === 'start') {
      if (this.floor === 1 && this.perks.weapon) this.addChest(W / 2 + 40, 'weapon');
      if (this.floor === 1) this.props.push({ kind: 'sign', x: W / 2 - 60, y: gy - 14, text: 'tutorial' });
    } else if (type === 'combat') {
      R.waves = 2 + (this.floor >= 3 ? 1 : 0) + (this.floor >= 12 ? 1 : 0);
    } else if (type === 'chest') {
      this.addChest(W / 2 - 30, 'weapon'); this.addChest(W / 2 + 30, 'wood');
    } else if (type === 'shop') {
      this.props.push({ kind: 'merchant', x: W / 2 - 10, y: gy - 16 });
      const slots = [W / 2 - 110, W / 2 - 60, W / 2 + 50, W / 2 + 100];
      const goods = [
        { kind: 'weapon', id: this.rollWeapon(1) },
        { kind: 'weapon', id: this.rollWeapon(2) },
        { kind: 'potion' },
        { kind: this.rng.chance(0.5) ? 'buff' : 'energy' },
      ];
      goods.forEach((gd, i) => {
        let price;
        if (gd.kind === 'weapon') price = 20 + WEAPONS[gd.id].rarity * 22 + this.floor * 3;
        else if (gd.kind === 'potion') price = 14 + this.floor * 2;
        else if (gd.kind === 'energy') price = 10 + this.floor;
        else price = 45 + this.floor * 4;
        price = Math.round(price * (1 - this.mods.discount));
        this.props.push({ kind: 'shop', x: slots[i], y: gy - 18, good: gd, price, sold: false });
      });
    } else if (type === 'statue') {
      this.props.push({ kind: 'statue', x: W / 2 - 7, y: gy - 16, used: false });
    } else if (type === 'boss') {
      R.locked = true; R.bossT = 1.4;
    }
    this.emit('room', { type, idx: this.roomIdx, total: this.plan.length });
  }

  nextRoom() {
    if (this.isLastRoom()) return;
    this.roomIdx++;
    this.loadRoom();
    this.sfx('door');
  }

  /* ───────── 메인 업데이트 ───────── */
  update(dt, inp) {
    if (this.state === 'pick' || this.state === 'over') return;
    this.time += dt;
    const p = this.p;
    if (this.state === 'dead') {
      p.deathT += dt;
      this.updateParticles(dt);
      if (p.deathT > 1.6) { this.state = 'over'; this.emit('over'); }
      return;
    }
    this.updatePlayer(dt, inp);
    this.updateRoom(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateSlashes(dt);
    this.updatePickups(dt);
    this.updateFocus(inp);
    this.updateParticles(dt);
    this.updateCamera(dt);
  }

  solidAt(tx, ty) {
    const R = this.room;
    if (tx < 0 || tx >= R.W || ty < 0 || ty >= R.H) return true;
    const v = R.t[ty * R.W + tx];
    if (v === T_SOLID) return true;
    if (v === T_DOOR) return !(R.cleared && !this.isLastRoom());
    return false;
  }
  tileAt(tx, ty) { const R = this.room; if (tx < 0 || tx >= R.W || ty < 0 || ty >= R.H) return T_SOLID; return R.t[ty * R.W + tx]; }
  solidPx(x, y) { return this.solidAt(Math.floor(x / TILE), Math.floor(y / TILE)); }

  move(e, dt, { oneway = true, drop = false } = {}) {
    let hitX = false, hitY = false;
    e.vx = clamp(e.vx, -700, 700); e.vy = clamp(e.vy, -700, 700);
    // X
    e.x += e.vx * dt;
    const y0 = Math.floor(e.y / TILE), y1 = Math.floor((e.y + e.h - 0.01) / TILE);
    if (e.vx > 0) {
      const tx = Math.floor((e.x + e.w - 0.01) / TILE);
      for (let ty = y0; ty <= y1; ty++) if (this.solidAt(tx, ty)) { e.x = tx * TILE - e.w; e.vx = 0; hitX = true; break; }
    } else if (e.vx < 0) {
      const tx = Math.floor(e.x / TILE);
      for (let ty = y0; ty <= y1; ty++) if (this.solidAt(tx, ty)) { e.x = (tx + 1) * TILE; e.vx = 0; hitX = true; break; }
    }
    // Y
    const prevBottom = e.y + e.h;
    e.y += e.vy * dt;
    e.onGround = false;
    const x0 = Math.floor(e.x / TILE), x1 = Math.floor((e.x + e.w - 0.01) / TILE);
    if (e.vy > 0) {
      const ty = Math.floor((e.y + e.h - 0.01) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        const solid = this.solidAt(tx, ty);
        const plat = oneway && !drop && this.tileAt(tx, ty) === T_PLAT && prevBottom <= ty * TILE + 0.5;
        if (solid || plat) { e.y = ty * TILE - e.h; e.vy = 0; e.onGround = true; hitY = true; break; }
      }
    } else if (e.vy < 0) {
      const ty = Math.floor(e.y / TILE);
      for (let tx = x0; tx <= x1; tx++) if (this.solidAt(tx, ty)) { e.y = (ty + 1) * TILE; e.vy = 0; hitY = true; break; }
    }
    return { hitX, hitY };
  }

  los(ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 8);
    for (let i = 1; i < n; i++) { const t = i / n; if (this.solidPx(ax + (bx - ax) * t, ay + (by - ay) * t)) return false; }
    return true;
  }

  updatePlayer(dt, inp) {
    const p = this.p, m = this.mods, w = this.weapon();
    p.anim += dt;
    p.inv = Math.max(0, p.inv - dt); p.cool -= dt; p.hurtT = Math.max(0, p.hurtT - dt);
    p.noEnergyT = Math.max(0, p.noEnergyT - dt); p.recoil = Math.max(0, p.recoil - dt * 8);
    if (p.skillCd > 0) p.skillCd -= dt;
    if (p.skillT > 0) { p.skillT -= dt; if (this.time % 0.05 < dt) this.spark(cx(p) + (this.rng() - 0.5) * 14, p.y + this.rng() * p.h, ['#ff6fb8', '#7af0ff', '#ffd75a'][(this.time * 20 | 0) % 3], 1); }
    // 에너지 미세 재생 (진행 불가 방지)
    if (p.energy < this.maxEnergy() * 0.25) p.energy += dt * 1.5;
    // 아머 재생
    p.armorT -= dt;
    if (p.armorT <= 0 && p.armor < this.maxArmor()) {
      p.regenAcc += dt * m.armorRegenMul;
      if (p.regenAcc >= 0.75) { p.regenAcc = 0; p.armor++; this.sfx('armor'); }
    }
    // 대시 (하루 스킬)
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashVX; p.vy = p.dashVY;
      this.move(p, dt, { drop: true });
      const dmg = (14 + this.floor * 1.6) * m.skillDmg * m.dmgMul;
      for (const e of this.enemies) if (!e.spawnT && !p.dashHit.has(e) && overlap(p, e, 0)) { p.dashHit.add(e); this.hurtEnemy(e, dmg, true, p.dashVX > 0 ? 1 : -1); }
      for (const b of this.bullets) if (b.team === 'e' && dist2(b.x, b.y, cx(p), cy(p)) < 400) { b.dead = true; this.spark(b.x, b.y, '#ffffff', 3); }
      this.particles.length < MAX_PARTICLES && this.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, t: 0, life: 0.18, ghost: true, face: p.face });
      if (p.dashT <= 0) { p.vx *= 0.25; p.vy = Math.min(p.vy, 0) * 0.3; }
      return;
    }
    // 이동
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const spd = this.hero.speed * m.speedMul;
    const target = dir * spd;
    p.vx += (target - p.vx) * Math.min(1, dt * (p.onGround ? 20 : 11));
    // 점프
    if (inp.jumpPressed) p.jumpBuf = 0.13;
    p.jumpBuf -= dt; p.coyote -= dt; p.dropT -= dt;
    if (p.onGround) { p.coyote = 0.09; p.airJumps = m.jumps - 1; }
    if (p.jumpBuf > 0) {
      if (inp.down && p.onGround && this.onPlatform(p)) { p.dropT = 0.22; p.jumpBuf = 0; p.y += 2; }
      else if (p.coyote > 0) { p.vy = -JUMP_V; p.coyote = 0; p.jumpBuf = 0; this.sfx('jump'); this.dust(cx(p), p.y + p.h, 4); }
      else if (p.airJumps > 0) { p.airJumps--; p.vy = -JUMP_V * 0.92; p.jumpBuf = 0; this.sfx('jump2'); this.ring(cx(p), p.y + p.h, '#ffffff', 8); }
    }
    if (!inp.jumpHeld && p.vy < -140) p.vy = -140;
    p.vy = Math.min(MAX_FALL, p.vy + G * dt);
    const wasAir = !p.onGround;
    const fallV = p.vy;
    this.move(p, dt, { drop: p.dropT > 0 });
    if (wasAir && p.onGround && fallV > 250) this.dust(cx(p), p.y + p.h, 5);
    // 가시
    const sx0 = Math.floor((p.x + 2) / TILE), sx1 = Math.floor((p.x + p.w - 2) / TILE), sty = Math.floor((p.y + p.h - 2) / TILE);
    for (let tx = sx0; tx <= sx1; tx++) if (this.tileAt(tx, sty) === T_SPIKE) { this.hurtPlayer(1, 'spike'); if (p.inv > 0) p.vy = -220; break; }
    // 조준
    p.target = null;
    let best = 330 * 330;
    for (const e of this.enemies) {
      if (e.spawnT || e.hp <= 0) continue;
      const d = dist2(cx(e), cy(e), cx(p), cy(p));
      if (d < best && this.los(cx(p), p.y + 8, cx(e), cy(e))) { best = d; p.target = e; }
    }
    const hx = cx(p), hy = p.y + 13;
    if (inp.mouseAim) p.aim = Math.atan2(inp.aimY - hy, inp.aimX - hx);
    else if (p.target) p.aim = Math.atan2(cy(p.target) - hy, cx(p.target) - hx);
    else p.aim = p.face > 0 ? 0 : Math.PI;
    if (inp.mouseAim || p.target) p.face = Math.cos(p.aim) >= 0 ? 1 : -1;
    else if (dir) { p.face = dir; p.aim = dir > 0 ? 0 : Math.PI; }
    // 무기 교체
    if (inp.swapPressed && p.weapons[1]) { p.cur = 1 - p.cur; p.cool = Math.max(p.cool, 0.15); this.sfx('swap'); this.emit('weapon'); }
    // 공격
    if (inp.attack && p.cool <= 0) this.attack(w);
    // 스킬
    if (inp.skillPressed && p.skillCd <= 0) this.useSkill();
  }

  onPlatform(e) {
    const ty = Math.floor((e.y + e.h + 1) / TILE);
    const x0 = Math.floor(e.x / TILE), x1 = Math.floor((e.x + e.w - 0.01) / TILE);
    let plat = false;
    for (let tx = x0; tx <= x1; tx++) { const v = this.tileAt(tx, ty); if (v === T_SOLID) return false; if (v === T_PLAT) plat = true; }
    return plat;
  }

  handPos() {
    const p = this.p;
    return [cx(p) + p.face * 6, p.y + 14];
  }

  attack(w) {
    const p = this.p, m = this.mods;
    const cost = w.energy * m.costMul;
    if (p.energy < cost) {
      if (p.noEnergyT <= 0) { this.text(cx(p), p.y - 6, '에너지 부족! 근접 치기', '#5cc8ff'); this.sfx('empty'); p.noEnergyT = 1.5; }
      p.cool = 0.32;
      return this.melee({ dmg: 3 + this.floor * 0.35, range: 26, arc: 130, colors: ['#fff', '#fff', '#aef3ff'], knock: 2 });
    }
    p.energy -= cost;
    const rush = p.skillT > 0 && this.heroId === 'miyu';
    p.cool = 1 / (w.rate * m.rateMul * (rush ? 2 : 1));
    if (w.kind === 'melee') return this.melee(w);
    const [hx, hy] = this.handPos();
    const shots = w.shots + m.extraShots + (rush ? 1 : 0);
    const fan = (w.fan || (shots > 1 ? 9 + shots * 2 : 0)) * DEG;
    const mx = hx + Math.cos(p.aim) * 12, my = hy + Math.sin(p.aim) * 12;
    for (let i = 0; i < shots; i++) {
      const off = shots > 1 ? -fan / 2 + fan * i / (shots - 1) : 0;
      const a = p.aim + off + (this.rng() - 0.5) * 2 * w.spread * DEG;
      const crit = this.rng() * 100 < this.critChance(w);
      const sp = w.speed * m.bulletSpeedMul;
      this.addBullet({
        x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, team: 'p', kind: w.bullet, color: w.bcolor,
        r: (w.bullet === 'plasma' ? 6 : w.bullet === 'rocket' ? 3 : w.bullet === 'bubble' ? 4 : 2.2) * m.bulletSize,
        dmg: w.dmg * m.dmgMul * (crit ? m.critMul : 1), crit, life: w.bullet === 'boomer' ? 1.4 : 1.6,
        pierce: (w.pierce || 0) + m.pierce, bounce: (w.bounce || 0) + m.bounce, explode: w.explode || 0,
        homing: (w.homing || 0) + m.homing, slow: w.slow || 0, chain: w.chain || 0, knock: (w.knock || 1) * m.knockMul, t: 0,
      });
    }
    p.recoil = 1;
    if (w.shake) this.shake(w.shake);
    this.particles.length < MAX_PARTICLES && this.particles.push({ x: mx, y: my, vx: 0, vy: 0, t: 0, life: 0.06, c: '#ffffff', s: 4, flash: true });
    this.sfx(w.bullet === 'laser' || w.bullet === 'bolt' ? 'laser' : w.bullet === 'rocket' || w.bullet === 'plasma' ? 'boom_shot' : w.shots > 3 ? 'shotgun' : w.bullet === 'star' ? 'magic' : 'shoot');
  }

  melee(w) {
    const p = this.p, m = this.mods;
    const range = w.range * m.meleeRange, arc = w.arc * DEG;
    const crit = this.rng() * 100 < this.critChance(w);
    const dmg = w.dmg * m.dmgMul * m.meleeDmg * (crit ? m.critMul : 1);
    const ox = cx(p), oy = p.y + 12;
    this.slashes.push({ x: ox, y: oy, a: p.aim, range, arc, t: 0, life: 0.14, color: w.colors[2], flip: (this.slashes.flipN = !this.slashes.flipN) });
    for (const e of this.enemies) {
      if (e.spawnT || e.hp <= 0) continue;
      const ex = clamp(ox, e.x, e.x + e.w), ey = clamp(oy, e.y, e.y + e.h);
      const d = Math.hypot(ex - ox, ey - oy);
      const ang = Math.atan2(cy(e) - oy, cx(e) - ox);
      if (d < range && (Math.abs(angDiff(ang, p.aim)) < arc / 2 || d < 10)) this.hurtEnemy(e, dmg, crit, Math.cos(p.aim) >= 0 ? 1 : -1, (w.knock || 1.5) * m.knockMul);
    }
    // 근접 공격은 적 탄을 지운다
    for (const b of this.bullets) {
      if (b.team !== 'e') continue;
      const d = Math.hypot(b.x - ox, b.y - oy);
      if (d < range + 4 && Math.abs(angDiff(Math.atan2(b.y - oy, b.x - ox), p.aim)) < arc / 2 + 0.2) { b.dead = true; this.spark(b.x, b.y, '#ffffff', 3); }
    }
    if (w.wave) {
      const sp = 300 * m.bulletSpeedMul;
      this.addBullet({ x: ox + Math.cos(p.aim) * 10, y: oy + Math.sin(p.aim) * 10, vx: Math.cos(p.aim) * sp, vy: Math.sin(p.aim) * sp, team: 'p', kind: 'wave', color: w.colors[2], r: 6 * m.bulletSize, dmg: dmg * 0.6, crit, life: 0.45, pierce: 99, bounce: 0, explode: 0, homing: 0, knock: 1, t: 0, a: p.aim });
    }
    if (w.shake) this.shake(w.shake);
    this.sfx('slash');
  }

  useSkill() {
    const p = this.p, m = this.mods, h = this.hero;
    p.skillCd = h.skill.cd * m.cdMul;
    if (this.heroId === 'miyu') {
      p.skillT = h.skill.dur * m.skillDur;
      p.skillCd += p.skillT;
      this.ring(cx(p), cy(p), '#ff6fb8', 18); this.sfx('skill');
      this.text(cx(p), p.y - 10, '콤보 러시!', '#ff6fb8', true);
    } else if (this.heroId === 'luna') {
      p.energy = Math.min(this.maxEnergy(), p.energy + 30);
      const targets = this.enemies.filter(e => !e.spawnT && e.hp > 0 && Math.abs(cx(e) - (this.cam.x + VIEW_W / 2)) < VIEW_W / 2 + 20);
      const n = Math.round(12 * (1 + (m.skillDur - 1) * 0.5));
      for (let i = 0; i < n; i++) {
        const tg = targets.length ? targets[i % targets.length] : null;
        const tx = tg ? cx(tg) + (this.rng() - 0.5) * 16 : this.cam.x + 40 + this.rng() * (VIEW_W - 80);
        const ty = tg ? cy(tg) : FLOOR_ROW * TILE - 4;
        const sx = tx - 60 - this.rng() * 40, sy = 30 - i * 14;
        const ang = Math.atan2(ty - sy, tx - sx), sp = 360;
        this.addBullet({ x: sx, y: sy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, team: 'p', kind: 'meteor', color: '#ffb347', r: 5, dmg: (10 + this.floor * 1.3) * m.skillDmg * m.dmgMul, crit: false, life: 2, pierce: 0, bounce: 0, explode: 28, homing: 0, knock: 1, t: 0, ghost: true, ty });
      }
      this.sfx('skill'); this.text(cx(p), p.y - 10, '유성우!', '#ffd75a', true);
    } else if (this.heroId === 'haru') {
      const a = p.aim;
      p.dashT = 0.17 * (1 + (m.skillDur - 1) * 0.5); p.dashVX = Math.cos(a) * 640; p.dashVY = Math.sin(a) * 640 * 0.6;
      p.face = Math.cos(a) >= 0 ? 1 : -1;
      p.dashHit = new Set(); p.inv = Math.max(p.inv, p.dashT + 0.1);
      this.sfx('dash');
    }
    this.emit('skill');
  }

  hurtPlayer(dmg, src) {
    const p = this.p, m = this.mods;
    if (p.inv > 0 || p.dashT > 0 || this.god || p.dead) return;
    if (p.shieldReady) { p.shieldReady = false; p.inv = 0.6; this.ring(cx(p), cy(p), '#7af0ff', 16); this.sfx('shield'); this.text(cx(p), p.y - 6, '보호막!', '#7af0ff'); return; }
    if (m.thorns) for (const e of this.enemies) if (!e.spawnT && dist2(cx(e), cy(e), cx(p), cy(p)) < 60 * 60) this.hurtEnemy(e, m.thorns * m.dmgMul, false, cx(e) > cx(p) ? 1 : -1);
    p.armorT = 2.6; p.regenAcc = 0;
    if (p.armor > 0) { p.armor -= dmg; if (p.armor < 0) { p.hp += p.armor; p.armor = 0; } this.sfx('armorhit'); }
    else { p.hp -= dmg; this.sfx('hurt'); }
    p.inv = 0.9 + m.iframe; p.hurtT = 0.25;
    this.shake(4);
    this.emit('hurt');
    if (p.hp <= 0) {
      if (m.revives > 0) {
        m.revives--; p.hp = Math.ceil(this.maxHp() / 2); p.inv = 2.5;
        for (const b of this.bullets) if (b.team === 'e') b.dead = true;
        this.ring(cx(p), cy(p), '#ffd75a', 30); this.text(cx(p), p.y - 10, '부활!', '#ffd75a', true); this.sfx('revive');
      } else {
        p.hp = 0; p.dead = true; this.state = 'dead'; p.deathT = 0;
        for (let i = 0; i < 24; i++) this.spark(cx(p), cy(p), ['#ffffff', this.hero.color, '#ff6fb8'][i % 3], 1, 160);
        this.sfx('die');
      }
    }
  }

  /* ───────── 방 진행 ───────── */
  updateRoom(dt) {
    const R = this.room, p = this.p;
    if (R.type === 'combat' && !R.cleared) {
      if (!R.locked && p.x > 6 * TILE) { R.locked = true; R.waveDelay = 0.4; this.sfx('lock'); this.emit('lock'); }
      if (R.locked) {
        const alive = this.enemies.some(e => e.hp > 0);
        if (!alive) {
          R.waveDelay -= dt;
          if (R.waveDelay <= 0) {
            if (R.wave < R.waves) { this.spawnWave(); R.wave++; R.waveDelay = 0.8; }
            else this.clearRoom();
          }
        }
      }
    }
    if (R.type === 'boss' && !R.cleared && R.bossT > 0) {
      R.bossT -= dt;
      if (R.bossT <= 0) this.spawnBoss();
    }
    // 오른쪽 문 통과
    if (R.cleared && !this.isLastRoom() && p.x + p.w > (R.W - 1) * TILE + 2) this.nextRoom();
    // 포탈
    for (const pr of this.props) if (pr.kind === 'portal') { pr.t = (pr.t || 0) + dt; }
  }

  clearRoom() {
    const R = this.room;
    R.cleared = true; R.locked = false;
    this.sfx('clear'); this.emit('clear');
    const gx = clamp(this.p.x + 40 * this.p.face, 3 * TILE, (R.W - 4) * TILE);
    if (R.type === 'combat') this.addChest(gx, this.rng.chance(0.28 + this.mods.discount * 0) ? 'weapon' : 'wood');
    for (const pk of this.pickups) pk.homing = true;
    if (this.isLastRoom()) this.spawnPortal();
  }
  spawnPortal() {
    const R = this.room;
    this.props.push({ kind: 'portal', x: (R.W - 4) * TILE, y: FLOOR_ROW * TILE - 40, t: 0 });
    this.text((R.W - 4) * TILE + 14, FLOOR_ROW * TILE - 50, '포탈 등장', '#b07aff', true);
  }

  enemyPool() {
    return Object.keys(ENEMIES).filter(k => ENEMIES[k].from <= this.floor);
  }
  spawnWave() {
    const R = this.room, f = this.floor;
    const count = Math.min(14, 3 + Math.floor(f * 0.75) + R.wave);
    const pool = this.enemyPool();
    const W = { slime: 3, bat: 3, goblin: 3, skeleton: 2, mage: 2, drone: 2 };
    const pts = R.spawns.filter(s => Math.abs(s.x * TILE - cx(this.p)) > 90);
    for (let i = 0; i < count; i++) {
      let tot = 0; for (const k of pool) tot += W[k];
      let r = this.rng() * tot, type = pool[0];
      for (const k of pool) { r -= W[k]; if (r <= 0) { type = k; break; } }
      const sp = pts.length ? this.rng.pick(pts) : { x: 20, y: FLOOR_ROW };
      const def = ENEMIES[type];
      const x = sp.x * TILE + (this.rng() - 0.5) * 20;
      const y = def.gravity ? sp.y * TILE - def.h : 50 + this.rng() * 90;
      const elite = f >= 4 && this.rng.chance(Math.min(0.3, 0.08 + f * 0.01));
      this.addEnemy(type, x, y, elite);
    }
  }
  addEnemy(type, x, y, elite = false) {
    const def = ENEMIES[type], f = this.floor;
    const hp = def.hp * (1 + (f - 1) * 0.17) * (elite ? 2.6 : 1);
    const e = {
      type, def, x, y, w: def.w, h: def.h, vx: 0, vy: 0, hp, maxHp: hp, elite, face: -1, t: 0,
      timer: 0.8 + this.rng() * 1.2, state: 'idle', stateT: 0, flash: 0, slowT: 0, onGround: false, spawnT: 0.7,
      tint: this.theme, aim: 0, casts: 0,
    };
    this.enemies.push(e);
    return e;
  }

  spawnBoss() {
    const f = this.floor, idx = (f / 5 - 1) % 3, cycle = Math.floor((f / 5 - 1) / 3);
    const def = BOSSES[idx];
    const R = this.room;
    const hp = def.hp * (1 + (f / 5 - 1) * 0.55 + cycle * 0.4);
    const e = {
      type: 'boss', boss: def.id, def: { name: def.name, contact: 2 }, x: (R.W - 8) * TILE, y: FLOOR_ROW * TILE - def.h - (def.id === 'crow' ? 90 : 0),
      w: def.w, h: def.h, vx: 0, vy: 0, hp, maxHp: hp, elite: true, face: -1, t: 0, timer: 1.4, state: 'idle', stateT: 0,
      flash: 0, slowT: 0, onGround: false, spawnT: 0.01, phase: 1, cycle, summoned: 0, pattern: 0, sub: 0,
    };
    this.enemies.push(e);
    this.boss = e;
    this.emit('boss', { name: def.name });
    this.sfx('bossin');
    this.shake(6);
  }

  /* ───────── 적 ───────── */
  updateEnemies(dt) {
    const p = this.p, f = this.floor;
    const atk = Math.min(1.8, 1 + f * 0.04);
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (e.spawnT > 0) { e.spawnT -= dt; if (e.spawnT <= 0) { e.spawnT = 0; this.ring(cx(e), cy(e), '#ffffff', 8); } continue; }
      e.t += dt; e.flash = Math.max(0, e.flash - dt);
      const slow = e.slowT > 0 ? 0.5 : 1; e.slowT -= dt;
      const edt = dt * slow;
      const dx = cx(p) - cx(e), dy = cy(p) - cy(e), dist = Math.hypot(dx, dy);
      if (e.type !== 'boss') e.face = dx > 0 ? 1 : -1;
      e.timer -= edt;
      switch (e.type === 'boss' ? e.boss : e.def.ai) {
        case 'hopper': this.aiHopper(e, edt, dx, atk); break;
        case 'bat': this.aiBat(e, edt, dx, dy, dist, atk); break;
        case 'archer': this.aiArcher(e, edt, dx, dist, atk); break;
        case 'shield': this.aiShield(e, edt, dx, dist, atk); break;
        case 'mage': this.aiMage(e, edt, dist, atk); break;
        case 'drone': this.aiDrone(e, edt, dx, dy, dist, atk); break;
        case 'king': this.bossKing(e, edt, dx); break;
        case 'crow': this.bossCrow(e, edt, dx, dy); break;
        case 'maid': this.bossMaid(e, edt, dx, dist); break;
      }
      // 방 밖 이탈 방지
      const RW = this.room.W * TILE;
      if (e.x < TILE || e.x + e.w > RW - TILE || e.y < 2 * TILE || e.y + e.h > FLOOR_ROW * TILE) {
        e.x = clamp(e.x, TILE, RW - TILE - e.w); e.y = clamp(e.y, 2 * TILE, FLOOR_ROW * TILE - e.h);
      }
      // 접촉 피해
      if (overlap(p, e, e.type === 'boss' ? 6 : 3)) this.hurtPlayer(e.def.contact || 1, 'touch');
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].hp <= 0) this.enemies.splice(i, 1);
  }

  ground(e, dt, fric = 8) {
    e.vy = Math.min(MAX_FALL, e.vy + G * dt);
    if (e.onGround) e.vx -= e.vx * Math.min(1, dt * fric);
    return this.move(e, dt);
  }
  eShoot(e, ang, sp, o = {}) {
    this.addBullet({ x: cx(e) + Math.cos(ang) * 6, y: cy(e) + Math.sin(ang) * 6 - 2, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, team: 'e', kind: o.kind || 'eball', color: o.color || '#ff4f6a', r: o.r || 3.2, dmg: o.dmg || 1, life: o.life || 4, grav: o.grav || 0, pierce: 0, bounce: 0, explode: 0, t: 0 });
  }
  eSpeed(base) { return Math.min(base * 1.6, base + this.floor * 3); }

  aiHopper(e, dt, dx, atk) {
    if (e.onGround && e.timer <= 0) {
      e.vy = -200 - this.rng() * 110; e.vx = Math.sign(dx) * e.def.speed * (1.4 + this.rng() * 0.6);
      e.timer = 1.15 / atk + this.rng() * 0.6; e.state = 'air';
    }
    const was = e.state === 'air' && !e.onGround;
    this.ground(e, dt, 12);
    if (was && e.onGround) {
      e.state = 'idle';
      if (e.elite || this.floor >= 7) for (let i = 0; i < 3; i++) this.eShoot(e, -Math.PI / 2 + (i - 1) * 0.5, 150, { grav: 1, color: '#7dff8a', r: 3 });
    }
  }
  aiBat(e, dt, dx, dy, dist, atk) {
    if (e.state === 'idle') {
      const tx = dx + Math.sin(e.t * 2 + e.x) * 50, ty = dy - 50 + Math.sin(e.t * 3) * 14;
      const l = Math.hypot(tx, ty) || 1;
      e.vx += (tx / l * e.def.speed - e.vx) * dt * 3; e.vy += (ty / l * e.def.speed - e.vy) * dt * 3;
      if (e.timer <= 0 && dist < 230) { e.state = 'wind'; e.stateT = 0.45; e.vx = 0; e.vy = 0; }
    } else if (e.state === 'wind') {
      e.stateT -= dt; e.vx = 0; e.vy = 0;
      if (e.stateT <= 0) { const l = dist || 1; e.vx = dx / l * 210; e.vy = dy / l * 210; e.state = 'dash'; e.stateT = 0.55; }
    } else {
      e.stateT -= dt;
      if (e.stateT <= 0) { e.state = 'idle'; e.timer = 1.6 / atk + this.rng(); if (e.elite) for (let i = 0; i < 6; i++) this.eShoot(e, i * Math.PI / 3, 110); }
    }
    const r = this.move(e, dt, { oneway: false });
    if (r.hitX) e.vx = -e.vx * 0.5; if (r.hitY) e.vy = -e.vy * 0.5;
  }
  aiArcher(e, dt, dx, dist, atk) {
    if (e.state === 'aim') {
      e.stateT -= dt; e.vx = 0;
      e.aim = Math.atan2(cy(this.p) - cy(e), cx(this.p) - cx(e));
      if (e.stateT <= 0) {
        const sp = this.eSpeed(135);
        if (e.elite) for (let i = -1; i <= 1; i++) this.eShoot(e, e.aim + i * 0.22, sp, { kind: 'arrow', color: '#ffe14f' });
        else this.eShoot(e, e.aim, sp, { kind: 'arrow', color: '#ffe14f' });
        e.state = 'idle'; e.timer = 1.7 / atk + this.rng() * 0.8; this.sfx('ebow');
      }
    } else {
      const ad = Math.abs(dx);
      const want = ad < 90 ? -Math.sign(dx) : ad > 160 ? Math.sign(dx) : 0;
      e.vx += (want * e.def.speed - e.vx) * dt * 6;
      if (e.onGround && this.rng() < dt * 0.5) e.vy = -240;
      if (e.timer <= 0 && dist < 300 && this.los(cx(e), cy(e), cx(this.p), cy(this.p))) { e.state = 'aim'; e.stateT = 0.55; }
    }
    const r = this.ground(e, dt, 0);
    if (r.hitX && e.onGround) e.vy = -260;
  }
  aiShield(e, dt, dx, dist, atk) {
    if (e.state === 'wind') {
      e.stateT -= dt; e.vx = 0;
      if (e.stateT <= 0) {
        e.state = 'swing'; e.stateT = 0.18;
        const hb = { x: e.face > 0 ? e.x + e.w : e.x - 22, y: e.y, w: 22, h: e.h };
        if (overlap(this.p, hb, 0)) this.hurtPlayer(1, 'melee');
        this.slashes.push({ x: cx(e), y: cy(e), a: e.face > 0 ? 0 : Math.PI, range: 26, arc: Math.PI * 0.8, t: 0, life: 0.14, color: '#ff6a6a', enemy: true });
        this.sfx('eslash');
      }
    } else if (e.state === 'swing') { e.stateT -= dt; if (e.stateT <= 0) { e.state = 'idle'; e.timer = 1.1 / atk; } }
    else if (e.state === 'charge') { e.stateT -= dt; e.vx = e.face * 165; if (e.stateT <= 0) { e.state = 'idle'; e.timer = 1.5; } }
    else {
      e.vx += (Math.sign(dx) * e.def.speed - e.vx) * dt * 5;
      if (dist < 30 && e.timer <= 0) { e.state = 'wind'; e.stateT = 0.42; }
      else if (dist > 80 && dist < 200 && e.timer <= -2.5 && Math.abs(cy(this.p) - cy(e)) < 20) { e.state = 'charge'; e.stateT = 0.6; this.text(cx(e), e.y - 6, '!', '#ff4040'); }
    }
    const r = this.ground(e, dt, 0);
    if (r.hitX && e.onGround) e.vy = -250;
  }
  aiMage(e, dt, dist, atk) {
    if (e.state === 'cast') {
      e.stateT -= dt;
      if (this.rng() < 0.4) this.spark(cx(e) + (this.rng() - 0.5) * 14, e.y, '#c07aff', 1, 30);
      if (e.stateT <= 0) {
        const a = Math.atan2(cy(this.p) - cy(e), cx(this.p) - cx(e));
        const n = e.elite ? 5 : 3, sp = this.eSpeed(100);
        for (let i = 0; i < n; i++) this.eShoot(e, a + (i - (n - 1) / 2) * 0.28, sp, { color: '#c07aff', r: 3.5 });
        e.state = 'idle'; e.timer = 2.4 / atk + this.rng(); e.casts++; this.sfx('ecast');
        if (e.casts % 3 === 0) {
          const pts = this.room.spawns.filter(s => Math.abs(s.x * TILE - cx(this.p)) > 70);
          if (pts.length) { const s = this.rng.pick(pts); this.ring(cx(e), cy(e), '#c07aff', 10); e.x = s.x * TILE; e.y = s.y * TILE - e.h; e.vy = 0; this.ring(cx(e), cy(e), '#c07aff', 10); }
        }
      }
    } else if (e.timer <= 0 && dist < 320) { e.state = 'cast'; e.stateT = 0.6; }
    this.ground(e, dt, 10);
  }
  aiDrone(e, dt, dx, dy, dist, atk) {
    const tx = dx - Math.sign(dx) * 110, ty = dy - 42 + Math.sin(e.t * 2) * 18;
    const l = Math.hypot(tx, ty) || 1, sp = Math.min(e.def.speed, l * 2);
    e.vx += (tx / l * sp - e.vx) * dt * 3; e.vy += (ty / l * sp - e.vy) * dt * 3;
    if (e.state === 'burst') {
      e.stateT -= dt;
      if (e.stateT <= 0) {
        e.sub--; e.stateT = 0.14;
        this.eShoot(e, Math.atan2(cy(this.p) - cy(e), cx(this.p) - cx(e)), this.eSpeed(155), { color: '#ff3355', r: 2.6 });
        this.sfx('eshoot');
        if (e.sub <= 0) { e.state = 'idle'; e.timer = 2.1 / atk + this.rng(); }
      }
    } else if (e.timer <= 0 && dist < 300) { e.state = 'burst'; e.sub = e.elite ? 5 : 3; e.stateT = 0.35; }
    const r = this.move(e, dt, { oneway: false });
    if (r.hitX) e.vx = -e.vx; if (r.hitY) e.vy = -e.vy;
  }

  /* ───────── 보스 ───────── */
  bossPhase(e) {
    if (e.phase === 1 && e.hp < e.maxHp * 0.5) { e.phase = 2; this.text(cx(e), e.y - 10, '분노!', '#ff4f6a', true); this.shake(6); this.sfx('roar'); for (const b of this.bullets) if (b.team === 'e') b.dead = true; }
    return e.phase === 2 ? 1.35 : 1;
  }
  ring2(e, n, sp, off = 0, o = {}) { for (let i = 0; i < n; i++) this.eShoot(e, off + i * Math.PI * 2 / n, sp, o); }

  bossKing(e, dt, dx) {
    const rage = this.bossPhase(e), c = 1 + e.cycle * 0.2;
    e.face = dx > 0 ? 1 : -1;
    if (e.summoned < 1 && e.hp < e.maxHp * 0.66 || e.summoned < 2 && e.hp < e.maxHp * 0.33) {
      e.summoned++;
      for (let i = 0; i < 3 + e.cycle; i++) this.addEnemy('slime', cx(e) + (i - 1) * 20, e.y + e.h - 11, false);
      this.text(cx(e), e.y - 8, '분열!', '#7dff8a', true);
    }
    if (e.state === 'idle') {
      e.vx *= 0.9;
      if (e.timer <= 0 && e.onGround) {
        e.pattern = (e.pattern + 1 + (this.rng() < 0.4 ? 1 : 0)) % 3;
        if (e.pattern === 0) { e.state = 'crouch'; e.stateT = 0.5; }
        else if (e.pattern === 1) { e.state = 'spit'; e.sub = 3 + (rage > 1 ? 1 : 0); e.stateT = 0.4; }
        else { e.state = 'crouch'; e.stateT = 0.35; e.small = true; }
      }
    } else if (e.state === 'crouch') {
      e.stateT -= dt;
      if (e.stateT <= 0) {
        const tx = cx(this.p) - cx(e);
        e.vy = e.small ? -300 : -470; e.vx = clamp(tx * (e.small ? 1.6 : 1.05), -260, 260);
        e.state = 'air'; e.sfx = 1;
      }
    } else if (e.state === 'air') {
      if (e.onGround) {
        this.shake(e.small ? 4 : 8); this.sfx('slam');
        const n = Math.round((e.small ? 6 : 10) * rage);
        for (let i = 0; i < n; i++) {
          const a = -Math.PI + (i / (n - 1)) * Math.PI;
          this.eShoot(e, a, 140 * c, { color: '#6fd8ff', r: 4, grav: 0.6 });
        }
        for (let s = -1; s <= 1; s += 2) this.addBullet({ x: cx(e), y: e.y + e.h - 5, vx: s * 170 * c, vy: 0, team: 'e', kind: 'wave_e', color: '#6fd8ff', r: 5, dmg: 1, life: 2.5, pierce: 0, bounce: 0, explode: 0, t: 0 });
        e.state = 'idle'; e.timer = (e.small ? 0.5 : 1.2) / rage; e.small = false;
      }
    } else if (e.state === 'spit') {
      e.stateT -= dt;
      if (e.stateT <= 0) {
        e.sub--; e.stateT = 0.45 / rage;
        const a = Math.atan2(cy(this.p) - e.y, cx(this.p) - cx(e));
        for (let i = -2; i <= 2; i++) this.eShoot(e, a + i * 0.2 - 0.25, 170 * c, { color: '#6fd8ff', r: 4, grav: 0.5 });
        this.sfx('ecast');
        if (e.sub <= 0) { e.state = 'idle'; e.timer = 1 / rage; }
      }
    }
    this.ground(e, dt, 4);
  }

  bossCrow(e, dt, dx, dy) {
    const rage = this.bossPhase(e), c = 1 + e.cycle * 0.2;
    const R = this.room;
    e.face = dx > 0 ? 1 : -1;
    if (e.state === 'idle' || e.state === 'burst' || e.state === 'ring' || e.state === 'spiral') {
      const hx = clamp(cx(this.p) + Math.sin(e.t * 0.7) * 120, 60, R.W * TILE - 60), hy = 70 + Math.sin(e.t * 1.7) * 18;
      e.vx += ((hx - cx(e)) * 1.4 - e.vx) * dt * 2; e.vy += ((hy - cy(e)) * 2 - e.vy) * dt * 3;
    }
    if (e.state === 'idle') {
      if (e.timer <= 0) {
        e.pattern = (e.pattern + 1) % (rage > 1 ? 4 : 3);
        e.state = ['burst', 'ring', 'dive', 'spiral'][e.pattern];
        e.sub = e.state === 'burst' ? 4 : e.state === 'ring' ? 3 : e.state === 'spiral' ? 36 : 1;
        e.stateT = e.state === 'dive' ? 0.7 : 0.3;
        if (e.state === 'dive') { e.vx = 0; e.vy = 0; e.diveX = cx(this.p); e.diveY = cy(this.p); this.lines.push({ x1: cx(e), y1: cy(e), x2: e.diveX, y2: e.diveY, t: 0, life: 0.7, color: '#ff2d55' }); }
      }
    } else if (e.state === 'burst') {
      e.stateT -= dt;
      if (e.stateT <= 0) {
        e.sub--; e.stateT = 0.32 / rage;
        const a = Math.atan2(cy(this.p) - cy(e), cx(this.p) - cx(e));
        for (let i = -2; i <= 2; i++) this.eShoot(e, a + i * 0.14, 190 * c, { color: '#ffb02e', r: 3, kind: 'feather' });
        this.sfx('eshoot');
        if (e.sub <= 0) { e.state = 'idle'; e.timer = 1.2 / rage; }
      }
    } else if (e.state === 'ring') {
      e.stateT -= dt;
      if (e.stateT <= 0) { e.sub--; e.stateT = 0.5 / rage; this.ring2(e, 16, 120 * c, e.sub * 0.2, { color: '#7af0ff', r: 3.5 }); this.sfx('ecast'); if (e.sub <= 0) { e.state = 'idle'; e.timer = 1.3 / rage; } }
    } else if (e.state === 'spiral') {
      e.stateT -= dt;
      if (e.stateT <= 0) { e.sub--; e.stateT = 0.07; const a = e.t * 5; this.eShoot(e, a, 130 * c, { color: '#ff2d55', r: 3 }); this.eShoot(e, a + Math.PI, 130 * c, { color: '#ff2d55', r: 3 }); if (e.sub <= 0) { e.state = 'idle'; e.timer = 1.2; } }
    } else if (e.state === 'dive') {
      e.stateT -= dt;
      if (e.stateT <= 0 && e.sub > 0) {
        e.sub = 0; const a = Math.atan2(e.diveY - cy(e), e.diveX - cx(e));
        e.vx = Math.cos(a) * 420; e.vy = Math.sin(a) * 420; e.stateT = 0.7; this.sfx('dash');
      } else if (e.sub === 0) {
        if (e.stateT <= 0) { e.state = 'idle'; e.timer = 0.9 / rage; }
      } else { e.vx *= 0.8; e.vy *= 0.8; }
    }
    const r = this.move(e, dt, { oneway: false });
    if ((r.hitX || r.hitY) && e.state === 'dive' && e.sub === 0) {
      this.shake(6); this.sfx('slam');
      this.ring2(e, 10, 140 * c, 0, { color: '#ffb02e', r: 3 });
      e.state = 'idle'; e.timer = 1 / rage; e.vx = 0; e.vy = -120;
    }
  }

  bossMaid(e, dt, dx, dist) {
    const rage = this.bossPhase(e), c = 1 + e.cycle * 0.2;
    const R = this.room;
    if (e.state !== 'dash') e.face = dx > 0 ? 1 : -1;
    if (e.state === 'idle') {
      if (e.timer <= 0) {
        e.pattern = (e.pattern + 1 + (this.rng() < 0.3 ? 1 : 0)) % 4;
        e.state = ['blink', 'knives', 'dashwind', 'summon'][e.pattern]; e.stateT = 0.45; e.sub = rage > 1 ? 2 : 1;
        if (e.state === 'dashwind') { e.stateT = 0.75; const y = e.y + e.h / 2; this.lines.push({ x1: TILE, y1: y, x2: (R.W - 1) * TILE, y2: y, t: 0, life: 0.75, color: '#ff2d7a', w: 8 }); }
      }
    } else if (e.state === 'blink') {
      e.stateT -= dt;
      if (e.stateT <= 0) {
        this.ring(cx(e), cy(e), '#ff2d7a', 14);
        const side = this.p.face > 0 ? -1 : 1;
        e.x = clamp(cx(this.p) + side * 34 - e.w / 2, TILE, (R.W - 2) * TILE - e.w); e.y = this.p.y + this.p.h - e.h; e.vy = 0;
        this.ring(cx(e), cy(e), '#ff2d7a', 14); this.sfx('blink');
        e.state = 'slashwind'; e.stateT = 0.42 / Math.sqrt(rage); e.face = cx(this.p) > cx(e) ? 1 : -1;
      }
    } else if (e.state === 'slashwind') {
      e.stateT -= dt;
      if (e.stateT <= 0) {
        const hb = { x: e.face > 0 ? cx(e) : cx(e) - 46, y: e.y + 10, w: 46, h: e.h - 10 };
        if (overlap(this.p, hb, 0)) this.hurtPlayer(2, 'boss');
        this.slashes.push({ x: cx(e), y: cy(e) + 6, a: e.face > 0 ? 0 : Math.PI, range: 46, arc: Math.PI, t: 0, life: 0.16, color: '#ff2d7a', enemy: true });
        this.sfx('eslash'); this.shake(3);
        e.sub--; if (e.sub > 0) { e.state = 'blink'; e.stateT = 0.25; } else { e.state = 'idle'; e.timer = 1 / rage; }
      }
    } else if (e.state === 'knives') {
      e.stateT -= dt;
      if (e.stateT <= 0) {
        const n = rage > 1 ? 11 : 7, a = Math.atan2(cy(this.p) - cy(e), cx(this.p) - cx(e));
        for (let i = 0; i < n; i++) this.eShoot(e, a + (i - (n - 1) / 2) * 0.16, 200 * c, { kind: 'knife', color: '#e8e8ff', r: 2.5 });
        this.sfx('eshoot');
        e.sub--; if (e.sub > 0) e.stateT = 0.4; else { e.state = 'idle'; e.timer = 1.1 / rage; }
      }
    } else if (e.state === 'dashwind') {
      e.stateT -= dt; e.vx = 0;
      if (e.stateT <= 0) { e.state = 'dash'; e.face = cx(e) < R.W * TILE / 2 ? 1 : -1; e.stateT = 1.2; this.sfx('dash'); }
    } else if (e.state === 'dash') {
      e.stateT -= dt; e.vx = e.face * 460;
      if (this.rng() < 0.6) this.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.2, ghost: true, boss: true, face: e.face });
      const hitWall = (e.face > 0 && e.x + e.w >= (R.W - 1) * TILE - 1) || (e.face < 0 && e.x <= TILE + 1);
      if (hitWall || e.stateT <= 0) {
        e.vx = 0; this.shake(4);
        this.ring2(e, rage > 1 ? 12 : 8, 120 * c, 0, { kind: 'knife', color: '#ff6fb0', r: 2.5 });
        e.state = 'idle'; e.timer = 0.9 / rage;
      }
    } else if (e.state === 'summon') {
      e.stateT -= dt;
      if (e.stateT <= 0) {
        for (let i = 0; i < 2 + e.cycle; i++) this.addEnemy('bat', cx(e) + (i - 1) * 24, e.y - 20, false);
        this.text(cx(e), e.y - 8, '나와라!', '#ff2d7a'); e.state = 'idle'; e.timer = 1.4 / rage;
      }
    }
    if (e.state !== 'dash') this.ground(e, dt, 8); else this.move(e, dt);
  }

  hurtEnemy(e, dmg, crit, kdir = 0, knock = 1) {
    if (e.hp <= 0) return;
    if (e.elite || e.type === 'boss') dmg *= this.mods.bigDmgMul;
    e.hp -= dmg; e.flash = 0.08;
    if (e.type !== 'boss') { e.vx += kdir * 60 * knock; if (e.def.gravity === false) e.vy -= 10; }
    this.text(cx(e) + (this.rng() - 0.5) * 8, e.y - 2, String(Math.max(1, Math.round(dmg))), crit ? '#ffd75a' : '#ffffff', crit);
    this.sfx(crit ? 'crit' : 'hit');
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    const p = this.p, m = this.mods;
    this.kills++;
    const n = e.type === 'boss' ? 30 : 10;
    for (let i = 0; i < n; i++) this.spark(cx(e), cy(e), i % 2 ? '#ffffff' : (e.type === 'slime' ? '#7dff8a' : e.elite ? '#ffd75a' : '#ff6fb8'), 1, 140);
    if (e.type === 'boss') {
      this.shake(10); this.sfx('bossdie');
      for (const b of this.bullets) if (b.team === 'e') b.dead = true;
      for (const o of this.enemies) if (o !== e) o.hp = 0;
      this.bossKills++; this.boss = null;
      this.addChest(cx(e) - 7, 'gold');
      for (let i = 0; i < 20; i++) this.dropPickup(cx(e), cy(e), 'coin');
      this.room.cleared = true; this.room.locked = false;
      this.spawnPortal(); this.emit('bossdown');
      return;
    }
    this.sfx('kill');
    const [a, b] = e.def.coin;
    let coins = Math.round((a + this.rng() * (b - a)) * m.coinMul * (e.elite ? 3 : 1));
    for (let i = 0; i < coins; i++) this.dropPickup(cx(e), cy(e), 'coin');
    const orbs = 1 + (this.rng() * 2 | 0) + (e.elite ? 3 : 0);
    for (let i = 0; i < orbs; i++) this.dropPickup(cx(e), cy(e), 'orb');
    if (this.rng() < (e.elite ? 0.15 : 0.025)) this.dropPickup(cx(e), cy(e), 'potion');
    if (m.healChance && this.rng() < m.healChance && p.hp < this.maxHp()) { p.hp++; this.text(cx(p), p.y - 8, '+1 HP', '#ff4f6a'); }
    if (m.energyOnKill) p.energy = Math.min(this.maxEnergy(), p.energy + m.energyOnKill);
    if (p.skillT > 0 && this.heroId === 'miyu') p.skillT = Math.min(p.skillT + 1, 15);
    if (e.elite && this.rng() < 0.12) this.items.push({ x: cx(e) - 8, y: e.y, vy: -150, id: this.rollWeapon(1), t: 0 });
  }

  /* ───────── 탄 ───────── */
  addBullet(b) {
    if (this.bullets.length >= MAX_BULLETS) this.bullets.shift();
    b.hit = null; this.bullets.push(b);
  }
  updateBullets(dt) {
    const p = this.p;
    for (const b of this.bullets) {
      if (b.dead) continue;
      b.t += dt; b.life -= dt;
      if (b.life <= 0) { b.dead = true; if (b.explode) this.explode(b.x, b.y, b.explode, b.dmg, b); continue; }
      if (b.grav) b.vy += G * 0.5 * b.grav * dt;
      if (b.team === 'p' && b.homing) {
        let best = null, bd = 160 * 160;
        for (const e of this.enemies) { if (e.spawnT || e.hp <= 0) continue; const d = dist2(cx(e), cy(e), b.x, b.y); if (d < bd) { bd = d; best = e; } }
        if (best) {
          const cur = Math.atan2(b.vy, b.vx), want = Math.atan2(cy(best) - b.y, cx(best) - b.x);
          const na = cur + clamp(angDiff(want, cur), -b.homing * dt, b.homing * dt), sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
        }
      }
      if (b.kind === 'boomer' && b.t > 0.42) {
        const a = Math.atan2(cy(p) - b.y, cx(p) - b.x), sp = 300;
        b.vx += (Math.cos(a) * sp - b.vx) * dt * 6; b.vy += (Math.sin(a) * sp - b.vy) * dt * 6;
        if (dist2(b.x, b.y, cx(p), cy(p)) < 144) { b.dead = true; continue; }
        b.hit = null;
      }
      const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      if (!b.ghost && b.kind !== 'boomer' && this.solidPx(nx, ny)) {
        if (b.bounce > 0) {
          b.bounce--;
          if (this.solidPx(nx, b.y)) b.vx = -b.vx; else b.vy = -b.vy;
          b.hit = null; continue;
        }
        b.dead = true; this.spark(b.x, b.y, b.color, 3);
        if (b.explode) this.explode(b.x, b.y, b.explode, b.dmg, b);
        continue;
      }
      b.x = nx; b.y = ny;
      if (b.kind === 'meteor' && b.y >= b.ty) { b.dead = true; this.explode(b.x, b.y, b.explode, b.dmg, b); continue; }
      if (b.team === 'p') {
        if (b.kind === 'meteor') continue;
        for (const e of this.enemies) {
          if (e.spawnT || e.hp <= 0) continue;
          if (b.x + b.r < e.x || b.x - b.r > e.x + e.w || b.y + b.r < e.y || b.y - b.r > e.y + e.h) continue;
          if (b.hit && b.hit.has(e)) continue;
          // 해골 방패 막기
          if (e.type === 'skeleton' && e.state !== 'wind' && Math.abs(b.vx) > Math.abs(b.vy) * 1.2 && Math.sign(b.vx) === -e.face && b.explode === 0 && b.kind !== 'wave') {
            b.dead = true; this.spark(b.x, b.y, '#ffffff', 4); this.sfx('block');
            if (!e.blockT || this.time - e.blockT > 0.5) { e.blockT = this.time; this.text(cx(e), e.y - 4, '막음', '#b9b39c'); }
            break;
          }
          (b.hit || (b.hit = new Set())).add(e);
          this.hurtEnemy(e, b.dmg, b.crit, Math.sign(b.vx), b.knock || 1);
          if (b.slow) e.slowT = b.slow;
          if (b.chain) this.chain(e, b);
          const boom = b.explode || (this.mods.explodeChance && this.rng() < this.mods.explodeChance ? 26 : 0);
          if (boom) this.explode(b.x, b.y, boom, b.dmg * (b.explode ? 1 : 0.5), b, e);
          if (b.pierce > 0) b.pierce--; else { b.dead = true; this.spark(b.x, b.y, b.color, 2); }
          break;
        }
      } else {
        const hx = cx(p), hy = p.y + p.h / 2;
        if (Math.abs(b.x - hx) < 4 + b.r && Math.abs(b.y - hy) < 9 + b.r) { b.dead = true; this.hurtPlayer(b.dmg, 'bullet'); }
      }
    }
    this.bullets = this.bullets.filter(b => !b.dead);
  }
  chain(from, b) {
    let cur = from; const hit = new Set([from]);
    for (let k = 0; k < b.chain; k++) {
      let best = null, bd = 110 * 110;
      for (const e of this.enemies) { if (hit.has(e) || e.spawnT || e.hp <= 0) continue; const d = dist2(cx(e), cy(e), cx(cur), cy(cur)); if (d < bd) { bd = d; best = e; } }
      if (!best) break;
      this.lines.push({ x1: cx(cur), y1: cy(cur), x2: cx(best), y2: cy(best), t: 0, life: 0.15, color: '#fff36a', bolt: true });
      hit.add(best); this.hurtEnemy(best, b.dmg * 0.7, false, 0); cur = best;
    }
  }
  explode(x, y, r, dmg, b, skip) {
    for (const e of this.enemies) {
      if (e === skip || e.spawnT || e.hp <= 0) continue;
      const ex = clamp(x, e.x, e.x + e.w), ey = clamp(y, e.y, e.y + e.h);
      if (dist2(ex, ey, x, y) < r * r) this.hurtEnemy(e, dmg, false, Math.sign(cx(e) - x), 2);
    }
    for (let i = 0; i < 14; i++) this.spark(x, y, ['#ffb347', '#ffd75a', '#ff6a3a', '#ffffff'][i % 4], 1, r * 4);
    this.particles.length < MAX_PARTICLES && this.particles.push({ x, y, vx: 0, vy: 0, t: 0, life: 0.22, boom: r });
    this.shake(Math.min(6, r / 8)); this.sfx('boom');
  }

  updateSlashes(dt) {
    for (const s of this.slashes) s.t += dt;
    this.slashes = this.slashes.filter(s => s.t < s.life);
    for (const l of this.lines) l.t += dt;
    this.lines = this.lines.filter(l => l.t < l.life);
  }

  /* ───────── 아이템 ───────── */
  dropPickup(x, y, kind) {
    this.pickups.push({ x, y, vx: (this.rng() - 0.5) * 140, vy: -120 - this.rng() * 120, w: 4, h: 4, kind, t: 0, homing: this.room.cleared, onGround: false });
  }
  addChest(x, kind) { this.chests.push({ x: x - 8, y: FLOOR_ROW * TILE - 30, w: 16, h: 11, vy: 0, kind, open: false, onGround: false, vx: 0 }); }
  rollWeapon(bonus = 0) {
    const f = this.floor;
    const w = [Math.max(10, 50 - f * 3), 30, 16 + f, 6 + f * 0.9, 1.5 + f * 0.5];
    for (let i = 0; i < bonus; i++) { w[0] *= 0.5; w[1] *= 0.8; w[3] *= 1.4; w[4] *= 1.6; }
    let tot = w.reduce((a, b) => a + b, 0), r = this.rng() * tot, rar = 0;
    for (let i = 0; i < 5; i++) { r -= w[i]; if (r <= 0) { rar = i; break; } }
    let pool = WEAPON_POOL.filter(k => WEAPONS[k].rarity === rar && !this.p?.weapons.includes(k));
    if (!pool.length) pool = WEAPON_POOL;
    return this.rng.pick(pool);
  }

  updatePickups(dt) {
    const p = this.p, m = this.mods;
    for (const k of this.pickups) {
      k.t += dt;
      const d = Math.hypot(cx(p) - k.x, cy(p) - k.y);
      if ((k.homing || d < m.magnet) && k.t > 0.35 && k.kind !== 'potion' || (k.kind === 'potion' && d < 16)) {
        const a = Math.atan2(cy(p) - k.y, cx(p) - k.x), sp = 260 + k.t * 60;
        k.x += Math.cos(a) * sp * dt; k.y += Math.sin(a) * sp * dt;
        if (d < 10) {
          k.dead = true;
          if (k.kind === 'coin') { this.coins++; this.sfx('coin'); }
          else if (k.kind === 'orb') { p.energy = Math.min(this.maxEnergy(), p.energy + 4); this.sfx('orb'); }
          else { p.hp = Math.min(this.maxHp(), p.hp + 2); this.text(cx(p), p.y - 8, '+2 HP', '#ff4f6a'); this.sfx('heal'); }
        }
      } else {
        const box = { x: k.x - 2, y: k.y - 2, w: 4, h: 4, vx: k.vx, vy: Math.min(MAX_FALL, k.vy + G * dt) };
        this.move(box, dt);
        if (box.onGround) box.vx *= 0.8;
        k.x = box.x + 2; k.y = box.y + 2; k.vx = box.vx; k.vy = box.vy;
      }
    }
    this.pickups = this.pickups.filter(k => !k.dead);
    for (const it of this.items) {
      it.t += dt;
      const box = { x: it.x, y: it.y, w: 16, h: 8, vx: 0, vy: Math.min(MAX_FALL, it.vy + G * dt) };
      this.move(box, dt); it.y = box.y; it.vy = box.vy;
    }
    for (const c of this.chests) { c.vy = Math.min(MAX_FALL, c.vy + G * dt); this.move(c, dt); }
  }

  updateFocus(inp) {
    const p = this.p, px = cx(p), py = cy(p);
    let best = null, bd = 28 * 28;
    const consider = (obj, x, y, label, act) => { const d = dist2(px, py, x, y); if (d < bd) { bd = d; best = { obj, label, act, x, y }; } };
    for (const it of this.items) { const w = WEAPONS[it.id]; consider(it, it.x + 8, it.y + 4, `${w.name}`, 'pickup'); }
    for (const c of this.chests) if (!c.open) consider(c, c.x + 8, c.y + 4, '상자 열기', 'chest');
    for (const pr of this.props) {
      if (pr.kind === 'shop' && !pr.sold) consider(pr, pr.x + 8, pr.y + 8, this.goodLabel(pr), 'buy');
      if (pr.kind === 'statue' && !pr.used) consider(pr, pr.x + 7, pr.y + 8, '축복 석상: 버프 선택', 'statue');
      if (pr.kind === 'portal') { const d = dist2(px, py, pr.x + 14, pr.y + 20); if (d < 34 * 34) { bd = 0; best = { obj: pr, label: '다음 층으로', act: 'portal', x: pr.x + 14, y: pr.y + 20 }; } }
    }
    this.focus = best;
    if (best && inp.interactPressed) this.interact(best);
  }
  goodLabel(pr) {
    const g = pr.good;
    const name = g.kind === 'weapon' ? WEAPONS[g.id].name : g.kind === 'potion' ? '회복 물약 (HP +3)' : g.kind === 'energy' ? '에너지 팩 (+120)' : '수상한 버프 카드';
    return `${name} — ${pr.price}코인`;
  }
  interact(f) {
    const p = this.p;
    if (f.act === 'pickup') {
      const it = f.obj;
      if (!p.weapons[1]) { p.weapons[1] = it.id; p.cur = 1; this.items.splice(this.items.indexOf(it), 1); }
      else { const old = p.weapons[p.cur]; p.weapons[p.cur] = it.id; it.id = old; it.vy = -120; }
      p.cool = 0.2; this.sfx('pickup'); this.emit('weapon');
      this.text(cx(p), p.y - 8, WEAPONS[p.weapons[p.cur]].name, RARITY[WEAPONS[p.weapons[p.cur]].rarity].color);
    } else if (f.act === 'chest') {
      const c = f.obj; c.open = true; this.sfx('chest');
      const x = c.x + 8, y = c.y;
      if (c.kind === 'wood') {
        const n = 4 + (this.rng() * 6 | 0); for (let i = 0; i < n; i++) this.dropPickup(x, y, 'coin');
        const o = 4 + (this.rng() * 6 | 0); for (let i = 0; i < o; i++) this.dropPickup(x, y, 'orb');
        if (this.rng() < 0.3) this.dropPickup(x, y, 'potion');
      } else {
        this.items.push({ x: x - 8, y: y - 8, vy: -200, id: this.rollWeapon(c.kind === 'gold' ? 3 : 0), t: 0 });
        if (c.kind === 'gold') { for (let i = 0; i < 6; i++) this.dropPickup(x, y, 'orb'); this.dropPickup(x, y, 'potion'); }
      }
      this.ring(x, y, '#ffd75a', 10);
    } else if (f.act === 'buy') {
      const pr = f.obj;
      if (this.coins < pr.price) { this.text(pr.x + 8, pr.y - 6, '코인 부족', '#ff4f6a'); this.sfx('empty'); return; }
      this.coins -= pr.price; pr.sold = true; this.sfx('buy');
      const g = pr.good;
      if (g.kind === 'weapon') this.items.push({ x: pr.x, y: pr.y - 4, vy: -160, id: g.id, t: 0 });
      else if (g.kind === 'potion') { p.hp = Math.min(this.maxHp(), p.hp + 3); this.text(cx(p), p.y - 8, '+3 HP', '#ff4f6a'); }
      else if (g.kind === 'energy') { p.energy = Math.min(this.maxEnergy(), p.energy + 120); this.text(cx(p), p.y - 8, '+120 에너지', '#5cc8ff'); }
      else this.openPick('shop');
    } else if (f.act === 'statue') {
      f.obj.used = true; this.sfx('statue'); this.openPick('statue');
    } else if (f.act === 'portal') {
      const gems = 4 + this.floor * 2 + (isBossFloor(this.floor) ? 25 : 0);
      this.gemsEarned += gems; this.emit('gems', { n: gems });
      this.sfx('portal');
      this.openPick('portal');
    }
  }

  /* ───────── 버프 ───────── */
  buffChoices(n = 3) {
    const pool = BUFFS.filter(b => (this.taken[b.id] || 0) < b.stack);
    const out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
    return out;
  }
  openPick(source) {
    this.pick = { source, choices: this.buffChoices(3) };
    if (!this.pick.choices.length) { if (source === 'portal') this.startFloor(this.floor + 1); return; }
    this.state = 'pick'; this.emit('pick', { source });
  }
  choose(i) {
    if (this.state !== 'pick') return;
    const c = this.pick.choices[i];
    if (c) this.applyBuff(c.id);
    const src = this.pick.source;
    this.pick = null; this.state = 'play';
    if (src === 'portal') this.startFloor(this.floor + 1);
  }
  applyBuff(id, silent) {
    const b = BUFFS.find(x => x.id === id);
    this.taken[id] = (this.taken[id] || 0) + 1;
    b.apply(this.mods, this.p);
    const p = this.p;
    p.hp = Math.min(p.hp, this.maxHp()); p.energy = Math.min(p.energy, this.maxEnergy());
    if (id === 'shield') p.shieldReady = true;
    if (!silent) { this.text(cx(p), p.y - 12, b.name, '#ffd75a', true); this.sfx('buff'); }
  }

  /* ───────── 이펙트 ───────── */
  spark(x, y, c, n = 1, sp = 60) {
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const a = this.rng() * Math.PI * 2, s = sp * (0.3 + this.rng() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 0.25 + this.rng() * 0.3, c, s: this.rng() < 0.3 ? 2 : 1, g: 1 });
    }
  }
  dust(x, y, n) { for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) this.particles.push({ x: x + (this.rng() - 0.5) * 8, y, vx: (this.rng() - 0.5) * 60, vy: -this.rng() * 30, t: 0, life: 0.3, c: '#ffffffaa', s: 2, g: 0 }); }
  ring(x, y, c, r) { this.particles.length < MAX_PARTICLES && this.particles.push({ x, y, vx: 0, vy: 0, t: 0, life: 0.3, ringR: r, c }); }
  text(x, y, str, color, big = false) { if (this.texts.length > 60) this.texts.shift(); this.texts.push({ x, y, str, color, big, t: 0, life: big ? 1.1 : 0.7 }); }
  updateParticles(dt) {
    for (const q of this.particles) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.g) q.vy += 300 * dt; q.vx *= 0.96; }
    this.particles = this.particles.filter(q => q.t < q.life);
    for (const t of this.texts) { t.t += dt; t.y -= (t.big ? 18 : 30) * dt; }
    this.texts = this.texts.filter(t => t.t < t.life);
  }
  updateCamera(dt) {
    const p = this.p, R = this.room;
    const tx = clamp(cx(p) - VIEW_W / 2 + p.face * 24, 0, Math.max(0, R.W * TILE - VIEW_W));
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 6);
    this.cam.y = Math.max(0, R.H * TILE - VIEW_H);
    this.cam.shake = Math.max(0, this.cam.shake - dt * 20);
  }
}

function overlap(a, b, shrink = 0) {
  return a.x + shrink < b.x + b.w - shrink && a.x + a.w - shrink > b.x + shrink && a.y + shrink < b.y + b.h - shrink && a.y + a.h - shrink > b.y + shrink;
}

export const EMPTY_INPUT = { left: false, right: false, down: false, jumpPressed: false, jumpHeld: false, attack: false, skillPressed: false, swapPressed: false, interactPressed: false, mouseAim: false, aimX: 0, aimY: 0 };
