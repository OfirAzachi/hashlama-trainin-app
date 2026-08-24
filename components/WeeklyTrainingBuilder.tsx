'use client';

import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Flame,
  Loader2,
  Minus,
  Plus,
  Search,
  Send,
  Sparkles,
  Split,
  Footprints,
  HeartPulse,
  Timer,
  Trash2,
  TriangleAlert,
  Users,
  Wind,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { createTrainingSession, updateTrainingSession } from '@/app/actions';
import { Badge, Card } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { ExerciseDemoButton, LevelBadge } from '@/components/ExerciseDemo';
import { formatDate } from '@/lib/format';
import { PACE_CATEGORIES, PACE_LABELS, PACE_MULTIPLIER, plannedDistance, plannedPoints } from '@/lib/running';
import {
  availableExercises as availableCatalogExercises,
  catalogCategories,
  catalogExercises,
  cycleExercises,
  defaultCategories,
  describeRoundTiming,
  findExercise,
  hasFixedExercises,
} from '@/lib/catalog';
import type { StrengthLevel } from '@/lib/strength-catalog';
import { GROUP_LIST } from '@/lib/groups';
import type {
  CatalogKind,
  CategoryId,
  GroupId,
  MetricType,
  RunningSegment,
  RunPaceCategory,
  SessionPlanInput,
  SessionTarget,
  TrainingSession,
  TrainingType,
} from '@/lib/types';

interface SegmentDraft {
  uid: string;
  label: string;
  target_group: SessionTarget;
  repeats: string;
  meters: string;
  /** The pace dictated qualitatively, not as a pace-per-km number. */
  pace_category: RunPaceCategory;
  recovery: string;
}

const STEPS: Record<TrainingType, Array<{ number: 1 | 2 | 3; title: string; hint: string }>> = {
  running: [
    { number: 1, title: 'פרטי האימון', hint: 'סוג, שם, תאריך והערה' },
    { number: 2, title: 'מקטעי הריצה ופרסום', hint: 'אינטרוולים או ריצה אחידה, עם קצב לכל מקטע' },
  ],
  endurance: [
    { number: 1, title: 'פרטי האימון', hint: 'סוג, שם, תאריך והערה' },
    { number: 2, title: 'הגדרת המשחק', hint: 'אינטרוולים, קטגוריות ורמות' },
    { number: 3, title: 'סקירה ופרסום', hint: 'בודקים מה נפתח ואז שולחים' },
  ],
  strength: [
    { number: 1, title: 'פרטי האימון', hint: 'סוג, שם, תאריך והערה' },
    { number: 2, title: 'הגדרת המשחק', hint: 'אינטרוולים, קטגוריות ורמות' },
    { number: 3, title: 'סקירה ופרסום', hint: 'בודקים מה נפתח ואז שולחים' },
  ],
  warmup: [
    { number: 1, title: 'פרטי האימון', hint: 'סוג, שם, תאריך והערה' },
    { number: 2, title: 'הגדרת החימום', hint: 'אינטרוולים, קטגוריות ורמות' },
    { number: 3, title: 'סקירה ופרסום', hint: 'בודקים מה נפתח ואז שולחים' },
  ],
  cooldown: [
    { number: 1, title: 'פרטי האימון', hint: 'סוג, שם, תאריך והערה' },
    { number: 2, title: 'הגדרת השחרור', hint: 'אינטרוולים, קטגוריות ורמות' },
    { number: 3, title: 'סקירה ופרסום', hint: 'בודקים מה נפתח ואז שולחים' },
  ],
};

const TYPE_CARDS: Array<{
  value: TrainingType;
  title: string;
  blurb: string;
  icon: typeof Timer;
}> = [
  {
    value: 'running',
    title: 'ריצה',
    blurb: 'מקטעי ריצה עם קצב יעד — אינטרוולים או ריצה אחידה. כל מקטע מזכה בנקודות.',
    icon: Footprints,
  },
  {
    value: 'endurance',
    title: 'סיבולת אירובית',
    blurb: 'משחק נקודות מתרגילים שמעלים דופק — קפיצות, מכשירים, גוף מלא וזריזות.',
    icon: HeartPulse,
  },
  {
    value: 'strength',
    title: 'שרירים',
    blurb: 'משחק נקודות מתרגילי כוח משקל גוף. בכל סבב המתאמן בוחר תרגיל בעצמו.',
    icon: Zap,
  },
  {
    value: 'warmup',
    title: 'חימום',
    blurb: 'מתיחות בתנועה והעלאת דופק הדרגתית — לפני האימון העיקרי.',
    icon: Flame,
  },
  {
    value: 'cooldown',
    title: 'שחרור',
    blurb: 'מתיחות סטטיות לפי אזור בגוף — אחרי האימון העיקרי.',
    icon: Wind,
  },
];

/** Both points games share one screen; only the catalogue changes. */
const isGameType = (type: TrainingType) => type !== 'running';

let uidCounter = 0;
const nextUid = () => `dx-${(uidCounter += 1)}`;

function blankSegment(label = 'מקטע ריצה'): SegmentDraft {
  return {
    uid: `sg-${(uidCounter += 1)}`,
    label,
    target_group: 'all',
    repeats: '5',
    meters: '800',
    pace_category: 'borg',
    recovery: '90',
  };
}

/** The draft turned into the real segment shape, or null when incomplete. */
function toSegment(draft: SegmentDraft, index: number): Omit<RunningSegment, 'id'> | null {
  const meters = Number(draft.meters);
  const repeats = Number(draft.repeats);
  if (!(meters > 0) || !(repeats > 0)) return null;
  return {
    label: draft.label.trim() || `מקטע ${index + 1}`,
    target_group: draft.target_group,
    repeats: Math.round(repeats),
    distance_meters: Math.round(meters),
    pace_category: draft.pace_category,
    recovery_seconds: Math.max(0, Math.round(Number(draft.recovery) || 0)),
  };
}

/** Fills N rounds by cycling through a catalogue's categories in order. */
function cycleCategories(kind: CatalogKind, count: number): CategoryId[] {
  const categories = catalogCategories(kind).map((entry) => entry.id);
  return Array.from({ length: count }, (_, index) => categories[index % categories.length]);
}

