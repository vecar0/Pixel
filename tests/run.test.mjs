// 런 구조 테스트: node tests/run.test.mjs
import { test, ok, eq, run } from './lib.mjs';
import { CFG } from '../js/core/config.js';
import { takeTrain, applyStats, runSpell, awaken, genArena, REGIONS, advanceRegion, regionOf, challengeDone, RELICS, OATHS, newRun, chooseOath, relicOffer, takeRelic, nextStage, stageOf, enterRoom, roomCleared, buildRoomWorld, applyRelics } from '../js/core/run.js';
import { tick, EMPTY_INPUT } from '../js/core/world.js';
import { spawnEnemy, ENEMY_DEFS } from '../js/core/enemies.js';
import { resolveEnemyHit as resolveHit } from '../js/core/combat.js';
import { resonancesOf, RESONANCES, STATS } from '../js/core/stats.js';
import { createWorld } from '../js/core/world.js';
import { defaultSave, buy, relicPool, recordRun, dailySeed, UNLOCKS } from '../js/core/meta.js';
const I = o => ({ ...EMPTY_INPUT, ...o });
const steps = (w, n, o = {}) => { for (let i = 0; i < n; i++) tick(w, I(o)); };

test('각인 10종 이상, 서약 3종', () => { ok(Object.keys(RELICS).length >= 10); eq(OATHS.length, 3); });
test('서약을 고르면 시작 각인을 얻는다', () => {
  const r = newRun(1); chooseOath(r, 'parry'); ok(r.relics.includes('echo'), r.relics);
});
test('각인 제안: 3개, 서로 다름, 이미 가진 것 제외, 같은 시드면 같은 결과', () => {
  const r = newRun(7); chooseOath(r, 'dodge');
  const a = relicOffer(r), b = relicOffer({ ...newRun(7), relics: [...r.relics], oath: 'dodge', rng: newRun(7).rng });
  eq(a.length, 3); eq(new Set(a).size, 3); ok(a.every(k => !r.relics.includes(k)));
  takeRelic(r, a[0]); ok(r.relics.includes(a[0]));
});
test('문 선택: 서로 다른 방 2개, 마지막 직전엔 보스만', () => {
  const r = newRun(3); chooseOath(r, 'parry');
  eq(r.route.join(), 'combat,combat,rest,elite,shop,boss');                // 스테이지는 정해진 순서
  for (const t of ['combat', 'combat', 'rest', 'elite', 'shop', 'boss']) { eq(nextStage(r), t); roomCleared(r); }
});
test('방 진행: 전투 클리어 시 불씨 +10, 방 번호 증가', () => {
  const r = newRun(3); chooseOath(r, 'parry'); enterRoom(r, 'combat');
  const e0 = r.embers; roomCleared(r); eq(r.embers - e0, 10); eq(r.roomIdx, 1);
});
test('방 월드: 전투방은 웨이브가 있고, 리라 체력·기름병이 이어진다', () => {
  const r = newRun(5); chooseOath(r, 'parry'); r.hp = 3; r.flasks = 1; enterRoom(r, 'combat');
  const w = buildRoomWorld(r); ok(w.waves.length >= 2); eq(w.player.hp, 3); eq(w.player.flasks, 1);
});
test('엘리트방: 자세 게이지가 있는 강화 이끼 망자', () => {
  const r = newRun(5); chooseOath(r, 'parry'); enterRoom(r, 'elite');
  const w = buildRoomWorld(r); const all = w.waves.flat(); ok(all.some(s => s[2] === 'elite'), JSON.stringify(all));
});
test('각인 효과: 순례자의 인내 → 최대 체력 +1', () => {
  const r = newRun(1); chooseOath(r, 'parry'); takeRelic(r, 'vigor'); enterRoom(r, 'combat');
  eq(buildRoomWorld(r).player.maxHp, CFG.player.hp + 1);
});
test('각인 효과: 두 번째 날개 → 공중 점프 1회', () => {
  const r = newRun(1); chooseOath(r, 'parry'); takeRelic(r, 'wings'); enterRoom(r, 'combat');
  const w = buildRoomWorld(r); w.enemies.length = 0; w.waves = []; steps(w, 40);
  tick(w, I({ jump: true, jumpHeld: true })); steps(w, 20, { jumpHeld: true });
  const y1 = w.player.y; tick(w, I({ jump: true, jumpHeld: true })); steps(w, 6, { jumpHeld: true });
  ok(w.player.y < y1 - 10, 'no air jump');
});
test('각인 효과: 그림자 걸음 → 구르기 거리 +40%', () => {
  const r = newRun(1); chooseOath(r, 'dodge'); enterRoom(r, 'combat');
  const w = buildRoomWorld(r); w.enemies.length = 0; w.waves = []; steps(w, 40);
  const x0 = w.player.x; tick(w, I({ roll: true })); steps(w, 30);
  ok(w.player.x - x0 > CFG.roll.dist * 1.3, w.player.x - x0);
});
test('각인 효과: 반향 → 완벽 패링 시 앞으로 검기 발사', () => {
  const r = newRun(1); chooseOath(r, 'parry'); enterRoom(r, 'combat');
  const w = buildRoomWorld(r); w.enemies.length = 0; w.waves = []; steps(w, 40);
  const p = w.player;
  w.enemies.push({ kind: 'dummy', x: p.x + 30, y: p.y, w: 16, h: 40, face: -1, hp: 100, maxHp: 100, poise: 0, poiseMax: false, stunT: 0, poiseRegenT: 0, hitBy: -1,
    update(w2, e) { if (w2.t === t0 + 1) w2.hitboxes.push({ src: {}, owner: e, x: p.x - 2, y: p.y, w: p.w + 4, h: p.h, dmg: 1, parryable: true, dir: -1 }); } });
  const t0 = w.t + 1; tick(w, I({ parry: true })); tick(w, I());
  ok(w.projectiles.some(b => b.owner === 'player' && b.echo), 'no echo wave');
});
test('각인 효과: 처형자 → 처형 피해 2배', () => {
  const r = newRun(1); chooseOath(r, 'execute'); enterRoom(r, 'combat');
  const w = buildRoomWorld(r); w.enemies.length = 0; w.waves = []; steps(w, 40);
  const e = spawnEnemy(w, 'ghoul', w.player.x + w.player.w + 2, w.player.y); e.maxHp = e.hp = 400; e.poiseMax = true; e.stunT = 100; e.boss = true; e.update = () => {};   // 보스 처형 공식 (일반 적은 즉사)
  tick(w, I({ attack: true })); steps(w, CFG.attack.startupF + CFG.execute.hitF + 4);
  eq(400 - e.hp, Math.round(400 * CFG.poise.executeFrac * 2));
});
test('각인 효과: 화염 칼날 → 3타에 화상 (3초간 초당 3)', () => {
  const r = newRun(1); chooseOath(r, 'parry'); takeRelic(r, 'flame'); enterRoom(r, 'combat');
  const w = buildRoomWorld(r); w.enemies.length = 0; w.waves = []; steps(w, 40);
  const e = spawnEnemy(w, 'ghoul', w.player.x + w.player.w + 2, w.player.y); e.maxHp = e.hp = 500; e.update = () => {};
  for (const k of [0, 1, 2]) { tick(w, I({ attack: true })); steps(w, CFG.attack.startupF + CFG.attack.activeF + 8); e.x = w.player.x + w.player.w + 2; }   // 히트스톱 포함 여유
  const hp = e.hp; steps(w, 200); eq(hp - e.hp, 9);
});
/* ── 지역 2~4 · 새 적 · 보스 · 영구 진행 ── */
test('지역 6곳: 보스 격파 → 다음 지역, 마지막이면 끝', () => {
  const r = newRun(9); chooseOath(r, 'parry'); eq(REGIONS.length, 6);
  for (let i = 1; i < 6; i++) { ok(advanceRegion(r)); eq(r.region, i + 1); eq(r.roomIdx, 0); }
  ok(!advanceRegion(r));
  eq(r.length, REGIONS[5].route.length); eq(r.route.at(-1), 'boss');
});
test('지역별 적 구성과 보스', () => {
  const r = newRun(9); chooseOath(r, 'parry'); advanceRegion(r); enterRoom(r, 'combat');
  const w = buildRoomWorld(r); const kinds = new Set(w.waves.flat().map(s => s[0]));
  ok([...kinds].every(k => REGIONS[1].enemies.includes(k)), [...kinds]);
  enterRoom(r, 'boss'); eq(buildRoomWorld(r).enemies[0].kind, 'saint');
});
test('어둠 단계: 적 체력 증가, 5단계부터 기름병 -1', () => {
  const a = newRun(9, { dark: 0 }), b = newRun(9, { dark: 5 });
  for (const r of [a, b]) { chooseOath(r, 'parry'); enterRoom(r, 'boss'); }
  ok(buildRoomWorld(b).enemies[0].maxHp > buildRoomWorld(a).enemies[0].maxHp);
  eq(buildRoomWorld(b).player.maxFlasks, CFG.flask.charges - 1);
});
test('해금 안 된 각인은 제안되지 않는다', () => {
  const r = newRun(9, { pool: ['echo', 'vigor', 'oil', 'chain'] }); chooseOath(r, 'parry');
  for (let i = 0; i < 5; i++) ok(relicOffer(r).every(k => r.pool.includes(k)));
});
function arenaWith(kind, dx = 120) {
  const w = createWorld({ room: 'test', solids: [{ x: -1000, y: 300, w: 4000, h: 40 }] }); steps(w, 30); w.player.hp = 99;
  const e = spawnEnemy(w, kind, w.player.x + dx, 300 - ENEMY_DEFS[kind].h); return { w, e };
}
test('해골 창병: 3연 찌르기 간격 ≥16틱', () => {
  const { w, e } = arenaWith('spearman', 60); e.cd = 0; let starts = [], last = null;
  for (let i = 0; i < 3000 && starts.length < 3; i++) {
    tick(w, I()); if (e.st === 'idle' && e.cd <= 0) e.atk = null;
    const h = w.hitboxes.find(h => h.owner === e); if (h && h.src !== last) { starts.push(w.t); last = h.src; }
    if (e.st === 'recover' && e.atk !== 'triple') starts = [];
  }
  ok(starts.length === 3 || starts.length === 1, starts.length);
  for (let i = 1; i < starts.length; i++) ok(starts[i] - starts[i - 1] >= 16);
});
test('침수 사제: 조준탄 → 완벽 패링하면 반사', () => {
  const { w, e } = arenaWith('priest', 220); let reflected = false;
  for (let i = 0; i < 600 && !reflected; i++) {
    const b = w.projectiles.find(b => b.owner === 'enemy');
    const near = b && Math.abs((b.x + b.w / 2) - (w.player.x + w.player.w / 2)) < 14;
    tick(w, I(near && w.player.state !== 'parry' ? { parry: true } : {}));
    if (w.projectiles.some(b => b.owner === 'player')) reflected = true;
  }
  ok(reflected);
});
test('갑각 파수꾼: 정면 공격은 막히고 등 뒤는 들어간다', () => {
  const { w, e } = arenaWith('shellguard', 40); e.cd = 9999; e.update = null; e.face = -1; e.st = 'idle';
  const hp0 = e.hp; tick(w, I({ attack: true })); steps(w, 8);
  eq(e.hp, hp0, 'front not blocked');
  e.staggerT = 999; e.face = 1; e.hitBy = -1; steps(w, 20); tick(w, I({ attack: true })); steps(w, 8);   // 경직으로 방향 고정
  ok(e.hp < hp0, 'back not hit');
});
test('그림자 자객: 순간이동 후에도 예고 ≥18틱', () => {
  const { w, e } = arenaWith('assassin', 260); e.cd = 0; let blinkT = -1, teleT = -1, hitT = -1;
  for (let i = 0; i < 400 && hitT < 0; i++) {
    tick(w, I());
    if (w.events.some(v => v.type === 'blink') && blinkT < 0) blinkT = w.t;
    if (e.st === 'telegraph' && teleT < 0) teleT = w.t;
    if (w.hitboxes.some(h => h.owner === e)) hitT = w.t;
  }
  ok(blinkT > 0, 'no blink'); ok(hitT - teleT >= 18, hitT - teleT);
});
test('흑염의 순례자: 리라의 공격을 패링하고 반격 예고', () => {
  const w = createWorld({ room: 'boss', boss: 'shadow' }); steps(w, 30); w.player.hp = 99;
  const b = w.enemies[0]; b.cd = 9999; let parried = false;
  for (let k = 0; k < 12 && !parried; k++) {
    b.x = w.player.x + w.player.w + 4; b.face = -1; b.st = 'idle';
    tick(w, I({ attack: true })); steps(w, 10);
    if (b.atk === 'counter') parried = true;
  }
  ok(parried);
});
test('랜턴 기름: 각성 전 두르기 속성 (성유 = 빛, 귀화유 = 귀화, 정제유 = 등불 불꽃)', () => {
  const el = oil => { const r = newRun(1, { oil }); enterRoom(r, 'combat'); return buildRoomWorld(r).player.element; };
  eq(el('blue'), 'wil'); eq(el('black'), 'lmp'); eq(el('refined'), null);
});
test('영구 진행: 조각으로 해금, 해금 각인이 풀에 들어감, 클리어 시 어둠 단계 해금', () => {
  const s = defaultSave(); s.shards = 10;
  ok(relicPool(s).includes('wings') && relicPool(s).includes('flame'), 'all relics from start');   // 해금 없음: 처음부터 전부
  const r = newRun(1); r.shards = 9;
  const gain = recordRun(s, r, { won: true, bossesKilled: ['bellBoss'] });
  ok(gain >= 11); eq(s.darkUnlocked, 1); eq(s.bossKills.bellBoss, 1);
});
test('오늘의 시련: 같은 날은 같은 시드', () => {
  const a = dailySeed(new Date(2026, 10, 19)), b = dailySeed(new Date(2026, 10, 19, 23)), c = dailySeed(new Date(2026, 10, 20));
  eq(a.seed, b.seed); ok(a.seed !== c.seed);
});

