// WebAudio 합성 효과음. 첫 터치/키 입력에서 unlock()
export class Sfx {
  constructor() { this.ac = null; this.on = true; }
  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { this.ac = new AC(); this.master = this.ac.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ac.destination); }
    if (this.ac && this.want) { this.musicKey = null; this.musicFor(...this.want); }
  }
  tone(freq, dur, type = 'square', vol = 0.3, slide = 0, delay = 0) {
    const a = this.ac, t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol = 0.3, freq = 2000, q = 1, delay = 0) {
    const a = this.ac, t = a.currentTime + delay, n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t);
  }
  // 배경음악: 지역마다 다른 음계의 느린 아르페지오 + 저음. 0 = 마을, 보스방은 빠르고 낮게
  musicFor(region, boss = false) {
    this.want = [region, boss];
    const key = region + (boss ? 'b' : '');
    if (this.musicKey === key && this.musicTimer) return;
    this.stopMusic(); this.musicKey = key;
    if (!this.ac || this.musicOn === false) return;
    const SCALES = [[220, 261.6, 329.6, 392, 440], [196, 233.1, 293.7, 349.2, 392], [174.6, 207.7, 261.6, 311.1, 349.2],
      [164.8, 196, 246.9, 293.7, 329.6], [146.8, 174.6, 220, 261.6, 277.2]];
    const sc = SCALES[Math.min(region, 4)], step = boss ? 0.2 : 0.42;
    let i = 0;
    const g = this.ac.createGain(); g.gain.value = 0.16; g.connect(this.master); this.musicGain = g;
    const note = (f, dur, type, vol, when) => {
      const o = this.ac.createOscillator(), v = this.ac.createGain();
      o.type = type; o.frequency.value = f; v.gain.setValueAtTime(0.0001, when);
      v.gain.exponentialRampToValueAtTime(vol, when + 0.03); v.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(v).connect(g); o.start(when); o.stop(when + dur + 0.05);
    };
    const tickFn = () => {
      if (!this.ac) return;
      const t = this.ac.currentTime + 0.05;
      const pat = boss ? [0, 2, 1, 3, 0, 4, 2, 1] : [0, 2, 4, 2, 1, 3, 2, 0];
      note(sc[pat[i % 8]] * (i % 16 < 8 ? 1 : 2), step * 1.8, 'triangle', 0.5, t);
      if (i % 4 === 0) note(sc[0] / 2, step * 4, boss ? 'sawtooth' : 'sine', boss ? 0.35 : 0.6, t);
      i++;
    };
    this.musicTimer = setInterval(tickFn, step * 1000); tickFn();
  }
  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer); this.musicTimer = null;
    if (this.musicGain) { try { this.musicGain.disconnect(); } catch (e) { } this.musicGain = null; }
  }
  play(name) {
    if (!this.ac || !this.on) return;
    switch (name) {
      case 'parryPerfect':   // 챙! 높은 금속음 두 겹 + 짧은 저음 펀치
        this.tone(2400, 0.5, 'triangle', 0.4); this.tone(3610, 0.42, 'sine', 0.22); this.tone(4810, 0.3, 'sine', 0.1);
        this.tone(1210, 0.12, 'square', 0.12); this.noise(0.05, 0.5, 5000, 0.8);
        this.tone(110, 0.18, 'sine', 0.75, 0.5); this.noise(0.25, 0.15, 7000, 0.5, 0.03); break;
      case 'parryNormal': this.tone(1500, 0.12, 'triangle', 0.25); this.noise(0.04, 0.25, 4000); break;
      case 'swing': this.noise(0.08, 0.12, 1800, 2); break;
      case 'hit': this.noise(0.07, 0.45, 1100, 0.9); this.tone(150, 0.09, 'sine', 0.55, 0.45); this.tone(420, 0.05, 'square', 0.12, 0.5); break;
      case 'hit3': this.noise(0.12, 0.6, 800, 0.8); this.tone(95, 0.18, 'sine', 0.8, 0.4); this.tone(1600, 0.12, 'triangle', 0.18, 0.7); break;
      case 'land': this.noise(0.06, 0.18, 400, 1); this.tone(80, 0.06, 'sine', 0.3, 0.6); break;
      case 'hurt': this.tone(300, 0.25, 'sawtooth', 0.3, 0.3); this.noise(0.1, 0.3, 600); break;
      case 'roll': this.noise(0.1, 0.08, 700, 1.5); break;
      case 'kill': this.tone(520, 0.2, 'square', 0.18, 0.4); break;
      case 'execute': this.tone(90, 0.35, 'sine', 0.7, 0.5); this.noise(0.2, 0.5, 1200); this.tone(1800, 0.3, 'triangle', 0.2); break;
      case 'slam': this.tone(70, 0.4, 'sine', 0.7, 0.6); this.noise(0.25, 0.4, 300); break;
      case 'ult': this.noise(0.6, 0.4, 900, 0.7); this.tone(160, 0.6, 'sawtooth', 0.25, 2); break;
      case 'telegraph': this.tone(880, 0.05, 'square', 0.06); break;
      case 'heal':      // 맑게 올라가는 세 음 (회복)
        this.tone(660, 0.18, 'triangle', 0.22); this.tone(880, 0.18, 'triangle', 0.22, 0, 0.08); this.tone(1320, 0.32, 'sine', 0.2, 0, 0.16); break;
    }
  }
}
