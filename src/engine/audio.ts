/**
 * WebAudio: music / sfx / voice buses with ducking (§8.1) and a fully
 * procedural SFX kit (§8.2) — no audio files anywhere in the project.
 */

export type SfxName =
  | 'jump'
  | 'doubleJump'
  | 'land'
  | 'stomp'
  | 'spin'
  | 'chomp'
  | 'spit'
  | 'roar'
  | 'hit'
  | 'hurt'
  | 'bounce'
  | 'fossil'
  | 'chip'
  | 'heart'
  | 'correct'
  | 'incorrect'
  | 'streak'
  | 'uiMove'
  | 'uiSelect'
  | 'uiBack'
  | 'doorOpen'
  | 'doorLocked'
  | 'splashText'
  | 'quizOrb'
  | 'checkpoint'
  | 'gear'
  | 'steam'
  | 'sniff'
  | 'buildPlace'
  | 'buildTest'
  | 'shieldBreak'
  | 'bossHit'
  | 'dizzy'
  | 'save';

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  voiceBus!: GainNode;
  private duck!: GainNode; // music passes through this; voice ducks it
  private started = false;
  private vols = { music: 0.7, sfx: 0.9, voice: 1.0 };

  /** Must be called from a user gesture (browser autoplay policy). Safe to call repeatedly. */
  start(): void {
    if (this.started) {
      void this.ctx?.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
    } catch {
      return;
    }
    const ctx = this.ctx;
    if (!ctx) return;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    this.duck = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.voiceBus = ctx.createGain();
    this.musicBus.connect(this.duck);
    this.duck.connect(this.master);
    this.sfxBus.connect(this.master);
    this.voiceBus.connect(this.master);
    this.setVolumes(this.vols.music, this.vols.sfx, this.vols.voice);
    this.started = true;
  }

  get ready(): boolean {
    return this.started && !!this.ctx;
  }

  setVolumes(music: number, sfx: number, voice: number): void {
    this.vols = { music, sfx, voice };
    if (!this.ready) return;
    this.musicBus.gain.value = music * music; // perceptual-ish curve
    this.sfxBus.gain.value = sfx * sfx;
    this.voiceBus.gain.value = voice;
  }

  /** Music auto-ducks −6 dB while a voice line plays (§8.1). */
  duckMusic(on: boolean): void {
    if (!this.ready || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.duck.gain.cancelScheduledValues(t);
    this.duck.gain.setTargetAtTime(on ? 0.5 : 1.0, t, 0.12);
  }

  // ---------------------------------------------------------------- SFX kit
  private tone(
    freq: number,
    opts: {
      type?: OscillatorType;
      dur?: number;
      vol?: number;
      slideTo?: number;
      delay?: number;
      attack?: number;
    } = {},
  ): void {
    if (!this.ready || !this.ctx) return;
    const { type = 'square', dur = 0.12, vol = 0.25, slideTo, delay = 0, attack = 0.005 } = opts;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(opts: { dur?: number; vol?: number; delay?: number; lpFrom?: number; lpTo?: number } = {}): void {
    if (!this.ready || !this.ctx) return;
    const { dur = 0.2, vol = 0.2, delay = 0, lpFrom = 3000, lpTo = 300 } = opts;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(lpFrom, t0);
    filt.frequency.exponentialRampToValueAtTime(Math.max(40, lpTo), t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt);
    filt.connect(gain);
    gain.connect(this.sfxBus);
    src.start(t0);
  }

  play(name: SfxName): void {
    if (!this.ready) return;
    switch (name) {
      case 'jump':
        this.tone(300, { type: 'square', slideTo: 620, dur: 0.14, vol: 0.16 });
        break;
      case 'doubleJump':
        this.tone(420, { type: 'square', slideTo: 860, dur: 0.15, vol: 0.16 });
        this.tone(630, { type: 'triangle', slideTo: 1240, dur: 0.12, vol: 0.1, delay: 0.03 });
        break;
      case 'land':
        this.noise({ dur: 0.09, vol: 0.12, lpFrom: 900, lpTo: 150 });
        break;
      case 'stomp':
        this.noise({ dur: 0.22, vol: 0.32, lpFrom: 700, lpTo: 60 });
        this.tone(90, { type: 'sine', slideTo: 42, dur: 0.22, vol: 0.34 });
        break;
      case 'spin':
        this.noise({ dur: 0.16, vol: 0.1, lpFrom: 4200, lpTo: 900 });
        this.tone(240, { type: 'sawtooth', slideTo: 380, dur: 0.14, vol: 0.07 });
        break;
      case 'chomp':
        this.tone(180, { type: 'square', slideTo: 90, dur: 0.08, vol: 0.2 });
        this.noise({ dur: 0.06, vol: 0.14, lpFrom: 2500, lpTo: 500, delay: 0.02 });
        break;
      case 'spit':
        this.tone(500, { type: 'square', slideTo: 220, dur: 0.12, vol: 0.14 });
        break;
      case 'roar': {
        this.tone(110, { type: 'sawtooth', slideTo: 55, dur: 0.8, vol: 0.3 });
        this.tone(163, { type: 'sawtooth', slideTo: 82, dur: 0.8, vol: 0.2 });
        this.noise({ dur: 0.7, vol: 0.16, lpFrom: 1200, lpTo: 200 });
        break;
      }
      case 'hit':
        this.tone(320, { type: 'square', slideTo: 140, dur: 0.08, vol: 0.2 });
        this.noise({ dur: 0.07, vol: 0.16, lpFrom: 3000, lpTo: 600 });
        break;
      case 'bossHit':
        this.tone(240, { type: 'square', slideTo: 90, dur: 0.14, vol: 0.26 });
        this.noise({ dur: 0.12, vol: 0.2, lpFrom: 2600, lpTo: 300 });
        break;
      case 'hurt':
        this.tone(280, { type: 'triangle', slideTo: 120, dur: 0.25, vol: 0.22 });
        break;
      case 'dizzy':
        this.tone(500, { type: 'sine', slideTo: 220, dur: 0.7, vol: 0.14 });
        this.tone(740, { type: 'sine', slideTo: 320, dur: 0.7, vol: 0.1, delay: 0.1 });
        break;
      case 'bounce':
        this.tone(220, { type: 'sine', slideTo: 660, dur: 0.18, vol: 0.2 });
        break;
      case 'fossil': {
        const notes = [523, 659, 784, 1047, 1319];
        notes.forEach((f, i) => this.tone(f, { type: 'triangle', dur: 0.34, vol: 0.2, delay: i * 0.11 }));
        this.tone(1568, { type: 'sine', dur: 0.6, vol: 0.12, delay: 0.55 });
        break;
      }
      case 'chip':
        this.tone(988, { type: 'triangle', dur: 0.07, vol: 0.12 });
        this.tone(1319, { type: 'triangle', dur: 0.1, vol: 0.1, delay: 0.05 });
        break;
      case 'heart':
        this.tone(660, { type: 'sine', dur: 0.12, vol: 0.14 });
        this.tone(880, { type: 'sine', dur: 0.2, vol: 0.14, delay: 0.1 });
        break;
      case 'correct': {
        [523, 659, 784].forEach((f, i) => this.tone(f, { type: 'triangle', dur: 0.14, vol: 0.16, delay: i * 0.07 }));
        break;
      }
      case 'incorrect':
        // deliberately gentle — a soft "hmm", never a buzzer (§8.2)
        this.tone(330, { type: 'sine', slideTo: 294, dur: 0.25, vol: 0.1 });
        break;
      case 'streak': {
        [659, 784, 988, 1319].forEach((f, i) => this.tone(f, { type: 'square', dur: 0.09, vol: 0.1, delay: i * 0.06 }));
        break;
      }
      case 'uiMove':
        this.tone(700, { type: 'sine', dur: 0.04, vol: 0.07 });
        break;
      case 'uiSelect':
        this.tone(600, { type: 'triangle', slideTo: 900, dur: 0.09, vol: 0.12 });
        break;
      case 'uiBack':
        this.tone(500, { type: 'triangle', slideTo: 330, dur: 0.09, vol: 0.1 });
        break;
      case 'doorOpen': {
        [262, 330, 392, 523].forEach((f, i) => this.tone(f, { type: 'triangle', dur: 0.3, vol: 0.14, delay: i * 0.09 }));
        this.noise({ dur: 0.4, vol: 0.06, lpFrom: 500, lpTo: 100 });
        break;
      }
      case 'doorLocked':
        this.tone(196, { type: 'square', dur: 0.12, vol: 0.12 });
        this.tone(185, { type: 'square', dur: 0.2, vol: 0.12, delay: 0.13 });
        break;
      case 'splashText':
        this.tone(880, { type: 'sine', slideTo: 1100, dur: 0.15, vol: 0.08 });
        break;
      case 'quizOrb':
        this.tone(784, { type: 'sine', dur: 0.1, vol: 0.12 });
        this.tone(1175, { type: 'sine', dur: 0.16, vol: 0.12, delay: 0.08 });
        break;
      case 'checkpoint':
        this.tone(523, { type: 'triangle', dur: 0.12, vol: 0.12 });
        this.tone(784, { type: 'triangle', dur: 0.24, vol: 0.12, delay: 0.1 });
        break;
      case 'gear':
        this.tone(120, { type: 'square', dur: 0.06, vol: 0.06 });
        break;
      case 'steam':
        this.noise({ dur: 0.5, vol: 0.12, lpFrom: 6000, lpTo: 2000 });
        break;
      case 'sniff':
        this.noise({ dur: 0.08, vol: 0.1, lpFrom: 2000, lpTo: 800 });
        this.noise({ dur: 0.1, vol: 0.12, lpFrom: 2200, lpTo: 700, delay: 0.12 });
        break;
      case 'buildPlace':
        this.tone(440, { type: 'square', slideTo: 520, dur: 0.08, vol: 0.12 });
        this.noise({ dur: 0.05, vol: 0.08, lpFrom: 1800, lpTo: 400 });
        break;
      case 'buildTest':
        this.tone(330, { type: 'triangle', slideTo: 495, dur: 0.3, vol: 0.12 });
        break;
      case 'shieldBreak': {
        this.noise({ dur: 0.35, vol: 0.26, lpFrom: 5000, lpTo: 400 });
        [1200, 900, 600].forEach((f, i) => this.tone(f, { type: 'square', dur: 0.1, vol: 0.1, delay: i * 0.05 }));
        break;
      }
      case 'save':
        this.tone(659, { type: 'sine', dur: 0.09, vol: 0.1 });
        this.tone(988, { type: 'sine', dur: 0.15, vol: 0.1, delay: 0.08 });
        break;
    }
  }
}

export const audio = new AudioEngine();
