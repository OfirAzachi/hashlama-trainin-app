/**
 * Exercise catalogue the trainer builds an aerobic weekly training from.
 * Picking a template pre-fills the metric type and a sensible prescription,
 * so building a week is choosing from a list rather than typing from scratch.
 */
import type { MetricType } from './types';

export interface ExerciseTemplate {
  id: string;
  /** Hebrew name shown in the UI. */
  name: string;
  metric_type: MetricType;
  /** Default prescription text, editable after it is added. */
  prescription: string;
  target_value: number | null;
  category: ExerciseCategory;
  /** Groups this template suits, used to hint the low-impact alternatives. */
  lowImpact: boolean;
}

/** Category keys stay English in code; the UI reads CATEGORY_LABELS. */
export type ExerciseCategory = 'running' | 'lowImpact' | 'strength' | 'core';

export const EXERCISE_CATEGORIES: ExerciseCategory[] = [
  'running',
  'lowImpact',
  'strength',
  'core',
];

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  running: 'ריצה',
  lowImpact: 'אירובי ללא זעזועים',
  strength: 'כוח',
  core: 'ליבה',
};

const t = (
  id: string,
  name: string,
  metric_type: MetricType,
  prescription: string,
  target_value: number | null,
  category: ExerciseCategory,
  lowImpact = false,
): ExerciseTemplate => ({ id, name, metric_type, prescription, target_value, category, lowImpact });

export const EXERCISE_LIBRARY: ExerciseTemplate[] = [
  // ריצה -------------------------------------------------------------
  t('run-800', 'אינטרוול 800 מ׳ (ממוצע)', 'time_seconds', '5 × 800 מ׳ בקצב 5 ק״מ, 90 שנ׳ ריצה קלה בין החזרות', 200, 'running'),
  t('run-400', 'חזרות 400 מ׳ (ממוצע)', 'time_seconds', '10 × 400 מ׳ בקצב מייל, 75 שנ׳ מנוחה', 92, 'running'),
  t('run-tempo', 'ריצת טמפו 5 ק״מ', 'time_seconds', '5 ק״מ רצוף בסף האנאירובי', 1450, 'running'),
  t('run-long', 'ריצה ארוכה', 'distance_meters', '60 דק׳ בקצב יציב ונוח לשיחה', 10500, 'running'),
  t('run-fartlek', 'פרטלק', 'distance_meters', '35 דק׳, 10 × דקה האצה', 7000, 'running'),
  t('run-hill', 'עליות (ממוצע)', 'time_seconds', '8 × 45 שנ׳ עלייה חזקה, ירידה בהליכה/ריצה קלה', 45, 'running'),
  t('run-tt', 'מבחן 3 ק״מ', 'time_seconds', '3 ק״מ מבוקר, כ-95% מאמץ', 880, 'running'),
  t('run-race', 'ריצה בקצב מטרה', 'distance_meters', '3 × 1 ק״מ בקצב היעד ל-3 ק״מ', 3000, 'running'),

  // אירובי ללא זעזועים ------------------------------------------------
  t('row-500', 'חתירה במכשיר', 'distance_meters', '4 × 500 מ׳, 2 דק׳ מנוחה', 2000, 'lowImpact', true),
  t('row-2k', 'מבחן חתירה 2000 מ׳', 'time_seconds', '2000 מ׳ חתירה, כ-95% מאמץ', 510, 'lowImpact', true),
  t('bike-steady', 'אופני עמידה (Assault Bike)', 'time_seconds', '20 דק׳ יציב, קצב 60-65', 1200, 'lowImpact', true),
  t('bike-sprint', 'ספרינטים באופניים', 'time_seconds', '10 × 30 שנ׳ חזק, 90 שנ׳ קל', 300, 'lowImpact', true),
  t('walk-incline', 'הליכה בשיפוע', 'time_seconds', '25 דק׳ בשיפוע 10%, 5.5 קמ״ש', 1500, 'lowImpact', true),
  t('swim-easy', 'שחייה', 'distance_meters', '20 × 50 מ׳ קל, 20 שנ׳ מנוחה', 1000, 'lowImpact', true),

  // כוח ---------------------------------------------------------------
  t('str-pushup', 'שכיבות סמיכה', 'reps', '4 × סט למקסימום, 60 שנ׳ מנוחה', 20, 'strength'),
  t('str-pushup-incline', 'שכיבות סמיכה בשיפוע חיובי', 'reps', '4 × סט על ספסל בגובה 60 ס״מ', 15, 'strength', true),
  t('str-pushup-vol', 'נפח שכיבות סמיכה', 'reps', 'סך החזרות ב-EMOM של 12 דק׳', 96, 'strength'),
  t('str-pullup', 'מתח', 'reps', '5 × סט למקסימום', 8, 'strength'),
  t('str-row', 'חתירה עם מוט', 'weight_kg', '4 × 8 ב-RPE 7', 55, 'strength'),
  t('str-bench', 'לחיצת חזה', 'weight_kg', '4 × 8 ב-RPE 7', 55, 'strength'),
  t('str-floor-press', 'לחיצה מהרצפה', 'weight_kg', '4 × 10 בטווח נטול כאב', 30, 'strength', true),
  t('str-squat', 'סקוואט עם מוט', 'weight_kg', '5 × 5 ב-RPE 8', 80, 'strength'),
  t('str-legpress', 'לחיצת רגליים', 'weight_kg', '4 × 10 בטווח נטול כאב', 110, 'strength', true),
  t('str-kb', 'הנפות קטלבל', 'weight_kg', '5 × 15 ב-RPE 7', 24, 'strength'),
  t('str-carry', 'נשיאת משקל', 'distance_meters', '4 × 40 מ׳ נשיאת חקלאי, 24 ק״ג ליד', 160, 'strength'),

  // ליבה --------------------------------------------------------------
  t('core-plank', 'פלאנק', 'time_seconds', '3 × החזקה למקסימום', 75, 'core'),
  t('core-deadbug', 'Dead Bug', 'reps', '3 × 12 לכל צד, מבוקר', 24, 'core', true),
  t('core-knee', 'הרמות ברכיים בתלייה', 'reps', '3 × 12', 36, 'core'),
  t('core-reverse', 'כיווץ בטן הפוך', 'reps', '3 × 15', 45, 'core', true),
  t('core-circuit', 'מעגל ליבה', 'time_seconds', '3 סבבים לזמן', 480, 'core'),
];

export function templatesByCategory(category: ExerciseCategory): ExerciseTemplate[] {
  return EXERCISE_LIBRARY.filter((template) => template.category === category);
}

/**
 * Suggested low-impact swap for a template, used when the trainer customises
 * the modified group's track.
 */
const SWAPS: Record<string, string> = {
  'run-800': 'row-500',
  'run-400': 'bike-sprint',
  'run-tempo': 'bike-steady',
  'run-long': 'walk-incline',
  'run-fartlek': 'row-500',
  'run-hill': 'walk-incline',
  'run-tt': 'row-2k',
  'run-race': 'row-2k',
  'str-pushup': 'str-pushup-incline',
  'str-pushup-vol': 'str-pushup-incline',
  'str-squat': 'str-legpress',
  'str-bench': 'str-floor-press',
  'core-knee': 'core-reverse',
  'core-plank': 'core-deadbug',
};

export function lowImpactAlternative(templateId: string): ExerciseTemplate | null {
  const swapId = SWAPS[templateId];
  return swapId ? EXERCISE_LIBRARY.find((template) => template.id === swapId) ?? null : null;
}
