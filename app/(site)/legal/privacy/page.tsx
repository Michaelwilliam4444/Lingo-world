import type { Metadata } from 'next';
import Link from 'next/link';
import { SitePage } from '@/components/site/SiteChrome';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'Privacy Policy' };

/** Template aligned with docs/CHILD_PRIVACY.md — review with counsel (Egypt PDPL 151/2020, GDPR, COPPA as applicable). */
export default function Privacy() {
  const c = SITE.company.value;
  return (
    <SitePage title="Privacy Policy" updated={SITE.legalUpdated}
      intro={<>{SITE.brand} is built for children, so we collect as little as possible. {c} is the data controller.</>}>
      <h2>What we collect</h2>
      <table>
        <thead><tr><th>About</th><th>Data</th><th>Why</th></tr></thead>
        <tbody>
          <tr><td>Parent</td><td>Name, email, password (hashed), language, consent choices</td><td>Your account, receipts, weekly reports</td></tr>
          <tr><td>Child</td><td>Nickname, age, languages, interests, avatar, learning progress</td><td>To personalise the curriculum and story</td></tr>
          <tr><td>Voice</td><td>Processed to score a spoken word, then discarded. We keep only the transcript and score.</td><td>Speaking practice</td></tr>
          <tr><td>Payments</td><td>Plan, amount, date, payment method type, mobile number given at checkout. Card numbers are handled by Paymob and never reach us.</td><td>Billing, refunds, fraud prevention</td></tr>
          <tr><td>Usage</td><td>Pseudonymous learning events (no names)</td><td>Improving the curriculum</td></tr>
        </tbody>
      </table>
      <p>We never ask for a child’s surname, birthday, school, photo or location. There are no ads, no third-party advertising trackers, and no chat with strangers.</p>
      <h2>Who processes data for us</h2>
      <ul>
        <li><b>Supabase</b> — database and authentication (hosting region stated in our records of processing).</li>
        <li><b>Vercel</b> — website hosting.</li>
        <li><b>Paymob</b> — payment processing in Egypt.</li>
        <li><b>Email provider</b> — sending receipts and weekly reports (if enabled).</li>
        <li><b>AI provider</b> — only if story variation is enabled; receives no names or personal details, only word lists.</li>
      </ul>
      <h2>How long we keep data</h2>
      <ul>
        <li>Account and learning data: while your account is open.</li>
        <li>Speech transcripts: 12 months. Pseudonymous analytics: 25 months.</li>
        <li>Payment records: as long as tax law requires.</li>
      </ul>
      <h2>Your rights</h2>
      <p>You can view, export and delete your family’s data at any time in Parent Zone → Privacy, or by emailing <a href={`mailto:${SITE.email.value}`}>{SITE.email.value}</a>. Deleting your account removes all children’s profiles and progress. You may also complain to the data protection authority in your country.</p>
      <h2>Parental consent</h2>
      <p>A parent creates every child profile and chooses whether speaking activities (microphone) are allowed. Purchases, settings and external links sit behind a parent check.</p>
      <h2>Cookies and storage</h2>
      <p>We use only what is needed to keep you signed in, remember settings and work offline. No advertising cookies.</p>
      <h2>Changes and contact</h2>
      <p>We will email you before material changes. Questions: {c}, {SITE.address.value}, <a href={`mailto:${SITE.email.value}`}>{SITE.email.value}</a>. See also our <Link href="/legal/terms">Terms</Link>.</p>
    </SitePage>
  );
}
