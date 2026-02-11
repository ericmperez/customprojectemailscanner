import { describe, it, expect } from 'vitest';
import {
  normalizeVisitLocationLabel,
  normalizeVisitLocationFilterValue,
} from '@/lib/services/visit-location.utils';

describe('normalizeVisitLocationLabel', () => {
  it('returns empty string for null', () => {
    expect(normalizeVisitLocationLabel(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(normalizeVisitLocationLabel(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(normalizeVisitLocationLabel('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeVisitLocationLabel('   ')).toBe('');
  });

  it('returns empty string for "no disponible" (case-insensitive)', () => {
    expect(normalizeVisitLocationLabel('no disponible')).toBe('');
    expect(normalizeVisitLocationLabel('No Disponible')).toBe('');
    expect(normalizeVisitLocationLabel('NO DISPONIBLE')).toBe('');
  });

  it('returns empty string for "no especificada" (case-insensitive)', () => {
    expect(normalizeVisitLocationLabel('no especificada')).toBe('');
    expect(normalizeVisitLocationLabel('No Especificada')).toBe('');
  });

  it('returns empty string for "n/a" (case-insensitive)', () => {
    expect(normalizeVisitLocationLabel('n/a')).toBe('');
    expect(normalizeVisitLocationLabel('N/A')).toBe('');
  });

  it('preserves valid location labels', () => {
    expect(normalizeVisitLocationLabel('EBAS Torrecilla')).toBe('EBAS Torrecilla');
  });

  it('collapses extra whitespace', () => {
    expect(normalizeVisitLocationLabel('  extra   spaces  ')).toBe('extra spaces');
  });
});

describe('normalizeVisitLocationFilterValue', () => {
  it('returns lowercase version of a valid label', () => {
    expect(normalizeVisitLocationFilterValue('EBAS Torrecilla')).toBe('ebas torrecilla');
  });

  it('returns empty string for null', () => {
    expect(normalizeVisitLocationFilterValue(null)).toBe('');
  });
});
