// headless 전투 시뮬레이션 테스트: node tests/sim.test.mjs
import { test, ok, eq, run } from './lib.mjs';
import { CFG } from '../js/core/config.js';
import { createWorld, tick } from '../js/core/world.js';
import { invulnerable, attackBox } from '../js/core/player.js';
import { ENEMY_DEFS, spawnEnemy } from '../js/core/enemies.js';
import { I, steps, FLAT, makeDummy } from './helpers.mjs';
import { stepLoop } from '../js/loop.js';

const W = (o = {}) => createWorld({ room: 'test', solids: FLAT, ...o });
const settle = w => steps(w, 30); // 바닥에 내려앉기

test('config: 완벽 패링 6f', () => eq(CFG.parry.perfectF, 6));
test('config: 회피 무적 12f', () => eq(CFG.roll.iEnd - CFG.roll.iStart + 1, 12));

/* ── Task 2: 리라 기본기 ── */
test('move: 오른쪽 60틱 → x +140 이상', () => {
  const w = W(); settle(w); const x0 = w.player.x;
  steps(w, 60, { right: true });
  ok(w.player.x - x0 >= 140, w.player.x - x0);
});
function jumpHeight(holdTicks) {
  const w = W(); settle(w); const y0 = w.player.y; let top = y0;
  tick(w, I({ jump: true, jumpHeld: true }));
  for (let i = 0; i < 80; i++) { tick(w, I({ jumpHeld: i < holdTicks })); top = Math.min(top, w.player.y); }
  return y0 - top;
}
test('jump: 홀드 → 66~72px', () => { const h = jumpHeight(99); ok(h >= 66 && h <= 72, h); });
test('jump: 짧은 탭 → 40px 미만', () => { const h = jumpHeight(0); ok(h < 40, h); });
function coyote(k) {
  const w = W({ solids: [{ x: 0, y: 300, w: 200, h: 20 }, { x: -1000, y: 420, w: 4000, h: 40 }], spawn: { x: 150, y: 250 } });
  settle(w);
  let n = 0; while (w.player.onGround && n++ < 200) tick(w, I({ right: true }));
  for (let i = 1; i < k; i++) tick(w, I({ right: true }));
  tick(w, I({ jump: true, jumpHeld: true }));
  return w.player.vy < 0;
}
test('coyote: 떨어진 뒤 5틱째 점프 → 됨', () => ok(coyote(5)));
test('coyote: 8틱째 → 안 됨', () => ok(!coyote(8)));
test('attack: 3연타 combo 0,1,2 + 판정은 startup 4틱 뒤 3틱', () => {
  const w = W(); settle(w); const seen = [];
  for (let i = 0; i < 60; i++) {
    tick(w, I({ attack: i === 0 || i === 8 || i === 16 }));
    const b = attackBox(w.player);
    if (b) seen.push([i, w.player.combo]);
  }
  const combos = [...new Set(seen.map(s => s[1]))];
  eq(JSON.stringify(combos), '[0,1,2]');
  eq(JSON.stringify(seen.filter(s => s[1] === 0).map(s => s[0])), '[4,5,6]');
});
test('cancel: 공격 후딜 중 roll → 같은 틱에 roll', () => {
  const w = W(); settle(w);
  tick(w, I({ attack: true })); steps(w, 7);
  eq(w.player.state, 'attack');
  tick(w, I({ roll: true }));
  eq(w.player.state, 'roll');
});
test('roll: 22틱에 90~100px, 무적은 2~13틱만', () => {
  const w = W(); settle(w); const x0 = w.player.x; const inv = [];
  tick(w, I({ roll: true })); inv.push(invulnerable(w.player));
  for (let i = 1; i < 22; i++) { tick(w, I()); inv.push(invulnerable(w.player)); }
  const d = w.player.x - x0; ok(d >= 90 && d <= 100, d);
  eq(inv.map((v, i) => v ? i : -1).filter(i => i >= 0).join(','), '2,3,4,5,6,7,8,9,10,11,12,13');
});
test('buffer: 공격 startup 중 parry → 후딜 진입 시 parry 실행', () => {
  const w = W(); settle(w);
  tick(w, I({ attack: true })); tick(w, I({ parry: true }));
  let got = false; for (let i = 0; i < 8; i++) { tick(w, I()); if (w.player.state === 'parry') got = true; }
  ok(got);
});
test('buffer: 8틱 넘게 못 쓰면 버려짐', () => {
  const w = W(); settle(w); w.player.flasks = 3; w.player.hp = 3;
  tick(w, I({ flask: true })); tick(w, I({ parry: true }));
  steps(w, 45);
  ok(w.player.state !== 'parry', w.player.state);
});

