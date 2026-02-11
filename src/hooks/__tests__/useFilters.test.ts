import { renderHook, act, waitFor } from '@testing-library/react';
import { useFilters, DEFAULT_FILTERS } from '@/hooks/useFilters';

const mockFilterOptions = {
  success: true,
  data: { towns: ['San Juan', 'Ponce'], categories: ['Mantenimiento', 'Construccion'] },
};

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    json: () => Promise.resolve(mockFilterOptions),
  } as Response);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useFilters', () => {
  it('initial state matches DEFAULT_FILTERS', () => {
    const { result } = renderHook(() => useFilters());
    expect(result.current.filters).toEqual(DEFAULT_FILTERS);
  });

  it('default status is "pending"', () => {
    const { result } = renderHook(() => useFilters());
    expect(result.current.filters.status).toBe('pending');
  });

  it('default sort is "close-date-asc"', () => {
    const { result } = renderHook(() => useFilters());
    expect(result.current.filters.sort).toBe('close-date-asc');
  });

  it('updateFilter updates an individual filter', () => {
    const { result } = renderHook(() => useFilters());
    act(() => {
      result.current.updateFilter('category', 'Mantenimiento');
    });
    expect(result.current.filters.category).toBe('Mantenimiento');
    // Other filters remain at defaults
    expect(result.current.filters.status).toBe('pending');
  });

  it('clearFilters resets to DEFAULT_FILTERS', () => {
    const { result } = renderHook(() => useFilters());
    act(() => {
      result.current.updateFilter('category', 'Mantenimiento');
      result.current.updateFilter('priority', 'High');
    });
    act(() => {
      result.current.clearFilters();
    });
    expect(result.current.filters).toEqual(DEFAULT_FILTERS);
  });

  it('setQuickFilter merges partial overrides with current state', () => {
    const { result } = renderHook(() => useFilters());
    // First change a filter away from defaults
    act(() => {
      result.current.updateFilter('search', 'test');
    });
    // Then apply a quick filter override
    act(() => {
      result.current.setQuickFilter({ status: 'approved', priority: 'High' });
    });
    expect(result.current.filters.status).toBe('approved');
    expect(result.current.filters.priority).toBe('High');
    // The previously set search should persist
    expect(result.current.filters.search).toBe('test');
  });

  it('applyPreset merges with DEFAULT_FILTERS, not current state', () => {
    const { result } = renderHook(() => useFilters());
    // Modify current filters
    act(() => {
      result.current.updateFilter('search', 'something');
      result.current.updateFilter('priority', 'High');
    });
    // Apply preset - should start from DEFAULT_FILTERS, not current
    act(() => {
      result.current.applyPreset({ status: 'approved' });
    });
    expect(result.current.filters.status).toBe('approved');
    // search and priority should be reset to defaults
    expect(result.current.filters.search).toBe('');
    expect(result.current.filters.priority).toBe('');
  });

  it('buildQueryFilters builds correct query params', () => {
    const { result } = renderHook(() => useFilters());
    act(() => {
      result.current.updateFilter('status', 'approved');
      result.current.updateFilter('category', 'Mantenimiento');
      result.current.updateFilter('town', ['San Juan', 'Ponce']);
    });
    const query = result.current.buildQueryFilters();
    expect(query.status).toBe('approved');
    expect(query.category).toBe('Mantenimiento');
    expect(query.town).toEqual(['San Juan', 'Ponce']);
    // Empty/default values should NOT appear
    expect(query).not.toHaveProperty('priority');
    expect(query).not.toHaveProperty('search');
    expect(query).not.toHaveProperty('sort');
  });

  it('buildQueryFilters omits empty town array', () => {
    const { result } = renderHook(() => useFilters());
    const query = result.current.buildQueryFilters();
    expect(query).not.toHaveProperty('town');
  });

  it('buildQueryFilters includes type when set', () => {
    const { result } = renderHook(() => useFilters());
    act(() => {
      result.current.updateFilter('type', 'visits');
    });
    const query = result.current.buildQueryFilters();
    expect(query.type).toBe('visits');
  });

  it('buildQueryFilters includes interested when set', () => {
    const { result } = renderHook(() => useFilters());
    act(() => {
      result.current.updateFilter('interested', 'true');
    });
    const query = result.current.buildQueryFilters();
    expect(query.interested).toBe('true');
  });

  it('buildQueryFilters includes dateRange when set', () => {
    const { result } = renderHook(() => useFilters());
    act(() => {
      result.current.updateFilter('dateRange', 'this-week');
    });
    const query = result.current.buildQueryFilters();
    expect(query.dateRange).toBe('this-week');
  });

  it('handles fetch failure for filter options gracefully', async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network fail'));
    const { result } = renderHook(() => useFilters());
    // Should keep default empty filter options
    await waitFor(() => {
      expect(result.current.filterOptions).toEqual({ towns: [], categories: [] });
    });
  });

  it('handles non-success response for filter options', async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false }),
    } as Response);
    const { result } = renderHook(() => useFilters());
    await waitFor(() => {
      expect(result.current.filterOptions).toEqual({ towns: [], categories: [] });
    });
  });

  it('fetches filter options from /api/filter-options on mount', async () => {
    const { result } = renderHook(() => useFilters());
    await waitFor(() => {
      expect(result.current.filterOptions.towns).toEqual(['San Juan', 'Ponce']);
      expect(result.current.filterOptions.categories).toEqual(['Mantenimiento', 'Construccion']);
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/filter-options');
  });
});
