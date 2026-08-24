'use client';

import { createBrowserClient } from '@supabase/ssr';

import { requireSupabaseEnv } from './env';
import type { Database } from './database.types';

/** Browser-side Supabase client, for client components (auth forms, realtime). */
export function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
