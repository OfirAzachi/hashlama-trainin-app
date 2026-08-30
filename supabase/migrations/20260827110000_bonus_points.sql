-- Manual catch-up bonus — a points adjustment separate from actual logged
-- training data, added into standings/leaderboards on top of real points.
-- Never a fabricated training entry: this column is the honest, visible
-- record of "added manually" rather than pretending someone did a workout.
alter table public.users add column if not exists bonus_points integer not null default 0;

-- One-time catch-up: 297 points (the current average among participants who
-- have logged a scored training) for everyone who hasn't logged anything
-- yet, excluding the trainer's own test account.
update public.users
set bonus_points = 297
where id in (
  'f9411597-0bcf-4cfc-ac16-be1c85aa10d3',
  '1c81e797-33d7-47d3-b7a6-ddeb1b23877e',
  '876ab068-db16-4d36-8e79-38d0326c61d7',
  '948de916-0d71-45c1-9a52-9d1845c0e7c9',
  'eb59d147-b2b3-4b8c-badc-baf495029d9d',
  'f7c31914-d47e-445d-a027-783be1916b3e',
  'ac4c575d-d69c-45b2-b622-51b53fb8cb9b',
  '5fc45180-a301-44f3-a59e-8d1e4405a51f',
  '6eba7bce-673e-46e6-84be-98fe7c6ebdff',
  '5bd13570-21ec-4359-8a19-cc6a44749ee2',
  'c50f2302-817e-4e13-97e5-5f572e498a4f',
  'f7e2bb7a-d78e-450d-a6de-ae862ae5a184',
  '9a4d24dc-9f99-4e21-bb7b-1d02f05a2e22',
  '709f0141-8068-478c-b603-706909f1acc3',
  '8bdb2016-7d97-4f0e-9369-1100feffb13a',
  '7c20643e-fe01-42d9-92f6-8191553ee12c',
  '4b5768bd-d443-4dc0-997c-7d46ad2f75dc',
  'ea451236-38ba-4aa9-a78b-a147d65d83d2'
);
