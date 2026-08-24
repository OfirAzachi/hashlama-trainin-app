'use client';

import { ClipboardList, LineChart } from 'lucide-react';
import { useState } from 'react';

import ParticipantDashboard from '@/components/ParticipantDashboard';
import TrainingsList from '@/components/TrainingsList';
import { cn } from '@/lib/cn';
import type { ParticipantSnapshot } from '@/lib/types';

type Tab = 'trainings' | 'progress';

const TABS: Array<{ value: Tab; label: string; icon: typeof LineChart }> = [
  { value: 'trainings', label: 'האימונים שלי', icon: ClipboardList },
  { value: 'progress', label: 'ההתקדמות שלי', icon: LineChart },
];

/** Mobile-first participant shell with a thumb-reachable bottom tab bar. */
export default function ParticipantView({ snapshot }: { snapshot: ParticipantSnapshot }) {
  const [tab, setTab] = useState<Tab>('trainings');

  return (
    <div className="pb-20 sm:pb-0">
      <div
        role="tablist"
        aria-label="מסכי המתאמן"
        className="mb-4 hidden gap-1 rounded-xl border border-line bg-elevated p-1 sm:inline-flex"
      >
        {TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              tab === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            <Icon aria-hidden className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'trainings' ? (
        <TrainingsList participant={snapshot.participant} trainings={snapshot.trainings} />
      ) : null}

      {tab === 'progress' ? <ParticipantDashboard snapshot={snapshot} /> : null}

      <nav
        aria-label="מסכי המתאמן"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur sm:hidden"
      >
        {TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            aria-current={tab === value ? 'page' : undefined}
            onClick={() => setTab(value)}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
              tab === value ? 'text-accent' : 'text-muted',
            )}
          >
            <Icon aria-hidden className="h-5 w-5" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
