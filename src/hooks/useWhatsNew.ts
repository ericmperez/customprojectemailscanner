'use client';

import { useState, useCallback, useEffect } from 'react';
import { LATEST_VERSION } from '@/lib/data/changelog';

const STORAGE_KEY = 'novedades_last_seen_version';

export function useWhatsNew() {
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setLastSeen(stored);
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const hasNewVersion = hydrated && lastSeen !== LATEST_VERSION;

  const markAsSeen = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, LATEST_VERSION);
      setLastSeen(LATEST_VERSION);
    } catch {
      // ignore
    }
  }, []);

  return { hasNewVersion, hydrated, markAsSeen };
}
