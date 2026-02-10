'use client';

import { useEffect } from 'react';

interface ShortcutHandlers {
  onSearch: () => void;
  onRefresh: () => void;
  onClearFilters: () => void;
  onExport: () => void;
  onToggleCalendar: () => void;
  onVisitsThisWeek: () => void;
  onClosingSoon: () => void;
  onPendingVisits: () => void;
  onToggleTheme: () => void;
  onCloseModal: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tagName = target.tagName;

      // Ignore shortcuts when typing in input fields
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
        if (e.key === 'Escape') {
          (target as HTMLInputElement).blur();
        }
        return;
      }

      // Escape always closes modals
      if (e.key === 'Escape') {
        handlers.onCloseModal();
        return;
      }

      switch (e.key.toLowerCase()) {
        case '/':
          e.preventDefault();
          handlers.onSearch();
          break;
        case 'r':
          e.preventDefault();
          handlers.onRefresh();
          break;
        case 'c':
          e.preventDefault();
          handlers.onClearFilters();
          break;
        case 'e':
          e.preventDefault();
          handlers.onExport();
          break;
        case 's':
          e.preventDefault();
          handlers.onToggleCalendar();
          break;
        case '1':
          e.preventDefault();
          handlers.onVisitsThisWeek();
          break;
        case '2':
          e.preventDefault();
          handlers.onClosingSoon();
          break;
        case '3':
          e.preventDefault();
          handlers.onPendingVisits();
          break;
        case 'd':
          e.preventDefault();
          handlers.onToggleTheme();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
