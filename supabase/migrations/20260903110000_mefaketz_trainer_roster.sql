-- Adds the eight מפק"ץ (team commanders) as trainer accounts, each attached
-- to the team they command — a trainer with a team counts toward that
-- team's roster and standings just like any participant (see the
-- Participant type comment; getParticipants() already selects by
-- `team is not null` regardless of role). Also adds מק״ס יותם גבריאל as a
-- trainer with no team.
--
-- These are provisioned directly with their real phone number as the login
-- code (no name prefix), unlike the participant scheme — so the format
-- check is relaxed to accept plain digits too.
alter table public.roster drop constraint if exists roster_personal_number_format;
alter table public.roster add constraint roster_personal_number_format
  check (personal_number ~ '^[א-ת]*[0-9]+$');

insert into public.roster (
  personal_number, first_name, last_name, gender, unit, role, team, confirmed_at
) values
  ('0523489675', 'נתנאל', 'זפרני',   'ז', 'מפקדה', 'trainer', 1, now()),
  ('0556623227', 'מעין',  'ויצמן',   'נ', 'מפקדה', 'trainer', 2, now()),
  ('0524597369', 'שני',   'לוי',     'נ', 'מפקדה', 'trainer', 3, now()),
  ('0587480281', 'אמתי',  'כחלון',   'ז', 'מפקדה', 'trainer', 4, now()),
  ('0522907765', 'טהיר',  'ריפולד',  'נ', 'מפקדה', 'trainer', 5, now()),
  ('0533392722', 'אורי',  'נוביק',   'ז', 'מפקדה', 'trainer', 6, now()),
  ('0543180088', 'הלל',   'לוי',     'ז', 'מפקדה', 'trainer', 7, now()),
  ('0556620060', 'יניר',  'אדרי',    'ז', 'מפקדה', 'trainer', 8, now()),
  ('0546601272', 'יותם',  'גבריאל',  'ז', 'מפקדה', 'trainer', null, now())
on conflict (personal_number) do nothing;
