'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import type { TooltipProps } from 'recharts';

import { GROUPS_BY_ID, GROUP_LIST } from '@/lib/groups';
import { formatDuration } from '@/lib/format';
import type {
  DistributionBox,
  GroupComparisonPoint,
  ScatterPoint,
  SessionTrendPoint,
} from '@/lib/metrics';

const AXIS = { stroke: 'rgb(var(--line))', tickLine: false, axisLine: false } as const;

function TooltipShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      {children}
    </div>
  );
}

/* ------------------------------------------------ group comparison bars */

export function GroupComparisonChart({
  data,
  mode,
}: {
  data: GroupComparisonPoint[];
  /** Which benchmark the bars describe. */
  mode: 'run' | 'pushups';
}) {
  const isRun = mode === 'run';

  return (
    <div dir="ltr">
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={6}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="group" {...AXIS} />
        <YAxis
          {...AXIS}
          tickFormatter={(value: number) => (isRun ? formatDuration(value) : String(value))}
          width={isRun ? 52 : 36}
        />
        <Tooltip
          cursor={{ fill: 'rgb(var(--elevated))' }}
          content={({ active, payload, label }: TooltipProps<number, string>) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as GroupComparisonPoint;
            return (
              <TooltipShell>
                <p className="mb-1 font-semibold text-ink">{label}</p>
                {isRun ? (
                  <>
                    <p className="text-muted">
                      פתיחה <span className="tnum text-ink">{formatDuration(point.initialRun)}</span>
                    </p>
                    <p className="text-muted">
                      סיום <span className="tnum text-ink">{formatDuration(point.finalRun)}</span>
                    </p>
                    <p className="mt-1 font-medium text-emerald-600 dark:text-emerald-400">
                      {point.runImprovement}% מהר יותר
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-muted">
                      פתיחה <span className="tnum text-ink">{point.initialPushups}</span>
                    </p>
                    <p className="text-muted">
                      סיום <span className="tnum text-ink">{point.finalPushups}</span>
                    </p>
                    <p className="mt-1 font-medium text-emerald-600 dark:text-emerald-400">
                      +{point.pushupGain} חזרות
                    </p>
                  </>
                )}
              </TooltipShell>
            );
          }}
        />
        <Legend iconType="circle" iconSize={8} />
        <Bar
          dataKey={isRun ? 'initialRun' : 'initialPushups'}
          name="מבחן פתיחה"
          fill="rgb(var(--muted))"
          fillOpacity={0.45}
          radius={[6, 6, 0, 0]}
        />
        <Bar
          dataKey={isRun ? 'finalRun' : 'finalPushups'}
          name="מבחן סיום"
          fill="rgb(var(--accent))"
          radius={[6, 6, 0, 0]}
        >
          {data.map((point) => (
            <Cell key={point.groupId} fill={point.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------- session trend */

export function SessionTrendChart({ data }: { data: SessionTrendPoint[] }) {
  return (
    <div dir="ltr">
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="session" {...AXIS} />
        <YAxis domain={[4, 10]} ticks={[4, 5, 6, 7, 8, 9, 10]} {...AXIS} width={40} />
        <Tooltip
          content={({ active, payload, label }: TooltipProps<number, string>) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as SessionTrendPoint;
            return (
              <TooltipShell>
                <p className="mb-1 font-semibold text-ink">
                  {label} · {point.date}
                </p>
                {GROUP_LIST.map((group) => (
                  <p key={group.id} className="text-muted">
                    <span style={{ color: group.color }}>{group.shortName}</span>{' '}
                    <span className="tnum text-ink">RPE {point.rpeByGroup[group.id] ?? '—'}</span>{' '}
                    <span className="tnum">({point.attendanceByGroup[group.id]} השלימו)</span>
                  </p>
                ))}
              </TooltipShell>
            );
          }}
        />
        <Legend iconType="circle" iconSize={8} />
        {GROUP_LIST.map((group) => (
          <Line
            key={group.id}
            type="monotone"
            dataKey={(point: SessionTrendPoint) => point.rpeByGroup[group.id]}
            name={group.shortName}
            stroke={group.color}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: group.color }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
    </div>
  );
}

/* ----------------------------------------------------------- scatter */

export function BenchmarkScatterChart({ data }: { data: ScatterPoint[] }) {
  const values = data.flatMap((point) => [point.initial, point.final]);
  const min = Math.floor(Math.min(...values, 12));
  const max = Math.ceil(Math.max(...values, 20));

  return (
    <div dir="ltr">
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 8, right: 12, left: -12, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="initial"
          name="3 ק״מ פתיחה"
          domain={[min, max]}
          unit=" דק׳"
          {...AXIS}
        />
        <YAxis
          type="number"
          dataKey="final"
          name="3 ק״מ סיום"
          domain={[min, max]}
          unit=" דק׳"
          width={52}
          {...AXIS}
        />
        <ZAxis type="number" dataKey="improvement" range={[60, 260]} name="שיפור" />
        {/* Points below this line got faster; points above regressed. */}
        <ReferenceLine
          segment={[
            { x: min, y: min },
            { x: max, y: max },
          ]}
          stroke="rgb(var(--muted))"
          strokeDasharray="4 4"
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          content={({ active, payload }: TooltipProps<number, string>) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as ScatterPoint;
            return (
              <TooltipShell>
                <p className="font-semibold text-ink">{point.name}</p>
                <p className="text-muted">{GROUPS_BY_ID[point.groupId].name}</p>
                <p className="mt-1 text-muted tnum">
                  {point.initial} דק׳ → <span className="text-ink">{point.final} דק׳</span>
                </p>
                <p
                  className={
                    point.improvement > 0
                      ? 'font-medium text-emerald-600 dark:text-emerald-400'
                      : 'font-medium text-rose-600 dark:text-rose-400'
                  }
                >
                  {point.improvement > 0 ? '+' : ''}
                  {point.improvement}%
                </p>
              </TooltipShell>
            );
          }}
        />
        <Legend iconType="circle" iconSize={8} />
        {GROUP_LIST.map((group) => (
          <Scatter
            key={group.id}
            name={group.shortName}
            data={data.filter((point) => point.groupId === group.id)}
            fill={group.color}
            fillOpacity={0.75}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
    </div>
  );
}

/* --------------------------------------------------------- box plot */

/**
 * Five-number summary per group, drawn as a hand-rolled SVG box plot.
 * Recharts has no native box mark, and the geometry here is simple enough
 * that a plain scale beats bending a bar chart into shape.
 */
export function RunDistributionChart({ data }: { data: DistributionBox[] }) {
  const width = 520;
  const height = 240;
  const padding = { top: 16, right: 16, bottom: 28, left: 46 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const allValues = data.flatMap((box) => [box.min, box.max]).filter((value) => value > 0);
  const lo = Math.floor(Math.min(...allValues, 12)) - 0.5;
  const hi = Math.ceil(Math.max(...allValues, 20)) + 0.5;
  const yOf = (value: number) => padding.top + ((hi - value) / (hi - lo)) * plotHeight;

  const bandWidth = plotWidth / data.length;
  const boxWidth = Math.min(78, bandWidth * 0.5);
  const ticks = Array.from({ length: 5 }, (_, index) => lo + ((hi - lo) / 4) * index);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[240px] w-full"
      role="img"
      aria-label="תרשים קופסה של זמני 3 ק״מ בסיום, לפי קבוצה"
    >
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={yOf(tick)}
            y2={yOf(tick)}
            stroke="rgb(var(--line))"
            strokeDasharray="3 3"
          />
          <text
            x={padding.left - 8}
            y={yOf(tick) + 4}
            textAnchor="end"
            className="fill-[rgb(var(--muted))] text-[10px]"
          >
            {tick.toFixed(1)}
          </text>
        </g>
      ))}

      {data.map((box, index) => {
        const centre = padding.left + bandWidth * (index + 0.5);
        const left = centre - boxWidth / 2;
        const hasData = box.max > 0;

        return (
          <g key={box.groupId}>
            {hasData ? (
              <>
                {/* whiskers */}
                <line x1={centre} x2={centre} y1={yOf(box.max)} y2={yOf(box.min)} stroke={box.color} strokeWidth={1.5} />
                <line x1={centre - 14} x2={centre + 14} y1={yOf(box.max)} y2={yOf(box.max)} stroke={box.color} strokeWidth={1.5} />
                <line x1={centre - 14} x2={centre + 14} y1={yOf(box.min)} y2={yOf(box.min)} stroke={box.color} strokeWidth={1.5} />
                {/* interquartile box */}
                <rect
                  x={left}
                  y={yOf(box.q3)}
                  width={boxWidth}
                  height={Math.max(2, yOf(box.q1) - yOf(box.q3))}
                  rx={5}
                  fill={box.color}
                  fillOpacity={0.22}
                  stroke={box.color}
                  strokeWidth={1.5}
                />
                {/* median */}
                <line x1={left} x2={left + boxWidth} y1={yOf(box.median)} y2={yOf(box.median)} stroke={box.color} strokeWidth={2.5} />
                <title>
                  {`${box.label}: מינימום ${box.min.toFixed(1)}, רבעון ראשון ${box.q1.toFixed(1)}, חציון ${box.median.toFixed(1)}, רבעון שלישי ${box.q3.toFixed(1)}, מקסימום ${box.max.toFixed(1)} דק׳`}
                </title>
              </>
            ) : null}
            <text
              x={centre}
              y={height - 8}
              textAnchor="middle"
              className="fill-[rgb(var(--muted))] text-[11px]"
            >
              {box.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
