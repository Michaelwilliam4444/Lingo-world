'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp, errorMessage } from '@/store/app';
import { getServices } from '@/services';
import { Button } from '@/components/ui/Button';
import { translate } from '@/i18n';
import { LOCALE_NAMES } from '@/i18n';
import { INTERFACE_LOCALES, type InterfaceLocale } from '@/types/core';
import { publicConfig } from '@/lib/config';

const field = 'mt-1 w-full rounded-tab border-2 border-ink/20 bg-white px-4 py-3 text-lg focus:border-lagoon-dark';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();
  const { signIn, signUp } = useApp();
  const [locale, setLocale] = useState<InterfaceLocale>('en');
  const t = (k: Parameters<typeof translate>[1]) => translate(locale, k);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      if (mode === 'sign-up') {
        if (!consent) throw new Error(t('auth.consent'));
        await signUp(email, password, name, locale);
        router.replace('/parent/children/new');
      } else {
        await signIn(email, password);
        router.replace('/');
      }
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  const oauth = async (p: 'google' | 'apple') => {
    try { await getServices().repo.signInWithOAuth(p); } catch (err) { setError(errorMessage(err)); }
  };

  return (
    <div className="grown-up flex min-h-dvh items-center justify-center px-6 py-10" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <form onSubmit={submit} className="w-full max-w-md">
        <Link href="/welcome" className="text-2xl font-bold">🗝️ LingoWorld</Link>
        <h1 className="mt-6 text-3xl font-bold">{mode === 'sign-in' ? t('auth.signIn') : t('auth.signUp')}</h1>
        <label className="mt-4 block text-sm font-bold text-ink-soft">
          Language / اللغة
          <select value={locale} onChange={(e) => setLocale(e.target.value as InterfaceLocale)} className={field}>
            {INTERFACE_LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
          </select>
        </label>
        {mode === 'sign-up' && (
          <label className="mt-4 block font-bold">{t('auth.name')}
            <input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" className={field} maxLength={40} />
          </label>
        )}
        <label className="mt-4 block font-bold">{t('auth.email')}
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={field} />
        </label>
        <label className="mt-4 block font-bold">{t('auth.password')}
          <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} className={field} />
        </label>
        {mode === 'sign-up' && (
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5" />
            <span>{t('auth.consent')} <Link href="/legal/terms" target="_blank" className="underline">Terms</Link> · <Link href="/legal/privacy" target="_blank" className="underline">Privacy</Link></span>
          </label>
        )}
        {error && <p role="alert" className="mt-4 rounded-tab bg-berry/10 p-3 text-berry-dark">{error}</p>}
        <Button type="submit" variant="parent" className="mt-6 h-12 w-full" disabled={busy}>{mode === 'sign-in' ? t('auth.signIn') : t('auth.signUp')}</Button>
        {publicConfig.dataMode === 'supabase' && (
          <div className="mt-4 grid gap-2">
            <Button variant="parent-quiet" className="h-12" onClick={() => void oauth('google')}>{t('auth.google')}</Button>
            <Button variant="parent-quiet" className="h-12" onClick={() => void oauth('apple')}>{t('auth.apple')}</Button>
          </div>
        )}
        {publicConfig.dataMode === 'local' && <p className="mt-4 text-sm text-ink-soft">{t('auth.deviceMode')}</p>}
        <p className="mt-6 text-center">
          {mode === 'sign-in'
            ? <>{t('auth.noAccount')} <Link className="font-bold underline" href="/auth/sign-up">{t('auth.signUp')}</Link></>
            : <>{t('auth.haveAccount')} <Link className="font-bold underline" href="/auth/sign-in">{t('auth.signIn')}</Link></>}
        </p>
      </form>
    </div>
  );
}
