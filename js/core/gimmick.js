// 보스마다 고유 기믹 (보스방 오브젝트·보스 상태). world.tick에서 updateGimmick, 리라 공격은 hitGimmick
//  무덤종  — 떨어지는 대종: 쇠사슬 고리를 베면 천장의 대종이 떨어진다. 보스를 종 아래로 유인하면 갇혀 그로기 + 큰 피해
//  침수 성녀 — 물의 장막: 장막을 두르면 받는 피해 1/4. 물창을 완벽 패링해 되돌리면 장막이 깨지며 크게 무너진다
//  유리 여왕거미 — 수정 거울: 거울 뒤에 숨으면 수정 광선이 반사돼 거미에게 돌아간다 (거울은 깨졌다가 다시 자람)
//  흑염의 순례자 — 빛의 등대: 등대를 켜면 빛 속의 그림자는 피해 1.5배·반격 불가. 어둠 속에서는 피해 절반
//  용광로 거인 — 증기 밸브: 달아오르면(붉은 갑옷) 피해 1/4. 거인이 밸브 옆에 있을 때 밸브를 베면 증기로 식어 금이 감(그로기 + 피해 1.6배)
//  꺼진 왕 — 사슬 닻: 서 있는 닻 하나마다 피해가 줄어든다. 닻(4번 베기)을 모두 부수면 왕이 무너진다. 닻은 시간이 지나면 다시 솟음
import { overlap } from './player.js?v=mwpttsns';
import { spawnRain } from './enemies.js?v=mwpttsns';

// 2막(체력 절반) 무대 변화: 무덤종 = 종탑이 무너져 잔해가 떨어짐·대종 재충전 2배 빠름 / 성녀 = 물이 차올라 낮은 바닥에선 느려짐(제단 위는 마른 땅)
//  여왕거미 = 세 번째 거울이 자라고 천장 수정 파편이 쏟아짐 / 순례자 = 개기일식: 더 어두워지고 등대가 짧게 탄다

export const GIMMICK = {
  bell:   { rope: [600, 1000], x: 800, half: 66, dropF: 40, trapF: 240, riseF: 50, cd: 600, cd2: 300, dmg: 80 },
  veil:   { firstF: 300, cd: 900, mul: 0.25, breakDmg: 60, breakPoise: 0.7 },
  mirror: { xs: [440, 980], x2: 1300, h: 94, cd: 900, dmg: 70, poise: 0.5 },
  light:  { xs: [260, 800, 1340], r: 140, litF: 720, litF2: 420, inMul: 1.5, outMul: 0.5 },
  steam:  { xs: [420, 1180], r: 120, hotFirst: 240, hotCd: 480, hotCd2: 300, mul: 0.25, cd: 420, cd2: 260, dmg: 60, stunF: 200, crackF: 420, crackMul: 1.6 },
  anchor: { xs: [300, 800, 1300], hp: 4, regrowF: 1080, regrowF2: 720, mul: [1, 0.75, 0.5, 0.3], stunF: 260, dmg: 90 },
  phase2: { roarF: 110, water: 262, waterRiseF: 150, slow: 0.6, debrisF: 200, shardsF: 260 },   // 체력 절반: 포효 → 무대가 바뀐다
};
export const GIMMICK_OF = { bellBoss: 'bell', saint: 'veil', spider: 'mirror', shadow: 'light', forge: 'steam', king: 'anchor' };
export const GIMMICK_HINT = {
  bellBoss: '천장의 대종 — 무덤종을 종 아래로 유인하고 쇠사슬 고리를 베어라',
  saint: '물의 장막 — 장막이 있으면 피해가 거의 안 들어간다. 물창을 완벽 패링해 되돌려라',
  spider: '수정 거울 — 거울 뒤에 숨으면 광선이 거미에게 반사된다',
  shadow: '빛의 등대 — 등대를 켜라. 빛 속의 그림자는 약해지고 반격하지 못한다',
  forge: '증기 밸브 — 거인이 붉게 달아오르면 피해가 안 들어간다. 밸브 옆으로 유인해 밸브를 베어라',
  king: '사슬 닻 — 닻이 서 있으면 왕이 단단하다. 세 닻을 모두 부숴라',
};

// 보스방 오브젝트
export function gimmickProps(boss) {
  const g = GIMMICK_OF[boss];
  if (g === 'bell') return [...GIMMICK.bell.rope.map(x => ({ kind: 'rope', x })), { kind: 'bell', x: GIMMICK.bell.x, st: 'up', t: 0, cd: 0 }];
  if (g === 'mirror') return GIMMICK.mirror.xs.map(x => ({ kind: 'mirror', x, cd: 0, hitBy: null }));
  if (g === 'light') return GIMMICK.light.xs.map(x => ({ kind: 'beacon', x, litT: 0 }));
  if (g === 'steam') return GIMMICK.steam.xs.map(x => ({ kind: 'valve', x, cd: 0, puffT: 0 }));
  if (g === 'anchor') return GIMMICK.anchor.xs.map(x => ({ kind: 'anchor', x, hp: GIMMICK.anchor.hp, t: 0 }));
  return [];
}
const bossOf = w => w.enemies.find(e => e.boss && !e.dead);

