-- Work/rest timing moves from one global pair per points game to one pair
-- per round, so a trainer can give any interval — including a single
-- warm-up or cool-down stretch — its own time. `strength_configs` has no
-- rows yet, so this is a clean swap rather than a backfill.
alter table public.strength_configs drop column if exists work_seconds;
alter table public.strength_configs drop column if exists rest_seconds;
alter table public.strength_configs add column round_work_seconds smallint[] not null default '{}';
alter table public.strength_configs add column round_rest_seconds smallint[] not null default '{}';
