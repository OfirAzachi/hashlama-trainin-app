-- צוות (team, 1-8) is the primary competition group; the existing `unit`
-- column (יחידה) is the secondary one. Both get copied onto the account at
-- sign-up time.
alter table public.roster
  add column if not exists team smallint check (team between 1 and 8);
