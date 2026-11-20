// 캐시 버스팅: 배포 전에 실행 → 모든 js 모듈 import · css · main.js · 그림/데이터 불러오기에 ?v=<버전>을 붙인다.
// 폰 브라우저가 예전 파일과 새 파일을 섞어 쓰는 문제(새 화면 대신 옛 화면, 모듈이 안 맞아 오류)를 막는다.
// 사용: node tools/bust.mjs   (버전 = 지금 시각)
import fs from 'fs'; import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const V = process.argv[2] || Date.now().toString(36);
const files = [...fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f),
  ...fs.readdirSync(path.join(root, 'js/core')).filter(f => f.endsWith('.js')).map(f => 'js/core/' + f)];
let n = 0;
for (const f of files) {
  const p = path.join(root, f); let s = fs.readFileSync(p, 'utf8'); const s0 = s;
  // 우리 모듈끼리의 import (vendor는 바뀌지 않으므로 그대로)
  s = s.replace(/(from\s+'|import\(\s*')(\.{1,2}\/(?!vendor\/)[^'?]+\.js)(\?v=[^']*)?'/g, (_, a, u) => `${a}${u}?v=${V}'`);
  if (s !== s0) { fs.writeFileSync(p, s); n++; }
}
const ix = path.join(root, 'index.html'); let h = fs.readFileSync(ix, 'utf8');
h = h.replace(/css\/style\.css(\?v=[^"]*)?"/, `css/style.css?v=${V}"`).replace(/js\/main\.js(\?v=[^"]*)?"/, `js/main.js?v=${V}"`);
h = h.replace(/<script>window\.__V = '[^']*';<\/script>\n?/, '');
h = h.replace('<script type="module"', `<script>window.__V = '${V}';</script>\n<script type="module"`);
fs.writeFileSync(ix, h);
console.log(`버전 ${V}: 모듈 ${n}개 + index.html`);
