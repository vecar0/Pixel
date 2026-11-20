// 타이틀 장면: 240x135 픽셀 화면을 정수배처럼 키워 화면 전체에 깐다.
// 왼쪽에 등불을 든 리라(숨 쉬는 대기 동작), 등불빛이 깜빡이며 번지고 불씨가 피어오른다. 오른쪽은 DOM 제목.
const H = 135, GROUND = 116;                                        // 폭은 화면 비율에 맞춰 정함 (잘리지 않게)
const LANTERN = [69, 54];                                          // idle 프레임 안 등불 위치
const load = src => { const im = new Image(); im.src = src; return im; };

export function startTitleScene(cv) {
  const W = Math.max(240, Math.round(H * innerWidth / Math.max(1, innerHeight))), LIRA_X = Math.round(W * 0.13);
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  const far = load('assets/bg1-far.png'), mid = load('assets/bg1-mid.png');
  const idle = Array.from({ length: 8 }, (_, i) => load(`assets/lira-idle-${i}.png`));
  const embers = Array.from({ length: 26 }, () => spawnEmber(true));
  let t = 0, raf = 0, alive = true;

  function spawnEmber(anywhere) {
    return { x: LIRA_X + LANTERN[0] + (Math.random() - 0.5) * 10, y: anywhere ? 20 + Math.random() * 90 : GROUND - 84 + LANTERN[1],
      vx: (Math.random() - 0.3) * 0.12, vy: -(0.08 + Math.random() * 0.16), life: 120 + Math.random() * 200, hot: Math.random() < 0.35 };
  }
  const ok = im => im.complete && im.naturalWidth;

  function frame() {
    if (!alive) return;
    t++;
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    // 하늘: 아주 어두운 남색
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#07060c'); sky.addColorStop(1, '#141020');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // 먼 배경·중간 배경 (천천히 흐름), 어둡게
    if (ok(far)) { const s = H / far.naturalHeight, w = far.naturalWidth * s, off = (t * 0.03) % w; for (let x = -off; x < W; x += w) g.drawImage(far, Math.round(x), 0, Math.round(w), H); }
    g.fillStyle = 'rgba(7,6,12,.62)'; g.fillRect(0, 0, W, H);
    if (ok(mid)) { const s = 0.62, w = mid.naturalWidth * s, h = mid.naturalHeight * s, off = (t * 0.08) % w; for (let x = -off; x < W; x += w) g.drawImage(mid, Math.round(x), Math.round(GROUND - h + 4), Math.round(w), Math.round(h)); }
    g.fillStyle = 'rgba(7,6,12,.45)'; g.fillRect(0, 0, W, H);
    // 땅: 어두운 띠 + 윗면 한 줄
    g.fillStyle = '#0c0a12'; g.fillRect(0, GROUND, W, H - GROUND);
    g.fillStyle = '#2a2433'; g.fillRect(0, GROUND, W, 1);
    // 등불빛 (깜빡임)
    const lx = LIRA_X + LANTERN[0], ly = GROUND - 84 + LANTERN[1] + (((t / 9) | 0) % 8 < 4 ? 0 : 1);
    const flick = 0.85 + 0.15 * Math.sin(t * 0.21) * Math.sin(t * 0.053);
    g.globalCompositeOperation = 'lighter';
    const glow = g.createRadialGradient(lx, ly, 2, lx, ly, 95 * flick);
    glow.addColorStop(0, 'rgba(255,170,70,.55)'); glow.addColorStop(0.25, 'rgba(255,130,40,.22)'); glow.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    // 땅에 비친 빛
    const pool = g.createRadialGradient(lx, GROUND + 2, 1, lx, GROUND + 2, 60); pool.addColorStop(0, 'rgba(255,170,80,.35)'); pool.addColorStop(1, 'rgba(255,170,80,0)');
    g.fillStyle = pool; g.fillRect(0, GROUND, W, 20);
    // 리라 (숨 쉬기)
    const im = idle[((t / 8) | 0) % 8];
    if (ok(im)) g.drawImage(im, LIRA_X, GROUND - im.naturalHeight + 1);
    // 불씨: 등불에서 피어올라 흔들리며 식는다
    for (const e of embers) {
      e.x += e.vx + Math.sin((t + e.life) * 0.05) * 0.06; e.y += e.vy; e.life--;
      if (e.life <= 0 || e.y < 0) Object.assign(e, spawnEmber(false));
      const a = Math.min(1, e.life / 60);
      g.fillStyle = e.hot ? `rgba(255,226,168,${a})` : `rgba(255,140,60,${a * 0.8})`;
      g.fillRect(Math.round(e.x), Math.round(e.y), 1, 1);
    }
    // 제목 쪽(오른쪽)은 어둡게 깔아 글자가 또렷하게
    const side = g.createLinearGradient(W * 0.45, 0, W, 0); side.addColorStop(0, 'rgba(5,3,10,0)'); side.addColorStop(1, 'rgba(5,3,10,.7)');
    g.fillStyle = side; g.fillRect(0, 0, W, H);
    // 가장자리 어둠
    const vig = g.createRadialGradient(W * 0.35, H * 0.6, H * 0.35, W * 0.5, H * 0.5, W * 0.75);
    vig.addColorStop(0, 'rgba(5,3,10,0)'); vig.addColorStop(1, 'rgba(5,3,10,.85)');
    g.fillStyle = vig; g.fillRect(0, 0, W, H);
    raf = requestAnimationFrame(frame);
  }
  frame();
  return () => { alive = false; cancelAnimationFrame(raf); };
}
