/**
 * Formats a date string or Date object to a locale date string using UTC.
 * This prevents timezone shifts where a date at midnight UTC shows as the previous day in western timezones.
 */
export const formatLocalDate = (date: string | Date | undefined | null, locale = 'fr-FR', options: Intl.DateTimeFormatOptions = {}): string => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';

    return d.toLocaleDateString(locale, { ...options, timeZone: 'UTC' });
};

/**
 * Gets the UTC day of the week (0-6) from a date.
 */
export const getUTCDayOfWeek = (date: string | Date | undefined | null): number | null => {
    if (!date) return null;
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return null;
    return d.getUTCDay();
};

/**
 * Normalizes a date to UTC midnight for comparison.
 */
export const normalizeToUTC = (date: string | Date | undefined | null): Date | null => {
    if (!date) return null;
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return null;

    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};
