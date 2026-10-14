'use client';
import { cn } from '@/lib/cn';
import { MicIcon, StarIcon } from './icons';

/** The big "tap and talk" button. Pulses while listening. In self-report mode it becomes a star. */
export function SpeechButton({ listening, onPress, label, mode = 'voice', disabled }: { listening: boolean; onPress: () => void; label: string; mode?: 'voice' | 'self-report'; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
      aria-pressed={listening}
      className={cn('relative flex h-28 w-28 items-center justify-center rounded-full font-kid transition-transform active:translate-y-[4px] disabled:opacity-50',
        mode === 'voice' ? 'bg-berry text-paper shadow-berry' : 'bg-lantern text-night shadow-lantern')}
    >
      {listening && <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full bg-berry" />}
      {listening && <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full bg-berry [animation-delay:0.8s]" />}
      {mode === 'voice' ? <MicIcon width={52} height={52} /> : <StarIcon width={52} height={52} />}
    </button>
  );
}
