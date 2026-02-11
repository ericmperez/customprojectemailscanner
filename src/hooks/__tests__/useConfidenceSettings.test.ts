import { renderHook, act, waitFor } from '@testing-library/react';
import { useConfidenceSettings } from '@/hooks/useConfidenceSettings';
import type { ConfidenceFieldSettings } from '@/lib/types';

const mockSettings: ConfidenceFieldSettings = {
  critical: ['title', 'location'],
  optional: ['description', 'summary'],
  ignored: ['contactPhone'],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useConfidenceSettings', () => {
  it('loading starts true, becomes false after fetch', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: mockSettings }),
    } as Response);

    const { result } = renderHook(() => useConfidenceSettings());
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('loads settings on mount via fetch /api/settings/confidence', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: mockSettings }),
    } as Response);

    const { result } = renderHook(() => useConfidenceSettings());

    await waitFor(() => {
      expect(result.current.settings).toEqual(mockSettings);
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/settings/confidence');
  });

  it('settings remain null when fetch returns success: false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ success: false }),
    } as Response);

    const { result } = renderHook(() => useConfidenceSettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.settings).toBeNull();
  });

  it('save PUTs to /api/settings/confidence and returns true on success', async () => {
    const updated: ConfidenceFieldSettings = {
      critical: ['title'],
      optional: ['location'],
      ignored: [],
    };
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockSettings }),
      } as Response)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: updated }),
      } as Response);

    const { result } = renderHook(() => useConfidenceSettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.save(updated);
    });

    expect(success).toBe(true);
    expect(result.current.settings).toEqual(updated);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/settings/confidence', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  });

  it('save returns false on failure', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockSettings }),
      } as Response)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false }),
      } as Response);

    const { result } = renderHook(() => useConfidenceSettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success: boolean = true;
    await act(async () => {
      success = await result.current.save(mockSettings);
    });

    expect(success).toBe(false);
  });

  it('reload re-fetches settings', async () => {
    const firstSettings: ConfidenceFieldSettings = {
      critical: ['title'],
      optional: [],
      ignored: [],
    };
    const secondSettings: ConfidenceFieldSettings = {
      critical: ['title', 'location'],
      optional: ['description'],
      ignored: [],
    };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: firstSettings }),
      } as Response)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: secondSettings }),
      } as Response);

    const { result } = renderHook(() => useConfidenceSettings());

    await waitFor(() => {
      expect(result.current.settings).toEqual(firstSettings);
    });

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.settings).toEqual(secondSettings);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
