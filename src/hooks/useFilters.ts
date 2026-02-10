'use client';

import { useState, useCallback, useEffect } from 'react';
import type { FilterOptions } from '@/lib/types';

export interface FilterState {
  status: string;
  category: string;
  type: string;
  dateRange: string;
  search: string;
  sort: string;
  town: string[];
}

export const DEFAULT_FILTERS: FilterState = {
  status: 'pending',
  category: '',
  type: '',
  dateRange: '',
  search: '',
  sort: 'close-date-asc',
  town: [],
};

export function useFilters() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ towns: [], categories: [] });

  useEffect(() => {
    fetch('/api/filter-options')
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setFilterOptions(result.data);
      })
      .catch(console.error);
  }, []);

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const setQuickFilter = useCallback((overrides: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...overrides }));
  }, []);

  const applyPreset = useCallback((overrides: Partial<FilterState>) => {
    setFilters({ ...DEFAULT_FILTERS, ...overrides });
  }, []);

  // Build query params (excluding search and sort, which are client-side)
  const buildQueryFilters = useCallback((): Record<string, string | string[]> => {
    const query: Record<string, string | string[]> = {};
    if (filters.status) query.status = filters.status;
    if (filters.category) query.category = filters.category;
    if (filters.type) query.type = filters.type;
    if (filters.dateRange) query.dateRange = filters.dateRange;
    if (filters.town.length > 0) query.town = filters.town;
    return query;
  }, [filters]);

  return {
    filters,
    filterOptions,
    updateFilter,
    clearFilters,
    setQuickFilter,
    applyPreset,
    buildQueryFilters,
  };
}
