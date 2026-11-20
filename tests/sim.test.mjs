// headless 전투 시뮬레이션 테스트: node tests/sim.test.mjs
import { test, ok, eq, run } from './lib.mjs';
import { CFG } from '../js/core/config.js';
import { damageEnemy } from '../js/core/combat.js';
import { createWorld, tick } from '../js/core/world.js';
import { invulnerable, attackBox } from '../js/core/player.js';
import { ENEMY_DEFS, spawnEnemy } from '../js/core/enemies.js';
import { I, steps, FLAT, makeDummy } from './helpers.mjs';
import { stepLoop } from '../js/loop.js';
import { SPELLS, STAT_SPELL, spellFor } from '../js/core/spells.js';

const W = (o = {}) => createWorld({ room: 'test', solids: FLAT, ...o });
const settle = w => steps(w, 30); // 바닥에 내려앉기

test('config: 완벽 패링 6f', () => eq(CFG.parry.perfectF, 6));
test('config: 회피 무적 12f', () => eq(CFG.roll.iEnd - CFG.roll.iStart + 1, 12));

/* ── Task 2: 리라 기본기 ── */
test('move: 오른쪽 60틱 → 거의 최고 속도로 이동', () => {
  const w = W(); settle(w); const x0 = w.player.x;
  steps(w, 60, { right: true });
  ok(w.player.x - x0 >= CFG.player.speed * 60 - 8, w.player.x - x0);
});
function jumpHeight(holdTicks) {
  const w = W(); settle(w); const y0 = w.player.y; let top = y0;
  tick(w, I({ jump: true, jumpHeld: true }));
  for (let i = 0; i < 80; i++) { tick(w, I({ jumpHeld: i < holdTicks })); top = Math.min(top, w.player.y); }
  return y0 - top;
}
test('jump: 홀드 → 최대 높이 근처', () => { const h = jumpHeight(99); const M = CFG.player.jumpMaxH; ok(h >= M * 0.9 && h <= M, h); });
test('jump: 짧은 탭 → 최대의 55% 미만', () => { const h = jumpHeight(0); ok(h < CFG.player.jumpMaxH * 0.55, h); });
function coyote(k) {
  const w = W({ solids: [{ x: 0, y: 300, w: 200, h: 20 }, { x: -1000, y: 420, w: 4000, h: 40 }], spawn: { x: 150, y: 200 } });
  settle(w);
  let n = 0; while (w.player.onGround && n++ < 200) tick(w, I({ right: true }));
  for (let i = 1; i < k; i++) tick(w, I({ right: true }));
  tick(w, I({ jump: true, jumpHeld: true }));
  return w.player.vy < 0;
}
test('coyote: 떨어진 뒤 5틱째 점프 → 됨', () => ok(coyote(5)));
test('coyote: 8틱째 → 안 됨', () => ok(!coyote(8)));
test('attack: 3연타 combo 0,1,2 + 판정은 startup 뒤 active 동안만', () => {
  const w = W(); settle(w); const seen = [], A = CFG.attack, gap = A.startupF + A.activeF + 2;
  for (let i = 0; i < 90; i++) {
    tick(w, I({ attack: i === 0 || i === gap || i === gap * 2 }));
    const b = attackBox(w.player);
    if (b) seen.push([i, w.player.combo]);
  }
  const combos = [...new Set(seen.map(s => s[1]))];
  eq(JSON.stringify(combos), '[0,1,2]');
  eq(JSON.stringify(seen.filter(s => s[1] === 0).map(s => s[0])), JSON.stringify(Array.from({ length: A.activeF }, (_, k) => A.startupF + k)));
});
test('cancel: 공격 후딜 중 roll → 같은 틱에 roll', () => {
  const w = W(); settle(w);
  tick(w, I({ attack: true })); steps(w, CFG.attack.startupF + CFG.attack.activeF);
  eq(w.player.state, 'attack');
  tick(w, I({ roll: true }));
  eq(w.player.state, 'roll');
});
test('roll: 22틱에 90~100px, 무적은 2~13틱만', () => {
  const w = W(); settle(w); const x0 = w.player.x; const inv = [];
  tick(w, I({ roll: true })); inv.push(invulnerable(w.player));
  for (let i = 1; i < 22; i++) { tick(w, I()); inv.push(invulnerable(w.player)); }
  const d = w.player.x - x0; ok(Math.abs(d - CFG.roll.dist) <= 6, d);
  eq(inv.map((v, i) => v ? i : -1).filter(i => i >= 0).join(','), '2,3,4,5,6,7,8,9,10,11,12,13');
});
test('buffer: 공격 startup 중 parry → 후딜 진입 시 parry 실행', () => {
  const w = W(); settle(w);
  tick(w, I({ attack: true })); tick(w, I({ parry: true }));
  let got = false; for (let i = 0; i < CFG.player.bufferF; i++) { tick(w, I()); if (w.player.state === 'parry') got = true; }
  ok(got);
});
test('buffer: 버퍼 시간 넘게 못 쓰면 버려짐', () => {
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
  const hp0 = d.hp; d.x = w.player.x + w.player.w + 4; d.boss = true;
  tick(w, I({ attack: true })); steps(w, CFG.attack.startupF + 2);
  eq(w.player.state, 'execute'); eq(d.hp, hp0);                                  // 처형 모션 시작: 아직 피해 없음
  steps(w, CFG.execute.hitF + 2); eq(hp0 - d.hp, 30);                            // 베는 순간 보스는 15%
});
test('일반 적 그로기·처형: 완벽 패링으로 무너지고, 처형 모션 동안 무적, 베는 순간 즉사', () => {
  const w = W(); settle(w);
  const e = spawnEnemy(w, 'ghoul', w.player.x + w.player.w + 4, w.player.y); e.update = () => {};
  ok(e.poiseMax); eq(e.poiseRes, CFG.poise.mobRes);
  const { addPoise } = { addPoise: null };
  e.poise = 0.99; damageEnemy(w, e, 1, 0.05); ok(e.stunT > 0 && e.stunT <= CFG.poise.mobStunF);
  w.player.face = 1; tick(w, I({ attack: true })); steps(w, CFG.attack.startupF + 2);
  eq(w.player.state, 'execute'); ok(invulnerable(w.player)); ok(!e.dead);
  steps(w, CFG.execute.hitF + 2); ok(e.dead || !w.enemies.includes(e), 'killed');
  steps(w, CFG.execute.totalF); eq(w.player.state, 'idle');
});
const cast = (w, spell, light = 100) => { w.player.spells = [spell]; w.player.light = light; tick(w, I({ skill: true })); };
test('마법 1칸: 불꽃 고리 빛 55 소모, 반경 안 적 피해, 시전 중 피해 없음', () => {
  const w = W(); settle(w);
  const d = makeDummy(w, { hp: 100, hits: [w.t + 5] });
  cast(w, 'ring'); steps(w, 30);
  eq(d.hp, 100 - CFG.skill.ring.dmg); eq(w.player.light, 45); eq(w.player.hp, 5);
});
test('등불 탄: 빛 20, 날아가 맞힘 / 빛 부족하면 시전 안 됨', () => {
  const w = W(); settle(w); w.player.face = 1;
  const d = makeDummy(w, { hp: 100 }); d.x = w.player.x + 120;
  cast(w, 'bolt', 25); steps(w, 40);
  eq(d.hp, 100 - CFG.skill.bolt.dmg); eq(w.player.light, 5);
  tick(w, I({ skill: true })); ok(w.player.state !== 'cast');
});
test('얼음 창은 여러 적을 꿰뚫고, 흑염 창은 앞쪽 일직선만', () => {
  const w = W(); settle(w); w.player.face = 1;
  const a = makeDummy(w, { hp: 300 }); a.x = w.player.x + 100;
  const b = makeDummy(w, { hp: 300 }); b.x = w.player.x + 200;
  const c = makeDummy(w, { hp: 300, behind: true });
  cast(w, 'lance'); steps(w, 60); const L = CFG.skill.lance.dmg; eq(a.hp, 300 - L); eq(b.hp, 300 - L);
  cast(w, 'spear'); steps(w, 30); const SP = CFG.skill.spear.dmg; eq(a.hp, 300 - L - SP); eq(b.hp, 300 - L - SP); eq(c.hp, 300);
});
test('치유의 빛·성광 기둥: 정한 만큼 회복, 성광 기둥은 주변 피해도', () => {
  const w = W(); settle(w); w.player.hp = 1; w.player.maxHp = 10;
  const d = makeDummy(w, { hp: 300 });
  cast(w, 'heal'); steps(w, 30); eq(w.player.hp, 1 + CFG.skill.heal.heal);
  cast(w, 'sanctum'); steps(w, 30); eq(w.player.hp, 1 + CFG.skill.heal.heal + CFG.skill.sanctum.heal); eq(d.hp, 300 - CFG.skill.sanctum.dmg);
});
test('유도: 등불 탄은 위쪽에 떠 있는 적도 쫓아가 맞히고, 뒤쪽 적만 있으면 돌아서 쏜다', () => {
  const w = W(); settle(w); w.player.face = 1;
  const up = makeDummy(w, { hp: 100 }); up.x = w.player.x + 160; up.y = w.player.y - 70;
  cast(w, 'bolt'); steps(w, 60); eq(up.hp, 100 - CFG.skill.bolt.dmg);
  const w2 = W(); settle(w2); w2.player.face = 1;
  const back = makeDummy(w2, { hp: 100, behind: true }); back.x = w2.player.x - 150;
  cast(w2, 'bolt'); steps(w2, 60); eq(w2.player.face, -1); eq(back.hp, 100 - CFG.skill.bolt.dmg);
});
test('연쇄 번개는 앞쪽 적 셋까지만, 뒤쪽은 안 맞음', () => {
  const w = W(); settle(w); w.player.face = 1;
  const ds = [60, 110, 160, 210].map(dx => { const d = makeDummy(w, { hp: 100 }); d.x = w.player.x + dx; return d; });
  const back = makeDummy(w, { hp: 100, behind: true });
  cast(w, 'chain'); steps(w, 20);
  eq(ds.filter(d => d.hp === 100 - CFG.skill.chain.dmg).length, 3); eq(back.hp, 100);
});
test('착탄형(운석·낙뢰·화염 기둥·고드름 비·회오리·심판·암흑 폭발): 이펙트가 떨어지는 순간에 피해, 그 전엔 없음', () => {
  for (const sp of ['meteor', 'thunder', 'pillar', 'stars', 'blast', 'tornado', 'smite']) {
    const w = W(); settle(w); w.player.face = 1;
    const d = makeDummy(w, { hp: 200 }); d.x = w.player.x + 140;
    cast(w, sp); const S = CFG.skill[sp];
    steps(w, S.fireF + S.delay - 2); eq(d.hp, 200, sp + ' early');
    steps(w, 4); eq(d.hp, 200 - S.dmg, sp + ' land');
  }
});
test('새 마법: 회오리 3연타 · 서리 가시/가시 덩굴 앞쪽 직선 · 도깨비불 3발 · 피의 갈취 흡혈', () => {
  { const w = W(); settle(w); w.player.face = 1; const d = makeDummy(w, { hp: 200 }); d.x = w.player.x + 140;
    cast(w, 'tornado'); steps(w, 120); eq(d.hp, 200 - CFG.skill.tornado.dmg * 3); }
  for (const sp of ['spikes', 'thorns']) { const w = W(); settle(w); w.player.face = 1;
    const near = makeDummy(w, { hp: 200 }); near.x = w.player.x + 60; const far = makeDummy(w, { hp: 200 }); far.x = w.player.x + 400; const back = makeDummy(w, { hp: 200, behind: true });
    cast(w, sp); steps(w, 60); eq(near.hp, 200 - CFG.skill[sp].dmg, sp); eq(far.hp, 200, sp + ' far'); eq(back.hp, 200, sp + ' back'); }
  { const w = W(); settle(w); w.player.face = 1; const d = makeDummy(w, { hp: 200 }); d.x = w.player.x + 120;
    cast(w, 'wisps'); steps(w, 120); eq(d.hp, 200 - CFG.skill.wisps.dmg * 3); }
  { const w = W(); settle(w); w.player.face = 1; w.player.hp = 2; const d = makeDummy(w, { hp: 200 }); d.x = w.player.x + 120;
    cast(w, 'drain'); steps(w, 30); eq(d.hp, 200 - CFG.skill.drain.dmg); eq(w.player.hp, 3); }
});
test('마법 표: 스탯 14·17·20에서 마법이 바뀐다 (스탯마다 3개, 모두 서로 다름)', () => {
  const ids = Object.values(STAT_SPELL).flat(); eq(ids.length, 18); eq(new Set(ids).size, 18);
  for (const id of ids) ok(SPELLS[id] && CFG.skill[id], id);
  const st = { str: 10, agi: 10, wil: 10, lmp: 10, vit: 10, fury: 10 };
  eq(spellFor({ ...st, str: 14 }), 'pillar'); eq(spellFor({ ...st, str: 17 }), 'tornado'); eq(spellFor({ ...st, str: 20 }), 'meteor'); eq(spellFor({ ...st, str: 13 }), 'bolt');
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
test('ghoul: 예고(20×템포)틱 뒤 히트박스', () => {
  const w = W(); settle(w); w.player.hp = 99;
  const e = spawnEnemy(w, 'ghoul', w.player.x + 30, w.player.y);
  let a = -1, b = -1;
  for (let i = 0; i < 200 && b < 0; i++) {
    tick(w, I());
    if (a < 0 && e.st === 'telegraph') a = w.t;
    if (a >= 0 && w.hitboxes.some(h => h.owner === e)) b = w.t;
  }
  eq(b - a, Math.round(20 * CFG.enemy.tempo));
});
test('moth: 예고(18×템포)틱 → 리라 쪽으로 돌진', () => {
  const w = W(); settle(w); w.player.hp = 99;
  const e = spawnEnemy(w, 'moth', w.player.x + 120, w.player.y - 60);
  let a = -1, b = -1, vx = 0;
  for (let i = 0; i < 400 && b < 0; i++) {
    tick(w, I());
    if (a < 0 && e.st === 'telegraph') a = w.t;
    if (a >= 0 && e.st === 'active') { b = w.t; tick(w, I()); vx = e.vx; }
  }
  eq(b - a, Math.round(18 * CFG.enemy.tempo)); ok(Math.sign(vx) === Math.sign(w.player.x - e.x) || Math.abs(w.player.x - e.x) < 10, 'dir ' + vx);
});
test('나방은 무엇에 맞든 한 방에 죽는다 (지역 체력 배수와 무관)', () => {
  const w = W(); settle(w);
  const e = spawnEnemy(w, 'moth', w.player.x + 30, w.player.y, { hpMul: 3 });
  damageEnemy(w, e, 1); ok(e.dead);
});
test('보스방 기믹: 등불 화로를 베면 보스에게 피해·자세, 15초 재충전 / 발판 · 넓은 방', () => {
  const w = createWorld({ room: 'boss' }); steps(w, 30);
  ok(w.solids.filter(s => s.oneWay).length >= 2); eq(w.width, 1120);
  const b = w.enemies[0], o = w.props[0]; b.update = () => {}; const hp = b.hp;
  w.player.x = o.x + 16; w.player.face = -1; steps(w, 5);
  tick(w, I({ attack: true })); steps(w, CFG.attack.startupF + 2);
  eq(hp - b.hp, 20); ok(b.poise >= 0.5 || b.stunT > 0); ok(o.cd > 800);
  tick(w, I({ attack: true })); steps(w, CFG.attack.startupF + 20); eq(hp - b.hp, 20);   // 재충전 중엔 반응 없음
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
test('shockwave: 패링 불가라 맞으면 hp -1 (보스 피해 낮춤)', () => eq(slamTest('parry'), 4));
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

/* ── 최종 리뷰 수정 ── */
test('review: 공격 도중 그로기된 보스는 처형 후 예고 없이 공격하지 않음', () => {
  const { w, b } = bossWorld('double');
  w.player.hp = 5; b.poise = 0.9;
  let state = 'wait', hurtNoTele = false, sawTele = false;
  for (let i = 0; i < 400; i++) {
    const inp = {};
    const h = oracleHurtWithin(w, 2);
    if (state === 'wait' && h) inp.parry = true;
    if (state === 'stun' && b.stunT > 0 && w.player.state === 'idle' && !w.hitstop) { b.x = w.player.x + w.player.w + 2; inp.attack = true; }
    tick(w, I(inp)); b.forceNext = null;
    if (state === 'wait' && b.stunT > 0) state = 'stun';
    if (state === 'stun' && w.events.some(e => e.type === 'execute')) state = 'after';
    if (state === 'after') {
      if (w.events.some(e => e.type === 'telegraph')) sawTele = true;
      if (w.events.some(e => e.type === 'hurt') && !sawTele) hurtNoTele = true;
    }
  }
  eq(state, 'after'); ok(!hurtNoTele, 'hit without telegraph');
});
test('review: 일방향 발판에서 아래+점프 → 올라가지 않고 내려감', () => {
  const w = W({ solids: [{ x: 0, y: 200, w: 300, h: 8, oneWay: true }, { x: -1000, y: 300, w: 4000, h: 40 }], spawn: { x: 100, y: 100 } });
  settle(w); eq(w.player.y + w.player.h, 200);
  const y0 = w.player.y; let minY = y0;
  tick(w, I({ down: true, jump: true, jumpHeld: true }));
  for (let i = 0; i < 40; i++) { tick(w, I({ down: true, jumpHeld: true })); minY = Math.min(minY, w.player.y); }
  ok(minY >= y0 - 1, 'rose ' + (y0 - minY)); eq(w.player.y + w.player.h, 300);
});

/* ── 손맛 패스 ── */
test('juice: 2틱 만에 최고 속도', () => {
  const w = W(); settle(w); tick(w, I({ right: true })); tick(w, I({ right: true }));
  eq(w.player.vx, CFG.player.speed);
});
test('juice: 떨어지는 게 올라가는 것보다 빠름', () => {
  const w = W(); settle(w); tick(w, I({ jump: true, jumpHeld: true }));
  let up = 1, down = 0;
  while (w.player.vy < 0) { tick(w, I({ jumpHeld: true })); up++; }
  while (!w.player.onGround) { tick(w, I({ jumpHeld: true })); down++; }
  ok(down < up * 0.85, `up ${up} down ${down}`);
});
function hitWith(combo) {
  const w = W(); settle(w);
  const d = makeDummy(w, { hp: 500 }); d.x = w.player.x + w.player.w + 4;
  let stop = 0, x0 = d.x;
  for (let k = 0; k <= combo; k++) {
    tick(w, I({ attack: true }));
    for (let i = 0; i < 12; i++) { tick(w, I()); if (w.events.some(e => e.type === 'attackHit')) stop = w.hitstop; }
    if (k < combo) d.x = w.player.x + w.player.w + 4, x0 = d.x;
  }
  return { stop, push: d.x - x0, w, d };
}
test('juice: 타격 히트스톱 1·2타 4, 3타 7', () => { eq(hitWith(0).stop, 4); eq(hitWith(2).stop, 7); });
test('juice: 맞은 일반 적은 뒤로 밀림', () => { ok(hitWith(0).push > 3, hitWith(0).push); });
test('juice: 완벽 패링당한 일반 적은 30틱 동안 공격 못 하고 밀려남', () => {
  const w = W(); settle(w); w.player.hp = 99;
  const e = spawnEnemy(w, 'ghoul', w.player.x + 30, w.player.y);
  let parried = -1, x0 = 0, teleAfter = -1, pushed = 0;
  for (let i = 0; i < 300; i++) {
    const inp = {};
    if (parried < 0 && oracleHurtWithin(w, 2)) inp.parry = true;
    tick(w, I(inp));
    if (parried < 0 && w.events.some(ev => ev.type === 'parry' && ev.perfect)) { parried = w.t; x0 = e.x; steps(w, 12); pushed = e.x - x0; }
    if (parried >= 0 && teleAfter < 0 && w.events.some(ev => ev.type === 'telegraph')) teleAfter = w.t;
  }
  ok(parried > 0, 'no perfect'); ok(Math.abs(pushed) > 6, 'not pushed ' + pushed); ok(teleAfter - parried >= 30 + CFG.parry.hitstopPerfect, teleAfter - parried);
});


/* ── 사제 마법탄: 낮게(허리 높이) 날아오고, 패링 자세면 몸 앞에서 받아낸다 ── */
function priestBolt() {
  const w = W(); settle(w); const p = w.player; p.face = 1;
  spawnEnemy(w, 'priest', p.x + 220, p.y); const e = w.enemies[0]; e.spawnT = 0; e.cool = 0;
  for (let i = 0; i < 300 && !w.projectiles.length; i++) tick(w, I());
  return { w, p, b: w.projectiles[0] };
}
test('사제 탄: 리라 몸 아래쪽 절반(허리 높이)으로, 거의 수평으로 날아온다', () => {
  const { p, b } = priestBolt(); ok(b, 'no bolt');
  const cy = b.y + b.h / 2; ok(cy > p.y + p.h * 0.45 && cy < p.y + p.h * 0.8, cy - p.y);
  ok(Math.abs(b.vy) <= Math.abs(b.vx) * 0.36, b.vy);
});
test('사제 탄: 몸에 닿기 전(앞 여유 안)에 누른 패링도 막는다', () => {
  const { w, p, b } = priestBolt(); ok(b, 'no bolt');
  for (let i = 0; i < 400 && b.x > p.x + p.w + CFG.parry.projReach - 4; i++) tick(w, I());
  ok(b.x - (p.x + p.w) > 4, 'bolt already touching');                   // 아직 몸에 안 닿은 거리
  tick(w, I({ parry: true })); steps(w, 12);
  eq(b.owner, 'player'); eq(p.hp, p.maxHp);                             // 튕겨 나감 (완벽 패링 반사)
});
run();
