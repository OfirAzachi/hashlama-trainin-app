import type { Metadata } from 'next';
import Link from 'next/link';
import { Inbox, MessageCircle } from 'lucide-react';

import AppShell from '@/components/AppShell';
import NotificationBell from '@/components/NotificationBell';
import { Avatar, Card, CardHeader, EmptyState } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import { requireUser } from '@/lib/auth';
import { getNotifications, markAllNotificationsRead } from '@/lib/data';

export const metadata: Metadata = {
  title: 'תיבת הודעות — השלמה',
};

export const dynamic = 'force-dynamic';

/** Strips the `@[Name](id)` storage token back down to a plain "@Name" for display. */
function plainMentionText(body: string): string {
  return body.replace(/@\[([^\]]+)\]\([0-9a-fA-F-]{36}\)/g, '@$1');
}

export default async function InboxPage() {
  const viewer = await requireUser();
  // Fetched before marking read, so this visit can still highlight what was new.
  const notifications = await getNotifications(viewer.id);
  await markAllNotificationsRead(viewer.id);

  return (
    <AppShell
      title="תיבת הודעות"
      subtitle="כל מקום שבו מישהו תייג אתכם בתגובה בפיד."
      user={{ name: viewer.name, role: viewer.role, hasTeam: Boolean(viewer.team) }}
      contextSlot={<NotificationBell userId={viewer.id} />}
    >
      <div className="mx-auto max-w-xl">
        <Card as="section">
          <CardHeader
            icon={<Inbox className="h-4 w-4" />}
            title="תיוגים"
            subtitle="לחיצה על הודעה פותחת את הפוסט."
          />
          {notifications.length === 0 ? (
            <EmptyState
              icon={<MessageCircle className="h-6 w-6" />}
              title="אין הודעות עדיין"
              description="כשמישהו יתייג אתכם בתגובה בפיד, זה יופיע כאן."
            />
          ) : (
            <ul className="divide-y divide-line">
              {notifications.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/feed#comment-${item.media_id}`}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-elevated',
                      !item.read && 'bg-accent/5',
                    )}
                  >
                    <Avatar name={item.actor.name} groupId={item.actor.team} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">
                        <span className="font-semibold">{item.actor.name}</span> תייג/ה אתכם בתגובה
                      </p>
                      {item.commentBody ? (
                        <p className="mt-0.5 truncate text-sm text-muted">{plainMentionText(item.commentBody)}</p>
                      ) : null}
                      {item.mediaCaption ? (
                        <p className="mt-0.5 truncate text-xs text-muted">בפוסט: {item.mediaCaption}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-muted tnum">{formatRelativeTime(item.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
