'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ActivityEntry {
  id: string;
  action: string;
  licitacion_id: string | null;
  licitacion_title: string | null;
  user_name: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

const PAGE_SIZE = 30;
const REFETCH_INTERVAL = 30_000; // 30 seconds

export function useActivityLog() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const fetchEntries = useCallback(async (reset = false) => {
    const offset = reset ? 0 : offsetRef.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/activity-log?limit=${PAGE_SIZE}&offset=${offset}`);
      const json = await res.json();
      if (json.success) {
        const newEntries = json.data as ActivityEntry[];
        if (reset) {
          setEntries(newEntries);
          offsetRef.current = newEntries.length;
        } else {
          setEntries((prev) => [...prev, ...newEntries]);
          offsetRef.current = offset + newEntries.length;
        }
        setHasMore(newEntries.length === PAGE_SIZE);
      }
    } catch (err) {
      console.warn('Failed to fetch activity log:', err);
    }
    setLoading(false);
  }, []);

  // Initial load + polling
  useEffect(() => {
    fetchEntries(true);
    const interval = setInterval(() => fetchEntries(true), REFETCH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchEntries]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchEntries(false);
    }
  }, [loading, hasMore, fetchEntries]);

  const refresh = useCallback(() => {
    fetchEntries(true);
  }, [fetchEntries]);

  const logClientAction = useCallback(
    (action: string, licitacionId: string | null, licitacionTitle: string | null) => {
      fetch('/api/activity-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, licitacionId, licitacionTitle }),
      }).catch(() => {});
      // Optimistic: refresh after a short delay to show the new entry
      setTimeout(() => fetchEntries(true), 500);
    },
    [fetchEntries]
  );

  return { entries, loading, hasMore, loadMore, refresh, logClientAction };
}
