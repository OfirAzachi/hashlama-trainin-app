# השלמה (Hashlama) — Training Course Tracker

**The UI is Hebrew and right-to-left.** `<html lang="he" dir="rtl">`, Heebo as the type family,
logical CSS properties throughout (`ps-`/`pe-`, `ms-`/`me-`, `start-`/`end-`, `text-start`) so the
layout mirrors correctly, directional icons flipped with `rtl:rotate-180`, and `he-IL` date and
number formatting. Charts stay LTR inside a `dir="ltr"` wrapper — mirrored axes read wrong.

A production-shaped Next.js app for running a structured, benchmarked fitness course:
initial and final fitness tests, **weekly trainings** with a separate prescribed track per
group (standard runners, endurance, and an injury-adapted low-impact group), per-exercise
result uploads with RPE, an Instagram-style photo feed with likes and comments, and a trainer
cockpit with cohort analytics.

**Three kinds of training, one currency.**

| Type | What the trainer sets | What the participant logs | Points |
| --- | --- | --- | --- |
| **ריצה** (running) | Segments — N repeats × distance at a target pace, or one steady run. A segment can target one group as its alternative | Actual time per repeat and repeats completed | `(metres ÷ 100) × intensity`, ×1.2 when the target pace is met |
| **סיבולת אירובית** (endurance) | Interval game over the heart-rate catalogue: rounds, work/rest, open categories and levels | The exercise chosen each round and how much was done | `reps × level` |
| **שרירים** (strength) | The same game over the muscle catalogue | Same | `reps × level` |

All types feed the same group league table (no goal to unlock — points simply accumulate), so a
low-impact participant rowing 500 m contributes on the same scale as a runner hitting their pace.

**Completion rule:** a training counts as completed only when the participant uploads results.
No upload means not completed — that single rule drives the status badges, the trainer's
"who completed this training" list, and every attendance number in the analytics.

```bash
npm install
npm run dev     # http://localhost:3000
```

**Requires Supabase.** `lib/data.ts` reads and writes Postgres directly — there's no mock-data
fallback anymore, so `.env.local` (see `.env.example`) must point at a real project with the
schema in `supabase/migrations/` applied, or every page throws. (`lib/mock-data.ts` / `lib/store.ts`
are dead code left over from the earlier in-memory-mock version; nothing imports them.) Sign up at
`/login` to create your first account — the first sign-up should be a trainer, who then publishes
trainings for participants to sign up into.

## Routes

| Route | Who | What |
| --- | --- | --- |
| `/` | anyone | The league table: groups ranked by points per member, what it would take to climb, plus top scorers, biggest improvements and longest streaks |
| `/trainer` | trainer | Who completed each week, points-game results and co-op goals, cohort analytics, the training builder (running / endurance / strength), all photos, log table + CSV export |
| `/participant?user=<id>` | participant | Weekly trainings with completed / not completed / waiting status, the right logger per type (running segments, points game, accessory results), personal progress |
| `/feed?user=<id>` | anyone | Instagram-style feed: post a photo, like, comment |

