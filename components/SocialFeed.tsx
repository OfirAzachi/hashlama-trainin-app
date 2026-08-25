'use client';

import {
  Camera,
  FileText,
  Heart,
  ImageOff,
  ImagePlus,
  Loader2,
  MessageCircle,
  Paperclip,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

import {
  addMediaComment,
  deleteMediaPost,
  toggleMediaLike,
  updateMediaPost,
  uploadSessionMedia,
} from '@/app/actions';
import { Avatar, Badge, Card, EmptyState, GroupBadge } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { compactCount, formatRelativeTime } from '@/lib/format';
import { GROUP_LIST } from '@/lib/groups';
import type { FeedPost, GroupId, SessionMedia, TrainingSession, User } from '@/lib/types';

const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

interface SocialFeedProps {
  posts: FeedPost[];
  viewer: User;
  /** Sessions the viewer can tag a new photo with. */
  sessions: TrainingSession[];
  /** Everyone in the cohort, for the @mention autocomplete in comments. */
  users: User[];
}

/* --------------------------------------------------------- mentions */

// A mention the composer inserts: @[Display Name](user-uuid). Rendered as a
// styled "@Name" chip; the server parses the same pattern to resolve who to
// notify.
const MENTION_RENDER_PATTERN = /@\[([^\]]+)\]\([0-9a-fA-F-]{36}\)/g;

function renderCommentBody(body: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of body.matchAll(MENTION_RENDER_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(body.slice(lastIndex, index));
    parts.push(
      <span key={key++} className="font-medium text-accent">
        @{match[1]}
      </span>,
    );
    lastIndex = index + match[0].length;
  }
  if (lastIndex < body.length) parts.push(body.slice(lastIndex));
  return parts;
}

/** Turns tracked @mentions back into `@[Name](id)` tokens for storage, longest names first. */
function encodeMentions(raw: string, mentions: Array<{ id: string; name: string }>): string {
  let result = raw;
  const byLength = [...mentions].sort((a, b) => b.name.length - a.name.length);
  for (const mention of byLength) {
    result = result.split(`@${mention.name}`).join(`@[${mention.name}](${mention.id})`);
  }
  return result;
}

/* ------------------------------------------------------------- image */

function PostImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-elevated text-muted"
        role="img"
        aria-label={alt}
      >
        <ImageOff aria-hidden className="h-7 w-7" />
        <span className="text-xs">התמונה לא זמינה במצב לא מקוון</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- sources include in-memory data URLs
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-square w-full bg-elevated object-cover"
    />
  );
}

