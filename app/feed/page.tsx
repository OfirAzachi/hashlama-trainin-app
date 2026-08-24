import type { Metadata } from 'next';

import AppShell from '@/components/AppShell';
import SocialFeed from '@/components/SocialFeed';
import { requireUser } from '@/lib/auth';
import { getFeed, getSessions, getSessionsForGroup } from '@/lib/data';

export const metadata: Metadata = {
  title: 'פיד — השלמה',
};

export const dynamic = 'force-dynamic';

export default async function FeedPage() {
  const viewer = await requireUser();
  const [posts, sessions] = await Promise.all([
    getFeed(viewer.id),
    viewer.team ? getSessionsForGroup(viewer.team) : getSessions(),
  ]);

  return (
    <AppShell
      title="פיד האימונים"
      subtitle="תמונות מכל האימונים. אפשר לסמן לייק, להגיב ולעודד אחד את השני."
      user={{ name: viewer.name, role: viewer.role }}
    >
      <SocialFeed posts={posts} viewer={viewer} sessions={sessions} />
    </AppShell>
  );
}
