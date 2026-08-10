const DEFAULT_TIMEZONE = 'UTC';

const dateKeyFormatterCache = new Map<string, Intl.DateTimeFormat>();

const getDateKeyFormatter = (timezone: string): Intl.DateTimeFormat => {
  let formatter = dateKeyFormatterCache.get(timezone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    dateKeyFormatterCache.set(timezone, formatter);
  }

  return formatter;
};

/**
 * Derives the calendar-day key (YYYY-MM-DD) for an ISO timestamp as observed
 * in the given IANA timezone. Falls back to UTC if the timezone is missing
 * or invalid, matching the platform's prior UTC-only behavior.
 */
export const toLocalDateKey = (isoDate: string, timezone?: string | null): string => {
  try {
    return getDateKeyFormatter(timezone || DEFAULT_TIMEZONE).format(new Date(isoDate));
  } catch {
    return getDateKeyFormatter(DEFAULT_TIMEZONE).format(new Date(isoDate));
  }
};
