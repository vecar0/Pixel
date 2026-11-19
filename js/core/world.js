// 월드 생성과 한 틱 진행. DOM 없음 → Node에서 그대로 테스트
import { CFG } from './config.js';
import { createPlayer, updatePlayer } from './player.js';

export const EMPTY_INPUT = Object.freeze({
  left: false, right: false, down: false, jumpHeld: false,
  jump: false, attack: false, parry: false, roll: false, ult: false, flask: false,
});

const ROOMS = {
  arena: {
    width: 1280,
    solids: [
      { x: -40, y: 0, w: 40, h: 360 }, { x: 1280, y: 0, w: 40, h: 360 },
      { x: -40, y: 300, w: 1360, h: 60 },
      { x: 360, y: 230, w: 120, h: 8, oneWay: true },
      { x: 820, y: 230, w: 120, h: 8, oneWay: true },
    ],
    spawn: { x: 80, y: 250 },
  },
  boss: {
    width: 720,
    solids: [
      { x: -40, y: 0, w: 40, h: 360 }, { x: 720, y: 0, w: 40, h: 360 },
      { x: -40, y: 300, w: 800, h: 60 },
    ],
    spawn: { x: 80, y: 250 },
  },
};

export function createWorld({ room = 'arena', solids, spawn, width } = {}) {
  const def = ROOMS[room] || { width: width || 2000, solids: [], spawn: { x: 100, y: 250 } };
  const sp = spawn || def.spawn;
  return {
    room, t: 0, hitstop: 0, shake: 0,
    width: width || def.width,
    solids: solids || def.solids,
    player: createPlayer(sp.x, sp.y),
    enemies: [], projectiles: [], hitboxes: [], fx: [], events: [],
    camX: 0, over: false, won: false,
  };
}

export function tick(w, inp) {
  w.events.length = 0;
  w.t++;
  if (w.hitstop > 0) {          // 히트스톱: 세계는 멈추고 입력만 버퍼에 쌓음
    w.hitstop--;
    bufferOnly(w.player, inp);
    return;
  }
  updatePlayer(w, inp);
}

function bufferOnly(p, inp) {
  for (const a of ['attack', 'parry', 'roll', 'jump', 'ult', 'flask'])
    if (inp[a]) p.buffer = { action: a, t: CFG.player.bufferF };
}
