import { buildLicitacion } from '@/__tests__/factories';
import {
  cn,
  parseSheetDateValue,
  formatSiteVisitDate,
  normalizeTimeValue,
  formatTimeLabel,
  truncate,
  extractTownFromLocation,
  badgeText,
  resolvePdfUrl,
  parseConfidence,
  computeWorthItScore,
  sortLicitaciones,
  arrayToCSV,
  downloadCSV,
  exportToICalendar,
} from '../utils';

// ---------------------------------------------------------------------------
// Helper: read Blob content as text (jsdom Blob lacks .text()).
// Must temporarily restore real timers so the FileReader async callback fires.
// ---------------------------------------------------------------------------

async function readBlobAsText(blob: Blob): Promise<string> {
  vi.useRealTimers();
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
  vi.useFakeTimers();
  return text;
}

// ---------------------------------------------------------------------------
// cn
// ---------------------------------------------------------------------------

describe('cn', () => {
  it('merges simple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('removes duplicate tailwind classes keeping the last', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('handles conditional classes via clsx objects', () => {
    expect(cn('base', { hidden: true, flex: false })).toBe('base hidden');
  });

  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles arrays of class names', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c');
  });
});

// ---------------------------------------------------------------------------
// parseSheetDateValue
// ---------------------------------------------------------------------------