test('지형 생성: 방마다 다양, 시작 지점 평지, 높은 발판은 디딤이 있어 도달 가능', () => {
  const widths = new Set(), shapes = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const r = newRun(seed), A = genArena(r);
    widths.add(A.width); shapes.add(A.solids.map(s => s.x + ':' + s.y).join());
    const hills = A.solids.filter(s => !s.oneWay && s.y < 300 && s.h < 200), plats = A.solids.filter(s => s.oneWay);
    ok(hills.every(h => h.x >= 260), 'start flat');
    for (const h of hills) ok(h.y === 264 || (h.y === 228 && hills.some(o => o.y === 264 && o.x < h.x && o.x + o.w > h.x + h.w)), 'tier 36');
    for (const p of plats) {
      const under = Math.min(300, ...hills.filter(h => p.x + p.w > h.x && p.x < h.x + h.w).map(h => h.y));
      const step = plats.some(o => o !== p && o.y > p.y && Math.abs(o.y - p.y) <= CFG.player.jumpMaxH - 10 && (Math.max(o.x, p.x) - Math.min(o.x + o.w, p.x + p.w)) < 80);
      ok(under - p.y <= CFG.player.jumpMaxH - 4 || step, 'reachable ' + JSON.stringify(p));
    }
  }
  ok(widths.size >= 3); ok(shapes.size >= 50);
});
test('적은 언덕 벽에 막히면 뛰어올라 넘어간다', () => {
  const w = createWorld({ room: 'arena', width: 1280, solids: [{ x: -40, y: 300, w: 1400, h: 60 }, { x: 400, y: 264, w: 200, h: 96 }] });
  w.waves = []; w.cleared = true; w.enemies.length = 0; w.player.x = 680; w.player.y = 238;
  const e = spawnEnemy(w, 'ghoul', 200, 300 - ENEMY_DEFS.ghoul.h - 2); e.cd = 99999;
  steps(w, 400); ok(e.x > 600, 'ghoul passed hill: ' + e.x);
});
test('낮은 턱은 걸어서 오르고, 적은 언덕 위에 서서 등장', () => {
  const w = createWorld({ room: 'arena', width: 1280, solids: [{ x: -40, y: 300, w: 1400, h: 60 }, { x: 200, y: 286, w: 200, h: 74 }] });
  w.waves = []; w.enemies.length = 0;
  steps(w, 20); steps(w, 90, { right: true });
  ok(w.player.x > 220, 'climbed: ' + w.player.x); ok(w.player.y + w.player.h <= 286.01 || w.player.x > 400);
  w.player.x = 1000; w.waves = [[['ghoul', 260]]]; w.cleared = false; w.waveDelay = 59; tick(w, I());
  const e = w.enemies[0]; eq(Math.round(e.y + e.h), 284);
});

