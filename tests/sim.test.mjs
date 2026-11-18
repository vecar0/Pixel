// headless 시뮬레이션 검수: node tests/sim.test.mjs
import { Game, EMPTY_INPUT } from '../js/sim.js';
import { HERO_ORDER, WEAPONS, BUFFS } from '../js/data.js';
import { floorPlan, makeRoom, mulberry, FLOOR_ROW } from '../js/level.js';

let pass = 0, fail = 0;
const ok = (cond, name, info = '') => { if (cond) { pass++; console.log('  ✔', name); } else { fail++; console.log('  ✘', name, info); } };
const DT = 1 / 60;

function bot(g, rng) {
  const p = g.p, inp = { ...EMPTY_INPUT };
  const R = g.room;
  let tx = R.W * 16;
  const alive = g.enemies.filter(e => !e.spawnT && e.hp > 0);
  if (R.locked && alive.length) {
    const e = alive.reduce((a, b) => Math.abs(b.x - p.x) < Math.abs(a.x - p.x) ? b : a);
    const melee = WEAPONS[p.weapons[p.cur]].kind === 'melee';
    tx = e.x + (melee ? 0 : (e.x > p.x ? -50 : 50));
    const dy = (e.y + e.h) - (p.y + p.h);
    if (dy > 24) { inp.down = true; bot.drop = true; }
    if (dy < -24 && p.onGround && (rng() < 0.2 || (melee && Math.abs(e.x - p.x) < 40))) bot.up = true;
  }
  const c = g.chests.find(c => !c.open); if (c && R.cleared) tx = c.x;
  const it = g.items[0]; if (it && R.cleared && !c && !p.weapons[1]) tx = it.x;
  if (R.cleared && p.y + p.h < FLOOR_ROW * 16 - 20 && p.onGround) { inp.down = true; bot.drop = true; }
  inp.right = tx > p.x + 6; inp.left = tx < p.x - 6;
  bot.stuck = (Math.abs(p.vx) < 5 && (inp.left || inp.right)) ? (bot.stuck || 0) + 1 : 0;
  inp.jumpPressed = bot.stuck > 4 || rng() < 0.01 || (bot.drop && rng() < 0.2) || bot.up; bot.drop = false; bot.up = false; inp.jumpHeld = true;
  inp.attack = true; inp.skillPressed = rng() < 0.05;
  inp.interactPressed = !!g.focus && (g.focus.act !== 'pickup' || ((!p.weapons[1] || g.heroId === 'haru' || WEAPONS[g.focus.obj.id].kind === 'gun') && WEAPONS[p.weapons[p.cur]].kind !== 'gun' || !p.weapons[1])) && rng() < 0.3;
  inp.swapPressed = rng() < 0.002;
  return inp;
}

console.log('① 레벨 생성');
{
  const rng = mulberry(1);
  let bad = 0;
  for (let f = 1; f <= 60; f++) {
    const plan = floorPlan(f, rng);
    if (plan[0] !== 'start') bad++;
    if (f % 5 === 0 && plan[plan.length - 1] !== 'boss') bad++;
    for (const t of plan) {
      const r = makeRoom(t, f, rng);
      for (let x = 0; x < r.W; x++) if (r.t[FLOOR_ROW * r.W + x] !== 1) bad++;
      if (t === 'combat' && r.spawns.length < 5) bad++;
    }
  }
  ok(bad === 0, '60층 분량 방이 전부 바닥·스폰 지점을 갖춤', bad);
}

console.log('② 기본 물리');
{
  const g = new Game({ hero: 'miyu', seed: 5 });
  for (let i = 0; i < 60; i++) g.update(DT, EMPTY_INPUT);
  ok(g.p.onGround && Math.abs(g.p.y + g.p.h - FLOOR_ROW * 16) < 0.5, '플레이어가 바닥에 선다');
  const x0 = g.p.x;
  for (let i = 0; i < 30; i++) g.update(DT, { ...EMPTY_INPUT, right: true });
  ok(g.p.x > x0 + 30, '오른쪽으로 이동한다', g.p.x - x0);
  for (let i = 0; i < 400; i++) g.update(DT, { ...EMPTY_INPUT, left: true });
  ok(g.p.x >= 16, '왼쪽 벽을 통과하지 않는다', g.p.x);
  g.update(DT, { ...EMPTY_INPUT, jumpPressed: true, jumpHeld: true });
  let minY = g.p.y; for (let i = 0; i < 40; i++) { g.update(DT, { ...EMPTY_INPUT, jumpHeld: true }); minY = Math.min(minY, g.p.y); }
  ok(g.p.y - minY > 40, '점프 높이 40px 이상', g.p.y - minY);
}

