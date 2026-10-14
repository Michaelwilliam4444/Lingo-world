import type { ReactNode } from 'react';
import { SiteFooter, SiteHeader } from '@/components/site/SiteChrome';

/** Public website: landing, age tracks, pricing, contact and legal pages share one header and footer. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
