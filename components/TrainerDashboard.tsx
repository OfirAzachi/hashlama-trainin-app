'use client';

import {
  Activity,
  BarChart3,
  CalendarRange,
  Flame,
  Images,
  LifeBuoy,
  Loader2,
  Table2,
  Timer,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { joinGroupAsTrainer } from '@/app/actions';
import {
  BenchmarkScatterChart,
  GroupComparisonChart,
  RunDistributionChart,
  SessionTrendChart,
} from '@/components/charts';
import LogsTable from '@/components/LogsTable';
import MediaGallery from '@/components/MediaGallery';
import PointsBoard from '@/components/PointsBoard';
import WeekCompletion from '@/components/WeekCompletion';
import WeeklyTrainingBuilder from '@/components/WeeklyTrainingBuilder';
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  GroupBadge,
  ProgressBar,
  Segmented,
  StatCard,
} from '@/components/ui/primitives';
import {
  formatDuration,
  formatPercent,
  formatSignedNumber,
  formatSignedPercent,
} from '@/lib/format';
import { GROUP_LIST } from '@/lib/groups';
import {
  benchmarkScatterData,
  groupComparisonData,
  needsSupport,
  runDistribution,
  sessionTrendData,
  topImprovers,
} from '@/lib/metrics';
import type { CohortSnapshot, GroupId, User } from '@/lib/types';