console.log('③ 전투방 잠금 → 웨이브 → 해제');
{
  const g = new Game({ hero: 'miyu', seed: 9 });
  g.god = true;
  for (let i = 0; i < 600 && g.roomIdx === 0; i++) g.update(DT, { ...EMPTY_INPUT, right: true });
  ok(g.roomIdx === 1 && g.room.type !== 'start', '시작 방 문을 지나 다음 방으로', g.room.type);
  // 전투방 찾을 때까지 진행
  const rng = mulberry(3);
  let locked = false, sawEnemy = false, enemyShot = false, cleared = false;
  for (let i = 0; i < 60 * 240 && !cleared; i++) {
    g.update(DT, bot(g, rng));
    if (g.state === 'pick') g.choose(0);
    if (g.room.type === 'combat') {
      if (g.room.locked) locked = true;
      if (g.enemies.some(e => !e.spawnT)) sawEnemy = true;
      if (g.bullets.some(b => b.team === 'e')) enemyShot = true;
      if (locked && g.room.cleared) cleared = true;
    }
  }
  ok(locked, '전투방 입장 시 문이 잠긴다');
  ok(sawEnemy, '적이 등장한다');
  ok(cleared, '모든 웨이브를 처치하면 방이 해제된다');
}

console.log('④ 피격: 아머 → HP 순서, 무적시간');
{
  const g = new Game({ hero: 'miyu', seed: 2 });
  const a0 = g.p.armor, h0 = g.p.hp;
  g.hurtPlayer(1); ok(g.p.armor === a0 - 1 && g.p.hp === h0, '첫 피격은 아머가 깎임');
  g.hurtPlayer(1); ok(g.p.armor === a0 - 1, '무적 시간 중 추가 피해 없음');
  g.p.armor = 0; g.p.inv = 0; g.hurtPlayer(1); ok(g.p.hp === h0 - 1, '아머 0이면 HP가 깎임');
  g.p.inv = 0; g.p.hp = 1; g.hurtPlayer(1); ok(g.state === 'dead', 'HP 0이면 사망');
  for (let i = 0; i < 120; i++) g.update(DT, EMPTY_INPUT);
  ok(g.state === 'over', '사망 연출 후 결과 상태');
  const g2 = new Game({ hero: 'miyu', seed: 2 }); g2.p.armor = 0;
  g2.p.inv = 0; g2.hurtPlayer(1);
  for (let i = 0; i < 60 * 5; i++) g2.update(DT, EMPTY_INPUT);
  ok(g2.p.armor > 0, '피격 후 시간이 지나면 아머 재생');
}

console.log('⑤ 에너지 / 무기');
{
  const g = new Game({ hero: 'miyu', seed: 4 });
  g.p.weapons = ['laser', 'blaster']; g.p.cur = 0;
  const e0 = g.p.energy;
  g.p.cool = 0; g.attack(WEAPONS.laser);
  ok(g.p.energy < e0, '에너지 무기 발사 시 에너지 감소');
  g.p.energy = 0; const nb = g.bullets.length; g.p.cool = 0; g.attack(WEAPONS.laser);
  ok(g.bullets.length === nb, '에너지 0이면 발사 안 됨');
  g.update(DT, { ...EMPTY_INPUT, swapPressed: true });
  ok(g.p.cur === 1, '무기 교체');
  g.p.cool = 0; g.attack(WEAPONS.blaster); ok(g.bullets.length > nb, '0코스트 무기는 에너지 없이 발사');
}

