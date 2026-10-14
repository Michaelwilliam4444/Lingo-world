import type { LearningLanguage } from '@/types/core';
import type { TextToSpeechService, SpeakOptions } from './tts';
import { publicConfig } from '@/lib/config';

/**
 * AudioPlaybackService — plays target-language audio.
 * Order of preference: human recording (media asset, cached with the Cache API) → TTS.
 * Also synthesises short UI sound effects with WebAudio so no third-party audio files are needed.
 */
export type Sfx = 'tap' | 'correct' | 'gentle' | 'sparkle' | 'pop' | 'levelup' | 'whoosh' | 'drum' | 'egg-crack';

const AUDIO_CACHE = 'lingoworld-audio-v1';

export class AudioService {
  private ctx: AudioContext | null = null;
  private current: HTMLAudioElement | null = null;
  enabled = true;
  sfxVolume = 0.5;

  constructor(private readonly tts: TextToSpeechService) {}

  private resolveUrl(asset: string): string {
    if (/^https?:\/\//.test(asset)) return asset;
    return `${publicConfig.mediaBaseUrl.replace(/\/$/, '')}/${asset.replace(/^asset:/, '')}`;
  }

  async say(text: string, opts: SpeakOptions & { asset?: string; slowAsset?: string; slow?: boolean }): Promise<void> {
    if (!this.enabled) return;
    const asset = opts.slow ? opts.slowAsset ?? opts.asset : opts.asset;
    if (asset && publicConfig.mediaBaseUrl) {
      try { await this.playUrl(this.resolveUrl(asset), opts.slow && !opts.slowAsset ? 0.75 : 1); return; } catch { /* fall back to TTS */ }
    }
    await this.tts.speak(text, { ...opts, rate: opts.slow ? 0.7 : opts.rate });
  }

  sayTarget(text: string, language: LearningLanguage, options: Partial<SpeakOptions> & { slow?: boolean; asset?: string } = {}) {
    return this.say(text, { language, ...options });
  }

  stop() {
    this.tts.cancel();
    this.current?.pause();
  }

  private async playUrl(url: string, rate = 1): Promise<void> {
    const src = await this.cachedObjectUrl(url);
    await new Promise<void>((resolve, reject) => {
      this.current?.pause();
      const a = new Audio(src);
      a.playbackRate = rate;
      this.current = a;
      a.onended = () => resolve();
      a.onerror = () => reject(new Error('audio error'));
      void a.play().catch(reject);
    });
  }

  private async cachedObjectUrl(url: string): Promise<string> {
    if (typeof caches === 'undefined') return url;
    const cache = await caches.open(AUDIO_CACHE);
    let res = await cache.match(url);
    if (!res) {
      res = await fetch(url);
      if (res.ok) await cache.put(url, res.clone());
    }
    return URL.createObjectURL(await res.blob());
  }

  /** Pre-download recordings for offline use. */
  async precache(urls: string[]): Promise<number> {
    if (typeof caches === 'undefined') return 0;
    const cache = await caches.open(AUDIO_CACHE);
    let n = 0;
    for (const u of urls) {
      const url = this.resolveUrl(u);
      if (await cache.match(url)) continue;
      try { const res = await fetch(url); if (res.ok) { await cache.put(url, res); n++; } } catch { /* skip */ }
    }
    return n;
  }

  sfx(kind: Sfx) {
    if (!this.enabled || typeof window === 'undefined') return;
    try {
      this.ctx ??= new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const tone = (freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.3) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, now + start);
        g.gain.setValueAtTime(0, now + start);
        g.gain.linearRampToValueAtTime(vol * this.sfxVolume, now + start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
        o.connect(g).connect(ctx.destination); o.start(now + start); o.stop(now + start + dur + 0.05);
      };
      switch (kind) {
        case 'tap': tone(660, 0, 0.08, 'triangle', 0.2); break;
        case 'correct': tone(784, 0, 0.12); tone(1046, 0.1, 0.2); break;
        case 'gentle': tone(392, 0, 0.18, 'sine', 0.2); tone(440, 0.12, 0.2, 'sine', 0.15); break;
        case 'sparkle': [1318, 1568, 1760, 2093].forEach((f, i) => tone(f, i * 0.06, 0.18, 'triangle', 0.15)); break;
        case 'pop': tone(900, 0, 0.06, 'square', 0.12); tone(400, 0.04, 0.08, 'sine', 0.2); break;
        case 'levelup': [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.09, 0.25, 'triangle', 0.22)); break;
        case 'whoosh': tone(200, 0, 0.3, 'sawtooth', 0.05); tone(800, 0.05, 0.25, 'sine', 0.08); break;
        case 'drum': tone(110, 0, 0.12, 'sine', 0.5); break;
        case 'egg-crack': tone(1200, 0, 0.04, 'square', 0.1); tone(700, 0.07, 0.05, 'square', 0.1); tone(1500, 0.15, 0.04, 'square', 0.1); break;
      }
    } catch { /* audio not available */ }
  }
}
