'use client';

import { useState, useCallback } from 'react';

export function useBulkSelection() {
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((id: string) => {
    setSelectedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedCards(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedCards(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedCards.has(id),
    [selectedCards]
  );

  return {
    selectedCards,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    selectedCount: selectedCards.size,
  };
}
