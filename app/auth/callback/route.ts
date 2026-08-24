import { NextResponse, type NextRequest } from 'next/server';

import { linkRosterToUser } from '@/lib/roster-link';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * OAuth redirect target (Google, etc.): exchanges the auth code for a
 * session cookie. When a `pn` (מ.א) was carried through the redirect —
 * the Google-first signup path — it links the roster row right here, so
 * the new account lands straight on /onboarding instead of a second
 * "enter your מ.א" step. Sign-in for an already-linked Google account (no
 * `pn`) just hands off to `next`, and `requireUser()` takes it from there.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const personalNumber = searchParams.get('pn');
  const safeNext = next.startsWith('/') ? next : '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  if (personalNumber) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const service = createServiceClient();
      const result = await linkRosterToUser(service, user.id, user.email ?? null, personalNumber);
      return NextResponse.redirect(`${origin}${result.ok ? '/onboarding' : '/link-account'}`);
    }
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
