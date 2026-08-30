'use client';

import {
  Bold,
  Camera,
  FileText,
  Heart,
  ImageOff,
  ImagePlus,
  List,
  ListOrdered,
  Loader2,
  MessageCircle,
  Paperclip,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import { useEffect, useLayoutEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

import {
  addMediaComment,
  deleteMediaComment,
  deleteMediaPost,
  toggleMediaLike,
  updateMediaPost,
  uploadSessionMedia,
} from '@/app/actions';
import { Avatar, Badge, Card, EmptyState, GroupBadge } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { compactCount, formatRelativeTime } from '@/lib/format';
import { GROUP_LIST } from '@/lib/groups';
import { fileToDataUrl } from '@/lib/image-resize';
import { renderFormattedText } from '@/lib/richtext';
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
const MENTION_RENDER_PATTERN = /@\[([^\]]+)\]\((?:[0-9a-fA-F-]{36}|all)\)/g;

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

type MentionField = HTMLInputElement | HTMLTextAreaElement;

/**
 * Shared @-autocomplete behavior for any single text field — the comment
 * box, the post composer, and the caption editor all use this the same way.
 * Tracks which real users got inserted so the field's raw text (just
 * "@Name") can be turned into `@[Name](id)` storage tokens at submit time.
 */
function useMentionAutocomplete(
  elRef: RefObject<MentionField>,
  value: string,
  onChange: (next: string) => void,
  users: User[],
  excludeUserId: string,
) {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentions, setMentions] = useState<Array<{ id: string; name: string }>>([]);
  const [anchor, setAnchor] = useState<{ bottom: number; left: number; width: number } | null>(null);

  const suggestions =
    mentionQuery !== null
      ? users
          .filter((user) => user.id !== excludeUserId)
          .filter((user) => user.name.toLowerCase().includes(mentionQuery.toLowerCase()))
          .slice(0, 5)
      : [];
  // A pinned "tag everyone" option — filterable the same way a name is, so
  // typing "@כ" still surfaces it alongside real matches.
  const showAllOption = mentionQuery !== null && 'כולם'.includes(mentionQuery.toLowerCase());
  const menuOpen = suggestions.length > 0 || showAllOption;

  // Positioned in the viewport (not the field) and portaled to <body> — posts
  // and their media containers use overflow-hidden to clip photo corners,
  // which would otherwise silently clip this dropdown too, making it look
  // like @mentions just don't do anything.
  useLayoutEffect(() => {
    if (!menuOpen) {
      setAnchor(null);
      return;
    }
    const el = elRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setAnchor({ bottom: window.innerHeight - rect.top + 4, left: rect.left, width: Math.max(rect.width, 224) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-measure whenever the suggestion set (or query) changes
  }, [mentionQuery, menuOpen]);

  useEffect(() => {
    if (!anchor) return;
    const close = () => setMentionQuery(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [anchor]);

  const handleChange = (el: MentionField) => {
    const nextValue = el.value;
    const cursor = el.selectionStart ?? nextValue.length;
    onChange(nextValue);
    const match = /@([^\s@]{0,30})$/.exec(nextValue.slice(0, cursor));
    setMentionQuery(match ? match[1] : null);
  };

  const insertMentionValue = (id: string, name: string) => {
    const el = elRef.current;
    const cursor = el?.selectionStart ?? value.length;
    const beforeCursor = value.slice(0, cursor);
    const atIndex = beforeCursor.lastIndexOf('@');
    if (atIndex === -1) return;
    const before = value.slice(0, atIndex);
    const after = value.slice(cursor);
    const insertion = `@${name} `;
    onChange(before + insertion + after);
    setMentions((current) => (current.some((m) => m.id === id) ? current : [...current, { id, name }]));
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const pos = before.length + insertion.length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };

  return {
    suggestions,
    showAllOption,
    menuOpen,
    anchor,
    handleChange,
    insertMention: (user: User) => insertMentionValue(user.id, user.name),
    // "all" is a reserved id the server expands to every cohort member —
    // never a real user id, so there's no collision risk.
    insertAllMention: () => insertMentionValue('all', 'כולם'),
    closeMenu: () => setMentionQuery(null),
    /** Call once the field's text has been submitted, to clear tracked mentions. */
    reset: () => {
      setMentions([]);
      setMentionQuery(null);
    },
    /** Turns the field's plain "@Name" text into `@[Name](id)` storage tokens. */
    encode: (raw: string) => encodeMentions(raw, mentions),
  };
}

/** The floating @mention suggestion list, portaled to `<body>` so it's never clipped by a card. */
function MentionMenu({
  anchor,
  suggestions,
  onSelect,
  showAllOption,
  onSelectAll,
}: {
  anchor: { bottom: number; left: number; width: number };
  suggestions: User[];
  onSelect: (user: User) => void;
  showAllOption?: boolean;
  onSelectAll?: () => void;
}) {
  return createPortal(
    <ul
      style={{ position: 'fixed', bottom: anchor.bottom, left: anchor.left, width: anchor.width }}
      className="z-50 overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
    >
      {showAllOption && onSelectAll ? (
        <li>
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              onSelectAll();
            }}
            className="flex w-full items-center gap-2 border-b border-line px-3 py-2 text-start text-sm font-medium text-accent hover:bg-elevated"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Users aria-hidden className="h-4 w-4" />
            </span>
            תיוג כולם
          </button>
        </li>
      ) : null}
      {suggestions.map((user) => (
        <li key={user.id}>
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(user);
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
  );
}

/* --------------------------------------------------------- rich text */

// A light markdown subset instead of a raw HTML editor: **bold**, "- " for a
// bullet list, "N. " for a numbered list. Simple enough to type by hand too,
// but the toolbar below means nobody has to know the syntax exists.

/** Wraps the current selection in `**…**` (or inserts a placeholder if nothing's selected). */
function applyBold(el: HTMLTextAreaElement, value: string, onChange: (next: string) => void) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const selected = value.slice(start, end);
  const text = selected || 'טקסט מודגש';
  const next = value.slice(0, start) + `**${text}**` + value.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    if (selected) el.setSelectionRange(start + 2, end + 2);
    else el.setSelectionRange(start + 2, start + 2 + text.length);
  });
}

/** Toggles a "- " or "N. " prefix on every line the selection touches. */
function applyListPrefix(
  el: HTMLTextAreaElement,
  value: string,
  onChange: (next: string) => void,
  ordered: boolean,
) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEndIndex = value.indexOf('\n', end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;

  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const prefixPattern = ordered ? /^\d+\.\s/ : /^-\s/;
  const alreadyListed = lines.every((line) => prefixPattern.test(line) || line.trim() === '');

  let counter = 1;
  const nextLines = lines.map((line) => {
    if (line.trim() === '') return line;
    const stripped = line.replace(/^(-|\d+\.)\s/, '');
    return alreadyListed ? stripped : ordered ? `${counter++}. ${stripped}` : `- ${stripped}`;
  });
  const nextBlock = nextLines.join('\n');
  const next = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start, end + (nextBlock.length - block.length));
  });
}

