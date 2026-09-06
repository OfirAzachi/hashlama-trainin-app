'use client';

import { useMutation } from '@tanstack/react-query';
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Minus,
  Plus,
  Send,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { startTransition, useMemo, useRef, useState } from 'react';

import { submitSessionLog, uploadSessionMedia } from '@/app/actions';
import { Badge, Card, CardHeader, DurationInput, GroupBadge } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { METRIC_UNITS, formatDate, formatDuration, parseDuration } from '@/lib/format';
import { fileToDataUrl } from '@/lib/image-resize';
import type {
  ExercisePrescription,
  LogEntryInput,
  MetricType,
  Participant,
  RPE,
  SessionLog,
  TrainingSession,
} from '@/lib/types';

interface ParticipantLoggerProps {
  participant: Participant;
  session: TrainingSession | null;
  /** Entries this participant already saved for this session. */
  existingLogs: SessionLog[];
}

interface DraftEntry {
  raw: string;
  touched: boolean;
}

const RPE_HINTS: Record<number, string> = {
  1: 'קל מאוד',
  3: 'קל',
  5: 'בינוני',
  7: 'קשה',
  9: 'קשה מאוד',
  10: 'מקסימלי',
};

function rpeTone(rpe: number): string {
  if (rpe <= 4) return '#22a06b';
  if (rpe <= 7) return '#c77b2b';
  return '#e5484d';
}

