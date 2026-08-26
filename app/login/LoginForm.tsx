'use client';

import { useState } from 'react';

import { Card } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';
import { checkPersonalNumberForSignup } from './actions';

function GoogleIcon() {
  return (
    <svg aria-hidden className="h-4 w-4" viewBox="0 0 18 18">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z"
      />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}

function startGoogleAuth(redirectTo: string, onError: () => void) {
  const supabase = createClient();
  void supabase.auth
    .signInWithOAuth({ provider: 'google', options: { redirectTo } })
    .then(({ error }) => {
      if (error) onError();
    });
}

const OAUTH_ERROR_MESSAGE =
  'ההתחברות עם Google נכשלה בצד השרת. ודאו שספק ה-Google מופעל ושכתובת ה-redirect רשומה בהגדרות Supabase.';

export default function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [googlePending, setGooglePending] = useState(false);
  const [error, setError] = useState<string | null>(initialError ? OAUTH_ERROR_MESSAGE : null);
  const [signupPersonalNumber, setSignupPersonalNumber] = useState('');

  const handleSignInWithGoogle = () => {
    setError(null);
    setGooglePending(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    startGoogleAuth(redirectTo, () => {
      setGooglePending(false);
      setError('ההתחברות עם Google נכשלה, נסו שוב.');
    });
  };

  const handleSignUpWithGoogle = async () => {
    setError(null);
    const result = await checkPersonalNumberForSignup(signupPersonalNumber);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setGooglePending(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      '/onboarding',
    )}&pn=${encodeURIComponent(signupPersonalNumber.trim())}`;
    startGoogleAuth(redirectTo, () => {
      setGooglePending(false);
      setError('ההרשמה עם Google נכשלה, נסו שוב.');
    });
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-ink">השלמה</h1>
        <p className="mt-1 text-sm text-muted">מעקב קורס אימונים</p>
      </div>

      <div className="flex rounded-2xl border border-line bg-elevated p-1">
        <button
          type="button"
          onClick={() => {
            setMode('signin');
            setError(null);
          }}
          aria-pressed={mode === 'signin'}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
            mode === 'signin' ? 'bg-surface text-ink shadow-sm' : 'text-muted'
          }`}
        >
          התחברות
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('signup');
            setError(null);
          }}
          aria-pressed={mode === 'signup'}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
            mode === 'signup' ? 'bg-surface text-ink shadow-sm' : 'text-muted'
          }`}
        >
          הרשמה
        </button>
      </div>

      <Card className="card-pad">
        {mode === 'signin' ? (
          <div className="space-y-4">
            {error ? (
              <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleSignInWithGoogle}
              disabled={googlePending}
              className="btn-primary w-full justify-center gap-2"
            >
              <GoogleIcon />
              {googlePending ? 'מעבירה ל-Google…' : 'המשך עם Google'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="signup-personal-number" className="text-sm font-medium text-ink">
                קוד כניסה
              </label>
              <input
                id="signup-personal-number"
                name="personal_number"
                type="text"
                required
                value={signupPersonalNumber}
                onChange={(event) => setSignupPersonalNumber(event.target.value)}
                className="input"
                autoComplete="off"
                placeholder="לדוגמה: אופיר912"
              />
              <p className="text-xs text-muted">
                שם, קבוצה ותוצאות הבוחן מולאים אוטומטית ממאגר המאמן/ת. הקוד הוא השם הפרטי שלכם ואחריו הספרות שקיבלתם
                מהמאמן/ת, בלי רווח. אחרי אימות הקוד, מתחברים עם Google כדי לסיים את ההרשמה.
              </p>
            </div>

            {error ? (
              <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleSignUpWithGoogle}
              disabled={googlePending}
              className="btn-primary w-full justify-center gap-2"
            >
              <GoogleIcon />
              {googlePending ? 'מעבירה ל-Google…' : 'אימות קוד כניסה עם Google'}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
