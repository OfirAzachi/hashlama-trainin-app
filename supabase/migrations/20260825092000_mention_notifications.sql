-- Mailbox: a lightweight "you were mentioned" notification created whenever
-- someone @-tags a person in a feed comment. Points back at the post so the
-- recipient can jump straight to it.
create table if not exists public.notifications (
  id           uuid        primary key default gen_random_uuid(),
  recipient_id uuid        not null references public.users (id) on delete cascade,
  actor_id     uuid        not null references public.users (id) on delete cascade,
  media_id     uuid        not null references public.session_media (id) on delete cascade,
  comment_id   uuid        references public.media_comments (id) on delete cascade,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_notifications_recipient on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (recipient_id = auth.uid());

-- Only the mentioning user can create the notification, and only for someone
-- else — no self-mentions.
drop policy if exists notifications_insert_actor on public.notifications;
create policy notifications_insert_actor on public.notifications
  for insert with check (actor_id = auth.uid() and recipient_id <> auth.uid());

-- The recipient marks their own notifications read (or unread again).
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete using (recipient_id = auth.uid());
