// 모든 도트는 여기서 한 픽셀씩 직접 찍는다. 외부 이미지 0장.
// 그리드: 문자 1개 = 픽셀 1개. sym()은 왼쪽 절반을 좌우 반전해 붙인다.

export const OUTLINE = '#140c1c';

export function sym(halves, overrides = []) {
  const rows = halves.map(h => h + [...h].reverse().join(''));
  return override(rows, overrides);
}
export function override(rows, list) {
  const r = rows.map(s => s.split(''));
  for (const [x, y, c] of list) if (r[y] && x >= 0 && x < r[y].length) r[y][x] = c;
  return r.map(a => a.join(''));
}

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

// 그리드를 픽셀 배열에 찍기
function stamp(buf, W, rows, pal, ox, oy) {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = ch === 'o' ? (pal.o || OUTLINE) : pal[ch];
      if (!col) continue;
      const px = ox + x, py = oy + y;
      if (px < 0 || py < 0 || px >= W || py >= buf.length / W) continue;
      buf[py * W + px] = col;
    }
  }
}

// 바깥 외곽선 자동 추가 (이미 외곽선인 픽셀 옆에는 추가하지 않음)
function outlinePass(buf, W, H, color = OUTLINE, skipNearOutline = true) {
  const add = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (buf[y * W + x]) continue;
    let need = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const v = buf[ny * W + nx];
      if (v && (!skipNearOutline || v !== OUTLINE)) need = true;
    }
    if (need) add.push(y * W + x);
  }
  for (const i of add) buf[i] = color;
}

function toCanvas(buf, W, H) {
  const [c, g] = mk(W, H);
  const img = g.createImageData(W, H);
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i];
    if (!v) continue;
    const n = parseInt(v.slice(1), 16);
    img.data[i * 4] = (n >> 16) & 255;
    img.data[i * 4 + 1] = (n >> 8) & 255;
    img.data[i * 4 + 2] = n & 255;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function gridCanvas(rows, pal, { pad = 1, outline = true, scale = 1 } = {}) {
  const gw = Math.max(...rows.map(r => r.length)), gh = rows.length;
  const W = gw + pad * 2, H = gh + pad * 2;
  const buf = new Array(W * H).fill(null);
  stamp(buf, W, rows, pal, pad, pad);
  if (outline) outlinePass(buf, W, H, pal.o || OUTLINE);
  const c = toCanvas(buf, W, H);
  return scale === 1 ? c : scaleCanvas(c, scale);
}

export function scaleCanvas(src, s) {
  const [c, g] = mk(src.width * s, src.height * s);
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
export function flipCanvas(src) {
  const [c, g] = mk(src.width, src.height);
  g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
  return c;
}
export function tintCanvas(src, color, alpha = 1) {
  const [c, g] = mk(src.width, src.height);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = alpha; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return c;
}
// 선택 아이콘용 흰 테두리 (2px)
export function stickerCanvas(src, color = '#ffffff', width = 2) {
  const W = src.width + width * 2, H = src.height + width * 2;
  const [c, g] = mk(W, H);
  const g0 = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
  g.fillStyle = color;
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    if (g0[(y * src.width + x) * 4 + 3] < 10) continue;
    g.fillRect(x, y, width * 2 + 1, width * 2 + 1);
  }
  g.drawImage(src, width, width);
  return c;
}

/* ───────────────────────── 주인공 ───────────────────────── */

// 미유: 고양이 후드 게이머 (민트 머리, 남색 후드, 시안 트림)
const MIYU = {
  id: 'miyu',
  pal: {
    H: '#2d3166', h: '#1c1f45', i: '#4c55a0', E: '#ffc9dc', C: '#3ff0e2',
    M: '#9af7d6', m: '#4fc9aa', n: '#2b8a75', S: '#ffe3d1', s: '#f1a996',
    K: '#10303f', T: '#20d4b6', t: '#d6fff6', B: '#ff8fae', w: '#ffffff',
    D: '#22203a', P: '#ff7fb8', p: '#ffd1e6', V: '#8a5cff',
  },
  grid: sym([
    '...oo.......',
    '..oiHo......',
    '..oiEHo.....',
    '..oHEEHooooo',
    '..oHEEHHHHHH',
    '.oHHHHHiiHHH',
    '.oHHCCCCCCCC',
    'oHHCMMMMMMMM',
    'oHHCMMmMMMMm',
    'oHCMMmSmMMmS',
    'oHCMmSSSmMSS',
    'oHCMmKKKKSSS',
    'oHCMmSKwTSSS',
    'oHCMmSTTTSSS',
    'oHCMmSTtTSSS',
    'oHHCmBBSSSSs',
    '.oHCMmSSSSSS',
    '..ohHCsSSSSS',
    '...oohhHCsss',
    '....ohHHHHwH',
    '...ohiHHHHwH',
    '...oSCHCCCCC',
    '....oohhhhhh',
    '......oDDDDD',
    '......oDDDDo',
  ], [
    // 오른쪽 머리핀 (별)
    [17, 6, 'P'], [16, 7, 'P'], [17, 7, 'p'], [18, 7, 'P'], [17, 8, 'P'],
    // 후드 하이라이트 비대칭
    [12, 5, 'H'], [13, 5, 'H'], [6, 5, 'i'],
  ]),
  legs: { len: 5, rows: ['S', 'V', 'w', 'V', 'shoe'], shoe: '#f4f4ff', shoeDark: '#9aa0c8' },
  hips: [8, 13], legW: 3,
  hand: [19, 21],
  tail: { color: '#9af7d6', shade: '#4fc9aa', root: [5, 20] },
};

