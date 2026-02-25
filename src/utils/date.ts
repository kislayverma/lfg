/**
 * Normalizes a Date to local midnight for consistent date comparisons.
 */
export function normalizeToMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Returns the timestamp of local midnight for a given date.
 */
export function toMidnightTimestamp(date: Date): number {
  return normalizeToMidnight(date).getTime();
}

/**
 * Returns today's date normalized to local midnight.
 */
export function todayMidnight(): Date {
  return normalizeToMidnight(new Date());
}

/**
 * Formats a Date as YYYY-MM-DD string using local time.
 */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the previous calendar day (local midnight).
 */
export function previousDay(date: Date): Date {
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 1);
  return normalizeToMidnight(prev);
}

/**
 * Returns a human-readable relative time string (e.g., "2 days ago").
 */
export function relativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'just now';
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) {
    return 'yesterday';
  }
  return `${diffDays}d ago`;
}

/**
 * Returns an array of dates in a month for calendar grid rendering.
 * Includes leading days from previous month and trailing days from next month
 * to fill complete weeks (Sunday start).
 */
export function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const days: Date[] = [];

  // Leading days from previous month
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push(d);
  }

  // Days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }

  // Trailing days to fill last week
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i));
    }
  }

  return days;
}
