'use client';

import { FileText, ImageOff, Images, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Avatar, Badge, Card, CardHeader, EmptyState, GroupBadge } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime } from '@/lib/format';
import { GROUP_LIST } from '@/lib/groups';
import type { GroupId, Participant, SessionMedia, TrainingSession } from '@/lib/types';

interface MediaGalleryProps {
  media: SessionMedia[];
  participants: Participant[];
  sessions: TrainingSession[];
  /** Hide the group filter on the participant side, where it is meaningless. */
  showGroupFilter?: boolean;
  title?: string;
  subtitle?: string;
}

/** Remote photos can fail (offline demo); fall back to a labelled placeholder. */
function MediaImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-1 bg-elevated text-muted',
          className,
        )}
        role="img"
        aria-label={alt}
      >
        <ImageOff aria-hidden className="h-5 w-5" />
        <span className="px-2 text-center text-[10px]">התמונה לא זמינה במצב לא מקוון</span>
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
      className={cn('object-cover', className)}
    />
  );
}

/** A non-image upload (PDF, doc…) renders as a labelled file card, not a broken <img>. */
function FileThumb({ fileName, className }: { fileName: string | null; className?: string }) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-1 bg-elevated text-muted', className)}
    >
      <FileText aria-hidden className="h-6 w-6" />
      <span className="line-clamp-1 px-2 text-center text-[10px]">{fileName ?? 'קובץ מצורף'}</span>
    </div>
  );
}

/** Picks the right thumbnail for whatever this upload actually is. */
function MediaThumb({ item, alt, className }: { item: SessionMedia; alt: string; className?: string }) {
  if (item.mime_type || !item.image_url) return <FileThumb fileName={item.file_name} className={className} />;
  return <MediaImage src={item.image_url} alt={alt} className={className} />;
}

/**
 * Filterable grid of workout photos, grouped by session date and annotated
 * with the participant, their group and the tagged exercise.
 */
