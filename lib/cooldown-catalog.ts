/**
 * Cool-down catalogue — static stretches held after a training. Same points
 * mechanics as the rest of the app (points = reps x level; held stretches
 * score every 5 seconds as a rep), so cool-down rounds reuse the same
 * interval/points screen as everything else.
 */
import { withRealGif } from './strength-catalog';
import type {
  AnimationKey,
  CooldownCategoryId,
  StrengthCategory,
  StrengthExercise,
  StrengthLevel,
  StrengthUnit,
} from './strength-catalog';

export const COOLDOWN_CATEGORIES: StrengthCategory[] = [
  {
    id: 'stretch_lower',
    name: 'מתיחות פלג גוף תחתון',
    nameEn: 'Lower body stretches',
    description: 'ירכיים, ישבן ושוקיים — Hips, glutes and calves',
  },
  {
    id: 'stretch_upper',
    name: 'מתיחות פלג גוף עליון',
    nameEn: 'Upper body stretches',
    description: 'חזה, כתפיים וזרועות — Chest, shoulders and arms',
  },
  {
    id: 'stretch_back',
    name: 'מתיחות גב וליבה',
    nameEn: 'Back and core stretches',
    description: 'גב תחתון, גב עליון וליבה — Lower back, upper back and core',
  },
];

const e = (
  id: string,
  name: string,
  nameEn: string,
  category: CooldownCategoryId,
  level: StrengthLevel,
  animation: AnimationKey,
  unit: StrengthUnit = 'seconds',
  unitsPerRep?: number,
): StrengthExercise => ({
  id,
  name,
  nameEn,
  catalog: 'cooldown',
  category,
  level,
  unit,
  unitsPerRep: unitsPerRep ?? (unit === 'seconds' ? 5 : unit === 'meters' ? 2 : 1),
  animation,
  instructions: null,
  gif_url: null,
});

export const COOLDOWN_EXERCISES: StrengthExercise[] = [
  /* ------------------------------------- מתיחות פלג גוף תחתון */
  e('cool-low-1-quad', 'מתיחת ירך קדמית בעמידה', 'Standing Quad Stretch', 'stretch_lower', 1, 'wallsit'),
  e('cool-low-1-calf', 'מתיחת תאומים על קיר', 'Wall Calf Stretch', 'stretch_lower', 1, 'wallsit'),
  e('cool-low-2-hamstring', 'מתיחת ירך אחורית בישיבה', 'Seated Hamstring Stretch', 'stretch_lower', 2, 'plank'),
  e('cool-low-2-hip-flexor', 'מתיחת מפשעה בלאנג׳', 'Kneeling Hip Flexor Stretch', 'stretch_lower', 2, 'lunge'),
  e('cool-low-3-pigeon', 'תנוחת יונה למתיחת ישבן', 'Pigeon Pose', 'stretch_lower', 3, 'sideplank'),

  /* -------------------------------------- מתיחות פלג גוף עליון */
  e('cool-up-1-shoulder', 'מתיחת כתף חוצה גוף', 'Cross-body Shoulder Stretch', 'stretch_upper', 1, 'ytw'),
  e('cool-up-1-triceps', 'מתיחת יד אחורית מעל הראש', 'Overhead Triceps Stretch', 'stretch_upper', 1, 'ytw'),
  e('cool-up-2-chest', 'מתיחת חזה בפתח דלת', 'Doorway Chest Stretch', 'stretch_upper', 2, 'cobra'),
  e('cool-up-2-wrist', 'מתיחת אמות ופרקי כף יד', 'Wrist and Forearm Stretch', 'stretch_upper', 2, 'ytw'),

  /* ---------------------------------------- מתיחות גב וליבה */
  e('cool-back-1-child', 'תנוחת הילד', "Child's Pose", 'stretch_back', 1, 'cobra'),
  e('cool-back-1-cat', 'חתול-פרה סטטי', 'Static Cat-Cow', 'stretch_back', 1, 'cobra'),
  e('cool-back-2-knee-hug', 'חיבוק ברכיים לחזה', 'Knee-to-Chest Hug', 'stretch_back', 2, 'deadbug'),
  e('cool-back-3-spinal-twist', 'פיתול גב שכיבה', 'Supine Spinal Twist', 'stretch_back', 3, 'twist'),

  /* -------------------------------------- מתיחות צוואר (no dedicated catalogue yet — filed under upper body) */
  e('cool-up-3-neck-front-back', 'מתיחת צוואר קדימה ואחורה', 'Front and Back Neck Stretch', 'stretch_upper', 1, 'ytw'),
  e('cool-up-3-neck-side', 'מתיחת צוואר לצדדים', 'Side Neck Stretch', 'stretch_upper', 1, 'ytw'),
  e('cool-up-3-neck-rotation', 'סיבוב צוואר איטי', 'Slow Neck Rotation', 'stretch_upper', 2, 'ytw'),
].map(withRealGif);
