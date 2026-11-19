// 픽셀 아이콘 세트 (12x12). 카드·터치 버튼·HUD가 같은 그림을 쓴다
// 문자: . 빈칸, a 본색, b 밝은색, c 어두운색, w 흰색
const B = {
  sword: [
    '..........bw', '.........bwb', '........bwb.', '.......bwb..', '......bwb...', '.....bwb....',
    '..c.bwb.....', '...cwb......', '...ccc......', '..c.cc......', '.a....c.....', 'a...........'],
  parry: [
    '....cccc....', '...c.bb.c...', '..cccccccc..', '..c.bwwb.c..', '..c.baab.c..', '..c.baab.c..',
    '..c.bwwb.c..', '..c..bb..c..', '..cccccccc..', '...c....c...', '....cccc....', '............'],
  roll: [
    '............', '....bbbb....', '..bb....b...', '.b.......b..', '.b......bbb.', 'b........b..',
    'b...........', 'b...........', '.b......a...', '.b.....a....', '..bb.aa.....', '....aa......'],
  jump: [
    '.....ww.....', '....wbbw....', '...wb..bw...', '..wb.bb.bw..', '.....bb.....', '.....bb.....',
    '.....bb.....', '.....aa.....', '.....aa.....', '............', '..aaaaaaaa..', '............'],
  ult: [
    '.....b......', '.....bb.....', '....bwb..b..', '...bwwb.bb..', '..bwwwwbwb..', '..bwwwwwwb..',
    '.bwwwbbwwwb.', '.bwwb..bwwb.', '.bwb.aa.bwb.', '..bb.aa.bb..', '...bbbbbb...', '............'],
  flask: [
    '....cccc....', '.....bb.....', '.....bb.....', '....b..b....', '...b....b...', '..b.aaaa.b..',
    '..baaaaaab..', '..baawaaab..', '..baaaaaab..', '...baaaab...', '....bbbb....', '............'],
  heart: [
    '............', '.aa...aa....', 'awba.abba...', 'abbbabbbba..', 'abbbbbbbba..', '.abbbbbbba..',
    '..abbbbba...', '...abbba....', '....aba.....', '.....a......', '............', '............'],
  ember: [
    '.....b......', '....bb......', '....bwb.....', '...bwwb..b..', '..bwwwbbbb..', '..bwwwwwb...',
    '.bwwaawwb...', '.bwaaaawb...', '.bwaaaawb...', '..bwaawb....', '...bbbb.....', '............'],
  combat: [
    'w..........w', '.w........w.', '..w......w..', '...w....w...', '....w..w....', '.....ww.....',
    '.....ww.....', '....b..b....', '..cb....bc..', '..c......c..', '.c........c.', 'c..........c'],
  elite: [
    '...bbbbbb...', '..bwwwwwwb..', '.bwwwwwwwwb.', '.bwccwwccwb.', '.bwccwwccwb.', '.bwwwccwwwb.',
    '..bwwwwwwb..', '...bwbwbb...', '...b.b.b....', '............', '..a..a..a...', '............'],
  rest: [
    '.....b......', '....bwb.....', '....bwb.....', '.....b......', '....cwc.....', '....wbw.....',
    '....wbw.....', '....wbw.....', '....wbw.....', '..aaaaaaaa..', '...cccccc...', '............'],
  shop: [
    '.....bb.....', '.....bb.....', 'bbbbbbbbbbbb', '.b...bb...b.', 'b.b..bb..b.b', 'b.b..bb..b.b',
    'aaa..bb..aaa', '.....bb.....', '.....bb.....', '...bbbbbb...', '..cccccccc..', '............'],
  boss: [
    '.....bb.....', '....bwwb....', '...bwwwwb...', '...bwwwwb...', '..bwwwwwwb..', '..bwwwwwwb..',
    '.bwwwwwwwwb.', '.bbbbbbbbbb.', '.....aa.....', '.....aa.....', '............', '............'],
  echo: [
    '............', '.b..........', '.wb.........', '.wwb..b.....', '.wwwb.wb..b.', '.wwwwbwwb.wb',
    '.wwwb.wb..b.', '.wwb..b.....', '.wb.........', '.b..........', '............', '............'],
  chain: [
    '............', '.bbbb.......', 'b....b......', 'b....b......', 'b..wwwww....', '.bbw.b..w...',
    '...w.b..w...', '...w..bbbb..', '...w....w.b.', '....wwwww.b.', '.......b..b.', '........bb..'],
  wick: [
    '.....b......', '....bwb.....', '...bwwwb....', '...bwawb....', '....bab.....', '.....c......',
    '...ccccc....', '..c.....c...', '..c.bbb.c...', '..c.....c...', '...ccccc....', '............'],
  afterglow: [
    '.....w......', '.....w......', '....bwb.....', 'wwbbwwwbbww.', '..bbwwwbb...', '....bwb.....',
    '...bw.wb....', '..bw...wb...', '..b.....b...', '.......a....', '........a...', '.........a..'],
  shadow: [
    '.....bbb....', '...bb...b...', '..b.....b...', '.b.....b....', '.b....b.....', '.b....b.....',
    '.b.....b....', '..b.....b...', '...bb...b...', '.....bbb....', '...aa.......', '.aa.........'],
  wings: [
    '............', '.........bb.', '.......bbwb.', '.....bbwwb..', '...bbwwwb...', '.bbwwwwb....',
    'bwwwwwb.....', '.bwwwb......', '..bwb.......', '...b........', '............', '............'],
  executioner: [
    '....bbbb....', '...bwwwwb...', '..bwwwwwwb..', '..bwwwwwb...', '...bbbcb....', '......c.....',
    '......c.....', '......c.....', '......c.....', '......c.....', '.....aaa....', '............'],
  flame: [
    '..........b.', '.........bw.', '....b...bw..', '...bwb.bw...', '..bwbwbw....', '...b.bw.....',
    '....bw.b....', '...bw.bwb...', '..cc..bwb...', '.cc....b....', 'cc..........', '............'],
  vigor: [
    '............', '.aa...aa....', 'abba.abba...', 'abbbabbba.w.', 'abbbbbbba.w.', '.abbbbbbawww',
    '..abbbbba.w.', '...abbba..w.', '....aba.....', '.....a......', '............', '............'],
  oil: [
    '...cccc.....', '....bb......', '....bb...b..', '...b..b.bwb.', '..b.aa.b.b..', '.baaaaaab...',
    '.baawaaab...', '.baaaaaab...', '.baaaaaab...', '..baaaab....', '...bbbb.....', '............'],
  lock: [
    '....bbbb....', '...b....b...', '...b....b...', '...b....b...', '..aaaaaaaa..', '..abbbbbba..',
    '..abbccbba..', '..abbccbba..', '..abbbbbba..', '..aaaaaaaa..', '............', '............'],
  pause: [
    '............', '..www..www..', '..wbw..wbw..', '..wbw..wbw..', '..wbw..wbw..', '..wbw..wbw..',
    '..wbw..wbw..', '..wbw..wbw..', '..wbw..wbw..', '..www..www..', '............', '............'],
};
B.parryOath = B.parry; B.dodge = B.shadow; B.execute = B.executioner;

