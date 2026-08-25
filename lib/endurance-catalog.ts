import { withRealGif } from './strength-catalog';
import type {
  AnimationKey,
  EnduranceCategoryId,
  StrengthCategory,
  StrengthExercise,
  StrengthLevel,
  StrengthUnit,
} from './strength-catalog';

export const ENDURANCE_CATEGORIES: StrengthCategory[] = [
  {
    id: 'cardio',
    name: 'אירובי ללא ריצה',
    nameEn: 'Cardio (no running)',
    description: 'העלאת דופק ללא ריצה — Heart-rate work without running',
  },
];

const e = (
  id: string,
  name: string,
  nameEn: string,
  category: EnduranceCategoryId,
  level: StrengthLevel,
  animation: AnimationKey,
  unit: StrengthUnit = 'reps',
): StrengthExercise => ({
  id,
  name,
  nameEn,
  catalog: 'endurance',
  category,
  level,
  unit,
  unitsPerRep: unit === 'seconds' ? 5 : unit === 'meters' ? 2 : 1,
  animation,
  gif_url: null,
});

export const ENDURANCE_EXERCISES: StrengthExercise[] = [
  /* ============================ אירובי ללא ריצה (Cardio, no running) ============================ */
  // רמה 1 — בסיסי מאוד
  e('cardio-1-marching', 'צעידה מתונה במקום', 'Moderate Marching in Place', 'cardio', 1, 'highknee', 'seconds'),
  e('cardio-1-step-touch', 'Step-Touch (צעד הצידה ונגיעה) ללא קפיצות', 'Step-Touch (No Hop)', 'cardio', 1, 'stepup', 'seconds'),
  e('cardio-1-slow-knee-raise', 'הרמת ברך לגובה האגן לסירוגין בקצב איטי', 'Slow Alternating Knee Raise', 'cardio', 1, 'highknee', 'seconds'),
  e('cardio-1-step-jacks', 'פתיחת ידיים ורגליים לסירוגין ללא ניתור (Step-Jacks)', 'Step-Jacks', 'cardio', 1, 'jumpingjack', 'seconds'),
  e('cardio-1-slow-shadow-box', 'איגרוף איטי באוויר בעמידה יציבה', 'Slow Shadow Boxing', 'cardio', 1, 'ytw', 'seconds'),
  // רמה 2 — מתחיל
  e('cardio-2-jumping-jacks', 'Jumping Jacks בקצב אחיד', 'Steady-Pace Jumping Jacks', 'cardio', 2, 'jumpingjack', 'seconds'),
  e('cardio-2-skaters-no-hop', 'צעדי החלקה מצד לצד (Skaters ללא ניתור)', 'Skaters (No Hop)', 'cardio', 2, 'skater', 'seconds'),
  e('cardio-2-low-stepups', 'Step-ups על מדרגה נמוכה', 'Low Step-ups', 'cardio', 2, 'stepup', 'seconds'),
  e('cardio-2-shadow-box', 'צל-איגרוף (Shadow Boxing) בקצב מתון', 'Shadow Boxing (Moderate)', 'cardio', 2, 'ytw', 'seconds'),
  e('cardio-2-standing-knee-raise', 'הרמות ברכיים לסירוגין בעמידה', 'Alternating Standing Knee Raises', 'cardio', 2, 'highknee', 'seconds'),
  // רמה 3 — בינוני
  e('cardio-3-rope-single', 'קפיצה על חבל (Single Unders)', 'Jump Rope — Single Unders', 'cardio', 3, 'rope', 'seconds'),
  e('cardio-3-fast-mountain-climber', 'Mountain Climbers מהירים', 'Fast Mountain Climbers', 'cardio', 3, 'climber', 'seconds'),
  e('cardio-3-wide-skaters', 'Skaters עם ניתור רחב', 'Wide-Hop Skaters', 'cardio', 3, 'skater', 'seconds'),
  e('cardio-3-sprawls', 'Burpees ללא שכיבת סמיכה (Sprawls)', 'Sprawls', 'cardio', 3, 'burpee', 'seconds'),
  e('cardio-3-high-knees', 'High Knees במקום', 'High Knees in Place', 'cardio', 3, 'highknee', 'seconds'),
  // רמה 4 — מתקדם
  e('cardio-4-burpees', 'Burpees מלאים (שכיבת סמיכה וניתור לגובה)', 'Full Burpees', 'cardio', 4, 'burpee', 'seconds'),
  e('cardio-4-rope-double', 'קפיצה על חבל בקפיצות כפולות (Double Unders)', 'Jump Rope — Double Unders', 'cardio', 4, 'rope', 'seconds'),
  e('cardio-4-tuck-jumps', 'Tuck Jumps (קפיצות ברכיים לחזה)', 'Tuck Jumps', 'cardio', 4, 'jumpsquat', 'seconds'),
  e('cardio-4-squat-thrusts', 'Squat Thrusts מתפרצים', 'Explosive Squat Thrusts', 'cardio', 4, 'burpee', 'seconds'),
  e('cardio-4-bear-crawl-fast', 'Bear Crawl מהיר קדימה-אחורה', 'Fast Bear Crawl', 'cardio', 4, 'crawl', 'meters'),
].map(withRealGif);
