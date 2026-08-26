'use client';

import { useState } from 'react';

import { Card } from '@/components/ui/primitives';
import { linkAccount } from './actions';

export default function LinkAccountForm() {
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!value.trim()) {
      setError('הזינו קוד כניסה.');
      return;
    }
    setPending(true);
    setError(null);
    const result = await linkAccount(value);
    setPending(false);
    if (result && !result.ok) setError(result.error);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-ink">כמעט סיימנו</h1>
        <p className="mt-1 text-sm text-muted">
          הזינו את קוד הכניסה שלכם כדי לשייך את חשבון ה-Google לפרטים מהבוחן.
        </p>
      </div>

      <Card className="card-pad space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="link-personal-number" className="text-sm font-medium text-ink">
            קוד כניסה
          </label>
          <input
            id="link-personal-number"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="input"
            autoComplete="off"
            placeholder="לדוגמה: אופיר12"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className="btn-primary w-full justify-center"
          onClick={handleSubmit}
          disabled={pending}
        >
          {pending ? 'משייכת…' : 'שיוך החשבון'}
        </button>
      </Card>
    </div>
  );
}
