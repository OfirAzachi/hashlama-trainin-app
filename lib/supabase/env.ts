/**
 * Whether real Supabase persistence is configured. The app runs entirely on
 * the in-memory mock store when these are absent, so local development and
 * previews never require a database.
 */
export const supabaseConfigured =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function requireSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Supabase env vars are missing — check .env.local against .env.example.');
  }
  return { url, anonKey };
}
