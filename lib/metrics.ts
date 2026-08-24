/**
 * Pure analytics layer. Everything here is a deterministic function of the
 * entities, so the same code powers server components, server actions and the
 * PostgreSQL views in `supabase/schema.sql`.
 */
import { GROUPS_BY_ID, GROUP_LIST } from './groups';
import { paceFromRun } from './format';
import type {
  BenchmarkDelta,
  BenchmarkTest,
  GroupAnalytics,
  GroupId,
  Participant,
  ParticipantSummary,
  SessionLog,
  TrainingSession,
} from './types';

const RUN_DISTANCE_METERS = 3000;

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next !== undefined ? sorted[base] + rest * (next - sorted[base]) : sorted[base];
}

/* ------------------------------------------------------------- deltas */

/**
 * Baseline vs. exit benchmark for one participant.
 * Run improvement is expressed as a positive percentage when the athlete got
 * faster, so both metrics read "higher is better" in the UI.
 */
export function computeDelta(userId: string, tests: BenchmarkTest[]): BenchmarkDelta {
  const own = tests.filter((test) => test.user_id === userId);
  const initial = own.find((test) => test.test_type === 'initial') ?? null;
  const final = own.find((test) => test.test_type === 'final') ?? null;

  if (!initial || !final) {
    return {
      user_id: userId,
      initial,
      final,
      run_delta_seconds: null,
      run_improvement_pct: null,
      initial_pace_seconds_per_km: initial ? paceFromRun(initial.run_3km_seconds, RUN_DISTANCE_METERS) : null,
      final_pace_seconds_per_km: final ? paceFromRun(final.run_3km_seconds, RUN_DISTANCE_METERS) : null,
      pushup_delta: null,
      pushup_improvement_pct: null,
      composite_score: null,
    };
  }

  const runDelta = final.run_3km_seconds - initial.run_3km_seconds; // negative = faster
  const runImprovementPct = (-runDelta / initial.run_3km_seconds) * 100;
  const pushupDelta = final.max_pushups - initial.max_pushups;
  const pushupImprovementPct = initial.max_pushups > 0 ? (pushupDelta / initial.max_pushups) * 100 : 0;

  return {
    user_id: userId,
    initial,
    final,
    run_delta_seconds: runDelta,
    run_improvement_pct: runImprovementPct,
    initial_pace_seconds_per_km: paceFromRun(initial.run_3km_seconds, RUN_DISTANCE_METERS),
    final_pace_seconds_per_km: paceFromRun(final.run_3km_seconds, RUN_DISTANCE_METERS),
    pushup_delta: pushupDelta,
    pushup_improvement_pct: pushupImprovementPct,
    // Running gains are harder to move than push-up gains, so weight them higher.
    composite_score: runImprovementPct * 1.6 + pushupImprovementPct * 0.4,
  };
}

/* -------------------------------------------------- attendance & streak */

/** Anything that proves a participant showed up for a session. */
export interface AttendanceRecord {
  session_id: string;
  user_id: string;
}

/**
 * Sessions a participant uploaded something for — an exercise result, banked
 * points or a logged run. All three count as completing the training.
 */
export function attendedSessionIds(
  userId: string,
  logs: SessionLog[],
  extra: AttendanceRecord[] = [],
): Set<string> {
  return new Set(
    [...logs, ...extra]
      .filter((log) => log.user_id === userId)
      .map((log) => log.session_id),
  );
}

