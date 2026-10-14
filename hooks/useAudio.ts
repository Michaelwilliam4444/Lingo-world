'use client';
import { useCallback } from 'react';
import type { CharacterId } from '@/types/core';
import type { PresentedItem } from '@/types/engine';
import { getServices } from '@/services';
import type { Sfx } from '@/speech/audio';
import { useApp } from '@/store/app';

/** Speak target-language items, interface-language narration, and play sound effects. */
export function useAudio() {
  const lang = useApp((s) => s.childState?.child.targetLanguage ?? 'en');
  const uiLocale = useApp((s) => s.childState?.child.interfaceLocale ?? 'en');
  const target = useCallback((text: string, opts: { slow?: boolean; syllables?: string[]; character?: CharacterId | 'narrator' } = {}) =>
    getServices().audio.sayTarget(text, lang, { slow: opts.slow, syllables: opts.syllables, character: opts.character ?? 'lumi' }), [lang]);
  const item = useCallback((it: PresentedItem, mode: 'normal' | 'slow' | 'syllables' = 'normal') =>
    getServices().audio.sayTarget(it.text, lang, { slow: mode === 'slow', syllables: mode === 'syllables' ? it.syllables : undefined }), [lang]);
  const narrate = useCallback((text: string, character: CharacterId | 'narrator' = 'narrator') =>
    getServices().audio.say(text, { language: 'ui', uiLocale, character }), [uiLocale]);
  const sfx = useCallback((k: Sfx) => getServices().audio.sfx(k), []);
  const stop = useCallback(() => getServices().audio.stop(), []);
  return { target, item, narrate, sfx, stop, lang };
}
