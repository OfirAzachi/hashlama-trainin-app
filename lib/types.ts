/**
 * Domain model for the Hashlama training course.
 * These types mirror the PostgreSQL schema in `supabase/schema.sql` one-to-one:
 * every table has an entity type, every enum has a union type.
 */

/* ------------------------------------------------------------------ enums */

export const ROLES = ['trainer', 'participant'] as const;
export type Role = (typeof ROLES)[number];

/** A team number (1-8), from the roster's צוות column — the primary group. */
export const TEAM_IDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type GroupId = (typeof TEAM_IDS)[number];

/** Target of a training session: every team, or one specific team's alternative. */
export type SessionTarget = 'all' | GroupId;

export const TEST_TYPES = ['initial', 'final'] as const;
export type TestType = (typeof TEST_TYPES)[number];

export const METRIC_TYPES = ['reps', 'time_seconds', 'distance_meters', 'weight_kg'] as const;
export type MetricType = (typeof METRIC_TYPES)[number];

/** Borg CR10 rate of perceived exertion. */
export type RPE = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/* --------------------------------------------------------------- entities */

export interface Group {
  id: GroupId;
  /** Display name, e.g. "צוות 3". */
  name: string;
  shortName: string;
  description: string;
  /** Tailwind-safe hex used consistently across charts and badges. */
  color: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** The primary competition group. Trainers are not assigned a team. */
  team: GroupId | null;
  /**
   * The secondary competition group (roster's יחידה) — independent of team,
   * shown as a second leaderboard only. Never drives training content.
   */
  unit: string | null;
  avatar_url: string | null;
  joined_at: string; // ISO date
}

export interface Participant extends User {
  role: 'participant';
  team: GroupId;
}

export interface BenchmarkTest {
  id: string;
  user_id: string;
  test_type: TestType;
  /** 3km run time in whole seconds. */
  run_3km_seconds: number;
  max_pushups: number;
  recorded_date: string; // ISO date
}

/** One prescribed exercise inside a session track. */
export interface ExercisePrescription {
  id: string;
  name: string;
  metric_type: MetricType;
  /** Free-text prescription, e.g. "5 x 800m @ 4:15/km, 90s rest". */
  prescription: string;
  /** Optional numeric target used to shade the log input placeholder. */
  target_value: number | null;
}

/** A group-specific variant of the same session (standard vs. low-impact). */
export interface SessionTrack {
  id: string;
  session_id: string;
  target_group: SessionTarget;
  label: string;
  exercises: ExercisePrescription[];
}

export interface TrainingSession {
  id: string;
  date: string; // ISO date
  title: string;
  /** Broad target; per-group detail lives in `tracks`. */
  target_group: SessionTarget;
  workout_instructions: string;
  /** Sequential week number in the course plan (1-based). */
  week_index: number;
  /** Aerobic trainings prescribe exercises; strength trainings are a points game. */
  training_type: TrainingType;
  /** Interval, category and goal setup — strength trainings only. */
  points_game: PointsGameConfig | null;
  /** Segment plan — running trainings only. */
  running: RunningConfig | null;
  /** Prescribed work per group. Empty for strength trainings. */
  tracks: SessionTrack[];
}

export interface SessionLog {
  id: string;
  session_id: string;
  user_id: string;
  exercise_name: string;
  metric_type: MetricType;
  metric_value: number;
  rpe: RPE;
  notes: string | null;
  created_at: string; // ISO timestamp
}

export interface SessionMedia {
  id: string;
  session_id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  /** Free-form tags, typically the exercise the photo documents. */
  tags: string[];
  uploaded_at: string; // ISO timestamp
}

/* ------------------------------------------------------- derived metrics */

export interface BenchmarkDelta {
  user_id: string;
  initial: BenchmarkTest | null;
  final: BenchmarkTest | null;
  /** Negative = faster. Seconds. */
  run_delta_seconds: number | null;
  /** Positive = faster (improvement expressed as a gain). Percent. */
  run_improvement_pct: number | null;
  initial_pace_seconds_per_km: number | null;
  final_pace_seconds_per_km: number | null;
  pushup_delta: number | null;
  pushup_improvement_pct: number | null;
  /** Combined score used to rank improvers; higher is better. */
  composite_score: number | null;
}

export interface GroupAnalytics {
  group: Group;
  participant_count: number;
  tested_count: number;
  avg_run_improvement_pct: number;
  avg_pushup_gain: number;
  avg_pushup_improvement_pct: number;
  avg_initial_run_seconds: number;
  avg_final_run_seconds: number;
  avg_initial_pushups: number;
  avg_final_pushups: number;
  attendance_rate: number; // 0..1
  avg_rpe: number;
}