/* ── Task 3: 패링·피격·히트스톱·자세·빛 ── */
// 패링을 누른 틱(stateT 0)으로부터 n번째 틱(1부터)에 공격이 닿게 한다
function parryAt(n, opt = {}) {
  const w = W(); settle(w);
  const t0 = w.t + 1;
  const d = makeDummy(w, { hits: [t0 + n - 1], ...opt });
  tick(w, I({ parry: true }));
  const hp0 = w.player.hp, l0 = w.player.light; let res = null, stop = 0;
  for (let i = 0; i < n + 1; i++) {
    for (const ev of w.events) if (ev.type === 'parry') { res = ev.perfect ? 'perfect' : 'normal'; stop = w.hitstop; }
    if (res) break;
    tick(w, I());
  }
  for (const ev of w.events) if (ev.type === 'parry' && !res) { res = ev.perfect ? 'perfect' : 'normal'; stop = w.hitstop; }
  if (!res) res = w.player.hp < hp0 ? 'hit' : 'none';
  return { w, d, res, stop, dl: w.player.light - l0, dhp: w.player.hp - hp0 };
}
test('perfect: 히트 직전 패링 → perfect, hp 그대로, 빛 +25, 히트스톱 8', () => {
  const r = parryAt(2); eq(r.res, 'perfect'); eq(r.dhp, 0); eq(r.dl, 25); eq(r.stop, 8);
});
test('경계: 6틱째 perfect / 7틱째 normal(빛+10, 히트스톱3) / 13틱째 hit', () => {
  eq(parryAt(6).res, 'perfect');
  const n = parryAt(7); eq(n.res, 'normal'); eq(n.dl, 10); eq(n.stop, 3);
  eq(parryAt(12).res, 'normal');
  const h = parryAt(13); eq(h.res, 'hit'); eq(h.dhp, -1);
});
test('whiff: 헛 패링 후 18틱 동안 패링 재입력 무시', () => {
  const w = W(); settle(w);
  tick(w, I({ parry: true })); steps(w, 11);           // 판정창 12틱 끝
  for (let i = 0; i < 18; i++) { tick(w, I({ parry: true })); ok(w.player.stateT === 12 + i, 'stateT ' + w.player.stateT); }
  tick(w, I({ parry: true })); eq(w.player.stateT, 0);   // 30틱째 새 패링
});
test('success recover: 성공 후 4틱 뒤 새 패링 가능', () => {
  const r = parryAt(8);            // normal, 히트스톱 3
  eq(r.res, 'normal'); const w = r.w;
  steps(w, 3); tick(w, I({ parry: true }));      // 히트스톱 3틱 + 1틱 (= 4틱)
  eq(w.player.state, 'parry'); eq(w.player.stateT, 0);
});
test('multi: 한 판정창 안 공격 2개 모두 막힘', () => {
  const w = W(); settle(w); const t0 = w.t + 1;
  makeDummy(w, { hits: [t0 + 1, t0 + 4] });
  tick(w, I({ parry: true })); steps(w, 20);
  eq(w.player.hp, 5);
});
test('unparryable: 패링 불가 공격을 패링 → 피격', () => eq(parryAt(2, { parryable: false }).res, 'hit'));
test('behind: 등 뒤 공격은 패링 안 됨 → 피격', () => eq(parryAt(2, { behind: true }).res, 'hit'));
test('hitstop buffer: 히트스톱 중 누른 패링 → 끝난 첫 틱에 실행', () => {
  const r = parryAt(2); const w = r.w; eq(r.stop, 8);
  tick(w, I({ parry: true })); steps(w, 7);       // 히트스톱 8틱 소모
  eq(w.hitstop, 0); tick(w, I());
  eq(w.player.state, 'parry'); eq(w.player.stateT, 0);
});
test('iframes: 피격 후 60틱 동안 추가 피해 없음', () => {
  const w = W(); settle(w); const t0 = w.t + 1;
  makeDummy(w, { hits: [t0, t0 + 30, t0 + 70] });
  steps(w, 50); eq(w.player.hp, 4);
  steps(w, 40); eq(w.player.hp, 3);
});
test('poise: 완벽 패링 4번 → 그로기 180, 처형 = 최대체력 15%', () => {
  const w = W(); settle(w);
  const d = makeDummy(w, { poise: true, hp: 200, hits: [] });
  for (let k = 0; k < 4; k++) {
    w.hitstop = 0; w.player.state = 'idle'; w.player.buffer = null;
    d.update = (w2, e) => { if (w2.t === tt) w2.hitboxes.push({ src: {}, owner: e, x: w2.player.x - 2, y: w2.player.y, w: 20, h: 40, dmg: 1, parryable: true, dir: -1 }); };
    var tt = w.t + 2; tick(w, I({ parry: true })); steps(w, 12);
  }
  eq(d.stunT > 0, true, 'stun'); eq(w.player.hp, 5);
  steps(w, 20);
  const hp0 = d.hp; d.x = w.player.x + w.player.w + 4;
  tick(w, I({ attack: true })); steps(w, 8);
  eq(hp0 - d.hp, 30);
});
test('ult: 빛 100 → 범위 적 60 피해, 빛 0, 시전 중 피해 없음', () => {
  const w = W(); settle(w); w.player.light = 100;
  const d = makeDummy(w, { hp: 100, hits: [w.t + 5] });
  tick(w, I({ ult: true })); steps(w, 30);
  eq(d.hp, 40); eq(w.player.light, 0); eq(w.player.hp, 5);
});
test('flask: 40틱 뒤 hp +2, 기름병 -1 / 0개면 무시', () => {
  const w = W(); settle(w); w.player.hp = 2;
  tick(w, I({ flask: true })); steps(w, 40);
  eq(w.player.hp, 4); eq(w.player.flasks, 2);
  w.player.flasks = 0; tick(w, I({ flask: true })); eq(w.player.state === 'flask', false);
});
test('kill: 처치 시 빛 +3', () => {
  const w = W(); settle(w);
  const d = makeDummy(w, { hp: 5 }); d.x = w.player.x + w.player.w + 4;
  tick(w, I({ attack: true })); steps(w, 8);
  ok(d.dead, 'dead'); eq(w.player.light, 3);
});

