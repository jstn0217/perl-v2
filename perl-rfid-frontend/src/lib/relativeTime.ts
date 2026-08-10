const UNITS: Array<{ limit: number; divisor: number; label: string }> = [
  { limit: 60, divisor: 1, label: 'second' },
  { limit: 3600, divisor: 60, label: 'minute' },
  { limit: 86400, divisor: 3600, label: 'hour' },
  { limit: Infinity, divisor: 86400, label: 'day' }
];

export const formatRelativeTime = (isoTimestamp: string | null): string => {
  if (!isoTimestamp) return 'Never connected';

  const elapsedSeconds = Math.max(0, (Date.now() - new Date(isoTimestamp).getTime()) / 1000);

  if (elapsedSeconds < 5) return 'Just now';

  const unit = UNITS.find((entry) => elapsedSeconds < entry.limit) ?? UNITS[UNITS.length - 1];
  const value = Math.floor(elapsedSeconds / unit.divisor);

  return `${value} ${unit.label}${value === 1 ? '' : 's'} ago`;
};
