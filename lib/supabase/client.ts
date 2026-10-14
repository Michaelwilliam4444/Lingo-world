'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { publicConfig } from '@/lib/config';

let client: SupabaseClient | null = null;

/** Browser client (anon key + parent session cookie). All access is constrained by RLS. */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!client) client = createBrowserClient(publicConfig.supabaseUrl, publicConfig.supabaseAnonKey);
  return client;
}
