import type { Metadata } from 'next';
import { SitePage } from '@/components/site/SiteChrome';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'Refund & Cancellation Policy' };

/** Template — adjust the windows to your business decision and have it reviewed. */
export default function Refunds() {
  return (
    <SitePage title="Refund & Cancellation Policy" updated={SITE.legalUpdated}
      intro="We want families to pay only for something they love. Here is exactly how cancelling and refunds work.">
      <h2>Cancelling</h2>
      <ul>
        <li><b>Card subscriptions:</b> open Parent Zone → Plan → “Turn off auto-renewal”. No further payments are taken. Premium stays active until the end of the period you already paid for, then your family moves to the free plan. Progress is never deleted.</li>
        <li><b>Wallet and Fawry/Aman payments</b> are prepaid and never renew, so there is nothing to cancel.</li>
      </ul>
      <h2>Refunds</h2>
      <table>
        <thead><tr><th>Situation</th><th>What we do</th></tr></thead>
        <tbody>
          <tr><td>First payment for a plan, requested within <b>14 days</b></td><td>Full refund, no questions asked.</td></tr>
          <tr><td>Automatic renewal you forgot to cancel, requested within <b>7 days</b> of the renewal</td><td>Full refund of that renewal.</td></tr>
          <tr><td>Charged twice, or charged after cancelling</td><td>Full refund of the incorrect charge.</td></tr>
          <tr><td>Annual plan cancelled later in the year</td><td>No refund for the remaining months; Premium stays active until the end of the year.</td></tr>
          <tr><td>Service unavailable for an extended period, or a paid feature discontinued</td><td>Pro-rata refund for the unused time.</td></tr>
        </tbody>
      </table>
      <p>A refund ends Premium for the refunded period immediately.</p>
      <h2>How to request a refund</h2>
      <p>Email <a href={`mailto:${SITE.email.value}`}>{SITE.email.value}</a> from your account email (or call <span dir="ltr">{SITE.phone.value}</span>) with the date and amount. We reply within 2 business days.</p>
      <h2>How refunds are paid</h2>
      <ul>
        <li><b>Cards:</b> back to the same card through Paymob. Banks usually show it within 7–14 business days.</li>
        <li><b>Mobile wallets:</b> back to the same wallet, usually within a few business days.</li>
        <li><b>Fawry / Aman cash payments:</b> by mobile-wallet or bank transfer to an account in your name, which we will ask you for.</li>
      </ul>
      <p>This policy does not limit your rights under Egyptian consumer protection law.</p>
      <h2>App Store and Google Play</h2>
      <p>Subscriptions bought inside the iOS or Android app are billed by Apple or Google and refunded under their policies — request them from the store.</p>
    </SitePage>
  );
}