/** Converts the raw text of a field into the stored numeric value. */
function toMetricValue(raw: string, metric: MetricType): number | null {
  if (metric === 'time_seconds') return parseDuration(raw);
  const numeric = Number(raw.replace(',', '.'));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function placeholderFor(exercise: ExercisePrescription): string {
  if (exercise.target_value === null) return METRIC_UNITS[exercise.metric_type];
  switch (exercise.metric_type) {
    case 'time_seconds':
      return formatDuration(exercise.target_value);
    case 'distance_meters':
      return `${exercise.target_value}`;
    case 'weight_kg':
      return `${exercise.target_value}`;
    default:
      return `${exercise.target_value}`;
  }
}

/**
 * Mobile-first form for uploading results for one weekly training.
 * Inputs adapt to each exercise's metric type; a photo can be attached with a
 * live client-side preview before it is uploaded.
 */
export default function ParticipantLogger({
  participant,
  session,
  existingLogs,
}: ParticipantLoggerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const track = useMemo(
    () =>
      session?.tracks.find((candidate) => candidate.target_group === participant.team) ??
      session?.tracks.find((candidate) => candidate.target_group === 'all') ??
      null,
    [session, participant.team],
  );
  const exercises = track?.exercises ?? [];

  const [drafts, setDrafts] = useState<Record<string, DraftEntry>>({});
  const [rpe, setRpe] = useState<RPE>(7);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const [photo, setPhoto] = useState<{ dataUrl: string; name: string } | null>(null);
  const [caption, setCaption] = useState('');
  const [photoTag, setPhotoTag] = useState<string>('');
  const [photoSaved, setPhotoSaved] = useState(false);

  const alreadyLogged = new Set(existingLogs.map((log) => log.exercise_name));

  const setRaw = (exerciseId: string, raw: string) =>
    setDrafts((current) => ({ ...current, [exerciseId]: { raw, touched: true } }));

  const bump = (exercise: ExercisePrescription, step: number) => {
    const current = Number(drafts[exercise.id]?.raw ?? exercise.target_value ?? 0);
    const next = Math.max(0, (Number.isFinite(current) ? current : 0) + step);
    setRaw(exercise.id, String(next));
  };

  const logMutation = useMutation({
    mutationFn: async () => {
      const entries: LogEntryInput[] = [];
      for (const exercise of exercises) {
        const raw = drafts[exercise.id]?.raw?.trim();
        if (!raw) continue;
        const value = toMetricValue(raw, exercise.metric_type);
        if (value === null) {
          throw new Error(
            exercise.metric_type === 'time_seconds'
              ? `${exercise.name}: בפורמט דק:שנ (למשל 4:35).`
              : `${exercise.name}: הזינו מספר גדול מאפס.`,
          );
        }
        entries.push({
          session_id: session!.id,
          user_id: participant.id,
          exercise_name: exercise.name,
          metric_type: exercise.metric_type,
          metric_value: value,
          rpe,
          notes: notes.trim() || undefined,
        });
      }

      if (entries.length === 0) throw new Error('מלאו לפחות תרגיל אחד.');

      const result = await submitSessionLog(entries);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (created) => {
      setError(null);
      setSavedCount(created.length);
      setDrafts({});
      setNotes('');
      // A fresh startTransition here — react-query's onSuccess doesn't run
      // inside one, so router.refresh() would otherwise be treated as an
      // urgent update and trigger the route's full loading fallback.
      startTransition(() => router.refresh());
    },
    onError: (mutationError: Error) => {
      setSavedCount(0);
      setError(mutationError.message);
    },
  });

  const photoMutation = useMutation({
    mutationFn: async () => {
      if (!photo || !session) throw new Error('בחרו תמונה קודם.');
      const result = await uploadSessionMedia({
        session_id: session.id,
        user_id: participant.id,
        image_url: photo.dataUrl,
        caption: caption.trim() || undefined,
        tags: photoTag ? [photoTag] : [],
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      setPhoto(null);
      setCaption('');
      setPhotoTag('');
      setPhotoSaved(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      startTransition(() => router.refresh());
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('בחרו קובץ תמונה.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('התמונה צריכה להיות עד 5 מגה-בייט.');
      return;
    }
    fileToDataUrl(file).then((dataUrl) => {
      setPhotoSaved(false);
      setError(null);
      setPhoto({ dataUrl, name: file.name });
    });
  };

  if (!session || !track) {
    return (
      <Card className="card-pad">
        <p className="text-sm text-muted">
          עדיין לא נקבע אימון לקבוצה שלך. המאמן יפרסם את האימון הבא בקרוב.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------- session brief */}
      <Card>
        <CardHeader
          icon={<CalendarDays className="h-4 w-4" />}
          title={session.title}
          subtitle={`שבוע ${session.week_index} · ${formatDate(session.date)}`}
          action={<GroupBadge groupId={participant.team} short />}
        />
        <div className="card-pad space-y-3">
          <p className="text-sm leading-relaxed text-muted">{session.workout_instructions}</p>
          <div className="rounded-xl border border-line bg-elevated p-3">
            <p className="label">{track.label}</p>
            <ul className="mt-2 space-y-1.5">
              {track.exercises.map((exercise) => (
                <li key={exercise.id} className="text-sm">
                  <span className="font-medium text-ink">{exercise.name}</span>
                  <span className="text-muted"> — {exercise.prescription}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {/* -------------------------------------------------------- logger */}
      <Card as="section">
        <CardHeader
          title="רישום התוצאות שלך"
          subtitle="רשמו מה באמת ביצעתם. שדות ריקים פשוט מדולגים."
        />

        <form
          className="card-pad space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            logMutation.mutate();
          }}
        >
          {exercises.map((exercise) => {
            const draft = drafts[exercise.id]?.raw ?? '';
            const logged = alreadyLogged.has(exercise.name);

            return (
              <div key={exercise.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor={exercise.id} className="text-sm font-medium text-ink">
                    {exercise.name}
                  </label>
                  {logged ? (
                    <Badge tone="positive">
                      <CheckCircle2 aria-hidden className="h-3 w-3" /> נרשם
                    </Badge>
                  ) : (
                    <Badge tone="neutral">{METRIC_UNITS[exercise.metric_type]}</Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {exercise.metric_type === 'reps' || exercise.metric_type === 'weight_kg' ? (
                    <button
                      type="button"
                      aria-label={`הפחתה — ${exercise.name}`}
                      onClick={() => bump(exercise, exercise.metric_type === 'weight_kg' ? -2.5 : -1)}
                      className="btn-secondary h-11 w-11 shrink-0 p-0"
                    >
                      <Minus aria-hidden className="h-4 w-4" />
                    </button>
                  ) : null}

                  <div className="relative flex-1">
                    {exercise.metric_type === 'time_seconds' ? (
                      <DurationInput
                        id={exercise.id}
                        className="input h-11 pe-14 text-base tnum"
                        placeholder={placeholderFor(exercise)}
                        value={draft}
                        onValueChange={(value) => setRaw(exercise.id, value)}
                        aria-describedby={`${exercise.id}-hint`}
                      />
                    ) : (
                      <input
                        id={exercise.id}
                        className="input h-11 pe-14 text-base tnum"
                        inputMode="decimal"
                        placeholder={placeholderFor(exercise)}
                        value={draft}
                        onChange={(event) => setRaw(exercise.id, event.target.value)}
                        aria-describedby={`${exercise.id}-hint`}
                      />
                    )}
                    <span
                      id={`${exercise.id}-hint`}
                      className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted"
                    >
                      {METRIC_UNITS[exercise.metric_type]}
                    </span>
                  </div>

                  {exercise.metric_type === 'reps' || exercise.metric_type === 'weight_kg' ? (
                    <button
                      type="button"
                      aria-label={`הוספה — ${exercise.name}`}
                      onClick={() => bump(exercise, exercise.metric_type === 'weight_kg' ? 2.5 : 1)}
                      className="btn-secondary h-11 w-11 shrink-0 p-0"
                    >
                      <Plus aria-hidden className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <p className="text-xs text-muted">{exercise.prescription}</p>
              </div>
            );
          })}

          {/* ------------------------------------------------------- RPE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="rpe" className="text-sm font-medium text-ink">
                תחושת מאמץ (RPE)
              </label>
              <span className="flex items-center gap-2 text-sm font-semibold tnum" style={{ color: rpeTone(rpe) }}>
                {rpe}
                <span className="text-xs font-normal text-muted">
                  {RPE_HINTS[rpe] ?? (rpe <= 6 ? 'בינוני' : 'קשה')}
                </span>
              </span>
            </div>
            <input
              id="rpe"
              type="range"
              min={1}
              max={10}
              step={1}
              value={rpe}
              onChange={(event) => setRpe(Number(event.target.value) as RPE)}
              aria-valuetext={`${rpe} מתוך 10`}
            />
            <div className="flex justify-between text-[10px] text-muted tnum" aria-hidden>
              {Array.from({ length: 10 }, (_, index) => (
                <span key={index + 1}>{index + 1}</span>
              ))}
            </div>
          </div>

          {/* ----------------------------------------------------- notes */}
          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium text-ink">
              הערות <span className="font-normal text-muted">(אופציונלי)</span>
            </label>
            <textarea
              id="notes"
              rows={3}
              className="input resize-y"
              placeholder="איך זה הרגיש? כאבים, מזג אוויר או הערות על הקצב עבור המאמן."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400"
            >
              <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}

          {savedCount > 0 ? (
            <p
              role="status"
              className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400"
            >
              <CheckCircle2 aria-hidden className="h-4 w-4" />
              {savedCount === 1 ? 'נשמרה רשומה אחת.' : `נשמרו ${savedCount} רשומות.`}
            </p>
          ) : null}

          <button type="submit" className="btn-primary w-full" disabled={logMutation.isPending}>
            {logMutation.isPending ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <Send aria-hidden className="h-4 w-4" />
            )}
            {logMutation.isPending ? 'שומר…' : 'שמירת התוצאות'}
          </button>
        </form>
      </Card>

      {/* --------------------------------------------------- photo upload */}
      <Card as="section">
        <CardHeader
          icon={<Camera className="h-4 w-4" />}
          title="תמונה מהאימון"
          subtitle="צרפו תמונה מהאימון — היא תוצג למאמן ובפיד הקבוצתי."
        />

        <div className="card-pad space-y-3">
          <input
            ref={fileInputRef}
            id="photo"
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />

          {photo ? (
            <figure className="relative overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of an in-memory data URL */}
              <img src={photo.dataUrl} alt="תצוגה מקדימה של התמונה שנבחרה" className="h-56 w-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  setPhoto(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="absolute end-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                aria-label="הסרת התמונה שנבחרה"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
              <figcaption className="truncate bg-elevated px-3 py-2 text-xs text-muted">
                {photo.name}
              </figcaption>
            </figure>
          ) : (
            <label
              htmlFor="photo"
              className={cn(
                'flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl',
                'border-2 border-dashed border-line bg-elevated text-muted transition-colors hover:border-accent hover:text-ink',
              )}
            >
              <ImagePlus aria-hidden className="h-6 w-6" />
              <span className="text-sm font-medium">צילום או בחירת תמונה</span>
              <span className="text-xs">JPG או PNG, עד 5 מגה-בייט</span>
            </label>
          )}

          {photo ? (
            <>
              <div className="space-y-2">
                <label htmlFor="caption" className="text-sm font-medium text-ink">
                  כיתוב
                </label>
                <input
                  id="caption"
                  className="input"
                  placeholder="האינטרוול האחרון, הזמנים החזיקו עד הסוף."
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="tag" className="text-sm font-medium text-ink">
                  תיוג תרגיל
                </label>
                <select
                  id="tag"
                  className="input"
                  value={photoTag}
                  onChange={(event) => setPhotoTag(event.target.value)}
                >
                  <option value="">בלי תיוג</option>
                  {exercises.map((exercise) => (
                    <option key={exercise.id} value={exercise.name}>
                      {exercise.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => photoMutation.mutate()}
                disabled={photoMutation.isPending}
              >
                {photoMutation.isPending ? (
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera aria-hidden className="h-4 w-4" />
                )}
                {photoMutation.isPending ? 'מעלה…' : 'העלאת התמונה'}
              </button>
            </>
          ) : null}

          {photoSaved ? (
            <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
              התמונה נוספה לפיד האימון.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
