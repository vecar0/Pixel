// 사슬 물리 (그림 전용, 판정 없음): 낫 자루 끝에서 나온 사슬 + 끝의 등불.
// Verlet 로프 — 중력·관성·감쇠, 고리 길이 제약, 바닥·발판·리라 몸과 충돌.
// 들고 있을 땐 사슬이 자루에 감겨 묶여 있고 등불은 자루 끝에 짧게 매달려 거의 흔들리지 않는다.
// 던지면 감긴 사슬이 풀리며 늘어나 등불을 따라가고, 회수하면 다시 감겨 짧아진다.
const N = 44;                     // 마디 수 (시뮬레이션 해상도)
const HOLD_LEN = 7;               // 들고 있을 때 늘어진 사슬 길이(px): 자루 끝 고리에서 등불까지 아주 짧게
const WRAP = 16;                  // 들고 있을 때 자루에 감긴 사슬 길이(px): 던지면 이만큼 먼저 풀려나감
const HELD_DAMP = 0.72;           // 묶인 사슬: 흔들림이 금방 멎음
const GRAV = 0.32, DAMP = 0.986, ITER = 14;
const LANTERN_W = 5;              // 등불 무게 (끝점이 다른 마디보다 이만큼 무거움)
const LANTERN_H = 14;             // 등불 그림 높이: 끝점이 이만큼 위에서 바닥에 닿음 (등불이 땅에 묻히지 않게)

function solidsTop(solids, x, y) { for (const s of solids) if (x >= s.x && x <= s.x + s.w && Math.abs(y - s.y) < 1.5) return true; return false; }
function groundBelow(solids, x, y) {
  let g = 1e9; for (const s of solids) if (x >= s.x && x <= s.x + s.w && s.y >= y - 30 && s.y < g) g = s.y; return g;
}

