'use client';

import {
  ArrowLeft,
  Crown,
  Flame,
  Medal,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Avatar, Badge, Card, ProgressBar } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { formatPercent, formatSignedNumber } from '@/lib/format';
import { GROUPS_BY_ID, GROUP_LIST } from '@/lib/groups';
import type { GroupStanding } from '@/lib/points';
import type { GroupId, Participant } from '@/lib/types';

/** "Biggest improvement" is always a percentage — never a raw time or count. */
export interface ImprovementEntry {
  participant: Participant;
  improvementPct: number;
}

export interface HomeHighlights {
  standings: GroupStanding[];
  /** Top point scorers across the whole course. */
  topScorers: Array<{ participant: Participant; points: number }>;
  /** Biggest 3km improvement, percent only. */
  runImprovers: ImprovementEntry[];
  /** Biggest push-up improvement, percent only. */
  pushupImprovers: ImprovementEntry[];
  /** Biggest overall improvement (both benchmarks combined), percent only. */
  overallImprovers: ImprovementEntry[];
  /** Longest streaks of completed trainings. */
  streaks: Array<{ participant: Participant; streak: number }>;
  totals: {
    participants: number;
    trainings: number;
    points: number;
    kilometres: number;
    photos: number;
  };
}

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * The home page's competitive heart: a league table of the three groups.
 * Ranking is by points per member so a smaller group is never punished for its
 * size, and every row spells out exactly what would move it up.
 */