// 받는 피해 배율 (장막·빛/어둠)
export function gimmickDamageMul(w, e) {
  if (e.veil) return GIMMICK.veil.mul;
  if (e.kind === 'shadow' && w.props && w.props.some(o => o.kind === 'beacon')) return e.exposed ? GIMMICK.light.inMul : GIMMICK.light.outMul;
  if (e.hot) return GIMMICK.steam.mul;                                  // 달아오른 갑옷
  if (e.crackT > 0) return GIMMICK.steam.crackMul;                      // 식어서 금 간 갑옷
  if (e.kind === 'king' && w.props) { const n = w.props.filter(o => o.kind === 'anchor' && o.hp > 0).length; return GIMMICK.anchor.mul[n]; }
  return 1;
}

// 리라 공격이 오브젝트에 닿음 (휘두를 때마다)
export function hitGimmick(w, box) {
  for (const o of w.props || []) {
    if (o.kind === 'rope' && overlap(box, { x: o.x - 14, y: 236, w: 28, h: 64 })) {
      const bell = w.props.find(b => b.kind === 'bell');
      if (bell && bell.st === 'up' && bell.cd <= 0) { bell.st = 'drop'; bell.t = 0; w.events.push({ type: 'bellRelease', x: bell.x }); w.shake = Math.max(w.shake, 4); }
    }
    if (o.kind === 'valve' && o.cd <= 0 && overlap(box, { x: o.x - 18, y: 228, w: 36, h: 72 })) {   // 증기 밸브: 거인이 가까우면 식힘
      const b = bossOf(w), S = GIMMICK.steam; o.cd = w.phase2 ? S.cd2 : S.cd; o.puffT = 50; w.events.push({ type: 'steam', x: o.x }); w.hitstop = Math.max(w.hitstop, 4);
      if (b && Math.abs(b.x + b.w / 2 - o.x) < S.r) {
        const wasHot = b.hot; b.hot = false; b.hotCd = w.phase2 ? S.hotCd2 : S.hotCd; b.crackT = S.crackF;
        w.gimmickHits = (w.gimmickHits || []).concat([[b, S.dmg, 0]]);
        if (wasHot) { b.poise = 1; b.stunT = S.stunF; b.st = 'idle'; b.atk = null; b.srcs = []; b.vx = 0; w.events.push({ type: 'stun', x: b.x + b.w / 2, y: b.y }); }
        w.events.push({ type: 'quench', x: b.x + b.w / 2, y: b.y + b.h / 2, hot: wasHot }); w.shake = Math.max(w.shake, 8);
      }
    }
    if (o.kind === 'anchor' && o.hp > 0 && overlap(box, { x: o.x - 20, y: 222, w: 40, h: 78 })) {   // 사슬 닻: 4번 베면 부서짐
      o.hp--; o.t = 0; w.events.push({ type: 'anchorHit', x: o.x, broke: o.hp <= 0 }); w.hitstop = Math.max(w.hitstop, 3);
      if (o.hp <= 0) {
        const b = bossOf(w), A = GIMMICK.anchor; w.shake = Math.max(w.shake, 8);
        if (b && !w.props.some(q => q.kind === 'anchor' && q.hp > 0)) {   // 마지막 닻 → 왕이 무너짐
          w.gimmickHits = (w.gimmickHits || []).concat([[b, A.dmg, 0]]);
          b.poise = 1; b.stunT = A.stunF; b.st = 'idle'; b.atk = null; b.srcs = []; b.vx = 0;
          w.events.push({ type: 'chainsBroken', x: b.x + b.w / 2, y: b.y + b.h / 2 }); w.events.push({ type: 'stun', x: b.x + b.w / 2, y: b.y });
        }
      }
    }
    if (o.kind === 'beacon' && o.litT <= 0 && overlap(box, { x: o.x - 16, y: 236, w: 32, h: 64 })) {
      o.litT = w.phase2 ? GIMMICK.light.litF2 : GIMMICK.light.litF; w.events.push({ type: 'beaconLit', x: o.x }); w.hitstop = Math.max(w.hitstop, 4);
    }
  }
}

