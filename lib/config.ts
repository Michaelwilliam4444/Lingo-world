/**
 * Public (browser-safe) configuration. Server-only secrets live in src/lib/server-config.ts
 * and must never be imported by client components.
 */
export type DataMode = 'local' | 'supabase';
export type AppEnv = 'development' | 'staging' | 'production';

export const publicConfig = {
  appEnv: (process.env.NEXT_PUBLIC_APP_ENV ?? 'development') as AppEnv,
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  dataMode: (process.env.NEXT_PUBLIC_DATA_MODE === 'supabase' ? 'supabase' : 'local') as DataMode,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  speechProvider: (process.env.NEXT_PUBLIC_SPEECH_PROVIDER ?? 'browser') as 'browser' | 'mock',
  mediaBaseUrl: process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? '',
  /** Web checkout: 'paymob' (Egypt), 'stripe' or 'mock'. Must match the server's BILLING_PROVIDER. */
  webBillingProvider: (process.env.NEXT_PUBLIC_BILLING_PROVIDER ?? 'mock') as 'paymob' | 'stripe' | 'mock',
  revenueCatIosKey: process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY ?? '',
  revenueCatAndroidKey: process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
};

export function isSupabaseConfigured(): boolean {
  return publicConfig.dataMode === 'supabase' && !!publicConfig.supabaseUrl && !!publicConfig.supabaseAnonKey;
}
