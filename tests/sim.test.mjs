// headless 전투 시뮬레이션 테스트: node tests/sim.test.mjs
import { test, ok, eq, run } from './lib.mjs';
import { CFG } from '../js/core/config.js';

test('config: 완벽 패링 6f', () => eq(CFG.parry.perfectF, 6));
test('config: 회피 무적 12f', () => eq(CFG.roll.iEnd - CFG.roll.iStart + 1, 12));

run();