Real auth (Supabase) now gates every route via `middleware.ts` — sign in or sign up at `/login`.
The role nav and "Viewing as" select are still mock-data plumbing though: they don't yet read the
signed-in session (see "Going from mock data to Supabase" below for what's left).

## Stack

- **Next.js 14 (App Router) + TypeScript** — server components read data, server actions write it
- **Tailwind CSS** — neutral light/dark theme driven by CSS custom properties on `:root` / `.dark`
- **React Query** — mutation state (pending/error/success) for every write
- **Recharts** — comparison bars, RPE trend lines, baseline-vs-final scatter; the box plot is
  hand-rolled SVG because Recharts has no box mark
- **Lucide React** — icons
- **Hebrew / RTL** — single-language UI; strings live in the components, formatting in `lib/format.ts`
- **Supabase / PostgreSQL** — schema, RLS and storage policies in `supabase/migrations/`

## Project layout

```
app/
  actions.ts            Server actions: submitSessionLog, submitStrengthWorkout,
                        submitRunningWorkout, uploadSessionMedia,
                        createTrainingSession, toggleMediaLike, addMediaComment
  layout.tsx            Root shell (lang="he" dir="rtl"), no-flash theme script, Heebo font
  providers.tsx         React Query client + theme context
  page.tsx              Home: the group league table
  trainer/page.tsx      Server component -> TrainerDashboard
  participant/page.tsx  Server component -> ParticipantView
  feed/page.tsx         Server component -> SocialFeed
components/
  TrainerDashboard.tsx  Trainer cockpit: KPIs, group cards, charts, triage lists, tabs
  ParticipantLogger.tsx Mobile logging form: dynamic metric inputs, RPE slider, photo preview
  ParticipantDashboard.tsx  Benchmark deltas, consistency heatmap, exercise trend, log history
  BenchmarkDeltaCard.tsx    Reusable initial-vs-final card (Δ time, Δ reps, % improvement, pace)
  MediaGallery.tsx      Filterable photo grid grouped by session, with lightbox
  WeeklyTrainingBuilder.tsx  Three-step builder, branching on type. Running: segment
                        editor with per-group alternatives, then optional accessories.
                        Games: intervals, open categories/levels, co-op goal
  RunningLogger.tsx     Segment-by-segment logging with live pace, target check and points
  StrengthLogger.tsx    The points game: interval timer, per-round exercise picker,
                        live scoring and co-op progress (both catalogues)
  GroupStandings.tsx    The home league table and the course highlights
  ExerciseAnimation.tsx Looping SVG illustration for every catalogue exercise
  ExerciseDemo.tsx      "Watch the movement" button + dialog with the scoring rule
  PointsBoard.tsx       Trainer view: co-op goals, leaderboard, most-picked exercises
  TrainingsList.tsx     Participant home: every week with its completion status
  WeekCompletion.tsx    Trainer view of who uploaded results for a given week
  SocialFeed.tsx        Feed with composer, optimistic likes and comments
  LogsTable.tsx         Filterable log inspector with CSV export
  charts.tsx            Recharts components + the SVG box plot
  ui/primitives.tsx     Card, StatCard, Badge, Avatar, Segmented, ProgressBar, EmptyState
lib/
  types.ts              Every entity, enum, API payload and snapshot type
  data.ts               Data access layer (the only module that touches persistence)
  store.ts              In-memory store seeded from the mock dataset
  mock-data.ts          15 participants, 3 groups, 14 trainings (9 runs, 3 strength
                        games, 2 endurance games), ~275 logs, running logs,
                        40 photos, likes and comments
  exercise-library.ts   ~30 accessory exercise templates, with low-impact swaps
  strength-catalog.ts   The muscle catalogue: 4 categories × 3 levels × 10 exercises
  endurance-catalog.ts  The heart-rate catalogue: jumps, machines, full body, agility
  catalog.ts            One lookup across both catalogues (kinds, categories, exercises)
  running.ts            Pace maths, segment scoring, per-group segment resolution
  points.ts             Scoring rules, leaderboards, co-op and the group league table
  metrics.ts            Deltas, group analytics, rankings, chart data, CSV serialisation
  format.ts             mm:ss parsing/formatting, pace, percentages, metric units
  groups.ts             Group registry (names, descriptions, chart colours)
supabase/migrations/    DDL, indexes, calculated views, RLS policies, storage bucket
supabase/config.toml    Auth settings (email confirmation off), pushed via `supabase config push`
lib/supabase/           Browser/server/service Supabase clients + generated DB types
```

## Data model

| Table | Notes |
| --- | --- |
| `users` | `role` (`trainer` \| `participant`), `group_id` (`A` \| `B` \| `C`); a check constraint keeps trainers group-less and participants grouped |
| `benchmark_tests` | `test_type` (`initial` \| `final`), `run_3km_seconds`, `max_pushups`; unique per user and type |
| `training_sessions` | Weekly training with `week_index`, `training_type` (`running` \| `endurance` \| `strength`) and shared instructions |
| `running_configs` → `running_segments` | The run plan: mode, co-op goal, and one row per prescribed segment (repeats, distance, target pace, recovery, intensity, target group) |
| `running_logs` | What was actually run; distance, pace, target check and points are all generated columns |
| `session_tracks` → `track_exercises` | The per-group variant of a session — this is how Group C gets a 2000m row where Group A gets 5 × 800m |
| `session_logs` | One row per aerobic exercise result: `metric_type`, `metric_value`, `rpe`, `notes` |
| `strength_configs` | Interval setup per points game: catalogue, work/rest seconds, rounds, open categories and levels, co-op goal |
| `strength_exercises` | Both catalogues, tagged by `catalog`, including `gif_url` for swapping in filmed demos |
| `strength_logs` | One filled interval slot; `reps` and `points` are generated columns, so a score can never be faked |
| `session_media` | Photo URL, caption and exercise tags |
| `media_likes` / `media_comments` | Feed interactions: one like per person per photo, comments capped at 500 chars |

Calculated views ship with the schema so the analytics can move server-side unchanged:
`v_benchmark_deltas`, `v_participant_attendance`, `v_group_analytics`, `v_session_log_export`,
`v_strength_points`, `v_running_points`, `v_group_points` (no coop/goal view — points only accumulate).

### The points games

The catalogue in `lib/strength-catalog.ts` is the programme as written: four categories
(lower body, upper-body push, back and posterior chain, core) × three levels × ten exercises,
Hebrew names first with English alongside.

- **Points = reps × level.** Level 1 scores 1 point per rep, level 3 scores 3.
- **Static holds** (wall sit, planks, hollow body, reverse plank, the scapular squeeze) are logged
  in seconds; every 5 seconds counts as one rep.
- **Bear crawl** is logged in metres; every 2 metres counts as one rep.
- Reps and points are recalculated **server-side** from the catalogue in `submitStrengthWorkout`,
  and are generated columns in Postgres — the client's arithmetic is never trusted.
- **Co-op:** each group's points are summed against `group_goal_points`. Everyone contributes what
  they can safely do, which is the point of letting each person pick their own exercise and level.

The trainer sets the interval structure (default 40s work / 20s rest), how many rounds, which
categories and levels are open, and the team goal. The participant gets an interval timer, picks an
exercise per round, and sees the score update live.

Every exercise has a looping illustration, rendered as an animated SVG (two stick-figure poses
morphed with SMIL) so demos work offline and in both themes. Setting `gif_url` on an exercise
swaps in a real GIF or filmed demo with no component changes.

### Metric conventions

- **Run improvement is positive when the athlete got faster** (`(initial − final) / initial`), so
  both benchmarks read "higher is better" in the UI.
- Pace is seconds per km, derived from the 3km time; displayed as `m:ss/km`.
- Time inputs accept `mm:ss`, `mm:ss.d` or raw seconds and are stored as seconds.
- Composite improver score weights running gains 1.6× and push-up gains 0.4×, since aerobic
  benchmarks move far more slowly than rep counts.
- "Needs support" flags on any of: run improvement under 4%, push-up gain ≤ 3 reps,
  fewer than 70% of trainings completed, or average RPE ≥ 8.5.
- A week is "waiting for your results" for 7 days after its date, and "not completed" after that.

## Going from mock data to Supabase

Status: schema, catalogue seed and real auth are live; `lib/data.ts` still reads the in-memory
mock store — that's the remaining step.

1. Schema lives in `supabase/migrations/` (not a single `schema.sql` anymore). Push with
   `supabase db push --linked` (or `supabase link --project-ref <ref>` first if unlinked).
2. `.env.local` holds the project URL and keys (see `.env.example`); it's git-ignored.
3. Client/server helpers: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts`
   (server components/actions, plus a service-role client for privileged scripts).
4. Auth is real: `app/login` (sign-in/sign-up) + `middleware.ts` (session refresh, route
   gating). Sign-up collects role + group as user metadata; a DB trigger
   (`handle_new_user`) copies it into `public.users`. Email confirmation is off
   (`supabase/config.toml` → `[auth.email] enable_confirmations = false`, pushed via
   `supabase config push --project-ref <ref>`) since this is a closed cohort, not a public app.
5. Remaining: reimplement the functions in `lib/data.ts` with `supabase.from(...)` queries —
   that file is the only seam between the UI and persistence, and its function signatures
   already match the async shape Supabase returns. Nothing in `components/` changes.
6. In `app/actions.ts`, replace the data-URL branch of `uploadSessionMedia` with a
   `supabase.storage.from('session-media').upload()` call keyed `<user_id>/<session_id>/<file>`
   — the storage policies in the schema authorise exactly that path shape.
7. Replace `components/UserSwitcher.tsx` and the `?user=<id>` query-param plumbing across
   `app/page.tsx` / `app/participant/page.tsx` / `app/feed/page.tsx` with the authenticated
   session user from `lib/supabase/server.ts`.

## Accessibility and responsiveness

- Every control is labelled; tab lists use `role="tab"` / `aria-selected`, status messages use
  `role="status"` and `role="alert"`, and charts carry text alternatives or `<title>` elements.
- Skip link, visible focus rings, and 44px touch targets on the participant form.
- The participant app is phone-first with a thumb-reachable bottom tab bar; the trainer
  dashboard is laid out for tablet and desktop. Wide tables scroll inside their own container
  rather than the page.
- Light and dark themes are both first-class; the stored preference is applied before first
  paint to avoid a flash.

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
```