export class ChainSim {
  constructor() { this.pts = null; this.len = HOLD_LEN; this.wrap = WRAP; this.lastT = -1; }
  reset(x, y) {
    this.pts = Array.from({ length: N }, (_, i) => ({ x, y: y + i * HOLD_LEN / (N - 1), px: x, py: y + i * HOLD_LEN / (N - 1) }));
    this.len = HOLD_LEN;
  }
  // anchor: 자루 끝(세계 좌표) · lamp: 던진 등불 상태 · w: 세계 (바닥·발판) · body: 리라 몸 상자
  // dir: 자루가 끝으로 향하는 방향 (사슬이 고리에서 이 방향으로 나가다 휘어짐)
  step(w, anchor, lamp, body, dir) {
    this.dir = dir;
    if (!this.pts || Math.hypot(this.pts[0].x - anchor.x, this.pts[0].y - anchor.y) > 140) this.reset(anchor.x, anchor.y);
    const P = this.pts, out = lamp && lamp.st !== 'held';
    { const e = P[N - 1]; this.groundedEnd = !out && Math.abs(e.y - e.py) < 0.2 && solidsTop(w.solids || [], e.x, e.y + LANTERN_H); }
    // 사슬 길이: 들면 짧게, 던지면 등불까지 거리 + 여유(처짐)만큼 풀려나오고, 회수하면 감김
    let want = HOLD_LEN;
    if (out) { const d = Math.hypot(lamp.x - anchor.x, lamp.y - anchor.y); want = Math.max(HOLD_LEN, d * (lamp.st === 'placed' ? 1.08 : 1.02) + 6); }
    this.len += (want - this.len) * (want > this.len ? 0.55 : 0.35);
    this.wrap = Math.max(0, WRAP - (this.len - HOLD_LEN));            // 감긴 길이: 풀린 만큼 줄어듦
    const held = !out && this.len < HOLD_LEN + 2, damp = held ? HELD_DAMP : DAMP;
    const seg = this.len / (N - 1);
    // 적분: 관성 + 중력 (끝 등불은 무거워 흔들림이 느리고 크게)
    for (let i = 1; i < N; i++) {
      const p = P[i], vx = (p.x - p.px) * damp, vy = (p.y - p.py) * damp;
      p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + GRAV * (i === N - 1 ? 1.15 : 1);
    }
    P[0].px = P[0].x; P[0].py = P[0].y; P[0].x = anchor.x; P[0].y = anchor.y;   // 자루 끝에 고정 (자루가 휘두르면 그 힘이 사슬로 전해짐)
    const solids = w.solids || [];
    for (let k = 0; k < ITER; k++) {
      for (let i = 0; i < N - 1; i++) {                                // 고리 길이 제약 (끝점은 등불 무게만큼 덜 움직임)
        const a = P[i], b = P[i + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, diff = (d - seg) / d;
        const wa = i === 0 ? 0 : 1, wb = i + 1 === N - 1 ? 1 / LANTERN_W : 1, s = wa + wb; if (!s) continue;
        a.x += dx * diff * wa / s; a.y += dy * diff * wa / s; b.x -= dx * diff * wb / s; b.y -= dy * diff * wb / s;
      }
      P[0].x = anchor.x; P[0].y = anchor.y;
      if (dir) for (const [j, k2] of held ? [[1, 0.9], [2, 0.6], [3, 0.35], [4, 0.15]] : [[1, 0.75], [2, 0.35], [3, 0.12]]) {   // 자루 끝 고리: 처음 몇 고리는 자루 방향을 따라 나가다 무게에 휘어짐 (꺾임 없이)
        const q = P[j], tx = anchor.x + dir.x * seg * j, ty = anchor.y + dir.y * seg * j; q.x += (tx - q.x) * k2; q.y += (ty - q.y) * k2;
      }
      if (out) { const e = P[N - 1]; e.x = lamp.x; e.y = lamp.st === 'placed' ? groundBelow(solids, lamp.x, lamp.y) - LANTERN_H : lamp.y - 7; }   // 던진 등불: 끝 고리가 등불에 걸림 (놓이면 땅 위에 섬)   // 던진 등불: 끝이 등불 고리에 걸림
      for (let i = 1; i < N; i++) {                                    // 충돌: 바닥·벽·발판 위 / 리라 몸 밖으로
        const p = P[i];
        for (const s of solids) {
          const hgt = i === N - 1 ? LANTERN_H : 1;                      // 끝(등불)은 등불 높이만큼 위에서 바닥에 닿음
          if (p.x < s.x || p.x > s.x + s.w || p.y < s.y - hgt || p.y > s.y + s.h) continue;
          const fromAbove = p.py <= s.y - hgt + 1;
          if (s.oneWay && !fromAbove) continue;                        // 발판은 위에서 떨어질 때만
          const fromSide = !fromAbove && !s.oneWay && (p.px < s.x || p.px > s.x + s.w);   // 옆에서 들어옴 (언덕·벽 옆면)
          if (fromSide) { p.x = p.px < s.x ? s.x - 0.5 : s.x + s.w + 0.5; p.px = p.x; }      // 옆면에 막힘
          else { p.y = s.y - hgt; p.px += (p.x - p.px) * 0.4; }                             // 바닥·윗면: 올려놓고 끌리며 멈춤 (마찰)
        }
        if (body && i > 3 && !out) {                                    // 몸을 뚫지 않고 옆으로 비켜 걸침
          const bx0 = body.x + 2, bx1 = body.x + body.w - 2, by0 = body.y + 12, by1 = body.y + body.h - 4;
          if (p.x > bx0 && p.x < bx1 && p.y > by0 && p.y < by1) { const l = p.x - bx0, r = bx1 - p.x; if (l < r) p.x = bx0; else p.x = bx1; }
        }
      }
    }
  }
  // 고리 하나하나: 정면 고리(속이 빈 타원) · 옆 고리(가는 막대)를 번갈아, 사슬 방향으로 돌려서
  draw(g, lampImg, t, held) {
    const P = this.pts; if (!P) return;
    const pts = [P[0]]; let acc = 0, need = 3.2;
    for (let i = 1; i < N; i++) {                                    // 폴리라인을 3.2px 간격으로 다시 나눔 (시뮬 해상도와 무관하게 고리 크기 일정)
      const a = P[i - 1], b = P[i], d = Math.hypot(b.x - a.x, b.y - a.y);
      let u = 0;
      while (acc + d * (1 - u) >= need) { u += (need - acc) / d; acc = 0; pts.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }); }
      acc += d * (1 - u);
    }
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], ang = Math.atan2(b.y - a.y, b.x - a.x), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const px = (u, v) => [Math.round(mx + ca * u - sa * v), Math.round(my + sa * u + ca * v)];
      if (i % 2) {                                                      // 정면 고리: 외곽 어둡게 · 윗면 밝게 · 가운데 구멍
        for (const [u, v, c] of [[-2, 0, '#1a1620'], [2, 0, '#1a1620'], [-1, -1, '#c8c2d0'], [0, -1, '#e2dce8'], [1, -1, '#c8c2d0'], [-1, 1, '#4a4452'], [0, 1, '#3a3442'], [1, 1, '#4a4452']]) {
          const [x, y] = px(u, v); g.fillStyle = c; g.fillRect(x, y, 1, 1);
        }
      } else {                                                          // 옆 고리: 가는 막대 (밝은 날 + 어두운 그림자)
        for (const [u, v, c] of [[-1, 0, '#8a8494'], [0, 0, '#b0aab8'], [1, 0, '#8a8494'], [0, 1, '#2a2430']]) {
          const [x, y] = px(u, v); g.fillStyle = c; g.fillRect(x, y, 1, 1);
        }
      }
    }
    const e = P[N - 1], q = P[N - 3];                                  // 끝의 등불: 마지막 고리에 걸려 매달림 (땅에 닿으면 똑바로 섬)
    if (lampImg && lampImg.naturalWidth) {
      let ang = Math.atan2(e.y - q.y, e.x - q.x) - Math.PI / 2; while (ang > Math.PI) ang -= 2 * Math.PI; while (ang < -Math.PI) ang += 2 * Math.PI;
      const rot = this.groundedEnd ? 0 : Math.max(-0.6, Math.min(0.6, ang));
      g.save(); g.translate(Math.round(e.x), Math.round(e.y)); g.rotate(rot);
      g.drawImage(lampImg, -Math.round(lampImg.naturalWidth / 2), -1); g.restore();
    }
    const A = P[0], d = this.dir;                                      // 자루 끝 고리 (쇠고리 + 쇠테): 사슬이 여기서 나옴
    if (d && this.wrap > 0.5) {                                         // 자루에 감긴 사슬: 자루를 가로지르는 고리들 (앞면 밝게 · 뒷면 어둡게)
      const nx = -d.y, ny = d.x;
      for (let u = 1.5; u <= this.wrap; u += 2.4) {
        const k = Math.round(u / 2.4) % 2, cx = A.x - d.x * u, cy = A.y - d.y * u;
        for (const [v, c] of k ? [[-2, '#1a1620'], [-1, '#8a8494'], [0, '#c8c2d0'], [1, '#8a8494'], [2, '#1a1620']] : [[-2, '#1a1620'], [-1, '#4a4452'], [1, '#4a4452'], [2, '#1a1620']]) {
          g.fillStyle = c; g.fillRect(Math.round(cx + nx * v - d.x * k * 0.6 * v / 2), Math.round(cy + ny * v - d.y * k * 0.6 * v / 2), 1, 1);
        }
      }
    }
    if (d) {
      const nx = -d.y, ny = d.x, R = (u, v) => [Math.round(A.x + d.x * u + nx * v), Math.round(A.y + d.y * u + ny * v)];
      for (const [u, v, c] of [[-1, -1, '#1a1620'], [-1, 1, '#1a1620'], [-1, 0, '#6e5a3e'], [0, -1, '#9a8058'], [0, 1, '#6e5a3e'],   // 쇠테 (자루 끝을 감싼 금속)
        [1, -1, '#1a1620'], [1, 1, '#1a1620'], [2, -1, '#c8c2d0'], [2, 1, '#4a4452'], [3, 0, '#1a1620'], [2, 0, '#2a2430']]) {      // 고리
        const [x, y] = R(u, v); g.fillStyle = c; g.fillRect(x, y, 1, 1);
      }
    }
  }
  lanternPos() { const e = this.pts && this.pts[N - 1]; return e ? { x: e.x, y: e.y + 12 } : null; }
}
