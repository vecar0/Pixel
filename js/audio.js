// WebAudio 칩튠 — 효과음과 배경음을 직접 합성 (외부 파일 없음)
export class Audio8 {
  constructor() { this.ctx = null; this.sound = true; this.music = true; this.bgmTheme = -1; this.last = {}; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
      this.sfxG = this.ctx.createGain(); this.sfxG.gain.value = 0.55; this.sfxG.connect(this.master);
      this.bgmG = this.ctx.createGain(); this.bgmG.gain.value = 0.22; this.bgmG.connect(this.master);
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.next = this.ctx.currentTime; this.step = 0;
      setInterval(() => this.schedule(), 50);
    } catch (e) { this.ctx = null; }
  }
  tone(type, f0, f1, dur, vol = 0.3, delay = 0, dest) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.sfxG); o.start(t); o.stop(t + dur + 0.02);
  }
  noiseHit(dur, vol = 0.3, freq = 1200, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(80, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxG); s.start(t); s.stop(t + dur + 0.02);
  }
  play(id) {
    if (!this.ctx || !this.sound) return;
    const now = this.ctx.currentTime;
    const gap = { hit: 0.03, crit: 0.04, coin: 0.025, orb: 0.03, shoot: 0.035, laser: 0.04, eshoot: 0.05, kill: 0.03, boom: 0.06, magic: 0.04, block: 0.08, armor: 0.1 }[id] || 0.02;
    if (this.last[id] && now - this.last[id] < gap) return;
    this.last[id] = now;
    const T = (...a) => this.tone(...a), N = (...a) => this.noiseHit(...a);
    switch (id) {
      case 'shoot': T('square', 880, 440, 0.06, 0.12); break;
      case 'magic': T('triangle', 1200, 1800, 0.08, 0.15); T('square', 600, 900, 0.05, 0.05); break;
      case 'laser': T('sawtooth', 1400, 300, 0.1, 0.1); break;
      case 'shotgun': N(0.12, 0.35, 2500); T('square', 200, 80, 0.1, 0.12); break;
      case 'boom_shot': T('square', 300, 60, 0.18, 0.18); N(0.15, 0.2, 900); break;
      case 'slash': N(0.07, 0.25, 4000); T('triangle', 700, 200, 0.07, 0.1); break;
      case 'eslash': N(0.08, 0.25, 2000); break;
      case 'hit': T('square', 300, 150, 0.04, 0.1); break;
      case 'crit': T('square', 900, 500, 0.06, 0.15); T('square', 1300, 900, 0.05, 0.08, 0.02); break;
      case 'kill': N(0.1, 0.25, 1800); T('square', 500, 120, 0.12, 0.12); break;
      case 'boom': N(0.35, 0.45, 1400); T('sine', 120, 40, 0.3, 0.3); break;
      case 'coin': T('square', 1320, 1320, 0.04, 0.08); T('square', 1760, 1760, 0.06, 0.08, 0.04); break;
      case 'orb': T('sine', 900, 1400, 0.06, 0.08); break;
      case 'heal': [523, 659, 784].forEach((f, i) => T('triangle', f, f, 0.12, 0.15, i * 0.07)); break;
      case 'jump': T('square', 300, 600, 0.08, 0.08); break;
      case 'jump2': T('square', 500, 1000, 0.08, 0.08); break;
      case 'hurt': T('sawtooth', 400, 100, 0.25, 0.25); N(0.15, 0.2, 1500); break;
      case 'armorhit': T('square', 600, 300, 0.12, 0.18); T('triangle', 1200, 600, 0.1, 0.1); break;
      case 'armor': T('triangle', 700, 1000, 0.06, 0.06); break;
      case 'shield': T('sine', 1200, 600, 0.2, 0.2); break;
      case 'empty': T('square', 150, 150, 0.06, 0.1); break;
      case 'swap': T('square', 600, 800, 0.04, 0.08); break;
      case 'pickup': T('square', 500, 1000, 0.1, 0.12); break;
      case 'chest': [392, 523, 659, 784].forEach((f, i) => T('square', f, f, 0.08, 0.1, i * 0.05)); break;
      case 'buy': T('square', 1046, 1046, 0.06, 0.12); T('square', 1568, 1568, 0.1, 0.12, 0.06); break;
      case 'door': T('square', 200, 300, 0.12, 0.1); break;
      case 'lock': T('square', 220, 110, 0.15, 0.2); N(0.1, 0.2, 800); break;
      case 'clear': [523, 659, 784, 1046].forEach((f, i) => T('square', f, f, 0.1, 0.12, i * 0.08)); break;
      case 'skill': T('sawtooth', 300, 1200, 0.25, 0.15); T('square', 600, 2400, 0.2, 0.08, 0.05); break;
      case 'dash': N(0.15, 0.3, 5000); T('square', 800, 200, 0.12, 0.1); break;
      case 'buff': [659, 784, 988, 1318].forEach((f, i) => T('triangle', f, f, 0.15, 0.15, i * 0.06)); break;
      case 'statue': T('sine', 440, 880, 0.4, 0.2); break;
      case 'portal': T('sine', 200, 1600, 0.6, 0.2); T('triangle', 400, 2400, 0.5, 0.1); break;
      case 'ebow': T('triangle', 500, 200, 0.06, 0.08); break;
      case 'eshoot': T('square', 400, 250, 0.05, 0.06); break;
      case 'ecast': T('sine', 300, 700, 0.15, 0.1); break;
      case 'block': T('square', 1800, 1200, 0.04, 0.08); break;
      case 'blink': T('sine', 1600, 400, 0.12, 0.15); break;
      case 'slam': N(0.4, 0.5, 900); T('sine', 90, 40, 0.35, 0.35); break;
      case 'roar': T('sawtooth', 120, 60, 0.6, 0.25); N(0.5, 0.25, 600); break;
      case 'bossin': T('sawtooth', 80, 160, 0.8, 0.2); N(0.6, 0.2, 400); break;
      case 'bossdie': [784, 659, 523, 392, 523, 784, 1046].forEach((f, i) => T('square', f, f, 0.14, 0.15, i * 0.1)); N(0.8, 0.4, 1200); break;
      case 'die': [440, 370, 311, 220].forEach((f, i) => T('square', f, f * 0.98, 0.18, 0.18, i * 0.16)); break;
      case 'revive': [523, 784, 1046, 1568].forEach((f, i) => T('triangle', f, f, 0.2, 0.18, i * 0.08)); break;
      case 'ui': T('square', 880, 880, 0.03, 0.08); break;
      case 'uiok': T('square', 660, 990, 0.08, 0.1); break;
    }
  }

  setTheme(i, boss = false) { this.bgmTheme = boss ? 9 : i; this.step = 0; }
  // 아주 단순한 4채널 시퀀서
  schedule() {
    if (!this.ctx || !this.music || this.bgmTheme < 0) { if (this.ctx) this.next = this.ctx.currentTime + 0.05; return; }
    const SONGS = {
      0: { bpm: 132, root: 57, scale: [0, 3, 5, 7, 10], bass: [0, 0, 7, 5, 0, 0, 10, 7], prog: [0, 0, 5, 3] },
      1: { bpm: 108, root: 52, scale: [0, 2, 3, 7, 8], bass: [0, 7, 0, 3, 0, 7, 8, 7], prog: [0, 3, 5, 3] },
      2: { bpm: 140, root: 50, scale: [0, 2, 5, 7, 9], bass: [0, 0, 12, 0, 7, 0, 5, 7], prog: [0, 5, 7, 5] },
      3: { bpm: 118, root: 55, scale: [0, 1, 5, 7, 8], bass: [0, 0, 1, 0, 7, 0, 8, 7], prog: [0, 1, 0, 8] },
      9: { bpm: 156, root: 52, scale: [0, 1, 3, 7, 8], bass: [0, 12, 0, 12, 1, 13, 7, 8], prog: [0, 0, 1, 1] },
    };
    const S = SONGS[this.bgmTheme] || SONGS[0];
    const spb = 60 / S.bpm / 2; // 8분음표
    const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
    while (this.next < this.ctx.currentTime + 0.2) {
      const st = this.step, bar = Math.floor(st / 16) % 4, chord = S.prog[bar];
      const t = this.next - this.ctx.currentTime;
      if (t >= 0) {
        // 베이스
        const bn = S.root - 12 + chord + S.bass[st % 8];
        this.tone('triangle', mtof(bn), mtof(bn), spb * 0.9, 0.5, t, this.bgmG);
        // 아르페지오
        if (st % 2 === 0) {
          const deg = [0, 2, 4, 2, 1, 3, 4, 3][(st / 2) % 8];
          const n = S.root + 12 + chord + S.scale[deg % S.scale.length];
          this.tone('square', mtof(n), mtof(n), spb * 0.5, 0.12, t, this.bgmG);
        }
        // 멜로디 (의사 난수로 결정, 마디마다 반복)
        const h = Math.sin((Math.floor(st / 2) % 32) * 12.9898 + this.bgmTheme * 78.233) * 43758.5453;
        const r = h - Math.floor(h);
        if (st % 4 === 0 && r > 0.35) {
          const n = S.root + 24 + chord + S.scale[Math.floor(r * 10) % S.scale.length];
          this.tone('square', mtof(n), mtof(n), spb * 1.6, 0.07, t, this.bgmG);
        }
        // 드럼
        if (st % 8 === 0) this.kick(t);
        if (st % 8 === 4) this.snare(t);
        if (st % 2 === 1) this.hat(t);
      }
      this.next += spb; this.step++;
    }
  }
  kick(t) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(), T = c.currentTime + t; o.frequency.setValueAtTime(150, T); o.frequency.exponentialRampToValueAtTime(40, T + 0.12); g.gain.setValueAtTime(0.6, T); g.gain.exponentialRampToValueAtTime(0.001, T + 0.15); o.connect(g); g.connect(this.bgmG); o.start(T); o.stop(T + 0.16); }
  snare(t) { this.drumNoise(t, 0.12, 0.3, 3000); }
  hat(t) { this.drumNoise(t, 0.03, 0.08, 8000); }
  drumNoise(t, dur, vol, f) {
    const c = this.ctx, T = c.currentTime + t, s = c.createBufferSource(); s.buffer = this.noise;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = f;
    const g = c.createGain(); g.gain.setValueAtTime(vol, T); g.gain.exponentialRampToValueAtTime(0.001, T + dur);
    s.connect(hp); hp.connect(g); g.connect(this.bgmG); s.start(T); s.stop(T + dur + 0.01);
  }
}
