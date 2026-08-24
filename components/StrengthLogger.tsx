'use client';

import { useMutation } from '@tanstack/react-query';
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Target,
  Timer as TimerIcon,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import ExerciseAnimation from '@/components/ExerciseAnimation';
import { ExerciseDemoButton, LevelBadge } from '@/components/ExerciseDemo';
import { Badge, Card, CardHeader, ProgressBar } from '@/components/ui/primitives';
import { submitStrengthWorkout } from '@/app/actions';
import { cn } from '@/lib/cn';
import { formatDate, formatDuration } from '@/lib/format';
import { repsFromRaw } from '@/lib/points';
import {
  CATALOG_META,
  catalogCategories,
  catalogExercises,
  describeRoundTiming,
  findCategory,
  findExercise,
  hasFixedExercises,
  roundCount,
  type CategoryId,
} from '@/lib/catalog';
import { scoringHint, type StrengthExercise, type StrengthLevel } from '@/lib/strength-catalog';
import type { CatalogKind, Participant, StrengthLog, TrainingSession } from '@/lib/types';

interface RoundDraft {
  exerciseId: string | null;
  raw: string;
}

const UNIT_STEP: Record<string, number> = { reps: 1, seconds: 5, meters: 2 };

function unitLabel(exercise: StrengthExercise): string {
  return exercise.unit === 'seconds' ? 'שניות' : exercise.unit === 'meters' ? 'מטר' : 'חזרות';
}

/* ------------------------------------------------------ interval timer */

function IntervalTimer({
  workSeconds,
  restSeconds,
  rounds,
  onRoundStart,
}: {
  /** One entry per round — an interval's timing is its own, not shared. */
  workSeconds: number[];
  restSeconds: number[];
  rounds: number;
  onRoundStart: (round: number) => void;
}) {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<'work' | 'rest'>('work');
  const [round, setRound] = useState(0);
  const workFor = (r: number) => workSeconds[r] ?? workSeconds[0] ?? 40;
  const restFor = (r: number) => restSeconds[r] ?? restSeconds[0] ?? 20;
  const [remaining, setRemaining] = useState(() => workFor(0));
  const onRoundStartRef = useRef(onRoundStart);
  onRoundStartRef.current = onRoundStart;

  useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => {
      setRemaining((current) => {
        if (current > 1) return current - 1;
        // Phase finished: work -> rest, rest -> next round's work.
        let nextRound = round;
        setPhase((currentPhase) => {
          if (currentPhase === 'work') return 'rest';
          setRound((currentRound) => {
            const next = Math.min(rounds - 1, currentRound + 1);
            nextRound = next;
            onRoundStartRef.current(next);
            return next;
          });
          return 'work';
        });
        return phase === 'work' ? restFor(round) : workFor(nextRound);
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase, round, rounds]);

  const reset = () => {
    setRunning(false);
    setPhase('work');
    setRound(0);
    setRemaining(workFor(0));
  };

  const total = phase === 'work' ? workFor(round) : restFor(round);

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition-colors',
        phase === 'work' && running
          ? 'border-accent/50 bg-accent/10'
          : 'border-line bg-elevated',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {phase === 'work' ? 'עבודה' : 'מנוחה ורישום'} · סבב {round + 1} מתוך {rounds}
          </p>
          <p className="text-4xl font-semibold tnum text-ink" aria-live="polite">
            {formatDuration(remaining)}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="btn-primary h-12 w-12 p-0"
            onClick={() => setRunning((current) => !current)}
            aria-label={running ? 'עצירת הטיימר' : 'הפעלת הטיימר'}
          >
            {running ? <Pause aria-hidden className="h-5 w-5" /> : <Play aria-hidden className="h-5 w-5" />}
          </button>
          <button
            type="button"
            className="btn-secondary h-12 w-12 p-0"
            onClick={reset}
            aria-label="איפוס הטיימר"
          >
            <RotateCcw aria-hidden className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-3">
        <ProgressBar
          value={((total - remaining) / total) * 100}
          color={phase === 'work' ? 'rgb(var(--accent))' : '#22a06b'}
          label="הזמן שנותר באינטרוול"
        />
      </div>
      <p className="mt-2 text-xs text-muted tnum">
        {workFor(round)} שנ׳ עבודה · {restFor(round)} שנ׳ מנוחה ורישום התוצאה
      </p>
    </div>
  );
}

/* ---------------------------------------------------- exercise picker */

