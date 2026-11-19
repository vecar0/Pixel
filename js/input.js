// 키보드 + 터치 입력. read()는 시뮬레이션 입력 형태를 돌려주고 '눌림' 이벤트를 비운다.
// 터치는 pointerdown 즉시 기록 → 같은 프레임에 눌렀다 떼도 눌림이 사라지지 않음.
// e.code(물리 키) 기준 → 한글 입력 상태에서도 동작
const KEYS = {
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], down: ['KeyS', 'ArrowDown'],
  jump: ['KeyW', 'Space', 'ArrowUp'], attack: ['KeyJ'], parry: ['KeyK'], roll: ['KeyL', 'ShiftLeft', 'ShiftRight'],
  skill: ['KeyU', 'KeyI'], flask: ['KeyQ'], pause: ['Escape', 'KeyP'], confirm: ['Enter', 'NumpadEnter'],
};
const PRESS = ['jump', 'attack', 'parry', 'roll', 'skill', 'flask', 'pause', 'confirm'];

export class Input {
  constructor(touchRoot) {
    this.held = new Set(); this.pressed = new Set();
    this.stick = { x: 0, y: 0, id: null };
    this.btnHeld = {};
    this.onAny = null;            // 첫 입력 콜백 (오디오 unlock 등)
    addEventListener('keydown', e => {
      const k = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
      if (e.repeat) return;
      for (const [act, ks] of Object.entries(KEYS)) if (ks.includes(k)) { this.held.add(act); if (PRESS.includes(act)) this.pressed.add(act); }
      this.onAny && this.onAny();
    });
    addEventListener('keyup', e => {
      const k = e.code;
      for (const [act, ks] of Object.entries(KEYS)) if (ks.includes(k)) this.held.delete(act);
    });
    addEventListener('blur', () => { this.held.clear(); this.btnHeld = {}; });
    if (touchRoot) this.setupTouch(touchRoot);
  }

  setupTouch(root) {
    const zone = root.querySelector('#stickzone'), stick = root.querySelector('#stick'), knob = root.querySelector('#knob');
    const R = 40, st = this.stick;
    const move = (x, y) => {
      let dx = x - st.ox, dy = y - st.oy; const l = Math.hypot(dx, dy);
      if (l > R) { dx = dx / l * R; dy = dy / l * R; }
      st.x = dx / R; st.y = dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`;
    };
    zone.addEventListener('pointerdown', e => {
      e.preventDefault(); this.onAny && this.onAny();
      if (st.id != null) return;                    // 이미 잡은 손가락이 있으면 두 번째는 무시
      st.id = e.pointerId; st.ox = e.clientX; st.oy = e.clientY;
      const r = zone.getBoundingClientRect();
      stick.style.left = (e.clientX - r.left) + 'px'; stick.style.top = (e.clientY - r.top) + 'px';
      stick.classList.add('on'); try { zone.setPointerCapture(e.pointerId); } catch (_) { }
      move(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', e => { if (e.pointerId === st.id) move(e.clientX, e.clientY); });
    const end = e => { if (e.pointerId !== st.id) return; st.id = null; st.x = st.y = 0; knob.style.transform = ''; stick.classList.remove('on'); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end); zone.addEventListener('lostpointercapture', end);

    for (const b of root.querySelectorAll('[data-btn]')) {
      const act = b.dataset.btn;
      b.addEventListener('pointerdown', e => {
        e.preventDefault(); this.onAny && this.onAny();
        this.btnHeld[act] = true; this.pressed.add(act); b.classList.add('down');
        try { b.setPointerCapture(e.pointerId); } catch (_) { }
      });
      const up = () => { this.btnHeld[act] = false; b.classList.remove('down'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    }
  }

  // 시뮬레이션 입력 1틱분
  read() {
    const h = this.held, p = this.pressed, st = this.stick, tb = this.btnHeld;
    const inp = {
      left: h.has('left') || st.x < -0.35,
      right: h.has('right') || st.x > 0.35,
      down: h.has('down') || st.y > 0.6,
      jumpHeld: h.has('jump') || !!tb.jump,
      jump: p.has('jump'), attack: p.has('attack'), parry: p.has('parry'),
      roll: p.has('roll'), skill: p.has('skill'), flask: p.has('flask'),
    };
    for (const k of ['jump', 'attack', 'parry', 'roll', 'skill', 'flask']) p.delete(k);
    return inp;
  }
  // 화면이 바뀔 때 남은 입력 비우기 (이전 화면의 키가 새 화면에서 실행되지 않게)
  clear() {
    this.pressed.clear(); this.btnHeld = {};
    for (const b of document.querySelectorAll('[data-btn].down')) b.classList.remove('down');
  }
  // 메뉴용 (일시정지·확인)
  take(name) { const had = this.pressed.has(name); this.pressed.delete(name); return had; }
}