/** Per-round work/rest inputs — every interval gets its own timing. */
function RoundTimingFields({
  work,
  rest,
  onWorkChange,
  onRestChange,
  index,
}: {
  work: number;
  rest: number;
  onWorkChange: (value: number) => void;
  onRestChange: (value: number) => void;
  index: number;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <label className="flex items-center gap-1 text-[11px] text-muted">
        <input
          type="number"
          min={1}
          className="input h-9 w-14 py-1 text-center tnum"
          aria-label={`עבודה בסבב ${index + 1} (שניות)`}
          value={work}
          onChange={(event) => onWorkChange(Math.max(1, Number(event.target.value)))}
        />
        עב׳
      </label>
      <label className="flex items-center gap-1 text-[11px] text-muted">
        <input
          type="number"
          min={0}
          className="input h-9 w-14 py-1 text-center tnum"
          aria-label={`מנוחה בסבב ${index + 1} (שניות)`}
          value={rest}
          onChange={(event) => onRestChange(Math.max(0, Number(event.target.value)))}
        />
        מנ׳
      </label>
    </div>
  );
}

/** Inline round editor for a warm-up/cool-down attached to another training. */
function AttachedGameRounds({
  kind,
  exerciseIds,
  workSeconds,
  restSeconds,
  onUpdateExercise,
  onUpdateWork,
  onUpdateRest,
  onAdd,
  onRemove,
}: {
  kind: 'warmup' | 'cooldown';
  exerciseIds: string[];
  workSeconds: number[];
  restSeconds: number[];
  onUpdateExercise: (index: number, exerciseId: string) => void;
  onUpdateWork: (index: number, seconds: number) => void;
  onUpdateRest: (index: number, seconds: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const exercises = catalogExercises(kind);
  return (
    <div className="w-full space-y-2 rounded-xl border border-line bg-surface p-3">
      <ol className="space-y-2">
        {exerciseIds.map((exerciseId, index) => (
          <li key={index} className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-semibold text-muted tnum">
              {index + 1}
            </span>
            <select
              className="input flex-1 py-1.5"
              aria-label={`תרגיל ${kind === 'warmup' ? 'חימום' : 'שחרור'} לסבב ${index + 1}`}
              value={exerciseId}
              onChange={(event) => onUpdateExercise(index, event.target.value)}
            >
              {exercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </select>
            <RoundTimingFields
              index={index}
              work={workSeconds[index] ?? 40}
              rest={restSeconds[index] ?? 20}
              onWorkChange={(value) => onUpdateWork(index, value)}
              onRestChange={(value) => onUpdateRest(index, value)}
            />
            <button
              type="button"
              className="btn-ghost h-8 w-8 shrink-0 p-0 text-rose-500"
              aria-label={`הסרת סבב ${index + 1}`}
              disabled={exerciseIds.length === 1}
              onClick={() => onRemove(index)}
            >
              <Trash2 aria-hidden className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="btn-secondary w-full py-1.5 text-sm" onClick={onAdd}>
        <Plus aria-hidden className="h-4 w-4" />
        הוספת סבב
      </button>
    </div>
  );
}

/** Next Monday, so a weekly training lands on the start of a week. */
function nextMonday(): string {
  const date = new Date();
  const daysUntilMonday = (8 - date.getDay()) % 7 || 7;
  date.setDate(date.getDate() + daysUntilMonday);
  return date.toISOString().slice(0, 10);
}

/**
 * Guided three-step builder for a weekly training.
 * The trainer names the week, taps exercises out of a library, and only then
 * decides whether any group needs a different version — so the common case
 * (everyone does the same) takes two taps and no typing.
 */
export default function WeeklyTrainingBuilder({
  nextWeekIndex,
  participantCount,
  pastSessions = [],
}: {
  nextWeekIndex: number;
  participantCount: number;
  /** Published sessions to optionally load as a starting point for a new one. */
  pastSessions?: TrainingSession[];
}) {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState(`שבוע ${nextWeekIndex} — `);
  const [date, setDate] = useState(nextMonday);
  const [weekIndex, setWeekIndex] = useState(nextWeekIndex);
  const [instructions, setInstructions] = useState('');
  const [loadedFromSessionId, setLoadedFromSessionId] = useState('');
  /** Set while editing an already-published session in place, instead of creating a new one. */
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState('');
  const [attachWarmup, setAttachWarmup] = useState(false);
  const [attachCooldown, setAttachCooldown] = useState(false);
  const [warmupExerciseIds, setWarmupExerciseIds] = useState<string[]>(() => cycleExercises('warmup', 4));
  const [warmupWorkSeconds, setWarmupWorkSeconds] = useState<number[]>(() => Array(4).fill(40));
  const [warmupRestSeconds, setWarmupRestSeconds] = useState<number[]>(() => Array(4).fill(20));
  const [cooldownExerciseIds, setCooldownExerciseIds] = useState<string[]>(() => cycleExercises('cooldown', 4));
  const [cooldownWorkSeconds, setCooldownWorkSeconds] = useState<number[]>(() => Array(4).fill(40));
  const [cooldownRestSeconds, setCooldownRestSeconds] = useState<number[]>(() => Array(4).fill(20));

  const [trainingType, setTrainingType] = useState<TrainingType>('running');
  const [runMode, setRunMode] = useState<'intervals' | 'steady'>('intervals');
  const [segments, setSegments] = useState<SegmentDraft[]>([blankSegment()]);
  const [defaultWork, setDefaultWork] = useState(40);
  const [defaultRest, setDefaultRest] = useState(20);
  const [roundCategories, setRoundCategories] = useState<CategoryId[]>(() =>
    cycleCategories('strength', 6),
  );
  const [roundWorkSeconds, setRoundWorkSeconds] = useState<number[]>(() => Array(6).fill(40));
  const [roundRestSeconds, setRoundRestSeconds] = useState<number[]>(() => Array(6).fill(20));
  const [roundExerciseIds, setRoundExerciseIds] = useState<string[]>([]);
  const [openLevels, setOpenLevels] = useState<StrengthLevel[]>([1, 2, 3, 4]);
  const [previewCategory, setPreviewCategory] = useState<CategoryId>('lower');

  const [published, setPublished] = useState<string | null>(null);
  const [publishedWasEdit, setPublishedWasEdit] = useState(false);

  const canContinueFromStep1 = title.trim().length > 0 && date.length > 0;
  const catalogKind: CatalogKind = isGameType(trainingType) ? (trainingType as CatalogKind) : 'strength';
  const fixedExercises = hasFixedExercises(catalogKind);
  const gameCategories = catalogCategories(catalogKind);
  const gameExercises = catalogExercises(catalogKind);
  const uniqueRoundCategories = [...new Set(roundCategories)];
  const availableExercises = availableCatalogExercises(catalogKind, uniqueRoundCategories, openLevels);
  const validSegments = segments.filter(
    (segment) => Number(segment.meters) > 0 && Number(segment.repeats) > 0,
  );
  const canContinueFromStep2 = isGameType(trainingType)
    ? fixedExercises
      ? roundExerciseIds.length > 0
      : roundCategories.length > 0 && openLevels.length > 0
    : validSegments.length > 0;
  const roundsTotal = fixedExercises ? roundExerciseIds.length : roundCategories.length;

  const updateSegment = (uid: string, patch: Partial<SegmentDraft>) =>
    setSegments((current) =>
      current.map((segment) => (segment.uid === uid ? { ...segment, ...patch } : segment)),
    );

  const removeSegment = (uid: string) =>
    setSegments((current) => current.filter((segment) => segment.uid !== uid));

  /**
   * Turns "5×800m" into five separate, independently-editable rows — for
   * when not every rep of an interval should share the same pace/recovery.
   * Each new row keeps the original's settings as a starting point.
   */
  const splitSegmentIntoReps = (uid: string) =>
    setSegments((current) => {
      const index = current.findIndex((segment) => segment.uid === uid);
      if (index === -1) return current;
      const draft = current[index];
      const count = Math.max(1, Math.round(Number(draft.repeats) || 1));
      if (count <= 1) return current;
      const expanded: SegmentDraft[] = Array.from({ length: count }, (_, i) => ({
        ...draft,
        uid: `sg-${(uidCounter += 1)}`,
        label: `${draft.label.trim() || 'מקטע'} #${i + 1}`,
        repeats: '1',
      }));
      return [...current.slice(0, index), ...expanded, ...current.slice(index + 1)];
    });

  /** The valid drafts as real segments, for the distance/points preview. */
  const plannedSegments = segments
    .map((draft, index) => toSegment(draft, index))
    .filter((segment): segment is Omit<RunningSegment, 'id'> => segment !== null)
    .map((segment, index) => ({ id: 'preview-' + index, ...segment }));

  const segmentPreview = (draft: SegmentDraft) => {
    const meters = Number(draft.meters) * Number(draft.repeats);
    if (!(meters > 0)) return 'ממתין לפרטים';
    const points = Math.round(meters / 100) * PACE_MULTIPLIER[draft.pace_category];
    return `${(meters / 1000).toFixed(1)} ק״מ · ${points} נק׳`;
  };

  const updateRoundCategory = (index: number, category: CategoryId) =>
    setRoundCategories((current) => current.map((entry, i) => (i === index ? category : entry)));

  const addRoundTiming = () => {
    setRoundWorkSeconds((current) => [...current, defaultWork]);
    setRoundRestSeconds((current) => [...current, defaultRest]);
  };
  const removeRoundTiming = (index: number) => {
    setRoundWorkSeconds((current) => current.filter((_, i) => i !== index));
    setRoundRestSeconds((current) => current.filter((_, i) => i !== index));
  };
  const updateRoundWork = (index: number, seconds: number) =>
    setRoundWorkSeconds((current) => current.map((entry, i) => (i === index ? seconds : entry)));
  const updateRoundRest = (index: number, seconds: number) =>
    setRoundRestSeconds((current) => current.map((entry, i) => (i === index ? seconds : entry)));

  const addRound = () => {
    setRoundCategories((current) => [
      ...current,
      gameCategories[current.length % gameCategories.length]?.id ?? gameCategories[0].id,
    ]);
    addRoundTiming();
  };

  const removeRound = (index: number) => {
    setRoundCategories((current) => current.filter((_, i) => i !== index));
    removeRoundTiming(index);
  };

  const updateRoundExercise = (index: number, exerciseId: string) =>
    setRoundExerciseIds((current) => current.map((entry, i) => (i === index ? exerciseId : entry)));

  const addExerciseRound = () => {
    setRoundExerciseIds((current) => [
      ...current,
      gameExercises[current.length % gameExercises.length]?.id ?? gameExercises[0].id,
    ]);
    addRoundTiming();
  };

  const removeExerciseRound = (index: number) => {
    setRoundExerciseIds((current) => current.filter((_, i) => i !== index));
    removeRoundTiming(index);
  };

  const toggleLevel = (level: StrengthLevel) =>
    setOpenLevels((current) =>
      current.includes(level) ? current.filter((entry) => entry !== level) : [...current, level],
    );

  /** Loads a session's structure into the draft state — segments/rounds/timing. */
  const applySessionStructure = (source: TrainingSession) => {
    setTrainingType(source.training_type);
    setInstructions(source.workout_instructions);

    if (source.training_type === 'running' && source.running) {
      setRunMode(source.running.mode);
      setSegments(
        source.running.segments.length > 0
          ? source.running.segments.map((segment) => ({
              uid: `sg-${(uidCounter += 1)}`,
              label: segment.label,
              target_group: segment.target_group,
              repeats: String(segment.repeats),
              meters: String(segment.distance_meters),
              pace_category: segment.pace_category,
              recovery: String(segment.recovery_seconds),
            }))
          : [blankSegment()],
      );
    } else if (source.points_game) {
      const config = source.points_game;
      setRoundWorkSeconds(config.round_work_seconds);
      setRoundRestSeconds(config.round_rest_seconds);
      if (hasFixedExercises(config.catalog)) {
        setRoundExerciseIds(config.round_exercise_ids);
      } else {
        setRoundCategories(config.round_categories);
        setOpenLevels(config.allowed_levels);
        setPreviewCategory(config.round_categories[0] ?? defaultCategories(config.catalog)[0]);
      }
    }
  };

  /**
   * Loads a past session's structure as a starting point for a *new*
   * training — everything about *what* it is, never *when* (title, date,
   * week stay fresh) or its results.
   */
  const loadPastSession = (sessionId: string) => {
    setLoadedFromSessionId(sessionId);
    const source = pastSessions.find((session) => session.id === sessionId);
    if (source) applySessionStructure(source);
  };

  /**
   * Switches the builder into editing an already-published session in
   * place — everything loads, including title/date/week. Publishing will
   * update that session instead of creating a new one; the server still
   * refuses if anyone has logged against it in the meantime.
   */
  const startEditingSession = (sessionId: string) => {
    const source = pastSessions.find((session) => session.id === sessionId);
    if (!source) return;
    setEditingSessionId(sessionId);
    setEditingSessionTitle(source.title);
    setLoadedFromSessionId('');
    setAttachWarmup(false);
    setAttachCooldown(false);
    setTitle(source.title);
    setDate(source.date);
    setWeekIndex(source.week_index);
    applySessionStructure(source);
    setStep(1);
  };

  const cancelEditing = () => {
    setEditingSessionId(null);
    setEditingSessionTitle('');
    setTitle(`שבוע ${nextWeekIndex} — `);
    setDate(nextMonday());
    setWeekIndex(nextWeekIndex);
    setInstructions('');
    setTrainingType('running');
    setRunMode('intervals');
    setSegments([blankSegment()]);
  };

  /** Builds the add/remove/update handlers for an attached warm-up/cool-down round list. */
  function makeAttachedGameHandlers(
    kind: 'warmup' | 'cooldown',
    setIds: (updater: (current: string[]) => string[]) => void,
    setWork: (updater: (current: number[]) => number[]) => void,
    setRest: (updater: (current: number[]) => number[]) => void,
  ) {
    const exercises = catalogExercises(kind);
    return {
      updateExercise: (index: number, exerciseId: string) =>
        setIds((current) => current.map((entry, i) => (i === index ? exerciseId : entry))),
      updateWork: (index: number, seconds: number) =>
        setWork((current) => current.map((entry, i) => (i === index ? seconds : entry))),
      updateRest: (index: number, seconds: number) =>
        setRest((current) => current.map((entry, i) => (i === index ? seconds : entry))),
      add: () => {
        setIds((current) => [...current, exercises[current.length % exercises.length]?.id ?? exercises[0].id]);
        setWork((current) => [...current, defaultWork]);
        setRest((current) => [...current, defaultRest]);
      },
      remove: (index: number) => {
        setIds((current) => current.filter((_, i) => i !== index));
        setWork((current) => current.filter((_, i) => i !== index));
        setRest((current) => current.filter((_, i) => i !== index));
      },
    };
  }

  const warmupHandlers = makeAttachedGameHandlers(
    'warmup',
    setWarmupExerciseIds,
    setWarmupWorkSeconds,
    setWarmupRestSeconds,
  );
  const cooldownHandlers = makeAttachedGameHandlers(
    'cooldown',
    setCooldownExerciseIds,
    setCooldownWorkSeconds,
    setCooldownRestSeconds,
  );

  /* ---------------------------------------------------------- publish */

  const publish = useMutation({
    mutationFn: async () => {
      const payload: SessionPlanInput = {
        title: title.trim(),
        date,
        week_index: weekIndex,
        workout_instructions: instructions.trim(),
        training_type: trainingType,
        points_game: isGameType(trainingType)
          ? {
              catalog: catalogKind,
              round_work_seconds: roundWorkSeconds,
              round_rest_seconds: roundRestSeconds,
              round_categories: fixedExercises ? [] : roundCategories,
              round_exercise_ids: fixedExercises ? roundExerciseIds : [],
              allowed_levels: fixedExercises ? [] : openLevels,
            }
          : null,
        running:
          trainingType === 'running'
            ? {
                mode: runMode,
                segments: segments
                  .map((draft, index) => toSegment(draft, index))
                  .filter((segment): segment is Omit<RunningSegment, 'id'> => segment !== null)
                  .map((segment, index) => ({ id: `seg-${index + 1}`, ...segment })),
              }
            : null,
        // Neither running nor the points games use per-group exercise tracks:
        // running carries its plan in segments, and a points game has
        // everyone pick their own exercise each round.
        tracks: [],
      };

      const result = editingSessionId
        ? await updateTrainingSession(editingSessionId, payload)
        : await createTrainingSession(payload);
      if (!result.ok) throw new Error(result.error);
      const titles = [result.data.title];

      // Editing an existing session never spins up new attached trainings —
      // only a fresh publish does.
      if (!editingSessionId && trainingType !== 'warmup' && trainingType !== 'cooldown') {
        const attachments = [
          {
            attach: attachWarmup,
            kind: 'warmup' as const,
            suffix: 'חימום',
            ids: warmupExerciseIds,
            work: warmupWorkSeconds,
            rest: warmupRestSeconds,
          },
          {
            attach: attachCooldown,
            kind: 'cooldown' as const,
            suffix: 'שחרור',
            ids: cooldownExerciseIds,
            work: cooldownWorkSeconds,
            rest: cooldownRestSeconds,
          },
        ];
        for (const { attach, kind, suffix, ids, work, rest } of attachments) {
          if (!attach) continue;
          const attachedResult = await createTrainingSession({
            title: `${title.trim()} — ${suffix}`,
            date,
            week_index: weekIndex,
            workout_instructions: '',
            training_type: kind,
            points_game: {
              catalog: kind,
              round_work_seconds: work,
              round_rest_seconds: rest,
              round_categories: [],
              round_exercise_ids: ids,
              allowed_levels: [],
            },
            running: null,
            tracks: [],
          });
          if (!attachedResult.ok) throw new Error(attachedResult.error);
          titles.push(attachedResult.data.title);
        }
      }

      return titles;
    },
    onSuccess: (titles) => {
      setPublished(titles.join(' · '));
      setPublishedWasEdit(Boolean(editingSessionId));
      setStep(1);
      if (editingSessionId) {
        // Stay put: don't advance the week or reset the draft, since the
        // trainer was fixing something specific, not starting a new training.
        setEditingSessionId(null);
        setEditingSessionTitle('');
        router.refresh();
        return;
      }
      setTitle(`שבוע ${weekIndex + 1} — `);
      setWeekIndex((current) => current + 1);
      setInstructions('');
      setSegments([blankSegment()]);
      if (fixedExercises) {
        setRoundExerciseIds(cycleExercises(catalogKind, roundExerciseIds.length || 4));
      } else {
        setRoundCategories(cycleCategories(catalogKind, roundCategories.length || 6));
      }
      setAttachWarmup(false);
      setAttachCooldown(false);
      setLoadedFromSessionId('');
      router.refresh();
    },
  });

  /* -------------------------------------------------------------- UI */

  return (
    <div className="space-y-4">
      {published ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4"
        >
          <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              ‏„{published}” {publishedWasEdit ? 'עודכן' : 'פורסם'}
            </p>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
              {publishedWasEdit
                ? 'השינויים גלויים לכל המתאמנים עכשיו.'
                : `כל ${participantCount} המתאמנים רואים אותו עכשיו ויכולים להעלות תוצאות.`}
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost ms-auto px-2 py-1 text-xs"
            onClick={() => setPublished(null)}
          >
            סגירה
          </button>
        </div>
      ) : null}

      {/* --------------------------------------------------- step rail */}
      <ol className="grid gap-2 sm:grid-cols-3">
        {STEPS[trainingType].map((entry) => {
          const state = entry.number === step ? 'current' : entry.number < step ? 'done' : 'todo';
          return (
            <li key={entry.number}>
              <button
                type="button"
                onClick={() => setStep(entry.number as 1 | 2 | 3)}
                disabled={entry.number > step}
                aria-current={state === 'current' ? 'step' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border p-3 text-start transition-colors',
                  state === 'current' && 'border-accent bg-accent/5',
                  state === 'done' && 'border-line bg-surface hover:bg-elevated',
                  state === 'todo' && 'border-line bg-surface opacity-60',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                    state === 'current' && 'bg-accent text-white',
                    state === 'done' && 'bg-emerald-500 text-white',
                    state === 'todo' && 'bg-elevated text-muted',
                  )}
                >
                  {state === 'done' ? <Check aria-hidden className="h-4 w-4" /> : entry.number}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{entry.title}</span>
                  <span className="block truncate text-xs text-muted">{entry.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* ------------------------------------------------------- step 1 */}
      {step === 1 ? (
        <Card className="card-pad space-y-5">
          {editingSessionId ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-accent/40 bg-accent/5 p-3">
              <p className="min-w-0 flex-1 text-sm text-ink">
                עורכים את „<span className="font-semibold">{editingSessionTitle}</span>” — אם למישהו כבר יש תוצאה
                רשומה עליו, השמירה תיחסם.
              </p>
              <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={cancelEditing}>
                ביטול עריכה
              </button>
            </div>
          ) : null}

          {pastSessions.length > 0 && !editingSessionId ? (
            <div className="space-y-1.5 rounded-2xl border border-line bg-elevated/50 p-3">
              <label htmlFor="wt-past-session" className="text-sm font-medium text-ink">
                להתחיל מאימון קודם, או לערוך אימון קיים?{' '}
                <span className="font-normal text-muted">(אופציונלי)</span>
              </label>
              <select
                id="wt-past-session"
                className="input"
                value={loadedFromSessionId}
                onChange={(event) => loadPastSession(event.target.value)}
              >
                <option value="">בחרו אימון</option>
                {pastSessions
                  .slice()
                  .reverse()
                  .map((session) => (
                    <option key={session.id} value={session.id}>
                      שבוע {session.week_index} · {session.title}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-muted">
                טעינה כנקודת התחלה מעתיקה את המבנה לאימון חדש. עריכה משנה את האימון הקיים עצמו — רק
                כשעדיין אין לו תוצאות רשומות.
              </p>
              {loadedFromSessionId ? (
                <button
                  type="button"
                  className="btn-secondary w-full py-1.5 text-sm"
                  onClick={() => startEditingSession(loadedFromSessionId)}
                >
                  עריכת האימון הזה במקום
                </button>
              ) : null}
            </div>
          ) : null}

          <div>
            <h2 className="text-base font-semibold text-ink">איזה סוג אימון זה?</h2>
            <p className="mt-1 text-sm text-muted">
              קודם בוחרים סוג — זה קובע מה מגדירים בשלב הבא.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {TYPE_CARDS.map(({ value, title: cardTitle, blurb, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTrainingType(value);
                  if (isGameType(value)) {
                    const kind = value as CatalogKind;
                    const count = hasFixedExercises(kind) ? 4 : 6;
                    setRoundWorkSeconds(Array(count).fill(defaultWork));
                    setRoundRestSeconds(Array(count).fill(defaultRest));
                    if (hasFixedExercises(kind)) {
                      setRoundExerciseIds(cycleExercises(kind, 4));
                    } else {
                      setRoundCategories(cycleCategories(kind, 6));
                      setPreviewCategory(defaultCategories(kind)[0]);
                    }
                  }
                }}
                aria-pressed={trainingType === value}
                className={cn(
                  'rounded-2xl border p-4 text-start transition-colors',
                  trainingType === value
                    ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                    : 'border-line bg-surface hover:bg-elevated',
                )}
              >
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl',
                    trainingType === value ? 'bg-accent text-white' : 'bg-elevated text-muted',
                  )}
                >
                  <Icon aria-hidden className="h-5 w-5" />
                </span>
                <span className="mt-3 block text-sm font-semibold text-ink">{cardTitle}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">{blurb}</span>
              </button>
            ))}
          </div>

          {trainingType !== 'warmup' && trainingType !== 'cooldown' && !editingSessionId ? (
            <div className="flex flex-wrap gap-4 rounded-2xl border border-line bg-elevated/50 p-3">
              <p className="w-full text-xs font-medium text-muted">לצרף לאימון הזה:</p>
              <label className="flex items-center gap-1.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={attachWarmup}
                  onChange={(event) => setAttachWarmup(event.target.checked)}
                />
                <Flame aria-hidden className="h-3.5 w-3.5 text-muted" />
                חימום
              </label>
              <label className="flex items-center gap-1.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={attachCooldown}
                  onChange={(event) => setAttachCooldown(event.target.checked)}
                />
                <Wind aria-hidden className="h-3.5 w-3.5 text-muted" />
                שחרור
              </label>
              <p className="w-full text-xs text-muted">
                כל אחד יפורסם כאימון נפרד באותו תאריך ושבוע — בוחרים את התרגילים והתזמון לכל סבב למטה.
              </p>

              {attachWarmup ? (
                <AttachedGameRounds
                  kind="warmup"
                  exerciseIds={warmupExerciseIds}
                  workSeconds={warmupWorkSeconds}
                  restSeconds={warmupRestSeconds}
                  onUpdateExercise={warmupHandlers.updateExercise}
                  onUpdateWork={warmupHandlers.updateWork}
                  onUpdateRest={warmupHandlers.updateRest}
                  onAdd={warmupHandlers.add}
                  onRemove={warmupHandlers.remove}
                />
              ) : null}

              {attachCooldown ? (
                <AttachedGameRounds
                  kind="cooldown"
                  exerciseIds={cooldownExerciseIds}
                  workSeconds={cooldownWorkSeconds}
                  restSeconds={cooldownRestSeconds}
                  onUpdateExercise={cooldownHandlers.updateExercise}
                  onUpdateWork={cooldownHandlers.updateWork}
                  onUpdateRest={cooldownHandlers.updateRest}
                  onAdd={cooldownHandlers.add}
                  onRemove={cooldownHandlers.remove}
                />
              ) : null}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="wt-title" className="text-sm font-medium text-ink">
              שם האימון
            </label>
            <input
              id="wt-title"
              className="input text-base"
              placeholder={`שבוע ${weekIndex} — חזרות סף`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <p className="text-xs text-muted">מופיע בראש כרטיס האימון של כל מתאמן.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <label htmlFor="wt-date" className="text-sm font-medium text-ink">
                תאריך האימון
              </label>
              <input
                id="wt-date"
                type="date"
                className="input tnum"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
              <p className="text-xs text-muted">{date ? formatDate(date) : 'בחרו תאריך'}</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="wt-week" className="text-sm font-medium text-ink">
                מספר שבוע
              </label>
              <input
                id="wt-week"
                type="number"
                min={1}
                className="input w-28 tnum"
                value={weekIndex}
                onChange={(event) => setWeekIndex(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="wt-notes" className="text-sm font-medium text-ink">
              הערה לכולם <span className="font-normal text-muted">(אופציונלי)</span>
            </label>
            <textarea
              id="wt-notes"
              rows={3}
              className="input resize-y"
              placeholder="חימום, כמה קשה זה אמור להרגיש, ועל מה לשים לב."
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className="btn-primary"
              disabled={!canContinueFromStep1}
              onClick={() => setStep(2)}
            >
              {trainingType === 'running' ? 'הבא: מקטעי הריצה' : 'הבא: הגדרת המשחק'}
              <ArrowRight aria-hidden className="h-4 w-4 rtl:rotate-180" />
            </button>
          </div>
        </Card>
      ) : null}


      {/* ---------------------------------------- step 2 — running plan */}
      {step === 2 && trainingType === 'running' ? (
        <div className="space-y-4">
          <Card className="card-pad space-y-4">
            <div>
              <h2 className="text-base font-semibold text-ink">איך רצים השבוע?</h2>
              <p className="mt-1 text-sm text-muted">
                ריצה אחידה היא מקטע אחד רצוף. באינטרוולים אפשר להגדיר כמה מקטעים, כל אחד עם מרחק,
                מספר חזרות וקצב יעד משלו.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  { value: 'intervals' as const, title: 'אינטרוולים', blurb: 'כמה מקטעים בקצבים שונים' },
                  { value: 'steady' as const, title: 'ריצה אחידה', blurb: 'מקטע אחד רצוף בקצב יעד' },
                ]
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={runMode === option.value}
                  onClick={() => {
                    setRunMode(option.value);
                    // A steady run is a single segment with one repeat.
                    if (option.value === 'steady') {
                      setSegments((current) => [
                        {
                          ...(current[0] ?? blankSegment()),
                          label: 'ריצה רצופה',
                          repeats: '1',
                          meters: '5000',
                          pace_category: 'borg',
                          recovery: '0',
                        },
                      ]);
                    }
                  }}
                  className={cn(
                    'rounded-2xl border p-3 text-start transition-colors',
                    runMode === option.value
                      ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                      : 'border-line bg-surface hover:bg-elevated',
                  )}
                >
                  <span className="block text-sm font-semibold text-ink">{option.title}</span>
                  <span className="mt-0.5 block text-xs text-muted">{option.blurb}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="card-pad space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-ink">
                המקטעים <Badge tone="accent">{validSegments.length}</Badge>
              </h2>
              <p className="text-xs text-muted tnum">
                סה״כ {(plannedDistance(plannedSegments) / 1000).toFixed(1)} ק״מ ·{' '}
                {plannedPoints(plannedSegments)} נק׳ בביצוע מלא בקצב היעד
              </p>
            </div>

            <ol className="space-y-3">
              {segments.map((segment, index) => (
                <li key={segment.uid} className="rounded-2xl border border-line bg-elevated/50 p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold text-muted tnum">
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1 space-y-2">
                      <input
                        className="input font-medium"
                        placeholder="שם המקטע, למשל אינטרוול 800 מ׳"
                        aria-label={`שם מקטע ${index + 1}`}
                        value={segment.label}
                        onChange={(event) =>
                          updateSegment(segment.uid, { label: event.target.value })
                        }
                      />

                      <div className="grid gap-2 sm:grid-cols-4">
                        <label className="space-y-1 text-xs text-muted">
                          חזרות
                          <input
                            className="input py-1.5 tnum"
                            inputMode="numeric"
                            aria-label={`חזרות במקטע ${index + 1}`}
                            value={segment.repeats}
                            disabled={runMode === 'steady'}
                            onChange={(event) =>
                              updateSegment(segment.uid, {
                                repeats: event.target.value.replace(/[^\d]/g, ''),
                              })
                            }
                          />
                        </label>

                        <label className="space-y-1 text-xs text-muted">
                          מרחק (מטר)
                          <input
                            className="input py-1.5 tnum"
                            inputMode="numeric"
                            aria-label={`מרחק במקטע ${index + 1}`}
                            value={segment.meters}
                            onChange={(event) =>
                              updateSegment(segment.uid, {
                                meters: event.target.value.replace(/[^\d]/g, ''),
                              })
                            }
                          />
                        </label>

                        <label className="space-y-1 text-xs text-muted">
                          קצב
                          <select
                            className="input py-1.5"
                            aria-label={`קצב במקטע ${index + 1}`}
                            value={segment.pace_category}
                            onChange={(event) =>
                              updateSegment(segment.uid, {
                                pace_category: event.target.value as RunPaceCategory,
                              })
                            }
                          >
                            {PACE_CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {PACE_LABELS[category]}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="space-y-1 text-xs text-muted">
                          מנוחה (שניות)
                          <input
                            className="input py-1.5 tnum"
                            inputMode="numeric"
                            aria-label={`מנוחה במקטע ${index + 1}`}
                            value={segment.recovery}
                            disabled={runMode === 'steady'}
                            onChange={(event) =>
                              updateSegment(segment.uid, {
                                recovery: event.target.value.replace(/[^\d]/g, ''),
                              })
                            }
                          />
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-xs text-muted">
                          למי
                          <select
                            className="input w-auto py-1.5"
                            aria-label={`למי מיועד מקטע ${index + 1}`}
                            value={segment.target_group}
                            onChange={(event) =>
                              updateSegment(segment.uid, {
                                target_group: event.target.value as SessionTarget,
                              })
                            }
                          >
                            <option value="all">כל הקבוצות</option>
                            {GROUP_LIST.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <span className="text-xs text-muted tnum">
                          {segmentPreview(segment)}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-1">
                      {runMode === 'intervals' && Number(segment.repeats) > 1 ? (
                        <button
                          type="button"
                          className="btn-ghost h-8 w-8 p-0 text-accent"
                          aria-label={`פיצול מקטע ${index + 1} ל-${segment.repeats} חזרות נפרדות`}
                          title="פיצול לחזרות נפרדות — כדי לתת לכל חזרה קצב ומנוחה משלה"
                          onClick={() => splitSegmentIntoReps(segment.uid)}
                        >
                          <Split aria-hidden className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn-ghost h-8 w-8 p-0 text-rose-500"
                        aria-label={`הסרת מקטע ${index + 1}`}
                        disabled={segments.length === 1}
                        onClick={() => removeSegment(segment.uid)}
                      >
                        <Trash2 aria-hidden className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            {runMode === 'intervals' ? (
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => setSegments((current) => [...current, blankSegment()])}
              >
                <Plus aria-hidden className="h-4 w-4" />
                הוספת מקטע
              </button>
            ) : null}

            <p className="rounded-xl bg-accent/10 px-3 py-2 text-xs text-accent">
              נקודות = (מטרים ÷ 100) × משקל הקצב שנבחר. אין יעד קבוצתי כאן — זו תחרות, וכל נקודה
              נכנסת ישר לטבלת הקבוצות בעמוד הבית.
            </p>
          </Card>

          {publish.isError ? (
            <p role="alert" className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
              <TriangleAlert aria-hidden className="h-4 w-4" />
              {(publish.error as Error).message}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
              <ArrowLeft aria-hidden className="h-4 w-4 rtl:rotate-180" />
              חזרה
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!canContinueFromStep2 || publish.isPending}
              onClick={() => publish.mutate()}
            >
              {publish.isPending ? (
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              ) : (
                <Send aria-hidden className="h-4 w-4" />
              )}
              {publish.isPending
                ? editingSessionId
                  ? 'שומרת…'
                  : 'מפרסם…'
                : editingSessionId
                  ? 'שמירת השינויים'
                  : `פרסום ל-${participantCount} מתאמנים`}
            </button>
          </div>
        </div>
      ) : null}

      {/* ------------------------------------ step 2 — points game */}
      {step === 2 && isGameType(trainingType) ? (
        <div className="space-y-4">
          <Card className="card-pad space-y-4">
            <div className="flex items-start gap-3">
              <Timer aria-hidden className="mt-0.5 h-5 w-5 text-muted" />
              <div>
                <h2 className="text-base font-semibold text-ink">מבנה האינטרוולים</h2>
                <p className="mt-1 text-sm text-muted">
                  המתאמנים עובדים באינטרוול העבודה, ובמנוחה רושמים מה ביצעו. לכל סבב זמן משלו — אפשר
                  לשנות בעבודה ובמנוחה של כל סבב בנפרד למטה.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { id: 'work', label: 'ברירת מחדל לעבודה (שניות)', value: defaultWork, set: setDefaultWork, step: 5 },
                { id: 'rest', label: 'ברירת מחדל למנוחה (שניות)', value: defaultRest, set: setDefaultRest, step: 5 },
              ].map((field) => (
                <div key={field.id} className="space-y-1.5">
                  <label htmlFor={`wt-${field.id}`} className="text-sm font-medium text-ink">
                    {field.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn-secondary h-11 w-11 shrink-0 p-0"
                      aria-label={`הפחתה — ${field.label}`}
                      onClick={() => field.set(Math.max(field.step, field.value - field.step))}
                    >
                      <Minus aria-hidden className="h-4 w-4" />
                    </button>
                    <input
                      id={`wt-${field.id}`}
                      type="number"
                      min={1}
                      className="input h-11 text-center tnum"
                      value={field.value}
                      onChange={(event) => field.set(Math.max(1, Number(event.target.value)))}
                    />
                    <button
                      type="button"
                      className="btn-secondary h-11 w-11 shrink-0 p-0"
                      aria-label={`הוספה — ${field.label}`}
                      onClick={() => field.set(field.value + field.step)}
                    >
                      <Plus aria-hidden className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p className="rounded-xl bg-elevated px-3 py-2 text-xs text-muted tnum">
              {roundsTotal} סבבים · סה״כ{' '}
              {Math.round(
                roundWorkSeconds.reduce((sum, s) => sum + s, 0) / 60 +
                  roundRestSeconds.reduce((sum, s) => sum + s, 0) / 60,
              )}{' '}
              דקות עבודה
            </p>
          </Card>

          {fixedExercises ? (
            <Card className="card-pad space-y-4">
              <div>
                <h2 className="text-base font-semibold text-ink">איזה תרגיל בכל סבב?</h2>
                <p className="mt-1 text-sm text-muted">
                  אין כאן בחירה למתאמן ואין רמות — אתם קובעים את התרגיל המדויק לכל סבב, וכולם
                  מבצעים אותו יחד.
                </p>
              </div>

              <ol className="space-y-2">
                {roundExerciseIds.map((exerciseId, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-semibold text-muted tnum">
                      {index + 1}
                    </span>
                    <select
                      className="input flex-1"
                      aria-label={`תרגיל לסבב ${index + 1}`}
                      value={exerciseId}
                      onChange={(event) => updateRoundExercise(index, event.target.value)}
                    >
                      {gameExercises.map((exercise) => (
                        <option key={exercise.id} value={exercise.id}>
                          {exercise.name}
                        </option>
                      ))}
                    </select>
                    <RoundTimingFields
                      index={index}
                      work={roundWorkSeconds[index] ?? defaultWork}
                      rest={roundRestSeconds[index] ?? defaultRest}
                      onWorkChange={(value) => updateRoundWork(index, value)}
                      onRestChange={(value) => updateRoundRest(index, value)}
                    />
                    <button
                      type="button"
                      className="btn-ghost h-9 w-9 shrink-0 p-0 text-rose-500"
                      aria-label={`הסרת סבב ${index + 1}`}
                      disabled={roundExerciseIds.length === 1}
                      onClick={() => removeExerciseRound(index)}
                    >
                      <Trash2 aria-hidden className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ol>

              <button type="button" className="btn-secondary w-full" onClick={addExerciseRound}>
                <Plus aria-hidden className="h-4 w-4" />
                הוספת סבב
              </button>
            </Card>
          ) : (
            <Card className="card-pad space-y-4">
              <div>
                <h2 className="text-base font-semibold text-ink">איזו קבוצת שריר בכל סבב?</h2>
                <p className="mt-1 text-sm text-muted">
                  לכל סבב קובעים קבוצת שריר אחת — המתאמן בוחר תרגיל מתוכה בלבד, כך שאתם שולטים
                  בפיזור העבודה על הגוף לאורך המשחק.
                </p>
              </div>

              <ol className="space-y-2">
                {roundCategories.map((category, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-semibold text-muted tnum">
                      {index + 1}
                    </span>
                    <select
                      className="input flex-1"
                      aria-label={`קבוצת שריר לסבב ${index + 1}`}
                      value={category}
                      onChange={(event) => updateRoundCategory(index, event.target.value as CategoryId)}
                    >
                      {gameCategories.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                    <RoundTimingFields
                      index={index}
                      work={roundWorkSeconds[index] ?? defaultWork}
                      rest={roundRestSeconds[index] ?? defaultRest}
                      onWorkChange={(value) => updateRoundWork(index, value)}
                      onRestChange={(value) => updateRoundRest(index, value)}
                    />
                    <button
                      type="button"
                      className="btn-ghost h-9 w-9 shrink-0 p-0 text-rose-500"
                      aria-label={`הסרת סבב ${index + 1}`}
                      disabled={roundCategories.length === 1}
                      onClick={() => removeRound(index)}
                    >
                      <Trash2 aria-hidden className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ol>

              <button type="button" className="btn-secondary w-full" onClick={addRound}>
                <Plus aria-hidden className="h-4 w-4" />
                הוספת סבב
              </button>

              <div className="flex flex-wrap gap-2">
                {([1, 2, 3, 4] as StrengthLevel[]).map((level) => {
                  const on = openLevels.includes(level);
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => toggleLevel(level)}
                      aria-pressed={on}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                        on ? 'border-accent text-accent' : 'border-line text-muted',
                      )}
                    >
                      רמה {level} · ×{level} נקודות
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          {fixedExercises ? (
            <Card className="overflow-hidden">
              <div className="border-b border-line px-4 py-3">
                <p className="text-sm font-semibold text-ink">התרגילים שנבחרו לכל סבב</p>
                <p className="text-xs text-muted">לחיצה על אייקון ההפעלה מציגה הדגמה של התנועה.</p>
              </div>
              <ul className="divide-y divide-line">
                {roundExerciseIds.map((exerciseId, index) => {
                  const exercise = gameExercises.find((entry) => entry.id === exerciseId);
                  if (!exercise) return null;
                  return (
                    <li key={index} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-semibold text-muted tnum">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p dir="rtl" className="truncate text-sm text-ink">
                          {exercise.name}
                        </p>
                        <p className="truncate text-xs text-muted">{exercise.nameEn}</p>
                      </div>
                      <LevelBadge level={exercise.level} />
                      <ExerciseDemoButton exercise={exercise} />
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="border-b border-line px-4 py-3">
                <p className="text-sm font-semibold text-ink">
                  {availableExercises.length} תרגילים יהיו זמינים
                </p>
                <p className="text-xs text-muted">לחיצה על אייקון ההפעלה מציגה הדגמה של התנועה.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {gameCategories.filter((entry) => uniqueRoundCategories.includes(entry.id)).map(
                    (entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setPreviewCategory(entry.id)}
                        aria-pressed={previewCategory === entry.id}
                        className={cn(
                          'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                          previewCategory === entry.id
                            ? 'bg-ink text-bg'
                            : 'bg-elevated text-muted hover:text-ink',
                        )}
                      >
                        {entry.name}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                {availableExercises
                  .filter((exercise) => exercise.category === previewCategory)
                  .map((exercise) => (
                    <li key={exercise.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p dir="rtl" className="truncate text-sm text-ink">
                          {exercise.name}
                        </p>
                        <p className="truncate text-xs text-muted">{exercise.nameEn}</p>
                      </div>
                      <LevelBadge level={exercise.level} />
                      <ExerciseDemoButton exercise={exercise} />
                    </li>
                  ))}
              </ul>
            </Card>
          )}

          <div className="flex items-center justify-between gap-2">
            <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
              <ArrowLeft aria-hidden className="h-4 w-4 rtl:rotate-180" />
              Back
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!canContinueFromStep2}
              onClick={() => setStep(3)}
            >
              הבא: סקירה ופרסום
              <ArrowRight aria-hidden className="h-4 w-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      ) : null}

      {/* ------------------------------------ step 3 — points game */}
      {step === 3 && isGameType(trainingType) ? (
        <div className="space-y-4">
          <Card className="card-pad space-y-3">
            <h2 className="text-base font-semibold text-ink">מוכן לפרסום</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-elevated p-3">
                <dt className="label">האימון</dt>
                <dd className="text-sm text-ink">{title.trim() || 'אימון ללא שם'}</dd>
                <dd className="text-xs text-muted tnum">{date ? formatDate(date) : 'ללא תאריך'}</dd>
              </div>
              <div className="rounded-xl bg-elevated p-3">
                <dt className="label">מבנה</dt>
                <dd className="text-sm text-ink tnum">
                  {roundsTotal} סבבים · {describeRoundTiming({ round_work_seconds: roundWorkSeconds, round_rest_seconds: roundRestSeconds })}
                </dd>
                <dd className="text-xs text-muted tnum">
                  {fixedExercises
                    ? 'תרגיל קבוע לכל סבב — אין בחירה ואין רמות'
                    : `${availableExercises.length} תרגילים פתוחים · רמות ${openLevels.join(', ')}`}
                </dd>
              </div>
              <div className="rounded-xl bg-elevated p-3">
                <dt className="label">ניקוד</dt>
                <dd className="text-sm text-ink">נקודות = חזרות × רמה</dd>
                <dd className="text-xs text-muted">
                  {catalogKind === 'endurance'
                    ? 'תרגילים בזמן: 5 שנ׳ = חזרה · מכשירים: 25 מ׳ או 30 שנ׳ = חזרה'
                    : catalogKind === 'strength'
                      ? 'סטטי: 5 שנ׳ = חזרה · זחילה: 2 מ׳ = חזרה'
                      : 'סטטי: 5 שנ׳ = חזרה'}
                </dd>
              </div>
            </dl>

            {publish.isError ? (
              <p role="alert" className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
                <TriangleAlert aria-hidden className="h-4 w-4" />
                {(publish.error as Error).message}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
              <button type="button" className="btn-ghost" onClick={() => setStep(2)}>
                <ArrowLeft aria-hidden className="h-4 w-4 rtl:rotate-180" />
                חזרה
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => publish.mutate()}
                disabled={publish.isPending}
              >
                {publish.isPending ? (
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                ) : (
                  <Send aria-hidden className="h-4 w-4" />
                )}
                {publish.isPending
                ? editingSessionId
                  ? 'שומרת…'
                  : 'מפרסם…'
                : editingSessionId
                  ? 'שמירת השינויים'
                  : `פרסום ל-${participantCount} מתאמנים`}
              </button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
