'use client';

import { useState, useCallback } from 'react';
import type { Licitacion } from '@/lib/types';
import { sortLicitaciones } from '@/lib/utils';

interface UseLicitacionesReturn {
  licitaciones: Licitacion[];
  loading: boolean;
  error: string | null;
  loadLicitaciones: (filters: Record<string, string | string[]>, sortBy?: string) => Promise<void>;
  searchFilter: (items: Licitacion[], searchTerm: string) => Licitacion[];
}

export function useLicitaciones(): UseLicitacionesReturn {
  const [licitaciones, setLicitaciones] = useState<Licitacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLicitaciones = useCallback(
    async (filters: Record<string, string | string[]>, sortBy?: string) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.filter(Boolean).forEach((item) => params.append(key, item));
          } else if (value) {
            params.append(key, value);
          }
        });

        const query = params.toString();
        const response = await fetch(`/api/licitaciones${query ? `?${query}` : ''}`);
        const result = await response.json();

        if (result.success) {
          let data = Array.isArray(result.data) ? result.data : [];
          if (sortBy) {
            data = sortLicitaciones(data, sortBy);
          }
          setLicitaciones(data);
        } else {
          setError(result.error || 'Error loading data');
          setLicitaciones([]);
        }
      } catch (err) {
        console.error('Error loading licitaciones:', err);
        setError('Error loading data');
        setLicitaciones([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const searchFilter = useCallback((items: Licitacion[], searchTerm: string): Licitacion[] => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase().trim();
    return items.filter((lic) => {
      const searchableText = [
        lic.title || '',
        lic.subject || '',
        lic.location || '',
        lic.description || '',
        lic.pdfFilename || '',
        lic.contactName || '',
        lic.visitLocation || '',
        lic.category || '',
      ]
        .join(' ')
        .toLowerCase();
      return searchableText.includes(term);
    });
  }, []);

  return { licitaciones, loading, error, loadLicitaciones, searchFilter };
}
