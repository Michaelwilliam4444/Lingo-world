import type { ReactNode } from 'react';
import { AdminShell } from '@/components/shell/AdminShell';
export const metadata = { robots: { index: false, follow: false } };
export default function AdminLayout({ children }: { children: ReactNode }) { return <AdminShell>{children}</AdminShell>; }