describe('parseSheetDateValue', () => {
  it('returns null for null', () => {
    expect(parseSheetDateValue(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseSheetDateValue(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseSheetDateValue('')).toBeNull();
  });

  it('returns null for "No disponible"', () => {
    expect(parseSheetDateValue('No disponible')).toBeNull();
  });

  it('returns null for "no disponible" (case-insensitive)', () => {
    expect(parseSheetDateValue('no disponible')).toBeNull();
  });

  it('parses an Excel serial date (number > 59)', () => {
    // Excel serial 45000 => ~2023-02-10
    const result = parseSheetDateValue('45000');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBeGreaterThanOrEqual(2023);
  });

  it('parses an ISO date string', () => {
    const result = parseSheetDateValue('2025-03-15');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2025);
    // Use getUTCMonth/getUTCDate because "2025-03-15" is parsed as UTC midnight
    expect(result!.getUTCMonth()).toBe(2); // March is 2
    expect(result!.getUTCDate()).toBe(15);
  });

  it('parses a small number <= 59 as a date string (interpreted as a year)', () => {
    // '50' is not > 59 so the serial path is skipped, but new Date('50') parses
    // as the year 1950, which is a valid Date object.
    const result = parseSheetDateValue('50');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(1950);
  });

  it('returns null for nonsensical strings', () => {
    expect(parseSheetDateValue('banana')).toBeNull();
  });

  it('handles whitespace-padded values', () => {
    const result = parseSheetDateValue('  2025-06-01  ');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2025);
  });

  it('returns null for whitespace-only string', () => {
    expect(parseSheetDateValue('   ')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// formatSiteVisitDate
// ---------------------------------------------------------------------------

describe('formatSiteVisitDate', () => {
  it('formats a valid ISO date string with es-PR locale', () => {
    const result = formatSiteVisitDate('2025-03-15');
    // es-PR locale typically produces something like "15 mar 2025" or "mar 15, 2025"
    expect(result).toMatch(/2025/);
    expect(result).not.toBe('No disponible');
  });

  it('returns "No disponible" for null', () => {
    expect(formatSiteVisitDate(null)).toBe('No disponible');
  });

  it('returns "No disponible" for undefined', () => {
    expect(formatSiteVisitDate(undefined)).toBe('No disponible');
  });

  it('returns "No disponible" for empty string', () => {
    expect(formatSiteVisitDate('')).toBe('No disponible');
  });

  it('returns "No disponible" for "No disponible"', () => {
    expect(formatSiteVisitDate('No disponible')).toBe('No disponible');
  });

  it('returns "No disponible" for unparseable string', () => {
    expect(formatSiteVisitDate('not-a-date')).toBe('No disponible');
  });
});

// ---------------------------------------------------------------------------
// normalizeTimeValue
// ---------------------------------------------------------------------------

describe('normalizeTimeValue', () => {
  it('returns null for null', () => {
    expect(normalizeTimeValue(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(normalizeTimeValue(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeTimeValue('')).toBeNull();
  });

  it('returns null for "No disponible"', () => {
    expect(normalizeTimeValue('No disponible')).toBeNull();
  });

  it('treats 0.5 as fraction of day -> 12:00', () => {
    expect(normalizeTimeValue('0.5')).toBe('12:00');
  });

  it('treats 0.0 as midnight -> 00:00', () => {
    expect(normalizeTimeValue('0')).toBe('00:00');
  });

  it('treats 0.75 as 18:00', () => {
    expect(normalizeTimeValue('0.75')).toBe('18:00');
  });

  it('treats 0.25 as 06:00', () => {
    expect(normalizeTimeValue('0.25')).toBe('06:00');
  });

  it('treats numeric 10 as 10 hours -> 10:00', () => {
    // 10 >= 1 so treated as hours: 10 * 60 = 600 mins -> 10h 0m
    expect(normalizeTimeValue('10')).toBe('10:00');
  });

  it('treats numeric 23 as 23:00', () => {
    expect(normalizeTimeValue('23')).toBe('23:00');
  });

  it('treats numeric 1 as 01:00', () => {
    expect(normalizeTimeValue('1')).toBe('01:00');
  });

  it('parses "2:30 PM" -> "14:30"', () => {
    expect(normalizeTimeValue('2:30 PM')).toBe('14:30');
  });

  it('parses "12:00 AM" -> "00:00"', () => {
    expect(normalizeTimeValue('12:00 AM')).toBe('00:00');
  });

  it('parses "12:00 PM" -> "12:00"', () => {
    expect(normalizeTimeValue('12:00 PM')).toBe('12:00');
  });

  it('parses "2 PM" -> "14:00"', () => {
    expect(normalizeTimeValue('2 PM')).toBe('14:00');
  });

  it('parses "12 AM" -> "00:00"', () => {
    expect(normalizeTimeValue('12 AM')).toBe('00:00');
  });

  it('passes through 24h format "14:30" -> "14:30"', () => {
    expect(normalizeTimeValue('14:30')).toBe('14:30');
  });

  it('sanitizes "2:30 p.m." -> "14:30"', () => {
    expect(normalizeTimeValue('2:30 p.m.')).toBe('14:30');
  });

  it('sanitizes "9:00 a.m." -> "09:00"', () => {
    expect(normalizeTimeValue('9:00 a.m.')).toBe('09:00');
  });

  it('handles parenthesized time "(10:00 AM)" -> "10:00"', () => {
    expect(normalizeTimeValue('(10:00 AM)')).toBe('10:00');
  });

  it('handles 24h with seconds "14:30:00" -> "14:30"', () => {
    expect(normalizeTimeValue('14:30:00')).toBe('14:30');
  });

  it('returns null for completely unparseable input', () => {
    expect(normalizeTimeValue('sometime today')).toBeNull();
  });

  it('sanitizes "a. m." with spaces -> AM', () => {
    expect(normalizeTimeValue('9:00 a. m.')).toBe('09:00');
  });

  it('handles trailing comma in time "10:00 AM,"', () => {
    expect(normalizeTimeValue('10:00 AM,')).toBe('10:00');
  });
});

// ---------------------------------------------------------------------------
// formatTimeLabel
// ---------------------------------------------------------------------------

describe('formatTimeLabel', () => {
  it('returns null for null', () => {
    expect(formatTimeLabel(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(formatTimeLabel(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(formatTimeLabel('')).toBeNull();
  });

  it('returns null for "No disponible"', () => {
    expect(formatTimeLabel('No disponible')).toBeNull();
  });

  it('formats "14:30" as "2:30 PM"', () => {
    expect(formatTimeLabel('14:30')).toBe('2:30 PM');
  });

  it('formats "09:00" as "9:00 AM"', () => {
    expect(formatTimeLabel('09:00')).toBe('9:00 AM');
  });

  it('formats "00:00" as "12:00 AM"', () => {
    expect(formatTimeLabel('00:00')).toBe('12:00 AM');
  });

  it('formats "12:00" as "12:00 PM"', () => {
    expect(formatTimeLabel('12:00')).toBe('12:00 PM');
  });

  it('formats "2:30 PM" input (normalizes then formats)', () => {
    expect(formatTimeLabel('2:30 PM')).toBe('2:30 PM');
  });

  it('formats "23:59" as "11:59 PM"', () => {
    expect(formatTimeLabel('23:59')).toBe('11:59 PM');
  });
});

// ---------------------------------------------------------------------------
// truncate
// ---------------------------------------------------------------------------

describe('truncate', () => {
  it('returns empty string for null', () => {
    expect(truncate(null, 10)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(truncate(undefined, 10)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(truncate('', 10)).toBe('');
  });

  it('returns full text when within maxLength', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns full text when exactly at maxLength', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates and adds ellipsis when exceeding maxLength', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });

  it('handles maxLength of 0', () => {
    expect(truncate('hi', 0)).toBe('...');
  });
});

// ---------------------------------------------------------------------------
// extractTownFromLocation
// ---------------------------------------------------------------------------

describe('extractTownFromLocation', () => {
  it('returns first part before comma, trimmed', () => {
    expect(extractTownFromLocation('San Juan, Puerto Rico')).toBe('San Juan');
  });

  it('returns full string when no comma', () => {
    expect(extractTownFromLocation('Mayaguez')).toBe('Mayaguez');
  });

  it('returns empty string for null', () => {
    expect(extractTownFromLocation(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(extractTownFromLocation(undefined)).toBe('');
  });

  it('returns empty string for "No disponible"', () => {
    expect(extractTownFromLocation('No disponible')).toBe('');
  });

  it('trims whitespace from result', () => {
    expect(extractTownFromLocation('  Ponce  , PR')).toBe('Ponce');
  });

  it('handles multiple commas (only first part)', () => {
    expect(extractTownFromLocation('Bayamon, PR, US')).toBe('Bayamon');
  });
});

// ---------------------------------------------------------------------------
// badgeText
// ---------------------------------------------------------------------------

describe('badgeText', () => {
  it('returns "Aprobada" for "approved"', () => {
    expect(badgeText('approved')).toBe('Aprobada');
  });

  it('returns "Rechazada" for "rejected"', () => {
    expect(badgeText('rejected')).toBe('Rechazada');
  });

  it('returns "Pendiente" for "pending"', () => {
    expect(badgeText('pending')).toBe('Pendiente');
  });

  it('returns "Pendiente" for null', () => {
    expect(badgeText(null)).toBe('Pendiente');
  });

  it('returns "Pendiente" for undefined', () => {
    expect(badgeText(undefined)).toBe('Pendiente');
  });

  it('returns "Pendiente" for unknown status', () => {
    expect(badgeText('some-random-status')).toBe('Pendiente');
  });

  it('is case-insensitive for "APPROVED"', () => {
    expect(badgeText('APPROVED')).toBe('Aprobada');
  });

  it('is case-insensitive for "REJECTED"', () => {
    expect(badgeText('REJECTED')).toBe('Rechazada');
  });
});

// ---------------------------------------------------------------------------
// resolvePdfUrl
// ---------------------------------------------------------------------------

describe('resolvePdfUrl', () => {
  it('extracts URL from HYPERLINK formula', () => {
    const raw = '=HYPERLINK("https://example.com/doc.pdf","Ver PDF")';
    expect(resolvePdfUrl(raw)).toBe('https://example.com/doc.pdf');
  });

  it('extracts URL from HIPERVINCULO formula', () => {
    const raw = '=HIPERVINCULO("https://example.com/doc.pdf","Ver PDF")';
    expect(resolvePdfUrl(raw)).toBe('https://example.com/doc.pdf');
  });

  it('extracts bare URL', () => {
    expect(resolvePdfUrl('https://example.com/file.pdf')).toBe('https://example.com/file.pdf');
  });

  it('extracts http URL', () => {
    expect(resolvePdfUrl('http://example.com/file.pdf')).toBe('http://example.com/file.pdf');
  });

  it('extracts URL from text containing URL', () => {
    expect(resolvePdfUrl('check this https://example.com/a.pdf here')).toBe(
      'https://example.com/a.pdf'
    );
  });

  it('returns "#" for null', () => {
    expect(resolvePdfUrl(null)).toBe('#');
  });

  it('returns "#" for undefined', () => {
    expect(resolvePdfUrl(undefined)).toBe('#');
  });

  it('returns "#" for empty string', () => {
    expect(resolvePdfUrl('')).toBe('#');
  });

  it('returns "#" for string with no URL', () => {
    expect(resolvePdfUrl('just some text')).toBe('#');
  });

  it('returns "#" for whitespace-only string', () => {
    expect(resolvePdfUrl('   ')).toBe('#');
  });
});

// ---------------------------------------------------------------------------
// parseConfidence
// ---------------------------------------------------------------------------

describe('parseConfidence', () => {
  it('extracts 85 from "GPT-4o (85%)"', () => {
    expect(parseConfidence('GPT-4o (85%)')).toBe(85);
  });

  it('extracts 100 from "Manual (100%)"', () => {
    expect(parseConfidence('Manual (100%)')).toBe(100);
  });

  it('extracts 0 from "Unknown (0%)"', () => {
    expect(parseConfidence('Unknown (0%)')).toBe(0);
  });

  it('returns null for null', () => {
    expect(parseConfidence(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseConfidence(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseConfidence('')).toBeNull();
  });

  it('returns null for string without percentage', () => {
    expect(parseConfidence('GPT-4o')).toBeNull();
  });

  it('extracts percentage with no surrounding text', () => {
    expect(parseConfidence('50%')).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// computeWorthItScore
// ---------------------------------------------------------------------------

describe('computeWorthItScore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('gives 3 pts for high priority', () => {
    const lic = buildLicitacion({
      priority: 'High',
      siteVisitDate: '',
      biddingCloseDate: '',
      estimatedValue: '',
      visitLocation: '',
    });
    expect(computeWorthItScore(lic)).toBe(3);
  });

  it('gives 3 pts for "alta" priority', () => {
    const lic = buildLicitacion({
      priority: 'alta',
      siteVisitDate: '',
      biddingCloseDate: '',
      estimatedValue: '',
      visitLocation: '',
    });
    expect(computeWorthItScore(lic)).toBe(3);
  });

  it('gives 2 pts for medium priority', () => {
    const lic = buildLicitacion({
      priority: 'Medium',
      siteVisitDate: '',
      biddingCloseDate: '',
      estimatedValue: '',
      visitLocation: '',
    });
    expect(computeWorthItScore(lic)).toBe(2);
  });

  it('gives 2 pts for "media" priority', () => {
    const lic = buildLicitacion({
      priority: 'media',
      siteVisitDate: '',
      biddingCloseDate: '',
      estimatedValue: '',
      visitLocation: '',
    });
    expect(computeWorthItScore(lic)).toBe(2);
  });

  it('gives 1 pt for low priority', () => {
    const lic = buildLicitacion({
      priority: 'Low',
      siteVisitDate: '',
      biddingCloseDate: '',
      estimatedValue: '',
      visitLocation: '',
    });
    expect(computeWorthItScore(lic)).toBe(1);
  });

  it('gives 1 pt for "baja" priority', () => {
    const lic = buildLicitacion({
      priority: 'baja',
      siteVisitDate: '',
      biddingCloseDate: '',
      estimatedValue: '',
      visitLocation: '',
    });
    expect(computeWorthItScore(lic)).toBe(1);
  });

  it('gives 0 pts for empty priority', () => {
    const lic = buildLicitacion({
      priority: '',
      siteVisitDate: '',
      biddingCloseDate: '',
      estimatedValue: '',
      visitLocation: '',
    });
    expect(computeWorthItScore(lic)).toBe(0);
  });

  it('gives 3 deadline pts for <= 3 days away (via siteVisitDate)', () => {
    const lic = buildLicitacion({
      priority: '',
      siteVisitDate: '2025-03-03', // 2 days away
      biddingCloseDate: '',
      estimatedValue: '',
      visitLocation: '',
    });
    expect(computeWorthItScore(lic)).toBe(3);
  });

  it('gives 2 deadline pts for <= 7 days away', () => {
    const lic = buildLicitacion({
      priority: '',
      siteVisitDate: '2025-03-07', // 6 days away
      biddingCloseDate: '',
      estimatedValue: '',
      visitLocation: '',
    });
    expect(computeWorthItScore(lic)).toBe(2);
  });

  it('gives 1 deadline pt for <= 14 days away', () => {
    const lic = buildLicitacion({
      priority: '',
      siteVisitDate: '2025-03-12', // 11 days away
      biddingCloseDate: '',
      estimatedValue: '',
      visitLocation: '',
    });
    expect(computeWorthItScore(lic)).toBe(1);
  });

  it('gives 0 deadline pts when > 14 days away', () => {
    const lic = buildLicitacion({
      priority: '',
      siteVisitDate: '2025-04-01', // 31 days away
      biddingCloseDate: '',
      estimatedValue: '',
      visitLocation: '',
    });
    expect(computeWorthItScore(lic)).toBe(0);
  });

  it('uses earliest of siteVisitDate and biddingCloseDate', () => {
    const lic = buildLicitacion({
      priority: '',
      siteVisitDate: '2025-03-20', // 19 days
      biddingCloseDate: '2025-03-03', // 2 days - closer
      estimatedValue: '',
      visitLocation: '',
    });
    // Should use biddingCloseDate (2 days) -> 3 pts
    expect(computeWorthItScore(lic)).toBe(3);
  });

  it('gives +2 for having estimatedValue', () => {
    const lic = buildLicitacion({
      priority: '',
      siteVisitDate: '',
      biddingCloseDate: '',
      estimatedValue: '$50,000',
      visitLocation: '',
    });
    expect(computeWorthItScore(lic)).toBe(2);
  });

  it('does not give estimatedValue pts for "No disponible"', () => {
    const lic = buildLicitacion({
      priority: '',
      siteVisitDate: '',
      biddingCloseDate: '',
      estimatedValue: 'No disponible',
      visitLocation: '',
    });
    expect(computeWorthItScore(lic)).toBe(0);
  });

  it('does not give estimatedValue pts for empty string', () => {
    const lic = buildLicitacion({
      priority: '',
      siteVisitDate: '',
      biddingCloseDate: '',
      estimatedValue: '',
      visitLocation: '',
    });
    expect(computeWorthItScore(lic)).toBe(0);
  });

  it('gives +2 for having visitLocation', () => {
    const lic = buildLicitacion({
      priority: '',
      siteVisitDate: '',
      biddingCloseDate: '',
      estimatedValue: '',
      visitLocation: 'EBAS Torrecilla, Loiza',
    });
    expect(computeWorthItScore(lic)).toBe(2);
  });

  it('does not give visitLocation pts for "no disponible" (case-insensitive)', () => {
    const lic = buildLicitacion({
      priority: '',
      siteVisitDate: '',
      biddingCloseDate: '',
      estimatedValue: '',
      visitLocation: 'no disponible',
    });
    expect(computeWorthItScore(lic)).toBe(0);
  });

  it('caps at 10 even if all factors are maxed', () => {
    const lic = buildLicitacion({
      priority: 'High', // 3
      siteVisitDate: '2025-03-02', // 1 day -> 3
      biddingCloseDate: '2025-03-02', // same
      estimatedValue: '$100,000', // 2
      visitLocation: 'Some Location', // 2
    });
    // 3 + 3 + 2 + 2 = 10 (at cap)
    expect(computeWorthItScore(lic)).toBe(10);
  });

  it('handles "No disponible" for biddingCloseDate', () => {
    const lic = buildLicitacion({
      priority: '',
      siteVisitDate: '',
      biddingCloseDate: 'No disponible',
      estimatedValue: '',
      visitLocation: '',
    });
    expect(computeWorthItScore(lic)).toBe(0);
  });

  it('gives 0 deadline pts for past dates', () => {
    const lic = buildLicitacion({
      priority: '',
      siteVisitDate: '2025-02-25', // in the past
      biddingCloseDate: '',
      estimatedValue: '',
      visitLocation: '',
    });
    // daysRemaining is negative, so no deadline pts
    expect(computeWorthItScore(lic)).toBe(0);
  });

  it('gives deadline pts for today (0 days remaining)', () => {
    const lic = buildLicitacion({
      priority: '',
      siteVisitDate: '2025-03-01', // today
      biddingCloseDate: '',
      estimatedValue: '',
      visitLocation: '',
    });
    // 0 days remaining -> <= 3 -> 3 pts
    expect(computeWorthItScore(lic)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// sortLicitaciones
// ---------------------------------------------------------------------------

describe('sortLicitaciones', () => {
  const lic1 = buildLicitacion({
    id: '1',
    subject: 'Alpha',
    siteVisitDate: '2025-03-10',
    biddingCloseDate: '2025-04-01',
    emailDate: '2025-03-01',
    priority: 'High',
    estimatedValue: '$100,000',
    visitLocation: 'Some Location',
  });
  const lic2 = buildLicitacion({
    id: '2',
    subject: 'Beta',
    siteVisitDate: '2025-03-05',
    biddingCloseDate: '2025-03-20',
    emailDate: '2025-03-05',
    priority: 'Low',
    estimatedValue: '',
    visitLocation: '',
  });
  const lic3 = buildLicitacion({
    id: '3',
    subject: 'Gamma',
    siteVisitDate: 'No disponible',
    biddingCloseDate: '2025-03-15',
    emailDate: '2025-02-28',
    priority: 'Medium',
    estimatedValue: '$20,000',
    visitLocation: '',
  });

  it('sorts by visit-date-asc with missing dates last', () => {
    const result = sortLicitaciones([lic3, lic1, lic2], 'visit-date-asc');
    expect(result[0].id).toBe('2'); // 2025-03-05
    expect(result[1].id).toBe('1'); // 2025-03-10
    expect(result[2].id).toBe('3'); // No disponible -> last
  });

  it('sorts by close-date-asc', () => {
    const result = sortLicitaciones([lic1, lic3, lic2], 'close-date-asc');
    expect(result[0].id).toBe('3'); // 2025-03-15
    expect(result[1].id).toBe('2'); // 2025-03-20
    expect(result[2].id).toBe('1'); // 2025-04-01
  });

  it('sorts by email-date-desc', () => {
    const result = sortLicitaciones([lic1, lic2, lic3], 'email-date-desc');
    expect(result[0].id).toBe('2'); // 2025-03-05
    expect(result[1].id).toBe('1'); // 2025-03-01
    expect(result[2].id).toBe('3'); // 2025-02-28
  });

  it('sorts by email-date-asc', () => {
    const result = sortLicitaciones([lic2, lic1, lic3], 'email-date-asc');
    expect(result[0].id).toBe('3'); // 2025-02-28
    expect(result[1].id).toBe('1'); // 2025-03-01
    expect(result[2].id).toBe('2'); // 2025-03-05
  });

  it('sorts by title-asc using locale "es"', () => {
    const result = sortLicitaciones([lic3, lic1, lic2], 'title-asc');
    expect(result[0].subject).toBe('Alpha');
    expect(result[1].subject).toBe('Beta');
    expect(result[2].subject).toBe('Gamma');
  });

  it('sorts by title-desc', () => {
    const result = sortLicitaciones([lic1, lic2, lic3], 'title-desc');
    expect(result[0].subject).toBe('Gamma');
    expect(result[1].subject).toBe('Beta');
    expect(result[2].subject).toBe('Alpha');
  });

  it('sorts by score-desc', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-01T00:00:00Z'));
    const result = sortLicitaciones([lic2, lic3, lic1], 'score-desc');
    // lic1: High(3) + ~10 days(1) + value(2) + location(2) = 8
    // lic3: Medium(2) + ~14 days(1) + value(2) + no loc(0) = 5
    // lic2: Low(1) + ~4 days(2) + no value(0) + no loc(0) = 3
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('3');
    expect(result[2].id).toBe('2');
    vi.useRealTimers();
  });

  it('returns a copy for unknown sortBy', () => {
    const input = [lic1, lic2];
    const result = sortLicitaciones(input, 'unknown');
    expect(result).not.toBe(input);
    expect(result).toEqual(input);
  });

  it('does not mutate the original array', () => {
    const input = [lic2, lic1];
    const result = sortLicitaciones(input, 'visit-date-asc');
    expect(input[0].id).toBe('2'); // original unchanged
    expect(result[0].id).toBe('2'); // lic2 has earlier visit date
  });

  it('handles empty array', () => {
    expect(sortLicitaciones([], 'visit-date-asc')).toEqual([]);
  });

  it('handles missing emailDate for email-date-desc', () => {
    const noDate = buildLicitacion({ id: '99', emailDate: '' });
    const withDate = buildLicitacion({ id: '100', emailDate: '2025-03-01' });
    const result = sortLicitaciones([noDate, withDate], 'email-date-desc');
    expect(result[0].id).toBe('100'); // has date
    expect(result[1].id).toBe('99'); // no date -> epoch -> last for desc
  });

  it('handles missing subject for title-asc', () => {
    const noSubject = buildLicitacion({ id: '88', subject: '' });
    const withSubject = buildLicitacion({ id: '89', subject: 'Zeta' });
    const result = sortLicitaciones([withSubject, noSubject], 'title-asc');
    expect(result[0].id).toBe('88'); // empty string sorts first
    expect(result[1].id).toBe('89');
  });
});

// ---------------------------------------------------------------------------
// arrayToCSV
// ---------------------------------------------------------------------------

describe('arrayToCSV', () => {
  it('returns empty string for empty array', () => {
    expect(arrayToCSV([])).toBe('');
  });

  it('returns empty string for null-ish input', () => {
    expect(arrayToCSV(null as unknown as never[])).toBe('');
  });

  it('produces a header row with 15 columns', () => {
    const lic = buildLicitacion();
    const csv = arrayToCSV([lic]);
    const lines = csv.split('\n');
    expect(lines.length).toBe(2); // header + 1 data row
    const headerCols = lines[0].split('","');
    expect(headerCols.length).toBe(15);
  });

  it('includes expected header labels', () => {
    const lic = buildLicitacion();
    const csv = arrayToCSV([lic]);
    const header = csv.split('\n')[0];
    expect(header).toContain('Fecha Cierre');
    expect(header).toContain('Fecha Visita');
    expect(header).toContain('Valor Estimado');
  });

  it('escapes double quotes in values', () => {
    const lic = buildLicitacion({ subject: 'Test "quoted" value' });
    const csv = arrayToCSV([lic]);
    expect(csv).toContain('Test ""quoted"" value');
  });

  it('wraps each value in double quotes', () => {
    const lic = buildLicitacion({ subject: 'Simple' });
    const csv = arrayToCSV([lic]);
    const dataRow = csv.split('\n')[1];
    // Every field should be quoted
    const fields = dataRow.match(/"[^"]*(?:""[^"]*)*"/g);
    expect(fields).not.toBeNull();
    expect(fields!.length).toBe(15);
  });

  it('handles multiple rows', () => {
    const lics = [buildLicitacion({ id: '1' }), buildLicitacion({ id: '2' })];
    const csv = arrayToCSV(lics);
    const lines = csv.split('\n');
    expect(lines.length).toBe(3); // header + 2 rows
  });

  it('uses empty string for falsy field values', () => {
    const lic = buildLicitacion({ estimatedValue: '' });
    const csv = arrayToCSV([lic]);
    // The last column (estimatedValue) should be ""
    const dataRow = csv.split('\n')[1];
    expect(dataRow).toMatch(/""$/);
  });
});

// ---------------------------------------------------------------------------
// downloadCSV
// ---------------------------------------------------------------------------

describe('downloadCSV', () => {
  it('creates a link, triggers click, and cleans up', () => {
    const clickMock = vi.fn();
    const setAttributeMock = vi.fn();
    const mockLink = {
      setAttribute: setAttributeMock,
      style: {} as CSSStyleDeclaration,
      click: clickMock,
    } as unknown as HTMLAnchorElement;

    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);
    const createObjectURLSpy = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURLSpy = vi.fn();
    globalThis.URL.createObjectURL = createObjectURLSpy;
    globalThis.URL.revokeObjectURL = revokeObjectURLSpy;

    downloadCSV('col1,col2\nval1,val2', 'export.csv');

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(setAttributeMock).toHaveBeenCalledWith('href', 'blob:mock-url');
    expect(setAttributeMock).toHaveBeenCalledWith('download', 'export.csv');
    expect(appendChildSpy).toHaveBeenCalledWith(mockLink);
    expect(clickMock).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalledWith(mockLink);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('creates a Blob with correct type and BOM', () => {
    const mockLink = {
      setAttribute: vi.fn(),
      style: {} as CSSStyleDeclaration,
      click: vi.fn(),
    } as unknown as HTMLAnchorElement;

    vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
    vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);

    let capturedBlob: Blob | null = null;
    globalThis.URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:mock';
    });
    globalThis.URL.revokeObjectURL = vi.fn();

    downloadCSV('data', 'test.csv');

    expect(capturedBlob).toBeInstanceOf(Blob);
    expect(capturedBlob!.type).toBe('text/csv;charset=utf-8;');
    // Blob should contain BOM + "data" = 4 bytes BOM char + 4 = size > 4
    expect(capturedBlob!.size).toBeGreaterThan(4);

    vi.restoreAllMocks();
  });

  it('sets link visibility to hidden', () => {
    const mockLink = {
      setAttribute: vi.fn(),
      style: { visibility: '' } as unknown as CSSStyleDeclaration,
      click: vi.fn(),
    } as unknown as HTMLAnchorElement;

    vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
    vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
    globalThis.URL.revokeObjectURL = vi.fn();

    downloadCSV('data', 'f.csv');

    expect((mockLink as unknown as { style: { visibility: string } }).style.visibility).toBe(
      'hidden'
    );

    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// exportToICalendar
// ---------------------------------------------------------------------------

describe('exportToICalendar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setupDOMMocks() {
    const clickMock = vi.fn();
    const mockLink = {
      href: '',
      download: '',
      click: clickMock,
    } as unknown as HTMLAnchorElement;

    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);

    let capturedBlob: Blob | null = null;
    const createObjectURLSpy = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:ics-mock';
    });
    const revokeObjectURLSpy = vi.fn();
    globalThis.URL.createObjectURL = createObjectURLSpy;
    globalThis.URL.revokeObjectURL = revokeObjectURLSpy;

    return {
      mockLink,
      clickMock,
      createElementSpy,
      appendChildSpy,
      removeChildSpy,
      createObjectURLSpy,
      revokeObjectURLSpy,
      getCapturedBlob: () => capturedBlob,
    };
  }

  it('does nothing when no licitaciones have siteVisitDate', () => {
    const mocks = setupDOMMocks();
    exportToICalendar([
      buildLicitacion({ siteVisitDate: '' }),
      buildLicitacion({ siteVisitDate: 'No disponible' }),
    ]);
    expect(mocks.clickMock).not.toHaveBeenCalled();
  });

  it('does nothing for an empty array', () => {
    const mocks = setupDOMMocks();
    exportToICalendar([]);
    expect(mocks.clickMock).not.toHaveBeenCalled();
  });

  it('creates an ICS file for licitaciones with valid siteVisitDate', async () => {
    const mocks = setupDOMMocks();
    const lic = buildLicitacion({
      siteVisitDate: '2025-03-15',
      siteVisitTime: '10:00',
      title: 'Test Event',
      visitLocation: 'San Juan',
      contactName: 'Maria',
      contactPhone: '555-1234',
      category: 'Limpieza',
      subject: 'Subject Test',
    });

    exportToICalendar([lic]);

    expect(mocks.clickMock).toHaveBeenCalled();
    expect(mocks.createObjectURLSpy).toHaveBeenCalled();
    expect(mocks.revokeObjectURLSpy).toHaveBeenCalledWith('blob:ics-mock');

    // Read the blob content using FileReader
    const blob = mocks.getCapturedBlob()!;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/calendar;charset=utf-8');

    const text = await readBlobAsText(blob);
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('END:VCALENDAR');
    expect(text).toContain('BEGIN:VEVENT');
    expect(text).toContain('END:VEVENT');
    expect(text).toContain('Visita: Test Event');
    expect(text).toContain('LOCATION:San Juan');
    expect(text).toContain('BEGIN:VALARM');
    expect(text).toContain('TRIGGER:-P1D');
  });

  it('sets the download filename with current date', () => {
    const mocks = setupDOMMocks();
    exportToICalendar([buildLicitacion({ siteVisitDate: '2025-03-15' })]);
    expect((mocks.mockLink as unknown as { download: string }).download).toBe(
      'visitas-licitaciones-2025-03-01.ics'
    );
  });

  it('skips entries with "No disponible" siteVisitDate', async () => {
    const mocks = setupDOMMocks();
    const good = buildLicitacion({ id: '1', siteVisitDate: '2025-03-15', title: 'Good' });
    const bad = buildLicitacion({ id: '2', siteVisitDate: 'No disponible', title: 'Bad' });
    exportToICalendar([good, bad]);

    const text = await readBlobAsText(mocks.getCapturedBlob()!);
    expect(text).toContain('Good');
    expect(text).not.toContain('SUMMARY:Visita: Bad');
  });

  it('defaults to 9 AM when siteVisitTime is "Sin hora"', async () => {
    const mocks = setupDOMMocks();
    exportToICalendar([
      buildLicitacion({
        siteVisitDate: '2025-03-15',
        siteVisitTime: 'Sin hora',
      }),
    ]);

    const text = await readBlobAsText(mocks.getCapturedBlob()!);
    // The DTSTART should include T09 for 9 AM
    expect(text).toMatch(/DTSTART:\d{8}T09/);
  });

  it('uses siteVisitTime when valid', async () => {
    const mocks = setupDOMMocks();
    exportToICalendar([
      buildLicitacion({
        siteVisitDate: '2025-03-15',
        siteVisitTime: '14:30',
      }),
    ]);

    const text = await readBlobAsText(mocks.getCapturedBlob()!);
    expect(text).toMatch(/DTSTART:\d{8}T14/);
  });

  it('includes VCALENDAR headers', async () => {
    const mocks = setupDOMMocks();
    exportToICalendar([buildLicitacion({ siteVisitDate: '2025-03-15' })]);

    const text = await readBlobAsText(mocks.getCapturedBlob()!);
    expect(text).toContain('VERSION:2.0');
    expect(text).toContain('PRODID:-//Licitaciones Dashboard//ES');
    expect(text).toContain('CALSCALE:GREGORIAN');
    expect(text).toContain('METHOD:PUBLISH');
    expect(text).toContain('X-WR-CALNAME:Visitas Licitaciones');
    expect(text).toContain('X-WR-TIMEZONE:America/Puerto_Rico');
  });

  it('falls back to subject when title is empty', async () => {
    const mocks = setupDOMMocks();
    exportToICalendar([
      buildLicitacion({
        siteVisitDate: '2025-03-15',
        title: '',
        subject: 'Fallback Subject',
      }),
    ]);

    const text = await readBlobAsText(mocks.getCapturedBlob()!);
    expect(text).toContain('Visita: Fallback Subject');
  });

  it('escapes special iCal characters in text fields', async () => {
    const mocks = setupDOMMocks();
    exportToICalendar([
      buildLicitacion({
        siteVisitDate: '2025-03-15',
        title: 'Test; with, special\\chars',
        visitLocation: 'Place; here, there',
      }),
    ]);

    const text = await readBlobAsText(mocks.getCapturedBlob()!);
    expect(text).toContain('Test\\; with\\, special\\\\chars');
    expect(text).toContain('Place\\; here\\, there');
  });

  it('creates end date 1 hour after start', async () => {
    const mocks = setupDOMMocks();
    exportToICalendar([
      buildLicitacion({
        siteVisitDate: '2025-03-15',
        siteVisitTime: '10:00',
      }),
    ]);

    const text = await readBlobAsText(mocks.getCapturedBlob()!);
    // DTSTART should have 10 and DTEND should have 11
    expect(text).toMatch(/DTSTART:\d{8}T10/);
    expect(text).toMatch(/DTEND:\d{8}T11/);
  });

  it('includes STATUS:CONFIRMED for each event', async () => {
    const mocks = setupDOMMocks();
    exportToICalendar([buildLicitacion({ siteVisitDate: '2025-03-15' })]);

    const text = await readBlobAsText(mocks.getCapturedBlob()!);
    expect(text).toContain('STATUS:CONFIRMED');
  });
});
