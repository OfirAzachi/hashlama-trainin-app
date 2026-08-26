'use server';

import { revalidatePath } from 'next/cache';

import {
  clearExerciseGifOverride,
  deleteMedia,
  deleteSession,
  getExerciseGifOverrides,
  getMediaOwner,
  getUsers,
  getUsersByIds,
  insertComment,
  insertLogs,
  insertMedia,
  insertMentionNotifications,
  insertSession,
  insertRunningEntries,
  insertStrengthEntries,
  sessionHasLogs,
  setExerciseGifOverride,
  toggleLike,
  updateMediaCaption,
  updateSession,
  updateUserTeam,
} from '@/lib/data';
import { findExercise, hasFixedExercises } from '@/lib/catalog';
import { supabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import { METRIC_TYPES } from '@/lib/types';
import type {
  ActionResult,
  GroupId,
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

const MAX_MEDIA_BYTES = 10 * 1024 * 1024; // 10 MB, matches the Storage bucket policy
const MEDIA_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET || 'session-media';
const ALLOWED_MEDIA_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

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

// A mention the client inserted from the @-autocomplete: @[Display Name](user-uuid),
// or the reserved id "all" for a tag-everyone mention. Parsed back out here
// to resolve who gets notified — never trusted at face value, real-user ids
// are re-validated against actual cohort members before use.
const MENTION_PATTERN = /@\[[^\]]+\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|all)\)/gi;

/** Notifies every validly-@mentioned user found in `text` — a post caption or a comment. */
async function notifyMentions(actorId: string, mediaId: string, commentId: string | null, text: string) {
  const mentionedIds = [...text.matchAll(MENTION_PATTERN)].map((match) => match[1]);
  if (mentionedIds.length === 0) return;

  const validUsers = mentionedIds.includes('all')
    ? await getUsers()
    : await getUsersByIds([...new Set(mentionedIds)]);
  if (validUsers.length === 0) return;
  await insertMentionNotifications(
    actorId,
    mediaId,
    commentId,
    validUsers.map((user) => user.id),
  );
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
};

/**
 * Stores a feed post — a workout photo tied to a session, a (trainer only)
 * general post with no session and possibly a non-image file, or plain text
 * with no attachment at all. The client always sends a data URL (or, once
 * already stored, an https URL on re-save); when Supabase is configured this
 * uploads the decoded bytes to the `session-media` bucket and swaps in the
 * public URL before the row is written. Falls back to storing the data URL
 * directly in mock mode (no Supabase configured).
 */