// 수정 거울: 광선 판정이 [x0, x0+len] 일 때, 보스 쪽에서 가장 가까운 거울에서 끊는다. 처음 막을 때 반사 피해
export function clipBeam(w, e, x0, len, y, h, dry = false) {   // dry: 예고 그리기용 (부작용 없음)
  const mirrors = (w.props || []).filter(o => o.kind === 'mirror' && (o.cd <= 0 || o.hitBy === e.srcs) && y + h > 300 - GIMMICK.mirror.h && o.x > x0 && o.x < x0 + len);
  if (!mirrors.length) return [x0, len];
  const m = mirrors.sort((a, b) => e.face > 0 ? a.x - b.x : b.x - a.x)[0];
  if (!dry && m.hitBy !== e.srcs) {                                      // 이번 광선이 처음 닿음 → 반사, 거울은 광선이 끝나면 깨짐
    m.hitBy = e.srcs; m.cd = GIMMICK.mirror.cd;
    w.events.push({ type: 'mirrorReflect', x: m.x, y: y + h / 2, tx: e.x + e.w / 2, ty: y + h / 2, dmg: GIMMICK.mirror.dmg, bx: e.x + e.w / 2, by: e.y + e.h / 2 });
    w.gimmickHits = (w.gimmickHits || []).concat([[e, GIMMICK.mirror.dmg, GIMMICK.mirror.poise]]);   // 피해는 updateGimmick에서
    w.hitstop = Math.max(w.hitstop, 6); w.shake = Math.max(w.shake, 8);
  }
  return e.face > 0 ? [x0, Math.max(0, m.x - 8 - x0)] : [m.x + 8, Math.max(0, x0 + len - m.x - 8)];
}

// 반사된 탄이 장막 두른 성녀에게 닿음 → 장막이 깨짐 (true면 처리됨)
export function breakVeil(w, e, b) {
  if (!e.veil || !b.reflected) return false;
  e.veil = false; e.veilCd = GIMMICK.veil.cd;
  w.events.push({ type: 'veilBreak', x: e.x + e.w / 2, y: e.y + e.h / 2, dmg: GIMMICK.veil.breakDmg });
  return true;
}

