-- Adds 4 new back/spine exercises to the strength catalogue (Superman,
-- Lower Back Curl, Inverted Row on Bench, Back Lever), with real GIFs
-- matched by ExerciseDB id. Two exercises from the same source JSON
-- (Back Extension, Inverted Row Bent Knees) already exist under matching
-- gif ids and are left untouched; Swimmer Kicks already exists under the
-- legs category with the same gif id, so it's not duplicated under back.
insert into public.strength_exercises (id, name, name_en, catalog, category, level, unit, units_per_rep, animation_key) values
  ('back-1-superman', 'סופרמן', 'Superman', 'strength', 'back', 1, 'reps', 1, 'cobra'),
  ('back-2-lower-back-curl', 'כפיפת גב תחתון', 'Lower Back Curl', 'strength', 'back', 2, 'reps', 1, 'bridge'),
  ('back-2-inverted-row-bench', 'חתירה אוסטרלית על ספסל', 'Inverted Row on Bench', 'strength', 'back', 2, 'reps', 1, 'ytw'),
  ('back-3-back-lever', 'מנוף גב', 'Back Lever', 'strength', 'back', 3, 'reps', 1, 'ytw')
on conflict (id) do nothing;
