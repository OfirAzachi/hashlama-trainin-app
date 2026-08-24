'use server';

import { redirect } from 'next/navigation';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';

/**
 * Sign-up is Google-first: before sending the browser to Google, verify the
 * מ.א exists in the roster and isn't already claimed. `/auth/callback`
 * carries this same מ.א through the redirect and does the actual roster
 * link once the Google identity comes back — only trainers add people to
 * the roster, so an unmatched מ.א never gets that far.
 */
export async function checkPersonalNumberForSignup(personalNumber: string): Promise<ActionResult> {
  const trimmed = personalNumber.trim();
  if (!trimmed) {
    return { ok: false, error: 'הזינו מספר אישי.' };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: 'מספר אישי חייב להכיל ספרות בלבד.' };
  }

  const service = createServiceClient();
  const { data: rosterRow, error } = await service
    .from('roster')
    .select('matched_user_id')
    .eq('personal_number', trimmed)
    .maybeSingle();

  if (error) {
    return { ok: false, error: 'הבדיקה נכשלה, נסו שוב.' };
  }
  if (!rosterRow) {
    return { ok: false, error: 'מספר אישי לא נמצא ברשימה. פנו למאמן/ת.' };
  }
  if (rosterRow.matched_user_id) {
    return { ok: false, error: 'המספר האישי הזה כבר משויך לחשבון קיים. נסו להתחבר במקום.' };
  }

  return { ok: true, data: undefined };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
