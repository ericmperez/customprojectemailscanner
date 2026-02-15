import { renderHook, act } from '@testing-library/react';
import { useFavorites } from '@/hooks/useFavorites';

describe('useFavorites', () => {
  it('starts with an empty favorites set', () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites.size).toBe(0);
  });

  it('reads from localStorage on mount', () => {
    localStorage.setItem('licitacion_favorites', JSON.stringify(['1', '2']));
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites.size).toBe(2);
    expect(result.current.isFavorite('1')).toBe(true);
    expect(result.current.isFavorite('2')).toBe(true);
  });

  it('toggleFavorite adds an item', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => {
      result.current.toggleFavorite('10');
    });
    expect(result.current.isFavorite('10')).toBe(true);
    expect(result.current.favorites.size).toBe(1);
  });

  it('toggleFavorite removes an already-favorited item', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => {
      result.current.toggleFavorite('10');
    });
    act(() => {
      result.current.toggleFavorite('10');
    });
    expect(result.current.isFavorite('10')).toBe(false);
    expect(result.current.favorites.size).toBe(0);
  });

  it('toggleFavorite persists to localStorage', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => {
      result.current.toggleFavorite('5');
    });
    const stored = JSON.parse(localStorage.getItem('licitacion_favorites')!);
    expect(stored).toEqual(['5']);
  });

  it('isFavorite returns false for items not in the set', () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.isFavorite('999')).toBe(false);
  });

  it('handles string ids correctly', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => {
      result.current.toggleFavorite('42');
    });
    expect(result.current.isFavorite('42')).toBe(true);
  });

  it('handles corrupt localStorage data gracefully', () => {
    localStorage.setItem('licitacion_favorites', '{not-an-array}');
    const { result } = renderHook(() => useFavorites());
    // Should not throw; falls back to empty set
    expect(result.current.favorites.size).toBe(0);
  });
});