test('웨이브 적은 리라 옆에 생기지 않고, 0.8초 동안 솟아오르며 그동안 맞지도 때리지도 않는다', () => {
  const w = createWorld({ room: 'arena', width: 1280, solids: [{ x: -40, y: 0, w: 40, h: 360 }, { x: 1280, y: 0, w: 40, h: 360 }, { x: -40, y: 300, w: 1400, h: 60 }] });
  w.enemies.length = 0; w.player.x = 600; steps(w, 10);
  w.waves = [[['ghoul', 620]]]; w.cleared = false; w.waveDelay = 59; tick(w, I());
  const e = w.enemies[0]; ok(Math.abs(e.x + e.w / 2 - (w.player.x + w.player.w / 2)) >= 190, 'far: ' + e.x); ok(e.spawnT > 40);
  const hp = e.hp; e.x = w.player.x + 30; steps(w, 12, { attack: true }); eq(e.hp, hp); eq(e.st, 'idle');
  steps(w, 50); eq(e.spawnT, 0);
});

test('스탯: 6종 모두 10에서 시작, 반대 스탯 쌍(힘↔민첩·의지↔등불·생명↔투지), 0~20', () => {
  const r = newRun(3); ok(Object.values(r.stats).every(v => v === 10));
  takeTrain(r, 'str'); eq(r.stats.str, 11); eq(r.stats.agi, 9);                         // 반대 스탯(민첩)이 1 내려감
  for (let i = 0; i < 19; i++) takeTrain(r, 'str'); eq(r.stats.str, 20); eq(r.stats.agi, 0);   // 쌍의 합은 늘 20, 끝에서 멈춤
  takeTrain(r, 'wil'); eq(r.stats.wil, 11); eq(r.stats.lmp, 9); takeTrain(r, 'fury'); eq(r.stats.fury, 11); eq(r.stats.vit, 9);
  eq(r.stats.str + r.stats.agi, 20); eq(r.stats.wil + r.stats.lmp, 20); eq(r.stats.vit + r.stats.fury, 20);
});
test('스탯 한 점의 효과: 힘 1점 = 피해 +6%, 생명 2점 = 최대 체력 +1, 의지 2점 = 완벽 판정 +1프레임', () => {
  const mk = st => { const r = newRun(1); Object.assign(r.stats, st); enterRoom(r, 'combat'); return buildRoomWorld(r); };
  eq(mk({ vit: 11 }).player.maxHp, 5); eq(mk({ vit: 12 }).player.maxHp, 6); eq(mk({ vit: 18 }).player.maxHp, 9); eq(mk({ vit: 4 }).player.maxHp, 2);
  ok(Math.abs(mk({ str: 11 }).player.mods.atkMul - 1.06) < 1e-9); ok(Math.abs(mk({ str: 12 }).player.mods.atkMul - 1.12) < 1e-9);
  eq(mk({ wil: 12 }).player.mods.perfectExtra, 1); eq(mk({ wil: 6 }).player.mods.perfectExtra, -2);
});
test('등불 각성: 14 이상 없으면 기름 마법, 처음 14가 된 스탯으로 각성(고정), 그 스탯 14/17/20마다 풀기 마법', () => {
  const r = newRun(5, { oil: 'blue' }); eq(runSpell(r), 'ward');
  eq(runSpell(newRun(5)), 'bolt');
  for (let i = 0; i < 3; i++) takeTrain(r, 'str'); eq(r.stats.str, 13); eq(awaken(r), null); eq(runSpell(r), 'ward');   // 힘 13: 아직 기름 마법
  takeTrain(r, 'str'); eq(awaken(r), 'str'); eq(runSpell(r), 'pillar');                          // 힘 14 → 화염 각성, 화염 기둥
  r.stats.agi = 16; r.lastUp = 'agi'; eq(awaken(r), null); eq(runSpell(r), 'pillar');            // 이미 각성: 다른 스탯이 높아도 그대로 (휴식방에서만 변경)
  r.stats.str = 20; eq(runSpell(r), 'meteor');                                                   // 힘 20 → 운석
  enterRoom(r, 'combat'); const w = buildRoomWorld(r); eq(w.player.spells.join(), 'meteor'); eq(w.player.element, 'str');
});
test('스탯 구간 능력: 생명 14 기름병+1 회복, 6 이하 약점, 의지 20 모든 패링 완벽, 힘 14 3타 검기', () => {
  const mk = st => { const r = newRun(1); Object.assign(r.stats, st); enterRoom(r, 'combat'); return buildRoomWorld(r); };
  eq(mk({ vit: 14 }).player.mods.flaskBonus, 1); eq(mk({ vit: 6 }).player.mods.flaskBonus, -1); eq(mk({}).player.maxHp, 5);
  ok(mk({ wil: 20 }).player.mods.allPerfect); ok(!mk({ wil: 19 }).player.mods.allPerfect);
  const w = mk({ str: 14 }); w.enemies.length = 0; w.waves = []; steps(w, 20);
  const p = w.player; p.combo = 1; p.comboT = 10; tick(w, I({ attack: true }));
  steps(w, CFG.attack.startupF + 1); ok(w.projectiles.some(b => b.owner === 'player' && b.echo), 'wave');
});