export interface ParticipantSummary {
  participant: Participant;
  delta: BenchmarkDelta;
  attended_sessions: number;
  total_sessions: number;
  attendance_rate: number; // 0..1
  avg_rpe: number | null;
  /** Longest run of consecutive attended sessions. */
  streak: number;
}

/* ------------------------------------------------------- API / form types */

export interface LogEntryInput {
  session_id: string;
  user_id: string;
  exercise_name: string;
  metric_type: MetricType;
  metric_value: number;
  rpe: RPE;
  notes?: string;
}

export interface MediaUploadInput {
  session_id: string;
  user_id: string;
  /** Data URL in mock mode; Supabase Storage public URL in production. */
  image_url: string;
  caption?: string;
  tags?: string[];
}

export interface SessionPlanInput {
  date: string;
  title: string;
  workout_instructions: string;
  week_index: number;
  training_type: TrainingType;
  points_game?: PointsGameConfig | null;
  running?: RunningConfig | null;
  tracks: Array<{
    target_group: SessionTarget;
    label: string;
    exercises: Array<Omit<ExercisePrescription, 'id'>>;
  }>;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/* ------------------------------------------------------------ snapshots */


/** Resolved payload for the trainer dashboard. */
export interface CohortSnapshot {
  participants: Participant[];
  sessions: TrainingSession[];
  logs: SessionLog[];
  /** Points banked across every points game. */
  strengthLogs: StrengthLog[];
  /** Every logged running segment. */
  runningLogs: RunningLog[];
  media: SessionMedia[];
  summaries: ParticipantSummary[];
  groups: GroupAnalytics[];
  totals: {
    participants: number;
    avg_run_improvement_pct: number;
    avg_pushup_gain: number;
    attendance_rate: number;
    logged_entries: number;
    media_count: number;
  };
}

/** Resolved payload for a single participant view. */
export interface ParticipantSnapshot {
  participant: Participant;
  sessions: TrainingSession[];
  currentSession: TrainingSession | null;
  logs: SessionLog[];
  media: SessionMedia[];
  /** Every published week with its completed / missed / due status. */
  trainings: TrainingCard[];
  summary: ParticipantSummary;
}

/* -------------------------------------------------------- social feed */

export interface MediaComment {
  id: string;
  media_id: string;
  user_id: string;
  body: string;
  created_at: string; // ISO timestamp
}

export interface MediaLike {
  media_id: string;
  user_id: string;
  created_at: string; // ISO timestamp
}

/** A feed post: the photo plus everything needed to render it socially. */
export interface FeedPost {
  media: SessionMedia;
  author: User;
  session: TrainingSession | null;
  likes: number;
  likedByMe: boolean;
  comments: Array<{ comment: MediaComment; author: User }>;
}

/* --------------------------------------------------- training status */

export type TrainingStatus = 'completed' | 'missed' | 'due';

/** One week of training as a participant sees it, with its completion state. */
export interface TrainingCard {
  session: TrainingSession;
  track: SessionTrack | null;
  status: TrainingStatus;
  logs: SessionLog[];
  /** Filled interval slots — points games only. */
  strengthLogs: StrengthLog[];
  /** Logged segments — running trainings only. */
  runningLogs: RunningLog[];
  /** Points banked in this training — strength trainings only. */
  points: number;
  /** Exercises logged out of the number prescribed. */
  loggedExercises: number;
  totalExercises: number;
  photos: number;
}

/* ------------------------------------------------- strength / points */

import type {
  CategoryId,
  StrengthCategoryId,
  StrengthLevel,
  StrengthUnit,
} from './strength-catalog';

export type { CategoryId, StrengthLevel, StrengthUnit } from './strength-catalog';

/** Aerobic trainings prescribe exercises; strength trainings are a points game. */
/**
 * Five kinds of weekly training:
 *   running   — segments at prescribed paces (intervals or one steady run)
 *   endurance — a points game built from heart-rate raising exercises
 *   strength  — a points game built from the muscle catalogue
 *   warmup    — a points game built from dynamic stretches / pulse raisers
 *   cooldown  — a points game built from static stretches
 * The four game types share the same interval/points machinery — only the
 * catalogue they draw exercises from differs.
 */
export type TrainingType = 'running' | 'endurance' | 'strength' | 'warmup' | 'cooldown';

/** running is the only non-game (segment-based) type. */
export const AEROBIC_TYPES: TrainingType[] = ['running', 'endurance'];

/** Which catalogue a points game draws its exercises from. */
export type CatalogKind = 'strength' | 'endurance' | 'warmup' | 'cooldown';

/** What the trainer opens up for a points game (strength or endurance). */
export interface PointsGameConfig {
  /** Which catalogue the participant picks from. */
  catalog: CatalogKind;
  /** Interval structure, e.g. 40s work / 20s rest. */
  work_seconds: number;
  rest_seconds: number;
  /**
   * The muscle/heart-rate category assigned to each interval, in order — the
   * trainer picks what is worked each round, one entry per round. Only used
   * for the "open" catalogues (strength, endurance), where the participant
   * still picks their own exercise within the round's category. Empty for
   * warm-up/cool-down, which use `round_exercise_ids` instead.
   */
  round_categories: CategoryId[];
  /**
   * The exact exercise assigned to each round, in order — used only for
   * warm-up and cool-down, where there is no participant choice and no
   * level: the trainer picks the movement and the athlete just performs it.
   * Empty for strength/endurance, which use `round_categories` instead.
   */
  round_exercise_ids: string[];
  /** And only at these levels — each person picks what they can do safely. Unused when `round_exercise_ids` is set. */
  allowed_levels: StrengthLevel[];
}

/** One filled interval slot: the exercise the participant chose and its score. */
export interface StrengthLog {
  id: string;
  session_id: string;
  user_id: string;
  /** 0-based interval index within the workout. */
  round_index: number;
  exercise_id: string;
  level: StrengthLevel;
  unit: StrengthUnit;
  /** As entered: reps, seconds held, or metres crawled. */
  raw_value: number;
  /** Converted to scoring reps (5s = 1 rep, 2m = 1 rep). */
  reps: number;
  /** reps x level */
  points: number;
  created_at: string;
}

export interface StrengthEntryInput {
  session_id: string;
  user_id: string;
  round_index: number;
  exercise_id: string;
  raw_value: number;
}

export interface PointsSummary {
  user_id: string;
  points: number;
  reps: number;
  entries: number;
}

/** Resolved payload for one strength training's points screen. */
export interface StrengthSnapshot {
  session: TrainingSession;
  config: PointsGameConfig;
  /** The viewer's filled interval slots, ordered by round. */
  myLogs: StrengthLog[];
  myPoints: PointsSummary;
  leaderboard: Array<{ user: User; points: number; reps: number; entries: number }>;
  myGroup: GroupId | null;
}

/* -------------------------------------------------------------- running */

/**
 * The pace a segment is run at, prescribed qualitatively rather than as a
 * number — the trainer dictates effort, not a pace-per-km target.
 */
export type RunPaceCategory = 'walk' | 'talk' | 'borg' | 'sprint';

/**
 * One prescribed piece of a running training: N repeats of a distance at a
 * prescribed pace category, with recovery between them. A steady run is a
 * single segment with one repeat.
 */
export interface RunningSegment {
  id: string;
  label: string;
  /** Who runs this segment — 'all', or one group's alternative. */
  target_group: SessionTarget;
  repeats: number;
  distance_meters: number;
  /** The pace the trainer prescribes for this segment. */
  pace_category: RunPaceCategory;
  /** Jog/walk recovery between repeats, in seconds. */
  recovery_seconds: number;
}

export interface RunningConfig {
  /** `steady` is a single continuous run; `intervals` is a segment list. */
  mode: 'intervals' | 'steady';
  segments: RunningSegment[];
  // No group goal here on purpose: running is pure competition — points feed
  // the group's league-table total directly, with nothing to "unlock".
}

/** What the participant actually ran for one prescribed segment. */
export interface RunningLog {
  id: string;
  session_id: string;
  user_id: string;
  segment_id: string;
  segment_index: number;
  /** Repeats actually completed (may be fewer than prescribed). */
  repeats_done: number;
  /** repeats_done x segment distance. */
  total_distance_meters: number;
  /**
   * How long the completed distance actually took, in seconds. Pace
   * (seconds/km) is derived from this and the distance — whichever one the
   * athlete typed, the other is computed and only this canonical value is
   * stored.
   */
  actual_seconds: number;
  points: number;
  created_at: string;
}

export interface RunningEntryInput {
  session_id: string;
  user_id: string;
  segment_id: string;
  segment_index: number;
  repeats_done: number;
  actual_seconds: number;
}
