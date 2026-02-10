'use client';

import { useState, useCallback, useEffect } from 'react';
import type { FilterState } from './useFilters';

const STORAGE_KEY = 'licitacion_filter_presets';
const MAX_PRESETS = 10;

export interface SavedFilterPreset {
  id: string;
  name: string;
  filters: Partial<FilterState>;
  createdAt: number;
}

export function useSavedFilters() {
  const [presets, setPresets] = useState<SavedFilterPreset[]>([]);

  // Hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(stored) && stored.length > 0) {
        setPresets(stored);
      }
    } catch {
      // ignore corrupt data
    }
  }, []);

  const persist = useCallback((next: SavedFilterPreset[]) => {
    setPresets(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const savePreset = useCallback(
    (name: string, filters: Partial<FilterState>): boolean => {
      if (presets.length >= MAX_PRESETS) return false;
      const preset: SavedFilterPreset = {
        id: crypto.randomUUID(),
        name,
        filters,
        createdAt: Date.now(),
      };
      persist([...presets, preset]);
      return true;
    },
    [presets, persist]
  );

  const deletePreset = useCallback(
    (id: string) => {
      persist(presets.filter((p) => p.id !== id));
    },
    [presets, persist]
  );

  const renamePreset = useCallback(
    (id: string, newName: string) => {
      persist(presets.map((p) => (p.id === id ? { ...p, name: newName } : p)));
    },
    [presets, persist]
  );

  return {
    presets,
    savePreset,
    deletePreset,
    renamePreset,
    maxReached: presets.length >= MAX_PRESETS,
  };
}