export default function MediaGallery({
  media,
  participants,
  sessions,
  showGroupFilter = true,
  title = 'כל תמונות האימונים',
  subtitle = 'כל מה שהמתאמנים העלו, מקובץ לפי שבוע.',
}: MediaGalleryProps) {
  const [sessionFilter, setSessionFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<GroupId | 'all'>('all');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<SessionMedia | null>(null);

  const participantById = useMemo(
    () => new Map(participants.map((participant) => [participant.id, participant])),
    [participants],
  );
  const sessionById = useMemo(
    () => new Map(sessions.map((session) => [session.id, session])),
    [sessions],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return media.filter((item) => {
      const participant = participantById.get(item.user_id);
      if (sessionFilter !== 'all' && item.session_id !== sessionFilter) return false;
      if (groupFilter !== 'all' && participant?.team !== groupFilter) return false;
      if (!needle) return true;
      const haystack = [
        participant?.name ?? '',
        item.caption ?? '',
        item.tags.join(' '),
        (item.session_id ? sessionById.get(item.session_id)?.title : null) ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [media, query, sessionFilter, groupFilter, participantById, sessionById]);

  /** Grouped by session so the feed reads as a chronological story. */
  const bySession = useMemo(() => {
    const buckets = new Map<string, SessionMedia[]>();
    filtered.forEach((item) => {
      const key = item.session_id ?? 'general';
      const bucket = buckets.get(key) ?? [];
      bucket.push(item);
      buckets.set(key, bucket);
    });
    return [...buckets.entries()].sort(([a], [b]) => {
      const dateA = sessionById.get(a)?.date ?? '';
      const dateB = sessionById.get(b)?.date ?? '';
      return dateB.localeCompare(dateA);
    });
  }, [filtered, sessionById]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActive(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  return (
    <Card as="section">
      <CardHeader
        icon={<Images className="h-4 w-4" />}
        title={title}
        subtitle={subtitle}
        action={<Badge tone="neutral">{filtered.length} תמונות</Badge>}
      />

      {/* ------------------------------------------------------- filters */}
      <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3 sm:px-5">
        <div className="relative min-w-[10rem] flex-1">
          <Search aria-hidden className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className="input ps-9"
            placeholder="חיפוש בכיתובים, שמות ותגיות"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="חיפוש בתמונות"
          />
        </div>

        <select
          className="input w-auto"
          value={sessionFilter}
          onChange={(event) => setSessionFilter(event.target.value)}
          aria-label="סינון לפי אימון"
        >
          <option value="all">כל האימונים</option>
          {[...sessions]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((session) => (
              <option key={session.id} value={session.id}>
                שבוע {session.week_index} · {session.title}
              </option>
            ))}
        </select>

        {showGroupFilter ? (
          <select
            className="input w-auto"
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value as GroupId | 'all')}
            aria-label="סינון לפי קבוצה"
          >
            <option value="all">כל הקבוצות</option>
            {GROUP_LIST.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {/* ---------------------------------------------------------- grid */}
      {bySession.length === 0 ? (
        <EmptyState
          icon={<Images className="h-6 w-6" />}
          title="אין תמונות שתואמות לסינון"
          description="נסו לנקות את החיפוש או לבחור אימון אחר."
        />
      ) : (
        <div className="space-y-6 p-4 sm:p-5">
          {bySession.map(([sessionId, items]) => {
            const session = sessionById.get(sessionId);
            return (
              <section key={sessionId}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink">
                    {session
                      ? `שבוע ${session.week_index} · ${session.title}`
                      : sessionId === 'general'
                        ? 'פרסומים כלליים'
                        : 'אימון לא ידוע'}
                  </h3>
                  {session ? (
                    <span className="text-xs text-muted tnum">{formatDate(session.date)}</span>
                  ) : null}
                  <Badge tone="neutral">{items.length}</Badge>
                </div>

                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {items.map((item) => {
                    const participant = participantById.get(item.user_id);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setActive(item)}
                          className="group w-full overflow-hidden rounded-xl border border-line bg-surface text-start transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <MediaThumb
                            item={item}
                            alt={item.caption ?? `תמונת אימון של ${participant?.name ?? 'מתאמן'}`}
                            className="h-32 w-full transition-transform duration-300 group-hover:scale-[1.03] sm:h-36"
                          />
                          <div className="space-y-1.5 p-2.5">
                            <div className="flex items-center gap-2">
                              <Avatar
                                name={participant?.name ?? '??'}
                                groupId={participant?.team}
                                size="sm"
                              />
                              <span className="truncate text-xs font-medium text-ink">
                                {participant?.name ?? 'לא ידוע'}
                              </span>
                            </div>
                            {item.caption ? (
                              <p className="line-clamp-2 text-[11px] leading-snug text-muted">
                                {item.caption}
                              </p>
                            ) : null}
                            {item.tags.length > 0 ? (
                              <span className="inline-block truncate rounded-full bg-elevated px-2 py-0.5 text-[10px] text-muted">
                                {item.tags[0]}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------ lightbox */}
      {active ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="פרטי התמונה"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setActive(null)}
        >
          <div
            className="max-h-full w-full max-w-2xl overflow-auto rounded-2xl bg-surface"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <Avatar
                  name={participantById.get(active.user_id)?.name ?? '??'}
                  groupId={participantById.get(active.user_id)?.team}
                  size="sm"
                />
                <div>
                  <p className="text-sm font-medium text-ink">
                    {participantById.get(active.user_id)?.name ?? 'לא ידוע'}
                  </p>
                  <p className="text-xs text-muted tnum">{formatDateTime(active.uploaded_at)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="btn-ghost h-10 w-10 p-0"
                aria-label="סגירת התמונה"
              >
                <X aria-hidden className="h-5 w-5" />
              </button>
            </div>

            <MediaThumb item={active} alt={active.caption ?? 'תמונת אימון'} className="max-h-[60vh] w-full" />
            {active.mime_type ? (
              <div className="px-4 pt-3">
                <a href={active.image_url ?? undefined} target="_blank" rel="noreferrer" className="btn-secondary w-full justify-center">
                  <FileText aria-hidden className="h-4 w-4" />
                  פתיחת {active.file_name ?? 'הקובץ'}
                </a>
              </div>
            ) : null}

            <div className="space-y-2 px-4 py-3">
              {active.caption ? <p className="text-sm text-ink">{active.caption}</p> : null}
              <div className="flex flex-wrap items-center gap-2">
                {participantById.get(active.user_id) ? (
                  <GroupBadge groupId={participantById.get(active.user_id)!.team} short />
                ) : null}
                {active.session_id && sessionById.get(active.session_id) ? (
                  <Badge tone="accent">{sessionById.get(active.session_id)!.title}</Badge>
                ) : null}
                {active.tags.map((tag) => (
                  <Badge key={tag} tone="neutral">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