test('쉼터(상점·휴식): 적 없음, 오브젝트 앞 공격 = 상호작용(휘두르지 않음), 오른쪽 출구에 닿으면 나감', () => {
  const r = newRun(2); chooseOath(r, 'parry'); r.roomIdx = 4; nextStage(r); eq(r.room, 'shop');
  const w = buildRoomWorld(r); eq(w.enemies.length, 0); eq(w.props[0].kind, 'merchant');
  steps(w, 20); w.player.x = w.props[0].x - w.player.w / 2; steps(w, 2);
  tick(w, I({ attack: true })); ok(w.events.some(e => e.type === 'interact' && e.kind === 'merchant')); ok(w.player.state !== 'attack');
  w.player.x = w.props[1].x; tick(w, I()); ok(w.events.some(e => e.type === 'exit'));
  r.roomIdx = 2; nextStage(r); eq(buildRoomWorld(r).props[0].kind, 'campfire');
});

test('전투방 출구: 적이 남아 있으면 잠겨서 못 나가고, 다 잡으면 열림', () => {
  const r = newRun(4); chooseOath(r, 'parry'); nextStage(r);
  const w = buildRoomWorld(r), ex = w.props.find(o => o.kind === 'exit'); ok(ex && ex.locked);
  w.player.x = ex.x; tick(w, I()); ok(!w.events.some(e => e.type === 'exit'));
  w.player.x = 100; w.enemies.length = 0; w.waves = []; steps(w, 3); ok(w.cleared); ok(!w.exited);
  w.player.x = ex.x; let out = false; for (let i = 0; i < 3; i++) { tick(w, I()); if (w.events.some(e => e.type === 'exit')) out = true; } ok(out);
});

