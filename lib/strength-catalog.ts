/**
 * Strength ("muscles") catalogue for the points game.
 *
 * Scoring, straight from the programme:
 *   Points = Reps x Level
 *   Static holds: every 5 seconds counts as one rep.
 *   Bear crawl:   every 2 metres counts as one rep.
 *
 * Four movement categories (push / pull / legs / core),
 * each with four difficulty tiers — בסיסי מאוד (intro), מתחיל (beginner),
 * בינוני (intermediate) and מתקדם (pro) — mapped straight to levels 1-4.
 *
 * Every exercise carries an `animation` key rendered by
 * `components/ExerciseAnimation.tsx`, plus an optional `gif_url` so a real
 * GIF or video can replace the built-in illustration later without touching
 * any component.
 */

export type StrengthCategoryId = 'lower' | 'push' | 'back' | 'core';
/** Categories of the endurance (heart-rate) catalogue. */
export type EnduranceCategoryId = 'cardio';
/** Categories of the warm-up catalogue: dynamic stretch, or pulse raiser. */
export type WarmupCategoryId = 'dynamic_stretch' | 'pulse_raiser';
/** Categories of the cool-down catalogue: static stretch, by body area. */
export type CooldownCategoryId = 'stretch_lower' | 'stretch_upper' | 'stretch_back';
/** Any category id, from any catalogue. */
export type CategoryId =
  | StrengthCategoryId
  | EnduranceCategoryId
  | WarmupCategoryId
  | CooldownCategoryId;
export type StrengthLevel = 1 | 2 | 3 | 4;
/** Raw unit the participant records for this exercise. */
export type StrengthUnit = 'reps' | 'seconds' | 'meters';

export interface StrengthCategory {
  id: CategoryId;
  /** Hebrew name, as the programme is written. */
  name: string;
  nameEn: string;
  description: string;
}

export interface StrengthExercise {
  id: string;
  name: string;
  nameEn: string;
  /** Which catalogue this exercise belongs to. */
  catalog: 'strength' | 'endurance' | 'warmup' | 'cooldown';
  category: CategoryId;
  level: StrengthLevel;
  unit: StrengthUnit;
  /** Raw units that make one scoring rep: 1 rep, 5 seconds, or 2 metres. */
  unitsPerRep: number;
  animation: AnimationKey;
  /** Optional real GIF/video; the built-in animation is used when null. */
  gif_url: string | null;
}

export type AnimationKey =
  | 'squat'
  | 'jumpsquat'
  | 'lunge'
  | 'bridge'
  | 'calf'
  | 'wallsit'
  | 'pushup'
  | 'wallpush'
  | 'dip'
  | 'pike'
  | 'ytw'
  | 'cobra'
  | 'birddog'
  | 'plank'
  | 'sideplank'
  | 'crunch'
  | 'legraise'
  | 'twist'
  | 'deadbug'
  | 'climber'
  | 'crawl'
  // endurance archetypes
  | 'jumpingjack'
  | 'burpee'
  | 'rope'
  | 'highknee'
  | 'stepup'
  | 'skater'
  | 'bike'
  | 'rowmachine';

export const STRENGTH_CATEGORIES: StrengthCategory[] = [
  {
    id: 'push',
    name: 'חזה, כתפיים ויד אחורית',
    nameEn: 'Chest, shoulders & triceps (push)',
    description: 'תרגילי דחיפה — Push movements',
  },
  {
    id: 'back',
    name: 'גב',
    nameEn: 'Back (pull)',
    description: 'תרגילי משיכה — Pull movements',
  },
  {
    id: 'lower',
    name: 'רגליים',
    nameEn: 'Legs',
    description: 'רגליים וישבן — Legs and glutes',
  },
  {
    id: 'core',
    name: 'ליבה ובטן',
    nameEn: 'Core and abs',
    description: 'יציבות ליבה — Trunk stability and abs',
  },
];

export const CATEGORIES_BY_ID: Record<StrengthCategoryId, StrengthCategory> = Object.fromEntries(
  STRENGTH_CATEGORIES.map((category) => [category.id, category]),
) as Record<StrengthCategoryId, StrengthCategory>;

