'use client';

import {
  Camera,
  Heart,
  ImageOff,
  ImagePlus,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { useOptimistic, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { addMediaComment, toggleMediaLike, uploadSessionMedia } from '@/app/actions';
import { Avatar, Badge, Card, EmptyState, GroupBadge } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { compactCount, formatRelativeTime } from '@/lib/format';
import { GROUP_LIST } from '@/lib/groups';
import type { FeedPost, GroupId, TrainingSession, User } from '@/lib/types';

interface SocialFeedProps {
  posts: FeedPost[];
  viewer: User;
  /** Sessions the viewer can tag a new photo with. */
  sessions: TrainingSession[];
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

/* -------------------------------------------------------------- post */

function PostCard({ post, viewer }: { post: FeedPost; viewer: User }) {
  const router = useRouter();
  const [showAllComments, setShowAllComments] = useState(false);
  const [draft, setDraft] = useState('');
  const [comments, setComments] = useState(post.comments);
  const [isPending, startTransition] = useTransition();

  // Optimistic like: the heart flips instantly, the action reconciles after.
  const [likeState, setLikeState] = useOptimistic(
    { likes: post.likes, likedByMe: post.likedByMe },
    (_current, next: { likes: number; likedByMe: boolean }) => next,
  );

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

  const onComment = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    startTransition(async () => {
      const result = await addMediaComment(post.media.id, viewer.id, body);
      if (result.ok) {
        setComments((current) => [...current, { comment: result.data, author: viewer }]);
        router.refresh();
      }
    });
  };

  const visibleComments = showAllComments ? comments : comments.slice(-2);
  const isStaffPost = post.author.role === 'trainer';

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
            {post.session ? `שבוע ${post.session.week_index} · ${post.session.title}` : 'אימון'}
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
      </div>

      <PostImage src={post.media.image_url} alt={post.media.caption ?? `תמונת אימון של ${post.author.name}`} />

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

      {/* caption + tags */}
      <div className="space-y-1 px-4 pb-2 pt-1">
        {post.media.caption ? (
          <p className="text-sm text-ink">
            <span className="font-semibold">{post.author.name.split(' ')[0]}</span>{' '}
            {post.media.caption}
          </p>
        ) : null}
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
                <span className="text-ink/90">{comment.body}</span>
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
      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <Avatar name={viewer.name} groupId={viewer.team} size="sm" />
        <input
          id={`comment-${post.media.id}`}
          className="input border-0 bg-transparent px-1 py-2 focus:ring-0"
          placeholder="הוספת תגובה…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onComment();
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
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [sessionId, setSessionId] = useState(sessions[sessions.length - 1]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setPhoto(null);
    setCaption('');
    setOpen(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('בחרו קובץ תמונה.');
    if (file.size > 5 * 1024 * 1024) return setError('התמונה צריכה להיות עד 5 מגה-בייט.');
    const reader = new FileReader();
    reader.onload = () => {
      setError(null);
      setPhoto(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const publish = () => {
    if (!photo || !sessionId) return;
    startTransition(async () => {
      const result = await uploadSessionMedia({
        session_id: sessionId,
        user_id: viewer.id,
        image_url: photo,
        caption: caption.trim() || undefined,
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
        accept="image/*"
        capture="environment"
        className="sr-only"
        id="feed-photo"
        onChange={(event) => {
          pick(event.target.files?.[0]);
          setOpen(true);
        }}
      />

      {!open || !photo ? (
        <label
          htmlFor="feed-photo"
          className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-elevated"
        >
          <Avatar name={viewer.name} groupId={viewer.team} />
          <span className="flex-1 text-sm text-muted">שיתוף תמונה מהאימון…</span>
          <span className="btn-primary px-3 py-2">
            <Camera aria-hidden className="h-4 w-4" />
            פרסום
          </span>
        </label>
      ) : (
        <div className="space-y-3 p-4">
          <div className="relative overflow-hidden rounded-xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
            <img src={photo} alt="תצוגה מקדימה של התמונה שנבחרה" className="max-h-72 w-full object-cover" />
            <button
              type="button"
              onClick={reset}
              aria-label="ביטול התמונה"
              className="absolute end-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="feed-caption" className="text-sm font-medium text-ink">
              כיתוב
            </label>
            <input
              id="feed-caption"
              className="input"
              placeholder="איך היה האימון?"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
            />
          </div>

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

/** Instagram-style feed: photos from every training, with likes and comments. */
export default function SocialFeed({ posts, viewer, sessions }: SocialFeedProps) {
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
        filtered.map((post) => <PostCard key={post.media.id} post={post} viewer={viewer} />)
      )}
    </div>
  );
}
