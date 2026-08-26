'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { fetchExerciseGifOverrides } from '@/app/actions';

interface ExerciseGifOverridesValue {
  overrides: Record<string, string>;
  /** Re-fetches after a trainer saves or removes a link, so it shows up immediately. */
  refresh: () => void;
}

const ExerciseGifOverridesContext = createContext<ExerciseGifOverridesValue>({
  overrides: {},
  refresh: () => {},
});

/**
 * Loads every trainer-pasted GIF link once and makes it available anywhere
 * in the tree — wraps the whole app in AppShell so both the trainer's
 * builder and a participant's logging screen see the same overrides.
 */
export function ExerciseGifOverridesProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    fetchExerciseGifOverrides().then((result) => {
      if (result.ok) setOverrides(result.data);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ExerciseGifOverridesContext.Provider value={{ overrides, refresh }}>
      {children}
    </ExerciseGifOverridesContext.Provider>
  );
}

export function useExerciseGifOverrides(): ExerciseGifOverridesValue {
  return useContext(ExerciseGifOverridesContext);
}

/** A trainer-pasted link always wins over the built-in ExerciseDB match. */
export function resolveGifUrl(
  exercise: { id: string; gif_url: string | null },
  overrides: Record<string, string>,
): string | null {
  return overrides[exercise.id] ?? exercise.gif_url;
}
