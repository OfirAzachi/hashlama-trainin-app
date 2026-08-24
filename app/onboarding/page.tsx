import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import OnboardingForm from './OnboardingForm';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const service = createServiceClient();
  const { data: roster } = await service
    .from('roster')
    .select('*')
    .eq('matched_user_id', user.id)
    .maybeSingle();

  // Not a roster-matched account (shouldn't happen via the sign-up flow) —
  // nothing to confirm.
  if (!roster) redirect('/');
  if (roster.confirmed_at) redirect('/');

  const { data: allRows } = await service.from('roster').select('unit');
  const unitCounts = new Map<string, number>();
  (allRows ?? []).forEach((row) => {
    if (row.unit) unitCounts.set(row.unit, (unitCounts.get(row.unit) ?? 0) + 1);
  });
  const isSingletonUnit = (unitCounts.get(roster.unit) ?? 0) <= 1;
  const allUnits = [...unitCounts.keys()].sort((a, b) => a.localeCompare(b, 'he'));

  return <OnboardingForm roster={roster} isSingletonUnit={isSingletonUnit} allUnits={allUnits} />;
}
