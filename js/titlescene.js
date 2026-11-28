// 타이틀 장면: 480x270 픽셀 그림(지하 왕국 · 일식 태양 · 등대 · 벼랑)을 게임과 같은 픽셀 밀도로 화면에 깐다.
// 벼랑 길 위에 등불을 든 리라(숨 쉬는 대기 동작). 등불빛 깜빡임 · 등대 빛줄기 · 흐르는 안개 · 불씨 · 반딧불이. 제목은 DOM(오른쪽 아래 골짜기 위).
const BW = 480, BH = 270;                                          // 배경 그림 크기
const LIRA = [150, 206];                                           // 리라 발 위치 (배경 좌표, 벼랑 길 위)
const LAMP_OFF = [26, -31];                                        // 발 기준 손 등불 위치 (idle 프레임)
const BEACON = [271, 71];                                          // 등대 불빛 (배경 좌표)
const SUN = [163, 26, 25];                                         // 일식 태양 중심·반지름
const V = () => (window.__V ? '?v=' + window.__V : '');
const load = src => { const im = new Image(); let n = 0; im.onerror = () => { if (n++ < 5) setTimeout(() => { im.src = src + V() + (V() ? '&' : '?') + 'r=' + n; }, 500 * n); }; im.src = src + V(); return im; };
const ok = im => im && im.complete && im.naturalWidth;

