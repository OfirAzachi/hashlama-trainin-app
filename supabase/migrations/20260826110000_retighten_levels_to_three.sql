-- The catalogue moved back from 4 difficulty tiers to 3 (מתחיל / בינוני /
-- מתקדם), matching a full rewrite of the exercise lists. No real
-- strength_logs rows exist at level 4, so that table is safe to re-tighten
-- directly. strength_exercises is a static reference seed the app never
-- actually reads (see scripts/dump-catalog.ts) — it still has the old,
-- now-replaced exercise rows (some at level 4), so it's cleared here rather
-- than left stale and mismatched with the real catalogue in code.
--
-- strength_logs.exercise_id has a not-null FK into strength_exercises(id)
-- with no cascade, so a bare truncate of strength_exercises would be
-- rejected by Postgres while that FK exists. strength_logs is confirmed
-- empty (0 rows), so it's included in the same truncate statement.
truncate table public.strength_exercises, public.strength_logs;

alter table public.strength_exercises drop constraint if exists strength_exercises_level_check;
alter table public.strength_exercises add constraint strength_exercises_level_check
  check (level between 1 and 3);

alter table public.strength_logs drop constraint if exists strength_logs_level_check;
alter table public.strength_logs add constraint strength_logs_level_check
  check (level between 1 and 3);

alter table public.strength_configs alter column allowed_levels set default '{1,2,3}';

