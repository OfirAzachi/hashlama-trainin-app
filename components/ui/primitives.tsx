'use client';

import type { ChangeEvent, FocusEvent, InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { initials, normalizeDurationInput } from '@/lib/format';
import { GROUPS_BY_ID } from '@/lib/groups';
import type { GroupId } from '@/lib/types';

/* ---------------------------------------------------------------- card */

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return <Tag className={cn('card', className)}>{children}</Tag>;
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5 sm:py-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <span className="mt-0.5 text-muted">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink sm:text-base">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted sm:text-sm">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="max-w-full shrink-0">{action}</div> : null}
    </div>
  );
}

/* --------------------------------------------------------------- badge */

type BadgeTone = 'neutral' | 'positive' | 'negative' | 'warning' | 'accent';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-elevated text-muted',
  positive: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  negative: 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  accent: 'bg-accent/12 text-accent',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tnum',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function GroupBadge({ groupId, short = false }: { groupId: GroupId; short?: boolean }) {
  const group = GROUPS_BY_ID[groupId];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${group.color}1f`, color: group.color }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: group.color }} />
      {short ? group.shortName : group.name}
    </span>
  );
}

/* -------------------------------------------------------------- avatar */

export function Avatar({
  name,
  groupId,
  size = 'md',
}: {
  name: string;
  groupId?: GroupId | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    sm: 'h-7 w-7 text-[10px]',
    md: 'h-9 w-9 text-xs',
    lg: 'h-12 w-12 text-sm',
  } as const;
  const color = groupId ? GROUPS_BY_ID[groupId].color : 'rgb(var(--muted))';

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        sizes[size],
      )}
      style={{ backgroundColor: color }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

/* ----------------------------------------------------------- stat card */

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  const valueTone =
    tone === 'positive'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'negative'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-ink';

  return (
    <div className={cn('card card-pad', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="label">{label}</p>
        {icon ? <span className="text-muted">{icon}</span> : null}
      </div>
      <p className={cn('mt-2 text-2xl font-semibold tnum sm:text-3xl', valueTone)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------- empty state */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon ? <span className="text-muted">{icon}</span> : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="max-w-sm text-xs text-muted">{description}</p> : null}
      {action}
    </div>
  );
}

/* ------------------------------------------------------------ segmented */

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  color?: string;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex flex-wrap items-center gap-1 rounded-xl border border-line bg-elevated p-1',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm',
              selected ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {option.color ? (
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: option.color }}
                />
              ) : null}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ duration */

/**
 * A "mm:ss" text input — anywhere a time gets recorded, this is what to use.
 * Typing stays raw so the cursor never jumps; on blur it snaps to "mm:ss"
 * (plain digits read as MMSS, e.g. "1205" -> "12:05"), so the value always
 * reads back the same way it'll be stored.
 */
export function DurationInput({
  value,
  onValueChange,
  onBlur,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      className={className}
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value)}
      onBlur={(event: FocusEvent<HTMLInputElement>) => {
        onValueChange(normalizeDurationInput(event.target.value));
        onBlur?.(event);
      }}
    />
  );
}

/* ----------------------------------------------------------- progress */

export function ProgressBar({
  value,
  max = 100,
  color,
  label,
}: {
  value: number;
  max?: number;
  color?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-elevated"
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, backgroundColor: color ?? 'rgb(var(--accent))' }}
      />
    </div>
  );
}