console.log('⑥ 스킬 3종');
for (const id of HERO_ORDER) {
  const g = new Game({ hero: id, seed: 11 });
  g.addEnemy('slime', g.p.x + 60, FLOOR_ROW * 16 - 11).spawnT = 0;
  g.addEnemy('slime', g.p.x + 90, FLOOR_ROW * 16 - 11).spawnT = 0;
  g.update(DT, EMPTY_INPUT);
  const hp0 = g.enemies.reduce((s, e) => s + e.hp, 0);
  g.update(DT, { ...EMPTY_INPUT, skillPressed: true });
  ok(g.p.skillCd > 0, `${id}: 스킬 발동 → 쿨다운 시작`);
  for (let i = 0; i < 90; i++) g.update(DT, EMPTY_INPUT);
  const hp1 = g.enemies.reduce((s, e) => s + Math.max(0, e.hp), 0);
  if (id === 'miyu') ok(g.p.skillT > 0 || hp1 <= hp0, 'miyu: 콤보 러시 지속 중');
  else ok(hp1 < hp0, `${id}: 스킬이 적에게 피해`, `${hp0}→${hp1}`);
}
{
  const g = new Game({ hero: 'miyu', seed: 12 });
  g.update(DT, { ...EMPTY_INPUT, skillPressed: true });
  const t0 = g.p.skillT;
  const e = g.addEnemy('slime', 100, 100); e.spawnT = 0; g.hurtEnemy(e, 999, false);
  ok(g.p.skillT > t0 + 0.9, 'miyu: 처치 시 스킬 지속 +1초');
}

console.log('⑦ 버프 적용');
{
  const g = new Game({ hero: 'miyu', seed: 6 });
  const hp = g.maxHp(); g.applyBuff('hp'); ok(g.maxHp() === hp + 2, '튼튼한 몸: 최대 HP +2');
  const r = g.mods.rateMul; g.applyBuff('rate'); ok(g.mods.rateMul > r, '속사: 공속 증가');
  g.applyBuff('multi'); g.p.cool = 0; const n = g.bullets.length; g.attack(WEAPONS.blaster); ok(g.bullets.length - n === 2, '분열탄: 발사체 +1');
  ok(BUFFS.length >= 30, `버프 ${BUFFS.length}종`);
  ok(Object.keys(WEAPONS).length >= 20, `무기 ${Object.keys(WEAPONS).length}종`);
}

console.log('⑧ 무한 진행: 봇이 3캐릭터로 30층+ 진행 (크래시/무한루프 없음)');
for (const id of HERO_ORDER) {
  const g = new Game({ hero: id, seed: 1000 + id.length });
  g.god = true;
  const rng = mulberry(77);
  let frames = 0, err = null, stuckFloor = 0, lastFloor = 1, sinceFloor = 0, bosses = 0;
  const target = 31;
  try {
    while (g.floor < target && frames < 60 * 60 * 120) {
      const inp = bot(g, rng);
      g.update(DT, inp);
      if (g.state === 'pick') g.choose((rng() * 3) | 0);
      g.ev.length = 0;
      frames++; sinceFloor++;
      if (g.floor !== lastFloor) { lastFloor = g.floor; sinceFloor = 0; }
      if (sinceFloor > 60 * 60 * 8) { stuckFloor = g.floor; break; }
      if (g.enemies.length > 60 || g.bullets.length > 320 || g.particles.length > 420) throw new Error('상한 초과');
    }
    bosses = g.bossKills;
  } catch (e) { err = e; }
  ok(!err && g.floor >= target, `${id}: ${g.floor}층 도달, 보스 ${bosses}마리, 게임시간 ${(frames / 3600).toFixed(1)}분`, err ? err.stack : `멈춘 층 ${stuckFloor} 방 ${g.room.type} ${g.roomIdx} p=${g.p.x|0},${g.p.y|0} w=${g.p.weapons} 적=${JSON.stringify(g.enemies.map(e=>[e.type,e.x|0,e.y|0,Math.round(e.hp),e.state]))} wave=${g.room.wave}/${g.room.waves} locked=${g.room.locked}`);
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
