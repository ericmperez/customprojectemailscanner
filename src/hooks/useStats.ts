'use client';

import { useState, useCallback } from 'react';
import type { Stats } from '@/lib/types';

export interface LastFetchInfo {
  timestamp: string;
  triggeredBy: string;
}

export function useStats() {
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, approved: 0, rejected: 0, interested: 0 });
  const [lastFetch, setLastFetch] = useState<LastFetchInfo | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/stats');
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
        setLastFetch(result.lastFetch ?? null);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  return { stats, lastFetch, loadStats };
}