/* ── Task 4: 적·보스·공격 토큰 ── */
const attacking = w => w.enemies.filter(e => !e.boss && (e.st === 'telegraph' || e.st === 'active')).length;
test('data: 일반 적 예고 ≥18, 보스 ≥14 (2페이즈 -4 포함)', () => {
  for (const [k, d] of Object.entries(ENEMY_DEFS))
    for (const a of Object.values(d.attacks)) {
      const min = d.boss ? CFG.enemy.bossMinTelegraphF : CFG.enemy.minTelegraphF;
      const t = a.telegraphF - (d.boss ? 4 : 0);
      ok(t >= min, `${k}.${a.name} ${t}`);
      if ((a.hits || 1) > 1) ok(a.gapF >= CFG.enemy.multiHitGapF, `${k}.${a.name} gap`);
    }
});
test('token: 이끼 망자 3마리 붙어도 동시 공격 ≤2', () => {
  const w = W(); settle(w); w.player.hp = 999;
  for (const dx of [30, 40, 50]) spawnEnemy(w, 'ghoul', w.player.x + dx, w.player.y);
  let max = 0, any = 0;
  for (let i = 0; i < 400; i++) { tick(w, I()); max = Math.max(max, attacking(w)); any += attacking(w); }
  ok(max <= 2, max); ok(any > 0, 'never attacked');
});
test('offscreen: 화면 밖 적은 공격 시작 안 함', () => {
  const w = W(); settle(w);
  const e = spawnEnemy(w, 'ghoul', w.player.x + 700, w.player.y); e.range = 9999; e.speed = 0;
  let tele = false; for (let i = 0; i < 120; i++) { tick(w, I()); if (e.st === 'telegraph') tele = true; }
  ok(!tele, 'offscreen telegraph');
  const e2 = spawnEnemy(w, 'ghoul', w.player.x + 300, w.player.y); e2.range = 9999; e2.speed = 0;
  for (let i = 0; i < 120; i++) { tick(w, I()); if (e2.st === 'telegraph') tele = true; }
  ok(tele, 'onscreen never telegraphed');
});
test('ghoul: 예고 20틱 뒤 히트박스', () => {
  const w = W(); settle(w); w.player.hp = 99;
  const e = spawnEnemy(w, 'ghoul', w.player.x + 30, w.player.y);
  let a = -1, b = -1;
  for (let i = 0; i < 200 && b < 0; i++) {
    tick(w, I());
    if (a < 0 && e.st === 'telegraph') a = w.t;
    if (a >= 0 && w.hitboxes.some(h => h.owner === e)) b = w.t;
  }
  eq(b - a, 20);
});
test('moth: 예고 18틱 → 리라 쪽으로 돌진', () => {
  const w = W(); settle(w); w.player.hp = 99;
  const e = spawnEnemy(w, 'moth', w.player.x + 120, w.player.y - 60);
  let a = -1, b = -1, vx = 0;
  for (let i = 0; i < 400 && b < 0; i++) {
    tick(w, I());
    if (a < 0 && e.st === 'telegraph') a = w.t;
    if (a >= 0 && e.st === 'active') { b = w.t; tick(w, I()); vx = e.vx; }
  }
  eq(b - a, 18); ok(Math.sign(vx) === Math.sign(w.player.x - e.x) || Math.abs(w.player.x - e.x) < 10, 'dir ' + vx);
});
function bossWorld(force) {
  const w = createWorld({ room: 'boss' }); steps(w, 30); w.player.hp = 99;
  const b = w.enemies.find(e => e.boss); b.forceNext = force; b.x = w.player.x + 60;
  return { w, b };
}
test('boss gap: 2연 휘두르기 두 타 사이 ≥16틱', () => {
  const { w, b } = bossWorld('double'); const starts = []; let last = null;
  for (let i = 0; i < 300 && starts.length < 2; i++) {
    tick(w, I()); b.forceNext = 'double';
    const h = w.hitboxes.find(h => h.owner === b);
    if (h && h.src !== last) { starts.push(w.t); last = h.src; }
  }
  eq(starts.length, 2); ok(starts[1] - starts[0] >= 16, starts);
});
function slamTest(mode) {
  const { w, b } = bossWorld('slam'); b.x = w.player.x + 200; w.player.hp = 5;
  for (let i = 0; i < 300; i++) {
    const wave = w.projectiles.find(p => p.owner === 'enemy' && Math.sign(p.vx) === Math.sign(w.player.x - p.x));
    const d = wave ? Math.abs((wave.x + wave.w / 2) - (w.player.x + w.player.w / 2)) : 999;
    const inp = {};
    if (mode === 'parry' && d < 16 && w.player.state !== 'parry') inp.parry = true;
    if (mode === 'jump' && d < 45 && w.player.onGround) { inp.jump = true; inp.jumpHeld = true; }
    if (mode === 'jump' && !w.player.onGround) inp.jumpHeld = true;
    tick(w, I(inp)); b.forceNext = null; b.cd = 999;
  }
  return w.player.hp;
}
test('shockwave: 패링하면 hp -2', () => eq(slamTest('parry'), 3));
test('shockwave: 점프로 넘으면 피해 없음', () => eq(slamTest('jump'), 5));

