-- The Google-first signup flow creates the auth/public.users row via
-- handle_new_user() *before* /auth/callback links the roster row and sets
-- team — a brand-new participant is briefly (or, if roster linking fails,
-- indefinitely) team-less. The old constraint required every participant to
-- have a team immediately, which made that insert fail outright ("Database
-- error saving new user"). Trainers must still have no team; participants
-- may simply not have one yet.

alter table public.users drop constraint if exists users_team_matches_role;
alter table public.users add constraint users_team_matches_role
  check (role != 'trainer' or team is null);
