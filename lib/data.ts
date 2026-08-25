/**
 * Data access layer. Server components and server actions import from here and
 * never touch Supabase directly, so this file is the only seam between the UI
 * and persistence.
 */
import 'server-only';

import {
  buildCohortTotals,
  buildGroupAnalytics,
  buildParticipantSummaries,
  buildParticipantSummary,
} from './metrics';
import { targetsGroup } from './groups';
import { groupStandings, repsFromRaw, sessionLeaderboard, summarisePoints } from './points';
import { scoreSegment, segmentsForGroup } from './running';
import { findExercise, roundCount } from './catalog';
import { createClient } from './supabase/server';
import type { GroupStanding } from './points';
import type { HomeHighlights } from '@/components/GroupStandings';
import type {
  BenchmarkTest,
  CohortSnapshot,
  ExercisePrescription,
  GroupId,
  LogEntryInput,
  FeedPost,
  MediaComment,
  MediaUploadInput,
  Participant,
  ParticipantSnapshot,
  PointsGameConfig,
  RunningConfig,
  RunningSegment,
  SessionLog,
  SessionMedia,
  SessionPlanInput,
  SessionTarget,
  SessionTrack,
  NotificationItem,
  RunningEntryInput,
  RunningLog,
  StrengthEntryInput,
  StrengthLog,
  StrengthSnapshot,
  TrainingCard,
  TrainingSession,
  TrainingStatus,
  User,
} from './types';

/* -------------------------------------------------------------- mapping */
// Postgres row shapes already mirror these types field-for-field (the schema
// was designed against types.ts), so mapping is mostly reshaping joined rows
// into nested objects, not renaming fields.

function mapUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    team: row.team,
    unit: row.unit,
    avatar_url: row.avatar_url,
    joined_at: row.joined_at,
  };
}

function mapBenchmark(row: any): BenchmarkTest {
  return {
    id: row.id,
    user_id: row.user_id,
    test_type: row.test_type,
    run_3km_seconds: row.run_3km_seconds,
    max_pushups: row.max_pushups,
    recorded_date: row.recorded_date,
  };
}

/** Nested relations come back as an array or a single object depending on
 * the PostgREST cardinality inference — normalise to "first row or null". */
function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** DB stores "every team" as target_team = null; the app uses the 'all' sentinel. */
function targetFromDb(targetTeam: number | null): SessionTarget {
  return targetTeam === null ? 'all' : (targetTeam as SessionTarget);
}

function targetToDb(target: SessionTarget): number | null {
  return target === 'all' ? null : target;
}

function mapSession(row: any): TrainingSession {
  const tracks: SessionTrack[] = (row.session_tracks ?? []).map((track: any) => ({
    id: track.id,
    session_id: track.session_id,
    target_group: targetFromDb(track.target_team),
    label: track.label,
    exercises: [...(track.track_exercises ?? [])]
      .sort((a: any, b: any) => a.position - b.position)
      .map(
        (exercise: any): ExercisePrescription => ({
          id: exercise.id,
          name: exercise.name,
          metric_type: exercise.metric_type,
          prescription: exercise.prescription,
          target_value: exercise.target_value,
        }),
      ),
  }));

  const configRow = firstOf(row.strength_configs);
  const points_game: PointsGameConfig | null = configRow
    ? {
        catalog: configRow.catalog,
        round_work_seconds: configRow.round_work_seconds ?? [],
        round_rest_seconds: configRow.round_rest_seconds ?? [],
        round_categories: configRow.round_categories ?? [],
        round_exercise_ids: configRow.round_exercise_ids ?? [],
        allowed_levels: configRow.allowed_levels ?? [],
      }
    : null;

  const runningRow = firstOf(row.running_configs);
  const running: RunningConfig | null = runningRow
    ? {
        mode: runningRow.mode,
        segments: [...(row.running_segments ?? [])]
          .sort((a: any, b: any) => a.position - b.position)
          .map(
            (segment: any): RunningSegment => ({
              id: segment.id,
              label: segment.label,
              target_group: targetFromDb(segment.target_team),
              repeats: segment.repeats,
              distance_meters: segment.distance_meters,
              pace_category: segment.pace_category,
              recovery_seconds: segment.recovery_seconds,
            }),
          ),
      }
    : null;

  return {
    id: row.id,
    date: row.date,
    title: row.title,
    target_group: targetFromDb(row.target_team),
    workout_instructions: row.workout_instructions,
    week_index: row.week_index,
    training_type: row.training_type,
    points_game,
    running,
    tracks,
  };
}

