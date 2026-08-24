/**
 * Warm-up catalogue — dynamic stretching and pulse-raising movements meant to
 * open a training safely. Same points mechanics as the other catalogues
 * (points = reps x level), used mainly so warm-up rounds fit the same
 * interval/points screen as everything else.
 */
import type {
  AnimationKey,
  StrengthCategory,
  StrengthExercise,
  StrengthLevel,
  StrengthUnit,
  WarmupCategoryId,
} from './strength-catalog';

export const WARMUP_CATEGORIES: StrengthCategory[] = [
  {
    id: 'dynamic_stretch',
    name: 'מתיחות בתנועה',
    nameEn: 'Dynamic stretches',
    description: 'ניידות מפרקים ומתיחה תוך כדי תנועה — Mobility and stretch while moving',
  },
  {
    id: 'pulse_raiser',
    name: 'העלאת דופק',
    nameEn: 'Pulse raisers',
    description: 'תנועות קלות שמעלות דופק בהדרגה — Easy movements that gradually raise heart rate',
  },
];

const e = (
  id: string,
  name: string,
  nameEn: string,
  category: WarmupCategoryId,
  level: StrengthLevel,
  animation: AnimationKey,
  unit: StrengthUnit = 'reps',
  unitsPerRep?: number,
): StrengthExercise => ({
  id,
  name,
  nameEn,
  catalog: 'warmup',
  category,
  level,
  unit,
  unitsPerRep: unitsPerRep ?? (unit === 'seconds' ? 5 : unit === 'meters' ? 2 : 1),
  animation,
  gif_url: null,
});

export const WARMUP_EXERCISES: StrengthExercise[] = [
  /* ------------------------------------------- מתיחות בתנועה */
  e('warm-dyn-1-leg-swing', 'נדנוד רגליים קדימה ואחורה', 'Leg Swings', 'dynamic_stretch', 1, 'lunge'),
  e('warm-dyn-1-arm-circle', 'סיבובי זרועות', 'Arm Circles', 'dynamic_stretch', 1, 'ytw'),
  e('warm-dyn-1-torso-twist', 'סיבובי גו קלים', 'Torso Twists', 'dynamic_stretch', 1, 'twist'),
  e('warm-dyn-2-walking-lunge', 'לאנג׳ הליכה עם סיבוב', 'Walking Lunge with Twist', 'dynamic_stretch', 2, 'lunge'),
  e('warm-dyn-2-hip-circle', 'סיבובי ירך בעמידה', 'Hip Circles', 'dynamic_stretch', 2, 'twist'),
  e('warm-dyn-2-cat-cow', 'חתול-פרה בעמידה על ארבע', 'Cat-Cow', 'dynamic_stretch', 2, 'cobra'),
  e('warm-dyn-3-inchworm', 'אינצ׳וורם עד פלאנק', 'Inchworm to Plank', 'dynamic_stretch', 3, 'plank'),
  e('warm-dyn-3-world-greatest', 'המתיחה הטובה בעולם', "World's Greatest Stretch", 'dynamic_stretch', 3, 'lunge'),

  /* ------------------------------------------------ העלאת דופק */
  e('warm-pulse-1-march', 'צעידה קלה במקום', 'Easy Marching', 'pulse_raiser', 1, 'highknee'),
  e('warm-pulse-1-arm-swing', 'נפנוף ידיים בהליכה קלה', 'Arm Swings while Marching', 'pulse_raiser', 1, 'ytw'),
  e('warm-pulse-2-jumping-jack', 'ג׳אמפינג ג׳ק קל', 'Easy Jumping Jacks', 'pulse_raiser', 2, 'jumpingjack'),
  e('warm-pulse-2-high-knees', 'ברכיים גבוהות בקצב בינוני', 'High Knees', 'pulse_raiser', 2, 'highknee'),
  e('warm-pulse-3-skater', 'קפיצות סקייטר קלות', 'Light Skater Hops', 'pulse_raiser', 3, 'skater'),
];
