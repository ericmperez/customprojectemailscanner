import { renderHook, act } from '@testing-library/react';
import { useWhatsNew } from '@/hooks/useWhatsNew';

vi.mock('@/lib/data/changelog', () => ({
  LATEST_VERSION: '1.15.0',
}));

describe('useWhatsNew', () => {
  it('hydrated starts false, becomes true after effect', () => {
    const { result } = renderHook(() => useWhatsNew());
    // After render + effect, hydrated should be true
    expect(result.current.hydrated).toBe(true);
  });

  it('hasNewVersion is true when no version stored in localStorage', () => {
    const { result } = renderHook(() => useWhatsNew());
    expect(result.current.hasNewVersion).toBe(true);
  });

  it('hasNewVersion is false when stored version matches LATEST_VERSION', () => {
    localStorage.setItem('novedades_last_seen_version', '1.15.0');
    const { result } = renderHook(() => useWhatsNew());
    expect(result.current.hasNewVersion).toBe(false);
  });

  it('hasNewVersion is true when stored version is outdated', () => {
    localStorage.setItem('novedades_last_seen_version', '1.14.0');
    const { result } = renderHook(() => useWhatsNew());
    expect(result.current.hasNewVersion).toBe(true);
  });

  it('hasNewVersion becomes false after markAsSeen', () => {
    const { result } = renderHook(() => useWhatsNew());
    expect(result.current.hasNewVersion).toBe(true);

    act(() => {
      result.current.markAsSeen();
    });

    expect(result.current.hasNewVersion).toBe(false);
  });

  it('markAsSeen persists LATEST_VERSION to localStorage', () => {
    const { result } = renderHook(() => useWhatsNew());

    act(() => {
      result.current.markAsSeen();
    });

    expect(localStorage.getItem('novedades_last_seen_version')).toBe('1.15.0');
  });
});
