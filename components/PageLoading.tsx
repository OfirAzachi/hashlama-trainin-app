import { Dumbbell, Loader2 } from 'lucide-react';

/**
 * Shown by Next.js while a route's server data is still loading (App
 * Router's `loading.tsx` convention) — a real navigation between pages, not
 * an in-place refresh. In-place actions (publish, like, comment, edit,
 * delete) each show their own button-level spinner instead and deliberately
 * avoid triggering this, by wrapping their router.refresh() call in its own
 * startTransition.
 */
export default function PageLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg">
      <span className="flex h-12 w-12 animate-pulse items-center justify-center rounded-xl bg-accent text-white">
        <Dumbbell aria-hidden className="h-6 w-6" />
      </span>
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
        טוען…
      </div>
    </div>
  );
}
