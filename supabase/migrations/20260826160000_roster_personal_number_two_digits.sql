-- Shortens the login code further: drop the leading digit, keep only the
-- last two — e.g. "עידן879" -> "עידן79". Checked ahead of time for
-- collisions across the full roster (none). The existing
-- roster_personal_number_format check (Hebrew letters then digits, any
-- count) already covers the 2-digit shape, so no constraint change needed.
update public.roster
set personal_number = first_name || right(personal_number, 2);
