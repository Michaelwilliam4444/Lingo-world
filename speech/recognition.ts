import type { LearningLanguage } from '@/types/core';
import { TTS_LOCALES } from './tts';

export interface RecognitionResult {
  transcript: string;
  alternatives: string[];
  confidence: number;      // 0..1 (recognizer's own confidence)
  durationMs: number;
}

export interface RecognitionOptions {
  language: LearningLanguage;
  /** Expected phrases — passed to providers that support phrase hints/grammars */
  expected: string[];
  maxSeconds?: number;
  signal?: AbortSignal;
}

export type RecognitionErrorCode = 'not-supported' | 'permission-denied' | 'no-speech' | 'aborted' | 'network' | 'unknown';
export class RecognitionError extends Error {
  constructor(readonly code: RecognitionErrorCode) { super(code); }
}

/**
 * Speech recognition provider interface. Audio is processed by the provider and discarded;
 * LingoWorld persists only the transcript + score (see CHILD_PRIVACY.md).
 */
export interface SpeechRecognitionService {
  readonly id: string;
  available(): boolean;
  listen(opts: RecognitionOptions): Promise<RecognitionResult>;
  stop(): void;
}

type WebSpeechRecognition = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getCtor(): (new () => WebSpeechRecognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => WebSpeechRecognition) | null;
}

/** Web Speech API (Chrome, Edge, Safari 14.1+, Android WebView). */
export class BrowserSpeechRecognition implements SpeechRecognitionService {
  readonly id = 'browser';
  private current: WebSpeechRecognition | null = null;

  available(): boolean {
    return !!getCtor();
  }

  listen(opts: RecognitionOptions): Promise<RecognitionResult> {
    const Ctor = getCtor();
    if (!Ctor) return Promise.reject(new RecognitionError('not-supported'));
    return new Promise((resolve, reject) => {
      const rec = new Ctor();
      this.current = rec;
      const started = Date.now();
      rec.lang = TTS_LOCALES[opts.language][0]!;
      rec.continuous = false;
      rec.interimResults = false;
      rec.maxAlternatives = 5;
      let settled = false;
      const done = (fn: () => void) => { if (!settled) { settled = true; clearTimeout(timer); fn(); } };
      const timer = setTimeout(() => { rec.stop(); }, (opts.maxSeconds ?? 6) * 1000);
      opts.signal?.addEventListener('abort', () => { rec.abort(); done(() => reject(new RecognitionError('aborted'))); });
      rec.onresult = (e) => {
        const first = e.results[0];
        if (!first) return;
        const alts = Array.from({ length: first.length }, (_, i) => first[i]!);
        done(() => resolve({ transcript: alts[0]?.transcript ?? '', alternatives: alts.map((a) => a.transcript), confidence: alts[0]?.confidence ?? 0, durationMs: Date.now() - started }));
      };
      rec.onerror = (e) => {
        const map: Record<string, RecognitionErrorCode> = { 'not-allowed': 'permission-denied', 'service-not-allowed': 'permission-denied', 'no-speech': 'no-speech', aborted: 'aborted', network: 'network' };
        done(() => reject(new RecognitionError(map[e.error] ?? 'unknown')));
      };
      rec.onend = () => done(() => reject(new RecognitionError('no-speech')));
      try { rec.start(); } catch { done(() => reject(new RecognitionError('unknown'))); }
    });
  }

  stop() { this.current?.stop(); }
}

/**
 * Mock recognizer: used in tests, CI, devices without recognition, and when a parent disables
 * the microphone. The UI then offers "tap-to-say" — the child taps the phrase after saying it aloud,
 * which still counts as a speaking attempt but with neutral pronunciation evidence.
 */
export class MockSpeechRecognition implements SpeechRecognitionService {
  readonly id = 'mock';
  constructor(private readonly behaviour: 'echo-expected' | 'silence' = 'echo-expected') {}
  available() { return true; }
  async listen(opts: RecognitionOptions): Promise<RecognitionResult> {
    await new Promise((r) => setTimeout(r, 400));
    if (this.behaviour === 'silence') throw new RecognitionError('no-speech');
    const t = opts.expected[0] ?? '';
    return { transcript: t, alternatives: [t], confidence: 0.9, durationMs: 400 };
  }
  stop() { /* no-op */ }
}
