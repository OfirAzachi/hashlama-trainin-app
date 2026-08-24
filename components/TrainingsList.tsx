'use client';

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  Image as ImageIcon,
  ListChecks,
  Trophy,
  Wind,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';

import ParticipantLogger from '@/components/ParticipantLogger';
import RunningLogger from '@/components/RunningLogger';
import StrengthLogger from '@/components/StrengthLogger';
import { Badge, Card } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { formatDate, formatMetric } from '@/lib/format';
import { CATALOG_META, describeRoundTiming, findExercise, hasFixedExercises, roundCount } from '@/lib/catalog';
import { segmentSummary, segmentsForGroup } from '@/lib/running';
import type { Participant, TrainingCard, TrainingStatus } from '@/lib/types';

const STATUS: Record<
  TrainingStatus,
  { label: string; tone: 'positive' | 'negative' | 'warning'; icon: typeof CheckCircle2; help: string }
> = {
  completed: {
    label: 'הושלם',
    tone: 'positive',
    icon: CheckCircle2,
    help: 'העלית את התוצאות שלך לאימון הזה.',
  },
  due: {
    label: 'ממתין לתוצאות שלך',
    tone: 'warning',
    icon: Clock,
    help: 'האימון עדיין פתוח — העלו תוצאות כדי להשלים אותו.',
  },
  missed: {
    label: 'לא הושלם',
    tone: 'negative',
    icon: XCircle,
    help: 'לא הועלו תוצאות, ולכן האימון נחשב כלא הושלם.',
  },
};

/**
 * The participant's home: every published week as a card with its status, and
 * a single obvious action per card. Completion is defined by uploaded results —
 * nothing uploaded means the training is not completed.
 */
