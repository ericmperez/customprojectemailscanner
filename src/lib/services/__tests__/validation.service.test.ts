import { describe, it, expect } from 'vitest';
import {
  validateLocation,
  validatePhone,
  validateDate,
  validateExtraction,
} from '@/lib/services/validation.service';

// ── validateLocation ──────────────────────────────────────────────────

describe('validateLocation', () => {
  it('returns exact match unchanged', () => {
    const result = validateLocation('San Juan');
    expect(result.value).toBe('San Juan');
    expect(result.fixed).toBe(false);
    expect(result.issue).toBeUndefined();
  });

  it('normalizes case for case-insensitive match', () => {
    const result = validateLocation('san juan');
    expect(result.value).toBe('San Juan');
    expect(result.fixed).toBe(true);
    expect(result.issue).toBeUndefined();
  });

  it('matches accent-insensitive (Bayamon -> Bayamón)', () => {
    const result = validateLocation('Bayamon');
    expect(result.value).toBe('Bayamón');
    expect(result.fixed).toBe(true);
    expect(result.issue).toBeUndefined();
  });

  it('extracts municipality from a longer comma-separated string', () => {
    const result = validateLocation('EBAS Torrecilla, Loíza');
    expect(result.value).toBe('Loíza');
    expect(result.fixed).toBe(true);
    expect(result.issue).toBeUndefined();
  });

  it('extracts municipality from longer string by word matching', () => {
    const result = validateLocation('Centro Comunal Carolina PR');
    expect(result.value).toBe('Carolina');
    expect(result.fixed).toBe(true);
  });

  it('fuzzy matches within Levenshtein distance 2 (Ponse -> Ponce)', () => {
    const result = validateLocation('Ponse');
    expect(result.value).toBe('Ponce');
    expect(result.fixed).toBe(true);
    expect(result.issue).toBeUndefined();
  });

  it('returns location_unknown issue for completely unrecognized location', () => {
    const result = validateLocation('New York City');
    expect(result.value).toBe('New York City');
    expect(result.fixed).toBe(false);
    expect(result.issue).toBe('location_unknown');
  });

  it('handles "No disponible" unchanged', () => {
    const result = validateLocation('No disponible');
    expect(result.value).toBe('No disponible');
    expect(result.fixed).toBe(false);
    expect(result.issue).toBeUndefined();
  });

  it('handles empty string', () => {
    const result = validateLocation('');
    expect(result.value).toBe('');
    expect(result.fixed).toBe(false);
    expect(result.issue).toBeUndefined();
  });

  it('matches two-word municipalities from longer text', () => {
    const result = validateLocation('Oficina Trujillo Alto');
    expect(result.value).toBe('Trujillo Alto');
    expect(result.fixed).toBe(true);
  });

  it('handles accent-insensitive match for Mayaguez', () => {
    const result = validateLocation('Mayaguez');
    expect(result.value).toBe('Mayagüez');
    expect(result.fixed).toBe(true);
  });
});

// ── validatePhone ─────────────────────────────────────────────────────

describe('validatePhone', () => {
  it('formats valid 10-digit 787 phone number', () => {
    const result = validatePhone('7875551234');
    expect(result.value).toBe('(787) 555-1234');
    expect(result.fixed).toBe(true);
    expect(result.issue).toBeUndefined();
  });

  it('formats valid 10-digit 939 phone number', () => {
    const result = validatePhone('9395551234');
    expect(result.value).toBe('(939) 555-1234');
    expect(result.fixed).toBe(true);
  });

  it('strips non-digit characters before formatting', () => {
    const result = validatePhone('(787) 555-1234');
    expect(result.value).toBe('(787) 555-1234');
    expect(result.fixed).toBe(false); // already formatted
  });

  it('handles 11-digit number with leading 1', () => {
    const result = validatePhone('17875551234');
    expect(result.value).toBe('(787) 555-1234');
    expect(result.fixed).toBe(true);
  });

  it('rejects non-PR area code', () => {
    const result = validatePhone('2125551234');
    expect(result.value).toBe('2125551234');
    expect(result.fixed).toBe(false);
    expect(result.issue).toBe('phone_invalid');
  });

  it('rejects invalid length (too short)', () => {
    const result = validatePhone('787555');
    expect(result.value).toBe('787555');
    expect(result.fixed).toBe(false);
    expect(result.issue).toBe('phone_invalid');
  });

  it('rejects invalid length (too long without leading 1)', () => {
    const result = validatePhone('787555123456');
    expect(result.value).toBe('787555123456');
    expect(result.fixed).toBe(false);
    expect(result.issue).toBe('phone_invalid');
  });

  it('handles "No disponible" unchanged', () => {
    const result = validatePhone('No disponible');
    expect(result.value).toBe('No disponible');
    expect(result.fixed).toBe(false);
    expect(result.issue).toBeUndefined();
  });

  it('handles empty string', () => {
    const result = validatePhone('');
    expect(result.value).toBe('');
    expect(result.fixed).toBe(false);
  });

  it('strips dashes and parens from formatted input', () => {
    const result = validatePhone('787-555-1234');
    expect(result.value).toBe('(787) 555-1234');
    expect(result.fixed).toBe(true);
  });
});

