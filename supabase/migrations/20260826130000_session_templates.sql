-- Reusable starting points for a new week's training, picked from the
-- planner instead of configuring rounds/segments from scratch every time.
-- Trainer-only, same as every other planning table (strength_configs,
-- running_configs) — participants never see the builder.
create table public.session_templates (
  id text primary key,
  training_type text not null check (training_type in ('running', 'endurance', 'strength', 'warmup', 'cooldown')),
  title text not null,
  description text not null default '',
  workout_instructions text not null default '',
  points_game jsonb,
  running jsonb,
  created_at timestamptz not null default now()
);

alter table public.session_templates enable row level security;

create policy session_templates_all_trainer on public.session_templates
  for all using (public.is_trainer()) with check (public.is_trainer());

insert into public.session_templates (id, training_type, title, description, workout_instructions, points_game, running) values
  (
    'tmpl-warmup-general',
    'warmup',
    'חימום כללי',
    'מתיחות בתנועה ולאחריהן העלאת דופק הדרגתית — 6 סבבים.',
    'עוברים סבב-סבב ברצף, בלי לעצור בין תרגיל לתרגיל.',
    '{"catalog":"warmup","round_work_seconds":[40,40,40,40,40,40],"round_rest_seconds":[20,20,20,20,20,20],"round_categories":[],"round_exercise_ids":["warm-dyn-1-leg-swing","warm-dyn-1-torso-twist","warm-dyn-2-hip-circle","warm-dyn-2-cat-cow","warm-pulse-1-march","warm-pulse-2-jumping-jack"],"allowed_levels":[1,2,3]}'::jsonb,
    null
  ),
  (
    'tmpl-cooldown-general',
    'cooldown',
    'שחרור כללי',
    'מתיחות סטטיות לכל הגוף לאחר האימון — 6 סבבים.',
    'כל מתיחה מוחזקת בנחת, ללא קפיצות או תנועות פתאומיות.',
    '{"catalog":"cooldown","round_work_seconds":[40,40,40,40,40,40],"round_rest_seconds":[20,20,20,20,20,20],"round_categories":[],"round_exercise_ids":["cool-low-1-quad","cool-low-1-calf","cool-back-1-child","cool-up-1-shoulder","cool-back-3-spinal-twist","cool-low-2-hamstring"],"allowed_levels":[1,2,3]}'::jsonb,
    null
  ),
  (
    'tmpl-strength-interval-4x3',
    'strength',
    'אימון שרירים אינטרוולי — 3 סטים / 4 קטגוריות',
    'חזה, גב, רגליים וליבה — 3 סטים על כל קטגוריה, דקה עבודה / חצי דקה מנוחה.',
    '12 סבבים: חזה-גב-רגליים-ליבה, שלוש פעמים ברצף. כל אחד בוחר תרגיל ורמה בעצמו בכל סבב.',
    '{"catalog":"strength","round_work_seconds":[60,60,60,60,60,60,60,60,60,60,60,60],"round_rest_seconds":[30,30,30,30,30,30,30,30,30,30,30,30],"round_categories":["push","back","lower","core","push","back","lower","core","push","back","lower","core"],"round_exercise_ids":[],"allowed_levels":[1,2,3]}'::jsonb,
    null
  ),
  (
    'tmpl-running-steady',
    'running',
    'ריצה רציפה',
    'ריצה אחידה של 3 ק"מ בקצב שיחה.',
    'ריצה רציפה בקצב אחיד לאורך כל המקטע.',
    null,
    '{"mode":"steady","segments":[{"id":"tmpl-run-steady-1","label":"ריצה רציפה 3 ק\"מ","target_group":"all","repeats":1,"distance_meters":3000,"pace_category":"talk","recovery_seconds":0}]}'::jsonb
  ),
  (
    'tmpl-running-intervals',
    'running',
    'ריצה אינטרוולים — 6x400 מ׳',
    '6 חזרות של 400 מ׳ בקצב מהיר, עם מנוחה בין חזרות.',
    'ריצה מהירה במקטע, הליכה/ריצה קלה במנוחה בין החזרות.',
    null,
    '{"mode":"intervals","segments":[{"id":"tmpl-run-int-1","label":"אינטרוול 400 מ׳","target_group":"all","repeats":6,"distance_meters":400,"pace_category":"sprint","recovery_seconds":90}]}'::jsonb
  ),
  (
    'tmpl-warmup-running',
    'warmup',
    'חימום לריצה',
    'חימום ממוקד רגליים לפני ריצה — 6 סבבים.',
    'דגש על הכנת הרגליים והמפרקים לפני יציאה לריצה.',
    '{"catalog":"warmup","round_work_seconds":[40,40,40,40,40,40],"round_rest_seconds":[20,20,20,20,20,20],"round_categories":[],"round_exercise_ids":["warm-dyn-1-leg-swing","warm-dyn-1-ankle-circle","warm-dyn-1-squat-overhead-reach","warm-dyn-2-walking-lunge","warm-pulse-1-march","warm-pulse-2-high-knees"],"allowed_levels":[1,2,3]}'::jsonb,
    null
  ),
  (
    'tmpl-cooldown-running',
    'cooldown',
    'שחרור לריצה',
    'מתיחות ממוקדות רגליים לאחר ריצה — 6 סבבים.',
    'דגש על ירך קדמית, ירך אחורית, שוקיים וישבן.',
    '{"catalog":"cooldown","round_work_seconds":[40,40,40,40,40,40],"round_rest_seconds":[20,20,20,20,20,20],"round_categories":[],"round_exercise_ids":["cool-low-1-quad","cool-low-1-calf","cool-low-2-hamstring","cool-low-2-hip-flexor","cool-low-3-pigeon","cool-low-2-seated-glute-stretch"],"allowed_levels":[1,2,3]}'::jsonb,
    null
  );
