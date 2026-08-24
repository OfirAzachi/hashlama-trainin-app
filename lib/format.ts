import type { MetricType } from './types';

/** The whole UI is Hebrew, so dates and numbers format against he-IL. */
const LOCALE = 'he-IL';

/**
 * Wraps a value in a Unicode isolate so it keeps its own direction inside RTL
 * text. Without this, "+11.4" renders as "11.4+" — the sign jumps to the wrong
 * end of the number.
 */
function ltr(value: string): string {
  return `⁦${value}⁩`;
}

/** 1_245 -> "20:45" ; 65 -> "1:05" ; supports hours when needed. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  return hours > 0
    ? `${hours}:${mm}:${String(seconds).padStart(2, '0')}`
    : `${mm}:${String(seconds).padStart(2, '0')}`;
}

/** "20:45" | "20:45.5" | "1245" -> seconds. Returns null when unparseable. */
export function parseDuration(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  const match = /^(\d{1,2}):([0-5]?\d)(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match) return null;
  const [, mm, ss, frac] = match;
  const seconds = Number(mm) * 60 + Number(ss);
  return frac ? seconds + Number(`0.${frac}`) : seconds;
}

/**
 * Normalizes whatever someone just typed into a duration field into
 * "mm:ss" — for display, once they're done typing (call this on blur, not
 * on every keystroke). Digits typed with no separator are read as MMSS
 * concatenated, not raw seconds: "1205" -> "12:05", "45" -> "0:45". A
 * "mm:ss" string is just re-normalized (so "12:75" overflows to "13:15").
 * Anything unparseable is left exactly as typed, so a still-in-progress or
 * genuinely invalid entry never gets silently mangled.
 */
export function normalizeDurationInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^\d+$/.test(trimmed)) {
    const secondsPart = trimmed.slice(-2).padStart(2, '0');
    const minutesPart = trimmed.slice(0, -2) || '0';
    return formatDuration(Number(minutesPart) * 60 + Number(secondsPart));
  }
  const seconds = parseDuration(trimmed);
  return seconds != null ? formatDuration(seconds) : trimmed;
}

/** Signed duration, e.g. -95 -> "−1:35". */
export function formatSignedDuration(seconds: number): string {
  const sign = seconds < 0 ? '−' : '+';
  return ltr(`${sign}${formatDuration(Math.abs(seconds))}`);
}

export function formatPace(secondsPerKm: number): string {
  return `${ltr(formatDuration(secondsPerKm))}/ק"מ`;
}

export function paceFromRun(totalSeconds: number, distanceMeters = 3000): number {
  return totalSeconds / (distanceMeters / 1000);
}

/** The inverse of paceFromRun: total seconds for a distance run at a given pace. */
export function secondsFromPace(secondsPerKm: number, distanceMeters: number): number {
  return secondsPerKm * (distanceMeters / 1000);
}

export function formatPercent(value: number, digits = 1): string {
  return ltr(`${value.toFixed(digits)}%`);
}

export function formatSignedPercent(value: number, digits = 1): string {
  const sign = value < 0 ? '−' : '+';
  return ltr(`${sign}${Math.abs(value).toFixed(digits)}%`);
}

export function formatSignedNumber(value: number, digits = 0): string {
  const sign = value < 0 ? '−' : '+';
  return ltr(`${sign}${Math.abs(value).toFixed(digits)}`);
}

export const METRIC_LABELS: Record<MetricType, string> = {
  reps: 'חזרות',
  time_seconds: 'זמן',
  distance_meters: 'מרחק',
  weight_kg: 'משקל',
};

export const METRIC_UNITS: Record<MetricType, string> = {
  reps: 'חזרות',
  time_seconds: 'דק:שנ',
  distance_meters: 'מטר',
  weight_kg: 'ק"ג',
};

/** Renders a stored metric value in the unit natural to its metric type. */
export function formatMetric(value: number, type: MetricType): string {
  switch (type) {
    case 'time_seconds':
      return formatDuration(value);
    case 'distance_meters':
      return value >= 1000
        ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 2)} ק"מ`
        : `${value} מ'`;
    case 'weight_kg':
      return `${value} ק"ג`;
    case 'reps':
    default:
      return `${value} חזרות`;
  }
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(iso).toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...opts,
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(LOCALE, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Compact relative time for feed posts: "עכשיו", "לפני 4 שע'", "12 באוג׳".
 * Rendered inside <time suppressHydrationWarning> since server and client
 * clocks differ by a few milliseconds.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffSeconds = Math.max(0, Math.floor((now.getTime() - then) / 1000));

  if (diffSeconds < 60) return 'עכשיו';
  if (diffSeconds < 3600) return `לפני ${Math.floor(diffSeconds / 60)} דק'`;
  if (diffSeconds < 86_400) return `לפני ${Math.floor(diffSeconds / 3600)} שע'`;
  if (diffSeconds < 604_800) return `לפני ${Math.floor(diffSeconds / 86_400)} ימים`;
  return formatDate(iso, { year: undefined });
}

/** "1.2k" style counts for likes. */
export function compactCount(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)} אלף` : String(value);
}
