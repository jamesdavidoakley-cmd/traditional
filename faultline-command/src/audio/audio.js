// Original procedural audio. Every sound is synthesised at runtime from
// oscillators and shaped noise — no samples, no third-party assets.

const NOISE_LEN = 2;

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = 0.75;
    this.sfxVol = 0.85;
    this.musicVol = 0.5;
    this.muted = false;
    this.ready = false;
    this.lastAt = {};
    this.view = null;
    this.musicNodes = [];
    this.musicTimer = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.master;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.2;
    this.masterGain.connect(comp);
    comp.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVol;
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVol * 0.4;
    this.musicGain.connect(this.masterGain);

    this.noise = this.makeNoise();
    this.ready = true;
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  makeNoise() {
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sr * NOISE_LEN, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  setMaster(v) { this.master = v; if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : v; }
  setSfx(v) { this.sfxVol = v; if (this.sfxGain) this.sfxGain.gain.value = v; }
  setMusic(v) { this.musicVol = v; if (this.musicGain) this.musicGain.gain.value = v * 0.4; }
  setMuted(m) { this.muted = m; if (this.masterGain) this.masterGain.gain.value = m ? 0 : this.master; }

  /** Attenuate by distance from the camera so off-screen battles stay quiet. */
  gainAt(x, y) {
    if (!this.view || x === undefined) return 1;
    const dx = x - this.view.camX, dy = y - this.view.camY;
    const d = Math.hypot(dx, dy);
    return Math.max(0, 1 - d / 34);
  }

  throttle(key, ms) {
    const now = performance.now();
    if (this.lastAt[key] && now - this.lastAt[key] < ms) return false;
    this.lastAt[key] = now;
    return true;
  }

  _noiseBurst(dur, freq, q, gain, type = 'bandpass', slide = 0) {
    if (!this.ctx || !(gain > 0.0005)) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * slide), c.currentTime + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0008, c.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start();
    src.stop(c.currentTime + dur + 0.02);
  }

  _tone(freq, dur, gain, type = 'sine', slideTo) {
    if (!this.ctx || !(gain > 0.0005) || !(freq > 0)) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, c.currentTime + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(); o.stop(c.currentTime + dur + 0.02);
  }

  // -------------------------------------------------------------- game sfx
  weapon(w, src, game) {
    if (!this.ready || this.muted) return;
    const gain = this.gainAt(src.x, src.y);
    if (gain <= 0.02) return;
    const proj = w.projectile;
    if (proj === 'bullet') {
      if (!this.throttle('mg', 55)) return;
      this._noiseBurst(0.06, 1500, 1.4, 0.16 * gain, 'bandpass', 0.5);
    } else if (proj === 'shell') {
      if (!this.throttle('gun', 70)) return;
      this._noiseBurst(0.22, 320, 0.8, 0.5 * gain, 'lowpass', 0.35);
      this._tone(90, 0.2, 0.28 * gain, 'sine', 42);
    } else if (proj === 'arc') {
      if (!this.throttle('how', 90)) return;
      this._noiseBurst(0.35, 220, 0.7, 0.6 * gain, 'lowpass', 0.3);
      this._tone(70, 0.3, 0.34 * gain, 'triangle', 32);
    } else if (proj === 'rocket') {
      if (!this.throttle('rkt', 60)) return;
      this._noiseBurst(0.5, 900, 0.9, 0.34 * gain, 'bandpass', 0.25);
    } else if (proj === 'missile') {
      if (!this.throttle('msl', 90)) return;
      this._noiseBurst(0.45, 1200, 1.1, 0.26 * gain, 'bandpass', 0.2);
    }
  }

  explosion(x, y, size) {
    if (!this.ready || this.muted) return;
    const gain = this.gainAt(x, y);
    if (gain <= 0.02) return;
    if (!this.throttle('exp', 45)) return;
    this._noiseBurst(0.55 + size * 0.1, 260, 0.6, Math.min(0.85, 0.35 + size * 0.14) * gain, 'lowpass', 0.18);
    this._tone(58, 0.45, 0.32 * gain, 'sine', 26);
  }

  intercept(site) {
    if (!this.ready || this.muted) return;
    const gain = this.gainAt(site.x, site.y);
    if (gain <= 0.02) return;
    if (!this.throttle('int', 90)) return;
    this._noiseBurst(0.4, 2400, 2.2, 0.24 * gain, 'bandpass', 0.35);
    this._tone(880, 0.25, 0.1 * gain, 'sawtooth', 2200);
  }

  airburst() {
    if (!this.ready || this.muted) return;
    this._noiseBurst(0.3, 1800, 1.0, 0.32, 'bandpass', 0.2);
    this._tone(320, 0.2, 0.14, 'square', 120);
  }

  launch(a) {
    if (!this.ready || this.muted) return;
    this._noiseBurst(0.9, 700, 0.7, 0.35, 'bandpass', 0.3);
    this._tone(150, 0.7, 0.16, 'sawtooth', 60);
  }

  warning() {
    if (!this.ready || this.muted) return;
    if (!this.throttle('warn', 2200)) return;
    const c = this.ctx;
    for (let i = 0; i < 2; i++) {
      setTimeout(() => { if (this.ready) this._tone(760, 0.16, 0.2, 'square'); }, i * 210);
    }
  }

  built() { if (this.ready && !this.muted) { this._tone(520, 0.1, 0.13, 'triangle'); setTimeout(() => this.ready && this._tone(780, 0.14, 0.13, 'triangle'), 90); } }
  unitReady() { if (this.ready && !this.muted && this.throttle('rdy', 400)) this._tone(640, 0.09, 0.10, 'triangle'); }
  build() { if (this.ready && !this.muted) this._tone(300, 0.1, 0.11, 'square'); }
  capture() { if (this.ready && !this.muted) { this._tone(440, 0.12, 0.14, 'triangle'); setTimeout(() => this.ready && this._tone(660, 0.16, 0.14, 'triangle'), 110); } }
  click() { if (this.ready && !this.muted) this._tone(880, 0.035, 0.07, 'square'); }
  select() { if (this.ready && !this.muted && this.throttle('sel', 60)) this._tone(1150, 0.035, 0.06, 'square'); }
  order() { if (this.ready && !this.muted && this.throttle('ord', 60)) this._tone(520, 0.05, 0.07, 'square', 720); }
  deny() { if (this.ready && !this.muted) this._tone(180, 0.14, 0.12, 'square', 110); }
  victory() { if (!this.ready) return; [392, 523, 659, 784].forEach((f, i) => setTimeout(() => this.ready && this._tone(f, 0.5, 0.16, 'triangle'), i * 180)); }
  defeat() { if (!this.ready) return; [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this.ready && this._tone(f, 0.6, 0.16, 'triangle'), i * 240)); }

  // ---------------------------------------------------------------- music
  /**
   * A slow, minor-key military ambience: a low drone, a sparse timpani pulse and
   * a four-note motif that drifts between two chords. Entirely generated here.
   */
  startMusic(intense) {
    if (!this.ready || this.musicTimer) return;
    this.stopMusic();
    const c = this.ctx;
    const drone = c.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.value = 55;
    const df = c.createBiquadFilter();
    df.type = 'lowpass'; df.frequency.value = 220; df.Q.value = 3;
    const dg = c.createGain();
    dg.gain.value = 0.10;
    drone.connect(df); df.connect(dg); dg.connect(this.musicGain);
    drone.start();
    this.musicNodes.push(drone, dg);

    const scale = [0, 3, 5, 7, 10];    // minor pentatonic
    const roots = [55, 55, 73.42, 65.41];
    let step = 0;
    const beat = 1.05;
    const tick = () => {
      if (!this.ready) return;
      const bar = Math.floor(step / 8) % roots.length;
      const root = roots[bar];
      if (step % 8 === 0) {
        // timpani
        this._musicTone(root * 0.5, 0.9, 0.22, 'sine', root * 0.35);
      }
      if (step % 4 === 2) this._musicNoise(0.18, 3000, 0.035);
      if (step % 2 === 0) {
        const n = scale[(step * 3 + bar) % scale.length];
        const f = root * 2 * Math.pow(2, n / 12);
        this._musicTone(f, 1.6, 0.055, 'triangle');
        this._musicTone(f * 1.5, 1.4, 0.028, 'sine');
      }
      step++;
      this.musicTimer = setTimeout(tick, beat * 500);
    };
    tick();
  }

  _musicTone(freq, dur, gain, type, slideTo) {
    if (!this.ctx || !(gain > 0.0005)) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, c.currentTime + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(this.musicGain);
    o.start(); o.stop(c.currentTime + dur + 0.05);
  }

  _musicNoise(dur, freq, gain) {
    if (!this.ctx || !(gain > 0.0005)) return;
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    s.connect(f); f.connect(g); g.connect(this.musicGain);
    s.start(); s.stop(c.currentTime + dur + 0.02);
  }

  stopMusic() {
    if (this.musicTimer) { clearTimeout(this.musicTimer); this.musicTimer = null; }
    for (const n of this.musicNodes) { try { n.stop && n.stop(); } catch (e) { /* already stopped */ } }
    this.musicNodes = [];
  }
}
