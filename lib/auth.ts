import 'server-only';

import { redirect } from 'next/navigation';

import { createClient } from './supabase/server';
import type { GroupId, Participant, User } from './types';

/** The signed-in user's `public.users` row, or null if not signed in. */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data } = await supabase.from('users').select('*').eq('id', authUser.id).maybeSingle();
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    team: data.team as GroupId | null,
    unit: data.unit,
    avatar_url: data.avatar_url,
    joined_at: data.joined_at,
  };
}

/**
 * Redirects to /login when signed out — middleware already does this for
 * every route, so this is a defence-in-depth check inside server components.
 * Also redirects to /link-account when the account has no roster match at
 * all yet (a first-time Google sign-in with no מ.א linked).
 *
 * Deliberately does NOT redirect to /onboarding here: that screen is shown
 * once, as the last step of sign-up (Google auth signs the account in
 * automatically, straight into /onboarding — see /auth/callback and
 * /link-account). It's not a standing gate on every later sign-in, so
 * leaving it unconfirmed doesn't lock the participant out of the app —
 * `linkRosterToUser` already copied the roster's raw values onto `users` at
 * link time, onboarding just gives them one chance to correct them.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: roster } = await supabase
    .from('roster')
    .select('personal_number')
    .eq('matched_user_id', user.id)
    .maybeSingle();
  if (!roster) redirect('/link-account');

  return user;
}

export async function requireTrainer(): Promise<User> {
  const user = await requireUser();
  if (user.role !== 'trainer') redirect('/participant');
  return user;
}

export async function requireParticipant(): Promise<Participant> {
  const user = await requireUser();
  if (user.role !== 'participant' || !user.team) redirect('/trainer');
  return user as Participant;
}