// 완벽 패링 봇: 2틱 안에 맞을 공격이 오면 패링, 안전할 때만 공격
function oracleHurtWithin(w, n) {
  const c = structuredClone(w); c.player.buffer = null;   // 아무것도 안 할 때의 미래
  for (let i = 0; i < n + w.hitstop; i++) { tick(c, I()); if (c.events.some(e => e.type === 'hurt')) return i + 1; }  // 히트스톱만큼 더 본다
  return 0;
}
test('bot: 완벽 패링 봇으로 아레나 클리어, hp 5 유지', () => {
  const w = createWorld({ room: 'arena' });
  let perfect = 0;
  for (let i = 0; i < 60 * 180 && !w.cleared; i++) {
    const p = w.player, inp = {};
    const h = oracleHurtWithin(w, 2);
    if (h) inp.parry = true;
    else {
      const e = w.enemies.reduce((a, b) => !a || Math.abs(b.x - p.x) < Math.abs(a.x - p.x) ? b : a, null);
      if (e) {
        const dx = (e.x + e.w / 2) - (p.x + p.w / 2);
        if (Math.abs(dx) > 30) { inp.right = dx > 0; inp.left = dx < 0; }
        else if (Math.sign(dx) !== p.face) { inp.right = dx > 0; inp.left = dx < 0; }
        else if (e.y + e.h > p.y && !w.hitstop && (p.state === 'idle' || p.state === 'run') && !oracleHurtWithin(w, 12)) inp.attack = true;
      } else inp.right = true;
    }
    tick(w, I(inp));
    perfect += w.events.filter(e => e.type === 'parry' && e.perfect).length;
  }
  ok(w.cleared, 'not cleared, enemies ' + w.enemies.length); eq(w.player.hp, 5); ok(perfect > 0, 'no perfect parries');
});

/* ── Task 5: 고정 스텝 루프 ── */
test('loop: dt 1000ms 한 번 → 5틱만, 남은 시간 버림', () => {
  let n = 0; const acc = stepLoop(0, 1000, () => n++);
  eq(n, 5); ok(acc < 1000 / 60, acc);
});
test('loop: dt 33.4ms → 2틱', () => { let n = 0; stepLoop(0, 33.4, () => n++); eq(n, 2); });
test('loop: 16ms씩 나눠도 누적돼서 틱 발생', () => {
  let n = 0, acc = 0; for (let i = 0; i < 60; i++) acc = stepLoop(acc, 16, () => n++);
  ok(n >= 57 && n <= 58, n);
});

run();
