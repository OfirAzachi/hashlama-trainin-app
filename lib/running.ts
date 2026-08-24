/**
 * Scoring for running trainings.
 *
 * A running training is a list of segments — N repeats of a distance at a
 * prescribed pace — or a single steady run. The trainer dictates the pace
 * qualitatively (walk / talk-pace jog / easy run / sprint) rather than a
 * number, so scoring reads distance covered against that category's weight:
 *
 *   points = (metres covered / 100) x pace multiplier
 *
 * There is no group goal for running — it is pure competition. Every point
 * feeds straight into the group's league-table total on the home page.
 */
import type {
  Participant,
  RunningConfig,
  RunningLog,
  RunningSegment,
  RunPaceCategory,
  GroupId,
  TrainingSession,
  User,
} from './types';

export const PACE_CATEGORIES: RunPaceCategory[] = ['walk', 'talk', 'borg', 'sprint'];

export const PACE_LABELS: Record<RunPaceCategory, string> = {
  walk: 'הליכה',
  talk: 'ריצה קלה מאוד (קצב דיבור)',
  borg: 'ריצה קלה (קצב בראור)',
  sprint: 'ספרינט',
};

/** Points multiplier per pace category — faster prescribed effort scores more. */
export const PACE_MULTIPLIER: Record<RunPaceCategory, number> = {
  walk: 1,
  talk: 2,
  borg: 3,
  sprint: 4,
};

export function segmentDistance(segment: RunningSegment, repeatsDone?: number): number {
  return segment.distance_meters * (repeatsDone ?? segment.repeats);
}

export interface RunningScore {
  total_distance_meters: number;
  points: number;
}

/** Scores one segment from the repeats the athlete actually completed. */
export function scoreSegment(segment: RunningSegment, repeatsDone: number): RunningScore {
  const repeats = Math.max(0, Math.min(segment.repeats, Math.floor(repeatsDone)));
  const distance = segment.distance_meters * repeats;
  if (repeats === 0 || distance <= 0) {
    return { total_distance_meters: 0, points: 0 };
  }
  return {
    total_distance_meters: distance,
    points: Math.round(distance / 100) * PACE_MULTIPLIER[segment.pace_category],
  };
}

/** Points the whole plan is worth if every segment is completed in full. */
export function plannedPoints(segments: RunningSegment[]): number {
  return segments.reduce(
    (sum, segment) =>
      sum + Math.round(segmentDistance(segment) / 100) * PACE_MULTIPLIER[segment.pace_category],
    0,
  );
}

export function plannedDistance(segments: RunningSegment[]): number {
  return segments.reduce((sum, segment) => sum + segmentDistance(segment), 0);
}

/* ------------------------------------------------------- aggregates */

export function totalRunningPoints(logs: RunningLog[]): number {
  return logs.reduce((sum, log) => sum + log.points, 0);
}

export function runningLeaderboard(
  logs: RunningLog[],
  users: User[],
): Array<{ user: User; points: number; distance: number }> {
  const byUser = new Map<string, { points: number; distance: number }>();
  logs.forEach((log) => {
    const current = byUser.get(log.user_id) ?? { points: 0, distance: 0 };
    byUser.set(log.user_id, {
      points: current.points + log.points,
      distance: current.distance + log.total_distance_meters,
    });
  });

  return users
    .filter((user) => byUser.has(user.id))
    .map((user) => ({ user, ...byUser.get(user.id)! }))
    .sort((a, b) => b.points - a.points);
}

/* ------------------------------------------------------------ labels */

/** "5 × 800 מ׳ בקצב ריצה קלה (קצב בראור) · 90 שנ׳ מנוחה" */
export function segmentSummary(segment: RunningSegment): string {
  const distance =
    segment.distance_meters >= 1000
      ? `${(segment.distance_meters / 1000).toFixed(segment.distance_meters % 1000 === 0 ? 0 : 1)} ק״מ`
      : `${segment.distance_meters} מ׳`;
  const head = segment.repeats > 1 ? `${segment.repeats} × ${distance}` : distance;
  const rest =
    segment.repeats > 1 && segment.recovery_seconds > 0
      ? ` · ${segment.recovery_seconds} שנ׳ מנוחה`
      : '';
  return `${head} בקצב ${PACE_LABELS[segment.pace_category]}${rest}`;
}

/**
 * The segments one group actually runs.
 *
 * When the trainer gives a group its own alternative (say a row instead of a
 * hill session), that replaces the shared plan for them — otherwise they would
 * be asked to do both.
 */
export function segmentsForGroup(
  config: RunningConfig | null | undefined,
  group: GroupId,
): RunningSegment[] {
  if (!config) return [];
  const own = config.segments.filter((segment) => segment.target_group === group);
  return own.length > 0 ? own : config.segments.filter((segment) => segment.target_group === 'all');
}
