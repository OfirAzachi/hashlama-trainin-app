/**
 * Strength ("muscles") catalogue for the points game.
 *
 * Scoring, straight from the programme:
 *   Points = Reps x Level
 *   Static holds: every 5 seconds counts as one rep.
 *   Bear crawl:   every 2 metres counts as one rep.
 *
 * Four movement categories (push / pull / legs / core), each with three
 * difficulty tiers — מתחיל (beginner), בינוני (intermediate) and מתקדם
 * (advanced) — mapped straight to levels 1-3.
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
export type StrengthLevel = 1 | 2 | 3;
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
  /** How to perform the movement — shown alongside the demo. Null for catalogues not yet written. */
  instructions: string | null;
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
  1: { name: 'רמה 1 — מתחיל', nameEn: 'Level 1 — Beginner' },
  2: { name: 'רמה 2 — בינוני', nameEn: 'Level 2 — Intermediate' },
  3: { name: 'רמה 3 — מתקדם', nameEn: 'Level 3 — Advanced' },
};

const e = (
  id: string,
  name: string,
  nameEn: string,
  category: StrengthCategoryId,
  level: StrengthLevel,
  animation: AnimationKey,
  instructions: string,
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
  instructions,
  gif_url: null,
});

/**
 * Real animated GIFs, matched against ExerciseDB's catalogue by numeric id
 * (see app/api/exercise-gif/[id]/route.ts for how the id resolves to an
 * actual GIF, fetched live through our own server — never bulk-downloaded
 * or re-hosted). Exercises without a confident match keep the built-in
 * stick-figure illustration — a wrong demo is worse than a generic one.
 */
