'use client';

import { ArrowDownRight, ArrowUpRight, Dumbbell, Minus, Timer } from 'lucide-react';

import { Badge, Card, GroupBadge, ProgressBar } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import {
  formatDate,
  formatDuration,
  formatPace,
  formatSignedDuration,
  formatSignedNumber,
  formatSignedPercent,
} from '@/lib/format';
import type { BenchmarkDelta, GroupId } from '@/lib/types';

interface BenchmarkDeltaCardProps {
  delta: BenchmarkDelta;
  /** Optional heading, e.g. the participant name on the trainer side. */
  name?: string;
  groupId?: GroupId | null;
  /** `compact` drops the pace row and tightens spacing for list contexts. */
  variant?: 'full' | 'compact';
  className?: string;
}

function Trend({ value, invert = false }: { value: number; invert?: boolean }) {
  // `invert` is for metrics where a smaller number is the improvement (run time).
  const improved = invert ? value < 0 : value > 0;
  const flat = value === 0;
  const Icon = flat ? Minus : improved ? ArrowUpRight : ArrowDownRight;
  return (
    <Badge tone={flat ? 'neutral' : improved ? 'positive' : 'negative'}>
      <Icon aria-hidden className="h-3 w-3" />
      {invert ? formatSignedDuration(value) : formatSignedNumber(value)}
    </Badge>
  );
}

/**
 * Baseline vs. exit benchmark for one participant: 3km run and max push-ups,
 * with absolute deltas, percentage improvement and pace conversion.
 */
export default function BenchmarkDeltaCard({
  delta,
  name,
  groupId,
  variant = 'full',
  className,
}: BenchmarkDeltaCardProps) {
  const { initial, final } = delta;
  const complete = Boolean(initial && final);
  const compact = variant === 'compact';

  return (
    <Card className={cn('overflow-hidden', className)}>
      {name ? (
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">{name}</h3>
          {groupId ? <GroupBadge groupId={groupId} short /> : null}
        </div>
      ) : null}

      <div className={cn('grid gap-4 p-4', compact ? '' : 'sm:grid-cols-2 sm:gap-5 sm:p-5')}>
        {/* ------------------------------------------------------ 3km run */}
        <section aria-label="מבחן ריצת 3 ק״מ">
          <div className="flex items-center gap-2">
            <Timer aria-hidden className="h-4 w-4 text-muted" />
            <p className="label">ריצת 3 ק״מ</p>
          </div>

          {complete && initial && final ? (
            <>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tnum text-ink">
                  {formatDuration(final.run_3km_seconds)}
                </span>
                <span className="text-sm text-muted tnum line-through">
                  {formatDuration(initial.run_3km_seconds)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Trend value={delta.run_delta_seconds ?? 0} invert />
                <Badge tone={(delta.run_improvement_pct ?? 0) > 0 ? 'positive' : 'negative'}>
                  {formatSignedPercent(delta.run_improvement_pct ?? 0)}
                </Badge>
              </div>

              {!compact ? (
                <dl className="mt-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">קצב במבחן הראשון</dt>
                    <dd className="tnum text-ink">
                      {formatPace(delta.initial_pace_seconds_per_km ?? 0)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">קצב במבחן הסיום</dt>
                    <dd className="tnum font-medium text-ink">
                      {formatPace(delta.final_pace_seconds_per_km ?? 0)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">תאריכי המבחנים</dt>
                    <dd className="tnum text-muted">
                      {formatDate(initial.recorded_date, { year: undefined })} →{' '}
                      {formatDate(final.recorded_date, { year: undefined })}
                    </dd>
                  </div>
                </dl>
              ) : null}

              <div className="mt-3">
                <ProgressBar
                  value={Math.max(0, Math.min(20, delta.run_improvement_pct ?? 0))}
                  max={20}
                  color="#4f7cff"
                  label="שיפור בריצה מתוך יעד של 20%"
                />
                <p className="mt-1 text-[11px] text-muted">התקדמות מתוך יעד קורס של 20%</p>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">
              {initial ? 'ממתין למבחן הסיום' : 'עדיין לא נרשם מבחן'}
            </p>
          )}
        </section>

        {/* ---------------------------------------------------- push-ups */}
        <section aria-label="מבחן מקסימום שכיבות סמיכה">
          <div className="flex items-center gap-2">
            <Dumbbell aria-hidden className="h-4 w-4 text-muted" />
            <p className="label">מקסימום שכיבות סמיכה</p>
          </div>

          {complete && initial && final ? (
            <>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tnum text-ink">{final.max_pushups}</span>
                <span className="text-sm text-muted tnum line-through">{initial.max_pushups}</span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Trend value={delta.pushup_delta ?? 0} />
                <Badge tone={(delta.pushup_improvement_pct ?? 0) > 0 ? 'positive' : 'negative'}>
                  {formatSignedPercent(delta.pushup_improvement_pct ?? 0)} נפח
                </Badge>
              </div>

              {!compact ? (
                <dl className="mt-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">מבחן פתיחה</dt>
                    <dd className="tnum text-ink">{initial.max_pushups} חזרות</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">מבחן סיום</dt>
                    <dd className="tnum font-medium text-ink">{final.max_pushups} חזרות</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">שיפור מוחלט</dt>
                    <dd className="tnum text-ink">{formatSignedNumber(delta.pushup_delta ?? 0)} חזרות</dd>
                  </div>
                </dl>
              ) : null}

              <div className="mt-3">
                <ProgressBar
                  value={Math.max(0, Math.min(60, delta.pushup_improvement_pct ?? 0))}
                  max={60}
                  color="#22a06b"
                  label="שיפור בשכיבות סמיכה מתוך יעד של 60%"
                />
                <p className="mt-1 text-[11px] text-muted">התקדמות מתוך יעד נפח של 60%</p>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">
              {initial ? 'ממתין למבחן הסיום' : 'עדיין לא נרשם מבחן'}
            </p>
          )}
        </section>
      </div>
    </Card>
  );
}
