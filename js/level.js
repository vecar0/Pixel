// 방/층 생성 (순수 로직)
import { ROOM_H } from './data.js';

export function mulberry(seed) {
  let s = seed >>> 0;
  const r = () => {
    s = (s + 0x6D2B79F5) >>> 0; let t = s;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.chance = p => r() < p;
  return r;
}

// 타일: 0 빈칸, 1 벽, 2 원웨이 발판, 3 가시, 4 문(잠기면 벽)
export const T_EMPTY = 0, T_SOLID = 1, T_PLAT = 2, T_SPIKE = 3, T_DOOR = 4;
export const FLOOR_ROW = 14; // 이 행부터 바닥

export function isBossFloor(floor) { return floor % 5 === 0; }
export function themeOf(floor) { return Math.floor((floor - 1) / 5) % 4; }

export function floorPlan(floor, rng) {
  if (isBossFloor(floor)) return ['start', 'combat', 'shop', 'boss'];
  const n = 3 + Math.min(2, Math.floor(floor / 4));
  const rooms = ['start'];
  const specials = ['chest', 'shop', 'statue'];
  const specialAt = rng.int(1, n - 1);
  const special = floor === 1 ? 'chest' : rng.pick(specials);
  for (let i = 0; i < n; i++) rooms.push(i === specialAt ? special : 'combat');
  if (rooms[rooms.length - 1] !== 'combat') rooms.push('combat');
  return rooms;
}

export function makeRoom(type, floor, rng) {
  const W = type === 'combat' ? rng.int(40, 52) : 40;
  const H = ROOM_H;
  const t = new Uint8Array(W * H);
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) t[y * W + x] = v; };
  const get = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 1 : t[y * W + x];
  // 천장, 바닥, 벽
  for (let x = 0; x < W; x++) { set(x, 0, 1); set(x, 1, 1); for (let y = FLOOR_ROW; y < H; y++) set(x, y, 1); }
  for (let y = 0; y < H; y++) { set(0, y, 1); set(W - 1, y, 1); }
  // 오른쪽 문 (3칸)
  for (let y = FLOOR_ROW - 3; y < FLOOR_ROW; y++) set(W - 1, y, T_DOOR);

  const spawns = [];
  if (type === 'combat') {
    // 바닥 언덕
    let x = 6;
    while (x < W - 7) {
      if (rng.chance(0.28)) {
        const w = rng.int(2, 4), h = rng.int(1, 2);
        for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) set(x + i, FLOOR_ROW - 1 - j, 1);
        x += w + rng.int(3, 6);
      } else x += rng.int(2, 4);
    }
    // 원웨이 발판 3층
    const layers = [FLOOR_ROW - 3, FLOOR_ROW - 6, FLOOR_ROW - 9];
    layers.forEach((row, li) => {
      let px = rng.int(3, 6);
      while (px < W - 5) {
        const len = rng.int(3, 7);
        const below = li === 0 || hasPlatNear(t, W, px, len, layers[li - 1]);
        if (below && rng.chance(li === 2 ? 0.55 : 0.75)) {
          for (let i = 0; i < len && px + i < W - 2; i++) if (get(px + i, row) === 0) set(px + i, row, T_PLAT);
          if (li < 2) spawns.push({ x: px + (len >> 1), y: row });
        }
        px += len + rng.int(2, 5);
      }
    });
    // 가시
    if (floor >= 2) {
      const groups = rng.int(0, Math.min(3, 1 + Math.floor(floor / 4)));
      for (let g = 0; g < groups; g++) {
        const sx = rng.int(9, W - 10), len = rng.int(2, 3);
        let ok = true;
        for (let i = -1; i <= len; i++) if (get(sx + i, FLOOR_ROW - 1) !== 0 || get(sx + i, FLOOR_ROW) !== 1) ok = false;
        if (ok) for (let i = 0; i < len; i++) set(sx + i, FLOOR_ROW - 1, T_SPIKE);
      }
    }
    for (let sx = 10; sx < W - 3; sx += 3) spawns.push({ x: sx, y: groundRow(t, W, sx) });
  } else if (type === 'boss') {
    for (const [px, row, len] of [[4, FLOOR_ROW - 4, 6], [W - 10, FLOOR_ROW - 4, 6], [W / 2 - 4 | 0, FLOOR_ROW - 7, 8]]) {
      for (let i = 0; i < len; i++) set(px + i, row, T_PLAT);
    }
  } else if (type === 'shop' || type === 'statue' || type === 'chest') {
    for (let i = 0; i < 5; i++) { set(5 + i, FLOOR_ROW - 4, T_PLAT); set(W - 10 + i, FLOOR_ROW - 4, T_PLAT); }
  }
  // 장식 (배경 오브젝트) 위치
  const deco = [];
  for (let x = 2; x < W - 2; x++) if (get(x, FLOOR_ROW - 1) === 0 && get(x, FLOOR_ROW) === 1 && rng.chance(0.12)) deco.push({ x, y: FLOOR_ROW - 1, k: rng.int(0, 3) });
  return { type, W, H, t, spawns, deco, locked: false, cleared: type !== 'combat' && type !== 'boss', seed: rng.int(0, 1e9) };
}

function hasPlatNear(t, W, px, len, row) {
  for (let x = px - 3; x < px + len + 3; x++) if (x > 0 && x < W && t[row * W + x] === T_PLAT) return true;
  return false;
}
export function groundRow(t, W, x) {
  for (let y = 2; y < ROOM_H; y++) { const v = t[y * W + x]; if (v === 1) return y; }
  return 14;
}