// running_segments links to training_sessions directly (not to
// running_configs), so it's fetched as a sibling relation and stitched onto
// the running config in mapSession — there's no FK PostgREST can nest it
// under running_configs with.
const SESSION_SELECT = `
  *,
  session_tracks ( *, track_exercises ( * ) ),
  strength_configs ( * ),
  running_configs ( * ),
  running_segments ( * )
`;

function mapStrengthLog(row: any): StrengthLog {
  return {
    id: row.id,
    session_id: row.session_id,
    user_id: row.user_id,
    round_index: row.round_index,
    exercise_id: row.exercise_id,
    level: row.level,
    unit: row.unit,
    raw_value: Number(row.raw_value),
    reps: row.reps,
    points: row.points,
    created_at: row.created_at,
  };
}

function mapRunningLog(row: any): RunningLog {
  return {
    id: row.id,
    session_id: row.session_id,
    user_id: row.user_id,
    segment_id: row.segment_id,
    segment_index: row.segment_index,
    repeats_done: row.repeats_done,
    total_distance_meters: row.total_distance_meters,
    actual_seconds: Number(row.actual_seconds),
    points: row.points,
    created_at: row.created_at,
  };
}

/* --------------------------------------------------------------- reads */

export async function getUsers(): Promise<User[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('users').select('*').order('name');
  if (error) throw error;
  return data.map(mapUser);
}

/** Validates a set of ids against real cohort members, e.g. before notifying a @mention. */
export async function getUsersByIds(ids: string[]): Promise<User[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from('users').select('*').in('id', ids);
  if (error) throw error;
  return data.map(mapUser);
}

export async function getParticipants(group?: GroupId | 'all'): Promise<Participant[]> {
  const supabase = await createClient();
  let query = supabase.from('users').select('*').eq('role', 'participant');
  if (group && group !== 'all') query = query.eq('team', group);
  const { data, error } = await query.order('name');
  if (error) throw error;
  return data.map(mapUser) as Participant[];
}

export async function getParticipantById(userId: string): Promise<Participant | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .eq('role', 'participant')
    .maybeSingle();
  return data ? (mapUser(data) as Participant) : null;
}

export async function getSessions(): Promise<TrainingSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('training_sessions').select(SESSION_SELECT).order('date');
  if (error) throw error;
  return data.map(mapSession);
}

export async function getSessionsForGroup(group: GroupId): Promise<TrainingSession[]> {
  const sessions = await getSessions();
  return sessions.filter((session) => targetsGroup(session.target_group, group));
}

/** The session a participant should be logging right now: the most recent one. */
export async function getCurrentSession(group: GroupId): Promise<TrainingSession | null> {
  const sessions = await getSessionsForGroup(group);
  return sessions.length > 0 ? sessions[sessions.length - 1] : null;
}

export async function getBenchmarkTests(): Promise<BenchmarkTest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('benchmark_tests').select('*');
  if (error) throw error;
  return data.map(mapBenchmark);
}

export async function getLogs(filters?: {
  userId?: string;
  sessionId?: string;
  group?: GroupId | 'all';
  exercise?: string;
}): Promise<SessionLog[]> {
  const supabase = await createClient();
  let query = supabase.from('session_logs').select('*');
  if (filters?.userId) query = query.eq('user_id', filters.userId);
  if (filters?.sessionId) query = query.eq('session_id', filters.sessionId);
  if (filters?.exercise && filters.exercise !== 'all') query = query.eq('exercise_name', filters.exercise);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;

  const logs: SessionLog[] = data.map((row: any) => ({
    id: row.id,
    session_id: row.session_id,
    user_id: row.user_id,
    exercise_name: row.exercise_name,
    metric_type: row.metric_type,
    metric_value: Number(row.metric_value),
    rpe: row.rpe,
    notes: row.notes,
    created_at: row.created_at,
  }));

  if (filters?.group && filters.group !== 'all') {
    const participants = await getParticipants();
    const groupOf = new Map(participants.map((p) => [p.id, p.team]));
    return logs.filter((log) => groupOf.get(log.user_id) === filters.group);
  }
  return logs;
}

export async function getMedia(filters?: {
  userId?: string;
  sessionId?: string;
  group?: GroupId | 'all';
}): Promise<SessionMedia[]> {
  const supabase = await createClient();
  // Text-only posts (no photo or file) belong to the feed, not the photo/file
  // gallery, so they're excluded here at the source.
  let query = supabase.from('session_media').select('*').not('image_url', 'is', null);
  if (filters?.userId) query = query.eq('user_id', filters.userId);
  if (filters?.sessionId) query = query.eq('session_id', filters.sessionId);
  const { data, error } = await query.order('uploaded_at', { ascending: false });
  if (error) throw error;

  const media: SessionMedia[] = data.map((row: any) => ({
    id: row.id,
    session_id: row.session_id,
    user_id: row.user_id,
    image_url: row.image_url,
    caption: row.caption,
    tags: row.tags ?? [],
    mime_type: row.mime_type,
    file_name: row.file_name,
    uploaded_at: row.uploaded_at,
  }));

  if (filters?.group && filters.group !== 'all') {
    const participants = await getParticipants();
    const groupOf = new Map(participants.map((p) => [p.id, p.team]));
    return media.filter((item) => groupOf.get(item.user_id) === filters.group);
  }
  return media;
}

