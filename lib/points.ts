/**
 * Scoring rules for the points games (strength and endurance).
 *
 *   Points = Reps x Level x Gender multiplier
 *   Static holds:  every 5 seconds  = 1 rep
 *   Bear crawl:    every 2 metres   = 1 rep
 *   Gender multiplier: x1.5 for women, x1 otherwise — same rule applied to
 *   running (see lib/running.ts). The database mirrors this exact formula
 *   (a trigger, not a generated column, since it needs the user's gender
 *   from a different table) — client-side scoring here is only a live
 *   preview and must stay in lock-step with it.
 *
 * There is no group goal to "unlock" — points simply accumulate toward the
 * group's standing on the home page league table.
 */
import { GROUP_LIST } from './groups';
import { findExercise } from './catalog';
import type { StrengthExercise } from './strength-catalog';
import type {
  GroupId,
  Participant,
  PointsSummary,
  QuickActivity,
  StrengthLog,
  TrainingSession,
  User,
} from './types';

/** x1.5 for women, x1 otherwise — mirrors the database trigger exactly. */
export function genderMultiplier(gender: string | null | undefined): number {
  return gender === 'נ' ? 1.5 : 1;
}

/** Raw input (reps / seconds / metres) converted to scoring reps. */
export function repsFromRaw(exercise: StrengthExercise, rawValue: number): number {
  if (!Number.isFinite(rawValue) || rawValue <= 0) return 0;
  return Math.floor(rawValue / exercise.unitsPerRep);
}

/** Points for one interval slot: reps x level x gender multiplier. */
export function pointsFor(exercise: StrengthExercise, rawValue: number, gender?: string | null): number {
  return Math.round(repsFromRaw(exercise, rawValue) * exercise.level * genderMultiplier(gender));
}

/** Convenience for UI previews: both numbers at once. */
export function scoreEntry(
  exerciseId: string,
  rawValue: number,
  gender?: string | null,
): { reps: number; points: number; exercise: StrengthExercise | undefined } {
  const exercise = findExercise(exerciseId);
  if (!exercise) return { reps: 0, points: 0, exercise: undefined };
  const reps = repsFromRaw(exercise, rawValue);
  return { reps, points: Math.round(reps * exercise.level * genderMultiplier(gender)), exercise };
}

/**
 * Points for one self-logged activity, mirroring the quick_logs trigger
 * exactly (client-side preview only — the database is the authority):
 *   running — round(metres / 100) x 2 x gender multiplier  (20 pts per km)
 *   pushups — reps x 1 x gender multiplier
 */
export function quickLogPoints(
  activity: QuickActivity,
  value: number,
  gender?: string | null,
): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const base = activity === 'running' ? Math.round(value / 100) * 2 : value;
  return Math.round(base * genderMultiplier(gender));
}

/* -------------------------------------------------------- aggregates */

export function totalPoints(logs: StrengthLog[]): number {
  return logs.reduce((sum, log) => sum + log.points, 0);
}

export function summarisePoints(userId: string, logs: StrengthLog[]): PointsSummary {
  const own = logs.filter((log) => log.user_id === userId);
  return {
    user_id: userId,
    points: own.reduce((sum, log) => sum + log.points, 0),
    reps: own.reduce((sum, log) => sum + log.reps, 0),
    entries: own.length,
  };
}

/** Individual points for one session, ranked highest first. */
export function sessionLeaderboard(
  logs: StrengthLog[],
  users: User[],
): Array<{ user: User; points: number; reps: number; entries: number }> {
  const byUser = new Map<string, { points: number; reps: number; entries: number }>();
  logs.forEach((log) => {
    const current = byUser.get(log.user_id) ?? { points: 0, reps: 0, entries: 0 };
    byUser.set(log.user_id, {
      points: current.points + log.points,
      reps: current.reps + log.reps,
      entries: current.entries + 1,
    });
  });

  return users
    .filter((user) => byUser.has(user.id))
    .map((user) => ({ user, ...byUser.get(user.id)! }))
    .sort((a, b) => b.points - a.points);
}

/** Per-group points breakdown for one session — a scoreboard, not a goal. */
export interface GroupPointsBreakdown {
  team: GroupId;
  points: number;
  contributors: Array<{ user: User; points: number; reps: number }>;
}

/**
 * How much each group banked in one points game. There is nothing to
 * "unlock" here — every point just adds to the group's standing on the
 * home page league table.
 */
export function groupPointsBreakdown(
  session: TrainingSession,
  logs: StrengthLog[],
  participants: Participant[],
): GroupPointsBreakdown[] {
  const sessionLogs = logs.filter((log) => log.session_id === session.id);
  const groupOf = new Map(participants.map((person) => [person.id, person.team]));

  return GROUP_LIST.map((group) => {
    const members = participants.filter((person) => person.team === group.id);
    const groupLogs = sessionLogs.filter((log) => groupOf.get(log.user_id) === group.id);

    const contributors = members
      .map((member) => {
        const own = groupLogs.filter((log) => log.user_id === member.id);
        return {
          user: member as User,
          points: totalPoints(own),
          reps: own.reduce((sum, log) => sum + log.reps, 0),
        };
      })
      .filter((entry) => entry.points > 0)
      .sort((a, b) => b.points - a.points);

    return {
      team: group.id as GroupId,
      points: totalPoints(groupLogs),
      contributors,
    };
  });
}