-- Re-seed exercise_categories and strength_exercises to match the rewritten
-- catalogues in lib/*-catalog.ts (generated via scripts/dump-catalog.ts).
insert into public.exercise_categories (id, catalog, name, name_en, description) values
  ('push', 'strength', 'חזה, כתפיים ויד אחורית', 'Chest, shoulders & triceps (push)', 'תרגילי דחיפה — Push movements'),
  ('back', 'strength', 'גב', 'Back (pull)', 'תרגילי משיכה — Pull movements'),
  ('lower', 'strength', 'רגליים', 'Legs', 'רגליים וישבן — Legs and glutes'),
  ('core', 'strength', 'ליבה ובטן', 'Core and abs', 'יציבות ליבה — Trunk stability and abs'),
  ('cardio', 'endurance', 'אירובי', 'Cardio', 'העלאת דופק — Heart-rate work'),
  ('dynamic_stretch', 'warmup', 'מתיחות בתנועה', 'Dynamic stretches', 'ניידות מפרקים ומתיחה תוך כדי תנועה — Mobility and stretch while moving'),
  ('pulse_raiser', 'warmup', 'העלאת דופק', 'Pulse raisers', 'תנועות קלות שמעלות דופק בהדרגה — Easy movements that gradually raise heart rate'),
  ('stretch_lower', 'cooldown', 'מתיחות פלג גוף תחתון', 'Lower body stretches', 'ירכיים, ישבן ושוקיים — Hips, glutes and calves'),
  ('stretch_upper', 'cooldown', 'מתיחות פלג גוף עליון', 'Upper body stretches', 'חזה, כתפיים וזרועות — Chest, shoulders and arms'),
  ('stretch_back', 'cooldown', 'מתיחות גב וליבה', 'Back and core stretches', 'גב תחתון, גב עליון וליבה — Lower back, upper back and core')
on conflict (id) do nothing;

insert into public.strength_exercises (id, name, name_en, catalog, category, level, unit, units_per_rep, animation_key) values
  ('push-1-kneeling-pushup', 'שכיבות סמיכה על הברכיים', 'Kneeling Push-Up', 'strength', 'push', 1, 'reps', 1, 'pushup'),
  ('push-1-incline-pushup', 'שכיבות סמיכה בשיפוע חיובי', 'Incline Push-Up', 'strength', 'push', 1, 'reps', 1, 'wallpush'),
  ('push-1-floor-tricep-dip', 'פשיטת מרפקים על הרצפה', 'Floor Tricep Dip', 'strength', 'push', 1, 'reps', 1, 'dip'),
  ('push-2-standard-pushup', 'שכיבות סמיכה קלאסיות', 'Standard Push-Up', 'strength', 'push', 2, 'reps', 1, 'pushup'),
  ('push-2-diamond-pushup', 'שכיבות סמיכה יהלום', 'Diamond Push-Up', 'strength', 'push', 2, 'reps', 1, 'pushup'),
  ('push-2-pike-pushup', 'שכיבות סמיכה בתנוחת דוב', 'Pike Push-Up', 'strength', 'push', 2, 'reps', 1, 'pike'),
  ('push-3-decline-pushup', 'שכיבות סמיכה בשיפוע שלילי', 'Decline Push-Up', 'strength', 'push', 3, 'reps', 1, 'pushup'),
  ('push-3-single-arm-pushup', 'שכיבות סמיכה ביד אחת', 'Single Arm Push-Up', 'strength', 'push', 3, 'reps', 1, 'pushup'),
  ('back-1-back-extension', 'הרמות גב על הבטן', 'Back Extension', 'strength', 'back', 1, 'reps', 1, 'cobra'),
  ('back-1-scapular-pullup', 'מתח שכמות', 'Scapular Pull-Up', 'strength', 'back', 1, 'reps', 1, 'ytw'),
  ('back-1-inverted-row-bent-knees', 'חתירה אוסטרלית בברכיים כפופות', 'Inverted Row (Bent Knees)', 'strength', 'back', 1, 'reps', 1, 'ytw'),
  ('back-2-inverted-row', 'חתירה אוסטרלית מלאה', 'Inverted Row', 'strength', 'back', 2, 'reps', 1, 'ytw'),
  ('back-2-pullup', 'מתח באחיזה עילית', 'Pull-Up', 'strength', 'back', 2, 'reps', 1, 'ytw'),
  ('back-2-chinup', 'מתח באחיזה תחתית', 'Chin-Up', 'strength', 'back', 2, 'reps', 1, 'ytw'),
  ('back-3-lpullup', 'מתח L-Sit', 'L-Pull-Up', 'strength', 'back', 3, 'reps', 1, 'ytw'),
  ('lower-1-swimmer-kicks', 'בעיטות שחיין', 'Swimmer Kicks', 'strength', 'lower', 1, 'reps', 1, 'birddog'),
  ('lower-1-bodyweight-squat', 'סקוואט משקל גוף', 'Bodyweight Squat', 'strength', 'lower', 1, 'reps', 1, 'squat'),
  ('lower-1-forward-lunge', 'מכרע קדימה', 'Forward Lunge', 'strength', 'lower', 1, 'reps', 1, 'lunge'),
  ('lower-2-walking-lunge', 'מכרעים בהליכה', 'Walking Lunge', 'strength', 'lower', 2, 'reps', 1, 'lunge'),
  ('lower-2-jump-squat', 'סקוואט בקפיצה', 'Jump Squat', 'strength', 'lower', 2, 'reps', 1, 'jumpsquat'),
  ('lower-3-pistol-squat', 'סקוואט אקדח', 'Pistol Squat', 'strength', 'lower', 3, 'reps', 1, 'squat'),
  ('core-1-forearm-plank', 'פלאנק על האמות', 'Forearm Plank', 'strength', 'core', 1, 'seconds', 5, 'plank'),
  ('core-1-standard-crunch', 'כפיפות בטן קלאסיות', 'Standard Crunch', 'strength', 'core', 1, 'reps', 1, 'crunch'),
  ('core-2-bicycle-crunch', 'כפיפות בטן אופניים', 'Bicycle Crunch', 'strength', 'core', 2, 'reps', 1, 'twist'),
  ('core-2-flutter-kicks', 'בעיטות מספריים', 'Flutter Kicks', 'strength', 'core', 2, 'reps', 1, 'legraise'),
  ('core-3-vup', 'V-Ups', 'V-Up', 'strength', 'core', 3, 'reps', 1, 'crunch'),
  ('cardio-1-jumping-jacks', 'קפיצות פישוק', 'Jumping Jacks', 'endurance', 'cardio', 1, 'seconds', 5, 'jumpingjack'),
  ('cardio-1-quick-steps', 'צעדים מהירים במקום', 'Quick Steps', 'endurance', 'cardio', 1, 'seconds', 5, 'stepup'),
  ('cardio-1-fast-half-squats', 'חצאי סקוואט מהירים', 'Fast Half Squats', 'endurance', 'cardio', 1, 'seconds', 5, 'squat'),
  ('cardio-1-wall-high-knees', 'הרמות ברכיים מול קיר', 'Wall High Knees', 'endurance', 'cardio', 1, 'seconds', 5, 'highknee'),
  ('cardio-1-seal-jacks', 'פישוק ידיים', 'Seal Jacks', 'endurance', 'cardio', 1, 'seconds', 5, 'jumpingjack'),
  ('cardio-1-running-in-place', 'ריצה במקום', 'Running in Place', 'endurance', 'cardio', 1, 'seconds', 5, 'highknee'),
  ('cardio-1-fast-feet', 'רגליים מהירות', 'Fast Feet', 'endurance', 'cardio', 1, 'seconds', 5, 'highknee'),
  ('cardio-2-backward-broad-jump', 'קפיצת רוחק לאחור', 'Backward Broad Jump', 'endurance', 'cardio', 2, 'seconds', 5, 'jumpsquat'),
  ('cardio-2-bear-crawl', 'זחילת דוב', 'Bear Crawl', 'endurance', 'cardio', 2, 'meters', 2, 'crawl'),
  ('cardio-2-drop-squat', 'נפילה לסקוואט', 'Drop Squat', 'endurance', 'cardio', 2, 'seconds', 5, 'jumpsquat'),
  ('cardio-2-cross-body-mountain-climber', 'טיפוס הרים אלכסוני', 'Cross Body Mountain Climber', 'endurance', 'cardio', 2, 'seconds', 5, 'climber'),
  ('cardio-2-forward-broad-jump', 'קפיצת רוחק קדימה', 'Forward Broad Jump', 'endurance', 'cardio', 2, 'seconds', 5, 'jumpsquat'),
  ('cardio-2-jump-squat', 'סקוואט בקפיצה', 'Jump Squat', 'endurance', 'cardio', 2, 'seconds', 5, 'jumpsquat'),
  ('cardio-2-mountain-climber', 'טיפוס הרים', 'Mountain Climber', 'endurance', 'cardio', 2, 'seconds', 5, 'climber'),
  ('cardio-2-sprinter-start', 'זינוק אצן', 'Sprinter Start', 'endurance', 'cardio', 2, 'seconds', 5, 'highknee'),
  ('cardio-2-scissor-jumps', 'קפיצות מספריים', 'Scissor Jumps', 'endurance', 'cardio', 2, 'seconds', 5, 'jumpsquat'),
  ('cardio-2-half-squat-jump', 'קפיצה מחצי סקוואט', 'Half Squat Jump', 'endurance', 'cardio', 2, 'seconds', 5, 'jumpsquat'),
  ('cardio-2-skater-hops', 'קפיצות סקייטר', 'Skater Hops', 'endurance', 'cardio', 2, 'seconds', 5, 'skater'),
  ('cardio-2-ski-jumps', 'קפיצות סקי', 'Ski Jumps', 'endurance', 'cardio', 2, 'seconds', 5, 'jumpsquat'),
  ('cardio-2-high-knee-walking-lunge', 'מכרעים בהליכה עם ברך גבוהה', 'High Knee Walking Lunge', 'endurance', 'cardio', 2, 'seconds', 5, 'lunge'),
  ('cardio-2-high-knees-run', 'ריצה עם ברכיים גבוהות', 'High Knees Run', 'endurance', 'cardio', 2, 'seconds', 5, 'highknee'),
  ('cardio-2-speed-cross-body-crunch', 'כפיפות בטן אלכסוניות מהירות', 'Speed Cross Body Crunch', 'endurance', 'cardio', 2, 'seconds', 5, 'twist'),
  ('cardio-3-burpee', 'ברפי מלא', 'Burpee', 'endurance', 'cardio', 3, 'seconds', 5, 'burpee'),
  ('cardio-3-jack-burpee', 'ברפי עם פישוק', 'Jack Burpee', 'endurance', 'cardio', 3, 'seconds', 5, 'burpee'),
  ('cardio-3-tuck-jump', 'קפיצת קיפול ברכיים', 'Tuck Jump', 'endurance', 'cardio', 3, 'seconds', 5, 'jumpsquat'),
  ('cardio-3-jumping-lunges', 'מכרעים בקפיצה', 'Jumping Lunges', 'endurance', 'cardio', 3, 'seconds', 5, 'jumpsquat'),
  ('cardio-3-star-jump', 'קפיצת כוכב', 'Star Jump', 'endurance', 'cardio', 3, 'seconds', 5, 'jumpingjack'),
  ('cardio-3-360-jump', 'קפיצת סיבוב 360', '360 Jump', 'endurance', 'cardio', 3, 'seconds', 5, 'jumpsquat'),
  ('cardio-3-plyometric-pushup', 'שכיבת סמיכה מתפרצת', 'Plyometric Push-Up', 'endurance', 'cardio', 3, 'seconds', 5, 'pushup'),
  ('cardio-3-cardio-vup', 'V-Up מהיר', 'Cardio V-Up', 'endurance', 'cardio', 3, 'seconds', 5, 'crunch'),
  ('warm-dyn-1-leg-swing', 'נדנוד רגליים קדימה ואחורה', 'Leg Swings', 'warmup', 'dynamic_stretch', 1, 'reps', 1, 'lunge'),
  ('warm-dyn-1-arm-circle', 'סיבובי זרועות', 'Arm Circles', 'warmup', 'dynamic_stretch', 1, 'reps', 1, 'ytw'),
  ('warm-dyn-1-torso-twist', 'סיבובי גו קלים', 'Torso Twists', 'warmup', 'dynamic_stretch', 1, 'reps', 1, 'twist'),
  ('warm-dyn-2-walking-lunge', 'לאנג׳ הליכה עם סיבוב', 'Walking Lunge with Twist', 'warmup', 'dynamic_stretch', 2, 'reps', 1, 'lunge'),
  ('warm-dyn-2-hip-circle', 'סיבובי ירך בעמידה', 'Hip Circles', 'warmup', 'dynamic_stretch', 2, 'reps', 1, 'twist'),
  ('warm-dyn-2-cat-cow', 'חתול-פרה בעמידה על ארבע', 'Cat-Cow', 'warmup', 'dynamic_stretch', 2, 'reps', 1, 'cobra'),
  ('warm-dyn-3-inchworm', 'אינצ׳וורם עד פלאנק', 'Inchworm to Plank', 'warmup', 'dynamic_stretch', 3, 'reps', 1, 'plank'),
  ('warm-dyn-3-world-greatest', 'המתיחה הטובה בעולם', 'World''s Greatest Stretch', 'warmup', 'dynamic_stretch', 3, 'reps', 1, 'lunge'),
  ('warm-pulse-1-march', 'צעידה קלה במקום', 'Easy Marching', 'warmup', 'pulse_raiser', 1, 'reps', 1, 'highknee'),
  ('warm-pulse-1-arm-swing', 'נפנוף ידיים בהליכה קלה', 'Arm Swings while Marching', 'warmup', 'pulse_raiser', 1, 'reps', 1, 'ytw'),
  ('warm-pulse-2-jumping-jack', 'ג׳אמפינג ג׳ק קל', 'Easy Jumping Jacks', 'warmup', 'pulse_raiser', 2, 'reps', 1, 'jumpingjack'),
  ('warm-pulse-2-high-knees', 'ברכיים גבוהות בקצב בינוני', 'High Knees', 'warmup', 'pulse_raiser', 2, 'reps', 1, 'highknee'),
  ('warm-pulse-3-skater', 'קפיצות סקייטר קלות', 'Light Skater Hops', 'warmup', 'pulse_raiser', 3, 'reps', 1, 'skater'),
  ('cool-low-1-quad', 'מתיחת ירך קדמית בעמידה', 'Standing Quad Stretch', 'cooldown', 'stretch_lower', 1, 'seconds', 5, 'wallsit'),
  ('cool-low-1-calf', 'מתיחת תאומים על קיר', 'Wall Calf Stretch', 'cooldown', 'stretch_lower', 1, 'seconds', 5, 'wallsit'),
  ('cool-low-2-hamstring', 'מתיחת ירך אחורית בישיבה', 'Seated Hamstring Stretch', 'cooldown', 'stretch_lower', 2, 'seconds', 5, 'plank'),
  ('cool-low-2-hip-flexor', 'מתיחת מפשעה בלאנג׳', 'Kneeling Hip Flexor Stretch', 'cooldown', 'stretch_lower', 2, 'seconds', 5, 'lunge'),
  ('cool-low-3-pigeon', 'תנוחת יונה למתיחת ישבן', 'Pigeon Pose', 'cooldown', 'stretch_lower', 3, 'seconds', 5, 'sideplank'),
  ('cool-up-1-shoulder', 'מתיחת כתף חוצה גוף', 'Cross-body Shoulder Stretch', 'cooldown', 'stretch_upper', 1, 'seconds', 5, 'ytw'),
  ('cool-up-1-triceps', 'מתיחת יד אחורית מעל הראש', 'Overhead Triceps Stretch', 'cooldown', 'stretch_upper', 1, 'seconds', 5, 'ytw'),
  ('cool-up-2-chest', 'מתיחת חזה בפתח דלת', 'Doorway Chest Stretch', 'cooldown', 'stretch_upper', 2, 'seconds', 5, 'cobra'),
  ('cool-up-2-wrist', 'מתיחת אמות ופרקי כף יד', 'Wrist and Forearm Stretch', 'cooldown', 'stretch_upper', 2, 'seconds', 5, 'ytw'),
  ('cool-back-1-child', 'תנוחת הילד', 'Child''s Pose', 'cooldown', 'stretch_back', 1, 'seconds', 5, 'cobra'),
  ('cool-back-1-cat', 'חתול-פרה סטטי', 'Static Cat-Cow', 'cooldown', 'stretch_back', 1, 'seconds', 5, 'cobra'),
  ('cool-back-2-knee-hug', 'חיבוק ברכיים לחזה', 'Knee-to-Chest Hug', 'cooldown', 'stretch_back', 2, 'seconds', 5, 'deadbug'),
  ('cool-back-3-spinal-twist', 'פיתול גב שכיבה', 'Supine Spinal Twist', 'cooldown', 'stretch_back', 3, 'seconds', 5, 'twist'),
  ('cool-up-3-neck-front-back', 'מתיחת צוואר קדימה ואחורה', 'Front and Back Neck Stretch', 'cooldown', 'stretch_upper', 1, 'seconds', 5, 'ytw'),
  ('cool-up-3-neck-side', 'מתיחת צוואר לצדדים', 'Side Neck Stretch', 'cooldown', 'stretch_upper', 1, 'seconds', 5, 'ytw'),
  ('cool-up-3-neck-rotation', 'סיבוב צוואר איטי', 'Slow Neck Rotation', 'cooldown', 'stretch_upper', 2, 'seconds', 5, 'ytw')
on conflict (id) do nothing;
