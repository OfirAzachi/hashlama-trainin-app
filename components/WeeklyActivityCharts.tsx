'use client';

import { Dumbbell, Footprints } from 'lucide-react';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Card, CardHeader } from '@/components/ui/primitives';
import { formatMetric } from '@/lib/format';
import type { SessionLog, TrainingSession } from '@/lib/types';

interface WeekPoint {
  week: number;
  label: string;
  value: number;
}

/** Sums one metric type from the optional weekly trainings, per course week. */
function byWeek(
  logs: SessionLog[],
  sessions: TrainingSession[],
  metric: 'distance_meters' | 'reps',
): WeekPoint[] {
  const weekOf = new Map(sessions.map((session) => [session.id, session.week_index]));
  const totals = new Map<number, number>();
  for (const log of logs) {
    if (log.metric_type !== metric) continue;
    const week = weekOf.get(log.session_id);
    if (week === undefined) continue;
    totals.set(week, (totals.get(week) ?? 0) + log.metric_value);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, value]) => ({ week, label: `שבוע ${week}`, value }));
}

function ActivityChart({
  data,
  formatValue,
}: {
  data: WeekPoint[];
  formatValue: (value: number) => string;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">עדיין אין נתונים להצגה.</p>;
  }

  return (
    <div dir="ltr">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={formatValue} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as WeekPoint;
              return (
                <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                  <p className="font-semibold text-ink">{label}</p>
                  <p className="tnum text-muted">{formatValue(point.value)}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="value" fill="rgb(var(--accent))" radius={[6, 6, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Two weekly bar charts: total running distance and total push-ups from the optional trainings. */
export default function WeeklyActivityCharts({
  sessions,
  logs,
}: {
  sessions: TrainingSession[];
  logs: SessionLog[];
}) {
  const running = useMemo(() => byWeek(logs, sessions, 'distance_meters'), [logs, sessions]);
  const pushups = useMemo(() => byWeek(logs, sessions, 'reps'), [logs, sessions]);

  if (running.length === 0 && pushups.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card as="section">
        <CardHeader icon={<Footprints className="h-4 w-4" />} title="ריצה לפי שבוע" subtitle="סך המרחק שנרשם בכל שבוע" />
        <div className="card-pad">
          <ActivityChart data={running} formatValue={(value) => formatMetric(value, 'distance_meters')} />
        </div>
      </Card>
      <Card as="section">
        <CardHeader icon={<Dumbbell className="h-4 w-4" />} title="שכיבות סמיכה לפי שבוע" subtitle="סך החזרות שנרשמו בכל שבוע" />
        <div className="card-pad">
          <ActivityChart data={pushups} formatValue={(value) => `${value} חזרות`} />
        </div>
      </Card>
    </div>
  );
}
