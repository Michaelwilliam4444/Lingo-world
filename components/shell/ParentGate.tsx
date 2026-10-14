'use client';
import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useT } from '@/hooks/useT';
import { useApp } from '@/store/app';

/**
 * Parent gate: a multiplication a young child can't guess, typed (not tapped from choices).
 * Unlocks the Parent Zone for 15 minutes in this tab only.
 */
export function ParentGate({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useT('parent');
  const unlock = useApp((s) => s.unlockParent);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1000));
  const { a, b } = useMemo(() => ({ a: 6 + (seed % 7), b: 3 + ((seed >> 3) % 7) }), [seed]);
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (Number(answer) === a * b) { unlock(15); onUnlock(); return; }
    setWrong(true); setAnswer(''); setSeed((s) => s + 17);
  };

  return (
    <div className="grown-up flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <h1 className="text-3xl font-bold">{t('gate.title')}</h1>
        <p className="mt-2 text-ink-soft">{t('gate.hint')}</p>
        <label className="mt-8 block text-xl font-bold" htmlFor="gate-answer">{t('gate.question', { a, b })}</label>
        <input id="gate-answer" inputMode="numeric" autoComplete="off" value={answer} onChange={(e) => setAnswer(e.target.value.replace(/\D/g, '').slice(0, 3))}
          className="mt-3 w-full rounded-tab border-2 border-ink/20 bg-white px-4 py-3 text-2xl tabular-nums focus:border-lagoon-dark" />
        {wrong && <p role="alert" className="mt-2 text-berry-dark">{t('gate.wrong')}</p>}
        <Button type="submit" variant="parent" className="mt-5 h-12 w-full">{t('gate.enter')}</Button>
        <Link href="/play" className="mt-6 block text-center font-bold text-ink-soft underline">{t('gate.back')}</Link>
      </form>
    </div>
  );
}
