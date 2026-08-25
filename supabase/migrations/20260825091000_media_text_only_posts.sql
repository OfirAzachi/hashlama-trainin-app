-- Lets a caption stand alone as a full "text post" in the feed — no photo
-- or file required, so a trainer (or participant) can just write something.
alter table public.session_media alter column image_url drop not null;

alter table public.session_media add constraint session_media_has_content
  check (image_url is not null or (caption is not null and length(btrim(caption)) > 0));