/** Longest run of consecutive attended sessions, in chronological order. */
export function longestStreak(
  userId: string,
  sessions: TrainingSession[],
  logs: SessionLog[],
  extra: AttendanceRecord[] = [],
): number {
  const attended = attendedSessionIds(userId, logs, extra);
  let best = 0;
  let current = 0;
  [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((session) => {
      if (attended.has(session.id)) {
        current += 1;
        best = Math.max(best, current);
      } else {
        current = 0;
      }
    });
  return best;
}

/* --------------------------------------------------------- summaries */

export function buildParticipantSummary(
  participant: Participant,
  tests: BenchmarkTest[],
  sessions: TrainingSession[],
  logs: SessionLog[],
  extra: AttendanceRecord[] = [],
): ParticipantSummary {
  const relevantSessions = sessions.filter(
    (session) =>
      session.target_group === 'all' || session.target_group === participant.team,
  );
  const attended = attendedSessionIds(participant.id, logs, extra);
  const attendedCount = relevantSessions.filter((session) => attended.has(session.id)).length;
  const ownLogs = logs.filter((log) => log.user_id === participant.id);

  return {
    participant,
    delta: computeDelta(participant.id, tests),
    attended_sessions: attendedCount,
    total_sessions: relevantSessions.length,
    attendance_rate: relevantSessions.length > 0 ? attendedCount / relevantSessions.length : 0,
    avg_rpe: ownLogs.length > 0 ? mean(ownLogs.map((log) => log.rpe)) : null,
    streak: longestStreak(participant.id, relevantSessions, logs, extra),
  };
}

export function buildParticipantSummaries(
  participants: Participant[],
  tests: BenchmarkTest[],
  sessions: TrainingSession[],
  logs: SessionLog[],
  extra: AttendanceRecord[] = [],
): ParticipantSummary[] {
  return participants.map((participant) =>
    buildParticipantSummary(participant, tests, sessions, logs, extra),
  );
}

/* ---------------------------------------------------- group analytics */

export function buildGroupAnalytics(summaries: ParticipantSummary[]): GroupAnalytics[] {
  return GROUP_LIST.map((group) => {
    const members = summaries.filter((summary) => summary.participant.team === group.id);
    const tested = members.filter((summary) => summary.delta.initial && summary.delta.final);

    return {
      group,
      participant_count: members.length,
      tested_count: tested.length,
      avg_run_improvement_pct: mean(tested.map((s) => s.delta.run_improvement_pct ?? 0)),
      avg_pushup_gain: mean(tested.map((s) => s.delta.pushup_delta ?? 0)),
      avg_pushup_improvement_pct: mean(tested.map((s) => s.delta.pushup_improvement_pct ?? 0)),
      avg_initial_run_seconds: mean(tested.map((s) => s.delta.initial?.run_3km_seconds ?? 0)),
      avg_final_run_seconds: mean(tested.map((s) => s.delta.final?.run_3km_seconds ?? 0)),
      avg_initial_pushups: mean(tested.map((s) => s.delta.initial?.max_pushups ?? 0)),
      avg_final_pushups: mean(tested.map((s) => s.delta.final?.max_pushups ?? 0)),
      attendance_rate: mean(members.map((s) => s.attendance_rate)),
      avg_rpe: mean(members.map((s) => s.avg_rpe ?? 0).filter((value) => value > 0)),
    };
  });
}

export interface CohortTotals {
  participants: number;
  avg_run_improvement_pct: number;
  avg_pushup_gain: number;
  attendance_rate: number;
  logged_entries: number;
  media_count: number;
}

export function buildCohortTotals(
  summaries: ParticipantSummary[],
  logCount: number,
  mediaCount: number,
): CohortTotals {
  const tested = summaries.filter((summary) => summary.delta.initial && summary.delta.final);
  return {
    participants: summaries.length,
    avg_run_improvement_pct: mean(tested.map((s) => s.delta.run_improvement_pct ?? 0)),
    avg_pushup_gain: mean(tested.map((s) => s.delta.pushup_delta ?? 0)),
    attendance_rate: mean(summaries.map((s) => s.attendance_rate)),
    logged_entries: logCount,
    media_count: mediaCount,
  };
}

/* ------------------------------------------------- rankings & triage */

export function topImprovers(summaries: ParticipantSummary[], limit = 5): ParticipantSummary[] {
  return [...summaries]
    .filter((summary) => summary.delta.composite_score !== null)
    .sort((a, b) => (b.delta.composite_score ?? 0) - (a.delta.composite_score ?? 0))
    .slice(0, limit);
}

export interface SupportFlag {
  summary: ParticipantSummary;
  reasons: string[];
}

/**
 * Participants who need a conversation: weak or negative benchmark movement,
 * thin attendance, or sustained high perceived effort.
 */
export function needsSupport(summaries: ParticipantSummary[], limit = 5): SupportFlag[] {
  return summaries
    .map((summary) => {
      const reasons: string[] = [];
      const runPct = summary.delta.run_improvement_pct;
      const pushupDelta = summary.delta.pushup_delta;

      if (runPct !== null && runPct < 4) {
        reasons.push(runPct <= 0 ? '3km time regressed' : 'Under 4% run improvement');
      }
      if (pushupDelta !== null && pushupDelta <= 3) {
        reasons.push('Push-up gain of 3 reps or fewer');
      }
      if (summary.attendance_rate < 0.7) {
        reasons.push(`Attendance ${Math.round(summary.attendance_rate * 100)}%`);
      }
      if ((summary.avg_rpe ?? 0) >= 8.5) {
        reasons.push(`Average RPE ${(summary.avg_rpe ?? 0).toFixed(1)}`);
      }
      return { summary, reasons };
    })
    .filter((flag) => flag.reasons.length > 0)
    .sort(
      (a, b) =>
        b.reasons.length - a.reasons.length ||
        (a.summary.delta.composite_score ?? 0) - (b.summary.delta.composite_score ?? 0),
    )
    .slice(0, limit);
}

/* -------------------------------------------------------- chart data */

export interface GroupComparisonPoint {
  group: string;
  groupId: GroupId;
  color: string;
  initialRun: number;
  finalRun: number;
  runImprovement: number;
  initialPushups: number;
  finalPushups: number;
  pushupGain: number;
  attendance: number;
}

export function groupComparisonData(analytics: GroupAnalytics[]): GroupComparisonPoint[] {
  return analytics.map((entry) => ({
    group: entry.group.shortName,
    groupId: entry.group.id,
    color: entry.group.color,
    initialRun: Math.round(entry.avg_initial_run_seconds),
    finalRun: Math.round(entry.avg_final_run_seconds),
    runImprovement: Number(entry.avg_run_improvement_pct.toFixed(1)),
    initialPushups: Number(entry.avg_initial_pushups.toFixed(1)),
    finalPushups: Number(entry.avg_final_pushups.toFixed(1)),
    pushupGain: Number(entry.avg_pushup_gain.toFixed(1)),
    attendance: Number((entry.attendance_rate * 100).toFixed(0)),
  }));
}

export interface ScatterPoint {
  name: string;
  groupId: GroupId;
  initial: number;
  final: number;
  improvement: number;
}

/** Baseline (x) vs. exit (y) 3km time, in minutes, one point per participant. */
export function benchmarkScatterData(summaries: ParticipantSummary[]): ScatterPoint[] {
  return summaries
    .filter((summary) => summary.delta.initial && summary.delta.final)
    .map((summary) => ({
      name: summary.participant.name,
      groupId: summary.participant.team,
      initial: Number(((summary.delta.initial?.run_3km_seconds ?? 0) / 60).toFixed(2)),
      final: Number(((summary.delta.final?.run_3km_seconds ?? 0) / 60).toFixed(2)),
      improvement: Number((summary.delta.run_improvement_pct ?? 0).toFixed(1)),
    }));
}

export interface DistributionBox {
  groupId: GroupId;
  label: string;
  color: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

/** Five-number summary of exit 3km times (minutes) per group. */
export function runDistribution(summaries: ParticipantSummary[]): DistributionBox[] {
  return GROUP_LIST.map((group) => {
    const values = summaries
      .filter((s) => s.participant.team === group.id && s.delta.final)
      .map((s) => (s.delta.final?.run_3km_seconds ?? 0) / 60);
    return {
      groupId: group.id,
      label: group.shortName,
      color: group.color,
      min: values.length ? Math.min(...values) : 0,
      q1: quantile(values, 0.25),
      median: median(values),
      q3: quantile(values, 0.75),
      max: values.length ? Math.max(...values) : 0,
    };
  });
}

export interface SessionTrendPoint {
  session: string;
  date: string;
  rpeByGroup: Record<GroupId, number | null>;
  attendanceByGroup: Record<GroupId, number>;
}

/** Per-session average RPE and attendance count, split by group. */
export function sessionTrendData(
  sessions: TrainingSession[],
  logs: SessionLog[],
  participants: Participant[],
): SessionTrendPoint[] {
  const groupOf = new Map(participants.map((p) => [p.id, p.team]));

  return [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((session) => {
      const sessionLogs = logs.filter((log) => log.session_id === session.id);
      const rpeByGroup = {} as Record<GroupId, number | null>;
      const attendanceByGroup = {} as Record<GroupId, number>;

      GROUP_LIST.forEach((group) => {
        const groupLogs = sessionLogs.filter((log) => groupOf.get(log.user_id) === group.id);
        const attendees = new Set(groupLogs.map((log) => log.user_id));
        rpeByGroup[group.id] = groupLogs.length
          ? Number(mean(groupLogs.map((log) => log.rpe)).toFixed(2))
          : null;
        attendanceByGroup[group.id] = attendees.size;
      });

      return {
        session: `S${session.week_index}`,
        date: session.date,
        rpeByGroup,
        attendanceByGroup,
      };
    });
}

/* ------------------------------------------------------------- export */

const CSV_HEADERS = [
  'log_id',
  'session_id',
  'session_date',
  'session_title',
  'participant',
  'email',
  'group',
  'exercise',
  'metric_type',
  'metric_value',
  'rpe',
  'notes',
  'created_at',
];

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function logsToCsv(
  logs: SessionLog[],
  participants: Participant[],
  sessions: TrainingSession[],
): string {
  const userById = new Map(participants.map((p) => [p.id, p]));
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  const rows = logs.map((log) => {
    const user = userById.get(log.user_id);
    const session = sessionById.get(log.session_id);
    return [
      log.id,
      log.session_id,
      session?.date ?? '',
      session?.title ?? '',
      user?.name ?? log.user_id,
      user?.email ?? '',
      user?.team ? GROUPS_BY_ID[user.team].name : '',
      log.exercise_name,
      log.metric_type,
      log.metric_value,
      log.rpe,
      log.notes ?? '',
      log.created_at,
    ].map(csvCell).join(',');
  });

  return [CSV_HEADERS.join(','), ...rows].join('\n');
}
