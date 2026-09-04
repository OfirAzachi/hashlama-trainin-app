'use client';

import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Dumbbell, Footprints, Loader2, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { addQuickLog, removeQuickLog } from '@/app/actions';
import { Badge, Card, CardHeader } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import { quickLogPoints } from '@/lib/points';
import type { Participant, QuickActivity, QuickLog } from '@/lib/types';

const ACTIVITIES: Array<{
  value: QuickActivity;
  label: string;
  icon: typeof Footprints;
  /** Label for the single number field, and the unit shown inside it. */
  fieldLabel: string;
  unit: string;
}> = [
  { value: 'running', label: 'ריצה', icon: Footprints, fieldLabel: 'כמה רצתם?', unit: 'מטר' },
  {
    value: 'pushups',
    label: 'שכיבות סמיכה',
    icon: Dumbbell,
    fieldLabel: 'כמה שכיבות סמיכה ביצעתם?',
    unit: 'חזרות',
  },
];

/** "3.2 ק״מ" / "450 מ׳" — the same distance wording used across the app. */
function distanceLabel(meters: number): string {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(meters % 1000 === 0 ? 0 : 1)} ק״מ`
    : `${meters} מ׳`;
}

function logSummary(log: QuickLog): string {
  return log.activity === 'running'
    ? distanceLabel(log.distance_meters ?? 0)
    : `${log.reps ?? 0} שכיבות סמיכה`;
}

/**
 * Log an activity on your own, with no training behind it: a run (just the
 * distance) or a set of push-ups (just the total). Unlimited entries, and
 * every point goes straight into the group's standing like any other point.
 */
export default function QuickLogCard({
  participant,
  logs,
}: {
  participant: Participant;
  logs: QuickLog[];
}) {
  const [activity, setActivity] = useState<QuickActivity>('running');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  // The card renders from its own list, so adding and removing land instantly
  // with no route refresh — a refresh here would flash the page's loading UI.
  // Points shown elsewhere on the page catch up on the next visit.
  const [entries, setEntries] = useState(logs);

  const active = ACTIVITIES.find((entry) => entry.value === activity)!;
  const parsed = Number(value);
  const preview = quickLogPoints(activity, parsed, participant.gender);
  const totalPoints = entries.reduce((sum, log) => sum + log.points, 0);

  const add = useMutation({
    mutationFn: async () => {
      const result = await addQuickLog(participant.id, activity, parsed);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (log) => {
      setError(null);
      setSaved(log.points);
      setValue('');
      setEntries((current) => [log, ...current]);
    },
    onError: (mutationError: Error) => {
      setSaved(null);
      setError(mutationError.message);
    },
  });

  const remove = useMutation({
    mutationFn: async (logId: string) => {
      const result = await removeQuickLog(logId, participant.id);
      if (!result.ok) throw new Error(result.error);
      return logId;
    },
    onSuccess: (logId) => {
      setError(null);
      setSaved(null);
      setEntries((current) => current.filter((log) => log.id !== logId));
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  return (
    <Card>
      <CardHeader
        icon={<Plus className="h-4 w-4" />}
        title="רישום פעילות עצמאית"
        subtitle="ריצה או שכיבות סמיכה שעשיתם בעצמכם — בלי קשר לאימוני השבוע"
        action={totalPoints > 0 ? <Badge tone="accent">{totalPoints} נק׳</Badge> : null}
      />

      <div className="card-pad space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {ACTIVITIES.map(({ value: entry, label, icon: Icon }) => (
            <button
              key={entry}
              type="button"
              aria-pressed={activity === entry}
              onClick={() => {
                setActivity(entry);
                setValue('');
                setSaved(null);
                setError(null);
              }}
              className={cn(
                'flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-medium transition-colors',
                activity === entry
                  ? 'border-accent bg-accent/5 text-accent ring-1 ring-accent/30'
                  : 'border-line bg-surface text-muted hover:bg-elevated',
              )}
            >
              <Icon aria-hidden className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-ink">{active.fieldLabel}</span>
          <div className="relative">
            <input
              className="input h-12 pe-16 text-base tnum"
              inputMode="numeric"
              placeholder="0"
              aria-label={active.fieldLabel}
              value={value}
              onChange={(event) => {
                setValue(event.target.value.replace(/[^\d]/g, ''));
                setSaved(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && preview > 0 && !add.isPending) add.mutate();
              }}
            />
            <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted">
              {active.unit}
            </span>
          </div>
        </label>

        {preview > 0 ? (
          <p className="text-xs text-muted tnum">
            שווה <span className="font-semibold text-ink">{preview} נקודות</span> לקבוצה שלכם.
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
            <TriangleAlert aria-hidden className="h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        {saved !== null ? (
          <p role="status" className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 aria-hidden className="h-4 w-4" />
            נרשם — {saved} נקודות נוספו לקבוצה שלכם.
          </p>
        ) : null}

        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => add.mutate()}
          disabled={preview <= 0 || add.isPending}
        >
          {add.isPending ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          ) : (
            <Plus aria-hidden className="h-4 w-4" />
          )}
          {add.isPending ? 'רושם…' : 'רישום הפעילות'}
        </button>

        {participant.gender === 'נ' ? (
          <p className="text-[11px] text-accent">הניקוד שלך כולל מכפיל ×1.5.</p>
        ) : null}
      </div>

      {entries.length > 0 ? (
        <div className="border-t border-line">
          <ul className="divide-y divide-line">
            {entries.slice(0, 5).map((log) => (
              <li key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-muted">
                  {log.activity === 'running' ? (
                    <Footprints aria-hidden className="h-4 w-4" />
                  ) : (
                    <Dumbbell aria-hidden className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink tnum">{logSummary(log)}</p>
                  <p suppressHydrationWarning className="text-xs text-muted">
                    {formatRelativeTime(log.created_at)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-ink tnum">{log.points} נק׳</span>
                <button
                  type="button"
                  onClick={() => remove.mutate(log.id)}
                  disabled={remove.isPending}
                  aria-label={`מחיקת הרישום — ${logSummary(log)}`}
                  className="btn-ghost h-8 w-8 shrink-0 p-0 text-muted hover:text-rose-500 disabled:opacity-40"
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
