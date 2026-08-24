'use client';

import { Download, ListFilter, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Avatar, Badge, Card, CardHeader, EmptyState, GroupBadge } from '@/components/ui/primitives';
import { formatDate, formatMetric } from '@/lib/format';
import { GROUP_LIST } from '@/lib/groups';
import { logsToCsv } from '@/lib/metrics';
import type { GroupId, Participant, SessionLog, TrainingSession } from '@/lib/types';

interface LogsTableProps {
  logs: SessionLog[];
  participants: Participant[];
  sessions: TrainingSession[];
  /** Participant view hides the athlete column and group filter. */
  showParticipantColumn?: boolean;
  pageSize?: number;
}

function rpeTone(rpe: number) {
  if (rpe <= 5) return 'positive' as const;
  if (rpe <= 8) return 'warning' as const;
  return 'negative' as const;
}

/** Inspect, filter and export individual session logs. */
export default function LogsTable({
  logs,
  participants,
  sessions,
  showParticipantColumn = true,
  pageSize = 25,
}: LogsTableProps) {
  const [group, setGroup] = useState<GroupId | 'all'>('all');
  const [participantId, setParticipantId] = useState<string>('all');
  const [sessionId, setSessionId] = useState<string>('all');
  const [exercise, setExercise] = useState<string>('all');
  const [visible, setVisible] = useState(pageSize);

  const participantById = useMemo(
    () => new Map(participants.map((person) => [person.id, person])),
    [participants],
  );
  const sessionById = useMemo(
    () => new Map(sessions.map((session) => [session.id, session])),
    [sessions],
  );

  const exerciseNames = useMemo(
    () => [...new Set(logs.map((log) => log.exercise_name))].sort((a, b) => a.localeCompare(b)),
    [logs],
  );

  const eligibleParticipants = useMemo(
    () =>
      participants.filter((person) => group === 'all' || person.team === group),
    [participants, group],
  );

  const filtered = useMemo(
    () =>
      logs.filter((log) => {
        const person = participantById.get(log.user_id);
        if (group !== 'all' && person?.team !== group) return false;
        if (participantId !== 'all' && log.user_id !== participantId) return false;
        if (sessionId !== 'all' && log.session_id !== sessionId) return false;
        if (exercise !== 'all' && log.exercise_name !== exercise) return false;
        return true;
      }),
    [logs, group, participantId, sessionId, exercise, participantById],
  );

  const downloadCsv = () => {
    const csv = logsToCsv(filtered, participants, sessions);
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hashlama-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card as="section">
      <CardHeader
        icon={<Table2 className="h-4 w-4" />}
        title="תוצאות שהועלו"
        subtitle="כל התוצאות שהועלו. אפשר לסנן או לייצא ל-CSV."
        action={
          <button type="button" className="btn-secondary" onClick={downloadCsv} disabled={filtered.length === 0}>
            <Download aria-hidden className="h-4 w-4" />
            ייצוא CSV
          </button>
        }
      />

      {/* ------------------------------------------------------- filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
        <ListFilter aria-hidden className="h-4 w-4 text-muted" />

        {showParticipantColumn ? (
          <>
            <select
              className="input w-auto"
              value={group}
              onChange={(event) => {
                setGroup(event.target.value as GroupId | 'all');
                setParticipantId('all');
              }}
              aria-label="סינון לפי קבוצה"
            >
              <option value="all">כל הקבוצות</option>
              {GROUP_LIST.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>

            <select
              className="input w-auto"
              value={participantId}
              onChange={(event) => setParticipantId(event.target.value)}
              aria-label="סינון לפי מתאמן"
            >
              <option value="all">כל המתאמנים</option>
              {eligibleParticipants.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </>
        ) : null}

        <select
          className="input w-auto"
          value={sessionId}
          onChange={(event) => setSessionId(event.target.value)}
          aria-label="סינון לפי אימון"
        >
          <option value="all">כל האימונים</option>
          {[...sessions]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((session) => (
              <option key={session.id} value={session.id}>
                שבוע {session.week_index} · {session.title}
              </option>
            ))}
        </select>

        <select
          className="input w-auto"
          value={exercise}
          onChange={(event) => setExercise(event.target.value)}
          aria-label="סינון לפי תרגיל"
        >
          <option value="all">כל התרגילים</option>
          {exerciseNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <Badge tone="neutral" className="ms-auto">
          {filtered.length} רשומות
        </Badge>
      </div>

      {/* --------------------------------------------------------- table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Table2 className="h-6 w-6" />}
          title="אין רשומות שתואמות לסינון"
          description="הרחיבו את הסינון או בחרו אימון אחר."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-start">
                  <th scope="col" className="label px-4 py-2.5">תאריך</th>
                  {showParticipantColumn ? (
                    <th scope="col" className="label px-4 py-2.5">מתאמן</th>
                  ) : null}
                  <th scope="col" className="label px-4 py-2.5">אימון</th>
                  <th scope="col" className="label px-4 py-2.5">תרגיל</th>
                  <th scope="col" className="label px-4 py-2.5 text-end">תוצאה</th>
                  <th scope="col" className="label px-4 py-2.5 text-end">RPE</th>
                  <th scope="col" className="label px-4 py-2.5">הערות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, visible).map((log) => {
                  const person = participantById.get(log.user_id);
                  const session = sessionById.get(log.session_id);
                  return (
                    <tr key={log.id} className="border-b border-line/60 last:border-0 hover:bg-elevated/60">
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted tnum">
                        {session ? formatDate(session.date, { year: undefined }) : '—'}
                      </td>
                      {showParticipantColumn ? (
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2">
                            <Avatar name={person?.name ?? '??'} groupId={person?.team} size="sm" />
                            <span className="whitespace-nowrap font-medium text-ink">
                              {person?.name ?? 'Unknown'}
                            </span>
                            {person ? <GroupBadge groupId={person.team} short /> : null}
                          </span>
                        </td>
                      ) : null}
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                        W{session?.week_index ?? "?"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink">{log.exercise_name}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-end font-medium text-ink tnum">
                        {formatMetric(log.metric_value, log.metric_type)}
                      </td>
                      <td className="px-4 py-2.5 text-end">
                        <Badge tone={rpeTone(log.rpe)}>{log.rpe}</Badge>
                      </td>
                      <td className="max-w-[18rem] truncate px-4 py-2.5 text-muted" title={log.notes ?? ''}>
                        {log.notes ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {visible < filtered.length ? (
            <div className="border-t border-line p-3 text-center">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setVisible((current) => current + pageSize)}
              >
                הצגת {Math.min(pageSize, filtered.length - visible)} נוספות
              </button>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