/* -------------------------------------------------------- aggregates */

/** Everything the trainer dashboard needs, resolved in one pass. */
export async function getCohortSnapshot(): Promise<CohortSnapshot> {
  const [participants, sessions, logs, strengthLogs, runningLogs, media, benchmarkTests] =
    await Promise.all([
      getParticipants(),
      getSessions(),
      getLogs(),
      getStrengthLogs(),
      getRunningLogs(),
      getMedia(),
      getBenchmarkTests(),
    ]);

  const summaries = buildParticipantSummaries(participants, benchmarkTests, sessions, logs, [
    ...strengthLogs,
    ...runningLogs,
  ]);

  return {
    participants,
    sessions,
    logs,
    strengthLogs,
    runningLogs,
    media,
    summaries,
    groups: buildGroupAnalytics(summaries),
    totals: buildCohortTotals(summaries, logs.length, media.length),
  };
}

/** Everything one participant's dashboard and logger need. */
export async function getParticipantSnapshot(userId: string): Promise<ParticipantSnapshot | null> {
  const participant = await getParticipantById(userId);
  if (!participant) return null;

  const [sessions, logs, media, benchmarkTests, allLogsForSummary, strengthLogs, runningLogs] =
    await Promise.all([
      getSessionsForGroup(participant.team),
      getLogs({ userId }),
      getMedia({ userId }),
      getBenchmarkTests(),
      getLogs(),
      getStrengthLogs(),
      getRunningLogs(),
    ]);

  return {
    participant,
    sessions,
    currentSession: sessions.length > 0 ? sessions[sessions.length - 1] : null,
    logs,
    media,
    trainings: await getTrainingCards(userId),
    summary: buildParticipantSummary(participant, benchmarkTests, sessions, allLogsForSummary, [
      ...strengthLogs,
      ...runningLogs,
    ]),
  };
}

/* ------------------------------------------------------------ writes */

export async function insertLogs(entries: LogEntryInput[]): Promise<SessionLog[]> {
  const supabase = await createClient();
  const payload = entries.map((entry) => ({
    session_id: entry.session_id,
    user_id: entry.user_id,
    exercise_name: entry.exercise_name,
    metric_type: entry.metric_type,
    metric_value: entry.metric_value,
    rpe: entry.rpe,
    notes: entry.notes?.trim() ? entry.notes.trim() : null,
  }));
  const { data, error } = await supabase.from('session_logs').insert(payload).select();
  if (error) throw error;
  return data.map((row: any) => ({
    id: row.id,
    session_id: row.session_id,
    user_id: row.user_id,
    exercise_name: row.exercise_name,
    metric_type: row.metric_type,
    metric_value: Number(row.metric_value),
    rpe: row.rpe,
    notes: row.notes,
    created_at: row.created_at,
  }));
}

export async function insertMedia(input: MediaUploadInput): Promise<SessionMedia> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('session_media')
    .insert({
      session_id: input.session_id ?? null,
      user_id: input.user_id,
      image_url: input.image_url ?? null,
      caption: input.caption?.trim() ? input.caption.trim() : null,
      tags: input.tags ?? [],
      mime_type: input.mime_type ?? null,
      file_name: input.file_name ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    session_id: data.session_id,
    user_id: data.user_id,
    image_url: data.image_url,
    caption: data.caption,
    tags: data.tags ?? [],
    mime_type: data.mime_type,
    file_name: data.file_name,
    uploaded_at: data.uploaded_at,
  };
}

/** Owner and session, to check permission and invariants before an edit or delete. */
export async function getMediaOwner(
  mediaId: string,
): Promise<{ user_id: string; session_id: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('session_media')
    .select('user_id, session_id')
    .eq('id', mediaId)
    .maybeSingle();
  return data ?? null;
}

export async function updateMediaCaption(mediaId: string, caption: string | null): Promise<SessionMedia> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('session_media')
    .update({ caption })
    .eq('id', mediaId)
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    session_id: data.session_id,
    user_id: data.user_id,
    image_url: data.image_url,
    caption: data.caption,
    tags: data.tags ?? [],
    mime_type: data.mime_type,
    file_name: data.file_name,
    uploaded_at: data.uploaded_at,
  };
}

