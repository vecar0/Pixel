import { Particles, Lights, P, Rng, fit, sparkle, clamp, seg, ease, TAU, WHITE, scale } from "../../core/index.js";
import { spell, drawWord } from "./_lib.js";

export const meta = {
  name: "Damage number (quiet)",
  desc: "등불지기용: 별 폭발·불꽃·빛 없이 숫자만 튀어올라 착지하고 사라진다 (타격 불꽃은 따로 그린다).",
  tags: ["ui", "damage", "number", "combat", "text", "hit", "one-shot"],
  size: [76, 68],
  origin: [30, 52],
  duration: 1.05,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#1a0508", "#4a0b12", "#8c1420", "#d42a2e", "#ff5a4a", "#ff9a86", "#ffd8cc", "#ffffff"], text: "-27", seed: 2 },
};

const LAND = -8, FADE = 0.84;

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), word = spell(o.text);
  const ps = new Particles({ rng: R, sparks: [C[7], C[6], C[4], C[2]] }), lights = new Lights();
  // the number is a little body: thrown up and out, it lands, hops once and settles
  const n = { x: 0, y: LAND, vx: 34, vy: -175, sq: 0, hops: 0 };
  const spikes = Array.from({ length: 9 }, (_, i) => [(i / 9) * TAU + R.range(-0.2, 0.2), R.range(8, 14)]);
  let t = 0, hit = false;
  return {
    update(dt) {
      t += dt;
      if (n.hops < 2) {
        n.vy += 900 * dt;
        n.vx -= n.vx * 2 * dt;
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        if (n.y >= LAND && n.vy > 0) {
          n.y = LAND;
          n.sq = 1;
          n.hops++;
          n.vy = n.hops < 2 ? -n.vy * 0.36 : 0;
        }
      }
      n.sq = Math.max(0, n.sq - dt / 0.09);
      ps.update(dt);
      lights.update(dt);
    },

    draw(p) {
      ps.draw(p);
      // the number: punches out big and white, springs to size, squashes as it lands, then lifts and fades
      const out = seg(t, FADE, meta.duration - 0.04);
      if (out < 1) {
        let s = 1.5 + 0.6 * Math.exp(-t * 22) * Math.cos(t * 30), sx = s, sy = s;
        if (n.sq > 0) (sx = s * (1 + 0.18 * n.sq)), (sy = s * (1 - 0.2 * n.sq));
        else if (n.hops < 2 && Math.abs(n.vy) > 120) (sx = s * 0.92), (sy = s * 1.1);
        const W = word.w * sx, H = 7 * sy, x0 = n.x - W / 2, y0 = n.y - H - 6 * ease.inQuad(out);
        const flash = 0;
        const items = word.letters.filter((L) => L.g).map((L) => ({ g: L.g, x: x0 + L.x * sx, y: y0, sx, sy, flash, a: 1 - out }));
        drawWord(p, items, { fill: [C[5], C[5], C[5], C[5]], edge: C[5], under: C[5], outline: C[0], shadow: scale(C[0], 0.5) });   // 단색 (그라데이션·베벨 없음)
      }
      lights.draw(p);
    },
  };
}