// 루나: 별 마녀 (라벤더 머리, 큰 모자, 남색 로브)
const LUNA = {
  id: 'luna',
  pal: {
    A: '#55339e', a: '#341d6c', j: '#8058d0', Y: '#ffd75a', y: '#c98f2a',
    L: '#d4bdff', l: '#9c7ee6', S: '#ffe3d1', s: '#f1a996', K: '#2a1050',
    V: '#a064ff', t: '#efe0ff', B: '#ff8fae', R: '#27306e', r: '#181e4a', w: '#ffffff',
  },
  grid: sym([
    '...........o',
    '..........oA',
    '.........oAA',
    '........oaAA',
    '.......oaaAA',
    '.......oaAAA',
    '......oaaAAA',
    '......oyYYYY',
    '..oooaaAAAAA',
    '.oaaaaaaaaaa',
    '..oooLLLLLLL',
    '..oLLLLLLLLL',
    '.oLLLLlLLLLl',
    'oLLlLSlSLLlS',
    'oLlLSSSSlLSS',
    'oLlSKKKKSSSS',
    'oLlSSKwVSSSS',
    'oLlSSVVVSSSS',
    'oLlSSVtVSSSS',
    'oLLlSSBBSSSs',
    'oLLLloSSSSSS',
    'oLlLloRRRRRY',
    'oLlloSRRRRRR',
    '.olloSoRRrRR',
    '.oo.orRRrRRR',
    '....orRRrRRR',
    '....oYYYYYYY',
    '.....ooooooo',
  ], [
    // 모자 끝이 오른쪽으로 꺾임
    [11, 0, '.'], [12, 0, '.'], [13, 0, 'o'], [14, 0, 'o'], [12, 1, 'A'], [13, 1, 'A'], [14, 1, 'o'],
    // 모자 별
    [13, 3, 'Y'], [12, 4, 'Y'], [13, 4, 'w'], [14, 4, 'Y'], [13, 5, 'Y'], [11, 4, 'y'], [15, 4, 'y'], [9, 3, 'j'], [9, 4, 'j'], [10, 2, 'j'],
    // 브로치
    [11, 21, 'Y'], [12, 21, 'Y'], [11, 22, 'y'], [12, 22, 'y'],
  ]),
  legs: { len: 3, rows: ['#2a2440', '#2a2440', 'shoe'], shoe: '#7a4ab8', shoeDark: '#4a2a7a' },
  hips: [8, 13], legW: 3,
  hand: [18, 22],
};

// 하루: 토끼귀 메이드 검사 (금발 트윈테일, 빨간 리본)
const HARU = {
  id: 'haru',
  pal: {
    E: '#fbf6ff', e: '#ffb3c9', Z: '#ffffff', G: '#ffe593', g: '#e3a84e',
    Q: '#e8334a', q: '#9e1730', S: '#ffe3d1', s: '#f1a996', K: '#5a0f1a',
    I: '#ff4f5f', t: '#ffd0d6', B: '#ff8fae', X: '#2b283c', x: '#17151f',
    W: '#f6f6ff', U: '#c6c6e0', w: '#ffffff',
  },
  grid: sym([
    '....oo......',
    '...oEEo.....',
    '...oEeo.....',
    '...oEeo.....',
    '...oEeo.....',
    '....oEeo....',
    '....oEeo....',
    '...ooZZZZZZZ',
    '..oGGGGGGGGG',
    '.oGGGGgGGGGg',
    'QoGgGSgSGGgS',
    'QqGgSSSSgGSS',
    'QqGgKKKKSSSS',
    'qGGgSKwISSSS',
    'oGGgSIIISSSS',
    'oGGgSItISSSS',
    'oGgGSSBBSSSs',
    'oGgGooSSSSSS',
    'oGgGoXXXXQQQ',
    'oGgoSXXXWWQq',
    'ogGoSXXXWWWW',
    'ogGooXXWWUWW',
    '.ogGoxXWWUWW',
    '..ooxxXWWWWW',
    '..oXxxXWWWWW',
    '..oWoWoWoWoW',
    '...ooooooooo',
  ], [
    // 오른쪽 귀가 살짝 접힘
    [18, 1, 'o'], [17, 1, 'E'], [19, 2, 'o'], [18, 2, 'E'], [17, 2, 'e'],
  ]),
  legs: { len: 4, rows: ['#1c1a26', '#1c1a26', '#2b2838', 'shoe'], shoe: '#3a2430', shoeDark: '#e8334a' },
  hips: [8, 13], legW: 3,
  hand: [19, 19],
};

export const HERO_DEFS = { miyu: MIYU, luna: LUNA, haru: HARU };

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r * f)));
  g = Math.max(0, Math.min(255, Math.round(g * f)));
  b = Math.max(0, Math.min(255, Math.round(b * f)));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

// 프레임 하나 그리기. pose: {bob, legL:[dx,lift], legR:[dx,lift], tuck, tail}
function heroFrame(def, pose, palOverride) {
  const pal = { ...def.pal, ...(palOverride || {}) };
  const gw = def.grid[0].length, gh = def.grid.length;
  const pad = 2;
  const W = gw + pad * 2, H = gh + def.legs.len + pad * 2 + 1;
  const buf = new Array(W * H).fill(null);
  const oy = pad + 1 - (pose.bob || 0) + (pose.tuck ? 1 : 0);
  // 꼬리 (몸 뒤)
  if (def.tail) {
    const [rx, ry] = def.tail.root;
    const sway = pose.tail || 0;
    const pts = [[0, 0], [-1, 0], [-2, -1], [-3, -2 + sway], [-3, -3 + sway], [-2, -4 + sway], [-2, -5 + sway]];
    pts.forEach(([dx, dy], i) => {
      const x = pad + rx + dx, y = oy + ry + dy;
      if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = i === pts.length - 1 ? '#ffffff' : (i % 2 ? def.tail.color : def.tail.shade);
      if (x - 1 >= 0 && i > 1 && i < pts.length - 1) buf[y * W + x - 1] = def.tail.color;
    });
  }
  // 다리
  const legTop = oy + gh;
  const L = def.legs;
  def.hips.forEach((hx, side) => {
    const [dx, lift] = side === 0 ? (pose.legL || [0, 0]) : (pose.legR || [0, 0]);
    const len = pose.tuck ? L.len - 2 : L.len;
    for (let i = 0; i < len; i++) {
      const isShoe = i === len - 1;
      const key = isShoe ? 'shoe' : L.rows[Math.min(i, L.rows.length - 2)];
      const y = legTop + i - lift;
      for (let k = 0; k < def.legW + (isShoe ? 1 : 0); k++) {
        const x = pad + hx + dx + k - (isShoe && side === 0 ? 1 : 0);
        let col;
        if (key === 'shoe') col = (k === (side === 0 ? 0 : def.legW)) ? L.shoeDark : L.shoe;
        else if (key.startsWith('#')) col = k === 0 ? shade(key, 1.35) : key;
        else if (key === 'w') col = '#f4f4ff';
        else col = pal[key];
        if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = col;
      }
    }
  });
  stamp(buf, W, def.grid, pal, pad, oy);
  outlinePass(buf, W, H);
  return toCanvas(buf, W, H);
}

