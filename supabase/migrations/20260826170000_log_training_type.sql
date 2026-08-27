-- Adds the 'log' training type: a plain prescribed-exercise list (reusing
-- the existing tracks/session_logs mechanism) with no points and no
-- interval timing — used for the "simple running" (distance + time) and
-- "pushup sets" (one field per set) presets in the trainer's planner.
alter type training_type add value if not exists 'log';
