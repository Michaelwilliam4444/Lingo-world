'use client';
import { motion, type TargetAndTransition } from 'framer-motion';
import type { CompanionState } from '@/types/learner';
import { companionEngine } from '@/companions/CompanionEngine';

const EGG_COLORS: Record<string, string> = { gold: '#ffc94a', berry: '#ff9fbf', lagoon: '#a5f0e8', sky: '#a8d8ff', moss: '#b6e38f' };
export const EGG_CHOICES = Object.keys(EGG_COLORS);

export type MimoAction = 'idle' | 'jump' | 'dance' | 'sleep' | 'eat' | 'spin' | 'sit' | 'run' | 'fly' | 'clap' | 'sing' | 'happy' | 'hatch';

const ANIM: Record<MimoAction, TargetAndTransition> = {
  idle: { y: [0, -6, 0], transition: { duration: 2.4, repeat: Infinity } },
  jump: { y: [0, -70, 0, -30, 0], transition: { duration: 0.9 } },
  dance: { rotate: [0, -15, 15, -15, 15, 0], x: [0, -12, 12, -12, 12, 0], transition: { duration: 1.2 } },
  sleep: { rotate: [0, -8], scale: 0.92, opacity: 0.85, transition: { duration: 0.8 } },
  eat: { scale: [1, 1.15, 1, 1.15, 1], transition: { duration: 0.9 } },
  spin: { rotate: [0, 360], transition: { duration: 0.8 } },
  sit: { y: 14, scaleY: 0.85, transition: { duration: 0.4 } },
  run: { x: [0, 80, -80, 0], transition: { duration: 1.2 } },
  fly: { y: [0, -60, -50, -60, 0], transition: { duration: 1.6 } },
  clap: { scale: [1, 1.1, 1, 1.1, 1], transition: { duration: 0.7 } },
  sing: { rotate: [0, -6, 6, -6, 0], transition: { duration: 1.2 } },
  happy: { y: [0, -20, 0], scale: [1, 1.08, 1], transition: { duration: 0.6 } },
  hatch: { rotate: [0, -12, 12, -12, 12, 0], transition: { duration: 0.8, repeat: 2 } },
};

/** Mimo: the child's companion. Form follows stage + learning path; cosmetics float above. */
export function MimoFigure({ companion, size = 140, action = 'idle', cosmetics = [] }: { companion: CompanionState; size?: number; action?: MimoAction; cosmetics?: string[] }) {
  const form = companionEngine.form(companion);
  const egg = companion.stage === 'egg';
  const glow = EGG_COLORS[companion.eggColor] ?? '#ffc94a';
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div aria-hidden className="absolute inset-[12%] rounded-full blur-2xl" style={{ background: glow, opacity: egg ? 0.55 : 0.35 }} />
      <motion.div key={action} animate={ANIM[action]} className="relative select-none" style={{ fontSize: size * 0.62, lineHeight: 1 }} role="img" aria-label={`${companion.name}`}>
        {egg ? <span style={{ filter: `drop-shadow(0 0 12px ${glow})` }}>🥚</span> : form}
        {action === 'sleep' && <span className="absolute -top-2 end-0 text-[0.35em]">💤</span>}
        {action === 'sing' && <span className="absolute -top-2 end-0 text-[0.35em]">🎵</span>}
        {action === 'eat' && <span className="absolute bottom-0 -end-4 text-[0.35em]">🍎</span>}
      </motion.div>
      {cosmetics.length > 0 && (
        <div aria-hidden className="absolute -top-1 flex gap-1" style={{ fontSize: size * 0.2 }}>{cosmetics.map((c) => <span key={c}>{c}</span>)}</div>
      )}
    </div>
  );
}
