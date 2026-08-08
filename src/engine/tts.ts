/**
 * Text-to-speech behind a swappable VoiceProvider interface (§8.3).
 * WebSpeechProvider is the default; NullProvider paces subtitles silently;
 * ElevenLabsProvider is a documented premium stub, only constructed when a
 * key is supplied. TTS failure must never break dialogue — every path ends
 * with onEnd firing.
 */
import { audio } from './audio';

export interface VoiceProfile {
  id: string;
  rate: number;
  pitch: number;
  volume?: number;
  langPref?: string; // e.g. "en-GB", "en-AU"
  namePref?: string[]; // substrings matched against available voice names
  elevenVoiceId?: string;
}

export interface SpeakHandle {
  done: Promise<void>;
  cancel(): void;
}

export interface VoiceProvider {
  readonly name: string;
  available(): boolean;
  speak(text: string, profile: VoiceProfile, rateMul: number, volume: number): SpeakHandle;
  cancelAll(): void;
}

/** Reading-time estimate used for silent pacing and as a safety net. */
export function estimateMs(text: string, rateMul: number): number {
  const chars = text.length;
  return Math.min(14000, Math.max(1100, (chars / 13.5) * 1000)) / Math.max(0.5, rateMul);
}

export class NullProvider implements VoiceProvider {
  readonly name = 'null';
  private timers = new Set<number>();
  available(): boolean {
    return true;
  }
  speak(text: string, _profile: VoiceProfile, rateMul: number): SpeakHandle {
    let resolveFn: () => void = () => {};
    const done = new Promise<void>((res) => (resolveFn = res));
    const t = window.setTimeout(() => {
      this.timers.delete(t);
      resolveFn();
    }, estimateMs(text, rateMul));
    this.timers.add(t);
    return {
      done,
      cancel: () => {
        clearTimeout(t);
        this.timers.delete(t);
        resolveFn();
      },
    };
  }
  cancelAll(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }
}

export class WebSpeechProvider implements VoiceProvider {
  readonly name = 'webspeech';
  private voices: SpeechSynthesisVoice[] = [];
  private voiceCache = new Map<string, SpeechSynthesisVoice | null>();

  constructor() {
    if (this.available()) {
      const load = () => {
        this.voices = speechSynthesis.getVoices();
        this.voiceCache.clear();
      };
      load();
      speechSynthesis.addEventListener?.('voiceschanged', load);
    }
  }

  available(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  private pickVoice(profile: VoiceProfile): SpeechSynthesisVoice | null {
    const cached = this.voiceCache.get(profile.id);
    if (cached !== undefined) return cached;
    if (this.voices.length === 0) this.voices = speechSynthesis.getVoices();
    const vs = this.voices;
    let best: SpeechSynthesisVoice | null = null;
    let bestScore = -1;
    for (const v of vs) {
      let score = 0;
      if (!v.lang.toLowerCase().startsWith('en')) continue;
      if (profile.langPref && v.lang.toLowerCase().startsWith(profile.langPref.toLowerCase())) score += 4;
      if (profile.namePref) {
        for (const n of profile.namePref) {
          if (v.name.toLowerCase().includes(n.toLowerCase())) score += 6;
        }
      }
      if (v.localService) score += 1;
      if (v.default) score += 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = v;
      }
    }
    this.voiceCache.set(profile.id, best);
    return best;
  }

  speak(text: string, profile: VoiceProfile, rateMul: number, volume: number): SpeakHandle {
    let resolveFn: () => void = () => {};
    const done = new Promise<void>((res) => (resolveFn = res));
    let finished = false;
    let safety = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(safety);
      resolveFn();
    };
    try {
      const utt = new SpeechSynthesisUtterance(text);
      const v = this.pickVoice(profile);
      if (v) utt.voice = v;
      utt.lang = v?.lang ?? profile.langPref ?? 'en-GB';
      utt.rate = Math.max(0.5, Math.min(2, profile.rate * rateMul));
      utt.pitch = Math.max(0, Math.min(2, profile.pitch));
      utt.volume = Math.max(0, Math.min(1, (profile.volume ?? 1) * volume));
      utt.onend = finish;
      utt.onerror = finish;
      speechSynthesis.speak(utt);
      // Safety net: some browsers drop onend. Estimate + cushion.
      safety = window.setTimeout(finish, estimateMs(text, utt.rate) + 2500);
    } catch (e) {
      console.warn('[tts] speak failed, degrading to silence', e);
      safety = window.setTimeout(finish, estimateMs(text, rateMul));
    }
    return {
      done,
      cancel: () => {
        try {
          speechSynthesis.cancel();
        } catch {
          /* ignore */
        }
        finish();
      },
    };
  }

  cancelAll(): void {
    try {
      speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Premium TTS upgrade path (documented in AUTHORING.md §voices).
 * Only constructed when VITE_ELEVENLABS_KEY is present at build time;
 * any failure degrades to the fallback provider for that line.
 */
export class ElevenLabsProvider implements VoiceProvider {
  readonly name = 'elevenlabs';
  private fallback: VoiceProvider;
  constructor(
    private apiKey: string,
    fallback: VoiceProvider,
  ) {
    this.fallback = fallback;
  }
  available(): boolean {
    return !!this.apiKey;
  }
  speak(text: string, profile: VoiceProfile, rateMul: number, volume: number): SpeakHandle {
    if (!profile.elevenVoiceId || !audio.ready || !audio.ctx) {
      return this.fallback.speak(text, profile, rateMul, volume);
    }
    let cancelled = false;
    let src: AudioBufferSourceNode | null = null;
    let resolveFn: () => void = () => {};
    const done = new Promise<void>((res) => (resolveFn = res));
    const fallbackHandleRef: { h: SpeakHandle | null } = { h: null };
    fetch(`https://api.elevenlabs.io/v1/text-to-speech/${profile.elevenVoiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'eleven_turbo_v2' }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => audio.ctx!.decodeAudioData(buf))
      .then((decoded) => {
        if (cancelled) return resolveFn();
        src = audio.ctx!.createBufferSource();
        src.buffer = decoded;
        const g = audio.ctx!.createGain();
        g.gain.value = volume;
        src.connect(g);
        g.connect(audio.voiceBus);
        src.onended = () => resolveFn();
        src.start();
      })
      .catch(() => {
        if (cancelled) return resolveFn();
        const h = this.fallback.speak(text, profile, rateMul, volume);
        fallbackHandleRef.h = h;
        void h.done.then(resolveFn);
      });
    return {
      done,
      cancel: () => {
        cancelled = true;
        try {
          src?.stop();
        } catch {
          /* ignore */
        }
        fallbackHandleRef.h?.cancel();
        resolveFn();
      },
    };
  }
  cancelAll(): void {
    this.fallback.cancelAll();
  }
}

export function createVoiceProvider(): VoiceProvider {
  const web = new WebSpeechProvider();
  const base = web.available() ? web : new NullProvider();
  const key = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ELEVENLABS_KEY;
  if (key) return new ElevenLabsProvider(key, base);
  return base;
}
