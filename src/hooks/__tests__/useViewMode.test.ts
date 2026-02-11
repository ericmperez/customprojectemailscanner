import { renderHook, act } from '@testing-library/react';
import { useViewMode } from '@/hooks/useViewMode';

describe('useViewMode', () => {
  it('default viewMode is "cards"', () => {
    const { result } = renderHook(() => useViewMode());
    expect(result.current.viewMode).toBe('cards');
  });

  it('reads from localStorage on mount', () => {
    localStorage.setItem('viewMode', 'table');
    const { result } = renderHook(() => useViewMode());
    expect(result.current.viewMode).toBe('table');
  });

  it('setViewMode updates state and localStorage', () => {
    const { result } = renderHook(() => useViewMode());
    act(() => {
      result.current.setViewMode('list');
    });
    expect(result.current.viewMode).toBe('list');
    expect(localStorage.getItem('viewMode')).toBe('list');
  });

  it('ignores invalid localStorage values', () => {
    localStorage.setItem('viewMode', 'invalid-mode');
    const { result } = renderHook(() => useViewMode());
    // Should fall back to default 'cards'
    expect(result.current.viewMode).toBe('cards');
  });

  it('supports all valid view modes', () => {
    const { result } = renderHook(() => useViewMode());
    const modes = ['cards', 'list', 'table'] as const;
    for (const mode of modes) {
      act(() => {
        result.current.setViewMode(mode);
      });
      expect(result.current.viewMode).toBe(mode);
    }
  });
});
