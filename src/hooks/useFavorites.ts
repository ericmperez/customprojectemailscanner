'use client';

import { useState, useCallback, useEffect } from 'react';

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set<string>());

  // Sync from localStorage after hydration
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('licitacion_favorites') || '[]');
      if (Array.isArray(stored) && stored.length > 0) {
        setFavorites(new Set<string>(stored));
      }
    } catch {
      // ignore corrupt data
    }
  }, []);

  const toggleFavorite = useCallback((id: number | string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      const idStr = String(id);
      if (next.has(idStr)) {
        next.delete(idStr);
      } else {
        next.add(idStr);
      }
      localStorage.setItem('licitacion_favorites', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (id: number | string) => favorites.has(String(id)),
    [favorites]
  );

  return { favorites, toggleFavorite, isFavorite };
}
