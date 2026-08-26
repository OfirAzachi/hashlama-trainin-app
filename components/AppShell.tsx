'use client';

import { Dumbbell, Images, LayoutDashboard, Moon, Smartphone, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { useTheme } from '@/app/providers';
import { ExerciseGifOverridesProvider } from '@/components/ExerciseGifOverrides';
import SignOutButton from '@/components/SignOutButton';
import { cn } from '@/lib/cn';
import type { Role } from '@/lib/types';

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      className="btn-secondary h-10 w-10 p-0"
      aria-label={`מעבר למצב ${theme === 'dark' ? 'בהיר' : 'כהה'}`}
    >
      {theme === 'dark' ? (
        <Sun aria-hidden className="h-4 w-4" />
      ) : (
        <Moon aria-hidden className="h-4 w-4" />
      )}
    </button>
  );
}

const NAV: Array<{ href: string; label: string; icon: typeof Dumbbell; roles: Role[] }> = [
  { href: '/trainer', label: 'מאמן', icon: LayoutDashboard, roles: ['trainer'] },
  { href: '/participant', label: 'מתאמן', icon: Smartphone, roles: ['participant'] },
  { href: '/feed', label: 'פיד', icon: Images, roles: ['trainer', 'participant'] },
];

/**
 * Shared chrome: brand, role-filtered navigation, theme toggle, the signed-in
 * user's name and a sign-out button, plus an optional page-specific context slot.
 */
export default function AppShell({
  title,
  subtitle,
  user,
  contextSlot,
  children,
}: {
  title: string;
  subtitle?: string;
  /** `hasTeam`: a trainer who has also joined a group gets the participant tab too. */
  user: { name: string; role: Role; hasTeam?: boolean };
  contextSlot?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const nav = NAV.filter((entry) =>
    entry.href === '/participant' ? user.role === 'participant' || user.hasTeam : entry.roles.includes(user.role),
  );

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white">
              <Dumbbell aria-hidden className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-ink">השלמה</span>
          </Link>

          <nav aria-label="תפקיד" className="ms-2 flex gap-1 rounded-xl border border-line bg-elevated p-1">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm',
                    active ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
                  )}
                >
                  <Icon aria-hidden className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="ms-auto flex items-center gap-2">
            {contextSlot}
            <span className="hidden text-xs text-muted sm:inline">{user.name}</span>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-5">
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        </div>
        <ExerciseGifOverridesProvider>{children}</ExerciseGifOverridesProvider>
      </main>

      <footer className="mx-auto max-w-7xl px-4 py-8 text-xs text-muted sm:px-6">
        השלמה — מעקב קורס אימונים
      </footer>
    </div>
  );
}