export async function uploadSessionMedia(
  input: MediaUploadInput,
): Promise<ActionResult<SessionMedia>> {
  const rawUrl = input.image_url?.trim() || null;
  const hasCaption = Boolean(input.caption?.trim());
  if (!rawUrl && !hasCaption) return { ok: false, error: 'כתבו טקסט או צרפו קובץ.' };

  const dataUrlMatch = rawUrl ? /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(rawUrl) : null;
  const isHttpUrl = rawUrl ? /^https?:\/\//.test(rawUrl) : false;
  if (rawUrl && !dataUrlMatch && !isHttpUrl) {
    return { ok: false, error: 'סוג הקובץ לא נתמך.' };
  }
  if (dataUrlMatch && !ALLOWED_MEDIA_MIME_TYPES.has(dataUrlMatch[1])) {
    return { ok: false, error: 'סוג הקובץ לא נתמך.' };
  }

  let imageUrl = rawUrl;
  let mimeType: string | null = null;
  let bytes: Buffer | null = null;

  if (dataUrlMatch) {
    const [, matchedMimeType, base64] = dataUrlMatch;
    mimeType = matchedMimeType;
    bytes = Buffer.from(base64, 'base64');
    if (bytes.byteLength > MAX_MEDIA_BYTES) {
      return { ok: false, error: 'הקובץ גדול מ-10 מגה-בייט.' };
    }
  }

  if (supabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser || authUser.id !== input.user_id) {
      return { ok: false, error: 'אין הרשאה לפרסם בשם משתמש אחר.' };
    }

    if (!input.session_id) {
      const { data: profile } = await supabase.from('users').select('role').eq('id', authUser.id).maybeSingle();
      if (profile?.role !== 'trainer') {
        return { ok: false, error: 'רק מאמן/ת יכולים לפרסם ללא אימון משויך.' };
      }
    }

    if (dataUrlMatch && bytes) {
      const extension = MIME_EXTENSIONS[mimeType!] ?? 'bin';
      const path = `${input.user_id}/${input.session_id ?? 'general'}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, bytes, { contentType: mimeType!, upsert: false });
      if (uploadError) return { ok: false, error: 'העלאת הקובץ נכשלה, נסו שוב.' };

      imageUrl = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
    }
  }

  // Only non-image uploads carry a mime_type — that's what the feed uses to
  // tell a photo (renders inline) from a file (renders as a download card).
  const isImage = mimeType?.startsWith('image/') ?? true;
  const created = await insertMedia({
    ...input,
    image_url: imageUrl,
    mime_type: imageUrl && !isImage ? mimeType : null,
  });
  if (input.caption) await notifyMentions(input.user_id, created.id, null, input.caption);
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

/**
 * Deletes a published training outright — same safety rule as editing:
 * refused once anyone has logged results against it, so a trainer can't
 * accidentally erase real data. RLS restricts this to trainers already.
 */
export async function deleteTrainingSession(sessionId: string): Promise<ActionResult<null>> {
  if (!sessionId) return { ok: false, error: 'חסר מזהה אימון.' };

  if (await sessionHasLogs(sessionId)) {
    return { ok: false, error: 'לא ניתן למחוק אימון שכבר יש לו תוצאות רשומות ממתאמנים.' };
  }

  await deleteSession(sessionId);
  revalidatePath('/trainer');
  revalidatePath('/participant');
  return { ok: true, data: null };
}

/**
 * Lets a trainer join a group as a participant of their own — they keep
 * their trainer role (and admin access) but now also show up in that
 * group's roster and standings, and can log trainings like anyone else.
 * Pass `team: null` to leave the group again.
 */
export async function joinGroupAsTrainer(userId: string, team: GroupId | null): Promise<ActionResult<null>> {
  if (!userId) return { ok: false, error: 'חסר מזהה משתמש.' };

  if (supabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser || authUser.id !== userId) {
      return { ok: false, error: 'אין הרשאה לשנות שיוך קבוצה עבור משתמש אחר.' };
    }
    const { data: profile } = await supabase.from('users').select('role').eq('id', authUser.id).maybeSingle();
    if (profile?.role !== 'trainer') {
      return { ok: false, error: 'רק מאמן/ת יכולים להצטרף לקבוצה בדרך הזו.' };
    }
  }

  await updateUserTeam(userId, team);
  revalidatePath('/trainer');
  revalidatePath('/participant');
  revalidatePath('/feed');
  return { ok: true, data: null };
}

/** Returns an error string if `userId` isn't authenticated as themselves and a trainer, else null. */
async function requireTrainerAuth(userId: string): Promise<string | null> {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser || authUser.id !== userId) return 'אין הרשאה לבצע פעולה זו.';
  const { data: profile } = await supabase.from('users').select('role').eq('id', authUser.id).maybeSingle();
  if (profile?.role !== 'trainer') return 'הפעולה מוגבלת למאמן/ת.';
  return null;
}

/**
 * Lets a trainer point an exercise at a real GIF they found and pasted in —
 * always wins over the ExerciseDB auto-match, which only ever covers
 * exercises that happen to exist there under a recognisable name.
 */
export async function updateExerciseGif(
  userId: string,
  exerciseId: string,
  gifUrl: string,
): Promise<ActionResult<null>> {
  if (!exerciseId) return { ok: false, error: 'חסר מזהה תרגיל.' };
  const authError = await requireTrainerAuth(userId);
  if (authError) return { ok: false, error: authError };

  const trimmed = gifUrl.trim();
  if (!/^https:\/\/\S+$/.test(trimmed)) {
    return { ok: false, error: 'הכניסו קישור תקין שמתחיל ב-https://' };
  }

  await setExerciseGifOverride(exerciseId, trimmed);
  // No revalidatePath here: the animation is driven live by
  // ExerciseGifOverridesProvider's own refresh() (see ExerciseDemo.tsx's
  // GifLinkEditor), not by server-rendered page props. Revalidating the
  // whole page on every save just causes a visible full-page reload for
  // no benefit.
  return { ok: true, data: null };
}

export async function removeExerciseGif(userId: string, exerciseId: string): Promise<ActionResult<null>> {
  if (!exerciseId) return { ok: false, error: 'חסר מזהה תרגיל.' };
  const authError = await requireTrainerAuth(userId);
  if (authError) return { ok: false, error: authError };

  await clearExerciseGifOverride(exerciseId);
  return { ok: true, data: null };
}

export async function fetchExerciseGifOverrides(): Promise<ActionResult<Record<string, string>>> {
  const overrides = await getExerciseGifOverrides();
  return { ok: true, data: overrides };
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
  await notifyMentions(userId, mediaId, comment.id, text);

  revalidatePath('/feed');
  return { ok: true, data: comment };
}

const MAX_CAPTION_LENGTH = 500;

/** Only the post's own author may edit its caption. */
export async function updateMediaPost(
  mediaId: string,
  userId: string,
  caption: string,
): Promise<ActionResult<SessionMedia>> {
  if (!mediaId || !userId) return { ok: false, error: 'חסר פוסט או משתמש.' };
  const trimmed = caption.trim();
  if (trimmed.length > MAX_CAPTION_LENGTH) {
    return { ok: false, error: `הכיתוב מוגבל ל-${MAX_CAPTION_LENGTH} תווים.` };
  }

  const owner = await getMediaOwner(mediaId);
  if (!owner) return { ok: false, error: 'הפוסט לא נמצא.' };
  if (owner.user_id !== userId) return { ok: false, error: 'ניתן לערוך רק פוסטים שפרסמתם.' };
  if (!owner.session_id && !trimmed) {
    return { ok: false, error: 'הודעה כללית חייבת לכלול טקסט.' };
  }

  if (supabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser || authUser.id !== userId) {
      return { ok: false, error: 'אין הרשאה לערוך פוסט זה.' };
    }
  }

  const updated = await updateMediaCaption(mediaId, trimmed || null);
  if (trimmed) await notifyMentions(userId, mediaId, null, trimmed);
  revalidatePath('/feed');
  revalidatePath('/participant');
  revalidatePath('/trainer');
  return { ok: true, data: updated };
}

/** Only the post's own author may delete it. */
export async function deleteMediaPost(mediaId: string, userId: string): Promise<ActionResult<null>> {
  if (!mediaId || !userId) return { ok: false, error: 'חסר פוסט או משתמש.' };

  const owner = await getMediaOwner(mediaId);
  if (!owner) return { ok: false, error: 'הפוסט לא נמצא.' };
  if (owner.user_id !== userId) return { ok: false, error: 'ניתן למחוק רק פוסטים שפרסמתם.' };

  if (supabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser || authUser.id !== userId) {
      return { ok: false, error: 'אין הרשאה למחוק פוסט זה.' };
    }
  }

  await deleteMedia(mediaId);
  revalidatePath('/feed');
  revalidatePath('/participant');
  revalidatePath('/trainer');
  return { ok: true, data: null };
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
