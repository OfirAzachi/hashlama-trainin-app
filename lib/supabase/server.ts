import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { requireSupabaseEnv } from './env';
import type { Database } from './database.types';

/**
 * Server-side Supabase client for server components and server actions.
 * Reads the session from cookies; writes go through `middleware.ts`, which
 * refreshes the session cookie on every request.
 */
export async function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component that can't set cookies — middleware
          // refreshes the session on the next request, so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * Service-role client for privileged server-only operations (the exercise
 * catalogue seed, admin scripts). Never import this from client code or a
 * server action that echoes data back to the caller unfiltered.
 */
export function createServiceClient() {
  const { url } = requireSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing — check .env.local against .env.example.');
  }
  // Service-role client is stateless (no user session/cookies), so it's
  // created directly rather than through createServerClient's cookie plumbing.
  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
