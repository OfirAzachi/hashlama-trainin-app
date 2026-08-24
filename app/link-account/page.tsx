import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import LinkAccountForm from './LinkAccountForm';

export const dynamic = 'force-dynamic';

export default async function LinkAccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: roster } = await supabase
    .from('roster')
    .select('confirmed_at')
    .eq('matched_user_id', user.id)
    .maybeSingle();
  // Already linked — nothing to do here.
  if (roster) redirect(roster.confirmed_at ? '/' : '/onboarding');

  return <LinkAccountForm />;
}
