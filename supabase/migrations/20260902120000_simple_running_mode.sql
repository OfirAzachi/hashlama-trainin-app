-- The simplified running flow: the trainer sets only a distance, the
-- participant enters how long it took. It still stores one running_segments
-- row (pace_category fixed to the base 'walk' weight, so scoring reuses the
-- exact same trigger — see compute_running_points) — only the mode enum
-- needs a new value for the builder to save it.
alter type run_mode add value if not exists 'simple';
