import { renderHook, act } from '@testing-library/react';
import { useStats } from '@/hooks/useStats';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useStats', () => {
  it('initial stats are all zeros', () => {
    const { result } = renderHook(() => useStats());
    expect(result.current.stats).toEqual({
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      interested: 0,
    });
  });

  it('loadStats fetches from /api/stats and updates state', async () => {
    const mockStats = { total: 10, pending: 5, approved: 3, rejected: 2, interested: 1 };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: mockStats }),
    } as Response);

    const { result } = renderHook(() => useStats());
    await act(async () => {
      await result.current.loadStats();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/stats');
    expect(result.current.stats).toEqual(mockStats);
  });

  it('loadStats does not update state when success is false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: 'Not found' }),
    } as Response);

    const { result } = renderHook(() => useStats());
    await act(async () => {
      await result.current.loadStats();
    });

    expect(result.current.stats).toEqual({
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      interested: 0,
    });
  });

  it('handles fetch failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useStats());
    await act(async () => {
      await result.current.loadStats();
    });

    // Stats remain at initial values
    expect(result.current.stats.total).toBe(0);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('loadStats can be called multiple times', async () => {
    const firstStats = { total: 5, pending: 3, approved: 1, rejected: 1, interested: 0 };
    const secondStats = { total: 20, pending: 10, approved: 5, rejected: 3, interested: 2 };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ json: () => Promise.resolve({ success: true, data: firstStats }) } as Response)
      .mockResolvedValueOnce({ json: () => Promise.resolve({ success: true, data: secondStats }) } as Response);

    const { result } = renderHook(() => useStats());

    await act(async () => {
      await result.current.loadStats();
    });
    expect(result.current.stats.total).toBe(5);

    await act(async () => {
      await result.current.loadStats();
    });
    expect(result.current.stats.total).toBe(20);
  });
});
