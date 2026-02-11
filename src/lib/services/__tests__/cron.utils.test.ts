import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isBiddingOpen, isMinutaOrAsistencia } from '@/lib/services/cron.utils';

describe('isBiddingOpen', () => {
  beforeEach(() => {
    // Fix date to January 15, 2025
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 15));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for empty string (assume open)', () => {
    expect(isBiddingOpen('')).toBe(true);
  });

  it('returns true for "No disponible" (assume open)', () => {
    expect(isBiddingOpen('No disponible')).toBe(true);
  });

  it('returns true for MM/DD/YYYY future date', () => {
    expect(isBiddingOpen('06/15/2025')).toBe(true);
  });

  it('returns false for MM/DD/YYYY past date', () => {
    expect(isBiddingOpen('01/01/2025')).toBe(false);
  });

  it('returns true for MM/DD/YYYY date that is today', () => {
    // Today is Jan 15 2025; close date set to end of day should still be >= today start of day
    expect(isBiddingOpen('01/15/2025')).toBe(true);
  });

  it('returns true for Spanish format future date', () => {
    expect(isBiddingOpen('15 de marzo de 2025')).toBe(true);
  });

  it('returns false for Spanish format past date', () => {
    expect(isBiddingOpen('10 de enero de 2025')).toBe(false);
  });

  it('returns true for Spanish format with mixed casing', () => {
    expect(isBiddingOpen('20 de Febrero de 2025')).toBe(true);
  });

  it('returns true for ISO date fallback that is in the future', () => {
    expect(isBiddingOpen('2025-06-01')).toBe(true);
  });

  it('returns false for ISO date fallback that is in the past', () => {
    expect(isBiddingOpen('2024-12-31')).toBe(false);
  });

  it('returns true for unparseable string (assume open)', () => {
    expect(isBiddingOpen('this is not a date')).toBe(true);
  });

  it('returns false for Spanish format past date (diciembre)', () => {
    expect(isBiddingOpen('25 de diciembre de 2024')).toBe(false);
  });
});

describe('isMinutaOrAsistencia', () => {
  it('returns true for filename containing "minuta"', () => {
    expect(isMinutaOrAsistencia('Minuta_reunion.pdf')).toBe(true);
  });

  it('returns true for filename containing "asistencia"', () => {
    expect(isMinutaOrAsistencia('asistencia_evento.pdf')).toBe(true);
  });

  it('returns false for a regular licitacion PDF', () => {
    expect(isMinutaOrAsistencia('licitacion.pdf')).toBe(false);
  });

  it('returns true for uppercase MINUTA (case-insensitive)', () => {
    expect(isMinutaOrAsistencia('MINUTA.PDF')).toBe(true);
  });
});