export async function deleteMedia(mediaId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('session_media').delete().eq('id', mediaId);
  if (error) throw error;
}

export async function insertSession(input: SessionPlanInput): Promise<TrainingSession> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data: sessionRow, error: sessionError } = await supabase
    .from('training_sessions')
    .insert({
      date: input.date,
      title: input.title,
      target_team: null,
      workout_instructions: input.workout_instructions,
      week_index: input.week_index,
      training_type: input.training_type,
      created_by: authUser?.id ?? null,
    })
    .select()
    .single();
  if (sessionError) throw sessionError;
  const sessionId = sessionRow.id as string;

  if (input.points_game) {
    const { error } = await supabase.from('strength_configs').insert({
      session_id: sessionId,
      catalog: input.points_game.catalog,
      round_work_seconds: input.points_game.round_work_seconds,
      round_rest_seconds: input.points_game.round_rest_seconds,
      round_categories: input.points_game.round_categories,
      round_exercise_ids: input.points_game.round_exercise_ids,
      allowed_levels: input.points_game.allowed_levels,
    });
    if (error) throw error;
  }

  if (input.running) {
    const { error: configError } = await supabase.from('running_configs').insert({
      session_id: sessionId,
      mode: input.running.mode,
    });
    if (configError) throw configError;

    if (input.running.segments.length > 0) {
      const { error: segmentsError } = await supabase.from('running_segments').insert(
        input.running.segments.map((segment, index) => ({
          session_id: sessionId,
          label: segment.label,
          target_team: targetToDb(segment.target_group),
          position: index,
          repeats: segment.repeats,
          distance_meters: segment.distance_meters,
          pace_category: segment.pace_category,
          recovery_seconds: segment.recovery_seconds,
        })),
      );
      if (segmentsError) throw segmentsError;
    }
  }

  const tracks = input.tracks.filter((track) => track.exercises.length > 0);
  for (const track of tracks) {
    const { data: trackRow, error: trackError } = await supabase
      .from('session_tracks')
      .insert({ session_id: sessionId, target_team: targetToDb(track.target_group), label: track.label })
      .select()
      .single();
    if (trackError) throw trackError;

    const exercises = track.exercises.filter((exercise) => exercise.name.trim().length > 0);
    if (exercises.length > 0) {
      const { error: exercisesError } = await supabase.from('track_exercises').insert(
        exercises.map((exercise, index) => ({
          track_id: trackRow.id,
          name: exercise.name,
          metric_type: exercise.metric_type,
          prescription: exercise.prescription,
          target_value: exercise.target_value,
          position: index,
        })),
      );
      if (exercisesError) throw exercisesError;
    }
  }

  const created = await getSessions();
  const match = created.find((session) => session.id === sessionId);
  if (!match) throw new Error('Session was created but could not be re-fetched.');
  return match;
}

/** Whether anyone has logged anything against this session — editing is only safe before that. */
export async function sessionHasLogs(sessionId: string): Promise<boolean> {
  const supabase = await createClient();
  const [session, strength, running] = await Promise.all([
    supabase.from('session_logs').select('id', { count: 'exact', head: true }).eq('session_id', sessionId),
    supabase.from('strength_logs').select('id', { count: 'exact', head: true }).eq('session_id', sessionId),
    supabase.from('running_logs').select('id', { count: 'exact', head: true }).eq('session_id', sessionId),
  ]);
  return (session.count ?? 0) + (strength.count ?? 0) + (running.count ?? 0) > 0;
}

/**
 * Replaces a session's structure in place — only ever called once the
 * caller has confirmed nobody has logged against it yet, so clearing the
 * old segments/rounds/tracks and reinserting is safe.
 */
