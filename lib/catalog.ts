/**
 * One entry point for every points-game catalogue.
 *
 * A points game (strength, endurance, warm-up or cool-down) is the same
 * machinery — intervals, levels, `points = reps x level`, an optional co-op
 * goal — pointed at a different list of exercises. Components ask this
 * module, never the individual catalogues, so adding another catalogue later
 * touches only this file.
 */
import { COOLDOWN_CATEGORIES, COOLDOWN_EXERCISES } from './cooldown-catalog';
import { ENDURANCE_CATEGORIES, ENDURANCE_EXERCISES } from './endurance-catalog';
import { WARMUP_CATEGORIES, WARMUP_EXERCISES } from './warmup-catalog';
import {
  CATEGORIES_BY_ID as STRENGTH_CATEGORIES_BY_ID,
  STRENGTH_CATEGORIES,
  STRENGTH_EXERCISES,
  type CategoryId,
  type StrengthCategory,
  type StrengthExercise,
  type StrengthLevel,
} from './strength-catalog';
import type { CatalogKind, PointsGameConfig } from './types';

export const ALL_EXERCISES: StrengthExercise[] = [
  ...STRENGTH_EXERCISES,
  ...ENDURANCE_EXERCISES,
  ...WARMUP_EXERCISES,
  ...COOLDOWN_EXERCISES,
];

export const ALL_CATEGORIES: StrengthCategory[] = [
  ...STRENGTH_CATEGORIES,
  ...ENDURANCE_CATEGORIES,
  ...WARMUP_CATEGORIES,
  ...COOLDOWN_CATEGORIES,
];

const BY_ID = new Map(ALL_EXERCISES.map((exercise) => [exercise.id, exercise]));
const CATEGORY_BY_ID = new Map(ALL_CATEGORIES.map((category) => [category.id, category]));

export interface CatalogMeta {
  kind: CatalogKind;
  /** Hebrew label for the game built on this catalogue. */
  label: string;
  /** One-line description shown in the builder. */
  blurb: string;
}

export const CATALOG_META: Record<CatalogKind, CatalogMeta> = {
  strength: {
    kind: 'strength',
    label: 'שרירים',
    blurb: 'תרגילי כוח משקל גוף — פלג גוף תחתון, דחיפה, גב וליבה.',
  },
  endurance: {
    kind: 'endurance',
    label: 'סיבולת אירובית',
    blurb: 'תרגילים שמעלים דופק ללא ריצה.',
  },
  warmup: {
    kind: 'warmup',
    label: 'חימום',
    blurb: 'מתיחות בתנועה והעלאת דופק הדרגתית לפני האימון.',
  },
  cooldown: {
    kind: 'cooldown',
    label: 'שחרור',
    blurb: 'מתיחות סטטיות לאחר האימון, לפי אזור בגוף.',
  },
};

const CATALOGUES: Record<CatalogKind, { exercises: StrengthExercise[]; categories: StrengthCategory[] }> = {
  strength: { exercises: STRENGTH_EXERCISES, categories: STRENGTH_CATEGORIES },
  endurance: { exercises: ENDURANCE_EXERCISES, categories: ENDURANCE_CATEGORIES },
  warmup: { exercises: WARMUP_EXERCISES, categories: WARMUP_CATEGORIES },
  cooldown: { exercises: COOLDOWN_EXERCISES, categories: COOLDOWN_CATEGORIES },
};

export function catalogExercises(kind: CatalogKind): StrengthExercise[] {
  return CATALOGUES[kind].exercises;
}

export function catalogCategories(kind: CatalogKind): StrengthCategory[] {
  return CATALOGUES[kind].categories;
}

/** Default categories a new game opens with. */
export function defaultCategories(kind: CatalogKind): CategoryId[] {
  return catalogCategories(kind).map((category) => category.id);
}

/**
 * Warm-up and cool-down have no participant choice and no levels: the
 * trainer picks the exact exercise for each round, and the athlete just
 * performs it. Strength and endurance stay "open" — a category per round,
 * with the participant picking their own exercise and level inside it.
 */
export function hasFixedExercises(kind: CatalogKind): boolean {
  return kind === 'warmup' || kind === 'cooldown';
}

/** How many rounds a points game has, whichever mode it's in. */
export function roundCount(config: Pick<PointsGameConfig, 'catalog' | 'round_categories' | 'round_exercise_ids'>): number {
  return hasFixedExercises(config.catalog)
    ? config.round_exercise_ids.length
    : config.round_categories.length;
}

/** Fills N rounds by cycling through a catalogue's exercises in order. */
export function cycleExercises(kind: CatalogKind, count: number): string[] {
  const exercises = catalogExercises(kind);
  return Array.from({ length: count }, (_, index) => exercises[index % exercises.length].id);
}

/** Looks an exercise up in any catalogue. */
export function findExercise(id: string): StrengthExercise | undefined {
  return BY_ID.get(id);
}

export function findCategory(id: CategoryId): StrengthCategory | undefined {
  return CATEGORY_BY_ID.get(id);
}

export function categoryName(id: CategoryId): string {
  return CATEGORY_BY_ID.get(id)?.name ?? String(id);
}

/** Exercises available in a game, after the trainer's category/level filters. */
export function availableExercises(
  kind: CatalogKind,
  categories: CategoryId[],
  levels: StrengthLevel[],
): StrengthExercise[] {
  return catalogExercises(kind).filter(
    (exercise) => categories.includes(exercise.category) && levels.includes(exercise.level),
  );
}

export { STRENGTH_CATEGORIES_BY_ID };
export type { CategoryId, StrengthCategory, StrengthExercise, StrengthLevel };
