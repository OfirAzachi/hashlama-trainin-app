import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import AppShell from '@/components/AppShell';
import ParticipantView from '@/components/ParticipantView';
import { GROUPS_BY_ID } from '@/lib/groups';
import { requireParticipant } from '@/lib/auth';
import { getParticipantSnapshot } from '@/lib/data';

export const metadata: Metadata = {
  title: 'האימונים שלי — השלמה',
};

export const dynamic = 'force-dynamic';

export default async function ParticipantPage() {
  const participant = await requireParticipant();
  const snapshot = await getParticipantSnapshot(participant.id);
  if (!snapshot) notFound();

  const group = GROUPS_BY_ID[snapshot.participant.team];
  const completed = snapshot.trainings.filter((card) => card.status === 'completed').length;
  const due = snapshot.trainings.filter((card) => card.status === 'due').length;

  return (
    <AppShell
      title={`היי ${snapshot.participant.name.split(' ')[0]}`}
      subtitle={`${group.name} · ${completed} מתוך ${snapshot.trainings.length} אימונים הושלמו${
        due === 1
          ? ' · אימון אחד ממתין לתוצאות שלך'
          : due > 1
            ? ` · ${due} אימונים ממתינים לתוצאות שלך`
            : ''
      }`}
      user={{ name: participant.name, role: participant.role }}
    >
      <ParticipantView snapshot={snapshot} />
    </AppShell>
  );
}