const POSES = {
  idle: [{ bob: 0, tail: 0 }, { bob: 0, tail: 1 }, { bob: 1, tail: 1 }, { bob: 1, tail: 0 }],
  run: [
    { bob: 1, legL: [-1, 1], legR: [1, 0], tail: 1 },
    { bob: 0, legL: [0, 0], legR: [0, 0], tail: 0 },
    { bob: 1, legL: [1, 0], legR: [-1, 1], tail: -1 },
    { bob: 0, legL: [0, 0], legR: [0, 0], tail: 0 },
  ],
  jump: [{ bob: 1, legL: [-1, 1], legR: [1, 2], tuck: false, tail: 2 }],
  fall: [{ bob: 0, legL: [-1, 0], legR: [1, 0], tail: -1 }],
};

export function buildHero(id, palOverride) {
  const def = HERO_DEFS[id];
  const out = { def };
  for (const k in POSES) out[k] = POSES[k].map(p => {
    const c = heroFrame(def, p, palOverride);
    return { r: c, l: flipCanvas(c) };
  });
  out.w = out.idle[0].r.width; out.h = out.idle[0].r.height;
  out.handR = [def.hand[0] + 2, def.hand[1] + 3];
  return out;
}

/* ───────────────────────── 적 ───────────────────────── */

const SLIME = sym([
  '......oo',
  '....ooGG',
  '...oGhGG',
  '..oGhhGG',
  '.oGGhGGG',
  '.oGGGKwG',
  '.oGGGKKG',
  'oGGGGGGG',
  'oGgGGGGo',
  'oGggGGGG',
  'oggggggg',
  '.ooooooo',
], [[4, 7, 'B'], [11, 7, 'B']]);

const BAT_A = sym([
  '.o......',
  'oPo..o.o',
  'oPPooBoB',
  'oPPPBBBB',
  '.oPPBRwB',
  '..ooBBBB',
  '....oBBf',
  '.....oBB',
  '......oo',
]);
const BAT_B = sym([
  '........',
  '.....o.o',
  '....oBoB',
  '.oooBBBB',
  'oPPPBRwB',
  'oPPPoBBB',
  'oPo..oBf',
  '.o....oo',
  '........',
]);

const GOBLIN = sym([
  '....ooo',
  '..ooCCC',
  '.oCCCCC',
  '.oCcCCC',
  'ooCNNNN',
  'NNoNYKN',
  '.ooNNNN',
  '..oNnoo',
  '...onnn',
  '..oTTTT',
  '.oNTTTT',
  '.ooTBBB',
  '..oTTTT',
  '..onno.',
  '..onno.',
  '..oooo.',
], [[6, 7, 'w'], [7, 7, 'w']]);

const SKELETON = sym([
  '...oooo',
  '..oWWWW',
  '.oWWWWW',
  '.oWwKKW',
  '.oWwKRW',
  '.oWWWWo',
  '..owWWW',
  '..oWoWo',
  '...oooo',
  '..oAAAA',
  '.oWAaAA',
  '.oWAAaA',
  '..oAAAA',
  '..oWWWW',
  '..oWo..',
  '..oWo..',
  '.oWWo..',
  '.oooo..',
]);

const MUSHROOM = sym([
  '...oooo',
  '.ooMMMM',
  'oMMdMMM',
  'oMddMMM',
  'oMMMMdd',
  'omMMMMM',
  'ommmmmm',
  '.ooFFFF',
  '..oFKFF',
  '..oFKFF',
  '..ofFBF',
  '..oRRRR',
  '.oFRrRR',
  '.ooRrRR',
  '..oRRRR',
  '..orrrr',
  '..ooooo',
], [[12, 2, 'd'], [11, 3, 'd'], [12, 3, 'd']]);

const DRONE = sym([
  'oooooo.',
  '...o...',
  '...o...',
  '..ooooo',
  '.oAAAAA',
  'oAaoooo',
  'oAaoLRR',
  'oAaoooo',
  '.oAYAYA',
  '..oaaaa',
  '...oooo',
]);

const CROW = sym([
  '......oooo',
  '....ooXXXX',
  '...oXXXXXX',
  '..oXXXRXXX',
  '..oXXRRXYY',
  '.oAXXXXoYY',
  'oAAXXXXXoY',
  'oAAxXXXXXX',
  'oAxxXXXXXL',
  'oxxxXXXXLL',
  '.oxxXXXXXL',
  '..oxxXXXXX',
  '....oxxxxx',
  '.....oYoYo',
  '....oYo.oY',
  '....oo...o',
]);
const CROWN = sym([
  'o..o..',
  'oYoYo.',
  'oYYYYo',
  'oYRYYY',
  'oyyyyy',
  '.ooooo',
]);

