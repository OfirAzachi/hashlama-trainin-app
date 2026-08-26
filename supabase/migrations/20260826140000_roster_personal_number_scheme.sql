-- Switches the roster's sign-up identifier from the raw physical מ.א (a long
-- number nobody remembers) to first_name + first digit + last two digits of
-- that number — e.g. 9117712 -> "אופיר912". Checked ahead of time for
-- collisions across the full roster (none, with this exact digit choice —
-- first+last-two beat first+last-digit, which collided on two name pairs,
-- and first+first-two, which collided on six).
--
-- Drops whatever the existing digits-only check constraint is actually
-- named (found dynamically rather than assumed, since it was declared
-- inline in the original create table) and replaces it with one that
-- accepts the new "Hebrew letters then digits" shape.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.roster'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%personal_number%'
  loop
    execute format('alter table public.roster drop constraint %I', con.conname);
  end loop;
end $$;

update public.roster
set personal_number = first_name || left(personal_number, 1) || right(personal_number, 2);

alter table public.roster add constraint roster_personal_number_format
  check (personal_number ~ '^[א-ת]+[0-9]+$');
