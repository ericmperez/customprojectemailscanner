import { renderHook, act } from '@testing-library/react';
import { useSavedFilters } from '@/hooks/useSavedFilters';
import type { SavedFilterPreset } from '@/hooks/useSavedFilters';

const STORAGE_KEY = 'licitacion_filter_presets';

describe('useSavedFilters', () => {
  it('starts with empty presets', () => {
    const { result } = renderHook(() => useSavedFilters());
    expect(result.current.presets).toEqual([]);
  });

  it('reads presets from localStorage on mount', () => {
    const stored: SavedFilterPreset[] = [
      { id: 'abc', name: 'My Filter', filters: { status: 'approved' }, createdAt: 1000 },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    const { result } = renderHook(() => useSavedFilters());
    expect(result.current.presets).toHaveLength(1);
    expect(result.current.presets[0].name).toBe('My Filter');
  });

  it('savePreset creates a preset with id, name, filters, createdAt', () => {
    const { result } = renderHook(() => useSavedFilters());
    let success: boolean = false;
    act(() => {
      success = result.current.savePreset('Test Preset', { status: 'pending' });
    });
    expect(success).toBe(true);
    expect(result.current.presets).toHaveLength(1);
    const preset = result.current.presets[0];
    expect(preset.id).toBe('00000000-0000-0000-0000-000000000000');
    expect(preset.name).toBe('Test Preset');
    expect(preset.filters).toEqual({ status: 'pending' });
    expect(typeof preset.createdAt).toBe('number');
  });

  it('savePreset persists to localStorage', () => {
    const { result } = renderHook(() => useSavedFilters());
    act(() => {
      result.current.savePreset('Persisted', { category: 'Mantenimiento' });
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Persisted');
  });

  it('savePreset returns false when max (10) is reached', () => {
    const existing: SavedFilterPreset[] = Array.from({ length: 10 }, (_, i) => ({
      id: `id-${i}`,
      name: `Preset ${i}`,
      filters: {},
      createdAt: Date.now(),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    const { result } = renderHook(() => useSavedFilters());
    let success: boolean = true;
    act(() => {
      success = result.current.savePreset('Overflow', {});
    });
    expect(success).toBe(false);
    expect(result.current.presets).toHaveLength(10);
  });

  it('deletePreset removes by id', () => {
    const existing: SavedFilterPreset[] = [
      { id: 'keep', name: 'Keep', filters: {}, createdAt: 1000 },
      { id: 'remove', name: 'Remove', filters: {}, createdAt: 2000 },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    const { result } = renderHook(() => useSavedFilters());
    act(() => {
      result.current.deletePreset('remove');
    });
    expect(result.current.presets).toHaveLength(1);
    expect(result.current.presets[0].id).toBe('keep');
  });

  it('renamePreset updates the name', () => {
    const existing: SavedFilterPreset[] = [
      { id: 'abc', name: 'Old Name', filters: {}, createdAt: 1000 },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    const { result } = renderHook(() => useSavedFilters());
    act(() => {
      result.current.renamePreset('abc', 'New Name');
    });
    expect(result.current.presets[0].name).toBe('New Name');
  });

  it('maxReached is true when 10 presets exist', () => {
    const existing: SavedFilterPreset[] = Array.from({ length: 10 }, (_, i) => ({
      id: `id-${i}`,
      name: `Preset ${i}`,
      filters: {},
      createdAt: Date.now(),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    const { result } = renderHook(() => useSavedFilters());
    expect(result.current.maxReached).toBe(true);
  });
});
