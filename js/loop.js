// 고정 스텝 누적기: 60틱/초. 한 프레임에 최대 5틱만 따라잡고 나머지는 버린다 (탭 복귀 시 폭주 방지)
import { CFG } from './core/config.js?v=mwpa0oiq';

const STEP = 1000 / CFG.TICK;

export function stepLoop(acc, dtMs, stepFn) {
  acc += dtMs;
  let n = 0;
  while (acc >= STEP && n < CFG.loop.maxStepsPerFrame) { stepFn(); acc -= STEP; n++; }
  return acc >= STEP ? acc % STEP : acc;
}