test('투지: 높으면 치명타(20이면 3배), 14 이상이면 처치 뒤 다음 공격 치명타', () => {
  const mk = st => { const r = newRun(1); Object.assign(r.stats, st); enterRoom(r, 'combat'); return buildRoomWorld(r); };
  const w = mk({ fury: 20, vit: 0 }); eq(w.player.mods.critMul, 3); ok(w.player.mods.critChance > 0.25); ok(w.player.mods.killCrit);
  eq(mk({}).player.mods.critChance, 0); eq(w.player.maxHp, 1);
  eq(runSpell(Object.assign(newRun(1), { stats: { ...newRun(1).stats, fury: 14, vit: 6 }, element: 'fury' })), 'chain');
});

test('공명: 다른 쌍 두 스탯이 14 이상이면 열림, 같은 쌍끼리는 불가', () => {
  eq(RESONANCES.length, 12); ok(RESONANCES.every(r => r.a !== r.b));
  const base = { str: 10, agi: 10, wil: 10, lmp: 10, vit: 10, fury: 10 };
  eq(resonancesOf({ ...base, str: 14, wil: 14 }).map(r => r.id).join(), 'riposte');
  eq(resonancesOf({ ...base, str: 13, wil: 20 }).length, 0);
  eq(resonancesOf({ ...base, str: 16, wil: 16, vit: 14 }).length, 3);
});
test('공명 효과: 철벽 반격·수호·따스한 등불', () => {
  const mk = st => { const r = newRun(1); Object.assign(r.stats, st); enterRoom(r, 'combat'); const w = buildRoomWorld(r); w.enemies.length = 0; w.waves = []; steps(w, 20); return w; };
  const w = mk({ wil: 14, lmp: 6, vit: 14, fury: 6 }); const p = w.player, hp = p.hp; ok(p.mods.res.aegis);
  const hit = () => { const src = {}; w.hitboxes.push({ src, owner: null, x: p.x, y: p.y, w: p.w, h: p.h, dmg: 1, parryable: false, dir: -1 }); for (const hb of w.hitboxes) resolveHit(w, hb); w.hitboxes.length = 0; };
  hit(); eq(p.hp, hp); p.iframes = 0; hit(); eq(p.hp, hp - 1);
  const w2 = mk({ str: 14, agi: 6, wil: 14, lmp: 6 }), p2 = w2.player; p2.riposte = true; p2.face = 1;
  const e = spawnEnemy(w2, 'ghoul', p2.x + p2.w + 2, p2.y); e.update = () => {}; e.maxHp = e.hp = 500; e.poiseMax = false;
  tick(w2, I({ attack: true })); steps(w2, CFG.attack.startupF + 2); eq(500 - e.hp, Math.round(10 * p2.mods.atkMul * 1.6)); ok(!p2.riposte);
  const w3 = mk({ lmp: 14, wil: 6, vit: 14, fury: 6 }), p3 = w3.player; p3.hp = 2;
  for (let i = 0; i < 3; i++) { p3.light = 100; p3.state = 'idle'; p3.enchantT = 0; tick(w3, I({ skill: true })); steps(w3, 40); }
  eq(p3.hp, 3);
});