export default function GroupStandings({
  highlights,
  myGroup,
}: {
  highlights: HomeHighlights;
  /** Highlighted row — the group the viewer belongs to. */
  myGroup?: GroupId | null;
}) {
  const [selected, setSelected] = useState<GroupId | null>(myGroup ?? null);
  const { standings, totals } = highlights;
  const leader = standings[0];
  const focus = selected ?? standings[0]?.team ?? 'A';
  const focusRow = standings.find((row) => row.team === focus) ?? standings[0];
  const focusRank = standings.findIndex((row) => row.team === focus) + 1;
  const gapToLeader = focusRow ? leader.points_per_member - focusRow.points_per_member : 0;
  const maxPerMember = Math.max(...standings.map((row) => row.points_per_member), 1);
  // The group's own points-per-member pace so far, per training — used to
  // estimate a realistic number of trainings to close the gap, not a flat guess.
  const focusPacePerTraining = focusRow
    ? focusRow.points_per_member / Math.max(1, totals.trainings)
    : 0;
  const trainingsToClimb = Math.max(1, Math.ceil((gapToLeader + 1) / Math.max(1, focusPacePerTraining)));

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------- cohort pulse */}
      <section aria-label="נתוני הקורס" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'נקודות במחזור', value: totals.points.toLocaleString('he-IL'), icon: Trophy },
          { label: 'קילומטרים שנרשמו', value: totals.kilometres.toFixed(0), icon: Flame },
          { label: 'אימונים בקורס', value: totals.trainings, icon: Target },
          { label: 'מתאמנים', value: totals.participants, icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="card card-pad">
            <div className="flex items-center justify-between gap-2">
              <p className="label">{label}</p>
              <Icon aria-hidden className="h-4 w-4 text-muted" />
            </div>
            <p className="mt-2 text-2xl font-semibold tnum text-ink sm:text-3xl">{value}</p>
          </div>
        ))}
      </section>

      {/* ------------------------------------------------ league table */}
      <section aria-label="טבלת הקבוצות" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-ink">טבלת הקבוצות</h2>
            <p className="text-sm text-muted">
              מדורג לפי נקודות לחבר קבוצה — לחיצה על קבוצה מציגה פירוט מלא.
            </p>
          </div>
          <Badge tone="accent">
            <Crown aria-hidden className="h-3.5 w-3.5" />
            מובילה: {GROUPS_BY_ID[leader.team].shortName}
          </Badge>
        </div>

        {/* podium — top 3 */}
        <div className="flex items-end justify-center gap-2 sm:gap-3">
          {[1, 0, 2]
            .map((i) => (standings[i] ? { row: standings[i], rank: i + 1 } : null))
            .filter((entry): entry is { row: GroupStanding; rank: number } => entry !== null)
            .map(({ row, rank }) => {
              const group = GROUPS_BY_ID[row.team];
              const isMine = myGroup === row.team;
              const isFocus = focus === row.team;
              const podiumHeight = rank === 1 ? 'pb-6 pt-4' : rank === 2 ? 'pb-4 pt-3' : 'pb-3 pt-2';

              return (
                <button
                  key={row.team}
                  type="button"
                  onClick={() => setSelected(row.team)}
                  aria-pressed={isFocus}
                  className={cn(
                    'flex w-1/3 max-w-[9.5rem] flex-col items-center gap-1.5 rounded-2xl border px-2 text-center transition-colors',
                    podiumHeight,
                    isFocus ? 'border-accent bg-accent/5' : 'border-line bg-surface hover:bg-elevated',
                    rank === 1 && 'order-2',
                    rank === 2 && 'order-1',
                    rank === 3 && 'order-3',
                  )}
                >
                  <span className={cn('leading-none', rank === 1 ? 'text-3xl' : 'text-2xl')} aria-hidden>
                    {MEDALS[rank - 1]}
                  </span>
                  <span className="truncate text-sm font-semibold" style={{ color: group.color }}>
                    {group.shortName}
                  </span>
                  {isMine ? <Badge tone="accent">שלי</Badge> : null}
                  <span className="tnum text-xl font-bold text-ink sm:text-2xl">{row.points_per_member}</span>
                  <span className="text-[11px] text-muted">נק׳ לחבר · {row.members} מתאמנים</span>
                </button>
              );
            })}
        </div>

        {/* compact table — the rest of the field */}
        {standings.length > 3 ? (
          <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {standings.slice(3).map((row, index) => {
              const rank = index + 4;
              const group = GROUPS_BY_ID[row.team];
              const isMine = myGroup === row.team;
              const isFocus = focus === row.team;

              return (
                <li key={row.team}>
                  <button
                    type="button"
                    onClick={() => setSelected(row.team)}
                    aria-pressed={isFocus}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors',
                      isFocus ? 'bg-accent/5' : 'bg-surface hover:bg-elevated',
                    )}
                  >
                    <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted tnum">
                      {rank}
                    </span>
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {group.shortName}
                    </span>
                    {isMine ? <Badge tone="accent">שלי</Badge> : null}
                    <span className="shrink-0 text-xs text-muted tnum">{row.members} מתאמנים</span>
                    <span className="shrink-0 text-sm font-semibold tnum text-ink">
                      {row.points_per_member} נק׳
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : null}

        {/* selected group — full detail */}
        {focusRow ? (
          <Card className="card-pad space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold" style={{ color: GROUPS_BY_ID[focusRow.team].color }}>
                {GROUPS_BY_ID[focusRow.team].name}
              </span>
              <Badge tone="neutral">מקום {focusRank}</Badge>
              <span className="ms-auto text-xs text-muted tnum">
                {focusRow.points.toLocaleString('he-IL')} נקודות סה״כ
              </span>
            </div>

            <ProgressBar
              value={(focusRow.points_per_member / maxPerMember) * 100}
              color={GROUPS_BY_ID[focusRow.team].color}
              label={`ניקוד ${GROUPS_BY_ID[focusRow.team].name}`}
            />

            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-elevated p-2">
                <dt className="text-[11px] text-muted">שיפור ב-3 ק״מ</dt>
                <dd className="text-sm font-semibold tnum text-emerald-600 dark:text-emerald-400">
                  {formatPercent(focusRow.run_improvement_pct)}
                </dd>
              </div>
              <div className="rounded-xl bg-elevated p-2">
                <dt className="text-[11px] text-muted">שכיבות סמיכה</dt>
                <dd className="text-sm font-semibold tnum text-ink">
                  {formatSignedNumber(focusRow.pushup_gain, 1)}
                </dd>
              </div>
              <div className="rounded-xl bg-elevated p-2">
                <dt className="text-[11px] text-muted">אימונים שהושלמו</dt>
                <dd className="text-sm font-semibold tnum text-ink">
                  {formatPercent(focusRow.completion_rate * 100, 0)}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
              <Sparkles aria-hidden className="h-5 w-5 shrink-0 text-accent" />
              <p className="min-w-0 flex-1 text-sm text-ink">
                {focusRank === 1 ? (
                  <>עוד אימון שנרשם — והפער נשמר.</>
                ) : (
                  <>
                    חסרות <span className="font-semibold tnum text-accent">{gapToLeader + 1}</span> נקודות
                    לחבר כדי לעקוף — זה בערך <span className="font-semibold tnum">{trainingsToClimb}</span>{' '}
                    אימונים שנרשמים בקצב הנוכחי של הקבוצה.
                  </>
                )}
              </p>
              <Link href="/participant" className="btn-primary">
                לרישום האימון שלי
                <ArrowLeft aria-hidden className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>
          </Card>
        ) : null}
      </section>

      {/* --------------------------------------------------- highlights */}
      <section aria-label="מצטייני הקורס" className="grid gap-4 sm:grid-cols-2">
        <Card className="card-pad">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Trophy aria-hidden className="h-4 w-4 text-amber-500" />
            צוברי הנקודות
          </h3>
          <ol className="mt-3 space-y-2">
            {highlights.topScorers.map((entry, index) => (
              <li key={entry.participant.id} className="flex items-center gap-2">
                <span className="w-4 text-xs font-semibold text-muted tnum">{index + 1}</span>
                <Avatar
                  name={entry.participant.name}
                  groupId={entry.participant.team}
                  size="sm"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {entry.participant.name}
                </span>
                <span className="text-sm font-semibold tnum text-ink">{entry.points}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="card-pad">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Medal aria-hidden className="h-4 w-4 text-accent" />
            רצף האימונים הארוך
          </h3>
          <ol className="mt-3 space-y-2">
            {highlights.streaks.map((entry) => (
              <li key={entry.participant.id} className="flex items-center gap-2">
                <Avatar
                  name={entry.participant.name}
                  groupId={entry.participant.team}
                  size="sm"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {entry.participant.name}
                </span>
                <Badge tone="accent">
                  <Flame aria-hidden className="h-3.5 w-3.5" />
                  {entry.streak}
                </Badge>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      {/* Biggest improvement — percent only, everywhere, so a runner, a
          push-up grinder and the overall course improvement are all read the
          same way. */}
      <section aria-label="השיפור הגדול ביותר" className="grid gap-4 sm:grid-cols-3">
        {(
          [
            { title: 'השיפור הגדול ב-3 ק״מ', entries: highlights.runImprovers },
            { title: 'השיפור הגדול בשכיבות סמיכה', entries: highlights.pushupImprovers },
            { title: 'השיפור הגדול הכללי', entries: highlights.overallImprovers },
          ] as const
        ).map(({ title, entries }) => (
          <Card key={title} className="card-pad">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <TrendingUp aria-hidden className="h-4 w-4 text-emerald-500" />
              {title}
            </h3>
            {entries.length === 0 ? (
              <p className="mt-3 text-sm text-muted">אין עדיין נתונים.</p>
            ) : (
              <ol className="mt-3 space-y-2">
                {entries.map((entry) => (
                  <li key={entry.participant.id} className="flex items-center gap-2">
                    <Avatar
                      name={entry.participant.name}
                      groupId={entry.participant.team}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      {entry.participant.name}
                    </span>
                    <Badge tone="positive">{formatPercent(entry.improvementPct)}</Badge>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        ))}
      </section>

      <p className="text-center text-xs text-muted">
        כל קבוצה מתחרה עם עצמה ועם האחרות: {GROUP_LIST.map((group) => group.shortName).join(' · ')}
      </p>
    </div>
  );
}
