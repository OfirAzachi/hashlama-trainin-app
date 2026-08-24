'use client';

import { Pause, Play, PlayCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import ExerciseAnimation from '@/components/ExerciseAnimation';
import { Badge } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { findCategory } from '@/lib/catalog';
import { LEVEL_LABELS, scoringHint, type StrengthExercise, type StrengthLevel } from '@/lib/strength-catalog';

const LEVEL_TONE = {
  1: 'positive',
  2: 'accent',
  3: 'warning',
  4: 'negative',
} as const;

/** Level chip: the number doubles as the points multiplier. */
export function LevelBadge({ level }: { level: StrengthLevel }) {
  return (
    <Badge tone={LEVEL_TONE[level]}>
      רמה {level} · ×{level}
    </Badge>
  );
}

/**
 * "Watch the movement" button shown next to every exercise. Opens a looping
 * illustration with the scoring rule for that exercise.
 */
export function ExerciseDemoButton({
  exercise,
  variant = 'icon',
  className,
}: {
  exercise: StrengthExercise;
  variant?: 'icon' | 'inline';
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        aria-label={`צפייה בהדגמה: ${exercise.name}`}
        title={`צפייה בהדגמה: ${exercise.name}`}
        className={cn(
          variant === 'icon'
            ? 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-elevated hover:text-accent'
            : 'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10',
          className,
        )}
      >
        <PlayCircle aria-hidden className={variant === 'icon' ? 'h-5 w-5' : 'h-4 w-4'} />
        {variant === 'inline' ? 'הדגמה' : null}
      </button>

      {open ? <ExerciseDemoDialog exercise={exercise} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function ExerciseDemoDialog({
  exercise,
  onClose,
}: {
  exercise: StrengthExercise;
  onClose: () => void;
}) {
  const [playing, setPlaying] = useState(true);
  const category = findCategory(exercise.category);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`הדגמה: ${exercise.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <p dir="rtl" className="truncate text-base font-semibold text-ink">
              {exercise.name}
            </p>
            <p className="truncate text-sm text-muted">{exercise.nameEn}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost h-9 w-9 p-0" aria-label="סגירת ההדגמה">
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-elevated px-6 py-4">
          <ExerciseAnimation exercise={exercise} playing={playing} className="max-h-56" />
        </div>

        <div className="space-y-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <LevelBadge level={exercise.level} />
            <Badge tone="neutral">{category?.name}</Badge>
            <button
              type="button"
              onClick={() => setPlaying((current) => !current)}
              className="btn-ghost ms-auto px-2 py-1 text-xs"
            >
              {playing ? (
                <>
                  <Pause aria-hidden className="h-3.5 w-3.5" /> עצירה
                </>
              ) : (
                <>
                  <Play aria-hidden className="h-3.5 w-3.5" /> הפעלה
                </>
              )}
            </button>
          </div>

          <div className="rounded-xl bg-elevated p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">ניקוד</p>
            <p dir="rtl" className="mt-1 text-sm text-ink">
              {scoringHint(exercise)}
            </p>
          </div>

          <p className="text-xs text-muted">{LEVEL_LABELS[exercise.level].name}</p>
        </div>
      </div>
    </div>
  );
}