/** Level names shown next to the points multiplier. */
export const LEVEL_LABELS: Record<StrengthLevel, { name: string; nameEn: string }> = {
  1: { name: 'רמה 1 — בסיסי מאוד', nameEn: 'Level 1 — Intro / very easy' },
  2: { name: 'רמה 2 — מתחיל', nameEn: 'Level 2 — Beginner' },
  3: { name: 'רמה 3 — בינוני', nameEn: 'Level 3 — Intermediate' },
  4: { name: 'רמה 4 — מתקדם', nameEn: 'Level 4 — Pro' },
};

const e = (
  id: string,
  name: string,
  nameEn: string,
  category: StrengthCategoryId,
  level: StrengthLevel,
  animation: AnimationKey,
  unit: StrengthUnit = 'reps',
): StrengthExercise => ({
  id,
  name,
  nameEn,
  catalog: 'strength',
  category,
  level,
  unit,
  unitsPerRep: unit === 'seconds' ? 5 : unit === 'meters' ? 2 : 1,
  animation,
  gif_url: null,
});

/**
 * Real animated GIFs, matched by hand against ExerciseDB's bodyweight
 * catalogue (see app/api/exercise-gif/[id]/route.ts for how the id resolves
 * to an actual GIF). Exercises without a confident match keep the built-in
 * stick-figure illustration — a wrong demo is worse than a generic one.
 */
export const REAL_GIF_IDS: Record<string, string> = {
  // push
  'push-1-wall-pushup': '0659',
  'push-2-incline-pushup': '0493',
  'push-2-knee-pushup': '0662',
  'push-2-bench-dip-bent-knee': '0129',
  'push-3-full-pushup': '0662',
  'push-3-decline-pushup': '0279',
  'push-3-diamond-pushup': '0283',
  'push-3-parallel-dip': '0251',
  'push-4-handstand-wall': '0471',
  'push-4-one-arm-pushup': '0666',
  'push-4-ring-dip': '0677',
  // back
  'back-2-inverted-row-shallow': '0497',
  'back-3-pullup': '0652',
  'back-3-chinup': '0253',
  'back-3-inverted-row': '0499',
  'back-4-muscleup': '0631',
  'back-4-one-arm-pullup': '0638',
  // lower
  'lower-2-calf-raise': '1373',
  'lower-1-short-glute-bridge': '0130',
  'lower-2-full-glute-bridge': '0130',
  'lower-3-jump-squat': '0514',
  'lower-3-walking-lunge': '1460',
  // core
  'core-1-arms-only-deadbug': '0276',
  'core-2-deadbug-full': '0276',
  'core-2-crunch': '0274',
  'core-3-reverse-crunch': '0872',
  'core-3-bicycle-crunch': '0003',
  'core-3-mountain-climber': '0630',
  'core-1-seated-knee-tuck': '0689',
  'core-3-hanging-knee-raise': '0472',
  // cardio (endurance catalogue)
  'cardio-1-slow-knee-raise': '3636',
  'cardio-3-high-knees': '3636',
  'cardio-3-fast-mountain-climber': '0630',
  'cardio-4-burpees': '1160',
  'cardio-3-sprawls': '0501',
  'cardio-4-squat-thrusts': '0501',
  'cardio-4-bear-crawl-fast': '3360',
  'cardio-3-rope-single': '2612',
  'cardio-4-rope-double': '2612',
  'cardio-2-skaters-no-hop': '3361',
  'cardio-3-wide-skaters': '3361',
  // warm-up
  'warm-pulse-2-high-knees': '3636',
  'warm-pulse-3-skater': '3361',
  // cool-down
  'cool-up-1-triceps': '0643',
  'cool-up-3-neck-front-back': '0462',
  'cool-up-3-neck-side': '0713',
  'cool-up-3-neck-rotation': '0716',
};

/** Wires in a real GIF (via the proxy route) for any exercise with a matched id. */
export function withRealGif(exercise: StrengthExercise): StrengthExercise {
  const gifId = REAL_GIF_IDS[exercise.id];
  return gifId ? { ...exercise, gif_url: `/api/exercise-gif/${gifId}` } : exercise;
}

