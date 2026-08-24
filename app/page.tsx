import { ArrowLeft, Dumbbell, Images, LayoutDashboard, LogOut, Smartphone } from 'lucide-react';
import Link from 'next/link';

import { signOut } from '@/app/login/actions';
import GroupStandings from '@/components/GroupStandings';
import { requireUser } from '@/lib/auth';
import { getHomeHighlights } from '@/lib/data';
import type { Role } from '@/lib/types';

export const dynamic = 'force-dynamic';

const QUICK_LINKS: Array<{ href: string; label: string; icon: typeof Smartphone; roles: Role[] }> = [
  { href: '/participant', label: 'האימונים שלי', icon: Smartphone, roles: ['participant'] },
  { href: '/feed', label: 'הפיד', icon: Images, roles: ['trainer', 'participant'] },
  { href: '/trainer', label: 'מסך המאמן', icon: LayoutDashboard, roles: ['trainer'] },
];

export default async function HomePage() {
  const viewer = await requireUser();
  const highlights = await getHomeHighlights();
  const quickLinks = QUICK_LINKS.filter((link) => link.roles.includes(viewer.role));

  return (
    <main id="main" className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white">
              <Dumbbell aria-hidden className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">השלמה</h1>
              <p className="text-sm text-muted">מי מוביל השבוע?</p>
            </div>
          </div>

          <nav aria-label="קישורים מהירים" className="flex flex-wrap items-center gap-2">
            {quickLinks.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="btn-secondary py-2">
                <Icon aria-hidden className="h-4 w-4" />
                {label}
              </Link>
            ))}
            <form action={signOut}>
              <button type="submit" className="btn-secondary py-2" aria-label="התנתקות">
                <LogOut aria-hidden className="h-4 w-4" />
                התנתקות
              </button>
            </form>
          </nav>
        </div>

        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
          כל אימון שאתם רושמים — ריצה, סיבולת אירובית או שרירים — מוסיף נקודות לקבוצה שלכם. אלה
          התוצאות עד עכשיו.
        </p>
      </header>

      <GroupStandings highlights={highlights} myGroup={viewer.team ?? null} />

      <div className="mt-10 rounded-2xl border border-line bg-elevated p-5 text-center">
        <p className="text-base font-semibold text-ink">רוצים לדחוף את הקבוצה שלכם קדימה?</p>
        <p className="mt-1 text-sm text-muted">
          תרגיל אחד שנרשם שווה נקודות. אימון שלא נרשם נחשב כאימון שלא הושלם.
        </p>
        <Link href="/participant" className="btn-primary mt-4">
          לאימון של השבוע
          <ArrowLeft aria-hidden className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>
    </main>
  );
}
