-- A kilometre run is worth 20 points, not 10.
--
-- That applies to the two places distance alone drives the score — the
-- simplified running flow (pace category 'simple') and self-logged runs
-- (quick_logs). The trainer-set pace categories keep their existing
-- weights: walk 1, talk 2, borg 3, sprint 4.
--
-- Existing rows are left exactly as they were scored: both triggers only
-- recompute on insert or update, and nothing here touches stored rows.

create or replace function public.compute_running_points()
returns trigger
language plpgsql
as $$
declare
  mult numeric := 1;
  pace_weight integer;
begin
  select case when u.gender = 'נ' then 1.5 else 1 end into mult
  from public.users u where u.id = new.user_id;

  pace_weight := case new.pace_category
    when 'walk'   then 1
    when 'talk'   then 2
    when 'borg'   then 3
    when 'sprint' then 4
    -- Simplified flow: 20 points per kilometre.
    when 'simple' then 2
  end;

  new.total_distance_meters := new.distance_meters * new.repeats_done;
  new.points := round(round(new.total_distance_meters / 100.0) * pace_weight * coalesce(mult, 1))::integer;
  return new;
end;
$$;

create or replace function public.compute_quick_log_points()
returns trigger
language plpgsql
as $$
declare
  mult numeric := 1;
begin
  select case when u.gender = 'נ' then 1.5 else 1 end into mult
  from public.users u where u.id = new.user_id;

  new.points := case new.activity
    -- 20 points per kilometre.
    when 'running' then round(round(new.distance_meters / 100.0) * 2 * coalesce(mult, 1))::integer
    when 'pushups' then round(new.reps * 1 * coalesce(mult, 1))::integer
  end;
  return new;
end;
$$;
