'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PresentedItem } from '@/types/engine';
import { getServices } from '@/services';
import { RecognitionError } from '@/speech/recognition';
import type { PronunciationResult } from '@/speech/pronunciation';
import { useApp } from '@/store/app';

export type SpeechMode = 'voice' | 'self-report';

/**
 * If the recognizer is unusable on this device (blocked mic, no engine, offline cloud recognizer),
 * switch every speaking activity to self-report for the rest of the session so a child is never stuck.
 */
let voiceUnavailable = false;
const listeners = new Set<() => void>();
function markVoiceUnavailable() {
  if (voiceUnavailable) return;
  voiceUnavailable = true;
  listeners.forEach((l) => l());
}
export type SpeechStatus = 'idle' | 'listening' | 'scoring' | 'done' | 'error';

/**
 * One speaking attempt. Uses the microphone only when the parent consented AND the child's
 * profile allows voice; otherwise "self-report" mode (say it aloud, tap the star).
 */
export function useSpeechAttempt() {
  const parentConsent = useApp((s) => s.parent?.consents.voiceProcessing ?? false);
  const childVoice = useApp((s) => s.childState?.child.settings.voiceEnabled ?? false);
  const mic = useApp((s) => s.micAvailable);
  const ageBand = useApp((s) => s.childState?.child.ageBand ?? 'adventurer');
  const language = useApp((s) => s.childState?.child.targetLanguage ?? 'en');
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [error, setError] = useState<RecognitionError['code'] | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [broken, setBroken] = useState(voiceUnavailable);
  useEffect(() => { const l = () => setBroken(true); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  const mode: SpeechMode = parentConsent && childVoice && mic && !broken ? 'voice' : 'self-report';

  const listen = useCallback(async (expected: PresentedItem): Promise<PronunciationResult | null> => {
    const s = getServices();
    setError(null); setResult(null);
    if (mode === 'self-report') {
      // Neutral evidence: a speaking attempt without a measured pronunciation score.
      const r: PronunciationResult = { score: 70, accepted: true, level: 'good', matched: expected.text, missingWords: [], focusSounds: [] };
      setResult(r); setStatus('done');
      return r;
    }
    abort.current = new AbortController();
    setStatus('listening');
    try {
      const rec = await s.recognition.listen({ language, expected: [expected.text, ...expected.variants], maxSeconds: ageBand === 'little' ? 5 : 7, signal: abort.current.signal });
      setStatus('scoring');
      const r = await s.scorer.score({ expected: expected.text, variants: expected.variants, recognition: rec, language, ageBand });
      setResult(r); setStatus('done');
      return r;
    } catch (e) {
      const code = e instanceof RecognitionError ? e.code : 'unknown';
      if (code === 'not-supported' || code === 'permission-denied' || code === 'network') markVoiceUnavailable();
      setError(code); setStatus(code === 'no-speech' ? 'idle' : 'error');
      return null;
    }
  }, [mode, language, ageBand]);

  const cancel = useCallback(() => { abort.current?.abort(); setStatus('idle'); }, []);
  const reset = useCallback(() => { setStatus('idle'); setResult(null); setError(null); }, []);
  return { listen, cancel, reset, status, result, error, mode };
}
