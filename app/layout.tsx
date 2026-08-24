import type { Metadata, Viewport } from 'next';
import { Heebo } from 'next/font/google';

import { Providers } from './providers';
import './globals.css';

// Heebo carries both Hebrew and Latin glyphs, so mixed strings stay consistent.
const heebo = Heebo({ subsets: ['hebrew', 'latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'השלמה — מעקב אימונים',
  description:
    'ניהול קורס כושר מבוסס מדדים: אנליטיקה קבוצתית, אימונים שבועיים, משחק נקודות ומעקב התקדמות למאמנים ולמתאמנים.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf9' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0c0e' },
  ],
};

/** Applies the stored theme before first paint to avoid a light flash. */
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('hashlama-theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-bg font-sans text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white focus:start-4"
        >
          דילוג לתוכן
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