// 계열 색: 패링=등불, 회피=달빛, 처형=불씨, 공통=뼈빛
export const TONE = {
  amber: { a: '#a8541c', b: '#ffb347', c: '#5a3a26', w: '#fff0c8' },
  moon:  { a: '#3d5f8a', b: '#8fc8ff', c: '#2a3550', w: '#e8f6ff' },
  ember: { a: '#7a1f12', b: '#ff6a3d', c: '#4a1a14', w: '#ffd2b8' },
  bone:  { a: '#6c6276', b: '#d9cfc0', c: '#3d3546', w: '#ffffff' },
  heal:  { a: '#2f6b3a', b: '#7fe08a', c: '#24412a', w: '#e8ffe8' },
  red:   { a: '#7a1f2a', b: '#ff4f5e', c: '#3a1820', w: '#ffd0d6' },
};

const cache = new Map();
// 아이콘 → canvas (scale배). HUD는 canvas 그대로, DOM은 dataURL
export function iconCanvas(name, tone = 'bone', scale = 1) {
  const key = name + tone + scale; if (cache.has(key)) return cache.get(key);
  const rows = B[name] || B.lock, pal = TONE[tone] || TONE.bone, c = document.createElement('canvas');
  c.width = c.height = 12 * scale; const g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = pal[ch]; g.fillRect(x * scale, y * scale, scale, scale); } }));
  cache.set(key, c); return c;
}
export const iconURL = (name, tone, scale = 4) => iconCanvas(name, tone, scale).toDataURL();
export const icon = (name, tone, cls = 'ico') => `<img class="${cls}" alt="" src="${iconURL(name, tone)}">`;
export const RELIC_TONE = { parry: 'amber', dodge: 'moon', execute: 'ember', any: 'bone' };
