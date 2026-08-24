-- The home page's league table, top-scorers, streaks and "biggest improver"
-- lists are shown to every signed-in viewer (participant or trainer), by
-- name, cohort-wide — that's the whole point of the competitive league
-- table. Reading `session_logs` (for streaks) and `benchmark_tests` (for
-- improvement %) therefore needs to be cohort-wide too, not just "your own
-- rows or the trainer's". Writes stay own-row-only.

drop policy if exists logs_select on public.session_logs;
create policy logs_select on public.session_logs
  for select using (auth.uid() is not null);

drop policy if exists benchmarks_select on public.benchmark_tests;
create policy benchmarks_select on public.benchmark_tests
  for select using (auth.uid() is not null);
