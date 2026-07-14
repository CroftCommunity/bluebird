// A gentle, human timestamp. Not a counter or a metric — just orientation. No
// "seconds ago" precision jitter; big buckets suit the calm, no-metrics stance.

export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.round((now - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const date = new Date(then);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
