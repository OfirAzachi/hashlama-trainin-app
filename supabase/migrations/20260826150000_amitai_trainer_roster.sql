-- A second trainer account, provisioned directly (not through the fitness
-- test import). Runs after the personal_number scheme migration so its
-- login code already fits the new "name + digits" shape directly, rather
-- than being derived from a physical מ.א that doesn't exist for this
-- account. confirmed_at is pre-set so it skips the onboarding confirmation
-- screen entirely — there is nothing to confirm since it was entered here
-- directly rather than imported from the test sheet.
insert into public.roster (
  personal_number, first_name, last_name, gender, unit, role, confirmed_at
) values (
  'אמתי01', 'אמתי', '- מפק"ץ', 'ז', 'מפקדה', 'trainer', now()
)
on conflict (personal_number) do nothing;
