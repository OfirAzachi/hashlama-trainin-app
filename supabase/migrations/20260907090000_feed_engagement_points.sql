-- Feed engagement points, folded into bonus_points (see the earlier
-- bonus_points migration) since none of this is tied to a specific week's
-- training:
--   +100 to whoever uploads a real image (not a text-only post, not a
--        non-image file attachment)
--   +5   to whoever likes a post
--   +10  to whoever comments on a post
--
-- Implemented as row-level triggers rather than app-code increments so
-- every insert path (the feed composer, ParticipantLogger's training
-- photo, a trainer's general upload) is covered uniformly, and so removing
-- a like/comment/post claws its points back automatically — including a
-- deleted post's likes and comments, since `on delete cascade` still fires
-- each cascaded row's own trigger.

create or replace function public.award_image_upload_points()
returns trigger language plpgsql as $$
begin
  if new.image_url is not null and new.mime_type is null then
    update public.users set bonus_points = bonus_points + 100 where id = new.user_id;
  end if;
  return new;
end;
$$;

create or replace function public.revoke_image_upload_points()
returns trigger language plpgsql as $$
begin
  if old.image_url is not null and old.mime_type is null then
    update public.users set bonus_points = bonus_points - 100 where id = old.user_id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_award_image_upload_points on public.session_media;
create trigger trg_award_image_upload_points
  after insert on public.session_media
  for each row execute function public.award_image_upload_points();

drop trigger if exists trg_revoke_image_upload_points on public.session_media;
create trigger trg_revoke_image_upload_points
  after delete on public.session_media
  for each row execute function public.revoke_image_upload_points();

-- Likes ----------------------------------------------------------------
create or replace function public.award_like_points()
returns trigger language plpgsql as $$
begin
  update public.users set bonus_points = bonus_points + 5 where id = new.user_id;
  return new;
end;
$$;

create or replace function public.revoke_like_points()
returns trigger language plpgsql as $$
begin
  update public.users set bonus_points = bonus_points - 5 where id = old.user_id;
  return old;
end;
$$;

drop trigger if exists trg_award_like_points on public.media_likes;
create trigger trg_award_like_points
  after insert on public.media_likes
  for each row execute function public.award_like_points();

drop trigger if exists trg_revoke_like_points on public.media_likes;
create trigger trg_revoke_like_points
  after delete on public.media_likes
  for each row execute function public.revoke_like_points();

-- Comments ---------------------------------------------------------------
create or replace function public.award_comment_points()
returns trigger language plpgsql as $$
begin
  update public.users set bonus_points = bonus_points + 10 where id = new.user_id;
  return new;
end;
$$;

create or replace function public.revoke_comment_points()
returns trigger language plpgsql as $$
begin
  update public.users set bonus_points = bonus_points - 10 where id = old.user_id;
  return old;
end;
$$;

drop trigger if exists trg_award_comment_points on public.media_comments;
create trigger trg_award_comment_points
  after insert on public.media_comments
  for each row execute function public.award_comment_points();

drop trigger if exists trg_revoke_comment_points on public.media_comments;
create trigger trg_revoke_comment_points
  after delete on public.media_comments
  for each row execute function public.revoke_comment_points();
