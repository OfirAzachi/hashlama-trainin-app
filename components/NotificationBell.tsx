import { Bell } from 'lucide-react';
import Link from 'next/link';

import { getUnreadNotificationCount } from '@/lib/data';

/** The mailbox entry point in the header: a bell with an unread badge, linking to /inbox. */
export default async function NotificationBell({ userId }: { userId: string }) {
  const unread = await getUnreadNotificationCount(userId);

  return (
    <Link
      href="/inbox"
      className="btn-secondary relative h-10 w-10 p-0"
      aria-label={unread > 0 ? `תיבת הודעות, ${unread} לא נקראו` : 'תיבת הודעות'}
    >
      <Bell aria-hidden className="h-4 w-4" />
      {unread > 0 ? (
        <span
          aria-hidden
          className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white"
        >
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
    </Link>
  );
}
