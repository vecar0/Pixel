// 테스트 공용: 입력 만들기, N틱 진행
import { tick, EMPTY_INPUT } from '../js/core/world.js';
export const I = (o = {}) => ({ ...EMPTY_INPUT, ...o });
export function steps(w, n, inp = {}) { for (let i = 0; i < n; i++) tick(w, I(inp)); }
// 평평한 바닥만 있는 테스트 월드용 지형
export const FLAT = [{ x: -1000, y: 300, w: 4000, h: 40 }];