/** Cohort-wide points for a session, across all groups. */
export function cohortPoints(session: TrainingSession, logs: StrengthLog[]): number {
  return totalPoints(logs.filter((log) => log.session_id === session.id));
}

/* ------------------------------------------------- cohort standings */

export interface GroupStanding {
  team: GroupId;
  /** Points from every training type, combined. */
  points: number;
  points_per_member: number;
  members: number;
  /** Share of published trainings the group actually completed, 0..1. */
  completion_rate: number;
  /** Average 3km improvement, in percent. */
  run_improvement_pct: number;
  /** Average push-up gain, in reps. */
  pushup_gain: number;
}

/**
 * The league table behind the home page: one row per group, ranked by points
 * per member so a smaller group is never punished for its size.
 */
export function groupStandings(input: {
  participants: Participant[];
  strengthLogs: StrengthLog[];
  runningPoints: Array<{ session_id: string; user_id: string; points: number }>;
  completionByGroup: Record<GroupId, number>;
  improvementByGroup: Record<GroupId, { run: number; pushups: number }>;
}): GroupStanding[] {
  const groupOf = new Map(input.participants.map((person) => [person.id, person.team]));
  const pointsByGroup: Record<number, number> = Object.fromEntries(
    GROUP_LIST.map((group) => [group.id, 0]),
  );

  [...input.strengthLogs.map((log) => ({ user_id: log.user_id, points: log.points })),
   ...input.runningPoints.map((log) => ({ user_id: log.user_id, points: log.points }))]
    .forEach((entry) => {
      const group = groupOf.get(entry.user_id);
      if (group) pointsByGroup[group] += entry.points;
    });

  // Manual catch-up bonuses count toward the group total too, same as any
  // other points — just not tied to a specific logged training.
  input.participants.forEach((person) => {
    if (person.bonus_points) pointsByGroup[person.team] += person.bonus_points;
  });

  return GROUP_LIST.map((group) => {
    const members = input.participants.filter((person) => person.team === group.id).length;
    const points = pointsByGroup[group.id] ?? 0;
    return {
      team: group.id as GroupId,
      points,
      points_per_member: members > 0 ? Math.round(points / members) : 0,
      members,
      completion_rate: input.completionByGroup[group.id as GroupId] ?? 0,
      run_improvement_pct: input.improvementByGroup[group.id as GroupId]?.run ?? 0,
      pushup_gain: input.improvementByGroup[group.id as GroupId]?.pushups ?? 0,
    };
  }).sort((a, b) => b.points_per_member - a.points_per_member);
}

/* -------------------------------------------------------- unit standings */

export interface UnitStanding {
  unit: string;
  /** Points from every training type, combined. */
  points: number;
  points_per_member: number;
  members: number;
}

/**
 * The same per-member race as the group table, but by real-world unit
 * instead of training group — so a big unit's raw point total never
 * outranks a small unit that's actually pulling more weight per person.
 * Participants without a unit on file (roster gaps) are left out rather
 * than lumped into a meaningless "no unit" row.
 */
export function unitStandings(input: {
  participants: Participant[];
  strengthLogs: StrengthLog[];
  runningPoints: Array<{ session_id: string; user_id: string; points: number }>;
}): UnitStanding[] {
  const unitOf = new Map(input.participants.map((person) => [person.id, person.unit]));

  const membersByUnit = new Map<string, number>();
  input.participants.forEach((person) => {
    if (!person.unit) return;
    membersByUnit.set(person.unit, (membersByUnit.get(person.unit) ?? 0) + 1);
  });

  const pointsByUnit = new Map<string, number>();
  [...input.strengthLogs.map((log) => ({ user_id: log.user_id, points: log.points })),
   ...input.runningPoints.map((log) => ({ user_id: log.user_id, points: log.points }))]
    .forEach((entry) => {
      const unit = unitOf.get(entry.user_id);
      if (!unit) return;
      pointsByUnit.set(unit, (pointsByUnit.get(unit) ?? 0) + entry.points);
    });

  // Manual catch-up bonuses count toward the unit total too.
  input.participants.forEach((person) => {
    if (person.bonus_points && person.unit) {
      pointsByUnit.set(person.unit, (pointsByUnit.get(person.unit) ?? 0) + person.bonus_points);
    }
  });

  return [...membersByUnit.entries()]
    .map(([unit, members]) => {
      const points = pointsByUnit.get(unit) ?? 0;
      return {
        unit,
        points,
        points_per_member: members > 0 ? Math.round(points / members) : 0,
        members,
      };
    })
    .sort((a, b) => b.points_per_member - a.points_per_member);
}
