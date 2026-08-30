-- Marks a published training as "optional/extra" — shown as a badge to
-- participants, independent of training_type. Used by the "ריצה (פשוטה)"
-- and "שכיבות סמיכה" presets in the planner, but any training can be
-- flagged this way.
alter table public.training_sessions add column if not exists is_optional boolean not null default false;
