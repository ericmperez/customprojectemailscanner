import { renderHook, act } from '@testing-library/react';
import { useBulkSelection } from '@/hooks/useBulkSelection';

describe('useBulkSelection', () => {
  it('starts with an empty selection', () => {
    const { result } = renderHook(() => useBulkSelection());
    expect(result.current.selectedCards.size).toBe(0);
  });

  it('starts with selectedCount = 0', () => {
    const { result } = renderHook(() => useBulkSelection());
    expect(result.current.selectedCount).toBe(0);
  });

  it('toggleSelection adds an item to the selection', () => {
    const { result } = renderHook(() => useBulkSelection());
    act(() => {
      result.current.toggleSelection(5);
    });
    expect(result.current.selectedCards.has(5)).toBe(true);
    expect(result.current.selectedCount).toBe(1);
  });

  it('toggleSelection removes an already-selected item', () => {
    const { result } = renderHook(() => useBulkSelection());
    act(() => {
      result.current.toggleSelection(5);
    });
    act(() => {
      result.current.toggleSelection(5);
    });
    expect(result.current.selectedCards.has(5)).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it('selectAll sets specific row numbers', () => {
    const { result } = renderHook(() => useBulkSelection());
    act(() => {
      result.current.selectAll([1, 2, 3]);
    });
    expect(result.current.selectedCount).toBe(3);
    expect(result.current.selectedCards.has(1)).toBe(true);
    expect(result.current.selectedCards.has(2)).toBe(true);
    expect(result.current.selectedCards.has(3)).toBe(true);
  });

  it('clearSelection empties the set', () => {
    const { result } = renderHook(() => useBulkSelection());
    act(() => {
      result.current.selectAll([1, 2, 3]);
    });
    act(() => {
      result.current.clearSelection();
    });
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.selectedCards.size).toBe(0);
  });

  it('isSelected returns true for selected items', () => {
    const { result } = renderHook(() => useBulkSelection());
    act(() => {
      result.current.toggleSelection(7);
    });
    expect(result.current.isSelected(7)).toBe(true);
  });

  it('isSelected returns false for unselected items', () => {
    const { result } = renderHook(() => useBulkSelection());
    act(() => {
      result.current.toggleSelection(7);
    });
    expect(result.current.isSelected(99)).toBe(false);
  });
});
