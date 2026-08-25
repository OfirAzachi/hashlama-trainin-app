import type { Metadata } from 'next';

import AppShell from '@/components/AppShell';
import NotificationBell from '@/components/NotificationBell';
import TrainerDashboard from '@/components/TrainerDashboard';
import { requireTrainer } from '@/lib/auth';
import { getCohortSnapshot } from '@/lib/data';

export const metadata: Metadata = {
  title: 'דשבורד מאמן — השלמה',
};

// Reads live data, so never statically cached.
export const dynamic = 'force-dynamic';

export default async function TrainerPage() {
  const trainer = await requireTrainer();
  const snapshot = await getCohortSnapshot();

  return (
    <AppShell
      title="דשבורד המחזור"
      subtitle={`מחוברת כ${trainer.name} · ${snapshot.participants.length} מתאמנים ב-${snapshot.groups.length} קבוצות`}
      user={{ name: trainer.name, role: trainer.role }}
      contextSlot={<NotificationBell userId={trainer.id} />}
    >
      <TrainerDashboard snapshot={snapshot} />
    </AppShell>
  );
}
