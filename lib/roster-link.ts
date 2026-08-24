import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './supabase/database.types';

/**
 * Matches an authenticated account to a roster row by מ.א, then copies
 * name/role/team/unit onto `public.users` — the single source of truth for
 * both the Google-first signup flow (`/auth/callback`) and the
 * already-authenticated linking flow (`/link-account`). Only trainers add
 * people to the roster, so an unmatched or already-claimed מ.א is rejected
 * outright rather than allowed to self-declare an account.
 */
export async function linkRosterToUser(
  service: SupabaseClient<Database>,
  userId: string,
  userEmail: string | null,
  personalNumber: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = personalNumber.trim();
  if (!trimmed) {
    return { ok: false, error: 'הזינו מספר אישי.' };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: 'מספר אישי חייב להכיל ספרות בלבד.' };
  }

  const { data: rosterRow, error: rosterError } = await service
    .from('roster')
    .select('*')
    .eq('personal_number', trimmed)
    .maybeSingle();

  if (rosterError) {
    return { ok: false, error: 'השיוך נכשל, נסו שוב.' };
  }
  if (!rosterRow) {
    return { ok: false, error: 'מספר אישי לא נמצא ברשימה. פנו למאמן/ת.' };
  }
  if (rosterRow.matched_user_id) {
    return { ok: false, error: 'המספר האישי הזה כבר משויך לחשבון קיים.' };
  }

  const { error: rosterUpdateError } = await service
    .from('roster')
    .update({ email: userEmail, matched_user_id: userId })
    .eq('personal_number', trimmed);
  if (rosterUpdateError) {
    return { ok: false, error: 'השיוך נכשל, נסו שוב.' };
  }

  const { error: userUpdateError } = await service
    .from('users')
    .update({
      name: `${rosterRow.first_name} ${rosterRow.last_name}`.trim(),
      role: rosterRow.role,
      team: rosterRow.role === 'participant' ? rosterRow.team : null,
      unit: rosterRow.role === 'participant' ? rosterRow.unit : null,
      gender: rosterRow.gender,
      final_run_seconds: rosterRow.final_run_seconds,
      pushup_achievement: rosterRow.pushup_achievement,
      final_score: rosterRow.final_score,
      km_levels: rosterRow.role === 'participant' ? rosterRow.km_levels : [],
    })
    .eq('id', userId);
  if (userUpdateError) {
    // The roster link exists but the profile update failed — surface this
    // clearly rather than leaving a half-linked account.
    return { ok: false, error: 'השיוך נוצר אך עדכון הפרטים נכשל. פנו למאמן/ת.' };
  }

  return { ok: true };
}
