import type { Metadata } from 'next';
import Link from 'next/link';
import { SitePage } from '@/components/site/SiteChrome';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'Contact', description: 'Contact the LingoWorld team — support, billing and privacy questions.' };

export default function Contact() {
  const whatsapp = SITE.phone.missing ? null : `https://wa.me/${SITE.phone.value.replace(/[^0-9]/g, '')}`;
  return (
    <SitePage title="Contact us" intro="Questions about your child’s learning, billing or privacy? We reply within 2 business days (Sunday–Thursday, Cairo time).">
      <div className="not-prose grid gap-4 sm:grid-cols-2">
        <a href={`mailto:${SITE.email.value}`} className="rounded-tab bg-white p-5 no-underline">
          <p className="text-3xl" aria-hidden>✉️</p><p className="mt-2 text-xl font-bold text-ink">Email</p><p className="text-lagoon-dark">{SITE.email.value}</p>
        </a>
        <div className="rounded-tab bg-white p-5">
          <p className="text-3xl" aria-hidden>📞</p><p className="mt-2 text-xl font-bold">Phone{whatsapp ? ' / WhatsApp' : ''}</p>
          <p dir="ltr" className="text-start">{SITE.phone.value}</p>
          {whatsapp && <a href={whatsapp} rel="noopener" className="text-sm">Message us on WhatsApp</a>}
        </div>
      </div>
      <h2>Company details</h2>
      <p>{SITE.company.value}<br />{SITE.address.value}<br />Commercial register: {SITE.commercialRegister.value}<br />Tax ID: {SITE.taxId.value}</p>
      <h2>Quick answers</h2>
      <ul>
        <li>Cancel auto-renewal: Parent Zone → Plan → “Turn off auto-renewal”.</li>
        <li>Refunds: see the <Link href="/legal/refunds">Refund &amp; Cancellation Policy</Link>.</li>
        <li>Delete your data: Parent Zone → Privacy → Delete account.</li>
        <li>Change your child’s age track: Parent Zone → Children → your child → Learning track.</li>
      </ul>
    </SitePage>
  );
}
