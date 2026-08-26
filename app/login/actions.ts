'use server';

import { redirect } from 'next/navigation';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';

/**
 * Sign-up is Google-first: before sending the browser to Google, verify the
 * login code (first name + digits — see the personal_number scheme
 * migration) exists in the roster and isn't already claimed.
 * `/auth/callback` carries this same code through the redirect and does the
 * actual roster link once the Google identity comes back — only trainers
 * add people to the roster, so an unmatched code never gets that far.
 */
export async function checkPersonalNumberForSignup(personalNumber: string): Promise<ActionResult> {
  const trimmed = personalNumber.trim();
  if (!trimmed) {
    return { ok: false, error: 'הזינו קוד כניסה.' };
  }
  if (!/^[א-ת]+[0-9]+$/.test(trimmed)) {
    return { ok: false, error: 'קוד כניסה הוא שם פרטי ואחריו ספרות, בלי רווח (לדוגמה: אופיר12).' };
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
    return { ok: false, error: 'קוד כניסה לא נמצא ברשימה. פנו למאמן/ת.' };
  }
  if (rosterRow.matched_user_id) {
    return { ok: false, error: 'קוד הכניסה הזה כבר משויך לחשבון קיים. נסו להתחבר במקום.' };
  }

  return { ok: true, data: undefined };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
