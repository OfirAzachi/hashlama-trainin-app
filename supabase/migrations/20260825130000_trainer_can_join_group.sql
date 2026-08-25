-- A trainer can now also train as a member of a group — they keep the
-- 'trainer' role (that's what grants admin access) but may additionally
-- carry a team, same column a participant uses. The old rule forced every
-- trainer's team to stay null; drop it so a trainer can opt in.
alter table public.users drop constraint if exists users_team_matches_role;