export default function TrainingsList({
  participant,
  trainings,
}: {
  participant: Participant;
  trainings: TrainingCard[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const open = trainings.find((card) => card.session.id === openId) ?? null;
  const completedCount = trainings.filter((card) => card.status === 'completed').length;
  // Trainings arrive newest-date-first; the first card's week is "this week".
  const currentWeekIndex = trainings[0]?.session.week_index ?? null;

  // Group into weeks, each subdivided into date sub-cells — a day can hold
  // more than one training (e.g. a warm-up and a points game the same day).
  const weeks: Array<{ weekIndex: number; dates: Array<{ date: string; cards: TrainingCard[] }> }> =
    (() => {
      const weekMap = new Map<number, Map<string, TrainingCard[]>>();
      trainings.forEach((card) => {
        const weekIndex = card.session.week_index;
        const date = card.session.date;
        if (!weekMap.has(weekIndex)) weekMap.set(weekIndex, new Map());
        const dateMap = weekMap.get(weekIndex)!;
        if (!dateMap.has(date)) dateMap.set(date, []);
        dateMap.get(date)!.push(card);
      });
      return [...weekMap.entries()].map(([weekIndex, dateMap]) => ({
        weekIndex,
        dates: [...dateMap.entries()]
          .map(([date, cards]) => ({ date, cards }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      }));
    })();

  /* --------------------------------------------------- logging a week */

  if (open) {
    return (
      <div className="space-y-4">
        <button type="button" className="btn-ghost -ms-2" onClick={() => setOpenId(null)}>
          <ArrowLeft aria-hidden className="h-4 w-4 rtl:rotate-180" />
          כל האימונים שלי
        </button>

        {open.session.training_type === 'running' ? (
          <RunningLogger
            session={open.session}
            participant={participant}
            myLogs={open.runningLogs}
          />
        ) : open.session.points_game ? (
          <StrengthLogger
            session={open.session}
            participant={participant}
            myLogs={open.strengthLogs}
          />
        ) : (
          <ParticipantLogger
            participant={participant}
            session={open.session}
            existingLogs={open.logs}
          />
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------ list */

  const renderCard = (card: TrainingCard) => {
    const status = STATUS[card.status];
    const Icon = status.icon;
    const done = card.status === 'completed';
    const type = card.session.training_type;
    const isRunning = type === 'running';
    const strength = !isRunning; // every non-running type is a points game

    return (
      <Card key={card.session.id} as="li" className="overflow-hidden">
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-ink">{card.session.title}</h3>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted tnum">
                <Badge tone={isRunning ? 'neutral' : 'accent'}>
                  {type === 'running' ? (
                    <>
                      <Footprints aria-hidden className="h-3 w-3" /> ריצה
                    </>
                  ) : type === 'endurance' ? (
                    <>
                      <HeartPulse aria-hidden className="h-3 w-3" /> {CATALOG_META.endurance.label} · נקודות
                    </>
                  ) : type === 'warmup' ? (
                    <>
                      <Flame aria-hidden className="h-3 w-3" /> {CATALOG_META.warmup.label} · נקודות
                    </>
                  ) : type === 'cooldown' ? (
                    <>
                      <Wind aria-hidden className="h-3 w-3" /> {CATALOG_META.cooldown.label} · נקודות
                    </>
                  ) : (
                    <>
                      <Dumbbell aria-hidden className="h-3 w-3" /> {CATALOG_META.strength.label} · נקודות
                    </>
                  )}
                </Badge>
              </p>
            </div>

            <Badge tone={status.tone}>
              <Icon aria-hidden className="h-3.5 w-3.5" />
              {status.label}
            </Badge>
          </div>

          {/* what the week contains */}
          {isRunning && card.session.running ? (
            <div className="space-y-2">
              {segmentsForGroup(card.session.running, participant.team).map((segment) => {
                  const log = card.runningLogs.find((entry) => entry.segment_id === segment.id);
                  return (
                    <div key={segment.id} className="flex items-start gap-2 text-sm">
                      {log ? (
                        <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <Circle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted/50" />
                      )}
                      <span className="min-w-0">
                        <span className="font-medium text-ink">{segment.label}</span>
                        <span className="text-muted"> — {segmentSummary(segment)}</span>
                        {log ? (
                          <span className="ms-1 font-medium tnum text-emerald-600 dark:text-emerald-400">
                            ({log.points} נק׳)
                          </span>
                        ) : null}
                      </span>
                    </div>
                  );
                })}

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={card.points > 0 ? 'positive' : 'neutral'}>
                  <Trophy aria-hidden className="h-3.5 w-3.5" />
                  {card.points} נקודות נצברו
                </Badge>
              </div>
            </div>
          ) : null}

          {strength && card.session.points_game ? (
            <div className="space-y-2">
              <p className="text-sm text-muted tnum">
                {roundCount(card.session.points_game)} סבבים · {describeRoundTiming(card.session.points_game)} ·{' '}
                {hasFixedExercises(card.session.points_game.catalog)
                  ? 'המאמנת קבעה תרגיל לכל סבב'
                  : 'המאמנת קבעה קבוצת שריר לכל סבב'}
              </p>

              {card.strengthLogs.length > 0 ? (
                <ul className="space-y-1">
                  {card.strengthLogs.map((log) => {
                    const exercise = findExercise(log.exercise_id);
                    return (
                      <li key={log.id} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-emerald-500" />
                        <span dir="rtl" className="min-w-0 flex-1 truncate text-ink">
                          {exercise?.name ?? log.exercise_id}
                        </span>
                        <span className="shrink-0 text-xs text-muted tnum">
                          {log.reps} × {log.level} = {log.points} pts
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={card.points > 0 ? 'positive' : 'neutral'}>
                  <Trophy aria-hidden className="h-3.5 w-3.5" />
                  {card.points} נקודות נצברו
                </Badge>
              </div>
            </div>
          ) : null}

          {card.track ? (
            <ul className="space-y-1.5">
              {card.track.exercises.map((exercise) => {
                const logged = card.logs.find((log) => log.exercise_name === exercise.name);
                return (
                  <li key={exercise.id} className="flex items-start gap-2 text-sm">
                    {logged ? (
                      <CheckCircle2
                        aria-hidden
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                      />
                    ) : (
                      <Circle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted/50" />
                    )}
                    <span className="min-w-0">
                      <span className="font-medium text-ink">{exercise.name}</span>
                      <span className="text-muted"> — {exercise.prescription}</span>
                      {logged ? (
                        <span className="ms-1 font-medium text-emerald-600 tnum dark:text-emerald-400">
                          ({formatMetric(logged.metric_value, logged.metric_type)})
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <p className="text-xs text-muted">{status.help}</p>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <button
              type="button"
              className={done ? 'btn-secondary' : 'btn-primary'}
              onClick={() => setOpenId(card.session.id)}
            >
              <ListChecks aria-hidden className="h-4 w-4" />
              {done
                ? strength
                  ? 'עדכון הנקודות שלי'
                  : isRunning
                    ? 'עדכון הריצה שלי'
                    : 'עדכון התוצאות'
                : strength
                  ? 'התחלת משחק הנקודות'
                  : isRunning
                    ? 'רישום הריצה שלי'
                    : 'העלאת התוצאות שלי'}
              {done ? null : <ArrowRight aria-hidden className="h-4 w-4 rtl:rotate-180" />}
            </button>

            <span className="text-xs text-muted tnum">
              {card.loggedExercises}/{card.totalExercises}{' '}
              {strength ? 'סבבים מולאו' : isRunning ? 'מקטעים נרשמו' : 'תרגילים נרשמו'}
            </span>

            {card.photos > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted tnum">
                <ImageIcon aria-hidden className="h-3.5 w-3.5" />
                {card.photos}
              </span>
            ) : null}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <Card className="card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">האימונים שלי</h2>
            <p className="mt-0.5 text-sm text-muted">
              אחרי כל אימון מעלים את התוצאות. אימון בלי תוצאות נחשב כלא הושלם.
            </p>
          </div>
          <div className="text-end">
            <p className="text-2xl font-semibold tnum text-ink">
              {completedCount}
              <span className="text-base text-muted">/{trainings.length}</span>
            </p>
            <p className="text-xs text-muted">הושלמו</p>
          </div>
        </div>
      </Card>

      {weeks.map((week) => {
        const isCurrentWeek = week.weekIndex === currentWeekIndex;
        return (
          <section
            key={week.weekIndex}
            className={cn(
              'space-y-3 rounded-2xl border border-line p-3 sm:p-4',
              isCurrentWeek && 'border-accent/40 ring-1 ring-accent/20 bg-accent/5',
            )}
          >
            <header className="flex flex-wrap items-center gap-2">
              {isCurrentWeek ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
                  <CalendarDays aria-hidden className="h-3.5 w-3.5" />
                  השבוע
                </span>
              ) : null}
              <h3 className="text-sm font-semibold text-ink">שבוע {week.weekIndex}</h3>
            </header>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {week.dates.map((group) => (
                <div
                  key={group.date}
                  className="space-y-2 rounded-xl border border-line/60 bg-elevated/40 p-2.5"
                >
                  <p className="px-0.5 text-xs font-semibold text-muted tnum">
                    {formatDate(group.date)}
                  </p>
                  <ul className="space-y-2">{group.cards.map((card) => renderCard(card))}</ul>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {trainings.length === 0 ? (
        <Card className="card-pad">
          <p className="text-sm text-muted">
            עדיין לא פורסמו אימונים. המאמנת תעלה את אימון השבוע בקרוב.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