/** A trainer's non-image upload (PDF, doc…) — a download card, not a broken photo. */
function PostFile({ media }: { media: SessionMedia }) {
  return (
    <a
      href={media.image_url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 bg-elevated px-4 py-4 transition-colors hover:bg-elevated/70"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface text-accent">
        <FileText aria-hidden className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
        {media.file_name ?? 'קובץ מצורף'}
      </span>
      <span className="shrink-0 text-xs text-accent">פתיחה</span>
    </a>
  );
}

/** Picks a photo or a file card, whichever this post actually is — or nothing for a text-only post. */
function PostMedia({ media, alt }: { media: SessionMedia; alt: string }) {
  if (!media.image_url) return null;
  if (media.mime_type) return <PostFile media={media} />;
  return <PostImage src={media.image_url} alt={alt} />;
}

/* -------------------------------------------------------------- post */

function PostCard({ post, viewer, users }: { post: FeedPost; viewer: User; users: User[] }) {
  const router = useRouter();
  const [showAllComments, setShowAllComments] = useState(false);
  const [draft, setDraft] = useState('');
  const [mentions, setMentions] = useState<Array<{ id: string; name: string }>>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [comments, setComments] = useState(post.comments);
  const [isPending, startTransition] = useTransition();

  const isAuthor = post.author.id === viewer.id;
  const [caption, setCaption] = useState(post.media.caption ?? '');
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(caption);
  const [editError, setEditError] = useState<string | null>(null);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isSaving, startSaveTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  // Optimistic like: the heart flips instantly, the action reconciles after.
  const [likeState, setLikeState] = useOptimistic(
    { likes: post.likes, likedByMe: post.likedByMe },
    (_current, next: { likes: number; likedByMe: boolean }) => next,
  );

  const startEdit = () => {
    setEditDraft(caption);
    setEditError(null);
    setIsEditing(true);
  };

  const saveEdit = () => {
    startSaveTransition(async () => {
      const result = await updateMediaPost(post.media.id, viewer.id, editDraft);
      if (!result.ok) {
        setEditError(result.error);
        return;
      }
      setCaption(result.data.caption ?? '');
      setIsEditing(false);
      router.refresh();
    });
  };

  const onDelete = () => {
    if (!window.confirm('למחוק את הפוסט? הפעולה לא ניתנת לביטול.')) return;
    startDeleteTransition(async () => {
      const result = await deleteMediaPost(post.media.id, viewer.id);
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      setIsDeleted(true);
      router.refresh();
    });
  };

  const onLike = () => {
    startTransition(async () => {
      setLikeState({
        likes: likeState.likes + (likeState.likedByMe ? -1 : 1),
        likedByMe: !likeState.likedByMe,
      });
      await toggleMediaLike(post.media.id, viewer.id);
      router.refresh();
    });
  };

  const mentionSuggestions =
    mentionQuery !== null
      ? users
          .filter((user) => user.id !== viewer.id)
          .filter((user) => user.name.toLowerCase().includes(mentionQuery.toLowerCase()))
          .slice(0, 5)
      : [];

  // Positioned in the viewport (not the card) and portaled to <body> — the
  // card has overflow-hidden to clip its photo's corners, which would
  // otherwise silently clip this dropdown too, making it look like @mentions
  // just don't do anything.
  const [mentionAnchor, setMentionAnchor] = useState<{ bottom: number; left: number; width: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (mentionSuggestions.length === 0) {
      setMentionAnchor(null);
      return;
    }
    const el = commentInputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMentionAnchor({ bottom: window.innerHeight - rect.top + 4, left: rect.left, width: Math.max(rect.width, 224) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-measure whenever the suggestion set (or query) changes
  }, [mentionQuery, mentionSuggestions.length]);

  useEffect(() => {
    if (!mentionAnchor) return;
    const close = () => setMentionQuery(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [mentionAnchor]);

  const onDraftChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const cursor = event.target.selectionStart ?? value.length;
    setDraft(value);
    const match = /@([^\s@]{0,30})$/.exec(value.slice(0, cursor));
    setMentionQuery(match ? match[1] : null);
  };

  const insertMention = (user: User) => {
    const input = commentInputRef.current;
    const cursor = input?.selectionStart ?? draft.length;
    const beforeCursor = draft.slice(0, cursor);
    const atIndex = beforeCursor.lastIndexOf('@');
    if (atIndex === -1) return;
    const before = draft.slice(0, atIndex);
    const after = draft.slice(cursor);
    const insertion = `@${user.name} `;
    setDraft(before + insertion + after);
    setMentions((current) => (current.some((m) => m.id === user.id) ? current : [...current, { id: user.id, name: user.name }]));
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const pos = before.length + insertion.length;
      input?.focus();
      input?.setSelectionRange(pos, pos);
    });
  };

  const onComment = () => {
    const body = draft.trim();
    if (!body) return;
    const finalBody = encodeMentions(body, mentions);
    setDraft('');
    setMentions([]);
    setMentionQuery(null);
    startTransition(async () => {
      const result = await addMediaComment(post.media.id, viewer.id, finalBody);
      if (result.ok) {
        setComments((current) => [...current, { comment: result.data, author: viewer }]);
        router.refresh();
      }
    });
  };

  if (isDeleted) return null;

  const visibleComments = showAllComments ? comments : comments.slice(-2);
  const isStaffPost = post.author.role === 'trainer';
  const hasMedia = Boolean(post.media.image_url);

  const captionArea = isEditing ? (
    <div className="space-y-1.5">
      <textarea
        className="input min-h-[5rem] resize-y py-2 leading-relaxed"
        value={editDraft}
        onChange={(event) => setEditDraft(event.target.value)}
        placeholder="כיתוב"
        aria-label="עריכת הכיתוב"
        autoFocus
        onKeyDown={(event) => {
          if (event.key === 'Escape') setIsEditing(false);
        }}
      />
      {editError ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {editError}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={() => setIsEditing(false)}>
          ביטול
        </button>
        <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={saveEdit} disabled={isSaving}>
          {isSaving ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : 'שמירה'}
        </button>
      </div>
    </div>
  ) : caption ? (
    // The author's name already shows in the header right above, so it's not repeated here.
    <p className={cn('whitespace-pre-wrap text-sm text-ink', !hasMedia && 'text-[15px] leading-relaxed')}>
      {caption}
    </p>
  ) : null;

  return (
    <Card
      as="article"
      className={cn(
        'overflow-hidden',
        isStaffPost && 'border-2 border-amber-400/70 shadow-[0_0_0_1px_rgba(251,191,36,0.25)] dark:border-amber-400/50',
      )}
    >
      {/* author */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3',
          isStaffPost && 'bg-gradient-to-l from-amber-400/15 via-amber-400/5 to-transparent',
        )}
      >
        <Avatar name={post.author.name} groupId={post.author.team} size={isStaffPost ? 'lg' : 'md'} />
        <div className="min-w-0 flex-1">
          <p className={cn('truncate font-semibold text-ink', isStaffPost ? 'text-base' : 'text-sm')}>
            {post.author.name}
          </p>
          <p className="truncate text-xs text-muted">
            {post.session
              ? `שבוע ${post.session.week_index} · ${post.session.title}`
              : isStaffPost
                ? 'הודעה כללית'
                : 'אימון'}
          </p>
        </div>
        {isStaffPost ? (
          <Badge tone="warning" className="shrink-0 gap-1 text-sm font-bold">
            <Sparkles aria-hidden className="h-3.5 w-3.5" />
            קא״ג
          </Badge>
        ) : post.author.team ? (
          <GroupBadge groupId={post.author.team} short />
        ) : null}
        {isAuthor ? (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={startEdit}
              aria-label="עריכת הפוסט"
              className="btn-ghost h-10 w-10 p-0 text-muted hover:text-ink"
            >
              <Pencil aria-hidden className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              aria-label="מחיקת הפוסט"
              className="btn-ghost h-10 w-10 p-0 text-muted hover:text-rose-500 disabled:opacity-40"
            >
              {isDeleting ? (
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 aria-hidden className="h-4 w-4" />
              )}
            </button>
          </div>
        ) : null}
      </div>

      {/* text-only post: caption reads as the post body, right under the header */}
      {!hasMedia ? <div className="px-4 pb-1 pt-1">{captionArea}</div> : null}

      <PostMedia media={post.media} alt={post.media.caption ?? `תמונת אימון של ${post.author.name}`} />

      {/* actions */}
      <div className="flex items-center gap-1 px-2 pt-2">
        <button
          type="button"
          onClick={onLike}
          aria-pressed={likeState.likedByMe}
          aria-label={likeState.likedByMe ? 'ביטול הלייק' : 'לייק לתמונה'}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
            likeState.likedByMe ? 'text-rose-500' : 'text-muted hover:text-ink',
          )}
        >
          <Heart
            aria-hidden
            className={cn('h-5 w-5 transition-transform', likeState.likedByMe && 'scale-110 fill-current')}
          />
          {compactCount(likeState.likes)}
        </button>

        <a
          href={`#comment-${post.media.id}`}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          <MessageCircle aria-hidden className="h-5 w-5" />
          {comments.length}
        </a>

        <time
          suppressHydrationWarning
          dateTime={post.media.uploaded_at}
          className="ms-auto pe-2 text-xs text-muted"
        >
          {formatRelativeTime(post.media.uploaded_at)}
        </time>
      </div>

      {/* caption + tags (photo/file posts only — text posts render this above) */}
      <div className="space-y-1.5 px-4 pb-2 pt-1">
        {hasMedia ? captionArea : null}
        {post.media.tags.length > 0 ? (
          <p className="flex flex-wrap gap-1">
            {post.media.tags.map((tag) => (
              <span key={tag} className="text-xs font-medium text-accent">
                #{tag.replace(/\s+/g, '')}
              </span>
            ))}
          </p>
        ) : null}
      </div>

      {/* comments */}
      {comments.length > 0 ? (
        <div className="space-y-1.5 px-4 pb-2">
          {comments.length > 2 && !showAllComments ? (
            <button
              type="button"
              onClick={() => setShowAllComments(true)}
              className="text-xs text-muted hover:text-ink"
            >
              הצגת כל {comments.length} התגובות
            </button>
          ) : null}

          <ul className="space-y-1.5">
            {visibleComments.map(({ comment, author }) => (
              <li key={comment.id} className="text-sm">
                <span className="font-semibold text-ink">{author.name.split(' ')[0]}</span>{' '}
                <span className="text-ink/90">{renderCommentBody(comment.body)}</span>
                {author.role === 'trainer' ? (
                  <Badge tone="accent" className="ms-1.5 align-middle">
                    מאמנת
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* add a comment */}
      {mentionAnchor && mentionSuggestions.length > 0
        ? createPortal(
            <ul
              style={{
                position: 'fixed',
                bottom: mentionAnchor.bottom,
                left: mentionAnchor.left,
                width: mentionAnchor.width,
              }}
              className="z-50 overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
            >
              {mentionSuggestions.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      insertMention(user);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-ink hover:bg-elevated"
                  >
                    <Avatar name={user.name} groupId={user.team} size="sm" />
                    {user.name}
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <Avatar name={viewer.name} groupId={viewer.team} size="sm" />
        <input
          ref={commentInputRef}
          id={`comment-${post.media.id}`}
          className="input border-0 bg-transparent px-1 py-2 focus:ring-0"
          placeholder="הוספת תגובה… (@ כדי לתייג)"
          value={draft}
          onChange={onDraftChange}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && mentionSuggestions.length === 0) {
              event.preventDefault();
              onComment();
            } else if (event.key === 'Escape') {
              setMentionQuery(null);
            }
          }}
          aria-label={`תגובה לתמונה של ${post.author.name}`}
        />
        <button
          type="button"
          onClick={onComment}
          disabled={!draft.trim() || isPending}
          className="btn-ghost px-3 py-1.5 text-accent disabled:opacity-40"
        >
          {isPending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : 'פרסום'}
        </button>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------- composer */

function Composer({ viewer, sessions }: { viewer: User; sessions: TrainingSession[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const isTrainer = viewer.role === 'trainer';
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImage, setIsImage] = useState(true);
  const [caption, setCaption] = useState('');
  const [sessionId, setSessionId] = useState(sessions[sessions.length - 1]?.id ?? '');
  const [noSession, setNoSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setDataUrl(null);
    setFileName(null);
    setIsImage(true);
    setCaption('');
    setNoSession(false);
    setError(null);
    setOpen(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeFile = () => {
    setDataUrl(null);
    setFileName(null);
    setIsImage(true);
    if (fileRef.current) fileRef.current.value = '';
  };

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return setError('סוג קובץ לא נתמך — תמונה, PDF או מסמך.');
    }
    if (file.size > MAX_UPLOAD_BYTES) return setError('הקובץ צריך להיות עד 10 מגה-בייט.');
    const reader = new FileReader();
    reader.onload = () => {
      setError(null);
      setDataUrl(String(reader.result));
      setFileName(file.name);
      setIsImage(file.type.startsWith('image/'));
    };
    reader.readAsDataURL(file);
  };

  const publish = () => {
    if (!dataUrl && !caption.trim()) {
      setError('כתבו טקסט או צרפו קובץ.');
      return;
    }
    if (!noSession && !sessionId) return;
    if (noSession && !caption.trim()) {
      setError('הודעה כללית חייבת לכלול טקסט.');
      return;
    }
    startTransition(async () => {
      const result = await uploadSessionMedia({
        session_id: noSession ? null : sessionId,
        user_id: viewer.id,
        image_url: dataUrl,
        caption: caption.trim() || undefined,
        file_name: fileName,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      reset();
      router.refresh();
    });
  };

  return (
    <Card className="overflow-hidden">
      <input
        ref={fileRef}
        type="file"
        accept={ALLOWED_FILE_TYPES.join(',')}
        capture="environment"
        className="sr-only"
        id="feed-photo"
        onChange={(event) => pick(event.target.files?.[0])}
      />

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-elevated"
        >
          <Avatar name={viewer.name} groupId={viewer.team} />
          <span className="flex-1 text-sm text-muted">
            {isTrainer ? 'שיתוף תמונה, קובץ או הודעה…' : 'שיתוף תמונה או הודעה מהאימון…'}
          </span>
          <span className="btn-primary px-3 py-2">
            <Camera aria-hidden className="h-4 w-4" />
            פרסום
          </span>
        </button>
      ) : (
        <div className="space-y-3 p-4">
          {dataUrl ? (
            <div className="relative overflow-hidden rounded-xl border border-line">
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
                <img src={dataUrl} alt="תצוגה מקדימה של התמונה שנבחרה" className="max-h-72 w-full object-cover" />
              ) : (
                <div className="flex items-center gap-3 bg-elevated px-4 py-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface text-accent">
                    <Paperclip aria-hidden className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{fileName}</span>
                </div>
              )}
              <button
                type="button"
                onClick={removeFile}
                aria-label="הסרת הקובץ"
                className="absolute end-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="feed-caption" className="text-sm font-medium text-ink">
              {dataUrl ? 'כיתוב' : 'מה ברצונכם לכתוב?'}{' '}
              {noSession ? <span className="font-normal text-muted">(חובה להודעה כללית)</span> : null}
            </label>
            <textarea
              id="feed-caption"
              className="input min-h-[6rem] resize-y py-2 leading-relaxed"
              placeholder={
                noSession ? 'מה ברצונכם למסור?' : dataUrl ? 'איך היה האימון?' : 'כתבו כאן טקסט, כולל שורות וסעיפים…'
              }
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              rows={dataUrl ? 2 : 6}
            />
          </div>

          {!dataUrl ? (
            <label
              htmlFor="feed-photo"
              className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-accent hover:underline"
            >
              <Paperclip aria-hidden className="h-4 w-4" />
              צירוף תמונה או קובץ (אופציונלי)
            </label>
          ) : null}

          {isTrainer ? (
            <label className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={noSession}
                onChange={(event) => setNoSession(event.target.checked)}
              />
              לא קשור לאימון ספציפי — הודעה כללית
            </label>
          ) : null}

          {!noSession ? (
            <div className="space-y-1.5">
              <label htmlFor="feed-session" className="text-sm font-medium text-ink">
                מאיזה אימון זה?
              </label>
              <select
                id="feed-session"
                className="input"
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
              >
                {[...sessions]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((session) => (
                    <option key={session.id} value={session.id}>
                      שבוע {session.week_index} · {session.title}
                    </option>
                  ))}
              </select>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={reset}>
              ביטול
            </button>
            <button type="button" className="btn-primary" onClick={publish} disabled={isPending}>
              {isPending ? (
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              ) : (
                <Send aria-hidden className="h-4 w-4" />
              )}
              {isPending ? 'מפרסם…' : 'שיתוף בפיד'}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------- feed */

/** Instagram-style feed: photos, files and text updates, with likes and comments. */
export default function SocialFeed({ posts, viewer, sessions, users }: SocialFeedProps) {
  const [group, setGroup] = useState<GroupId | 'all'>('all');

  const filtered =
    group === 'all' ? posts : posts.filter((post) => post.author.team === group);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Composer viewer={viewer} sessions={sessions} />

      <div className="flex flex-wrap gap-2" role="group" aria-label="סינון הפיד לפי קבוצה">
        {[{ id: 'all' as const, label: 'כולם', color: undefined }, ...GROUP_LIST.map((entry) => ({
          id: entry.id,
          label: entry.shortName,
          color: entry.color,
        }))].map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setGroup(option.id)}
            aria-pressed={group === option.id}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              group === option.id
                ? 'border-transparent bg-ink text-bg'
                : 'border-line bg-surface text-muted hover:text-ink',
            )}
          >
            {option.color ? (
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: option.color }} />
            ) : (
              <Sparkles aria-hidden className="h-3.5 w-3.5" />
            )}
            {option.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ImagePlus className="h-6 w-6" />}
            title="עדיין אין תמונות"
            description="היו הראשונים לפרסם — לחצו על „שיתוף תמונה” למעלה והעלו תמונה מהאימון האחרון."
          />
        </Card>
      ) : (
        filtered.map((post) => <PostCard key={post.media.id} post={post} viewer={viewer} users={users} />)
      )}
    </div>
  );
}
