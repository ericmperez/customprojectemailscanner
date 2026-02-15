import { renderHook, act } from '@testing-library/react';
import { useLicitaciones } from '@/hooks/useLicitaciones';
import { buildLicitacion } from '@/__tests__/factories';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useLicitaciones', () => {
  it('initial state: empty licitaciones, not loading, no error', () => {
    const { result } = renderHook(() => useLicitaciones());
    expect(result.current.licitaciones).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('loadLicitaciones fetches with query params and updates licitaciones', async () => {
    const items = [buildLicitacion({ id: '1' }), buildLicitacion({ id: '2' })];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: items }),
    } as Response);

    const { result } = renderHook(() => useLicitaciones());
    await act(async () => {
      await result.current.loadLicitaciones({ status: 'pending', category: 'Mantenimiento' });
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/licitaciones?')
    );
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('status=pending');
    expect(calledUrl).toContain('category=Mantenimiento');
    expect(result.current.licitaciones).toHaveLength(2);
    expect(result.current.loading).toBe(false);
  });

  it('loadLicitaciones applies sorting when sortBy is provided', async () => {
    const items = [
      buildLicitacion({ id: '1', emailDate: '2025-01-01' }),
      buildLicitacion({ id: '2', emailDate: '2025-06-01' }),
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: items }),
    } as Response);

    const { result } = renderHook(() => useLicitaciones());
    await act(async () => {
      await result.current.loadLicitaciones({}, 'email-date-desc');
    });

    // email-date-desc: newer first
    expect(result.current.licitaciones[0].emailDate).toBe('2025-06-01');
    expect(result.current.licitaciones[1].emailDate).toBe('2025-01-01');
  });

  it('loadLicitaciones sets error on API failure response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: 'Server error' }),
    } as Response);

    const { result } = renderHook(() => useLicitaciones());
    await act(async () => {
      await result.current.loadLicitaciones({});
    });

    expect(result.current.error).toBe('Server error');
    expect(result.current.licitaciones).toEqual([]);
  });

  it('loadLicitaciones sets error on network failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useLicitaciones());
    await act(async () => {
      await result.current.loadLicitaciones({});
    });

    expect(result.current.error).toBe('Error loading data');
    expect(result.current.licitaciones).toEqual([]);
  });

  it('searchFilter returns all items for empty search', () => {
    const { result } = renderHook(() => useLicitaciones());
    const items = [buildLicitacion({ id: '1' }), buildLicitacion({ id: '2' })];
    const filtered = result.current.searchFilter(items, '');
    expect(filtered).toHaveLength(2);
  });

  it('searchFilter filters by search term across title field', () => {
    const { result } = renderHook(() => useLicitaciones());
    const items = [
      buildLicitacion({ id: '1', title: 'Mantenimiento de A/C' }),
      buildLicitacion({ id: '2', title: 'Construccion de puente' }),
    ];
    const filtered = result.current.searchFilter(items, 'puente');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('Construccion de puente');
  });

  it('loadLicitaciones handles array filter values', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: [] }),
    } as Response);

    const { result } = renderHook(() => useLicitaciones());
    await act(async () => {
      await result.current.loadLicitaciones({ town: ['San Juan', 'Ponce'] });
    });

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('town=San+Juan');
    expect(calledUrl).toContain('town=Ponce');
  });

  it('loadLicitaciones skips empty filter values', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: [] }),
    } as Response);

    const { result } = renderHook(() => useLicitaciones());
    await act(async () => {
      await result.current.loadLicitaciones({ status: '', category: '' });
    });

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toBe('/api/licitaciones');
  });

  it('loadLicitaciones handles non-array data gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: null }),
    } as Response);

    const { result } = renderHook(() => useLicitaciones());
    await act(async () => {
      await result.current.loadLicitaciones({});
    });

    expect(result.current.licitaciones).toEqual([]);
  });

  it('loadLicitaciones sets default error when no error message provided', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ success: false }),
    } as Response);

    const { result } = renderHook(() => useLicitaciones());
    await act(async () => {
      await result.current.loadLicitaciones({});
    });

    expect(result.current.error).toBe('Error loading data');
  });

  it('searchFilter filters across multiple fields (location, category, description)', () => {
    const { result } = renderHook(() => useLicitaciones());
    const items = [
      buildLicitacion({ id: '1', location: 'Bayamon', category: 'Construccion', description: 'Regular description' }),
      buildLicitacion({ id: '2', location: 'San Juan', category: 'Electricidad', description: 'Special plumbing work' }),
    ];

    // Search by location
    expect(result.current.searchFilter(items, 'Bayamon')).toHaveLength(1);
    // Search by category
    expect(result.current.searchFilter(items, 'Electricidad')).toHaveLength(1);
    // Search by description
    expect(result.current.searchFilter(items, 'plumbing')).toHaveLength(1);
  });
});
