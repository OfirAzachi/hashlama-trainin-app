'use client';

import { CheckCircle2, CircleDashed, ClipboardCheck } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Avatar, Badge, Card, CardHeader, ProgressBar } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import type { Participant, SessionLog, StrengthLog, TrainingSession } from '@/lib/types';

/**
 * Who has uploaded results for a given week. Anyone without an upload is
 * listed as not completed — that is the whole definition of completion here.
 */
export default function WeekCompletion({
  sessions,
  participants,
  logs,
  strengthLogs,
}: {
  sessions: TrainingSession[];
  participants: Participant[];
  logs: SessionLog[];
  strengthLogs: StrengthLog[];
}) {
  const ordered = useMemo(
    () => [...sessions].sort((a, b) => b.date.localeCompare(a.date)),
    [sessions],
  );
  const [sessionId, setSessionId] = useState(ordered[0]?.id ?? '');
  const session = ordered.find((entry) => entry.id === sessionId) ?? ordered[0] ?? null;

  const { done, missing } = useMemo(() => {
    if (!session) return { done: [] as Participant[], missing: [] as Participant[] };
    // Aerobic trainings are completed by uploading results, strength ones by
    // banking points — either way it is an upload that counts.
    const source =
      session.training_type === 'strength'
        ? strengthLogs.map((log) => ({ session_id: log.session_id, user_id: log.user_id }))
        : logs.map((log) => ({ session_id: log.session_id, user_id: log.user_id }));
    const uploaded = new Set(
      source.filter((log) => log.session_id === session.id).map((log) => log.user_id),
    );
    return {
      done: participants.filter((person) => uploaded.has(person.id)),
      missing: participants.filter((person) => !uploaded.has(person.id)),
    };
  }, [session, logs, strengthLogs, participants]);

  if (!session) return null;

  const rate = participants.length > 0 ? done.length / participants.length : 0;

  return (
    <Card as="section">
      <CardHeader
        icon={<ClipboardCheck className="h-4 w-4" />}
        title="מי השלים את האימון"
        subtitle="אימון נחשב כהושלם רק אחרי שהועלו תוצאות."
        action={
          <select
            className="input w-auto"
            value={session.id}
            onChange={(event) => setSessionId(event.target.value)}
            aria-label="בחירת האימון לבדיקה"
          >
            {ordered.map((entry) => (
              <option key={entry.id} value={entry.id}>
                שבוע {entry.week_index} · {entry.title}
              </option>
            ))}
          </select>
        }
      />

      <div className="card-pad space-y-4">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-2xl font-semibold tnum text-ink">
              {done.length}
              <span className="text-base font-normal text-muted">/{participants.length}</span>
              <span className="ms-2 text-sm font-normal text-muted">העלו תוצאות</span>
            </p>
            <p className="text-xs text-muted tnum">{formatDate(session.date)}</p>
          </div>
          <div className="mt-2">
            <ProgressBar value={rate * 100} label="שיעור ההשלמה של האימון" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
              הושלם ({done.length})
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {done.map((person) => (
                <li
                  key={person.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-elevated py-1 ps-1 pe-2.5"
                >
                  <Avatar name={person.name} groupId={person.team} size="sm" />
                  <span className="text-xs text-ink">{person.name}</span>
                </li>
              ))}
              {done.length === 0 ? <li className="text-xs text-muted">עדיין אף אחד.</li> : null}
            </ul>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <CircleDashed aria-hidden className="h-3.5 w-3.5" />
              לא הושלם ({missing.length})
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {missing.map((person) => (
                <li
                  key={person.id}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border border-dashed border-line py-1 ps-1 pe-2.5',
                  )}
                >
                  <Avatar name={person.name} groupId={person.team} size="sm" />
                  <span className="text-xs text-muted">{person.name}</span>
                </li>
              ))}
              {missing.length === 0 ? (
                <li>
                  <Badge tone="positive">כולם העלו תוצאות</Badge>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}