export async function updateSession(sessionId: string, input: SessionPlanInput): Promise<TrainingSession> {
  const supabase = await createClient();

  const { error: sessionError } = await supabase
    .from('training_sessions')
    .update({
      date: input.date,
      title: input.title,
      workout_instructions: input.workout_instructions,
      week_index: input.week_index,
      training_type: input.training_type,
    })
    .eq('id', sessionId);
  if (sessionError) throw sessionError;

  await supabase.from('strength_configs').delete().eq('session_id', sessionId);
  await supabase.from('running_segments').delete().eq('session_id', sessionId);
  await supabase.from('running_configs').delete().eq('session_id', sessionId);
  const { data: oldTracks } = await supabase.from('session_tracks').select('id').eq('session_id', sessionId);
  if (oldTracks && oldTracks.length > 0) {
    await supabase
      .from('track_exercises')
      .delete()
      .in(
        'track_id',
        oldTracks.map((track) => track.id),
      );
    await supabase.from('session_tracks').delete().eq('session_id', sessionId);
  }

  if (input.points_game) {
    const { error } = await supabase.from('strength_configs').insert({
      session_id: sessionId,
      catalog: input.points_game.catalog,
      round_work_seconds: input.points_game.round_work_seconds,
      round_rest_seconds: input.points_game.round_rest_seconds,
      round_categories: input.points_game.round_categories,
      round_exercise_ids: input.points_game.round_exercise_ids,
      allowed_levels: input.points_game.allowed_levels,
    });
    if (error) throw error;
  }

  if (input.running) {
    const { error: configError } = await supabase
      .from('running_configs')
      .insert({ session_id: sessionId, mode: input.running.mode });
    if (configError) throw configError;

    if (input.running.segments.length > 0) {
      const { error: segmentsError } = await supabase.from('running_segments').insert(
        input.running.segments.map((segment, index) => ({
          session_id: sessionId,
          label: segment.label,
          target_team: targetToDb(segment.target_group),
          position: index,
          repeats: segment.repeats,
          distance_meters: segment.distance_meters,
          pace_category: segment.pace_category,
          recovery_seconds: segment.recovery_seconds,
        })),
      );
      if (segmentsError) throw segmentsError;
    }
  }

  const tracks = input.tracks.filter((track) => track.exercises.length > 0);
  for (const track of tracks) {
    const { data: trackRow, error: trackError } = await supabase
      .from('session_tracks')
      .insert({ session_id: sessionId, target_team: targetToDb(track.target_group), label: track.label })
      .select()
      .single();
    if (trackError) throw trackError;

    const exercises = track.exercises.filter((exercise) => exercise.name.trim().length > 0);
    if (exercises.length > 0) {
      const { error: exercisesError } = await supabase.from('track_exercises').insert(
        exercises.map((exercise, index) => ({
          track_id: trackRow.id,
          name: exercise.name,
          metric_type: exercise.metric_type,
          prescription: exercise.prescription,
          target_value: exercise.target_value,
          position: index,
        })),
      );
      if (exercisesError) throw exercisesError;
    }
  }

  const updated = await getSessions();
  const match = updated.find((session) => session.id === sessionId);
  if (!match) throw new Error('Session was updated but could not be re-fetched.');
  return match;
}

/* --------------------------------------------------------- social feed */

/** Feed posts newest-first, resolved with author, likes and comments. */
export async function getFeed(viewerId: string, filters?: { group?: GroupId | 'all' }): Promise<FeedPost[]> {
  const supabase = await createClient();
  const [{ data: mediaRows, error: mediaError }, users, sessions, { data: likeRows }, { data: commentRows }] =
    await Promise.all([
      supabase.from('session_media').select('*').order('uploaded_at', { ascending: false }),
      getUsers(),
      getSessions(),
      supabase.from('media_likes').select('*'),
      supabase.from('media_comments').select('*').order('created_at'),
    ]);
  if (mediaError) throw mediaError;

  const userById = new Map(users.map((user) => [user.id, user]));
  const sessionById = new Map(sessions.map((session) => [session.id, session]));

  return (mediaRows ?? [])
    .filter((item: any) => {
      if (!filters?.group || filters.group === 'all') return true;
      return userById.get(item.user_id)?.team === filters.group;
    })
    .map((item: any) => {
      const media: SessionMedia = {
        id: item.id,
        session_id: item.session_id,
        user_id: item.user_id,
        image_url: item.image_url,
        caption: item.caption,
        tags: item.tags ?? [],
        mime_type: item.mime_type,
        file_name: item.file_name,
        uploaded_at: item.uploaded_at,
      };
      const likes = (likeRows ?? []).filter((like: any) => like.media_id === item.id);
      const comments = (commentRows ?? [])
        .filter((comment: any) => comment.media_id === item.id)
        .map((comment: any) => ({
          comment: {
            id: comment.id,
            media_id: comment.media_id,
            user_id: comment.user_id,
            body: comment.body,
            created_at: comment.created_at,
          } as MediaComment,
          author: userById.get(comment.user_id)!,
        }))
        .filter((entry: any) => Boolean(entry.author));

      return {
        media,
        author: userById.get(item.user_id)!,
        session: sessionById.get(item.session_id) ?? null,
        likes: likes.length,
        likedByMe: likes.some((like: any) => like.user_id === viewerId),
        comments,
      };
    })
    .filter((post: any) => Boolean(post.author));
}

