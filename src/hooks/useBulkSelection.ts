'use client';

import { useState, useCallback } from 'react';

export function useBulkSelection() {
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());

  const toggleSelection = useCallback((rowNumber: number) => {
    setSelectedCards((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) {
        next.delete(rowNumber);
      } else {
        next.add(rowNumber);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((rowNumbers: number[]) => {
    setSelectedCards(new Set(rowNumbers));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedCards(new Set());
  }, []);

  const isSelected = useCallback(
    (rowNumber: number) => selectedCards.has(rowNumber),
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
