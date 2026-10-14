import { NextResponse } from 'next/server';
import { publicConfig } from '@/lib/config';
import { serverConfig } from '@/lib/server-config';

/** Liveness + configuration summary (no secrets). */
export function GET() {
  return NextResponse.json({
    ok: true, env: publicConfig.appEnv, dataMode: publicConfig.dataMode,
    providers: { billing: serverConfig.billingProvider, billingClient: publicConfig.webBillingProvider, ai: serverConfig.aiProvider, pronunciation: serverConfig.pronunciationProvider, email: serverConfig.emailProvider },
    time: new Date().toISOString(),
  });
}
