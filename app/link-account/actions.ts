'use server';

import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { linkRosterToUser } from '@/lib/roster-link';
import { createServiceClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';

/**
 * Fallback for the rare case where a Google sign-in reaches this page
 * without having linked already — normally `/auth/callback` links the
 * account right away using the מ.א carried through the OAuth redirect.
 */
export async function linkAccount(personalNumber: string): Promise<ActionResult<never> | void> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const service = createServiceClient();
  const result = await linkRosterToUser(service, user.id, user.email, personalNumber);
  if (!result.ok) return result;

  redirect('/onboarding');
}
