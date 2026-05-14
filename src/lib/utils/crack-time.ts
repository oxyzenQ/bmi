/**
 * Format crack time (in seconds) to a localized human-readable string.
 * @param seconds - Crack time in seconds
 * @param t - Translation function (key, params) => string
 */
export function formatCrackTime(
  seconds: number,
  t: (key: string, params?: Record<string, string | number | undefined | null>) => string
): string {
  if (seconds < 1) return t('crypto.crack_instant');

  const units: [string, string, number][] = [
    ['crypto.crack_centuries', 'crypto.crack_centuries_plural', 100 * 365.25 * 24 * 3600],
    ['crypto.crack_years', 'crypto.crack_years_plural', 365.25 * 24 * 3600],
    ['crypto.crack_months', 'crypto.crack_months_plural', 30.44 * 24 * 3600],
    ['crypto.crack_days', 'crypto.crack_days_plural', 24 * 3600],
    ['crypto.crack_hours', 'crypto.crack_hours_plural', 3600],
    ['crypto.crack_minutes', 'crypto.crack_minutes_plural', 60],
    ['crypto.crack_seconds', 'crypto.crack_seconds_plural', 1],
  ];

  for (const [singularKey, pluralKey, unitSeconds] of units) {
    if (seconds >= unitSeconds) {
      const n = Math.round(seconds / unitSeconds);
      const key = n === 1 ? singularKey : pluralKey;
      return t(key, { n });
    }
  }

  return t('crypto.crack_instant');
}