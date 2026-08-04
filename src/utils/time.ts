/**
 * Time formatting helpers. All input times are epoch milliseconds unless noted.
 */

export function formatClock(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** "in 4 min", "now", "12 min late", etc. */
export function formatRelativeMinutes(epochMs: number, now = Date.now()): string {
  const diffMin = Math.round((epochMs - now) / 60_000);
  if (diffMin <= 0) return "now";
  if (diffMin === 1) return "1 min";
  return `${diffMin} min`;
}

/** Compact duration ("32 min", "1h 12m"). */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.round(seconds / 60);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h}h ${m}m`;
}

/**
 * Schedule deviation is reported in seconds by OBA. Positive = late.
 * We normalize to a short human phrase.
 */
export function formatDeviation(seconds: number | undefined): string | null {
  if (seconds === undefined || Math.abs(seconds) < 60) return null;
  const min = Math.round(seconds / 60);
  return min > 0 ? `${min} min late` : `${Math.abs(min)} min early`;
}
