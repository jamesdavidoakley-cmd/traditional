/**
 * Procedural chiptune sequencer (§8.2). Tracks are data (/content/music/*.json):
 * 16/32-step patterns of scale degrees over a per-world scale + bpm.
 * A combat layer fades in when enemies aggro (intensity → 1).
 */
import { audio } from './audio';

export interface MusicLayerDef {
  name: string;
  wave: OscillatorType;
  octave: number;
  gain: number;
  decay: number;
  steps: (number | null)[];
  combat?: boolean; // only audible at high intensity
}

export interface PercDef {
  kind: 'kick' | 'snare' | 'hat' | 'shaker' | 'woodblock';
  steps: number[]; // 0/1 (or velocity 0..1)
  gain?: number;
}

export interface MusicDef {
  id: string;
  bpm: number;
  root: number; // MIDI note
  mode: 'major' | 'minor' | 'dorian' | 'mixolydian' | 'pentMajor' | 'pentMinor';
  layers: MusicLayerDef[];
  perc?: PercDef[];
}

const MODES: Record<MusicDef['mode'], number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  pentMajor: [0, 2, 4, 7, 9],
  pentMinor: [0, 3, 5, 7, 10],
};

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function degreeToMidi(root: number, mode: MusicDef['mode'], degree: number): number {
  const scale = MODES[mode];
  const n = scale.length;
  const oct = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return root + oct * 12 + scale[idx];
}

export class MusicEngine {
  private def: MusicDef | null = null;
  private step = 0;
  private nextStepTime = 0;
  private timer: number | null = null;
  private intensity = 0;
  private targetIntensity = 0;
  private trackGain: GainNode | null = null;
  private fadingOut: GainNode | null = null;

  setIntensity(v: number): void {
    this.targetIntensity = Math.max(0, Math.min(1, v));
  }

  play(def: MusicDef | null): void {
    if (this.def?.id === def?.id && this.timer !== null) return;
    this.stopCurrent();
    this.def = def;
    this.step = 0;
    if (!def || !audio.ready || !audio.ctx) return;
    this.trackGain = audio.ctx.createGain();
    this.trackGain.gain.value = 0.0001;
    this.trackGain.gain.setTargetAtTime(1, audio.ctx.currentTime, 0.8);
    this.trackGain.connect(audio.musicBus);
    this.nextStepTime = audio.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.tick(), 30);
  }

  private stopCurrent(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.trackGain && audio.ctx) {
      const g = this.trackGain;
      g.gain.setTargetAtTime(0.0001, audio.ctx.currentTime, 0.4);
      this.fadingOut = g;
      window.setTimeout(() => {
        g.disconnect();
        if (this.fadingOut === g) this.fadingOut = null;
      }, 1600);
    }
    this.trackGain = null;
  }

  stop(): void {
    this.stopCurrent();
    this.def = null;
  }

  private tick(): void {
    const ctx = audio.ctx;
    const def = this.def;
    if (!ctx || !def || !this.trackGain) return;
    this.intensity += (this.targetIntensity - this.intensity) * 0.08;
    const stepDur = 60 / def.bpm / 4; // 16th notes
    while (this.nextStepTime < ctx.currentTime + 0.15) {
      this.scheduleStep(this.nextStepTime, this.step);
      this.nextStepTime += stepDur;
      this.step++;
    }
  }

  private scheduleStep(t: number, stepIdx: number): void {
    const ctx = audio.ctx;
    const def = this.def;
    const out = this.trackGain;
    if (!ctx || !def || !out) return;
    for (const layer of def.layers) {
      const steps = layer.steps;
      const deg = steps[stepIdx % steps.length];
      if (deg === null || deg === undefined) continue;
      const combatMul = layer.combat ? this.intensity : 1 - this.intensity * 0.25;
      if (combatMul < 0.05) continue;
      const midi = degreeToMidi(def.root + layer.octave * 12, def.mode, deg);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = layer.wave;
      osc.frequency.value = midiToFreq(midi);
      const vol = layer.gain * combatMul;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.03, layer.decay));
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + layer.decay + 0.05);
    }
    for (const perc of def.perc ?? []) {
      const v = perc.steps[stepIdx % perc.steps.length];
      if (!v) continue;
      this.schedulePerc(perc.kind, t, (perc.gain ?? 0.5) * v * (perc.kind === 'hat' ? 1 : 1 + this.intensity * 0.3));
    }
  }

  private schedulePerc(kind: PercDef['kind'], t: number, vol: number): void {
    const ctx = audio.ctx;
    const out = this.trackGain;
    if (!ctx || !out) return;
    if (kind === 'kick') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(vol * 0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + 0.16);
      return;
    }
    // noise-based percussion
    const dur = kind === 'snare' ? 0.12 : kind === 'shaker' ? 0.05 : kind === 'woodblock' ? 0.05 : 0.03;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    if (kind === 'hat' || kind === 'shaker') {
      filt.type = 'highpass';
      filt.frequency.value = 6000;
    } else if (kind === 'woodblock') {
      filt.type = 'bandpass';
      filt.frequency.value = 1800;
      filt.Q.value = 6;
    } else {
      filt.type = 'bandpass';
      filt.frequency.value = 2200;
      filt.Q.value = 0.8;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * (kind === 'snare' ? 0.3 : 0.14), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(out);
    src.start(t);
  }
}

export const music = new MusicEngine();
