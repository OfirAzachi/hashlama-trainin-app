'use client';

import { ExternalLink, Link2, Loader2, Pause, Play, PlayCircle, X } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import { removeExerciseGif, updateExerciseGif } from '@/app/actions';
import ExerciseAnimation from '@/components/ExerciseAnimation';
import { resolveGifUrl, useExerciseGifOverrides } from '@/components/ExerciseGifOverrides';
import { Badge } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { findCategory } from '@/lib/catalog';
import { LEVEL_LABELS, scoringHint, type StrengthExercise, type StrengthLevel } from '@/lib/strength-catalog';

const LEVEL_TONE = {
  1: 'positive',
  2: 'accent',
  3: 'warning',
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
  editableBy,
}: {
  exercise: StrengthExercise;
  variant?: 'icon' | 'inline';
  className?: string;
  /** Trainer's own user id — pass to let them paste/replace this exercise's GIF link. */
  editableBy?: string;
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

      {open ? (
        <ExerciseDemoDialog exercise={exercise} onClose={() => setOpen(false)} editableBy={editableBy} />
      ) : null}
    </>
  );
}

/** Lets a trainer paste (or remove) a direct GIF link for this exercise — always wins over the auto-match. */
function GifLinkEditor({ exercise, trainerId }: { exercise: StrengthExercise; trainerId: string }) {
  const { overrides, refresh } = useExerciseGifOverrides();
  const current = overrides[exercise.id] ?? '';
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setValue(current), [current]);

  const save = () => {
    if (!value.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await updateExerciseGif(trainerId, exercise.id, value.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      refresh();
    });
  };

  const remove = () => {
    setError(null);
    startTransition(async () => {
      const result = await removeExerciseGif(trainerId, exercise.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setValue('');
      refresh();
    });
  };

  return (
    <div className="space-y-1.5 rounded-xl border border-line bg-elevated/50 p-3">
      <label htmlFor={`gif-link-${exercise.id}`} className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <Link2 aria-hidden className="h-3.5 w-3.5" />
        קישור להדגמה (מחליף את ההדגמה האוטומטית)
      </label>
      <div className="flex gap-2">
        <input
          id={`gif-link-${exercise.id}`}
          className="input flex-1 text-sm"
          placeholder="https://…"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          dir="ltr"
        />
        <button
          type="button"
          onClick={save}
          disabled={isPending || !value.trim()}
          className="btn-primary px-3 py-1.5 text-xs disabled:opacity-40"
        >
          {isPending ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : 'שמירה'}
        </button>
        {current ? (
          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
          >
            הסרה
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
      {current ? (
        <a
          href={current}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
        >
          <ExternalLink aria-hidden className="h-3 w-3" />
          פתיחת הקישור השמור בכרטיסייה חדשה
        </a>
      ) : null}
      <p className="text-[11px] leading-relaxed text-muted">
        קישור לקובץ תמונה ישיר (למשל, מסתיים ב-gif.) יוצג כאן בתוך האפליקציה. קישור לדף אינטרנט רגיל
        (לדוגמה סרטון יוטיוב או עמוד באתר) לא יוצג בתוך האפליקציה, אבל עדיין יישמר — כל מי שרואה את
        התרגיל יוכל ללחוץ ולפתוח אותו בכרטיסייה חדשה.
      </p>
    </div>
  );
}

export function ExerciseDemoDialog({
  exercise,
  onClose,
  editableBy,
}: {
  exercise: StrengthExercise;
  onClose: () => void;
  editableBy?: string;
}) {
  const [playing, setPlaying] = useState(true);
  const { overrides } = useExerciseGifOverrides();
  const category = findCategory(exercise.category);
  const hasRealGif = Boolean(resolveGifUrl(exercise, overrides));

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
            <p className="truncate text-sm text-muted">{exercise.instructions}</p>
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
            {hasRealGif ? null : (
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
            )}
          </div>

          <div className="rounded-xl bg-elevated p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">ניקוד</p>
            <p dir="rtl" className="mt-1 text-sm text-ink">
              {scoringHint(exercise)}
            </p>
          </div>

          {exercise.instructions ? (
            <div className="rounded-xl bg-elevated p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">איך מבצעים</p>
              <p dir="rtl" className="mt-1 text-sm leading-relaxed text-ink">
                {exercise.instructions}
              </p>
            </div>
          ) : null}

          <p className="text-xs text-muted">{LEVEL_LABELS[exercise.level].name}</p>

          {editableBy ? <GifLinkEditor exercise={exercise} trainerId={editableBy} /> : null}
        </div>
      </div>
    </div>
  );
}