const ENEMY_PAL = {
  slime: { G: '#5fe07a', g: '#2f9a55', h: '#c8ffd0', K: '#103020', w: '#ffffff', B: '#ff9fb0' },
  bat: { P: '#6a35a0', B: '#3c2266', R: '#ff4f6a', w: '#ffffff', f: '#ffffff' },
  goblin: { C: '#7a4a2a', c: '#a8693c', N: '#86d65e', n: '#4f9a3c', Y: '#ffe14f', K: '#201000', T: '#3b5a8a', B: '#6a3a1a', w: '#ffffff' },
  skeleton: { W: '#eeeadc', w: '#b9b39c', K: '#1a1424', R: '#ff4040', A: '#6d6f8a', a: '#474860' },
  mage: { M: '#e8435a', m: '#a8203a', d: '#ffffff', F: '#f6e3c8', f: '#d6b894', K: '#1a1020', B: '#ff9fb0', R: '#6a3fb0', r: '#452680' },
  drone: { A: '#8a94b0', a: '#545a78', L: '#aef3ff', R: '#ff3355', Y: '#ffcc33' },
  crow: { X: '#2c2840', x: '#18142a', A: '#8088a8', Y: '#ffb02e', R: '#ff2d55', L: '#7af0ff' },
};
const SLIME_TINTS = [
  { G: '#5fe07a', g: '#2f9a55', h: '#c8ffd0' },
  { G: '#ff7fbf', g: '#c0407e', h: '#ffd0ea' },
  { G: '#6fc8ff', g: '#3a78c8', h: '#d0f0ff' },
  { G: '#c48cff', g: '#7a4ac8', h: '#ecd8ff' },
];

function squash(rows) {
  const blank = '.'.repeat(rows[0].length);
  return [blank, ...rows.filter((_, i) => i !== 3)];
}
function pair(c) { return { r: c, l: flipCanvas(c) }; }

export function buildEnemies() {
  const E = {};
  E.slime = SLIME_TINTS.map(t => {
    const pal = { ...ENEMY_PAL.slime, ...t };
    return [pair(gridCanvas(SLIME, pal)), pair(gridCanvas(squash(SLIME), pal))];
  });
  E.bat = [pair(gridCanvas(BAT_A, ENEMY_PAL.bat)), pair(gridCanvas(BAT_B, ENEMY_PAL.bat))];
  const walk2 = (rows, pal) => {
    const a = gridCanvas(rows, pal);
    const b = gridCanvas(['.'.repeat(rows[0].length), ...rows.slice(0, -1)], pal);
    return [pair(a), pair(b)];
  };
  E.goblin = walk2(GOBLIN, ENEMY_PAL.goblin);
  E.skeleton = walk2(SKELETON, ENEMY_PAL.skeleton);
  E.mage = walk2(MUSHROOM, ENEMY_PAL.mage);
  E.drone = walk2(DRONE, ENEMY_PAL.drone);
  // 보스
  const king = (() => {
    const body = SLIME; const crown = CROWN;
    const rows = [...crown.map(r => '....' + r + '....'), ...body.map(r => r)];
    return rows;
  })();
  const kingPal = { ...ENEMY_PAL.slime, G: '#6fd8ff', g: '#3a7ec8', h: '#e0f8ff', Y: '#ffd75a', y: '#c98f2a', R: '#ff4f6a' };
  E.king = [pair(gridCanvas(king, kingPal, { scale: 4 })), pair(gridCanvas(squash(king), kingPal, { scale: 4 }))];
  E.crow = [pair(gridCanvas(CROW, ENEMY_PAL.crow, { scale: 3 })),
    pair(gridCanvas(override(CROW, [[0, 6, '.'], [0, 7, '.'], [0, 8, '.'], [19, 6, '.'], [19, 7, '.'], [19, 8, '.'], [1, 4, 'o'], [18, 4, 'o'], [1, 5, 'A'], [18, 5, 'A']]), ENEMY_PAL.crow, { scale: 3 }))];
  // 그림자 메이드장: 하루 그리드를 어둠 팔레트로
  const dark = { E: '#2b2140', e: '#ff3fa0', Z: '#5a4a7a', G: '#3d2c62', g: '#241840', Q: '#ff2d7a', q: '#8a1040', S: '#e8d0e0', s: '#b890b0', K: '#ff2d7a', I: '#ff6fb0', t: '#ffffff', B: '#c070a0', X: '#110e18', x: '#08060c', W: '#4a3c6a', U: '#33284c' };
  const maid = buildHero('haru', dark);
  E.maid = [maid.idle[0], maid.idle[2]].map(f => ({ r: scaleCanvas(f.r, 2), l: scaleCanvas(f.l, 2) }));
  return E;
}

/* ───────────────────────── 무기 ─────────────────────────
   파라미터로 픽셀을 조립한다. 오른쪽을 향함. grip=손잡이, muz=총구 */
function blank(w, h) { return Array.from({ length: h }, () => new Array(w).fill('.')); }
function fill(g, x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < g[j].length) g[j][i] = c; }

