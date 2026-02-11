import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

function createHandlers() {
  return {
    onSearch: vi.fn(),
    onRefresh: vi.fn(),
    onClearFilters: vi.fn(),
    onExport: vi.fn(),
    onToggleCalendar: vi.fn(),
    onVisitsThisWeek: vi.fn(),
    onClosingSoon: vi.fn(),
    onPendingVisits: vi.fn(),
    onToggleTheme: vi.fn(),
    onCloseModal: vi.fn(),
  };
}

function pressKey(key: string) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key }));
  });
}

describe('useKeyboardShortcuts', () => {
  it('"/" calls onSearch', () => {
    const handlers = createHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));
    pressKey('/');
    expect(handlers.onSearch).toHaveBeenCalledTimes(1);
  });

  it('"r" calls onRefresh', () => {
    const handlers = createHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));
    pressKey('r');
    expect(handlers.onRefresh).toHaveBeenCalledTimes(1);
  });

  it('"c" calls onClearFilters', () => {
    const handlers = createHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));
    pressKey('c');
    expect(handlers.onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('"e" calls onExport', () => {
    const handlers = createHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));
    pressKey('e');
    expect(handlers.onExport).toHaveBeenCalledTimes(1);
  });

  it('"s" calls onToggleCalendar', () => {
    const handlers = createHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));
    pressKey('s');
    expect(handlers.onToggleCalendar).toHaveBeenCalledTimes(1);
  });

  it('"1" calls onVisitsThisWeek', () => {
    const handlers = createHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));
    pressKey('1');
    expect(handlers.onVisitsThisWeek).toHaveBeenCalledTimes(1);
  });

  it('"2" calls onClosingSoon', () => {
    const handlers = createHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));
    pressKey('2');
    expect(handlers.onClosingSoon).toHaveBeenCalledTimes(1);
  });

  it('"3" calls onPendingVisits', () => {
    const handlers = createHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));
    pressKey('3');
    expect(handlers.onPendingVisits).toHaveBeenCalledTimes(1);
  });

  it('"d" calls onToggleTheme', () => {
    const handlers = createHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));
    pressKey('d');
    expect(handlers.onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('"Escape" calls onCloseModal', () => {
    const handlers = createHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));
    pressKey('Escape');
    expect(handlers.onCloseModal).toHaveBeenCalledTimes(1);
  });

  it('ignores shortcuts when typing in INPUT', () => {
    const handlers = createHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'r', bubbles: true });
      Object.defineProperty(event, 'target', { value: input });
      document.dispatchEvent(event);
    });

    expect(handlers.onRefresh).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('Escape in INPUT blurs the element instead of calling onCloseModal', () => {
    const handlers = createHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const blurSpy = vi.spyOn(input, 'blur');

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      Object.defineProperty(event, 'target', { value: input });
      document.dispatchEvent(event);
    });

    expect(blurSpy).toHaveBeenCalled();
    expect(handlers.onCloseModal).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
