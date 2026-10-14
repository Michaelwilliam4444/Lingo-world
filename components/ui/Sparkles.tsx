'use client';
import { motion } from 'framer-motion';

/** One-shot celebratory burst. Rendered only on success moments; respects reduced motion via CSS. */
export function Sparkles({ show, glyphs = ['✨', '⭐', '💛', '🌟'] }: { show: boolean; glyphs?: string[] }) {
  if (!show) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 text-2xl"
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
            animate={{ x: Math.cos(angle) * 140, y: Math.sin(angle) * 110, opacity: 0, scale: 1.3 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          >
            {glyphs[i % glyphs.length]}
          </motion.span>
        );
      })}
    </div>
  );
}