export const STRENGTH_EXERCISES: StrengthExercise[] = [
  /* =========================== 1. חזה, כתפיים ויד אחורית (Push) =========================== */
  // רמה 1 — בסיסי מאוד
  e('push-1-wall-pushup', 'שכיבות סמיכה בעמידה כנגד קיר', 'Wall Push-ups', 'push', 1, 'wallpush'),
  e('push-1-knee-plank-hold', 'החזקת מצב שכיבת סמיכה על הברכיים', 'Knee Plank Hold', 'push', 1, 'plank', 'seconds'),
  e('push-1-arm-raises', 'הרמות ידיים לפנים ולצדדים ללא משקל כנגד התנגדות עצמית', 'Self-Resistance Arm Raises', 'push', 1, 'ytw'),
  e('push-1-isometric-press', 'לחיצות ידיים איזומטריות (כף אל כף מול החזה)', 'Isometric Palm Press', 'push', 1, 'ytw', 'seconds'),
  e('push-1-wall-triceps', 'פשיטת מרפקים בעמידה כנגד קיר', 'Wall Triceps Extensions', 'push', 1, 'wallpush'),
  // רמה 2 — מתחיל
  e('push-2-incline-pushup', 'שכיבות סמיכה בשיפוע חיובי (ידיים על ספסל/משטח מוגבה)', 'Incline Push-ups', 'push', 2, 'wallpush'),
  e('push-2-knee-pushup', 'שכיבות סמיכה על הברכיים', 'Knee Push-ups', 'push', 2, 'pushup'),
  e('push-2-pike-bent-knee', 'לחיצת כתפיים בתנוחת דוב (Pike Push-ups בברכיים כפופות)', 'Bent-Knee Pike Push-ups', 'push', 2, 'pike'),
  e('push-2-bench-dip-bent-knee', 'פשיטת מרפקים כנגד ספסל/כיסא (Bench Dips בברכיים כפופות)', 'Bent-Knee Bench Dips', 'push', 2, 'dip'),
  e('push-2-negative-pushup', 'שכיבות סמיכה שליליות (ירידה איטית בלבד)', 'Negative Push-ups', 'push', 2, 'pushup'),
  // רמה 3 — בינוני
  e('push-3-full-pushup', 'שכיבות סמיכה קלאסיות מלאות', 'Full Push-ups', 'push', 3, 'pushup'),
  e('push-3-decline-pushup', 'שכיבות סמיכה בשיפוע שלילי (רגליים מוגבהות על ספסל)', 'Decline Push-ups', 'push', 3, 'pushup'),
  e('push-3-pike-full', 'Pike Push-ups מלאים', 'Full Pike Push-ups', 'push', 3, 'pike'),
  e('push-3-diamond-pushup', 'שכיבות סמיכה יהלום', 'Diamond Push-ups', 'push', 3, 'pushup'),
  e('push-3-parallel-dip', 'Dips מלאים על מקבילים', 'Full Parallel Bar Dips', 'push', 3, 'dip'),
  // רמה 4 — מתקדם
  e('push-4-handstand-wall', 'שכיבות סמיכה בעמידת ידיים כנגד קיר', 'Wall Handstand Push-ups', 'push', 4, 'pike'),
  e('push-4-clap-pushup', 'שכיבות סמיכה מתפרצות עם מחיאת כף', 'Clap Push-ups', 'push', 4, 'pushup'),
  e('push-4-one-arm-pushup', 'שכיבות סמיכה ביד אחת', 'One-Arm Push-ups', 'push', 4, 'pushup'),
  e('push-4-archer-pushup', 'Archer Push-ups', 'Archer Push-ups', 'push', 4, 'pushup'),
  e('push-4-ring-dip', 'Dips בשיפוע חיובי על טבעות אולימפיות / מקבילים עם הטיה קדימה', 'Ring / Forward-Lean Dips', 'push', 4, 'dip'),

  /* ================================== 2. גב (Pull) ================================== */
  // רמה 1 — בסיסי מאוד
  e('back-1-scapular-squeeze', 'קירוב שכמות בישיבה או עמידה', 'Scapular Squeezes', 'back', 1, 'ytw'),
  e('back-1-towel-row', 'חתירה במשיכת מגבת/עמוד בעמידה בזווית קלה מאוד', 'Shallow-Angle Towel Row', 'back', 1, 'ytw'),
  e('back-1-cobra-lift', 'שכיבה על הבטן והרמת חזה קלה בלבד (Cobra Lift ללא ניתוק רגליים)', 'Cobra Lift', 'back', 1, 'cobra'),
  e('back-1-quadruped-balance', 'עמידת שש עם החזקת שיווי משקל (הרמת יד אחת בלבד בכל פעם)', 'Quadruped Single-Arm Balance', 'back', 1, 'birddog'),
  e('back-1-foot-supported-hang', 'תלייה פסיבית קצרה עם רגליים על הקרקע לתמיכה', 'Foot-Supported Dead Hang', 'back', 1, 'plank', 'seconds'),
  // רמה 2 — מתחיל
  e('back-2-inverted-row-shallow', 'חתירה אוסטרלית בעמידה/שיפוע גבוה (Inverted Rows בזווית קלה)', 'Shallow-Angle Inverted Rows', 'back', 2, 'ytw'),
  e('back-2-superman-hold', 'סופרמן על הקרקע בהחזקה סטטית', 'Static Superman Hold', 'back', 2, 'cobra', 'seconds'),
  e('back-2-scapular-retraction', 'תרגיל Scapular Retractions בשכיבה על הבטן', 'Prone Scapular Retractions', 'back', 2, 'cobra'),
  e('back-2-flexed-arm-hang', 'החזקת מתח סטטית בחלק העליון (Dead Hang / Flexed Arm Hang בעזרת קפיצה)', 'Flexed Arm Hang', 'back', 2, 'plank', 'seconds'),
  e('back-2-negative-pullup', 'מתח שלילי (Negative Pull-ups עם ירידה איטית)', 'Negative Pull-ups', 'back', 2, 'ytw'),
  // רמה 3 — בינוני
  e('back-3-pullup', 'מתח קלאסי באחיזה עילית', 'Pull-ups', 'back', 3, 'ytw'),
  e('back-3-chinup', 'מתח באחיזה תחתית', 'Chin-ups', 'back', 3, 'ytw'),
  e('back-3-inverted-row', 'חתירה אוסטרלית אופקית (Inverted Rows במקביל לקרקע)', 'Horizontal Inverted Rows', 'back', 3, 'ytw'),
  e('back-3-wide-pullup', 'מתח באחיזה רחבה', 'Wide-Grip Pull-ups', 'back', 3, 'ytw'),
  e('back-3-superman-pulldown', 'Superman Pulldowns (משיכת מרפקים לאחור בשכיבה)', 'Superman Pulldowns', 'back', 3, 'cobra'),
  // רמה 4 — מתקדם
  e('back-4-muscleup', 'עליות כוח (Muscle-ups על מתח או טבעות)', 'Muscle-ups', 'back', 4, 'ytw'),
  e('back-4-lsit-pullup', 'מתח L-Sit (Pull-ups ברגליים מורמות ב-90 מעלות)', 'L-Sit Pull-ups', 'back', 4, 'ytw'),
  e('back-4-archer-pullup', 'Archer Pull-ups', 'Archer Pull-ups', 'back', 4, 'ytw'),
  e('back-4-front-lever', 'Front Lever Raises / Tucks', 'Front Lever Raises / Tucks', 'back', 4, 'legraise'),
  e('back-4-one-arm-pullup', 'מתח ביד אחת / בעזרת אצבעות בודדות', 'One-Arm / Finger Pull-ups', 'back', 4, 'ytw'),

  /* ================================== 3. רגליים (Legs) ================================== */
  // רמה 1 — בסיסי מאוד
  e('lower-1-sit-to-stand', 'קימה וישיבה מכיסא', 'Sit-to-Stand', 'lower', 1, 'squat'),
  e('lower-1-wall-calf-raise', 'הרמות עקבים לתאומים בעמידה עם אחיזה בקיר', 'Wall-Assisted Calf Raises', 'lower', 1, 'calf'),
  e('lower-1-assisted-lunge-hold', 'מכרע סטטי קצר עם תמיכת ידיים על קיר/כיסא', 'Assisted Short Lunge Hold', 'lower', 1, 'lunge', 'seconds'),
  e('lower-1-hip-abduction', 'הרחקת ירך בעמידה עם אחיזה בקיר', 'Standing Hip Abductions', 'lower', 1, 'lunge'),
  e('lower-1-short-glute-bridge', 'גשר ישבן עם טווח תנועה קצר וללא שהייה', 'Short-Range Glute Bridge', 'lower', 1, 'bridge'),
  // רמה 2 — מתחיל
  e('lower-2-air-squat', 'סקווט משקל גוף מלא', 'Air Squats', 'lower', 2, 'squat'),
  e('lower-2-static-lunge', 'מכרעים במקום', 'Static Lunges', 'lower', 2, 'lunge'),
  e('lower-2-full-glute-bridge', 'גשר ישבן מלא על שתי רגליים', 'Full Glute Bridges', 'lower', 2, 'bridge'),
  e('lower-2-calf-raise', 'עליית עקבים לתאומים ללא אחיזה', 'Unassisted Calf Raises', 'lower', 2, 'calf'),
  e('lower-2-wall-sit', 'ישיבה כנגד קיר', 'Wall Sit', 'lower', 2, 'wallsit', 'seconds'),
  // רמה 3 — בינוני
  e('lower-3-walking-lunge', 'מכרעים בהליכה', 'Walking Lunges', 'lower', 3, 'lunge'),
  e('lower-3-bulgarian-split-squat', 'סקווט בולגרי (Bulgarian Split Squats על ספסל)', 'Bulgarian Split Squats', 'lower', 3, 'lunge'),
  e('lower-3-single-leg-bridge', 'גשר ישבן על רגל אחת', 'Single-Leg Glute Bridge', 'lower', 3, 'bridge'),
  e('lower-3-jump-squat', 'סקווט בקפיצה', 'Jump Squats', 'lower', 3, 'jumpsquat'),
  e('lower-3-cossack-squat', 'מכרעים הצידה (Cossack Squats בטווח תנועה בינוני)', 'Cossack Squats', 'lower', 3, 'lunge'),
  // רמה 4 — מתקדם
  e('lower-4-pistol-squat', 'סקווט אקדח מלא', 'Full Pistol Squats', 'lower', 4, 'squat'),
  e('lower-4-nordic-curl', 'Nordic Curls (לירך אחורית)', 'Nordic Curls', 'lower', 4, 'legraise'),
  e('lower-4-jumping-split-lunge', 'מכרעים בקפיצה עם החלפת רגליים באוויר', 'Jumping Split Lunges', 'lower', 4, 'jumpsquat'),
  e('lower-4-sissy-squat', 'סקווט סקנדינבי/ססי (Sissy Squats)', 'Sissy Squats', 'lower', 4, 'squat'),
  e('lower-4-deep-cossack-squat', 'Cossack Squats מלאים עם שהייה עמוקה ועבודה אקסצנטרית', 'Deep Cossack Squats', 'lower', 4, 'lunge'),

  /* ================================ 4. ליבה ובטן (Core & Abs) ================================ */
  // רמה 1 — בסיסי מאוד
  e('core-1-wall-plank', 'פלאנק בעמידה כנגד קיר או שיפוע גבוה מאוד', 'Incline Wall Plank', 'core', 1, 'plank', 'seconds'),
  e('core-1-pelvic-tilt', 'שכיבה על הגב והצמדת הגב התחתון למזרן (Pelvic Tilts)', 'Pelvic Tilts', 'core', 1, 'deadbug'),
  e('core-1-seated-knee-tuck', 'הרמות ברכיים בישיבה על כיסא (Seated Knee Tucks)', 'Seated Knee Tucks', 'core', 1, 'crunch'),
  e('core-1-arms-only-deadbug', 'תרגיל Dead Bug עם רגליים על הקרקע (תנועת ידיים בלבד)', 'Arms-Only Dead Bug', 'core', 1, 'deadbug'),
  e('core-1-quadruped-hold', 'עמידת שש עם שמירה על מנח ניטרלי (Quadruped Hold)', 'Quadruped Neutral Hold', 'core', 1, 'birddog', 'seconds'),
  // רמה 2 — מתחיל
  e('core-2-forearm-plank', 'פלאנק סטטי על האמות', 'Forearm Plank', 'core', 2, 'plank', 'seconds'),
  e('core-2-side-plank-knee', 'פלאנק צידי על הברכיים', 'Side Plank on Knees', 'core', 2, 'sideplank', 'seconds'),
  e('core-2-crunch', 'כפיפות בטן קלאסיות', 'Crunches', 'core', 2, 'crunch'),
  e('core-2-deadbug-full', 'תרגיל Dead Bug מלא', 'Full Dead Bug', 'core', 2, 'deadbug'),
  e('core-2-birddog', 'תרגיל Bird-Dog', 'Bird-Dog', 'core', 2, 'birddog'),
  // רמה 3 — בינוני
  e('core-3-side-plank-leg-raise', 'פלאנק צידי מלא עם הרמת רגל עליונה', 'Side Plank with Leg Raise', 'core', 3, 'sideplank', 'seconds'),
  e('core-3-hanging-knee-raise', 'הרמות ברכיים בתלייה על מתח (Hanging Knee Raises)', 'Hanging Knee Raises', 'core', 3, 'legraise'),
  e('core-3-bicycle-crunch', 'אופניים (Bicycle Crunches)', 'Bicycle Crunches', 'core', 3, 'twist'),
  e('core-3-reverse-crunch', 'גלגול אגן לאחור (Reverse Crunches)', 'Reverse Crunches', 'core', 3, 'crunch'),
  e('core-3-mountain-climber', 'Mountain Climbers בקצב מבוקר', 'Controlled Mountain Climbers', 'core', 3, 'climber'),
  // רמה 4 — מתקדם
  e('core-4-toes-to-bar', 'הרמות רגליים ישרות למתח (Toes to Bar)', 'Toes to Bar', 'core', 4, 'legraise'),
  e('core-4-dragon-flag', 'Dragon Flags', 'Dragon Flags', 'core', 4, 'crunch'),
  e('core-4-lsit', 'L-Sit מלא על מקבילים או קרקע', 'Full L-Sit', 'core', 4, 'legraise', 'seconds'),
  e('core-4-ab-wheel', 'פלאנק עם גלגלת בטן / פלאנק ארוך', 'Ab Wheel / Extended Plank', 'core', 4, 'plank', 'seconds'),
  e('core-4-vup', 'V-Ups מלאים', 'Full V-Ups', 'core', 4, 'crunch'),
].map(withRealGif);

