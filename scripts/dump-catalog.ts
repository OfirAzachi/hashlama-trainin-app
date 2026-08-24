/**
 * One-off dev script: prints the exercise/category catalog as SQL insert
 * statements, so supabase/schema.sql can seed reference data without hand
 * transcription. Not imported anywhere else — run with `npx tsx scripts/dump-catalog.ts`.
 */
import { ALL_CATEGORIES, ALL_EXERCISES } from '../lib/catalog';

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

const lines: string[] = [];

lines.push('-- Categories -----------------------------------------------------');
lines.push('insert into public.exercise_categories (id, catalog, name, name_en, description) values');
lines.push(
  ALL_CATEGORIES.map((category, index) => {
    const catalog =
      ['lower', 'push', 'back', 'core'].includes(category.id)
        ? 'strength'
        : ['cardio'].includes(category.id)
          ? 'endurance'
          : ['dynamic_stretch', 'pulse_raiser'].includes(category.id)
            ? 'warmup'
            : 'cooldown';
    const comma = index === ALL_CATEGORIES.length - 1 ? '' : ',';
    return `  (${sqlString(category.id)}, ${sqlString(catalog)}, ${sqlString(category.name)}, ${sqlString(category.nameEn)}, ${sqlString(category.description)})${comma}`;
  }).join('\n'),
);
lines.push('on conflict (id) do nothing;');
lines.push('');

lines.push('-- Exercises -------------------------------------------------------');
lines.push(
  'insert into public.strength_exercises (id, name, name_en, catalog, category, level, unit, units_per_rep, animation_key) values',
);
lines.push(
  ALL_EXERCISES.map((exercise, index) => {
    const comma = index === ALL_EXERCISES.length - 1 ? '' : ',';
    return `  (${sqlString(exercise.id)}, ${sqlString(exercise.name)}, ${sqlString(exercise.nameEn)}, ${sqlString(exercise.catalog)}, ${sqlString(exercise.category)}, ${exercise.level}, ${sqlString(exercise.unit)}, ${exercise.unitsPerRep}, ${sqlString(exercise.animation)})${comma}`;
  }).join('\n'),
);
lines.push('on conflict (id) do nothing;');

console.log(lines.join('\n'));
