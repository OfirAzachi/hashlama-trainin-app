-- Almost every roster row is a trainee; exactly one (אופיר אזאצ'י) is the
-- trainer running the course. The sign-up flow will read this to decide
-- which role/account type a matched personal number gets.
alter table public.roster
  add column if not exists role user_role not null default 'participant';

update public.roster set role = 'trainer' where personal_number = '9117712';