export const REAL_GIF_IDS: Record<string, string> = {
  // push
  'push-1-kneeling-pushup': '3211',
  'push-1-incline-pushup': '0493',
  'push-1-floor-tricep-dip': '0814',
  'push-2-standard-pushup': '0662',
  'push-2-diamond-pushup': '0283',
  'push-2-pike-pushup': '3662',
  'push-3-decline-pushup': '0279',
  'push-3-single-arm-pushup': '0725',
  // back
  'back-1-back-extension': '0489',
  'back-1-scapular-pullup': '0688',
  'back-1-inverted-row-bent-knees': '2300',
  'back-2-inverted-row': '0499',
  'back-2-pullup': '0652',
  'back-2-chinup': '1326',
  'back-3-lpullup': '3418',
  // lower
  'lower-1-swimmer-kicks': '3433',
  'lower-1-bodyweight-squat': '1685',
  'lower-1-forward-lunge': '3470',
  'lower-2-walking-lunge': '1460',
  'lower-2-jump-squat': '0514',
  'lower-3-pistol-squat': '1759',
  // core
  'core-1-forearm-plank': '3665',
  'core-1-standard-crunch': '0274',
  'core-2-bicycle-crunch': '0262',
  'core-2-flutter-kicks': '0459',
  'core-3-vup': '0507',
  // cardio (endurance catalogue)
  'cardio-1-jumping-jacks': '3220',
  'cardio-1-quick-steps': '3672',
  'cardio-1-fast-half-squats': '3221',
  'cardio-1-wall-high-knees': '3636',
  'cardio-1-seal-jacks': '3224',
  'cardio-1-running-in-place': '0685',
  'cardio-1-fast-feet': '3656',
  'cardio-2-backward-broad-jump': '1473',
  'cardio-2-bear-crawl': '3360',
  'cardio-2-drop-squat': '3543',
  'cardio-2-cross-body-mountain-climber': '2466',
  'cardio-2-forward-broad-jump': '1472',
  'cardio-2-jump-squat': '0514',
  'cardio-2-mountain-climber': '0630',
  'cardio-2-sprinter-start': '3638',
  'cardio-2-scissor-jumps': '3219',
  'cardio-2-half-squat-jump': '3222',
  'cardio-2-skater-hops': '3361',
  'cardio-2-ski-jumps': '3671',
  'cardio-2-high-knee-walking-lunge': '3655',
  'cardio-2-high-knees-run': '3637',
  'cardio-2-speed-cross-body-crunch': '0262',
  'cardio-3-burpee': '1160',
  'cardio-3-jack-burpee': '0501',
  'cardio-3-tuck-jump': '0513',
  'cardio-3-jumping-lunges': '3582',
  'cardio-3-star-jump': '3223',
  'cardio-3-360-jump': '3318',
  'cardio-3-plyometric-pushup': '0492',
  'cardio-3-cardio-vup': '0507',
  // warm-up
  'warm-pulse-2-high-knees': '3636',
  'warm-pulse-2-jumping-jack': '3224',
  'warm-pulse-3-skater': '3361',
  // cool-down
  'cool-low-1-quad': '1512',
  'cool-low-1-calf': '1377',
  'cool-low-2-hamstring': '1511',
  'cool-up-1-shoulder': '1271',
  'cool-up-1-triceps': '0643',
  'cool-up-2-chest': '1167',
  'cool-up-2-wrist': '0721',
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
  e(
    'push-1-kneeling-pushup',
    'שכיבות סמיכה על הברכיים',
    'Kneeling Push-Up',
    'push',
    1,
    'pushup',
    'רדו לברכיים, ידיים ברוחב הכתפיים. הורידו את החזה לכיוון הרצפה תוך שמירה על גב ישר, ודחפו בחזרה למעלה.',
  ),
  e(
    'push-1-incline-pushup',
    'שכיבות סמיכה בשיפוע חיובי',
    'Incline Push-Up',
    'push',
    1,
    'wallpush',
    'הניחו ידיים על משטח מוגבה כמו ספסל. שמרו על גוף ישר מהראש עד העקבים תוך כיפוף וישור המרפקים.',
  ),
  e(
    'push-1-floor-tricep-dip',
    'פשיטת מרפקים על הרצפה',
    'Floor Tricep Dip',
    'push',
    1,
    'dip',
    'שבו על הרצפה עם ידיים מאחוריכם, אצבעות פונות קדימה. הרימו את הישבן והורידו אותו על ידי כיפוף המרפקים לאחור.',
  ),
  e(
    'push-2-standard-pushup',
    'שכיבות סמיכה קלאסיות',
    'Standard Push-Up',
    'push',
    2,
    'pushup',
    'תנוחת פלאנק גבוהה, ידיים מעט רחבות מהכתפיים. הורידו את הגוף כיחידה אחת ודחפו בחזרה למעלה.',
  ),
  e(
    'push-2-diamond-pushup',
    'שכיבות סמיכה יהלום',
    'Diamond Push-Up',
    'push',
    2,
    'pushup',
    'הניחו את הידיים קרובות זו לזו מתחת לחזה ביצירת צורת יהלום, ובצעו שכיבת סמיכה תוך שמירת המרפקים צמודים לגוף.',
  ),
  e(
    'push-2-pike-pushup',
    'שכיבות סמיכה בתנוחת דוב',
    'Pike Push-Up',
    'push',
    2,
    'pike',
    'הרימו את המותניים למעלה ליצירת V הפוך, והורידו את הראש לכיוון הרצפה על ידי כיפוף המרפקים.',
  ),
  e(
    'push-3-decline-pushup',
    'שכיבות סמיכה בשיפוע שלילי',
    'Decline Push-Up',
    'push',
    3,
    'pushup',
    'הניחו את כפות הרגליים על משטח מוגבה וידיים על הרצפה, ובצעו שכיבת סמיכה תוך שמירה על גב ישר.',
  ),
  e(
    'push-3-single-arm-pushup',
    'שכיבות סמיכה ביד אחת',
    'Single Arm Push-Up',
    'push',
    3,
    'pushup',
    'פשקו את הרגליים לייצוב, הניחו יד אחת מאחורי הגב, ובצעו שכיבת סמיכה מלאה ביד הנותרת בלבד.',
  ),

  /* ================================== 2. גב (Pull) ================================== */
  e(
    'back-1-back-extension',
    'הרמות גב על הבטן',
    'Back Extension',
    'back',
    1,
    'cobra',
    'שכבו על הבטן עם ידיים לצד הראש. הרימו את פלג הגוף העליון מהרצפה תוך שמירה על צוואר ניטרלי, וחזרו למטה באיטיות.',
  ),
  e(
    'back-1-scapular-pullup',
    'מתח שכמות',
    'Scapular Pull-Up',
    'back',
    1,
    'ytw',
    'היתלו על המתח בזרועות ישרות. ללא כיפוף מרפקים, משכו את השכמות למטה ופנימה להרמה קלה של הגוף.',
  ),
  e(
    'back-1-inverted-row-bent-knees',
    'חתירה אוסטרלית בברכיים כפופות',
    'Inverted Row (Bent Knees)',
    'back',
    1,
    'ytw',
    'שכבו מתחת למוט נמוך, ברכיים כפופות ורגליים על הרצפה. משכו את החזה לכיוון המוט על ידי כיווץ השכמות.',
  ),
  e(
    'back-2-inverted-row',
    'חתירה אוסטרלית מלאה',
    'Inverted Row',
    'back',
    2,
    'ytw',
    'שכבו מתחת למוט עם רגליים ישרות ליצירת קו ישר מהראש לעקבים. משכו את החזה לכיוון המוט וחזרו למטה בשליטה.',
  ),
  e(
    'back-2-pullup',
    'מתח באחיזה עילית',
    'Pull-Up',
    'back',
    2,
    'ytw',
    'היתלו על מוט מתח באחיזה רחבה מעט מהכתפיים. משכו את הגוף למעלה עד שהסנטר עובר את המוט, וחזרו למטה בשליטה.',
  ),
  e(
    'back-2-chinup',
    'מתח באחיזה תחתית',
    'Chin-Up',
    'back',
    2,
    'ytw',
    'היתלו על מוט מתח עם כפות ידיים פונות אליכם. משכו את הגוף למעלה תוך כיווץ הגב והיד הקדמית.',
  ),
  e(
    'back-3-lpullup',
    'מתח L-Sit',
    'L-Pull-Up',
    'back',
    3,
    'ytw',
    'היתלו על המתח והרימו את הרגליים ישר קדימה בזווית 90 מעלות. שמרו על הרגליים באוויר לאורך כל עליית המתח.',
  ),

  /* ================================== 3. רגליים (Legs) ================================== */
  e(
    'lower-1-swimmer-kicks',
    'בעיטות שחיין',
    'Swimmer Kicks',
    'lower',
    1,
    'birddog',
    'שכבו על הבטן עם ידיים מושטות קדימה. הרימו חזה ורגליים יחד ובצעו בעיטות רפרוף מהירות.',
  ),
  e(
    'lower-1-bodyweight-squat',
    'סקוואט משקל גוף',
    'Bodyweight Squat',
    'lower',
    1,
    'squat',
    'עמדו ברוחב הכתפיים. הורידו את הישבן לאחור ולמטה תוך שמירה על גב ישר, וחזרו לעמידה.',
  ),
  e(
    'lower-1-forward-lunge',
    'מכרע קדימה',
    'Forward Lunge',
    'lower',
    1,
    'lunge',
    'צעדו צעד גדול קדימה וכופפו את שתי הברכיים ל-90 מעלות. דחפו חזרה לעמידה והחליפו רגליים.',
  ),
  e(
    'lower-2-walking-lunge',
    'מכרעים בהליכה',
    'Walking Lunge',
    'lower',
    2,
    'lunge',
    'בצעו מכרע קדימה, ובמקום לחזור אחורה המשיכו קדימה לצעד מכרע נוסף ברגל השנייה.',
  ),
  e(
    'lower-2-jump-squat',
    'סקוואט בקפיצה',
    'Jump Squat',
    'lower',
    2,
    'jumpsquat',
    'רדו לסקוואט וקפצו למעלה בפיצוץ כוח. נחתו רך בחזרה לתוך הסקוואט הבא.',
  ),
  e(
    'lower-3-pistol-squat',
    'סקוואט אקדח',
    'Pistol Squat',
    'lower',
    3,
    'squat',
    'עמדו על רגל אחת עם השנייה מושטת קדימה. רדו לסקוואט עמוק ככל הניתן על הרגל התומכת וחזרו למעלה.',
  ),

  /* ================================ 4. ליבה ובטן (Core & Abs) ================================ */
  e(
    'core-1-forearm-plank',
    'פלאנק על האמות',
    'Forearm Plank',
    'core',
    1,
    'plank',
    'השענו על האמות עם גוף ישר מהראש לעקבים. כווצו בטן וישבן והחזיקו את התנוחה.',
    'seconds',
  ),
  e(
    'core-1-standard-crunch',
    'כפיפות בטן קלאסיות',
    'Standard Crunch',
    'core',
    1,
    'crunch',
    'שכבו על הגב עם ברכיים כפופות. הרימו את השכמות מהרצפה תוך כיווץ הבטן, וחזרו למטה באיטיות.',
  ),
  e(
    'core-2-bicycle-crunch',
    'כפיפות בטן אופניים',
    'Bicycle Crunch',
    'core',
    2,
    'twist',
    'שכבו על הגב עם ידיים מאחורי הראש. קרבו מרפק למול ברך נגדית לסירוגין תוך יישור הרגל השנייה.',
  ),
  e(
    'core-2-flutter-kicks',
    'בעיטות מספריים',
    'Flutter Kicks',
    'core',
    2,
    'legraise',
    'שכבו על הגב עם רגליים ישרות מורמות מעט מהרצפה. בצעו בעיטות רפרוף קטנות ומהירות לסירוגין.',
  ),
  e(
    'core-3-vup',
    'V-Ups',
    'V-Up',
    'core',
    3,
    'crunch',
    'שכבו ישר על הגב עם ידיים מעל הראש. הרימו רגליים וידיים בו-זמנית למפגש מעל הבטן ביצירת צורת V.',
  ),
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