export function weaponGrid(shape) {
  let g, grip, muz;
  switch (shape) {
    case 'blaster': g = blank(13, 8);
      fill(g, 2, 1, 8, 3, 'a'); fill(g, 10, 2, 2, 1, 'c'); fill(g, 3, 1, 5, 1, 'b'); fill(g, 2, 4, 3, 3, 'd'); fill(g, 6, 2, 2, 1, 'c'); fill(g, 0, 2, 2, 2, 'b');
      grip = [3, 5]; muz = [12, 2]; break;
    case 'pistol': g = blank(11, 7);
      fill(g, 1, 1, 9, 2, 'a'); fill(g, 1, 1, 9, 1, 'b'); fill(g, 1, 3, 3, 3, 'g'); fill(g, 5, 3, 1, 1, 'd');
      grip = [2, 4]; muz = [10, 1]; break;
    case 'revolver': g = blank(13, 7);
      fill(g, 1, 1, 11, 1, 'a'); fill(g, 4, 2, 4, 2, 'b'); fill(g, 1, 2, 3, 1, 'a'); fill(g, 1, 3, 3, 3, 'g'); fill(g, 8, 2, 4, 1, 'a');
      grip = [2, 4]; muz = [12, 1]; break;
    case 'smg': g = blank(15, 8);
      fill(g, 2, 1, 11, 3, 'a'); fill(g, 2, 1, 11, 1, 'b'); fill(g, 13, 2, 2, 1, 'd'); fill(g, 6, 4, 2, 3, 'd'); fill(g, 3, 4, 2, 3, 'g'); fill(g, 0, 2, 2, 2, 'd');
      grip = [4, 5]; muz = [14, 2]; break;
    case 'shotgun': g = blank(19, 7);
      fill(g, 5, 1, 13, 2, 'a'); fill(g, 5, 1, 13, 1, 'b'); fill(g, 8, 3, 6, 1, 'g'); fill(g, 0, 2, 6, 2, 'g'); fill(g, 4, 3, 2, 3, 'g'); fill(g, 0, 1, 2, 1, 'g');
      grip = [5, 4]; muz = [18, 1]; break;
    case 'rifle': g = blank(19, 8);
      fill(g, 4, 2, 12, 2, 'a'); fill(g, 16, 2, 3, 1, 'd'); fill(g, 6, 1, 6, 1, 'b'); fill(g, 0, 2, 4, 3, 'g'); fill(g, 9, 4, 2, 3, 'd'); fill(g, 5, 4, 2, 3, 'g');
      grip = [6, 5]; muz = [18, 2]; break;
    case 'sniper': g = blank(25, 8);
      fill(g, 5, 2, 15, 2, 'a'); fill(g, 20, 2, 5, 1, 'd'); fill(g, 8, 0, 6, 2, 'b'); fill(g, 9, 0, 1, 1, 'c'); fill(g, 0, 2, 5, 3, 'g'); fill(g, 6, 4, 2, 3, 'g'); fill(g, 12, 4, 1, 3, 'd');
      grip = [7, 5]; muz = [24, 2]; break;
    case 'laser': g = blank(17, 8);
      fill(g, 2, 1, 12, 3, 'a'); fill(g, 4, 2, 9, 1, 'c'); fill(g, 14, 1, 2, 3, 'b'); fill(g, 16, 2, 1, 1, 'c'); fill(g, 3, 4, 3, 3, 'd'); fill(g, 0, 2, 2, 2, 'b');
      grip = [4, 5]; muz = [16, 2]; break;
    case 'bubble': g = blank(14, 9);
      fill(g, 3, 2, 8, 3, 'a'); fill(g, 4, 0, 4, 2, 'c'); fill(g, 5, 0, 1, 1, 'w'); fill(g, 11, 3, 3, 1, 'b'); fill(g, 3, 5, 3, 3, 'd'); fill(g, 0, 3, 3, 2, 'b');
      grip = [4, 6]; muz = [13, 3]; break;
    case 'rocket': g = blank(22, 9);
      fill(g, 2, 2, 18, 4, 'a'); fill(g, 2, 2, 18, 1, 'b'); fill(g, 20, 1, 2, 6, 'd'); fill(g, 0, 1, 2, 6, 'd'); fill(g, 7, 6, 2, 3, 'g'); fill(g, 11, 6, 2, 2, 'd'); fill(g, 12, 3, 4, 1, 'c');
      grip = [8, 7]; muz = [21, 3]; break;
    case 'gatling': g = blank(21, 9);
      fill(g, 3, 1, 8, 5, 'a'); fill(g, 11, 1, 9, 1, 'b'); fill(g, 11, 3, 9, 1, 'b'); fill(g, 11, 5, 9, 1, 'b'); fill(g, 19, 1, 2, 5, 'd'); fill(g, 5, 6, 3, 3, 'd'); fill(g, 4, 2, 6, 1, 'c'); fill(g, 0, 2, 3, 3, 'd');
      grip = [6, 7]; muz = [20, 3]; break;
    case 'cannon': g = blank(19, 11);
      fill(g, 2, 2, 12, 6, 'a'); fill(g, 14, 1, 4, 8, 'b'); fill(g, 15, 3, 3, 4, 'c'); fill(g, 5, 4, 6, 2, 'c'); fill(g, 5, 8, 3, 3, 'd'); fill(g, 0, 3, 2, 4, 'd');
      grip = [6, 9]; muz = [18, 5]; break;
    case 'wand': g = blank(18, 7);
      fill(g, 0, 3, 12, 1, 'g'); fill(g, 0, 3, 2, 1, 'd'); fill(g, 12, 1, 5, 5, 'a'); fill(g, 14, 0, 1, 7, 'a'); fill(g, 14, 2, 1, 3, 'c'); fill(g, 13, 3, 3, 1, 'c'); fill(g, 14, 3, 1, 1, 'w');
      g[1][12] = '.'; g[1][16] = '.'; g[5][12] = '.'; g[5][16] = '.';
      grip = [3, 3]; muz = [17, 3]; break;
    case 'staff': g = blank(22, 7);
      fill(g, 0, 3, 16, 1, 'g'); fill(g, 16, 1, 1, 5, 'b'); fill(g, 17, 1, 4, 5, 'a'); fill(g, 18, 2, 2, 3, 'c'); fill(g, 18, 2, 1, 1, 'w');
      grip = [5, 3]; muz = [21, 3]; break;
    case 'katana': g = blank(24, 5);
      fill(g, 0, 2, 6, 1, 'g'); fill(g, 0, 1, 6, 1, 'd'); fill(g, 6, 0, 2, 5, 'c'); fill(g, 8, 2, 15, 1, 'a'); fill(g, 8, 1, 14, 1, 'b'); g[1][22] = '.'; fill(g, 23, 2, 1, 1, 'b');
      grip = [3, 2]; muz = [23, 2]; break;
    case 'beamsword': g = blank(24, 5);
      fill(g, 0, 1, 6, 3, 'd'); fill(g, 1, 2, 4, 1, 'b'); fill(g, 6, 1, 17, 3, 'c'); fill(g, 6, 2, 17, 1, 'w'); g[1][22] = '.'; g[3][22] = '.';
      grip = [3, 2]; muz = [23, 2]; break;
    case 'scythe': g = blank(24, 12);
      fill(g, 0, 8, 18, 1, 'g'); fill(g, 16, 1, 2, 8, 'd'); fill(g, 18, 0, 3, 2, 'a'); fill(g, 21, 1, 2, 3, 'a'); fill(g, 22, 4, 1, 3, 'a'); fill(g, 19, 2, 2, 1, 'b');
      fill(g, 12, 0, 6, 1, 'a'); fill(g, 9, 1, 4, 1, 'a'); fill(g, 8, 2, 2, 1, 'b');
      grip = [6, 8]; muz = [22, 3]; break;
    case 'spear': g = blank(30, 5);
      fill(g, 0, 2, 22, 1, 'g'); fill(g, 22, 1, 1, 3, 'd'); fill(g, 23, 1, 5, 3, 'a'); fill(g, 28, 2, 2, 1, 'a'); fill(g, 24, 2, 4, 1, 'b');
      grip = [8, 2]; muz = [29, 2]; break;
    case 'hammer': g = blank(20, 11);
      fill(g, 0, 5, 13, 1, 'g'); fill(g, 13, 0, 7, 11, 'a'); fill(g, 13, 0, 7, 2, 'b'); fill(g, 15, 4, 3, 3, 'c'); fill(g, 0, 5, 2, 1, 'd');
      grip = [4, 5]; muz = [19, 5]; break;
    case 'glove': g = blank(10, 9);
      fill(g, 0, 2, 3, 5, 'b'); fill(g, 3, 1, 6, 7, 'a'); fill(g, 9, 2, 1, 5, 'a'); fill(g, 4, 1, 1, 7, 'c'); fill(g, 6, 3, 2, 2, 'w');
      grip = [2, 4]; muz = [9, 4]; break;
    case 'boomerang': g = blank(12, 12);
      fill(g, 0, 0, 3, 10, 'a'); fill(g, 0, 9, 11, 3, 'a'); fill(g, 1, 1, 1, 9, 'b'); fill(g, 1, 10, 9, 1, 'b'); fill(g, 0, 9, 3, 3, 'c');
      grip = [1, 10]; muz = [10, 10]; break;
    case 'bow': g = blank(9, 19);
      for (let i = 0; i < 19; i++) { const x = Math.round(6 - Math.abs(i - 9) * 0.55); g[i][Math.max(0, x)] = 'a'; g[i][Math.max(0, x) + 1] = i % 4 === 0 ? 'b' : 'a'; g[i][0] = 'w'; }
      grip = [5, 9]; muz = [8, 9]; break;
    case 'shield': g = blank(9, 16);
      fill(g, 0, 0, 9, 14, 'a'); fill(g, 1, 14, 7, 1, 'a'); fill(g, 3, 15, 3, 1, 'a'); fill(g, 1, 1, 7, 1, 'b'); fill(g, 4, 2, 1, 11, 'c'); fill(g, 2, 6, 5, 1, 'c');
      grip = [2, 7]; muz = [8, 7]; break;
    default: g = blank(8, 4); fill(g, 0, 1, 8, 2, 'a'); grip = [1, 2]; muz = [7, 1];
  }
  return { rows: g.map(r => r.join('')), grip, muz };
}

