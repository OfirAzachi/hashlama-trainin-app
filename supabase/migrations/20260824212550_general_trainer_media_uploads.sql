-- Lets a trainer post to the feed without tying the upload to a specific
-- training — general announcements, files, whatever isn't a workout photo.
-- Participants still must attach their uploads to a session; only trainers
-- may leave session_id empty, enforced at the DB level as well as in the
-- server action.
alter table public.session_media alter column session_id drop not null;
alter table public.session_media add column mime_type text;
alter table public.session_media add column file_name text;

alter table public.session_media add constraint session_media_session_or_trainer
  check (session_id is not null or public.is_trainer());

-- Files (PDFs, docs) alongside the existing image types, and a slightly
-- higher size ceiling to fit them.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/heic',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
where id = 'session-media';
