'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CharacterToken } from '@/components/ui/CharacterToken';
import { publicConfig } from '@/lib/config';
import { getContentIndex } from '@/content';
import { PRICES } from '@/billing/pricing';

const LANGS = [['🇬🇧', 'English'], ['🇫🇷', 'Français'], ['🇩🇪', 'Deutsch'], ['🇮🇹', 'Italiano'], ['🇪🇸', 'Español']];

/** Public landing: the story first, then what parents need to decide. */
export default function Welcome() {
  const tracks = (['little', 'adventurer', 'hero'] as const).map((id) => getContentIndex().track(id));
  return (
    <div className="sky-night text-paper">
      <section className="paper-hills relative flex min-h-[78vh] flex-col items-center justify-center gap-6 overflow-hidden px-6 pb-24 text-center font-kid">
        <motion.div aria-hidden initial={{ y: -200, rotate: -40 }} animate={{ y: 0, rotate: 0 }} transition={{ type: 'spring', damping: 9, delay: 0.3 }}
          className="flex h-40 w-40 items-center justify-center rounded-full bg-lantern text-[6rem] shadow-glow">🗝️</motion.div>
        <h1 className="max-w-3xl text-kid-3xl font-black leading-none sm:text-[4rem]">A golden key fell into the garden.</h1>
        <p className="max-w-xl text-kid-lg text-paper/85">Your child follows it through twenty worlds — and learns a new language without noticing it’s a lesson.</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/auth/sign-up" className="rounded-blob bg-lantern px-8 py-4 text-kid-lg font-black text-night shadow-lantern active:translate-y-[4px] active:shadow-none">Start the adventure</Link>
          <Link href="/auth/sign-in" className="rounded-blob bg-night-500 px-8 py-4 text-kid-lg font-bold shadow-night active:translate-y-[4px] active:shadow-none">I have an account</Link>
        </div>
        <div className="mt-2 flex gap-3" aria-hidden>{(['lumi', 'zuzu', 'pico', 'nova', 'bibi'] as const).map((c, i) => (
          <motion.div key={c} animate={{ y: [0, -8, 0] }} transition={{ duration: 2.5, delay: i * 0.3, repeat: Infinity }}><CharacterToken id={c} size={60} /></motion.div>
        ))}</div>
      </section>
      <section className="grown-up px-6 py-16" aria-labelledby="tracks-title">
        <div className="mx-auto max-w-6xl">
          <h2 id="tracks-title" className="text-center text-3xl font-bold">A separate track for every age</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-ink-soft">Each track has its own stories, games, daily pace and skills. Move your child up any time — nothing is lost.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {tracks.map((t) => (
              <Link key={t.id} href={`/tracks#${t.id}`} className="flex flex-col rounded-tab border-2 border-ink/10 bg-white p-6 transition-transform hover:-translate-y-1">
                <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full text-4xl" style={{ background: `${t.color}40` }}>{t.emoji}</span>
                <span className="mt-3 text-sm font-bold text-ink-soft">Ages {t.ages.min}–{t.ages.max} · {t.dailyMinutes.min}–{t.dailyMinutes.max} min a day</span>
                <span className="text-2xl font-bold">{t.name.en}</span>
                <span className="mt-1 font-bold">{t.tagline.en}</span>
                <span className="mt-2 flex-1 text-ink-soft">{t.description.en}</span>
                <span className="mt-4 font-bold text-lagoon-dark">See the {t.name.en} track →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section id="parents" className="grown-up border-t border-ink/10 px-6 py-16">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="text-3xl font-bold">For parents: a real curriculum under the story</h2>
            <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-soft">
              Every adventure is built from a structured Pre-A1 → A2 curriculum. LingoWorld tracks how well your child recognises, hears,
              says, reads and remembers each word, brings back what they’re forgetting inside the story, and shows you what they learned in plain language.
            </p>
            <ul className="mt-6 space-y-3 text-lg">
              <li>Ten to twenty minutes of learning a day, then free play — learning has a healthy endpoint.</li>
              <li>Speaking is central: children’s words move characters and make Mimo dance.</li>
              <li>No ads, no chat with strangers, no loot boxes. Voice recordings are never stored.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-xl font-bold">Languages to learn</h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 text-lg">{LANGS.map(([f, n]) => <li key={n} className="flex items-center gap-2"><span aria-hidden>{f}</span>{n}</li>)}</ul>
            <h2 className="mt-8 text-xl font-bold">Plans</h2>
            <p className="mt-2 text-lg text-ink-soft">Start free. Premium from {PRICES.premium_monthly.EGP} EGP a month — pay by card, mobile wallet or Fawry. <Link href="/pricing" className="font-bold text-lagoon-dark underline">See pricing</Link></p>
            {publicConfig.dataMode === 'local' && <p className="mt-8 rounded-tab bg-paper-dark p-4 text-sm">This installation runs in device mode: accounts and progress are stored only in this browser.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
