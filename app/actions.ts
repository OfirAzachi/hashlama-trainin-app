'use server';

import { revalidatePath } from 'next/cache';

import {
  insertComment,
  insertLogs,
  insertMedia,
  insertSession,
  insertRunningEntries,
  insertStrengthEntries,
  sessionHasLogs,
  toggleLike,
  updateSession,
} from '@/lib/data';
import { findExercise, hasFixedExercises } from '@/lib/catalog';
import { supabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import { METRIC_TYPES } from '@/lib/types';
import type {
  ActionResult,
  LogEntryInput,
  MediaComment,
  MediaUploadInput,
  SessionLog,
  SessionMedia,
  RunningEntryInput,
  RunningLog,
  SessionPlanInput,
  StrengthEntryInput,
  StrengthLog,
  TrainingSession,
} from '@/lib/types';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB, matches the Storage bucket policy
const MEDIA_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET || 'session-media';

function validateEntry(entry: LogEntryInput, index: number): string | null {
  const where = `Entry ${index + 1}`;
  if (!entry.session_id) return `${where}: missing session.`;
  if (!entry.user_id) return `${where}: missing participant.`;
  if (!entry.exercise_name?.trim()) return `${where}: exercise name is required.`;
  if (!METRIC_TYPES.includes(entry.metric_type)) return `${where}: unknown metric type.`;
  if (!Number.isFinite(entry.metric_value) || entry.metric_value <= 0) {
    return `${where}: enter a value greater than zero.`;
  }
  if (entry.rpe < 1 || entry.rpe > 10) return `${where}: RPE must be between 1 and 10.`;
  return null;
}

/** Persists one or more exercise results for a session. */
export async function submitSessionLog(
  entries: LogEntryInput[],
): Promise<ActionResult<SessionLog[]>> {
  if (entries.length === 0) {
    return { ok: false, error: 'רשמו לפחות תרגיל אחד לפני השליחה.' };
  }

  for (let index = 0; index < entries.length; index += 1) {
    const problem = validateEntry(entries[index], index);
    if (problem) return { ok: false, error: problem };
  }

  const created = await insertLogs(entries);
  revalidatePath('/participant');
  revalidatePath('/trainer');
  return { ok: true, data: created };
}

/**
 * Stores a workout photo. The client always sends a data URL (or, once
 * already stored, an https URL on re-save); when Supabase is configured this
 * uploads the decoded bytes to the `session-media` bucket and swaps in the
 * public URL before the row is written. Falls back to storing the data URL
 * directly in mock mode (no Supabase configured).
 */
export async function uploadSessionMedia(
  input: MediaUploadInput,
): Promise<ActionResult<SessionMedia>> {
  if (!input.image_url) return { ok: false, error: 'לא נבחרה תמונה.' };

  const dataUrlMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(input.image_url);
  const isHttpUrl = /^https?:\/\//.test(input.image_url);
  if (!dataUrlMatch && !isHttpUrl) {
    return { ok: false, error: 'סוג התמונה לא נתמך.' };
  }

  let imageUrl = input.image_url;

  if (dataUrlMatch) {
    const [, mimeType, base64] = dataUrlMatch;
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return { ok: false, error: 'התמונה גדולה מ-5 מגה-בייט.' };
    }

    if (supabaseConfigured) {
      const supabase = await createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser || authUser.id !== input.user_id) {
        return { ok: false, error: 'אין הרשאה להעלות תמונה בשם משתמש אחר.' };
      }

      const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
      const path = `${input.user_id}/${input.session_id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, bytes, { contentType: mimeType, upsert: false });
      if (uploadError) return { ok: false, error: 'העלאת התמונה נכשלה, נסו שוב.' };

      imageUrl = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
    }
  }

  const created = await insertMedia({ ...input, image_url: imageUrl });
  revalidatePath('/participant');
  revalidatePath('/trainer');
  revalidatePath('/feed');
  return { ok: true, data: created };
}

/**
 * Field-level validation shared by create and update: running needs a
 * segment plan, the two points games need an interval setup, and neither
 * requires per-group exercise tracks.
 */
function validateSessionPlan(input: SessionPlanInput): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (!input.title?.trim()) fieldErrors.title = 'תנו שם לאימון.';
  if (!input.date) fieldErrors.date = 'בחרו תאריך.';
  if (input.training_type === 'running') {
    const running = input.running;
    if (!running || running.segments.length === 0) {
      fieldErrors.running = 'הוסיפו לפחות מקטע ריצה אחד.';
    } else {
      running.segments.forEach((segment, index) => {
        if (segment.distance_meters <= 0) fieldErrors[`segment_${index}`] = 'מרחק חייב להיות גדול מאפס.';
        if (segment.repeats < 1) fieldErrors[`segment_${index}_repeats`] = 'לפחות חזרה אחת.';
        if (!segment.pace_category) fieldErrors[`segment_${index}_pace`] = 'בחרו קצב לביצוע המקטע.';
      });
    }
  }

  if (input.training_type !== 'running') {
    // A points game has no per-group tracks: everyone works through the same
    // interval structure, so what matters is that the game itself is set up.
    const config = input.points_game;
    if (!config) {
      fieldErrors.points_game = 'צריך להגדיר את המשחק לפני הפרסום.';
    } else if (hasFixedExercises(config.catalog)) {
      // Warm-up / cool-down: no levels, no participant choice — the trainer
      // picks the exact exercise for every round.
      if (config.round_exercise_ids.length < 1) fieldErrors.rounds = 'צריך לפחות סבב אחד.';
      if (config.round_work_seconds.some((seconds) => seconds < 1)) {
        fieldErrors.work_seconds = 'הגדירו את זמן העבודה לכל סבב.';
      }
      if (config.round_rest_seconds.some((seconds) => seconds < 0)) {
        fieldErrors.rest_seconds = 'הגדירו את זמן המנוחה לכל סבב.';
      }
      if (config.round_exercise_ids.some((id) => !id || !findExercise(id))) {
        fieldErrors.exercises = 'בחרו תרגיל תקין לכל סבב.';
      }
    } else {
      if (config.round_categories.length < 1) fieldErrors.rounds = 'צריך לפחות סבב אחד.';
      if (config.round_work_seconds.some((seconds) => seconds < 1)) {
        fieldErrors.work_seconds = 'הגדירו את זמן העבודה לכל סבב.';
      }
      if (config.round_rest_seconds.some((seconds) => seconds < 0)) {
        fieldErrors.rest_seconds = 'הגדירו את זמן המנוחה לכל סבב.';
      }
      if (config.round_categories.some((category) => !category)) {
        fieldErrors.categories = 'בחרו קבוצת שריר לכל סבב.';
      }
      if (config.allowed_levels.length === 0) fieldErrors.levels = 'פתחו לפחות רמה אחת.';
    }
  }

  return fieldErrors;
}

/** Creates a weekly training. */
export async function createTrainingSession(
  input: SessionPlanInput,
): Promise<ActionResult<TrainingSession>> {
  const fieldErrors = validateSessionPlan(input);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: 'צריך לתקן את השדות המסומנים.', fieldErrors };
  }

  const created = await insertSession({
    ...input,
    title: input.title.trim(),
    tracks: input.tracks.map((track) => ({
      ...track,
      exercises: track.exercises.filter((exercise) => exercise.name.trim().length > 0),
    })),
  });

  revalidatePath('/trainer');
  revalidatePath('/participant');
  return { ok: true, data: created };
}

/**
 * Updates an already-published training in place — only allowed while
 * nobody has logged anything against it yet, so a change never silently
 * disagrees with results someone already recorded.
 */
export async function updateTrainingSession(
  sessionId: string,
  input: SessionPlanInput,
): Promise<ActionResult<TrainingSession>> {
  const fieldErrors = validateSessionPlan(input);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: 'צריך לתקן את השדות המסומנים.', fieldErrors };
  }

  if (await sessionHasLogs(sessionId)) {
    return { ok: false, error: 'לא ניתן לערוך אימון שכבר יש לו תוצאות רשומות ממתאמנים.' };
  }

  const updated = await updateSession(sessionId, {
    ...input,
    title: input.title.trim(),
    tracks: input.tracks.map((track) => ({
      ...track,
      exercises: track.exercises.filter((exercise) => exercise.name.trim().length > 0),
    })),
  });

  revalidatePath('/trainer');
  revalidatePath('/participant');
  return { ok: true, data: updated };
}

/* --------------------------------------------------------- social feed */

/** Likes or un-likes a photo for the current viewer. */
export async function toggleMediaLike(
  mediaId: string,
  userId: string,
): Promise<ActionResult<{ likes: number; likedByMe: boolean }>> {
  if (!mediaId || !userId) return { ok: false, error: 'חסר פוסט או משתמש.' };

  const state = await toggleLike(mediaId, userId);
  revalidatePath('/feed');
  return { ok: true, data: state };
}

const MAX_COMMENT_LENGTH = 500;

export async function addMediaComment(
  mediaId: string,
  userId: string,
  body: string,
): Promise<ActionResult<MediaComment>> {
  const text = body.trim();
  if (!text) return { ok: false, error: 'כתבו משהו לפני הפרסום.' };
  if (text.length > MAX_COMMENT_LENGTH) {
    return { ok: false, error: `Comments are limited to ${MAX_COMMENT_LENGTH} characters.` };
  }

  const comment = await insertComment(mediaId, userId, text);
  revalidatePath('/feed');
  return { ok: true, data: comment };
}

/* ------------------------------------------------- strength / points */

/**
 * Saves the interval slots of a points workout. The client sends what was
 * chosen and how much was done; reps and points are recalculated server-side
 * from the catalogue so the score cannot be spoofed.
 */
export async function submitStrengthWorkout(
  entries: StrengthEntryInput[],
): Promise<ActionResult<StrengthLog[]>> {
  if (entries.length === 0) {
    return { ok: false, error: 'מלאו לפחות סבב אחד לפני השמירה.' };
  }

  for (const entry of entries) {
    if (!entry.session_id || !entry.user_id) {
      return { ok: false, error: 'חסרים פרטי אימון או מתאמן.' };
    }
    if (!findExercise(entry.exercise_id)) {
      return { ok: false, error: 'נבחר תרגיל שלא קיים בקטלוג.' };
    }
    if (!Number.isFinite(entry.raw_value) || entry.raw_value <= 0) {
      return { ok: false, error: 'בכל סבב שמילאתם צריך מספר גדול מאפס.' };
    }
  }

  const created = await insertStrengthEntries(entries);
  revalidatePath('/participant');
  revalidatePath('/trainer');
  return { ok: true, data: created };
}

/* --------------------------------------------------------- running */

/**
 * Saves what the athlete ran, segment by segment. Pace, distance and points
 * are recomputed from the prescribed segment on the server.
 */
export async function submitRunningWorkout(
  entries: RunningEntryInput[],
): Promise<ActionResult<RunningLog[]>> {
  if (entries.length === 0) {
    return { ok: false, error: 'מלאו לפחות מקטע אחד לפני השמירה.' };
  }

  for (const entry of entries) {
    if (!entry.session_id || !entry.user_id || !entry.segment_id) {
      return { ok: false, error: 'חסרים פרטי אימון או מקטע.' };
    }
    if (!Number.isFinite(entry.repeats_done) || entry.repeats_done < 1) {
      return { ok: false, error: 'רשמו לפחות חזרה אחת בכל מקטע שמילאתם.' };
    }
    if (!Number.isFinite(entry.actual_seconds) || entry.actual_seconds <= 0) {
      return { ok: false, error: 'רשמו זמן או קצב בכל מקטע שמילאתם.' };
    }
  }

  const created = await insertRunningEntries(entries);
  if (created.length === 0) {
    return { ok: false, error: 'לא נמצאו מקטעים תואמים לאימון הזה.' };
  }

  revalidatePath('/participant');
  revalidatePath('/trainer');
  revalidatePath('/');
  return { ok: true, data: created };
}
