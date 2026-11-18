// 키보드 + 마우스 + 터치 입력 → 매 프레임 입력 객체
export class Input {
  constructor(canvas, touchRoot) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, right: false, moved: 0 };
    this.touch = { x: 0, y: 0, active: false, id: null, ox: 0, oy: 0, btn: {} };
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.canvas = canvas;
    addEventListener('keydown', e => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.add(k); this.pressed.add(k);
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
    canvas.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.moved = performance.now(); });
    canvas.addEventListener('mousedown', e => { if (e.button === 0) this.mouse.down = true; if (e.button === 2) { this.mouse.right = true; this.pressed.add('mouse2'); } this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.moved = performance.now(); });
    addEventListener('mouseup', e => { if (e.button === 0) this.mouse.down = false; if (e.button === 2) this.mouse.right = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.setupTouch(touchRoot);
  }

  setupTouch(root) {
    this.troot = root;
    const stick = root.querySelector('#stick'), knob = root.querySelector('#knob');
    const zone = root.querySelector('#stickzone');
    const R = 38;
    const t = this.touch;
    const move = (x, y) => {
      let dx = x - t.ox, dy = y - t.oy; const l = Math.hypot(dx, dy);
      if (l > R) { dx = dx / l * R; dy = dy / l * R; }
      t.x = dx / R; t.y = dy / R;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    zone.addEventListener('pointerdown', e => {
      e.preventDefault(); this.isTouch = true;
      t.active = true; t.id = e.pointerId; t.ox = e.clientX; t.oy = e.clientY;
      const r = zone.getBoundingClientRect();
      stick.style.left = (e.clientX - r.left) + 'px'; stick.style.top = (e.clientY - r.top) + 'px';
      stick.classList.add('on'); try { zone.setPointerCapture(e.pointerId); } catch (_) { } move(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', e => { if (t.active && e.pointerId === t.id) move(e.clientX, e.clientY); });
    const end = e => { if (e.pointerId !== t.id) return; t.active = false; t.x = 0; t.y = 0; knob.style.transform = ''; stick.classList.remove('on'); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    for (const b of root.querySelectorAll('[data-btn]')) {
      const name = b.dataset.btn;
      b.addEventListener('pointerdown', e => { e.preventDefault(); this.isTouch = true; t.btn[name] = true; this.pressed.add('t_' + name); b.classList.add('down'); try { b.setPointerCapture(e.pointerId); } catch (_) { } if (navigator.vibrate && name !== 'attack') navigator.vibrate(8); });
      const up = () => { t.btn[name] = false; b.classList.remove('down'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    }
  }

  // 화면 좌표 → 월드 좌표 변환 함수 필요
  read(toWorld) {
    const k = this.keys, p = this.pressed, t = this.touch;
    const tb = t.btn;
    const inp = {
      left: k.has('a') || k.has('arrowleft') || t.x < -0.35,
      right: k.has('d') || k.has('arrowright') || t.x > 0.35,
      down: k.has('s') || k.has('arrowdown') || t.y > 0.6,
      jumpPressed: p.has('w') || p.has(' ') || p.has('arrowup') || p.has('t_jump'),
      jumpHeld: k.has('w') || k.has(' ') || k.has('arrowup') || !!tb.jump,
      attack: k.has('j') || this.mouse.down || !!tb.attack,
      skillPressed: p.has('k') || p.has('mouse2') || p.has('shift') || p.has('t_skill'),
      swapPressed: p.has('q') || p.has('t_swap'),
      interactPressed: p.has('e') || p.has('t_use'),
      pausePressed: p.has('escape') || p.has('p'),
      mouseAim: false, aimX: 0, aimY: 0,
    };
    if (this.mouse.down && !this.isTouch) {
      const [wx, wy] = toWorld(this.mouse.x, this.mouse.y);
      inp.mouseAim = true; inp.aimX = wx; inp.aimY = wy;
    }
    p.clear();
    return inp;
  }
  clearPressed() { this.pressed.clear(); }
}
