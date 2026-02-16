import { renderHook, act, waitFor } from '@testing-library/react';
import { useAISettings } from '@/hooks/useAISettings';

const mockSettingsData = {
  instructions: 'Extract all fields carefully.',
  examples: [
    { field: 'title', original: 'Old Title', corrected: 'New Title', savedAt: '2025-01-01' },
  ],
  vectorExamples: [
    {
      id: 'vec-1',
      field: 'location',
      original: 'BCN',
      corrected: 'Barcelona',
      context: null,
      saved_at: '2025-01-01',
    },
  ],
};

function mockFetchResponse(data: Record<string, unknown>, success = true) {
  return {
    json: () => Promise.resolve({ success, data: success ? data : undefined }),
  } as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAISettings', () => {
  it('loads settings on mount via GET /api/settings/ai', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchResponse(mockSettingsData)
    );

    const { result } = renderHook(() => useAISettings());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/settings/ai');
    expect(result.current.instructions).toBe('Extract all fields carefully.');
    expect(result.current.examples).toHaveLength(1);
    expect(result.current.vectorExamples).toHaveLength(1);
  });

  it('returns defaults when data is null (fetch fails)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchResponse({}, false)
    );

    const { result } = renderHook(() => useAISettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.instructions).toBe('');
    expect(result.current.examples).toEqual([]);
    expect(result.current.vectorExamples).toEqual([]);
  });

  it('saveInstructions sends PUT and updates data on success', async () => {
    const updatedData = {
      ...mockSettingsData,
      instructions: 'Updated instructions',
    };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockFetchResponse(mockSettingsData)) // initial load
      .mockResolvedValueOnce(mockFetchResponse(updatedData)); // save

    const { result } = renderHook(() => useAISettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.saveInstructions('Updated instructions');
    });

    expect(success).toBe(true);
    expect(result.current.instructions).toBe('Updated instructions');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/settings/ai', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instructions: 'Updated instructions' }),
    });
  });

  it('saveInstructions returns false on failure', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockFetchResponse(mockSettingsData)) // initial load
      .mockResolvedValueOnce(mockFetchResponse({}, false)); // save fails

    const { result } = renderHook(() => useAISettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success: boolean = true;
    await act(async () => {
      success = await result.current.saveInstructions('Will fail');
    });

    expect(success).toBe(false);
    // Original data should remain unchanged
    expect(result.current.instructions).toBe('Extract all fields carefully.');
  });

  it('saveExamples sends PUT with examples array', async () => {
    const newExamples = [
      { field: 'title', original: 'A', corrected: 'B', savedAt: '2025-02-01' },
      { field: 'location', original: 'C', corrected: 'D', savedAt: '2025-02-01' },
    ];
    const updatedData = { ...mockSettingsData, examples: newExamples };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockFetchResponse(mockSettingsData))
      .mockResolvedValueOnce(mockFetchResponse(updatedData));

    const { result } = renderHook(() => useAISettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.saveExamples(newExamples);
    });

    expect(success).toBe(true);
    expect(result.current.examples).toEqual(newExamples);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/settings/ai', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examples: newExamples }),
    });
  });

  it('deleteVectorExample sends PUT with deleteExampleId', async () => {
    const updatedData = { ...mockSettingsData, vectorExamples: [] };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockFetchResponse(mockSettingsData))
      .mockResolvedValueOnce(mockFetchResponse(updatedData));

    const { result } = renderHook(() => useAISettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.deleteVectorExample('vec-1');
    });

    expect(success).toBe(true);
    expect(result.current.vectorExamples).toEqual([]);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/settings/ai', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteExampleId: 'vec-1' }),
    });
  });

  it('clearAllExamples sends PUT with clearExamples flag', async () => {
    const updatedData = { ...mockSettingsData, examples: [], vectorExamples: [] };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockFetchResponse(mockSettingsData))
      .mockResolvedValueOnce(mockFetchResponse(updatedData));

    const { result } = renderHook(() => useAISettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.clearAllExamples();
    });

    expect(success).toBe(true);
    expect(result.current.examples).toEqual([]);
    expect(result.current.vectorExamples).toEqual([]);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/settings/ai', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clearExamples: true }),
    });
  });

  it('saving flag is true while a save operation is in progress', async () => {
    let resolveSecondFetch: (value: Response) => void;
    const pendingPromise = new Promise<Response>((resolve) => {
      resolveSecondFetch = resolve;
    });

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockFetchResponse(mockSettingsData))
      .mockReturnValueOnce(pendingPromise);

    const { result } = renderHook(() => useAISettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.saving).toBe(false);

    // Start a save without awaiting
    let savePromise: Promise<boolean>;
    act(() => {
      savePromise = result.current.saveInstructions('New instructions');
    });

    // saving should be true while pending
    expect(result.current.saving).toBe(true);

    // Resolve the pending fetch
    await act(async () => {
      resolveSecondFetch!(mockFetchResponse({ ...mockSettingsData, instructions: 'New instructions' }));
      await savePromise!;
    });

    expect(result.current.saving).toBe(false);
  });
});