// ── validateDate ──────────────────────────────────────────────────────

describe('validateDate', () => {
  it('returns valid MM/DD/YYYY formatted', () => {
    const result = validateDate('03/15/2026');
    expect(result.value).toBe('03/15/2026');
    expect(result.fixed).toBe(false);
    expect(result.issue).toBeUndefined();
  });

  it('auto-pads single-digit month and day', () => {
    const result = validateDate('3/5/2026');
    expect(result.value).toBe('03/05/2026');
    expect(result.fixed).toBe(true);
  });

  it('detects DD/MM swap when month > 12', () => {
    const result = validateDate('25/03/2026');
    expect(result.value).toBe('03/25/2026');
    expect(result.fixed).toBe(true);
  });

  it('converts dash format to slash format', () => {
    const result = validateDate('03-15-2026');
    expect(result.value).toBe('03/15/2026');
    expect(result.fixed).toBe(true);
  });

  it('converts dash format with DD/MM swap', () => {
    const result = validateDate('25-03-2026');
    expect(result.value).toBe('03/25/2026');
    expect(result.fixed).toBe(true);
  });

  it('returns date_invalid issue for unparseable date', () => {
    const result = validateDate('not-a-date');
    expect(result.value).toBe('not-a-date');
    expect(result.fixed).toBe(false);
    expect(result.issue).toBe('date_invalid');
  });

  it('handles "No disponible" unchanged', () => {
    const result = validateDate('No disponible');
    expect(result.value).toBe('No disponible');
    expect(result.fixed).toBe(false);
    expect(result.issue).toBeUndefined();
  });

  it('handles empty string', () => {
    const result = validateDate('');
    expect(result.value).toBe('');
    expect(result.fixed).toBe(false);
  });

  it('returns date_invalid for out-of-range year', () => {
    const result = validateDate('03/15/2019');
    expect(result.value).toBe('03/15/2019');
    expect(result.fixed).toBe(false);
    expect(result.issue).toBe('date_invalid');
  });

  it('auto-pads single-digit month in dash format', () => {
    const result = validateDate('3-5-2026');
    expect(result.value).toBe('03/05/2026');
    expect(result.fixed).toBe(true);
  });
});

// ── validateExtraction ────────────────────────────────────────────────

describe('validateExtraction', () => {
  it('validates and fixes location, phone, and dates together', () => {
    const data: Record<string, string> = {
      location: 'Bayamon',
      contactPhone: '17875551234',
      siteVisitDate: '3/5/2026',
      biddingCloseDate: '25/03/2026',
      title: 'Test Project',
    };

    const result = validateExtraction(data);

    expect(result.validated.location).toBe('Bayamón');
    expect(result.validated.contactPhone).toBe('(787) 555-1234');
    expect(result.validated.siteVisitDate).toBe('03/05/2026');
    expect(result.validated.biddingCloseDate).toBe('03/25/2026');
    // title should be passed through unchanged
    expect(result.validated.title).toBe('Test Project');
  });

  it('reports fixes in the fixes array', () => {
    const data: Record<string, string> = {
      location: 'Ponse',
      contactPhone: '7875551234',
      siteVisitDate: '03/15/2026',
      biddingCloseDate: '03/30/2026',
    };

    const result = validateExtraction(data);

    expect(result.fixes).toContainEqual(
      expect.stringContaining('location')
    );
    expect(result.fixes).toContainEqual(
      expect.stringContaining('contactPhone')
    );
    // siteVisitDate and biddingCloseDate were already valid format
    expect(result.issues).toHaveLength(0);
  });

  it('reports issues for invalid fields', () => {
    const data: Record<string, string> = {
      location: 'Unknown City XYZ',
      contactPhone: '555',
      siteVisitDate: 'bad-date',
      biddingCloseDate: 'also-bad',
    };

    const result = validateExtraction(data);

    expect(result.issues).toContain('location_unknown');
    expect(result.issues).toContain('phone_invalid');
    expect(result.issues).toContain('siteVisitDate_date_invalid');
    expect(result.issues).toContain('biddingCloseDate_date_invalid');
    expect(result.fixes).toHaveLength(0);
  });

  it('does not modify original data object', () => {
    const data: Record<string, string> = {
      location: 'Bayamon',
    };

    validateExtraction(data);

    expect(data.location).toBe('Bayamon');
  });

  it('handles empty data gracefully', () => {
    const result = validateExtraction({});

    expect(result.validated).toEqual({});
    expect(result.issues).toHaveLength(0);
    expect(result.fixes).toHaveLength(0);
  });
});