export function startTitleScene(cv) {
  const g = cv.getContext('2d');
  let W = BW, H = BH, ox = 0, oy = 0;
  // 화면 비율에 맞춰 캔버스를 정함: 넓은 폰은 위아래를 조금 잘라 쓰고(폭 480 유지), 좁은 화면은 오른쪽을 잘라 씀 → 픽셀 크기가 어느 화면에서도 같음
  const fit = () => {
    const cw = cv.clientWidth || innerWidth, ch = cv.clientHeight || innerHeight, asp = cw / Math.max(1, ch);
    const w = asp >= BW / BH ? BW : Math.max(240, Math.round(BH * asp)), h = Math.min(BH, Math.round(w / asp));
    if (w !== W || h !== H || cv.width !== w) { W = w; H = h; cv.width = W; cv.height = H; g.imageSmoothingEnabled = false; }
    ox = 0; oy = -Math.round((BH - H) * 0.3);                        // 위(종유석)보다 아래(벼랑)를 더 남김
  };
  fit();
  const bg = load('assets/title-bg.png');
  let idle = [];
  fetch('assets/anims.json' + V()).then(r => r.json()).then(J => { idle = J.lira.idle.map(f => ({ ...f, img: load(f.src) })); }).catch(() => {});
  const fallback = Array.from({ length: 8 }, (_, i) => ({ img: load(`assets/lira-idle-${i}.png`), ax: 37, ay: 85 }));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const lamp = () => [LIRA[0] + LAMP_OFF[0], LIRA[1] + LAMP_OFF[1]];
  const ember = any => { const [lx, ly] = lamp(); return { x: lx + rnd(-3, 3), y: any ? rnd(40, ly) : ly, vx: rnd(-0.05, 0.12), vy: -rnd(0.1, 0.28), life: rnd(140, 320), hot: Math.random() < 0.4 }; };
  const fly = () => ({ x: rnd(10, BW - 10), y: rnd(120, 230), ph: rnd(0, 6.28), sp: rnd(0.004, 0.01), r: rnd(8, 22) });
  const dust = () => ({ x: rnd(0, BW), y: rnd(-20, BH), vy: rnd(0.04, 0.12), a: rnd(0.15, 0.45) });
  const embers = Array.from({ length: 28 }, () => ember(true)), flies = Array.from({ length: 9 }, fly), motes = Array.from({ length: 40 }, dust);
  // 안개: 가로로 긴 흐린 띠 몇 겹 (깊이마다 속도가 다름)
  const fogs = [{ y: 150, h: 40, sp: 0.05, a: 0.16 }, { y: 196, h: 34, sp: 0.09, a: 0.14 }, { y: 238, h: 40, sp: 0.14, a: 0.2 }];
  let t = 0, raf = 0, alive = true;

  function frame() {
    if (!alive) return;
    t++; fit();
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.fillStyle = '#070912'; g.fillRect(0, 0, W, H);
    g.save(); g.translate(ox, oy);
    if (ok(bg)) g.drawImage(bg, 0, 0);
    // 일식 태양 테두리: 천천히 숨 쉬듯 밝아졌다 어두워짐
    g.globalCompositeOperation = 'lighter';
    const sp = 0.5 + 0.5 * Math.sin(t * 0.02), sg = g.createRadialGradient(SUN[0], SUN[1], SUN[2] - 2, SUN[0], SUN[1], SUN[2] + 16);
    sg.addColorStop(0, 'rgba(255,150,60,0)'); sg.addColorStop(0.18, `rgba(255,150,60,${0.18 + 0.14 * sp})`); sg.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = sg; g.fillRect(SUN[0] - 50, SUN[1] - 50, 100, 100);
    // 등대 빛줄기: 오른쪽으로 뻗는 빛이 천천히 맥동
    const bp = 0.55 + 0.45 * Math.sin(t * 0.03);
    g.save(); g.translate(BEACON[0], BEACON[1]);
    const bl = g.createLinearGradient(0, 0, 150, 0); bl.addColorStop(0, `rgba(255,214,140,${0.32 * bp})`); bl.addColorStop(1, 'rgba(255,214,140,0)');
    g.fillStyle = bl; g.beginPath(); g.moveTo(2, -2); g.lineTo(150, -16); g.lineTo(150, 14); g.lineTo(2, 3); g.fill();
    const bh = g.createRadialGradient(0, 0, 0, 0, 0, 14); bh.addColorStop(0, `rgba(255,220,150,${0.5 * bp + 0.2})`); bh.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = bh; g.fillRect(-14, -14, 28, 28); g.restore();
    g.globalCompositeOperation = 'source-over';
    // 안개 띠 (골짜기 깊이별로 천천히 흐름)
    for (const f of fogs) {
      const off = (t * f.sp) % BW;
      for (let k = -1; k < 2; k++) for (let i = 0; i < 4; i++) {
        const cx = k * BW + i * (BW / 4) + 50 - off, cy = f.y + Math.sin(t * 0.006 + i * 1.7) * 4;
        const fg = g.createRadialGradient(cx, cy, 2, cx, cy, 90); fg.addColorStop(0, `rgba(120,140,170,${f.a})`); fg.addColorStop(1, 'rgba(120,140,170,0)');
        g.fillStyle = fg; g.fillRect(cx - 90, cy - f.h, 180, f.h * 2);
      }
    }
    // 등불빛 (깜빡임) + 벼랑 바닥에 고인 빛
    const [lx, ly0] = lamp(), ly = ly0 + (((t / 9) | 0) % 8 < 4 ? 0 : 1);
    const flick = 0.86 + 0.14 * Math.sin(t * 0.21) * Math.sin(t * 0.053);
    g.globalCompositeOperation = 'lighter';
    const glow = g.createRadialGradient(lx, ly, 1, lx, ly, 80 * flick);
    glow.addColorStop(0, 'rgba(255,170,70,.5)'); glow.addColorStop(0.3, 'rgba(255,130,40,.18)'); glow.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = glow; g.fillRect(lx - 90, ly - 90, 180, 180);
    const pool = g.createRadialGradient(lx, LIRA[1] + 2, 1, lx, LIRA[1] + 2, 54); pool.addColorStop(0, 'rgba(255,170,80,.3)'); pool.addColorStop(1, 'rgba(255,170,80,0)');
    g.fillStyle = pool; g.fillRect(lx - 60, LIRA[1] - 6, 120, 20);
    g.globalCompositeOperation = 'source-over';
    // 리라 (숨 쉬기) — 발밑 그림자
    g.fillStyle = 'rgba(5,4,10,.45)'; g.fillRect(LIRA[0] - 14, LIRA[1] - 1, 28, 2); g.fillRect(LIRA[0] - 10, LIRA[1] + 1, 20, 1);
    const fr = (idle.length ? idle : fallback)[((t / 8) | 0) % 8], f2 = fr && ok(fr.img) ? fr : (idle.length ? idle : fallback).find(q => ok(q.img));
    if (f2) g.drawImage(f2.img, LIRA[0] - f2.ax, LIRA[1] - f2.ay);
    // 불씨: 등불에서 피어올라 흔들리며 식는다
    for (const e of embers) {
      e.x += e.vx + Math.sin((t + e.life) * 0.05) * 0.07; e.y += e.vy; e.life--;
      if (e.life <= 0 || e.y < 10) Object.assign(e, ember(false));
      const a = Math.min(1, e.life / 60);
      g.fillStyle = e.hot ? `rgba(255,226,168,${a})` : `rgba(255,140,60,${a * 0.8})`;
      g.fillRect(Math.round(e.x), Math.round(e.y), 1, 1);
    }
    // 반딧불이: 골짜기 위를 천천히 맴돎 (초록빛, 깜빡)
    for (const q of flies) {
      q.ph += q.sp; const x = Math.round(q.x + Math.cos(q.ph) * q.r), y = Math.round(q.y + Math.sin(q.ph * 1.6) * q.r * 0.4), a = 0.35 + 0.65 * Math.max(0, Math.sin(q.ph * 3 + q.r));
      g.fillStyle = `rgba(190,240,140,${a})`; g.fillRect(x, y, 1, 1);
      g.fillStyle = `rgba(190,240,140,${a * 0.25})`; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3);
    }
    // 떠다니는 먼지 (위에서 아래로 아주 느리게)
    for (const m of motes) { m.y += m.vy; if (m.y > BH) { m.y = -4; m.x = rnd(0, BW); } g.fillStyle = `rgba(200,210,230,${m.a})`; g.fillRect(Math.round(m.x), Math.round(m.y), 1, 1); }
    g.restore();
    // 제목 자리(오른쪽 아래 골짜기)를 살짝 어둡게 · 가장자리 어둠
    const side = g.createRadialGradient(W * 0.78, H * 0.7, 10, W * 0.78, H * 0.7, W * 0.42); side.addColorStop(0, 'rgba(5,4,12,.55)'); side.addColorStop(1, 'rgba(5,4,12,0)');
    g.fillStyle = side; g.fillRect(0, 0, W, H);
    const vig = g.createRadialGradient(W * 0.42, H * 0.55, H * 0.45, W * 0.5, H * 0.5, W * 0.72);
    vig.addColorStop(0, 'rgba(5,3,10,0)'); vig.addColorStop(1, 'rgba(5,3,10,.7)');
    g.fillStyle = vig; g.fillRect(0, 0, W, H);
    // 처음 1초: 검은 화면에서 밝아짐
    if (t < 60) { g.fillStyle = `rgba(5,3,10,${1 - t / 60})`; g.fillRect(0, 0, W, H); }
    raf = requestAnimationFrame(frame);
  }
  frame();
  return () => { alive = false; cancelAnimationFrame(raf); };
}