export function buildWeaponSprite(shape, colors) {
  const { rows, grip, muz } = weaponGrid(shape);
  const pal = { a: colors[0], b: colors[1], c: colors[2], d: colors[3] || '#3a3550', g: colors[4] || '#6b4a32', w: '#ffffff' };
  const c = gridCanvas(rows, pal);
  return { c, grip: [grip[0] + 1, grip[1] + 1], muz: [muz[0] + 1, muz[1] + 1] };
}

/* ───────────────────────── 타일 / 배경 ───────────────────────── */

export const THEMES = [
  { name: '네온 아케이드', sky: ['#120a24', '#24104a'], wall: '#2a1d4f', wall2: '#3b2a6e', top: '#ff4fd8', top2: '#7af0ff', plat: '#7af0ff', deco: '#ff4fd8', far: '#1b1238', mid: '#2a1a52', glow: '#ff4fd8' },
  { name: '슬라임 동굴', sky: ['#06140f', '#0d2a20'], wall: '#1d3a2c', wall2: '#2a5240', top: '#7dff8a', top2: '#c8ffd0', plat: '#a07a4a', deco: '#7dff8a', far: '#0b2018', mid: '#143426', glow: '#7dff8a' },
  { name: '태엽 공장', sky: ['#1a0e08', '#33190c'], wall: '#4a3428', wall2: '#5e4434', top: '#ffb347', top2: '#ffe0a0', plat: '#8a8a9a', deco: '#ffb347', far: '#24140c', mid: '#3a2214', glow: '#ff8a3a' },
  { name: '어둠의 성', sky: ['#0c0612', '#1e0c22'], wall: '#2c2236', wall2: '#3e3048', top: '#ff3f6a', top2: '#ffc0d0', plat: '#6a4a3a', deco: '#ff3f6a', far: '#160c1c', mid: '#24142c', glow: '#ff3f6a' },
];