/** The three-button toolbar shared by the composer and the caption editor. */
function FormattingToolbar({
  textareaRef,
  value,
  onChange,
}: {
  textareaRef: RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (next: string) => void;
}) {
  const run = (fn: (el: HTMLTextAreaElement) => void) => {
    const el = textareaRef.current;
    if (el) fn(el);
  };
  return (
    <div className="flex items-center gap-1 rounded-t-xl border border-b-0 border-line bg-elevated/50 px-2 py-1.5">
      <button
        type="button"
        onClick={() => run((el) => applyBold(el, value, onChange))}
        className="btn-ghost h-8 w-8 p-0"
        aria-label="הדגשה"
        title="הדגשה"
      >
        <Bold aria-hidden className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => run((el) => applyListPrefix(el, value, onChange, false))}
        className="btn-ghost h-8 w-8 p-0"
        aria-label="רשימת תבליטים"
        title="רשימת תבליטים"
      >
        <List aria-hidden className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => run((el) => applyListPrefix(el, value, onChange, true))}
        className="btn-ghost h-8 w-8 p-0"
        aria-label="רשימה ממוספרת"
        title="רשימה ממוספרת"
      >
        <ListOrdered aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
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
  const commentInputRef = useRef<HTMLInputElement>(null);
  const commentMention = useMentionAutocomplete(commentInputRef, draft, setDraft, users, viewer.id);
  const [comments, setComments] = useState(post.comments);
  const [isPending, startTransition] = useTransition();

  const isAuthor = post.author.id === viewer.id;
  const [caption, setCaption] = useState(post.media.caption ?? '');
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(caption);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editMention = useMentionAutocomplete(editTextareaRef, editDraft, setEditDraft, users, viewer.id);
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
      const result = await updateMediaPost(post.media.id, viewer.id, editMention.encode(editDraft));
      if (!result.ok) {
        setEditError(result.error);
        return;
      }
      setCaption(result.data.caption ?? '');
      editMention.reset();
      setIsEditing(false);
      // A fresh startTransition here (not just the one already wrapping this
      // async callback) — React only treats router.refresh() as a transition
      // (background update, no route-level loading fallback) if it's called
      // synchronously inside a startTransition call; the outer one stopped
      // covering it the moment we crossed the `await` above.
      startSaveTransition(() => router.refresh());
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
      startDeleteTransition(() => router.refresh());
    });
  };

  const onLike = () => {
    startTransition(async () => {
      setLikeState({
        likes: likeState.likes + (likeState.likedByMe ? -1 : 1),
        likedByMe: !likeState.likedByMe,
      });
      await toggleMediaLike(post.media.id, viewer.id);
    });
  };

  const onComment = () => {
    const body = draft.trim();
    if (!body) return;
    const finalBody = commentMention.encode(body);
    setDraft('');
    commentMention.reset();
    startTransition(async () => {
      const result = await addMediaComment(post.media.id, viewer.id, finalBody);
      if (result.ok) {
        setComments((current) => [...current, { comment: result.data, author: viewer }]);
      }
    });
  };

  const onDeleteComment = (commentId: string) => {
    setComments((current) => current.filter((entry) => entry.comment.id !== commentId));
    startTransition(async () => {
      await deleteMediaComment(commentId, viewer.id);
    });
  };

  if (isDeleted) return null;

  const visibleComments = showAllComments ? comments : comments.slice(-2);
  const isStaffPost = post.author.role === 'trainer';
  const hasMedia = Boolean(post.media.image_url);

  const captionArea = isEditing ? (
    <div className="relative space-y-1.5">
      <FormattingToolbar textareaRef={editTextareaRef} value={editDraft} onChange={setEditDraft} />
      <textarea
        ref={editTextareaRef}
        className="input min-h-[5rem] resize-y rounded-t-none py-2 leading-relaxed"
        value={editDraft}
        onChange={(event) => editMention.handleChange(event.target)}
        placeholder="כיתוב (@ כדי לתייג)"
        aria-label="עריכת הכיתוב"
        autoFocus
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            if (editMention.menuOpen) editMention.closeMenu();
            else setIsEditing(false);
          }
        }}
      />
      {editMention.anchor && editMention.menuOpen ? (
        <MentionMenu
          anchor={editMention.anchor}
          suggestions={editMention.suggestions}
          onSelect={editMention.insertMention}
          showAllOption={editMention.showAllOption}
          onSelectAll={editMention.insertAllMention}
        />
      ) : null}
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
    <div className={cn('text-sm text-ink', !hasMedia && 'text-[15px] leading-relaxed')}>
      {renderFormattedText(caption)}
    </div>
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
        <div className="space-y-1.5 border-t border-line px-4 pb-2 pt-2">
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
              <li key={comment.id} className="flex items-start justify-between gap-2 text-sm">
                <span>
                  <span className="font-semibold text-ink">{author.name.split(' ')[0]}</span>{' '}
                  <span className="text-ink/90">{renderCommentBody(comment.body)}</span>
                  {author.role === 'trainer' ? (
                    <Badge tone="accent" className="ms-1.5 align-middle">
                      מאמנת
                    </Badge>
                  ) : null}
                </span>
                {author.id === viewer.id ? (
                  <button
                    type="button"
                    onClick={() => onDeleteComment(comment.id)}
                    aria-label="מחיקת התגובה"
                    className="btn-ghost h-6 w-6 shrink-0 p-0 text-muted hover:text-rose-500"
                  >
                    <Trash2 aria-hidden className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* add a comment */}
      {commentMention.anchor && commentMention.menuOpen ? (
        <MentionMenu
          anchor={commentMention.anchor}
          suggestions={commentMention.suggestions}
          onSelect={commentMention.insertMention}
          showAllOption={commentMention.showAllOption}
          onSelectAll={commentMention.insertAllMention}
        />
      ) : null}
      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <Avatar name={viewer.name} groupId={viewer.team} size="sm" />
        <input
          ref={commentInputRef}
          id={`comment-${post.media.id}`}
          className="input border-0 bg-transparent px-1 py-2 focus:ring-0"
          placeholder="הוספת תגובה… (@ כדי לתייג)"
          value={draft}
          onChange={(event) => commentMention.handleChange(event.target)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !commentMention.menuOpen) {
              event.preventDefault();
              onComment();
            } else if (event.key === 'Escape') {
              commentMention.closeMenu();
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
          פרסום
        </button>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------- composer */

function Composer({ viewer, sessions, users }: { viewer: User; sessions: TrainingSession[]; users: User[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const isTrainer = viewer.role === 'trainer';
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImage, setIsImage] = useState(true);
  const [caption, setCaption] = useState('');
  const captionMention = useMentionAutocomplete(captionRef, caption, setCaption, users, viewer.id);
  const [sessionId, setSessionId] = useState(sessions[sessions.length - 1]?.id ?? '');
  const [noSession, setNoSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setDataUrl(null);
    setFileName(null);
    setIsImage(true);
    setCaption('');
    captionMention.reset();
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
    fileToDataUrl(file).then((result) => {
      setError(null);
      setDataUrl(result);
      setFileName(file.name);
      setIsImage(file.type.startsWith('image/'));
    });
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
        caption: caption.trim() ? captionMention.encode(caption.trim()) : undefined,
        file_name: fileName,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      reset();
      startTransition(() => router.refresh());
    });
  };

  return (
    <Card className="overflow-hidden">
      <input
        ref={fileRef}
        type="file"
        accept={ALLOWED_FILE_TYPES.join(',')}
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
            <FormattingToolbar textareaRef={captionRef} value={caption} onChange={setCaption} />
            <div className="relative">
              <textarea
                ref={captionRef}
                id="feed-caption"
                className="input min-h-[6rem] resize-y rounded-t-none py-2 leading-relaxed"
                placeholder={
                  noSession
                    ? 'מה ברצונכם למסור? (@ כדי לתייג)'
                    : dataUrl
                      ? 'איך היה האימון? (@ כדי לתייג)'
                      : 'כתבו כאן טקסט, כולל שורות וסעיפים… (@ כדי לתייג)'
                }
                value={caption}
                onChange={(event) => captionMention.handleChange(event.target)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') captionMention.closeMenu();
                }}
                rows={dataUrl ? 2 : 6}
              />
              {captionMention.anchor && captionMention.menuOpen ? (
                <MentionMenu
                  anchor={captionMention.anchor}
                  suggestions={captionMention.suggestions}
                  onSelect={captionMention.insertMention}
                  showAllOption={captionMention.showAllOption}
                  onSelectAll={captionMention.insertAllMention}
                />
              ) : null}
            </div>
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
      <Composer viewer={viewer} sessions={sessions} users={users} />

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
