import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const get = (key) => {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : null;
};
const url = get('NEXT_PUBLIC_SUPABASE_URL');
const key = get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(url, key);

const { data, error } = await supabase.rpc('exec_sql_readonly', {}).catch(() => ({ data: null, error: 'no rpc' }));
// no generic exec available; use a direct query via postgrest on pg_constraint isn't exposed either.
console.log('fallback: will just try information_schema via a select if exposed');