function rnd(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// 16x16 타일 몇 가지
export function buildTiles(theme, ti) {
  const R = rnd(100 + ti);
  const T = {};
  const solid = (variant) => {
    const [c, g] = mk(16, 16);
    g.fillStyle = theme.wall; g.fillRect(0, 0, 16, 16);
    // 벽돌 무늬
    g.fillStyle = theme.wall2;
    const off = variant % 2 ? 8 : 0;
    for (let y = 0; y < 16; y += 8) {
      const o = (y / 8) % 2 ? off : (off + 4) % 8;
      for (let x = -8; x < 16; x += 8) { g.fillRect(x + o + 1, y + 1, 6, 6); }
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 6; i++) g.fillRect((R() * 16) | 0, (R() * 16) | 0, 1, 1);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 4; i++) g.fillRect((R() * 16) | 0, (R() * 16) | 0, 1, 1);
    return c;
  };
  T.solid = [solid(0), solid(1), solid(2)];
  // 윗면 (풀/네온 띠)
  T.top = [0, 1, 2].map(v => {
    const c = solid(v); const g = c.getContext('2d');
    g.fillStyle = theme.top; g.fillRect(0, 0, 16, 3);
    g.fillStyle = theme.top2; g.fillRect(0, 0, 16, 1);
    g.fillStyle = theme.top;
    for (let x = 0; x < 16; x++) if (R() < 0.35) g.fillRect(x, 3, 1, 1 + ((R() * 2) | 0));
    return c;
  });
  // 원웨이 발판
  T.plat = (() => {
    const [c, g] = mk(16, 16);
    g.fillStyle = OUTLINE; g.fillRect(0, 0, 16, 6);
    g.fillStyle = theme.plat; g.fillRect(0, 1, 16, 4);
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(0, 1, 16, 1);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 4, 16, 1); g.fillRect(7, 1, 1, 4);
    return c;
  })();
  // 가시
  T.spike = (() => {
    const [c, g] = mk(16, 16);
    for (let k = 0; k < 4; k++) {
      const bx = k * 4;
      for (let y = 0; y < 8; y++) {
        const half = Math.floor(y / 4);
        g.fillStyle = OUTLINE; g.fillRect(bx + 1 - half, 8 + y, 2 + half * 2, 1);
        g.fillStyle = y < 2 ? '#ffffff' : '#c8c8d8'; g.fillRect(bx + 1 - half + (half ? 1 : 0), 8 + y, Math.max(1, half * 2), 1);
      }
    }
    return c;
  })();
  return T;
}

// 패럴랙스 배경 (480x270 보다 넓게)
export function buildBackground(theme, ti) {
  const W = 640, H = 270;
  const R = rnd(7 + ti * 31);
  const [c, g] = mk(W, H);
  // 하늘 그라데이션을 계단식 띠로 (픽셀 느낌)
  const bands = 9;
  for (let i = 0; i < bands; i++) {
    g.fillStyle = mix(theme.sky[0], theme.sky[1], i / (bands - 1));
    g.fillRect(0, (i * H) / bands | 0, W, Math.ceil(H / bands) + 1);
  }
  // 별/먼지
  for (let i = 0; i < 90; i++) { g.fillStyle = R() < 0.3 ? theme.glow : 'rgba(255,255,255,0.5)'; g.fillRect((R() * W) | 0, (R() * H * 0.7) | 0, 1, 1); }
  const [far, gf] = mk(W, H);
  const [mid, gm] = mk(W, H);
  if (ti === 0) { // 아케이드: 먼 건물 + 네온 간판
    for (let x = 0; x < W; x += 24 + ((R() * 20) | 0)) {
      const h = 60 + R() * 110, w = 20 + R() * 26;
      gf.fillStyle = theme.far; gf.fillRect(x, H - h, w, h);
      for (let wy = H - h + 6; wy < H - 10; wy += 8) for (let wx = x + 3; wx < x + w - 3; wx += 6) if (R() < 0.35) { gf.fillStyle = R() < 0.5 ? '#ff4fd855' : '#7af0ff55'; gf.fillRect(wx, wy, 2, 3); }
    }
    for (let x = 10; x < W; x += 70 + ((R() * 40) | 0)) {
      const y = 40 + R() * 60, w = 26 + R() * 20;
      gm.fillStyle = OUTLINE; gm.fillRect(x - 1, y - 1, w + 2, 12);
      gm.fillStyle = R() < 0.5 ? theme.top : theme.top2; gm.fillRect(x, y, w, 10);
      gm.fillStyle = theme.mid; gm.fillRect(x + 2, y + 2, w - 4, 6);
      gm.fillStyle = R() < 0.5 ? theme.top : theme.top2;
      for (let k = x + 4; k < x + w - 4; k += 4) gm.fillRect(k, y + 4, 2, 2);
      gm.fillStyle = theme.mid; gm.fillRect(x + w / 2 - 1, y + 11, 2, 300);
    }
  } else if (ti === 1) { // 동굴: 종유석 + 수정
    for (let x = 0; x < W; x += 6) {
      const h = 20 + Math.sin(x * 0.05) * 14 + R() * 30;
      gf.fillStyle = theme.far; gf.fillRect(x, 0, 6, h); gf.fillRect(x, H - h - 20, 6, h + 20);
    }
    for (let i = 0; i < 18; i++) {
      const x = R() * W, y = 140 + R() * 100, s = 4 + R() * 8;
      gm.fillStyle = '#3aff9a55';
      for (let k = 0; k < s * 2; k++) gm.fillRect(x - Math.min(k, s * 2 - k) / 2, y - k, Math.max(1, Math.min(k, s * 2 - k)), 1);
    }
  } else if (ti === 2) { // 공장: 톱니바퀴 + 파이프
    for (let i = 0; i < 9; i++) {
      const cx = R() * W, cy = 60 + R() * 160, r = 14 + R() * 26;
      gf.fillStyle = theme.far;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) gf.fillRect(cx + Math.cos(a) * r - 3, cy + Math.sin(a) * r - 3, 7, 7);
      for (let y = -r; y <= r; y++) { const w = Math.sqrt(r * r - y * y); gf.fillRect(cx - w, cy + y, w * 2, 1); }
      gf.fillStyle = theme.sky[0];
      for (let y = -r / 3; y <= r / 3; y++) { const w = Math.sqrt((r / 3) ** 2 - y * y); gf.fillRect(cx - w, cy + y, w * 2, 1); }
    }
    for (let y = 40; y < H; y += 50 + R() * 40) { gm.fillStyle = theme.mid; gm.fillRect(0, y, W, 6); gm.fillStyle = '#ffffff10'; gm.fillRect(0, y, W, 1); for (let x = 0; x < W; x += 40) { gm.fillStyle = theme.mid; gm.fillRect(x, y - 2, 4, 10); } }
  } else { // 성: 아치 창문
    for (let x = 0; x < W; x += 80) {
      gf.fillStyle = theme.far; gf.fillRect(x, 0, 18, H);
      const wx = x + 34, wy = 50;
      gm.fillStyle = OUTLINE; gm.fillRect(wx - 1, wy - 1, 28, 92);
      gm.fillStyle = '#5a1024'; gm.fillRect(wx, wy, 26, 90);
      gm.fillStyle = '#ff3f6a55'; gm.fillRect(wx + 2, wy + 10, 10, 78); gm.fillRect(wx + 14, wy + 10, 10, 78);
      gm.fillStyle = theme.sky[0];
      for (let k = 0; k < 10; k++) { gm.fillRect(wx, wy + k, Math.max(0, 13 - Math.sqrt(169 - (10 - k) ** 2 * 1.69)), 1); gm.fillRect(wx + 26 - Math.max(0, 13 - Math.sqrt(169 - (10 - k) ** 2 * 1.69)), wy + k, 13, 1); }
    }
  }
  return { sky: c, far, mid, W };
}

