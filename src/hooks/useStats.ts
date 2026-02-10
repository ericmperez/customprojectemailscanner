'use client';

import { useState, useCallback } from 'react';
import type { Stats } from '@/lib/types';

export function useStats() {
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, approved: 0, rejected: 0 });

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/stats');
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  return { stats, loadStats };
}
