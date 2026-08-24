/**
 * Upserts scripts/roster-import.json (produced by export-roster-json.py)
 * into public.roster, keyed by personal_number. Safe to re-run — it never
 * touches email / matched_user_id / confirmed_at, which are only set by the
 * sign-up flow.
 *
 * Usage: node scripts/import-roster.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { config } from 'dotenv';

config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const rows = JSON.parse(readFileSync('scripts/roster-import.json', 'utf-8'));
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data, error } = await supabase
  .from('roster')
  .upsert(rows, { onConflict: 'personal_number' })
  .select('personal_number');

if (error) {
  console.error('Import failed:', error);
  process.exit(1);
}

console.log(`Imported ${data?.length ?? 0} roster rows.`);