/** Adds or removes the viewer's like. Returns the new state for that post. */
export async function toggleLike(
  mediaId: string,
  userId: string,
): Promise<{ likes: number; likedByMe: boolean }> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('media_likes')
    .select('*')
    .eq('media_id', mediaId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase.from('media_likes').delete().eq('media_id', mediaId).eq('user_id', userId);
  } else {
    await supabase.from('media_likes').insert({ media_id: mediaId, user_id: userId });
  }

  const { count } = await supabase
    .from('media_likes')
    .select('*', { count: 'exact', head: true })
    .eq('media_id', mediaId);

  return { likes: count ?? 0, likedByMe: !existing };
}

export async function insertComment(
  mediaId: string,
  userId: string,
  body: string,
): Promise<MediaComment> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('media_comments')
    .insert({ media_id: mediaId, user_id: userId, body })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    media_id: data.media_id,
    user_id: data.user_id,
    body: data.body,
    created_at: data.created_at,
  };
}

/* ----------------------------------------------------- mailbox / mentions */

/** Notification rows for @mentions found in a just-posted comment. */
export async function insertMentionNotifications(
  actorId: string,
  mediaId: string,
  commentId: string,
  recipientIds: string[],
): Promise<void> {
  const uniqueRecipients = [...new Set(recipientIds)].filter((id) => id !== actorId);
  if (uniqueRecipients.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from('notifications').insert(
    uniqueRecipients.map((recipientId) => ({
      recipient_id: recipientId,
      actor_id: actorId,
      media_id: mediaId,
      comment_id: commentId,
    })),
  );
  if (error) throw error;
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

/** The viewer's mailbox, newest first, with the mentioning user and the post's context resolved. */
export async function getNotifications(userId: string): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const actorIds = [...new Set(rows.map((row) => row.actor_id))];
  const mediaIds = [...new Set(rows.map((row) => row.media_id))];
  const commentIds = [...new Set(rows.map((row) => row.comment_id).filter((id): id is string => Boolean(id)))];

  const [actors, { data: mediaRows }, { data: commentRows }] = await Promise.all([
    getUsersByIds(actorIds),
    supabase.from('session_media').select('id, caption').in('id', mediaIds),
    commentIds.length > 0
      ? supabase.from('media_comments').select('id, body').in('id', commentIds)
      : Promise.resolve({ data: [] as { id: string; body: string }[] }),
  ]);

  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  const captionByMediaId = new Map((mediaRows ?? []).map((row: any) => [row.id, row.caption as string | null]));
  const bodyByCommentId = new Map((commentRows ?? []).map((row: any) => [row.id, row.body as string]));

  return rows
    .map((row) => ({
      id: row.id,
      actor: actorById.get(row.actor_id),
      media_id: row.media_id,
      mediaCaption: captionByMediaId.get(row.media_id) ?? null,
      commentBody: row.comment_id ? (bodyByCommentId.get(row.comment_id) ?? null) : null,
      read: Boolean(row.read_at),
      created_at: row.created_at,
    }))
    .filter((item): item is NotificationItem => Boolean(item.actor));
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

/* ---------------------------------------------------- training status */

/**
 * The weekly trainings for one participant, each tagged completed / missed /
 * due. A training only counts as completed once results have been uploaded:
 * no logs means not completed, which is exactly how attendance is scored.
 */
export async function getTrainingCards(userId: string): Promise<TrainingCard[]> {
  const participant = await getParticipantById(userId);
  if (!participant) return [];

  const [sessions, logs, strengthLogsAll, runningLogsAll, media] = await Promise.all([
    getSessionsForGroup(participant.team),
    getLogs({ userId }),
    getStrengthLogs({ userId }),
    getRunningLogs({ userId }),
    getMedia({ userId }),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return [...sessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((session) => {
      const track =
        session.tracks.find((candidate) => candidate.target_group === participant.team) ??
        session.tracks.find((candidate) => candidate.target_group === 'all') ??
        null;
      const sessionLogs = logs.filter((log) => log.session_id === session.id);
      const strengthLogs = strengthLogsAll.filter((log) => log.session_id === session.id);
      const runningLogs = runningLogsAll.filter((log) => log.session_id === session.id);
      const isRunning = session.training_type === 'running';
      const strength = !isRunning; // every non-running type is a points game
      const uploaded = isRunning
        ? runningLogs.length + sessionLogs.length
        : strength
          ? strengthLogs.length
          : sessionLogs.length;
      const mySegments = isRunning ? segmentsForGroup(session.running, participant.team) : [];
      const loggedExercises = isRunning
        ? runningLogs.length
        : strength
          ? strengthLogs.length
          : new Set(sessionLogs.map((log) => log.exercise_name)).size;
      const totalExercises = isRunning
        ? mySegments.length
        : strength
          ? (session.points_game ? roundCount(session.points_game) : 0)
          : track?.exercises.length ?? 0;
      const withinWeek = daysBetween(session.date, today) < 7;
      const status: TrainingStatus = uploaded > 0 ? 'completed' : withinWeek ? 'due' : 'missed';

      return {
        session,
        track,
        status,
        logs: sessionLogs,
        strengthLogs,
        runningLogs,
        points:
          strengthLogs.reduce((sum, log) => sum + log.points, 0) +
          runningLogs.reduce((sum, log) => sum + log.points, 0),
        loggedExercises,
        totalExercises,
        photos: media.filter((item) => item.session_id === session.id).length,
      };
    });
}

function daysBetween(from: string, to: string): number {
  return Math.floor(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

/* ------------------------------------------------- strength / points */

export async function getStrengthLogs(filters?: {
  userId?: string;
  sessionId?: string;
}): Promise<StrengthLog[]> {
  const supabase = await createClient();
  let query = supabase.from('strength_logs').select('*');
  if (filters?.userId) query = query.eq('user_id', filters.userId);
  if (filters?.sessionId) query = query.eq('session_id', filters.sessionId);
  const { data, error } = await query.order('round_index');
  if (error) throw error;
  return data.map(mapStrengthLog);
}

/**
 * Saves the filled interval slots of a points workout. Reps and points are
 * computed here from the catalogue for the snapshot columns, then Postgres
 * recomputes them as generated columns — the client's arithmetic is never
 * trusted either way.
 */
export async function insertStrengthEntries(entries: StrengthEntryInput[]): Promise<StrengthLog[]> {
  const supabase = await createClient();

  const payload = entries.flatMap((entry) => {
    const exercise = findExercise(entry.exercise_id);
    if (!exercise) return [];
    return [
      {
        session_id: entry.session_id,
        user_id: entry.user_id,
        round_index: entry.round_index,
        exercise_id: exercise.id,
        level: exercise.level,
        unit: exercise.unit,
        units_per_rep: exercise.unitsPerRep,
        raw_value: entry.raw_value,
      },
    ];
  });
  if (payload.length === 0) return [];

  const { data, error } = await supabase
    .from('strength_logs')
    .upsert(payload, { onConflict: 'session_id,user_id,round_index' })
    .select();
  if (error) throw error;
  return data.map(mapStrengthLog);
}

/** Everything the points screen of one strength training needs. */
export async function getStrengthSnapshot(
  sessionId: string,
  userId: string,
): Promise<StrengthSnapshot | null> {
  const sessions = await getSessions();
  const session = sessions.find((candidate) => candidate.id === sessionId);
  if (!session || !session.points_game) return null;

  const [participant, sessionLogs, users] = await Promise.all([
    getParticipantById(userId),
    getStrengthLogs({ sessionId }),
    getUsers(),
  ]);

  return {
    session,
    config: session.points_game,
    myLogs: sessionLogs
      .filter((log) => log.user_id === userId)
      .sort((a, b) => a.round_index - b.round_index),
    myPoints: summarisePoints(userId, sessionLogs),
    leaderboard: sessionLeaderboard(sessionLogs, users).slice(0, 10),
    myGroup: participant?.team ?? null,
  };
}

/* ---------------------------------------------------------- running */

export async function getRunningLogs(filters?: {
  userId?: string;
  sessionId?: string;
}): Promise<RunningLog[]> {
  const supabase = await createClient();
  let query = supabase.from('running_logs').select('*');
  if (filters?.userId) query = query.eq('user_id', filters.userId);
  if (filters?.sessionId) query = query.eq('session_id', filters.sessionId);
  const { data, error } = await query.order('segment_index');
  if (error) throw error;
  return data.map(mapRunningLog);
}

/**
 * Saves what the athlete actually ran. Distance and pace category are
 * snapshotted from the prescribed segment (never taken from the client);
 * total distance and points are Postgres generated columns.
 */
export async function insertRunningEntries(entries: RunningEntryInput[]): Promise<RunningLog[]> {
  const supabase = await createClient();
  const sessions = await getSessions();

  const payload = entries.flatMap((entry) => {
    const session = sessions.find((candidate) => candidate.id === entry.session_id);
    const segment = session?.running?.segments.find((item) => item.id === entry.segment_id);
    if (!segment) return [];

    const score = scoreSegment(segment, entry.repeats_done);
    if (score.points === 0 && score.total_distance_meters === 0) return [];

    return [
      {
        session_id: entry.session_id,
        user_id: entry.user_id,
        segment_id: segment.id,
        segment_index: entry.segment_index,
        distance_meters: segment.distance_meters,
        pace_category: segment.pace_category,
        repeats_done: Math.min(segment.repeats, Math.floor(entry.repeats_done)),
        actual_seconds: entry.actual_seconds,
      },
    ];
  });
  if (payload.length === 0) return [];

  const { data, error } = await supabase
    .from('running_logs')
    .upsert(payload, { onConflict: 'session_id,user_id,segment_id' })
    .select();
  if (error) throw error;
  return data.map(mapRunningLog);
}

/* ------------------------------------------------- cohort standings */

/** The league table for the home page: points, completion and improvement. */
export async function getGroupStandings(): Promise<GroupStanding[]> {
  const [participants, sessions, logs, strengthLogs, runningLogs, benchmarkTests] = await Promise.all([
    getParticipants(),
    getSessions(),
    getLogs(),
    getStrengthLogs(),
    getRunningLogs(),
    getBenchmarkTests(),
  ]);

  const summaries = buildParticipantSummaries(participants, benchmarkTests, sessions, logs, [
    ...strengthLogs,
    ...runningLogs,
  ]);
  const analytics = buildGroupAnalytics(summaries);

  const completionByGroup = {} as Record<GroupId, number>;
  const improvementByGroup = {} as Record<GroupId, { run: number; pushups: number }>;
  analytics.forEach((entry) => {
    completionByGroup[entry.group.id] = entry.attendance_rate;
    improvementByGroup[entry.group.id] = {
      run: entry.avg_run_improvement_pct,
      pushups: entry.avg_pushup_gain,
    };
  });

  return groupStandings({
    participants,
    strengthLogs,
    runningPoints: runningLogs.map((log) => ({
      session_id: log.session_id,
      user_id: log.user_id,
      points: log.points,
    })),
    completionByGroup,
    improvementByGroup,
  });
}

/** Everything the home page shows: standings plus the human highlights. */
export async function getHomeHighlights(): Promise<HomeHighlights> {
  const [participants, sessions, standings, logs, strengthLogs, runningLogs, benchmarkTests, media] =
    await Promise.all([
      getParticipants(),
      getSessions(),
      getGroupStandings(),
      getLogs(),
      getStrengthLogs(),
      getRunningLogs(),
      getBenchmarkTests(),
      getMedia(),
    ]);

  const summaries = buildParticipantSummaries(participants, benchmarkTests, sessions, logs, [
    ...strengthLogs,
    ...runningLogs,
  ]);

  const pointsByUser = new Map<string, number>();
  [...strengthLogs, ...runningLogs].forEach((log) => {
    pointsByUser.set(log.user_id, (pointsByUser.get(log.user_id) ?? 0) + log.points);
  });

  const topScorers = participants
    .map((participant) => ({ participant, points: pointsByUser.get(participant.id) ?? 0 }))
    .filter((entry) => entry.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  // "Biggest improvement" is always shown as a percentage, never as a raw
  // time or rep count — that is what makes a 3km runner and a push-up
  // grinder comparable on the same leaderboard.
  const tested = summaries.filter((summary) => summary.delta.initial && summary.delta.final);

  const runImprovers = tested
    .map((summary) => ({
      participant: summary.participant,
      improvementPct: summary.delta.run_improvement_pct ?? 0,
    }))
    .sort((a, b) => b.improvementPct - a.improvementPct)
    .slice(0, 5);

  const pushupImprovers = tested
    .map((summary) => ({
      participant: summary.participant,
      improvementPct: summary.delta.pushup_improvement_pct ?? 0,
    }))
    .sort((a, b) => b.improvementPct - a.improvementPct)
    .slice(0, 5);

  // The overall/general improvement blends both benchmarks — the same
  // composite score already used to rank "top improvers" elsewhere.
  const overallImprovers = tested
    .map((summary) => ({
      participant: summary.participant,
      improvementPct: summary.delta.composite_score ?? 0,
    }))
    .sort((a, b) => b.improvementPct - a.improvementPct)
    .slice(0, 5);

  const streaks = summaries
    .map((summary) => ({ participant: summary.participant, streak: summary.streak }))
    .filter((entry) => entry.streak > 0)
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 5);

  const kilometres = runningLogs.reduce((sum, log) => sum + log.total_distance_meters, 0) / 1000;

  return {
    standings,
    topScorers,
    runImprovers,
    pushupImprovers,
    overallImprovers,
    streaks,
    totals: {
      participants: participants.length,
      trainings: sessions.length,
      points:
        strengthLogs.reduce((sum, log) => sum + log.points, 0) +
        runningLogs.reduce((sum, log) => sum + log.points, 0),
      kilometres,
      photos: media.length,
    },
  };
}
