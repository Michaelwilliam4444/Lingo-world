'use client';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ResolvedLine } from '@/types/engine';
import { CharacterToken, CHARACTER_STYLE } from './CharacterToken';
import { IconButton } from './Button';
import { SnailIcon, SpeakerIcon } from './icons';
import { useAudio } from '@/hooks/useAudio';
import { cn } from '@/lib/cn';

/**
 * A character speaks: narration in the interface language (voiced for pre-readers),
 * then the target-language line in a lantern-lit bubble that can be replayed normally or slowly.
 */
export function DialogueBox({ line, autoVoice, mimoEmoji, listenLabel, slowLabel }: { line: ResolvedLine; autoVoice: boolean; mimoEmoji?: string; listenLabel: string; slowLabel: string }) {
  const audio = useAudio();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (autoVoice && line.text) await audio.narrate(line.text, line.speaker);
      if (!cancelled && line.target) await audio.target(line.target.text, { character: line.speaker === 'narrator' ? 'lumi' : line.speaker });
    })();
    return () => { cancelled = true; audio.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line]);

  const name = CHARACTER_STYLE[line.speaker].name;
  return (
    <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex w-full max-w-2xl items-end gap-3" aria-live="polite">
      {line.speaker !== 'narrator' && <CharacterToken id={line.speaker} size={76} talking emojiOverride={line.speaker === 'mimo' ? mimoEmoji : undefined} />}
      <div className={cn('relative flex-1 rounded-blob bg-paper p-4 text-ink shadow-paper sm:p-5', line.speaker === 'narrator' && 'bg-night-600 text-paper shadow-night')}>
        {name && <p className="mb-1 font-kid text-sm font-bold text-ink-soft">{name}</p>}
        <p className="font-kid text-kid-base leading-snug">{line.text}</p>
        {line.target && (
          <div className="mt-3 flex items-center gap-3 rounded-token bg-lantern px-4 py-3 text-night shadow-lantern">
            <p lang="target" className="flex-1 font-kid text-kid-lg font-black">{line.target.text}</p>
            <IconButton label={listenLabel} tone="paper" size={48} onClick={() => void audio.target(line.target!.text)}><SpeakerIcon /></IconButton>
            <IconButton label={slowLabel} tone="paper" size={48} onClick={() => void audio.target(line.target!.text, { slow: true })}><SnailIcon /></IconButton>
          </div>
        )}
      </div>
    </motion.div>
  );
}
