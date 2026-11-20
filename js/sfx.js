// WebAudio: 효과음(assets/sfx) + 수노로 만든 배경음악(assets/bgm). 첫 터치/키 입력에서 unlock()
const BGM_VOL = 0.55;
// 효과음별 크기·높낮이 흔들림 (vol: 0~1.5, pitch: ±비율, gap: 같은 소리 최소 간격 초)
const SFX = {
  swing: { vol: 0.45, pitch: 0.07 }, hit: { vol: 0.8 }, hit3: { vol: 0.95 }, parryPerfect: { vol: 0.9, pitch: 0.02 }, parryNormal: { vol: 0.75 },
  land: { vol: 0.4, gap: 0.12 }, hurt: { vol: 0.95 }, roll: { vol: 0.6 }, kill: { vol: 0.75 }, execute: { vol: 1.0, pitch: 0.02 },
  slam: { vol: 1.0, pitch: 0.03 }, ult: { vol: 0.85, pitch: 0.03 }, bolt: { vol: 0.6 }, telegraph: { vol: 0.55, gap: 0.08 },
  heal: { vol: 0.7, pitch: 0.02 }, click: { vol: 0.6, pitch: 0.06 }, ignite: { vol: 0.85, pitch: 0.02 },
};   // 배경음악 크기 (효과음 대비)
export class Sfx {
  constructor() { this.ac = null; this.on = true; }
  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { this.ac = new AC(); this.master = this.ac.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ac.destination); }
    if (this.ac) this.loadSfx();
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
  // 배경음악 (수노로 만든 곡). region 0 = 타이틀·마을, 1~4 = 지역, boss = 보스전.
  // 곡 끝 3초와 다음 바퀴 시작을 겹쳐(크로스페이드) 끊김 없이 반복. 곡을 바꿀 때는 1초 페이드
  musicFor(region, boss = false) {
    this.want = [region, boss];
    const key = boss ? 'boss' : region ? 'r' + Math.min(4, region) : 'town';
    if (this.musicKey === key && this.musicGain) return;
    this.stopMusic(); this.musicKey = key;
    if (!this.ac || this.musicOn === false) return;
    const g = this.ac.createGain(); g.gain.value = 0; g.connect(this.master); this.musicGain = g;
    g.gain.linearRampToValueAtTime(BGM_VOL, this.ac.currentTime + 1.2);
    this.loadBgm(key).then(buf => { if (this.musicGain === g && buf) this.loopBgm(buf, g, this.ac.currentTime + 0.05); });
  }
  loadBgm(key) {
    this.bgm = this.bgm || {};
    if (!this.bgm[key]) this.bgm[key] = fetch(`assets/bgm/${key}.mp3`).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
      .then(b => new Promise((ok, no) => this.ac.decodeAudioData(b, ok, no))).catch(() => null);
    return this.bgm[key];
  }
  loopBgm(buf, g, when) {
    const XF = 3, src = this.ac.createBufferSource(); src.buffer = buf; src.connect(g); src.start(when);
    this.musicSrcs = (this.musicSrcs || []).filter(s => s.g === g); this.musicSrcs.push({ src, g });
    const next = when + Math.max(5, buf.duration - XF), wait = (next - this.ac.currentTime - 0.5) * 1000;
    this.musicTimer = setTimeout(() => { if (this.musicGain === g) this.loopBgm(buf, g, next); }, Math.max(0, wait));
  }
  stopMusic() {
    if (this.musicTimer) clearTimeout(this.musicTimer); this.musicTimer = null;
    const g = this.musicGain; this.musicGain = null;
    if (g && this.ac) {                                                    // 1초에 걸쳐 줄이고 정리
      const t = this.ac.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 1);
      const srcs = (this.musicSrcs || []).filter(s => s.g === g);
      setTimeout(() => { for (const s of srcs) { try { s.src.stop(); } catch (e) { } } try { g.disconnect(); } catch (e) { } }, 1100);
    }
  }
  // 효과음: assets/sfx/*.mp3 (실제 소리 질감의 짧은 녹음형 효과음). 첫 unlock 때 한꺼번에 받아 둔다.
  // 같은 소리가 반복돼도 기계적으로 들리지 않게 매번 높낮이 ±4%·크기 ±10%를 살짝 흔든다.
  loadSfx() {
    if (this.bufs || !this.ac) return; this.bufs = {};
    for (const [k] of Object.entries(SFX)) fetch(`assets/sfx/${k}.mp3`).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
      .then(b => new Promise((ok, no) => this.ac.decodeAudioData(b, ok, no))).then(buf => { this.bufs[k] = buf; }).catch(() => {});
  }
  play(name) {
    if (!this.ac || !this.on) return;
    this.loadSfx();
    const conf = SFX[name], buf = this.bufs && this.bufs[name]; if (!conf || !buf) return;
    const now = this.ac.currentTime, last = (this.last = this.last || {})[name] || 0;
    if (now - last < (conf.gap || 0.03)) return;                              // 같은 프레임에 겹쳐 울리지 않게
    this.last[name] = now;
    const src = this.ac.createBufferSource(), g = this.ac.createGain();
    src.buffer = buf; src.playbackRate.value = 1 + (Math.random() * 2 - 1) * (conf.pitch ?? 0.04);
    g.gain.value = conf.vol * (0.9 + Math.random() * 0.2);
    src.connect(g).connect(this.master); src.start(now);
  }
}
