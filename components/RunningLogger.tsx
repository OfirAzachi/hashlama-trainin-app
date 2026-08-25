'use client';

import { useMutation } from '@tanstack/react-query';
import {
  CheckCircle2,
  Flag,
  Loader2,
  Minus,
  Plus,
  Save,
  Target,
  Timer,
  TriangleAlert,
  Trophy,
} from 'lucide-react';
import { startTransition, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { submitRunningWorkout } from '@/app/actions';
import { Badge, Card, CardHeader, DurationInput } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { formatDate, formatDuration, paceFromRun, parseDuration, secondsFromPace } from '@/lib/format';
import { PACE_LABELS, scoreSegment, segmentDistance, segmentSummary, segmentsForGroup } from '@/lib/running';
import type { Participant, RunningLog, RunningSegment, TrainingSession } from '@/lib/types';

/** Whichever field the athlete last typed into for a segment. */
interface TimeOrPaceInput {
  raw: string;
  source: 'time' | 'pace';
}

function distanceLabel(meters: number): string {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(meters % 1000 === 0 ? 0 : 1)} ק״מ`
    : `${meters} מ׳`;
}

/**
 * Logging screen for a running training: one card per prescribed segment.
 * The trainer dictates the pace as a category (walk / talk-pace jog / easy
 * run / sprint) rather than a number; the participant confirms repeats and
 * records what they actually ran — either the time it took or the pace they
 * held, whichever is easier to read off a watch — and the other value is
 * derived automatically from the segment's distance. Points = (metres / 100)
 * × the pace category's weight — pure competition, no team goal to unlock.
 */
export default function RunningLogger({
  session,
  participant,
  myLogs,
}: {
  session: TrainingSession;
  participant: Participant;
  myLogs: RunningLog[];
}) {
  const router = useRouter();
  const config = session.running;

  /** Only the segments prescribed to this participant's group. */
  const segments: RunningSegment[] = useMemo(
    () => segmentsForGroup(config, participant.team),
    [config, participant.team],
  );

  const [repeatsById, setRepeatsById] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      segments.map((segment) => {
        const existing = myLogs.find((log) => log.segment_id === segment.id);
        return [segment.id, String(existing?.repeats_done ?? segment.repeats)];
      }),
    ),
  );
  const [inputBySegment, setInputBySegment] = useState<Record<string, TimeOrPaceInput>>(() =>
    Object.fromEntries(
      segments.map((segment) => {
        const existing = myLogs.find((log) => log.segment_id === segment.id);
        return [
          segment.id,
          existing
            ? { raw: formatDuration(existing.actual_seconds), source: 'time' as const }
            : { raw: '', source: 'time' as const },
        ];
      }),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  const scored = useMemo(
    () =>
      segments.map((segment) => {
        const repeats = Number(repeatsById[segment.id] ?? 0);
        if (!Number.isFinite(repeats) || repeats < 1) {
          return { segment, repeats: 0, score: null };
        }
        return { segment, repeats, score: scoreSegment(segment, repeats) };
      }),
    [segments, repeatsById],
  );

  const myTotal = scored.reduce((sum, entry) => sum + (entry.score?.points ?? 0), 0);
  const myDistance = scored.reduce((sum, entry) => sum + (entry.score?.total_distance_meters ?? 0), 0);
  const filled = scored.filter((entry) => entry.score && entry.score.points > 0).length;

  /** Distance actually run for a segment, from the repeats currently entered. */
  const distanceFor = (segment: RunningSegment): number => {
    const repeats = Number(repeatsById[segment.id] ?? 0);
    const clamped = Math.max(0, Math.min(segment.repeats, Math.floor(repeats) || 0));
    return segmentDistance(segment, clamped);
  };

  /** The canonical time (seconds) for a segment, from whichever field the athlete last typed. */
  const actualSecondsFor = (segment: RunningSegment): number => {
    const input = inputBySegment[segment.id];
    const parsed = input ? parseDuration(input.raw) : null;
    if (parsed == null) return 0;
    if (input!.source === 'time') return Math.max(0, parsed);
    const distance = distanceFor(segment);
    return distance > 0 ? Math.max(0, secondsFromPace(parsed, distance)) : 0;
  };

  const bumpRepeats = (segment: RunningSegment, step: number) =>
    setRepeatsById((current) => {
      const value = Number(current[segment.id] ?? 0) + step;
      return { ...current, [segment.id]: String(Math.max(0, Math.min(segment.repeats, value))) };
    });

  const setSegmentInput = (segmentId: string, source: 'time' | 'pace', raw: string) =>
    setInputBySegment((current) => ({ ...current, [segmentId]: { raw, source } }));

  const save = useMutation({
    mutationFn: async () => {
      const entries = scored
        .filter((entry) => entry.score && entry.score.points > 0)
        .map((entry, index) => ({
          session_id: session.id,
          user_id: participant.id,
          segment_id: entry.segment.id,
          segment_index: index,
          repeats_done: entry.repeats,
          actual_seconds: actualSecondsFor(entry.segment),
        }));

      if (entries.length === 0) {
        throw new Error('סמנו לפחות מקטע אחד שהשלמתם.');
      }

      const result = await submitRunningWorkout(entries);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (created) => {
      setError(null);
      setSaved(created.reduce((sum, log) => sum + log.points, 0));
      startTransition(() => router.refresh());
    },
    onError: (mutationError: Error) => {
      setSaved(null);
      setError(mutationError.message);
    },
  });

  if (!config || segments.length === 0) {
    return (
      <Card className="card-pad">
        <p className="text-sm text-muted">לא הוגדרו מקטעי ריצה לקבוצה שלך באימון הזה.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* --------------------------------------------------- the brief */}
      <Card>
        <CardHeader
          icon={<Flag className="h-4 w-4" />}
          title={session.title}
          subtitle={`ריצה · שבוע ${session.week_index} · ${formatDate(session.date)}`}
          action={
            <Badge tone="accent">{config.mode === 'steady' ? 'ריצה אחידה' : 'אינטרוולים'}</Badge>
          }
        />
        <div className="card-pad space-y-3">
          <p className="text-sm leading-relaxed text-muted">{session.workout_instructions}</p>
          <p className="rounded-xl bg-accent/10 px-3 py-2 text-xs text-accent">
            נקודות = (מטרים ÷ 100) × משקל הקצב שהוגדר. אין יעד קבוצתי — זו תחרות, וכל נקודה נכנסת
            ישר לטבלת הקבוצות.
          </p>
        </div>
      </Card>

      {/* -------------------------------------------------- segments */}
      <ol className="space-y-3">
        {scored.map(({ segment, score }, index) => {
          const raw = repeatsById[segment.id] ?? '';
          const done = (score?.points ?? 0) > 0;

          const input = inputBySegment[segment.id] ?? { raw: '', source: 'time' as const };
          const distance = distanceFor(segment);
          const parsedInput = parseDuration(input.raw);
          const actualSeconds =
            parsedInput == null
              ? null
              : input.source === 'time'
                ? parsedInput
                : distance > 0
                  ? secondsFromPace(parsedInput, distance)
                  : null;
          const derivedPaceSeconds =
            actualSeconds != null && distance > 0 ? paceFromRun(actualSeconds, distance) : null;
          const timeValue = input.source === 'time' ? input.raw : actualSeconds != null ? formatDuration(actualSeconds) : '';
          const paceValue = input.source === 'pace' ? input.raw : derivedPaceSeconds != null ? formatDuration(derivedPaceSeconds) : '';

          return (
            <li key={segment.id}>
              <Card className={cn('overflow-hidden', done && 'border-emerald-500/40')}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-elevated text-xs font-semibold text-muted tnum">
                      {index + 1}
                    </span>
                    <p className="text-sm font-semibold text-ink">{segment.label}</p>
                    {segment.target_group !== 'all' ? (
                      <Badge tone="warning">חלופה לקבוצה שלך</Badge>
                    ) : null}
                  </div>
                  {done ? (
                    <Badge tone="positive">
                      <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
                      {score!.points} נקודות
                    </Badge>
                  ) : (
                    <Badge tone="neutral">עדיין לא נרשם</Badge>
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-elevated px-2 py-1">
                      {segmentSummary(segment)}
                    </span>
                    <Badge tone="accent">{PACE_LABELS[segment.pace_category]}</Badge>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor={`reps-${segment.id}`} className="text-sm font-medium text-ink">
                      חזרות שהושלמו
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn-secondary h-11 w-11 shrink-0 p-0"
                        aria-label={`הפחתת חזרות ב${segment.label}`}
                        onClick={() => bumpRepeats(segment, -1)}
                      >
                        <Minus aria-hidden className="h-4 w-4" />
                      </button>
                      <input
                        id={`reps-${segment.id}`}
                        className="input h-11 text-center tnum"
                        inputMode="numeric"
                        value={raw}
                        onChange={(event) =>
                          setRepeatsById((current) => ({
                            ...current,
                            [segment.id]: event.target.value.replace(/[^\d]/g, ''),
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="btn-secondary h-11 w-11 shrink-0 p-0"
                        aria-label={`הוספת חזרות ב${segment.label}`}
                        onClick={() => bumpRepeats(segment, 1)}
                      >
                        <Plus aria-hidden className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-[11px] text-muted tnum">מתוך {segment.repeats}</p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-sm font-medium text-ink">זמן שלקח (דק:שנ)</span>
                      <DurationInput
                        className="input h-11 text-center tnum"
                        placeholder="0:00"
                        aria-label={`זמן שלקח ב${segment.label}`}
                        value={timeValue}
                        onValueChange={(value) => setSegmentInput(segment.id, 'time', value)}
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-sm font-medium text-ink">קצב בפועל (דק:שנ / ק״מ)</span>
                      <DurationInput
                        className="input h-11 text-center tnum"
                        placeholder="0:00"
                        aria-label={`קצב בפועל ב${segment.label}`}
                        value={paceValue}
                        onValueChange={(value) => setSegmentInput(segment.id, 'pace', value)}
                      />
                    </label>
                  </div>
                  <p className="text-[11px] text-muted">
                    מזינים אחד מהשניים — השני מחושב לפי המרחק שרצתם.
                  </p>

                  {score && score.points > 0 ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-elevated p-3 text-xs">
                      <span className="tnum text-ink">{distanceLabel(score.total_distance_meters)}</span>
                      <span className="ms-auto font-semibold tnum text-ink">{score.points} נק׳</span>
                    </div>
                  ) : null}
                </div>
              </Card>
            </li>
          );
        })}
      </ol>

      {/* ------------------------------------------------- team score */}
      <Card className="card-pad space-y-2">
        <div className="flex items-center gap-2">
          <Target aria-hidden className="h-4 w-4 text-muted" />
          <h3 className="text-sm font-semibold text-ink">התחרות הקבוצתית</h3>
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

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 p-3 backdrop-blur sm:sticky sm:bottom-4 sm:rounded-2xl sm:border">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex items-center gap-2">
            <Timer aria-hidden className="h-4 w-4 text-muted" />
            <div>
              <p className="text-lg font-semibold leading-tight tnum text-ink">{myTotal} נק׳</p>
              <p className="text-[11px] text-muted tnum">
                {filled}/{segments.length} מקטעים · {distanceLabel(myDistance)}
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
            {save.isPending ? 'שומר…' : 'שמירת הריצה שלי'}
          </button>
        </div>
      </div>
    </div>
  );
}
