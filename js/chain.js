// 사슬 물리 (그림 전용, 판정 없음): 낫 자루 끝에서 나온 사슬 + 끝의 등불.
// Verlet 로프 — 중력·관성·감쇠, 고리 길이 제약, 바닥·발판·리라 몸과 충돌.
// 들고 있을 땐 짧게 매달려 흔들리고(등불이 추), 던지면 사슬이 풀려 늘어나며 등불을 따라가고, 회수하면 감겨 짧아진다.
const N = 44;                     // 마디 수 (시뮬레이션 해상도)
const HOLD_LEN = 30;              // 들고 있을 때 사슬 길이(px)
const GRAV = 0.32, DAMP = 0.986, ITER = 14;
const LANTERN_W = 5;              // 등불 무게 (끝점이 다른 마디보다 이만큼 무거움)
const LANTERN_H = 25;             // 등불 그림 높이: 끝점이 이만큼 위에서 바닥에 닿음 (등불이 땅에 묻히지 않게)

function groundBelow(solids, x, y) {
  let g = 1e9; for (const s of solids) if (x >= s.x && x <= s.x + s.w && s.y >= y - 30 && s.y < g) g = s.y; return g;
}

export class ChainSim {
  constructor() { this.pts = null; this.len = HOLD_LEN; this.lastT = -1; }
  reset(x, y) {
    this.pts = Array.from({ length: N }, (_, i) => ({ x, y: y + i * HOLD_LEN / (N - 1), px: x, py: y + i * HOLD_LEN / (N - 1) }));
    this.len = HOLD_LEN;
  }
  // anchor: 자루 끝(세계 좌표) · lamp: 던진 등불 상태 · w: 세계 (바닥·발판) · body: 리라 몸 상자
  step(w, anchor, lamp, body) {
    if (!this.pts || Math.hypot(this.pts[0].x - anchor.x, this.pts[0].y - anchor.y) > 140) this.reset(anchor.x, anchor.y);
    const P = this.pts, out = lamp && lamp.st !== 'held';
    // 사슬 길이: 들면 짧게, 던지면 등불까지 거리 + 여유(처짐)만큼 풀려나오고, 회수하면 감김
    let want = HOLD_LEN;
    if (out) { const d = Math.hypot(lamp.x - anchor.x, lamp.y - anchor.y); want = Math.max(HOLD_LEN, d * (lamp.st === 'placed' ? 1.08 : 1.02) + 6); }
    this.len += (want - this.len) * (want > this.len ? 0.55 : 0.35);
    const seg = this.len / (N - 1);
    // 적분: 관성 + 중력 (끝 등불은 무거워 흔들림이 느리고 크게)
    for (let i = 1; i < N; i++) {
      const p = P[i], vx = (p.x - p.px) * DAMP, vy = (p.y - p.py) * DAMP;
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
      if (out) { const e = P[N - 1]; e.x = lamp.x; e.y = Math.min(lamp.y - 17, groundBelow(solids, lamp.x, lamp.y) - LANTERN_H); }   // 던진 등불: 끝이 등불 고리에 걸림
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
    const e = P[N - 1], q = P[N - 4];                                  // 끝의 등불: 마지막 고리 방향으로 매달림
    if (lampImg && lampImg.naturalWidth) {
      const ang = Math.atan2(e.y - q.y, e.x - q.x) - Math.PI / 2;
      g.save(); g.translate(Math.round(e.x), Math.round(e.y)); g.rotate(held ? Math.max(-0.9, Math.min(0.9, ang)) : 0);
      g.drawImage(lampImg, -Math.round(lampImg.naturalWidth / 2), -2); g.restore();
    }
  }
  lanternPos() { const e = this.pts && this.pts[N - 1]; return e ? { x: e.x, y: e.y + 12 } : null; }
}
