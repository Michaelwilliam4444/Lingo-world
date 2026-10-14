'use client';
import { motion } from 'framer-motion';
import type { CharacterId } from '@/types/core';
import { cn } from '@/lib/cn';

export const CHARACTER_STYLE: Record<CharacterId | 'narrator', { emoji: string; ring: string; bg: string; name: string }> = {
  lumi: { emoji: '🦊', ring: 'ring-lantern', bg: 'bg-[#ffb36b]', name: 'Lumi' },
  zuzu: { emoji: '🐒', ring: 'ring-moss', bg: 'bg-[#b6e38f]', name: 'Zuzu' },
  pico: { emoji: '🦉', ring: 'ring-sky', bg: 'bg-[#a8d8ff]', name: 'Professor Pico' },
  nova: { emoji: '🐱', ring: 'ring-[#b388ff]', bg: 'bg-[#d6c2ff]', name: 'Nova' },
  bibi: { emoji: '🐦', ring: 'ring-berry', bg: 'bg-[#ffb3cd]', name: 'Bibi' },
  mimo: { emoji: '🥚', ring: 'ring-lantern', bg: 'bg-[#ffe39a]', name: 'Mimo' },
  narrator: { emoji: '📖', ring: 'ring-paper-edge', bg: 'bg-paper', name: '' },
};

/** Character medallion: emoji portrait on a cut-paper disc. Swap for illustrated art via media assets. */
export function CharacterToken({ id, size = 72, talking = false, emojiOverride, className }: { id: CharacterId | 'narrator'; size?: number; talking?: boolean; emojiOverride?: string; className?: string }) {
  const s = CHARACTER_STYLE[id];
  return (
    <motion.div
      aria-hidden
      animate={talking ? { y: [0, -6, 0], rotate: [0, -3, 3, 0] } : { y: 0 }}
      transition={talking ? { duration: 0.9, repeat: Infinity } : undefined}
      style={{ width: size, height: size, fontSize: size * 0.58 }}
      className={cn('flex shrink-0 items-center justify-center rounded-full ring-4 shadow-night', s.ring, s.bg, className)}
    >
      <span className="leading-none">{emojiOverride ?? s.emoji}</span>
    </motion.div>
  );
}

export function CharacterCard({ id, role }: { id: CharacterId; role: string }) {
  return (
    <div className="flex items-center gap-3 rounded-blob bg-paper p-3 text-ink shadow-paper">
      <CharacterToken id={id} size={56} />
      <div>
        <p className="font-kid text-kid-base font-bold">{CHARACTER_STYLE[id].name}</p>
        <p className="text-sm text-ink-soft">{role}</p>
      </div>
    </div>
  );
}
