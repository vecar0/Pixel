// 아주 작은 테스트 러너: test(name, fn) 등록 → run()
const tests = [];
export const test = (name, fn) => tests.push({ name, fn });
export function ok(cond, msg = '') { if (!cond) throw new Error('ok 실패 ' + msg); }
export function eq(a, b, msg = '') { if (a !== b) throw new Error(`eq 실패 ${msg}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }
export function run() {
  let fail = 0;
  for (const t of tests) {
    try { t.fn(); console.log('  ✔', t.name); }
    catch (e) { fail++; console.log('  ✘', t.name, '—', e.message); }
  }
  console.log(`\n${tests.length - fail}/${tests.length} 통과`);
  if (fail) process.exit(1);
}
