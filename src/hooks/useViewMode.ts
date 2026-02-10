'use client';

import { useState, useCallback, useEffect } from 'react';

export type ViewMode = 'cards' | 'list' | 'table';

export function useViewMode() {
  const [viewMode, setViewModeState] = useState<ViewMode>('cards');

  // Sync from localStorage after hydration
  useEffect(() => {
    const stored = localStorage.getItem('viewMode') as ViewMode | null;
    if (stored && ['cards', 'list', 'table'].includes(stored)) {
      setViewModeState(stored);
    }
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem('viewMode', mode);
  }, []);

  return { viewMode, setViewMode };
}
