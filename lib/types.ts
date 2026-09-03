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
  /** כמ (operational-fitness) status — non-empty means an exemption applies (e.g. may skip exercises). */
  km_levels: number[];
  /** Drives the x1.5 points multiplier for women — see lib/points.ts / lib/running.ts. */
  gender: 'ז' | 'נ' | null;
  /** Manual points adjustment (e.g. a catch-up baseline) — added into standings/leaderboards on top of real logged points, never disguised as a training. */
  bonus_points: number;
}

/**
 * Anyone who trains as part of a group. Usually a regular participant, but a
 * trainer who has joined a group themselves is a Participant too — role
 * stays 'trainer' (that's still what grants admin access), team is what
 * makes them count toward that group's roster and standings.
 */
export interface Participant extends User {
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
  /** Shown as an "אופציונלי" badge to participants — independent of training_type. */
  is_optional: boolean;
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
  /** Null for a trainer's general post — not tied to any specific training. */
  session_id: string | null;
  user_id: string;
  /** Null for a text-only post — no photo or file attached. */
  image_url: string | null;
  caption: string | null;
  /** Free-form tags, typically the exercise the photo documents. */
  tags: string[];
  /** Set for a non-image file upload (PDF, doc, …); null for photos. */
  mime_type: string | null;
  /** Original filename, shown for non-image files. */
  file_name: string | null;
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
  /** Omit (or null) for a trainer's general post — only a trainer may do this. */
  session_id?: string | null;
  user_id: string;
  /** Data URL in mock mode; Supabase Storage public URL in production. Omit (or null) for a text-only post. */
  image_url?: string | null;
  caption?: string;
  tags?: string[];
  /** Set for a non-image file upload. */
  mime_type?: string | null;
  file_name?: string | null;
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
  is_optional?: boolean;
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
  /** The viewer's own self-logged runs and push-up sets, newest first. */
  quickLogs: QuickLog[];
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

/* --------------------------------------------------------- notifications */

/** The mailbox: created when someone @-mentions a person in a feed comment. */
export interface NotificationItem {
  id: string;
  actor: User;
  media_id: string;
  mediaCaption: string | null;
  commentBody: string | null;
  read: boolean;
  created_at: string; // ISO timestamp
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
 *
 * The planner's "ריצה (פשוטה)" and "שכיבות סמיכה" presets are just
 * pre-filled `running`/`strength` trainings (steady 1-segment run;
 * fixed-category "push" rounds) with `is_optional` set — not a separate
 * type, so they score through the exact same pipeline as everything else.
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
  /**
   * Work/rest seconds for each round, in order — every interval (including
   * warm-up and cool-down rounds) can have its own timing instead of one
   * time applying to the whole game.
   */
  round_work_seconds: number[];
  round_rest_seconds: number[];
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
  /**
   * Simplified mode: exactly 3 premade difficulty tiers (e.g. מתחילים /
   * בינוני / מתקדם). The participant picks one tier for the whole training,
   * still chooses their own exercise per round (within that tier's level and
   * the round's category), and the reps are premade — nothing to type, just
   * pick exercises and press done. When set, this takes over from
   * `allowed_levels` for level selection; `allowed_levels` is still kept in
   * sync (union of the tiers' levels) for anything reading it generically.
   */
  tiers?: DifficultyTier[];
}

/** One premade difficulty tier for the simplified strength/endurance flow. */
export interface DifficultyTier {
  /** e.g. "מתחילים", "בינוני", "מתקדם". */
  name: string;
  /** The single exercise level this tier plays at, in every round. */
  level: StrengthLevel;
  /** Premade rep target per round, in order — the participant never types a number. */
  round_reps: number[];
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
export type RunPaceCategory = 'walk' | 'talk' | 'borg' | 'sprint' | 'simple';

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
  /**
   * `steady` is a single continuous run; `intervals` is a segment list;
   * `simple` is the simplified flow — the trainer sets only a distance, the
   * participant enters how long it took them, done. `simple` still carries
   * one segment (pace_category fixed to the base weight) so it reuses the
   * exact same running_logs schema and scoring — nothing DB-side changes.
   */
  mode: 'intervals' | 'steady' | 'simple';
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

/* ----------------------------------------------------- quick self-logs */

/** The two activities a participant can log on their own, with no session behind them. */
export const QUICK_ACTIVITIES = ['running', 'pushups'] as const;
export type QuickActivity = (typeof QUICK_ACTIVITIES)[number];

/**
 * One self-logged activity: a run (distance only) or a set of push-ups (total
 * reps only). Unlimited entries per person; points land in the group standings
 * like any other points, scored at the base weight since the numbers are
 * self-reported — see the quick_logs migration for the exact formulas.
 */
export interface QuickLog {
  id: string;
  user_id: string;
  activity: QuickActivity;
  /** Set for a run, null for push-ups. */
  distance_meters: number | null;
  /** Set for push-ups, null for a run. */
  reps: number | null;
  points: number;
  created_at: string; // ISO timestamp
}

export interface QuickLogInput {
  user_id: string;
  activity: QuickActivity;
  /** Metres run, or total push-ups — whichever the activity calls for. */
  value: number;
}

/* -------------------------------------------------------------- templates */

/**
 * A reusable starting point for a new week — same shape the builder already
 * loads from a past session (see WeeklyTrainingBuilder's applySessionStructure),
 * just without a date/week/id tying it to one specific week.
 */
export interface SessionTemplate {
  id: string;
  training_type: TrainingType;
  title: string;
  /** One-line blurb shown in the template picker. */
  description: string;
  workout_instructions: string;
  points_game: PointsGameConfig | null;
  running: RunningConfig | null;
}
