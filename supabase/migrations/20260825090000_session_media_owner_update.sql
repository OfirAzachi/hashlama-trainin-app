-- Lets the author of a feed post edit its caption after publishing (delete
-- was already covered by media_delete_self; update was missing).
drop policy if exists media_update_self on public.session_media;
create policy media_update_self on public.session_media
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
