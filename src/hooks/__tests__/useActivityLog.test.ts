import { renderHook, act, waitFor } from '@testing-library/react';
import { useActivityLog, type ActivityEntry } from '@/hooks/useActivityLog';

const PAGE_SIZE = 30;

function makeEntries(count: number): ActivityEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `entry-${i}`,
    action: `action-${i}`,
    licitacion_id: null,
    licitacion_title: null,
    user_name: 'Test User',
    details: null,
    created_at: new Date().toISOString(),
  }));
}

function mockFetchSuccess(data: ActivityEntry[]) {
  return {
    json: () => Promise.resolve({ success: true, data }),
  } as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useActivityLog', () => {
  it('fetches entries on mount', async () => {
    const entries = makeEntries(5);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchSuccess(entries));

    const { result } = renderHook(() => useActivityLog());

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(5);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `/api/activity-log?limit=${PAGE_SIZE}&offset=0`
    );
  });

  it('sets hasMore to false when fewer than PAGE_SIZE entries returned', async () => {
    const entries = makeEntries(10); // fewer than 30
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchSuccess(entries));

    const { result } = renderHook(() => useActivityLog());

    await waitFor(() => {
      expect(result.current.hasMore).toBe(false);
    });
  });

  it('sets hasMore to true when PAGE_SIZE entries returned', async () => {
    const entries = makeEntries(PAGE_SIZE);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchSuccess(entries));

    const { result } = renderHook(() => useActivityLog());

    await waitFor(() => {
      expect(result.current.hasMore).toBe(true);
    });
  });

  it('loadMore fetches the next page and appends entries', async () => {
    const firstPage = makeEntries(PAGE_SIZE);
    const secondPage = makeEntries(5);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockFetchSuccess(firstPage))
      .mockResolvedValueOnce(mockFetchSuccess(secondPage));

    const { result } = renderHook(() => useActivityLog());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.entries).toHaveLength(PAGE_SIZE);
    });

    // Load more
    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(PAGE_SIZE + 5);
    });

    // Second call should use offset = PAGE_SIZE
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `/api/activity-log?limit=${PAGE_SIZE}&offset=${PAGE_SIZE}`
    );
  });

  it('logClientAction sends a POST request', async () => {
    const entries = makeEntries(3);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchSuccess(entries));

    const { result } = renderHook(() => useActivityLog());

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(3);
    });

    await act(async () => {
      result.current.logClientAction('viewed', 'lic-123', 'Test Licitacion');
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/activity-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'viewed',
        licitacionId: 'lic-123',
        licitacionTitle: 'Test Licitacion',
      }),
    });
  });

  it('refresh re-fetches from the beginning', async () => {
    const initialEntries = makeEntries(5);
    const refreshedEntries = makeEntries(8);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockFetchSuccess(initialEntries))
      .mockResolvedValueOnce(mockFetchSuccess(refreshedEntries));

    const { result } = renderHook(() => useActivityLog());

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(5);
    });

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(8);
    });

    // Both calls should use offset=0 (reset mode)
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      `/api/activity-log?limit=${PAGE_SIZE}&offset=0`
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      `/api/activity-log?limit=${PAGE_SIZE}&offset=0`
    );
  });

  it('auto-refetches on the polling interval', async () => {
    // Use fake timers with shouldAdvanceTime so promises still resolve
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const entries = makeEntries(3);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchSuccess(entries));

    renderHook(() => useActivityLog());

    // Wait for initial fetch
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    // Advance 30 seconds for the interval
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