/** Lets a trainer opt into (or out of) training as a member of a group too. */
function TrainerGroupMembership({ trainer }: { trainer: User }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [team, setTeam] = useState<GroupId | ''>(trainer.team ?? '');

  const save = (next: GroupId | '') => {
    setTeam(next);
    startTransition(async () => {
      await joinGroupAsTrainer(trainer.id, next || null);
      startTransition(() => router.refresh());
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-elevated/50 px-3 py-2 text-sm">
      <Users aria-hidden className="h-4 w-4 shrink-0 text-muted" />
      <span className="text-muted">להתאמן גם בתור מתאמן/ת בקבוצה:</span>
      <select
        className="input w-auto py-1 text-sm"
        value={team}
        disabled={isPending}
        onChange={(event) => save(event.target.value as GroupId | '')}
        aria-label="הצטרפות לקבוצה כמתאמן/ת"
      >
        <option value="">לא משויך/ת</option>
        {GROUP_LIST.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
      {isPending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin text-muted" /> : null}
    </div>
  );
}

type Tab = 'analytics' | 'planner' | 'media' | 'logs';

const TABS: Array<{ value: Tab; label: string; icon: typeof BarChart3 }> = [
  { value: 'analytics', label: 'אנליטיקה', icon: BarChart3 },
  { value: 'planner', label: 'אימון חדש', icon: CalendarRange },
  { value: 'media', label: 'תמונות', icon: Images },
  { value: 'logs', label: 'רישומים', icon: Table2 },
];

/**
 * Trainer cockpit: cohort and per-group analytics, comparative charts,
 * automated triage lists, the session planner, media feed and log inspector.
 */
export default function TrainerDashboard({ snapshot, trainer }: { snapshot: CohortSnapshot; trainer: User }) {
  const { participants, sessions, logs, strengthLogs, media, summaries, groups, totals } = snapshot;

  const [tab, setTab] = useState<Tab>('analytics');
  const [groupFilter, setGroupFilter] = useState<GroupId | 'all'>('all');
  const [benchmarkMode, setBenchmarkMode] = useState<'run' | 'pushups'>('run');

  const scopedSummaries = useMemo(
    () =>
      groupFilter === 'all'
        ? summaries
        : summaries.filter((summary) => summary.participant.team === groupFilter),
    [summaries, groupFilter],
  );

  const comparison = useMemo(() => groupComparisonData(groups), [groups]);
  const trend = useMemo(
    () => sessionTrendData(sessions, logs, participants),
    [sessions, logs, participants],
  );
  const scatter = useMemo(() => benchmarkScatterData(scopedSummaries), [scopedSummaries]);
  const distribution = useMemo(() => runDistribution(summaries), [summaries]);
  const improvers = useMemo(() => topImprovers(scopedSummaries, 5), [scopedSummaries]);
  const support = useMemo(() => needsSupport(scopedSummaries, 5), [scopedSummaries]);

  const nextWeekIndex = sessions.length > 0 ? Math.max(...sessions.map((s) => s.week_index)) + 1 : 1;

  return (
    <div className="space-y-6">
      <TrainerGroupMembership trainer={trainer} />

      {/* ------------------------------------------------------ cohort KPIs */}
      <section aria-label="סיכום המחזור" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="מתאמנים"
          value={totals.participants}
          hint={`${GROUP_LIST.length} קבוצות · ${sessions.length} אימונים`}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="שיפור ממוצע ב-3 ק״מ"
          value={formatPercent(totals.avg_run_improvement_pct)}
          hint="מבחן פתיחה מול מבחן סיום"
          tone="positive"
          icon={<Timer className="h-4 w-4" />}
        />
        <StatCard
          label="תוספת ממוצעת בשכיבות סמיכה"
          value={formatSignedNumber(totals.avg_pushup_gain, 1)}
          hint="חזרות שנוספו במאמץ מקסימלי"
          tone="positive"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="אימונים שהושלמו"
          value={formatPercent(totals.attendance_rate * 100, 0)}
          hint={`תוצאות שהועלו · ${totals.media_count} תמונות שותפו`}
          icon={<Activity className="h-4 w-4" />}
        />
      </section>

      {/* ----------------------------------------------------------- tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="מסכי הדשבורד" className="flex flex-wrap gap-1 rounded-xl border border-line bg-elevated p-1">
          {TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                tab === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              <Icon aria-hidden className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'analytics' ? (
          <Segmented
            ariaLabel="סינון לפי קבוצה"
            value={groupFilter}
            onChange={setGroupFilter}
            options={[
              { value: 'all' as const, label: 'כל הקבוצות' },
              ...GROUP_LIST.map((group) => ({
                value: group.id,
                label: group.shortName,
                color: group.color,
              })),
            ]}
          />
        ) : null}
      </div>

      {/* ------------------------------------------------------ analytics */}
      {tab === 'analytics' ? (
        <div className="space-y-6">
          <WeekCompletion
            sessions={sessions}
            participants={participants}
            logs={logs}
            strengthLogs={strengthLogs}
          />

          <PointsBoard
            sessions={sessions}
            participants={participants}
            users={[...participants]}
            strengthLogs={strengthLogs}
          />

          <section aria-label="אנליטיקה קבוצתית" className="grid gap-3 lg:grid-cols-3">
            {groups
              .filter((entry) => groupFilter === 'all' || entry.group.id === groupFilter)
              .map((entry) => (
                <Card key={entry.group.id} className="card-pad">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <GroupBadge groupId={entry.group.id} />
                      <p className="mt-2 text-xs leading-relaxed text-muted">
                        {entry.group.description}
                      </p>
                    </div>
                    <Badge tone="neutral">{entry.participant_count} מתאמנים</Badge>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="label">שיפור ב-3 ק״מ</dt>
                      <dd className="text-xl font-semibold tnum text-emerald-600 dark:text-emerald-400">
                        {formatPercent(entry.avg_run_improvement_pct)}
                      </dd>
                      <dd className="text-[11px] text-muted tnum">
                        {formatDuration(entry.avg_initial_run_seconds)} →{' '}
                        {formatDuration(entry.avg_final_run_seconds)}
                      </dd>
                    </div>
                    <div>
                      <dt className="label">תוספת שכיבות סמיכה</dt>
                      <dd className="text-xl font-semibold tnum text-ink">
                        {formatSignedNumber(entry.avg_pushup_gain, 1)}
                      </dd>
                      <dd className="text-[11px] text-muted tnum">
                        {entry.avg_initial_pushups.toFixed(0)} → {entry.avg_final_pushups.toFixed(0)} חזרות
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">אימונים שהושלמו</span>
                      <span className="tnum font-medium text-ink">
                        {formatPercent(entry.attendance_rate * 100, 0)}
                      </span>
                    </div>
                    <ProgressBar
                      value={entry.attendance_rate * 100}
                      color={entry.group.color}
                      label={`${entry.group.name} completion rate`}
                    />
                    <p className="text-[11px] text-muted tnum">
                      RPE ממוצע {entry.avg_rpe.toFixed(1)}
                    </p>
                  </div>
                </Card>
              ))}
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card as="section">
              <CardHeader
                icon={<BarChart3 className="h-4 w-4" />}
                title="השוואה בין הקבוצות"
                subtitle="ממוצע המבחנים — פתיחה מול סיום"
                action={
                  <Segmented
                    ariaLabel="מדד להשוואה"
                    value={benchmarkMode}
                    onChange={setBenchmarkMode}
                    options={[
                      { value: 'run' as const, label: '3 ק״מ' },
                      { value: 'pushups' as const, label: 'שכיבות סמיכה' },
                    ]}
                  />
                }
              />
              <div className="card-pad">
                <GroupComparisonChart data={comparison} mode={benchmarkMode} />
              </div>
            </Card>

            <Card as="section">
              <CardHeader
                icon={<Flame className="h-4 w-4" />}
                title="תחושת מאמץ לפי אימון"
                subtitle="RPE ממוצע לכל קבוצה, שבוע אחר שבוע"
              />
              <div className="card-pad">
                <SessionTrendChart data={trend} />
              </div>
            </Card>

            <Card as="section">
              <CardHeader
                icon={<Activity className="h-4 w-4" />}
                title="3 ק״מ — פתיחה מול סיום"
                subtitle="מתחת לקו המקווקו = השתפרו; גודל העיגול הוא אחוז השיפור"
              />
              <div className="card-pad">
                <BenchmarkScatterChart data={scatter} />
              </div>
            </Card>

            <Card as="section">
              <CardHeader
                icon={<BarChart3 className="h-4 w-4" />}
                title="התפלגות זמני 3 ק״מ בסיום"
                subtitle="סיכום חמש-מספרים לכל קבוצה, בדקות"
              />
              <div className="card-pad">
                <RunDistributionChart data={distribution} />
              </div>
            </Card>
          </div>

          {/* ------------------------------------------------ triage lists */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card as="section">
              <CardHeader
                icon={<Trophy className="h-4 w-4" />}
                title="המשתפרים הבולטים"
                subtitle="שקלול השיפור בריצה ובשכיבות סמיכה"
              />
              <ol className="divide-y divide-line">
                {improvers.map((summary, index) => (
                  <li key={summary.participant.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-5 text-sm font-semibold text-muted tnum">{index + 1}</span>
                    <Avatar name={summary.participant.name} groupId={summary.participant.team} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {summary.participant.name}
                      </p>
                      <p className="text-xs text-muted tnum">
                        {formatPercent(summary.delta.run_improvement_pct ?? 0)} בריצה ·{' '}
                        {formatPercent(summary.delta.pushup_improvement_pct ?? 0)} בשכיבות סמיכה
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge tone="positive">
                        {formatSignedPercent(summary.delta.composite_score ?? 0)} כללי
                      </Badge>
                      <GroupBadge groupId={summary.participant.team} short />
                    </div>
                  </li>
                ))}
              </ol>
            </Card>

            <Card as="section">
              <CardHeader
                icon={<LifeBuoy className="h-4 w-4" />}
                title="זקוקים לתשומת לב"
                subtitle="סומנו לפי שיפור במבחנים, אימונים שלא הושלמו או מאמץ"
              />
              {support.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted">
                  אף אחד לא סומן בקבוצה הזו — כולם בכיוון טוב.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {support.map(({ summary, reasons }) => (
                    <li key={summary.participant.id} className="flex items-start gap-3 px-4 py-3">
                      <Avatar name={summary.participant.name} groupId={summary.participant.team} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {summary.participant.name}
                        </p>
                        <ul className="mt-1 flex flex-wrap gap-1">
                          {reasons.map((reason) => (
                            <li key={reason}>
                              <Badge tone="warning">{reason}</Badge>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          tone={(summary.delta.run_improvement_pct ?? 0) > 0 ? 'neutral' : 'negative'}
                        >
                          {formatSignedPercent(summary.delta.run_improvement_pct ?? 0)}
                        </Badge>
                        <span className="text-[11px] text-muted tnum">
                          {summary.attended_sessions}/{summary.total_sessions} הושלמו
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'planner' ? (
        <WeeklyTrainingBuilder
          nextWeekIndex={nextWeekIndex}
          participantCount={participants.length}
          pastSessions={sessions}
          trainerId={trainer.id}
        />
      ) : null}

      {tab === 'media' ? (
        <MediaGallery media={media} participants={participants} sessions={sessions} />
      ) : null}

      {tab === 'logs' ? (
        <LogsTable logs={logs} participants={participants} sessions={sessions} />
      ) : null}
    </div>
  );
}