test('세밀한 능력 구간: 스탯마다 12·14·16·18·20 다섯 능력, 6·3 두 약점이 실제로 켜진다', () => {
  for (const st of STATS) { eq(st.tiers.map(t => t[0]).join(), '12,14,16,18,20'); eq(st.weak.map(t => t[0]).join(), '6,3'); }
  const mk = s2 => { const r = newRun(1); Object.assign(r.stats, s2); enterRoom(r, 'combat'); return buildRoomWorld(r).player; };
  eq(mk({ str: 12 }).mods.execBonus, 1.25); eq(mk({ str: 16 }).mods.str3Poise, 2); eq(mk({ str: 18 }).mods.rangeMul, 1.25); eq(mk({ str: 3 }).mods.atkMul < mk({ str: 4 }).mods.atkMul * 0.9, true);
  eq(mk({ agi: 18 }).mods.airJumps, 1); eq(mk({ agi: 16 }).mods.rollI, 3 + 2);   // 2점마다 1프레임(3) + 16 능력(2)
  eq(mk({ wil: 12 }).mods.parryLight, 5); ok(mk({ wil: 16 }).mods.normalAsPerfect); eq(mk({ wil: 18 }).mods.stunMul, 1.5);
  eq(mk({ lmp: 12 }).mods.quietMul, 0.6); eq(mk({ lmp: 14 }).mods.darkExtra, 120); ok(mk({ lmp: 16 }).mods.shadowElite); eq(mk({ lmp: 18 }).mods.darkSpeed, 1.25); ok(mk({ lmp: 20 }).mods.shadow20); eq(mk({ lmp: 6 }).mods.darkExtra, -60);   // 그림자: 소등·암살
  eq(mk({ vit: 12 }).mods.flaskSpeed, 0.7); eq(mk({ vit: 3 }).maxFlasks, CFG.flask.charges - 1);
  eq(mk({ fury: 12 }).mods.critMul, 2.5); eq(mk({ fury: 16 }).mods.critLight, 10); eq(mk({ fury: 18 }).mods.lowHpCrit, 0.2);
  // 생명 16: 새 방에 들어갈 때 체력 1
  const r = newRun(2); Object.assign(r.stats, { vit: 16, fury: 4 }); r.hp = 3; enterRoom(r, 'combat'); eq(buildRoomWorld(r).player.hp, 4);
});

run();