function mix(a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const r = Math.round(((A >> 16) & 255) * (1 - t) + ((B >> 16) & 255) * t);
  const gg = Math.round(((A >> 8) & 255) * (1 - t) + ((B >> 8) & 255) * t);
  const bb = Math.round((A & 255) * (1 - t) + (B & 255) * t);
  return '#' + ((1 << 24) | (r << 16) | (gg << 8) | bb).toString(16).slice(1);
}

/* 소품: 상자, 포탈, 코인, 에너지, 물약, 석상, 상인 */
const CHEST = [
  '.oooooooooooo.',
  'oBBBBBBBBBBBBo',
  'oBbbbbbbbbbbBo',
  'oYYYYYoYYYYYYo',
  'oBBBBoYoBBBBBo',
  'oBbbboooBbbbBo',
  'oBbbbbbbbbbbBo',
  'oYYYYYYYYYYYYo',
  '.oooooooooooo.',
];
const COIN = ['.oo.', 'oYyo', 'oYyo', '.oo.'];
const ORB = ['.o.', 'oCo', '.o.'];
const POTION = ['.oo.', '.ow.', 'oRRo', 'oRro', '.oo.'];
const STATUE = sym([
  '...ooo',
  '..oSSS',
  '.oSsSS',
  '.oSSYS',
  '..oSSS',
  '...oSS',
  '..oSSS',
  '.oSsSS',
  '.oSsSS',
  '.oSsSS',
  'oooooo',
  'oAAAAA',
  'oAaaaa',
  'oooooo',
]);
const MERCHANT = sym([
  '....ooo',
  '...oHHH',
  '..oHHHH',
  '.oHHHHH',
  'ooooooo',
  '..oSSSS',
  '..oSKSS',
  '..oSSSS',
  '...oooo',
  '..oCCCC',
  '.oSCcCC',
  '.ooCCCC',
  '..oCCCC',
  '..oo.oo',
], [[6, 7, 'B'], [7, 7, 'B']]);

export function buildProps() {
  const P = {};
  const chestPal = (b, bb, y) => ({ B: b, b: bb, Y: y });
  P.chest = { wood: gridCanvas(CHEST, chestPal('#a0643a', '#6e3e22', '#ffd75a')), weapon: gridCanvas(CHEST, chestPal('#3a6ac8', '#22408a', '#ffd75a')), gold: gridCanvas(CHEST, chestPal('#d04ab0', '#8a2a78', '#fff0a0')) };
  P.chestOpen = { wood: gridCanvas(CHEST.slice(3), chestPal('#a0643a', '#6e3e22', '#ffd75a')), weapon: gridCanvas(CHEST.slice(3), chestPal('#3a6ac8', '#22408a', '#ffd75a')), gold: gridCanvas(CHEST.slice(3), chestPal('#d04ab0', '#8a2a78', '#fff0a0')) };
  P.coin = gridCanvas(COIN, { Y: '#ffd75a', y: '#ffb02e' }, { outline: false });
  P.orb = gridCanvas(ORB, { C: '#5cc8ff' }, { outline: false });
  P.potion = gridCanvas(POTION, { R: '#ff4f6a', r: '#b02040', w: '#ffffff' });
  P.statue = gridCanvas(STATUE, { S: '#b8c0d8', s: '#7880a0', Y: '#ffd75a', A: '#6a5a8a', a: '#4a3a6a' });
  P.merchant = gridCanvas(MERCHANT, { H: '#4a2a7a', S: '#ffe3d1', K: '#2a1050', B: '#ff8fae', C: '#3a8a6a', c: '#2a6a4a' });
  // 포탈 프레임 4개
  P.portal = [0, 1, 2, 3].map(f => {
    const [c, g] = mk(28, 40);
    for (let y = 0; y < 40; y++) for (let x = 0; x < 28; x++) {
      const dx = (x - 13.5) / 13, dy = (y - 20) / 19.5;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const ring = Math.floor((Math.sqrt(d) * 5 + f * 0.5 + (Math.atan2(dy, dx) / Math.PI)) % 3);
      g.fillStyle = d > 0.82 ? OUTLINE : ['#7af0ff', '#b07aff', '#ff6fd8'][ring];
      if (d < 0.2) g.fillStyle = '#ffffff';
      g.fillRect(x, y, 1, 1);
    }
    return c;
  });
  return P;
}
