import Link from 'next/link';
import type { ReactNode } from 'react';
import { LEGAL_LINKS, SITE, SITE_LINKS } from '@/lib/site';

/** Public website header — server-rendered, works without JavaScript (mobile menu is a <details>). */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-night/95 text-paper backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/welcome" className="flex items-center gap-2 font-kid text-xl font-black">
          <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-lantern text-xl">🗝️</span>{SITE.brand}
        </Link>
        <nav aria-label="Site" className="ms-auto hidden items-center gap-5 font-bold md:flex">
          {SITE_LINKS.map((l) => <Link key={l.href} href={l.href} className="text-paper/85 hover:text-lantern">{l.label}</Link>)}
          <Link href="/auth/sign-in" className="text-paper/85 hover:text-lantern">Sign in</Link>
          <Link href="/auth/sign-up" className="rounded-full bg-lantern px-4 py-2 text-night shadow-lantern active:translate-y-[3px] active:shadow-none">Start free</Link>
        </nav>
        <details className="relative ms-auto md:hidden">
          <summary className="cursor-pointer list-none rounded-full bg-night-500 px-4 py-2 font-bold" aria-label="Menu">☰ Menu</summary>
          <nav aria-label="Site (mobile)" className="absolute end-0 mt-2 flex w-56 flex-col gap-1 rounded-tab bg-night-600 p-3 font-bold shadow-night">
            {SITE_LINKS.map((l) => <Link key={l.href} href={l.href} className="rounded-tab px-3 py-2 hover:bg-night-500">{l.label}</Link>)}
            <Link href="/auth/sign-in" className="rounded-tab px-3 py-2 hover:bg-night-500">Sign in</Link>
            <Link href="/auth/sign-up" className="mt-1 rounded-full bg-lantern px-3 py-2 text-center text-night">Start free</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}

const PAY_BADGES = ['Visa', 'Mastercard', 'Meeza', 'Vodafone Cash', 'Orange Cash', 'Etisalat Cash', 'Fawry', 'Aman'];

export function SiteFooter() {
  return (
    <footer className="grown-up border-t-4 border-paper-edge bg-paper-dark/60 text-ink">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="flex items-center gap-2 font-kid text-xl font-black"><span aria-hidden>🗝️</span>{SITE.brand}</p>
          <p className="mt-2 text-sm text-ink-soft">{SITE.tagline}. A story-driven language adventure for children aged 4–11.</p>
        </div>
        <FooterCol title="Product">
          {SITE_LINKS.filter((l) => l.href !== '/contact').map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          <Link href="/auth/sign-up">Create a family account</Link>
        </FooterCol>
        <FooterCol title="Legal">
          {LEGAL_LINKS.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
        </FooterCol>
        <FooterCol title="Contact">
          <span>{SITE.company.value}</span>
          <span>{SITE.address.value}</span>
          <a href={`mailto:${SITE.email.value}`}>{SITE.email.value}</a>
          <span dir="ltr">{SITE.phone.value}</span>
          <Link href="/contact">Contact page</Link>
        </FooterCol>
      </div>
      <div className="border-t border-ink/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {SITE.company.value} · CR {SITE.commercialRegister.value} · Tax ID {SITE.taxId.value}. Prices in EGP include applicable taxes.</p>
          <p className="flex flex-wrap gap-1.5" aria-label="Accepted payment methods">
            <span className="me-1">Secure payments by Paymob:</span>
            {PAY_BADGES.map((b) => <span key={b} className="rounded border border-ink/15 bg-white px-1.5 py-0.5 font-bold text-ink">{b}</span>)}
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="font-bold">{title}</h2>
      <div className="mt-2 flex flex-col gap-1.5 text-sm text-ink-soft [&_a:hover]:text-ink [&_a]:underline-offset-2 [&_a:hover]:underline">{children}</div>
    </div>
  );
}

/** Layout for text pages (legal, contact). */
export function SitePage({ title, intro, children, updated }: { title: string; intro?: ReactNode; children: ReactNode; updated?: string }) {
  return (
    <main className="grown-up min-h-[60vh] px-4 py-12">
      <article className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold">{title}</h1>
        {updated && <p className="mt-2 text-sm text-ink-soft">Last updated: {updated}</p>}
        {intro && <div className="mt-4 text-lg text-ink-soft">{intro}</div>}
        <div className="prose-site mt-8">{children}</div>
      </article>
    </main>
  );
}
