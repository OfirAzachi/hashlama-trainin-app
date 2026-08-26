'use client';

import { Medal, Trophy, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ExerciseDemoButton, LevelBadge } from '@/components/ExerciseDemo';
import { Avatar, Badge, Card, CardHeader } from '@/components/ui/primitives';
import { formatDate } from '@/lib/format';
import { GROUPS_BY_ID } from '@/lib/groups';
import { groupPointsBreakdown, sessionLeaderboard } from '@/lib/points';
import { CATALOG_META, describeRoundTiming, findExercise, roundCount } from '@/lib/catalog';
import type { Participant, StrengthLog, TrainingSession, User } from '@/lib/types';

/**
 * Trainer view of a points game: how each group's points broke down, the
 * individual leaderboard, and which exercises the cohort actually picked.
 * There's no goal to hit — every point just adds to the group's standing on
 * the home page league table.
 */
export default function PointsBoard({
  sessions,
  participants,
  users,
  strengthLogs,
}: {
  sessions: TrainingSession[];
  participants: Participant[];
  users: User[];
  strengthLogs: StrengthLog[];
}) {
  const games = useMemo(
    () =>
      sessions
        .filter((session) => session.training_type !== 'running')
        .sort((a, b) => b.date.localeCompare(a.date)),
    [sessions],
  );

  const [sessionId, setSessionId] = useState(games[0]?.id ?? '');
  const session = games.find((entry) => entry.id === sessionId) ?? games[0] ?? null;

  const sessionLogs = useMemo(
    () => (session ? strengthLogs.filter((log) => log.session_id === session.id) : []),
    [strengthLogs, session],
  );

  const groupBreakdown = useMemo(
    () => (session ? groupPointsBreakdown(session, sessionLogs, participants) : []),
    [session, sessionLogs, participants],
  );

  const leaderboard = useMemo(
    () => sessionLeaderboard(sessionLogs, users).slice(0, 8),
    [sessionLogs, users],
  );

  /** Which exercises the cohort chose, most popular first. */
  const picks = useMemo(() => {
    const counts = new Map<string, { count: number; points: number }>();
    sessionLogs.forEach((log) => {
      const current = counts.get(log.exercise_id) ?? { count: 0, points: 0 };
      counts.set(log.exercise_id, {
        count: current.count + 1,
        points: current.points + log.points,
      });
    });
    return [...counts.entries()]
      .map(([id, value]) => ({ exercise: findExercise(id), ...value }))
      .filter((entry) => entry.exercise)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [sessionLogs]);

  if (!session) return null;

  const totalPoints = sessionLogs.reduce((sum, log) => sum + log.points, 0);

  return (
    <Card as="section">
      <CardHeader
        icon={<Zap className="h-4 w-4" />}
        title="תוצאות משחק הנקודות"
        subtitle="כל אחד תורם לפי יכולתו — הנקודות מצטרפות לניקוד הקבוצה בעמוד הבית."
        action={
          <select
            className="input w-auto"
            value={session.id}
            onChange={(event) => setSessionId(event.target.value)}
            aria-label="בחירת משחק הנקודות להצגה"
          >
            {games.map((entry) => (
              <option key={entry.id} value={entry.id}>
                שבוע {entry.week_index} · {entry.title}
              </option>
            ))}
          </select>
        }
      />

      <div className="card-pad space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="accent">
            <Trophy aria-hidden className="h-3.5 w-3.5" />
            {totalPoints} נקודות בכל המחזור
          </Badge>
          {session.points_game ? (
            <Badge tone="neutral">{CATALOG_META[session.points_game.catalog].label}</Badge>
          ) : null}
          <span className="text-xs text-muted tnum">
            {formatDate(session.date)} · {session.points_game ? roundCount(session.points_game) : 0} סבבים ·{' '}
            {session.points_game ? describeRoundTiming(session.points_game) : ''}
          </span>
        </div>

        {/* ------------------------------------------------ group totals */}
        <div className="grid gap-3 lg:grid-cols-3">
          {groupBreakdown.map((entry) => {
            const group = GROUPS_BY_ID[entry.team];
            return (
              <div key={entry.team} className="rounded-2xl border border-line p-3">
                <span
                  className="inline-flex items-center gap-1.5 text-sm font-semibold"
                  style={{ color: group.color }}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  {group.shortName}
                </span>

                <p className="mt-2 text-2xl font-semibold tnum text-ink">
                  {entry.points}
                  <span className="text-base font-normal text-muted"> נק׳</span>
                </p>

                <p className="mt-2 text-[11px] text-muted tnum">
                  {entry.contributors.length} תורמים
                </p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* --------------------------------------------- leaderboard */}
          <div>
            <p className="label mb-2">נקודות אישיות</p>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted">עדיין לא נצברו נקודות במשחק הזה.</p>
            ) : (
              <ol className="space-y-1.5">
                {leaderboard.map((entry, index) => (
                  <li
                    key={entry.user.id}
                    className="flex items-center gap-3 rounded-xl bg-elevated px-3 py-2"
                  >
                    <span className="w-4 text-xs font-semibold text-muted tnum">{index + 1}</span>
                    {index === 0 ? (
                      <Medal aria-hidden className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Avatar name={entry.user.name} groupId={entry.user.team} size="sm" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      {entry.user.name}
                    </span>
                    <span className="text-xs text-muted tnum">{entry.reps} חזרות</span>
                    <span className="text-sm font-semibold tnum text-ink">{entry.points}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* ------------------------------------------ exercise picks */}
          <div>
            <p className="label mb-2">התרגילים הנבחרים ביותר</p>
            {picks.length === 0 ? (
              <p className="text-sm text-muted">עדיין אין בחירות.</p>
            ) : (
              <ul className="space-y-1.5">
                {picks.map(({ exercise, count, points }) => (
                  <li
                    key={exercise!.id}
                    className="flex items-center gap-2 rounded-xl bg-elevated px-3 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span dir="rtl" className="block truncate text-sm text-ink">
                        {exercise!.name}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {exercise!.instructions}
                      </span>
                    </span>
                    <LevelBadge level={exercise!.level} />
                    <span className="text-xs text-muted tnum">×{count}</span>
                    <span className="text-sm font-semibold tnum text-ink">{points}</span>
                    <ExerciseDemoButton exercise={exercise!} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