export const EXERCISES_BY_ID: Record<string, StrengthExercise> = Object.fromEntries(
  STRENGTH_EXERCISES.map((exercise) => [exercise.id, exercise]),
);

export function findStrengthExercise(id: string): StrengthExercise | undefined {
  return EXERCISES_BY_ID[id];
}

export function exercisesFor(
  category: StrengthCategoryId,
  level?: StrengthLevel,
): StrengthExercise[] {
  return STRENGTH_EXERCISES.filter(
    (exercise) => exercise.category === category && (level ? exercise.level === level : true),
  );
}

/** Short human description of how this exercise is scored. */
export function scoringHint(exercise: StrengthExercise): string {
  const perRep = exercise.unitsPerRep;
  switch (exercise.unit) {
    case 'seconds':
      return `כל ${perRep} שניות = חזרה אחת · ${exercise.level} נק' לחזרה`;
    case 'meters':
      return `כל ${perRep} מטר = חזרה אחת · ${exercise.level} נק' לחזרה`;
    default:
      return `${exercise.level} נק' לחזרה`;
  }
}

export function scoringHintEn(exercise: StrengthExercise): string {
  const perRep = exercise.unitsPerRep;
  switch (exercise.unit) {
    case 'seconds':
      return `Every ${perRep} seconds = 1 rep · ${exercise.level} pts per rep`;
    case 'meters':
      return `Every ${perRep} m = 1 rep · ${exercise.level} pts per rep`;
    default:
      return `${exercise.level} point${exercise.level > 1 ? 's' : ''} per rep`;
  }
}

export const UNIT_LABEL: Record<StrengthUnit, string> = {
  reps: 'reps',
  seconds: 'seconds',
  meters: 'metres',
};
