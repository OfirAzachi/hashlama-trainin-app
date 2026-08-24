'use client';

import { CalendarCheck, Flame, Gauge, Timer, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import BenchmarkDeltaCard from '@/components/BenchmarkDeltaCard';
import LogsTable from '@/components/LogsTable';
import { Badge, Card, CardHeader, StatCard } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import {
  METRIC_UNITS,
  formatDate,
  formatDuration,
  formatMetric,
  formatPace,
  formatPercent,
  formatSignedDuration,
  formatSignedNumber,
} from '@/lib/format';
import type { ParticipantSnapshot } from '@/lib/types';

/** Heat level for the consistency grid: unattended, or shaded by effort. */
function cellStyle(rpe: number | null): string {
  if (rpe === null) return 'bg-elevated text-muted';
  if (rpe <= 5) return 'bg-emerald-500/25 text-emerald-700 dark:text-emerald-300';
  if (rpe <= 7) return 'bg-amber-500/25 text-amber-700 dark:text-amber-300';
  return 'bg-rose-500/25 text-rose-700 dark:text-rose-300';
}

/** Personal progress: benchmark deltas, consistency and historical logs. */
export default function ParticipantDashboard({ snapshot }: { snapshot: ParticipantSnapshot }) {
  const { participant, sessions, logs, summary } = snapshot;
  const { delta } = summary;

  const exerciseNames = useMemo(
    () => [...new Set(logs.map((log) => log.exercise_name))].sort((a, b) => a.localeCompare(b)),
    [logs],
  );
  const [trendExercise, setTrendExercise] = useState<string>(exerciseNames[0] ?? '');

  /** Attendance + average RPE per session, oldest first. */
  const consistency = useMemo(
    () =>
      sessions.map((session) => {
        const sessionLogs = logs.filter((log) => log.session_id === session.id);
        const avgRpe =
          sessionLogs.length > 0
            ? sessionLogs.reduce((sum, log) => sum + log.rpe, 0) / sessionLogs.length
            : null;
        return {
          session,
          attended: sessionLogs.length > 0,
          avgRpe,
          entries: sessionLogs.length,
        };
      }),
    [sessions, logs],
  );

  const trendData = useMemo(() => {
    const sessionOrder = new Map(sessions.map((session, index) => [session.id, index]));
    return logs
      .filter((log) => log.exercise_name === trendExercise)
      .sort(
        (a, b) => (sessionOrder.get(a.session_id) ?? 0) - (sessionOrder.get(b.session_id) ?? 0),
      )
      .map((log) => {
        const session = sessions.find((candidate) => candidate.id === log.session_id);
        return {
          label: `W${session?.week_index ?? '?'}`,
          value: log.metric_value,
          metric: log.metric_type,
          rpe: log.rpe,
        };
      });
  }, [logs, sessions, trendExercise]);

  const trendMetric = trendData[0]?.metric ?? 'reps';

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------ headline */}
      <section aria-label="Benchmark summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="שיפור ב-3 ק״מ"
          value={delta.run_delta_seconds !== null ? formatSignedDuration(delta.run_delta_seconds) : '—'}
          hint={
            delta.run_improvement_pct !== null
              ? `${formatPercent(delta.run_improvement_pct)} מהר יותר מהמבחן הראשון`
              : 'מבחן הסיום טרם בוצע'
          }
          tone={(delta.run_delta_seconds ?? 0) < 0 ? 'positive' : 'neutral'}
          icon={<Timer className="h-4 w-4" />}
        />
        <StatCard
          label="הקצב הנוכחי"
          value={delta.final_pace_seconds_per_km ? formatPace(delta.final_pace_seconds_per_km) : '—'}
          hint={
            delta.initial_pace_seconds_per_km
              ? `מ-${formatPace(delta.initial_pace_seconds_per_km)}`
              : undefined
          }
          icon={<Gauge className="h-4 w-4" />}
        />
        <StatCard
          label="נפח שכיבות סמיכה"
          value={delta.pushup_delta !== null ? formatSignedNumber(delta.pushup_delta) : '—'}
          hint={
            delta.pushup_improvement_pct !== null
              ? `שיפור של ${formatPercent(delta.pushup_improvement_pct)}`
              : 'מבחן הסיום טרם בוצע'
          }
          tone={(delta.pushup_delta ?? 0) > 0 ? 'positive' : 'neutral'}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="עקביות"
          value={`${summary.attended_sessions}/${summary.total_sessions}`}
          hint={`רצף הכי ארוך: ${summary.streak} אימונים · RPE ממוצע ${
            summary.avg_rpe ? summary.avg_rpe.toFixed(1) : '—'
          }`}
          icon={<CalendarCheck className="h-4 w-4" />}
        />
      </section>

      <BenchmarkDeltaCard delta={delta} name={`${participant.name} — מבחני הכושר`} groupId={participant.team} />

      {/* -------------------------------------------------- consistency */}
      <Card as="section">
        <CardHeader
          icon={<Flame className="h-4 w-4" />}
          title="עקביות שבועית"
          subtitle="ריבוע לכל שבוע — ירוק אומר שהעלית תוצאות"
          action={<Badge tone="accent">רצף של {summary.streak} אימונים</Badge>}
        />
        <div className="card-pad">
          <ol className="flex flex-wrap gap-2">
            {consistency.map(({ session, attended, avgRpe, entries }) => (
              <li key={session.id}>
                <div
                  className={cn(
                    'flex h-16 w-16 flex-col items-center justify-center rounded-xl text-xs font-medium',
                    cellStyle(attended ? avgRpe : null),
                  )}
                  title={`${session.title} — ${formatDate(session.date)}${
                    attended ? ` · ${entries} רשומות · RPE ${avgRpe?.toFixed(1)}` : ' · לא הושלם'
                  }`}
                >
                  <span className="tnum">W{session.week_index}</span>
                  <span className="tnum text-[10px] opacity-80">
                    {attended ? `RPE ${avgRpe?.toFixed(1)}` : 'לא הושלם'}
                  </span>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-3 w-3 rounded bg-elevated" /> לא הושלם
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-3 w-3 rounded bg-emerald-500/25" /> RPE ≤ 5
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-3 w-3 rounded bg-amber-500/25" /> RPE 6–7
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-3 w-3 rounded bg-rose-500/25" /> RPE 8+
            </span>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------ exercise trend */}
      {exerciseNames.length > 0 ? (
        <Card as="section">
          <CardHeader
            title="התקדמות בתרגילים"
            subtitle={`התוצאות שרשמת לאורך הזמן (${METRIC_UNITS[trendMetric]})`}
            action={
              <select
                className="input w-auto"
                value={trendExercise}
                onChange={(event) => setTrendExercise(event.target.value)}
                aria-label="בחירת תרגיל להצגה בגרף"
              >
                {exerciseNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            }
          />
          <div className="card-pad">
            {trendData.length < 2 ? (
              <p className="py-8 text-center text-sm text-muted">
                רשמו את התרגיל הזה בשני אימונים לפחות כדי לראות מגמה.
              </p>
            ) : (
              <div dir="ltr">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trendData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(value: number) =>
                      trendMetric === 'time_seconds' ? formatDuration(value) : String(value)
                    }
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const point = payload[0].payload as (typeof trendData)[number];
                      return (
                        <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                          <p className="font-semibold text-ink">{label}</p>
                          <p className="tnum text-muted">
                            {formatMetric(point.value, point.metric)} · RPE {point.rpe}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="rgb(var(--accent))"
                    strokeWidth={2.5}
                    dot={{ r: 3, strokeWidth: 0, fill: 'rgb(var(--accent))' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              </div>
            )}
          </div>
        </Card>
      ) : null}

      <LogsTable
        logs={logs}
        participants={[participant]}
        sessions={sessions}
        showParticipantColumn={false}
        pageSize={15}
      />
    </div>
  );
}
