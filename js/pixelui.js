// 픽셀 버튼: 작은 비트맵을 코드로 찍어 dataURL로 만들고, CSS가 image-rendering: pixelated로 크게 키워 쓴다.
// - 원형 터치 버튼: 24x24 픽셀 원 (테두리 색 = 역할), 위쪽 하이라이트·아래쪽 그림자
// - 메뉴 버튼: 12x12 9-slice 판 (모서리 깎임), border-image로 어떤 크기든 픽셀 모양 유지
const cache = new Map();
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
function canvasOf(w, h, paint) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), d = g.createImageData(w, h);
  const set = (x, y, rgb, a = 255) => { const i = (y * w + x) * 4; d.data[i] = rgb[0]; d.data[i + 1] = rgb[1]; d.data[i + 2] = rgb[2]; d.data[i + 3] = a; };
  paint(set); g.putImageData(d, 0, 0); return c;
}

// 원형 버튼. ring: 테두리 색, fill: 0~1 (마법 버튼처럼 아래에서 차오르는 양), down: 눌림
export function roundBtn(ring, { fill = -1, down = false, size = 24 } = {}) {
  const key = `r${ring}${fill}${down}${size}`; if (cache.has(key)) return cache.get(key);
  const R = size / 2, RC = hex(ring), INK = [8, 6, 12], BODY = down ? [70, 56, 84] : [36, 29, 44], LIT = mix(RC, [255, 255, 255], 0.45), SH = mix(RC, [0, 0, 0], 0.45);
  const FILL = mix(RC, BODY, 0.35);
  const url = canvasOf(size, size, set => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - R, dy = y + 0.5 - R, d = Math.hypot(dx, dy);
      if (d > R) continue;
      if (d > R - 1) { set(x, y, INK); continue; }                          // 바깥 검은 윤곽
      if (d > R - 3) {                                                      // 테두리: 위왼쪽 밝게, 아래오른쪽 어둡게
        const lit = dx + dy < -R * 0.6, dark = dx + dy > R * 0.7;
        set(x, y, lit ? LIT : dark ? SH : RC); continue;
      }
      if (d > R - 4) { set(x, y, INK, 200); continue; }                     // 안쪽 그림자 띠
      const filled = fill >= 0 && (y + 0.5) / size > 1 - fill;              // 아래에서 위로 차오름
      set(x, y, filled ? FILL : (dy < -R * 0.45 && dx < 0 && d < R * 0.75 ? mix(BODY, [255, 255, 255], 0.08) : BODY), down ? 255 : 225);
    }
  }).toDataURL();
  cache.set(key, url); return url;
}

// 메뉴 버튼 9-slice (12x12, 테두리 4px): 모서리 2px 깎음, 위 하이라이트, 아래 두꺼운 그림자
export function panelBtn(face, { down = false } = {}) {
  const key = `p${face}${down}`; if (cache.has(key)) return cache.get(key);
  const F = hex(face), INK = [8, 6, 12], HI = mix(F, [255, 255, 255], 0.5), SH = mix(F, [0, 0, 0], 0.5), S = 12;
  const url = canvasOf(S, S, set => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const cx = Math.min(x, S - 1 - x), cy = Math.min(y, S - 1 - y);
      if (cx + cy < 2) continue;                                            // 깎인 모서리 (투명)
      if (cx === 0 || cy === 0 || cx + cy === 2) { set(x, y, INK); continue; }   // 검은 윤곽
      const bottom = y >= S - 3, top = y === 1 || (y === 2 && !down);
      set(x, y, down ? (top ? F : F) : bottom ? SH : top ? HI : F);
    }
  }).toDataURL();
  cache.set(key, url); return url;
}

// 페이지에 CSS 변수로 등록 (style.css가 var(--px-…)로 씀)
export function installPixelUI() {
  const root = document.documentElement.style, u = s => `url(${s})`;
  root.setProperty('--px-btn', u(panelBtn('#ffb347'))); root.setProperty('--px-btn-down', u(panelBtn('#ffb347', { down: true })));
  root.setProperty('--px-btn-alt', u(panelBtn('#3a3046'))); root.setProperty('--px-btn-alt-down', u(panelBtn('#3a3046', { down: true })));
  root.setProperty('--px-row', u(panelBtn('#2a2232'))); root.setProperty('--px-row-down', u(panelBtn('#3a3046', { down: true })));
  const ring = { attack: '#d9cfc0', parry: '#ffb347', roll: '#8fc8ff', jump: '#6aa0d0', flask: '#7fe08a', pause: '#9a8fa6', stick: '#9a8fa6', skill: '#ffb347', snuff: '#9a5cc4' };
  for (const [k, c] of Object.entries(ring)) { root.setProperty(`--px-${k}`, u(roundBtn(c))); root.setProperty(`--px-${k}-down`, u(roundBtn(c, { down: true }))); }
  root.setProperty('--px-knob', u(roundBtn('#ece3d3', { size: 12, down: true })));
}
