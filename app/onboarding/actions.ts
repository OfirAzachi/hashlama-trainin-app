'use server';

import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import type { ActionResult, GroupId } from '@/lib/types';

export interface ConfirmRosterDetailsInput {
  name: string;
  gender: 'ז' | 'נ' | '';
  team: GroupId | null;
  unit: string;
  finalRunSeconds: number | null;
  pushupAchievement: number | null;
  finalScore: number | null;
  kmLevels: number[];
}

/**
 * Confirms the roster-derived details — possibly corrected by the
 * participant first. Everything here writes to `public.users` (the
 * editable/effective copy); `roster` stays untouched as the original import
 * record, and only its `confirmed_at` gets set.
 */
export async function confirmRosterDetails(input: ConfirmRosterDetailsInput): Promise<ActionResult<never> | void> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const name = input.name.trim();
  const unit = input.unit.trim();

  if (!name) return { ok: false, error: 'הזינו שם.' };
  if (input.gender !== 'ז' && input.gender !== 'נ') return { ok: false, error: 'בחרו מין.' };
  if (!input.team) return { ok: false, error: 'בחרו צוות.' };
  if (!unit) return { ok: false, error: 'הזינו יחידה.' };
  if (input.finalRunSeconds != null && input.finalRunSeconds <= 0) {
    return { ok: false, error: 'זמן ריצה לא תקין.' };
  }
  if (input.pushupAchievement != null && input.pushupAchievement < 0) {
    return { ok: false, error: 'הישג שכיבות סמיכה לא תקין.' };
  }
  if (input.finalScore == null || input.finalScore < 0) {
    return { ok: false, error: 'הזינו ציון סופי.' };
  }
  if (input.kmLevels.some((level) => level < 0 || level > 2)) {
    return { ok: false, error: 'ערך כמ לא תקין.' };
  }

  const service = createServiceClient();
  const { data: roster, error: fetchError } = await service
    .from('roster')
    .select('personal_number, final_run_seconds, pushup_achievement')
    .eq('matched_user_id', user.id)
    .maybeSingle();

  if (fetchError || !roster) {
    return { ok: false, error: 'לא נמצאו פרטים לאישור.' };
  }

  const { error: confirmError } = await service
    .from('roster')
    .update({ confirmed_at: new Date().toISOString() })
    .eq('personal_number', roster.personal_number);
  if (confirmError) {
    return { ok: false, error: 'האישור נכשל, נסו שוב.' };
  }

  // Run time and pushup achievement are locked once the roster already has
  // a value — a participant may only fill them in when they're missing, not
  // overwrite a real test result. Ignore whatever the client sent for a
  // field that was already set, and use the roster's own value instead.
  const finalRunSeconds = roster.final_run_seconds ?? input.finalRunSeconds;
  const pushupAchievement = roster.pushup_achievement ?? input.pushupAchievement;

  const { error: userUpdateError } = await service
    .from('users')
    .update({
      name,
      gender: input.gender,
      team: input.team,
      unit,
      final_run_seconds: finalRunSeconds,
      pushup_achievement: pushupAchievement,
      final_score: input.finalScore,
      km_levels: [...new Set(input.kmLevels)].sort(),
    })
    .eq('id', user.id);
  if (userUpdateError) {
    return { ok: false, error: 'האישור נכשל, נסו שוב.' };
  }

  redirect('/');
}