export function updateGimmick(w, damageEnemy) {
  const b = bossOf(w), P2 = GIMMICK.phase2, p = w.player;
  // 2막: 체력 절반이 되면 포효 (무적·정지) → 무대 변화
  if (b && !w.phase2 && b.hp <= b.maxHp / 2) {
    w.phase2 = { t: 0 }; b.roarT = P2.roarF; b.st = 'idle'; b.atk = null; b.srcs = []; b.stunT = 0; b.poise = 0;
    w.projectiles = w.projectiles.filter(q => q.owner !== 'enemy');
    w.events.push({ type: 'phase2', kind: b.kind, x: b.x + b.w / 2, y: b.y + b.h / 2 }); w.shake = Math.max(w.shake, 14);
    if (b.kind === 'spider') w.props.push({ kind: 'mirror', x: GIMMICK.mirror.x2, cd: 600, hitBy: null });   // 세 번째 거울이 자라기 시작
    if (b.kind === 'shadow') w.eclipse = true;
    if (b.kind === 'forge') { const L = w.level || (w.level = { pickups: [], urns: [], spikes: [], vents: [], movers: [], levers: [], gates: [], chests: [] }); for (const [i, x] of [600, 1000, 240, 1360].entries()) L.vents.push({ x, off: i * 65, st: 'idle' }); }   // 바닥이 갈라져 쇳물이 솟는다
  }
  p.slowMul = 1;
  if (w.phase2 && b) {
    const t = ++w.phase2.t, live = t > P2.roarF;
    if (b.kind === 'saint') {                                            // 물이 차오름 (포효와 함께)
      w.water = 300 - (300 - P2.water) * Math.min(1, t / P2.waterRiseF);
      if (p.y + p.h > w.water + 3) p.slowMul = P2.slow;
    }
    if (live && b.kind === 'bellBoss' && t % P2.debrisF === 0 && b.stunT <= 0) { spawnRain(w, b, { dmg: 1, parryable: false, rain: { n: 3, gap: 120, speed: 3.4 } }); w.events.push({ type: 'debris' }); }
    if (live && b.kind === 'king' && t % P2.shardsF === 0 && b.stunT <= 0) { spawnRain(w, b, { dmg: 1, parryable: true, rain: { n: 4, gap: 80, speed: 4.2 } }); w.events.push({ type: 'debris', star: true }); }   // 왕: 죽은 별이 떨어진다
    if (live && b.kind === 'spider' && t % P2.shardsF === 0 && b.stunT <= 0) { spawnRain(w, b, { dmg: 1, parryable: true, rain: { n: 4, gap: 90, speed: 4 } }); w.events.push({ type: 'debris', crystal: true }); }
  }
  for (const [e, dmg, poise] of w.gimmickHits || []) damageEnemy(w, e, dmg, poise, true);
  w.gimmickHits = null;
  // 무덤종: 대종
  const bell = (w.props || []).find(o => o.kind === 'bell');
  if (bell) {
    const B = GIMMICK.bell; bell.t++; if (bell.cd > 0) bell.cd--;
    if (bell.st === 'drop' && bell.t >= B.dropF) {
      bell.st = 'down'; bell.t = 0; bell.trapped = null;
      const zone = { x: bell.x - B.half, y: 180, w: B.half * 2, h: 120 };
      if (b && overlap(zone, b)) {                                       // 갇힘: 그로기 + 큰 피해 (처형 가능)
        bell.trapped = b; damageEnemy(w, b, B.dmg, 0, true); b.poise = 1; b.stunT = B.trapF; b.st = 'idle'; b.atk = null; b.srcs = []; b.vx = 0;
        b.x = bell.x - b.w / 2;                                           // 종 안으로 끌려 들어감
        w.events.push({ type: 'bellTrap', x: bell.x, y: b.y + b.h / 2, dmg: B.dmg }); w.events.push({ type: 'stun', x: bell.x, y: b.y });
      } else w.events.push({ type: 'bellMiss', x: bell.x });
      w.hitboxes.push({ src: {}, owner: null, x: zone.x, y: zone.y, w: zone.w, h: zone.h, dmg: 1, parryable: false, dir: 1 });   // 리라가 밑에 있으면 맞음
      w.shake = Math.max(w.shake, 12); w.hitstop = Math.max(w.hitstop, 6);
    } else if (bell.st === 'down' && (bell.t >= B.trapF || (bell.trapped && (bell.trapped.dead || bell.trapped.stunT <= 0)))) { bell.st = 'rise'; bell.t = 0; bell.trapped = null; }
    else if (bell.st === 'rise' && bell.t >= B.riseF) { bell.st = 'up'; bell.t = 0; bell.cd = w.phase2 ? B.cd2 : B.cd; }
  }
  // 성녀: 물의 장막
  if (b && b.kind === 'saint') {
    if (b.veilCd == null) b.veilCd = GIMMICK.veil.firstF;
    if (!b.veil && b.stunT <= 0 && --b.veilCd <= 0) { b.veil = true; w.events.push({ type: 'veilUp', x: b.x + b.w / 2, y: b.y + b.h / 2 }); }
  }
  // 수정 거울: 광선이 끝나면 hitBy를 놓아 깨진 상태로
  for (const o of w.props || []) if (o.kind === 'mirror' && o.hitBy && (!b || b.srcs !== o.hitBy || b.st !== 'active')) o.hitBy = null;
  // 용광로 거인: 달아오름 주기 · 밸브 재충전
  if (b && b.kind === 'forge') {
    const S = GIMMICK.steam; if (b.hotCd == null) b.hotCd = S.hotFirst;
    if (b.crackT > 0) b.crackT--;
    if (!b.hot && b.stunT <= 0 && !(b.crackT > 0) && --b.hotCd <= 0) { b.hot = true; w.events.push({ type: 'heatUp', x: b.x + b.w / 2, y: b.y + b.h / 2 }); }
  }
  for (const o of w.props || []) if (o.kind === 'valve') { if (o.cd > 0) o.cd--; if (o.puffT > 0) o.puffT--; }
  // 꺼진 왕: 부서진 닻은 시간이 지나면 다시 솟는다
  for (const o of w.props || []) if (o.kind === 'anchor' && o.hp <= 0 && ++o.t >= (w.phase2 ? GIMMICK.anchor.regrowF2 : GIMMICK.anchor.regrowF) && (!b || b.stunT <= 0)) { o.hp = GIMMICK.anchor.hp; o.t = 0; w.events.push({ type: 'anchorRise', x: o.x }); }
  // 순례자: 빛의 등대
  const beacons = (w.props || []).filter(o => o.kind === 'beacon');
  if (beacons.length) {
    for (const o of beacons) if (o.litT > 0 && --o.litT === 0) w.events.push({ type: 'beaconOut', x: o.x });
    if (b) {
      const was = b.exposed, cx = b.x + b.w / 2;
      b.exposed = beacons.some(o => o.litT > 0 && Math.abs(o.x - cx) < GIMMICK.light.r);
      if (b.exposed !== was) w.events.push({ type: b.exposed ? 'exposed' : 'hidden', x: cx, y: b.y });
      if (b.st === 'active' && b.atk === 'nova') for (const o of beacons) if (o.litT > 0 && Math.abs(o.x - cx) < GIMMICK.light.r) { o.litT = 0; w.events.push({ type: 'beaconOut', x: o.x, snuffed: true }); }   // 폭발로 등대를 끈다
    }
  }
}
