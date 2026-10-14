import type { CharacterId, LearningLanguage } from '@/types/core';

export interface SpeakOptions {
  language: LearningLanguage | 'ui';
  uiLocale?: string;
  rate?: number;           // 1 = normal; 0.7 = slow
  pitch?: number;
  character?: CharacterId | 'narrator';
  syllables?: string[];    // speak syllable by syllable with short pauses
  onBoundary?: (charIndex: number) => void; // word highlighting
}

/** Text-to-speech provider interface. Human recordings (AudioService) take precedence when available. */
export interface TextToSpeechService {
  readonly id: string;
  available(): boolean;
  speak(text: string, opts: SpeakOptions): Promise<void>;
  cancel(): void;
}

export const TTS_LOCALES: Record<LearningLanguage, string[]> = {
  en: ['en-GB', 'en-US', 'en-AU', 'en'],
  fr: ['fr-FR', 'fr-CA', 'fr'],
  de: ['de-DE', 'de-AT', 'de'],
  it: ['it-IT', 'it'],
  es: ['es-ES', 'es-MX', 'es-US', 'es'],
};

const CHARACTER_VOICE: Record<CharacterId | 'narrator', { pitch: number; rate: number }> = {
  lumi: { pitch: 1.15, rate: 0.95 }, zuzu: { pitch: 1.4, rate: 1.05 }, pico: { pitch: 0.85, rate: 0.9 },
  nova: { pitch: 1.05, rate: 0.95 }, bibi: { pitch: 1.3, rate: 1.0 }, mimo: { pitch: 1.6, rate: 1.0 }, narrator: { pitch: 1, rate: 0.95 },
};

export class BrowserTTS implements TextToSpeechService {
  readonly id = 'browser';
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (this.available()) {
      this.voices = window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener?.('voiceschanged', () => { this.voices = window.speechSynthesis.getVoices(); });
    }
  }

  available(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  private pickVoice(locales: string[]): SpeechSynthesisVoice | undefined {
    if (!this.voices.length && this.available()) this.voices = window.speechSynthesis.getVoices();
    for (const loc of locales) {
      const exact = this.voices.filter((v) => v.lang.replace('_', '-').toLowerCase() === loc.toLowerCase());
      // Prefer natural/enhanced voices when the platform offers them.
      const best = exact.find((v) => /natural|enhanced|premium|neural/i.test(v.name)) ?? exact.find((v) => v.localService) ?? exact[0];
      if (best) return best;
      const prefix = this.voices.find((v) => v.lang.toLowerCase().startsWith(loc.slice(0, 2).toLowerCase()));
      if (prefix && loc.length === 2) return prefix;
    }
    return undefined;
  }

  private utter(text: string, opts: SpeakOptions): Promise<void> {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      const locales = opts.language === 'ui' ? [opts.uiLocale ?? 'en'] : TTS_LOCALES[opts.language];
      const voice = this.pickVoice(locales);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? locales[0]!;
      const cv = CHARACTER_VOICE[opts.character ?? 'narrator'];
      u.pitch = opts.pitch ?? cv.pitch;
      u.rate = (opts.rate ?? 1) * cv.rate;
      u.onboundary = (e) => opts.onBoundary?.(e.charIndex);
      u.onend = () => resolve();
      u.onerror = () => resolve();
      // Safety timeout: some browsers never fire onend.
      setTimeout(resolve, Math.max(2500, text.length * 140 / (u.rate || 1)));
      window.speechSynthesis.speak(u);
    });
  }

  async speak(text: string, opts: SpeakOptions): Promise<void> {
    if (!this.available() || !text.trim()) return;
    window.speechSynthesis.cancel();
    if (opts.syllables && opts.syllables.length > 1) {
      for (const syl of opts.syllables) {
        await this.utter(syl, { ...opts, rate: 0.7 });
        await new Promise((r) => setTimeout(r, 180));
      }
      return;
    }
    await this.utter(text, opts);
  }

  cancel() {
    if (this.available()) window.speechSynthesis.cancel();
  }
}

/** Used in tests, SSR and when audio is disabled by a parent. */
export class SilentTTS implements TextToSpeechService {
  readonly id = 'silent';
  available() { return true; }
  async speak() { /* no-op */ }
  cancel() { /* no-op */ }
}
