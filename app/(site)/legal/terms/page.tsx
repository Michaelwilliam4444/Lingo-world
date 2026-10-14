import type { Metadata } from 'next';
import Link from 'next/link';
import { SitePage } from '@/components/site/SiteChrome';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'Terms of Service' };

/** Template — have a lawyer licensed in Egypt review before launch. */
export default function Terms() {
  const c = SITE.company.value;
  return (
    <SitePage title="Terms of Service" updated={SITE.legalUpdated}
      intro={<>These terms are an agreement between you (the parent or legal guardian) and {c} (“we”, “us”), the operator of {SITE.brand}.</>}>
      <h2>1. Who can use LingoWorld</h2>
      <p>Accounts are for adults aged 18 or over. You create profiles for your children (ages 4–11) and supervise their use. Children never have their own login, email or password.</p>
      <h2>2. Your account</h2>
      <ul>
        <li>Keep your password safe; you are responsible for activity on your account.</li>
        <li>Give accurate information. A child profile needs only a nickname, age and language choices.</li>
        <li>You can delete your account and all children’s data at any time in Parent Zone → Privacy.</li>
      </ul>
      <h2>3. Plans, prices and payment</h2>
      <ul>
        <li>The free plan is free. Paid plans (Premium Monthly, Premium Annual, Family) are listed on our <Link href="/pricing">pricing page</Link>. Prices in EGP include applicable taxes.</li>
        <li>Payments are processed by our payment provider, Paymob (Egypt). We do not receive or store full card numbers.</li>
        <li><b>Card payments renew automatically</b> at the end of each billing period (monthly or yearly) at the then-current price, until you turn off auto-renewal in Parent Zone → Plan. We remind you by email before annual renewals.</li>
        <li><b>Mobile-wallet and Fawry/Aman payments are prepaid</b> for the period purchased and do not renew automatically.</li>
        <li>If a renewal payment fails, we retry for a few days; Premium stays active during that time and ends if payment cannot be collected.</li>
        <li>We may change prices with at least 30 days’ notice; changes apply from your next renewal.</li>
      </ul>
      <h2>4. Cancellation and refunds</h2>
      <p>You can cancel at any time. Our <Link href="/legal/refunds">Refund &amp; Cancellation Policy</Link> forms part of these terms.</p>
      <h2>5. Acceptable use</h2>
      <ul>
        <li>Use LingoWorld for personal, non-commercial family learning.</li>
        <li>Do not copy, resell, reverse-engineer or scrape the service or its content, or try to access other families’ data.</li>
        <li>Creations your child makes stay private to your family.</li>
      </ul>
      <h2>6. Our content</h2>
      <p>The stories, characters, games, illustrations, audio and software are owned by {c} or its licensors and are licensed to you for use within LingoWorld only.</p>
      <h2>7. Learning outcomes</h2>
      <p>LingoWorld follows a CEFR-aligned curriculum (Pre-A1 to A2) but is not a formal certification, and children progress at different speeds. We do not guarantee specific results.</p>
      <h2>8. Availability and changes</h2>
      <p>We work to keep LingoWorld available and may update features and content. If we discontinue a paid feature, we will offer a pro-rata refund for unused prepaid time.</p>
      <h2>9. Liability</h2>
      <p>To the extent permitted by law, our total liability for any claim is limited to the amount you paid us in the 12 months before the claim. Nothing in these terms limits rights you have under Egyptian consumer protection law (Law No. 181 of 2018).</p>
      <h2>10. Governing law</h2>
      <p>These terms are governed by the laws of {SITE.governingLaw}. Disputes go to the competent courts of Cairo, without affecting any mandatory consumer rights.</p>
      <h2>11. Contact</h2>
      <p>{c}, {SITE.address.value}. Email <a href={`mailto:${SITE.email.value}`}>{SITE.email.value}</a>, phone <span dir="ltr">{SITE.phone.value}</span>. Commercial register {SITE.commercialRegister.value}; tax ID {SITE.taxId.value}.</p>
    </SitePage>
  );
}