function ExercisePicker({
  catalog,
  category,
  allowedLevels,
  onPick,
  onClose,
  round,
}: {
  catalog: CatalogKind;
  /** The muscle/heart-rate group the trainer assigned to this round. */
  category: CategoryId;
  allowedLevels: StrengthLevel[];
  onPick: (exercise: StrengthExercise) => void;
  onClose: () => void;
  round: number;
}) {
  const categoryInfo = findCategory(category);
  const [level, setLevel] = useState<StrengthLevel | 'all'>('all');

  const list = useMemo(
    () =>
      catalogExercises(catalog).filter(
        (exercise) =>
          exercise.category === category &&
          allowedLevels.includes(exercise.level) &&
          (level === 'all' || exercise.level === level),
      ),
    [catalog, category, level, allowedLevels],
  );

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
      aria-label={`בחירת תרגיל לסבב ${round + 1}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-surface sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">
              סבב {round + 1} — {categoryInfo?.name}
            </p>
            <p className="text-xs text-muted">
              המאמנת קבעה שבסבב הזה עובדים {categoryInfo?.name}. בחרו תרגיל שאתם יכולים לבצע בבטחה —
              רמה גבוהה יותר = יותר נקודות לחזרה.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost h-9 w-9 p-0" aria-label="סגירה">
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        {/* level filter */}
        <div className="space-y-2 border-b border-line px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setLevel('all')}
              aria-pressed={level === 'all'}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                level === 'all' ? 'border-accent text-accent' : 'border-line text-muted hover:text-ink',
              )}
            >
              כל הרמות
            </button>
            {allowedLevels.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setLevel(entry)}
                aria-pressed={level === entry}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  level === entry ? 'border-accent text-accent' : 'border-line text-muted hover:text-ink',
                )}
              >
                רמה {entry} · ×{entry}
              </button>
            ))}
          </div>
        </div>

        <ul className="divide-y divide-line overflow-y-auto">
          {list.map((exercise) => (
            <li key={exercise.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="h-14 w-16 shrink-0 rounded-lg bg-elevated p-1">
                <ExerciseAnimation exercise={exercise} className="h-full" />
              </span>

              <button
                type="button"
                onClick={() => onPick(exercise)}
                className="min-w-0 flex-1 text-start"
              >
                <span dir="rtl" className="block truncate text-sm font-medium text-ink">
                  {exercise.name}
                </span>
                <span className="block truncate text-xs text-muted">{exercise.nameEn}</span>
                <span className="mt-1 flex items-center gap-1.5">
                  <LevelBadge level={exercise.level} />
                  <span className="text-[11px] text-muted">{scoringHint(exercise)}</span>
                </span>
              </button>

              <ExerciseDemoButton exercise={exercise} />
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted rtl:rotate-180" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ logger */

/**
 * The points game for a strength training: the trainer opens a set of
 * categories and levels, and the participant fills each interval slot with the
 * exercise they choose. Points = reps x level — there's no goal to unlock,
 * every point just accumulates toward the group's standing on the home page.
 */
export default function StrengthLogger({
  session,
  participant,
  myLogs,
}: {
  session: TrainingSession;
  participant: Participant;
  myLogs: StrengthLog[];
}) {
  const router = useRouter();
  const config = session.points_game;

  const fixedExercises = config ? hasFixedExercises(config.catalog) : false;

  const [drafts, setDrafts] = useState<RoundDraft[]>(() => {
    const rounds = config ? roundCount(config) : 0;
    return Array.from({ length: rounds }, (_, index) => {
      const existing = myLogs.find((log) => log.round_index === index);
      // Warm-up/cool-down: the trainer already fixed the exercise per round —
      // there is nothing for the participant to pick.
      const fixedId = config && fixedExercises ? config.round_exercise_ids[index] : null;
      return {
        exerciseId: existing?.exercise_id ?? fixedId ?? null,
        raw: existing ? String(existing.raw_value) : '',
      };
    });
  });
  const [pickerRound, setPickerRound] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  const scored = useMemo(
    () =>
      drafts.map((draft) => {
        const exercise = draft.exerciseId ? findExercise(draft.exerciseId) : undefined;
        const raw = Number(draft.raw);
        if (!exercise || !Number.isFinite(raw) || raw <= 0) {
          return { exercise, reps: 0, points: 0 };
        }
        const reps = repsFromRaw(exercise, raw);
        return { exercise, reps, points: reps * exercise.level };
      }),
    [drafts],
  );

  const myTotal = scored.reduce((sum, entry) => sum + entry.points, 0);
  const filled = scored.filter((entry) => entry.points > 0).length;

  const setRaw = (index: number, raw: string) =>
    setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, raw } : draft)));

  const bump = (index: number, step: number) =>
    setDrafts((current) =>
      current.map((draft, i) => {
        if (i !== index) return draft;
        const value = Math.max(0, (Number(draft.raw) || 0) + step);
        return { ...draft, raw: value === 0 ? '' : String(value) };
      }),
    );

  const pick = (index: number, exercise: StrengthExercise) => {
    setDrafts((current) =>
      current.map((draft, i) => (i === index ? { exerciseId: exercise.id, raw: draft.raw } : draft)),
    );
    setPickerRound(null);
  };

  const clearRound = (index: number) =>
    setDrafts((current) =>
      current.map((draft, i) => (i === index ? { exerciseId: null, raw: '' } : draft)),
    );

  const save = useMutation({
    mutationFn: async () => {
      const entries = drafts
        .map((draft, index) => ({ draft, index }))
        .filter(({ draft }) => draft.exerciseId && Number(draft.raw) > 0)
        .map(({ draft, index }) => ({
          session_id: session.id,
          user_id: participant.id,
          round_index: index,
          exercise_id: draft.exerciseId!,
          raw_value: Number(draft.raw),
        }));

      if (entries.length === 0) {
        throw new Error('בחרו תרגיל ורשמו מה ביצעתם לפחות בסבב אחד.');
      }

      const result = await submitStrengthWorkout(entries);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (created) => {
      setError(null);
      setSaved(created.reduce((sum, log) => sum + log.points, 0));
      router.refresh();
    },
    onError: (mutationError: Error) => {
      setSaved(null);
      setError(mutationError.message);
    },
  });

  if (!config) {
    return (
      <Card className="card-pad">
        <p className="text-sm text-muted">לאימון הזה לא הוגדר משחק נקודות.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* -------------------------------------------------- the brief */}
      <Card>
        <CardHeader
          icon={<Sparkles className="h-4 w-4" />}
          title={session.title}
          subtitle={`משחק נקודות · שבוע ${session.week_index} · ${formatDate(session.date)}`}
          action={<Badge tone="accent">{CATALOG_META[config.catalog].label}</Badge>}
        />
        <div className="card-pad space-y-3">
          <p dir="rtl" className="text-sm leading-relaxed text-muted">
            {session.workout_instructions}
          </p>

          <p className="tnum text-xs text-muted">{describeRoundTiming(config)}</p>
          <div className="grid grid-cols-1 gap-2 text-center">
            <div className="rounded-xl bg-elevated p-2.5">
              <p className="text-lg font-semibold tnum text-ink">{roundCount(config)}</p>
              <p className="text-[11px] text-muted">סבבים</p>
            </div>
          </div>

          <p className="rounded-xl bg-accent/10 px-3 py-2 text-xs text-accent">
            {fixedExercises
              ? 'המאמנת קבעה תרגיל אחד לכל סבב — פשוט מבצעים ורושמים. נקודות = חזרות × רמה, כל 5 שניות = חזרה אחת.'
              : 'נקודות = חזרות × רמה. בתרגילים סטטיים: כל 5 שניות = חזרה אחת. זחילת דוב: כל 2 מטר = חזרה אחת.'}
          </p>
        </div>
      </Card>

      {/* ---------------------------------------------------- timer */}
      <IntervalTimer
        workSeconds={config.round_work_seconds}
        restSeconds={config.round_rest_seconds}
        rounds={roundCount(config)}
        onRoundStart={(round) => {
          const element = document.getElementById(`round-${round}`);
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
      />

      {/* ---------------------------------------------------- rounds */}
      <ol className="space-y-3">
        {drafts.map((draft, index) => {
          const entry = scored[index];
          const exercise = entry.exercise;

          return (
            <li key={index} id={`round-${index}`}>
              <Card className={cn('overflow-hidden', entry.points > 0 && 'border-emerald-500/40')}>
                <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                  <p className="text-sm font-semibold text-ink">סבב {index + 1}</p>
                  {entry.points > 0 ? (
                    <Badge tone="positive">
                      <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
                      {entry.points} נקודות
                    </Badge>
                  ) : (
                    <Badge tone="neutral">עדיין לא מולא</Badge>
                  )}
                </div>

                {!exercise ? (
                  <button
                    type="button"
                    onClick={() => setPickerRound(index)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-4 text-start hover:bg-elevated"
                  >
                    <span>
                      <span className="block text-sm font-medium text-ink">
                        בחרו תרגיל — {findCategory(config.round_categories[index])?.name}
                      </span>
                      <span className="block text-xs text-muted">
                        זו קבוצת השריר שהמאמנת קבעה לסבב הזה
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="h-5 w-5 text-muted rtl:rotate-180" />
                  </button>
                ) : (
                  <div className="space-y-3 p-4">
                    <div className="flex items-center gap-3">
                      <span className="h-16 w-20 shrink-0 rounded-xl bg-elevated p-1">
                        <ExerciseAnimation exercise={exercise} className="h-full" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p dir="rtl" className="truncate text-sm font-medium text-ink">
                          {exercise.name}
                        </p>
                        <p className="truncate text-xs text-muted">{exercise.nameEn}</p>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <LevelBadge level={exercise.level} />
                          <Badge tone="neutral">{findCategory(exercise.category)?.name}</Badge>
                        </span>
                      </div>

                      <ExerciseDemoButton exercise={exercise} />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn-secondary h-11 w-11 shrink-0 p-0"
                        aria-label={`הפחתה — ${exercise.name}`}
                        onClick={() => bump(index, -(UNIT_STEP[exercise.unit] ?? 1))}
                      >
                        <Minus aria-hidden className="h-4 w-4" />
                      </button>

                      <div className="relative flex-1">
                        <input
                          className="input h-11 pe-14 text-base tnum"
                          inputMode="numeric"
                          placeholder="0"
                          aria-label={`כמה ${unitLabel(exercise)} בסבב ${index + 1}`}
                          value={draft.raw}
                          onChange={(event) => setRaw(index, event.target.value.replace(/[^\d.]/g, ''))}
                        />
                        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                          {unitLabel(exercise)}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="btn-secondary h-11 w-11 shrink-0 p-0"
                        aria-label={`הוספה — ${exercise.name}`}
                        onClick={() => bump(index, UNIT_STEP[exercise.unit] ?? 1)}
                      >
                        <Plus aria-hidden className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted tnum">
                        {entry.reps} חזרות × רמה {exercise.level} ={' '}
                        <span className="font-semibold text-ink">{entry.points} נקודות</span>
                      </p>
                      {fixedExercises ? null : (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1 text-xs"
                            onClick={() => setPickerRound(index)}
                          >
                            החלפת תרגיל
                          </button>
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1 text-xs text-rose-500"
                            onClick={() => clearRound(index)}
                          >
                            ניקוי
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ol>

      {/* -------------------------------------------------- team score */}
      <Card className="card-pad space-y-2">
        <div className="flex items-center gap-2">
          <Target aria-hidden className="h-4 w-4 text-muted" />
          <h3 className="text-sm font-semibold text-ink">נקודות לקבוצה</h3>
        </div>
        <p className="text-xs text-muted">
          אין יעד להשלים — כל נקודה שאתם רושמים כאן מצטרפת ישירות לניקוד הקבוצה שלכם בעמוד הבית.
        </p>
      </Card>

      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
          <TriangleAlert aria-hidden className="h-4 w-4" />
          {error}
        </p>
      ) : null}

      {saved !== null ? (
        <p role="status" className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 aria-hidden className="h-4 w-4" />
          נשמר — צברת {saved} נקודות לקבוצה.
        </p>
      ) : null}

      {/* ------------------------------------------------ sticky save */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 p-3 backdrop-blur sm:sticky sm:bottom-4 sm:rounded-2xl sm:border">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex items-center gap-2">
            <TimerIcon aria-hidden className="h-4 w-4 text-muted" />
            <div>
              <p className="text-lg font-semibold leading-tight tnum text-ink">{myTotal} נק׳</p>
              <p className="text-[11px] text-muted tnum">
                {filled}/{roundCount(config)} סבבים מולאו
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary ms-auto"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <Save aria-hidden className="h-4 w-4" />
            )}
            {save.isPending ? 'שומר…' : 'שמירת הנקודות שלי'}
          </button>
        </div>
      </div>

      {pickerRound !== null ? (
        <ExercisePicker
          catalog={config.catalog}
          round={pickerRound}
          category={config.round_categories[pickerRound]}
          allowedLevels={config.allowed_levels}
          onPick={(exercise) => pick(pickerRound, exercise)}
          onClose={() => setPickerRound(null)}
        />
      ) : null}
    </div>
  );
}
