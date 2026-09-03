-- The simplified strength/endurance flow: 3 premade difficulty tiers
-- (name, level, and a premade rep target per round) instead of free levels
-- plus a typed number. Stored as jsonb since it's a small trainer-authored
-- structure read back verbatim by the client — nothing here needs its own
-- relational shape or to be queried by the database.
alter table public.strength_configs add column if not exists tiers jsonb;
