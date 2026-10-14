import type { Metadata } from 'next';
import Link from 'next/link';
import { getContentIndex } from '@/content';
import type { NavItem, TrackDefinition } from '@/types/content';

export const metadata: Metadata = {
  title: 'Age tracks',
  description: 'Three separate learning tracks for ages 4–5, 6–8 and 9–11 — each with its own stories, games, pace and skills.',
};

const NAV_LABEL: Record<NavItem, string> = { adventure: '🗝️ Daily adventure', explore: '🗺️ World map', play: '🎲 Games', create: '🎨 Create', mimo: '🥚 Mimo', books: '📚 Books', music: '🎵 Songs' };

const FEATURE_ROWS: { key: keyof TrackDefinition['features']; label: string }[] = [
  { key: 'showTargetText', label: 'Sees written words' },
  { key: 'reading', label: 'Reading (books, clues)' },
  { key: 'writing', label: 'Writing (spelling, coded replies)' },
  { key: 'reviewSentences', label: 'Says whole review sentences' },
  { key: 'freeSpeechRoleplay', label: 'Free-speech role-play' },
  { key: 'storyCreator', label: 'Story creator' },
];

export default function TracksPage() {
  const content = getContentIndex();
  const tracks = (['little', 'adventurer', 'hero'] as const).map((id) => content.track(id));
  return (
    <main className="grown-up">
      <section className="bg-night px-4 py-14 text-center text-paper">
        <h1 className="font-kid text-kid-2xl font-black sm:text-kid-3xl">One world. Three separate tracks.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-paper/85">
          A four-year-old and a ten-year-old learn differently, so LingoWorld gives each age group its own syllabus, story seasons, games,
          daily pace and skills. We pick the track from your child’s age — you can move them up or down any time without losing progress.
        </p>
        <nav aria-label="Tracks" className="mt-8 flex flex-wrap justify-center gap-3">
          {tracks.map((t) => (
            <a key={t.id} href={`#${t.id}`} className="flex items-center gap-2 rounded-full bg-night-500 px-5 py-2.5 font-bold shadow-night hover:bg-night-400">
              <span aria-hidden>{t.emoji}</span>{t.name.en} · {t.ages.min}–{t.ages.max}
            </a>
          ))}
        </nav>
      </section>

      {tracks.map((t, i) => {
        const arcs = t.arcIds.map((id) => content.bundle.arcs.find((a) => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a);
        const games = t.gameTypes.map((g) => content.bundle.games.find((x) => x.type === g)).filter((g): g is NonNullable<typeof g> => !!g);
        const units = t.unitIds.length;
        const next = t.graduation.nextTrack ? content.track(t.graduation.nextTrack) : null;
        return (
          <section key={t.id} id={t.id} className={i % 2 ? 'bg-paper-dark/40' : 'bg-paper'} aria-labelledby={`${t.id}-title`}>
            <div className="mx-auto max-w-6xl px-4 py-14">
              <div className="flex flex-wrap items-center gap-4">
                <span aria-hidden className="flex h-20 w-20 items-center justify-center rounded-full text-5xl" style={{ background: `${t.color}40` }}>{t.emoji}</span>
                <div>
                  <p className="font-bold text-ink-soft">Ages {t.ages.min}–{t.ages.max}</p>
                  <h2 id={`${t.id}-title`} className="text-4xl font-bold">{t.name.en}</h2>
                  <p className="text-xl font-bold" style={{ color: t.id === 'little' ? '#a8740b' : t.id === 'adventurer' ? '#1b8c82' : '#a8285a' }}>{t.tagline.en}</p>
                </div>
              </div>
              <p className="mt-5 max-w-3xl text-lg leading-relaxed">{t.description.en}</p>

              <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Learning a day" value={`${t.dailyMinutes.min}–${t.dailyMinutes.max} min`} />
                <Stat label="New words a day" value={`about ${t.newItemsPerDay}`} />
                <Stat label="Curriculum units" value={`${units} · stages ${t.stages[0]}–${t.stages.at(-1)}`} />
                <Stat label="Games" value={`${games.length} game types`} />
              </dl>

              <div className="mt-10 grid gap-8 lg:grid-cols-3">
                <div>
                  <h3 className="text-xl font-bold">Story seasons</h3>
                  <ol className="mt-3 space-y-2">
                    {arcs.map((a, n) => (
                      <li key={a.id} className="rounded-tab bg-white p-3">
                        <b>{n === 0 ? '★ ' : ''}{a.title.en}</b>{a.premium && <span className="ms-2 rounded-full bg-lantern/40 px-2 text-xs font-bold">Premium</span>}
                        <span className="block text-sm text-ink-soft">{a.description.en}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h3 className="text-xl font-bold">What your child does</h3>
                  <table className="mt-3 w-full text-base">
                    <tbody>
                      {FEATURE_ROWS.map((f) => (
                        <tr key={f.key} className="border-b border-ink/10">
                          <td className="py-2">{f.label}</td>
                          <td className="py-2 text-end font-bold">{t.features[f.key] ? <span className="text-lagoon-dark">✓ Yes</span> : <span className="text-ink-faint">— Not yet</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <h3 className="mt-6 text-xl font-bold">Skills focus</h3>
                  <ul className="mt-2 flex flex-wrap gap-2">{t.skillsFocus.map((s) => <li key={s.en} className="rounded-full bg-white px-3 py-1 font-bold">{s.en}</li>)}</ul>
                  <h3 className="mt-6 text-xl font-bold">Their home screen</h3>
                  <p className="mt-2 text-ink-soft">{t.navigation.map((n) => NAV_LABEL[n]).join(' · ')}</p>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Games in this track</h3>
                  <ul className="mt-3 grid grid-cols-2 gap-2">
                    {games.map((g) => <li key={g.type} className="flex items-center gap-2 rounded-tab bg-white px-3 py-2 text-base"><span aria-hidden className="text-xl">{g.emoji}</span>{g.name.en}</li>)}
                  </ul>
                  <p className="mt-6 rounded-tab bg-white p-4 text-base">
                    🎓 {next ? <>After about <b>{t.graduation.wordsMastered} mastered words</b>, we suggest moving up to <a className="font-bold underline" href={`#${next.id}`}>{next.name.en}</a>. You decide.</>
                      : <>Heroes keep going up to A2-aligned level, with about <b>{t.graduation.wordsMastered}</b> words mastered.</>}
                  </p>
                </div>
              </div>
            </div>
          </section>
        );
      })}

      <section className="bg-night px-4 py-14 text-center text-paper">
        <h2 className="font-kid text-kid-2xl font-black">Not sure which track?</h2>
        <p className="mx-auto mt-3 max-w-xl text-lg text-paper/85">Start with the one for your child’s age. The Parent Zone shows how they’re doing and suggests when to move up.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Link href="/auth/sign-up" className="rounded-blob bg-lantern px-8 py-4 font-kid text-kid-lg font-black text-night shadow-lantern">Start free</Link>
          <Link href="/pricing" className="rounded-blob bg-night-500 px-8 py-4 font-kid text-kid-lg font-bold shadow-night">See pricing</Link>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-tab bg-white p-4">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="text-xl font-bold">{value}</dd>
    </div>
  );
}
