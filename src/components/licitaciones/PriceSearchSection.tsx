'use client';

import { useState } from 'react';
import type { PriceResult } from '@/lib/types';

interface PriceSearchSectionProps {
  licitacionId: number;
  variant: 'card' | 'modal';
}

type SearchState = 'idle' | 'loading' | 'results' | 'error';

export function PriceSearchSection({ licitacionId, variant }: PriceSearchSectionProps) {
  const [state, setState] = useState<SearchState>('idle');
  const [results, setResults] = useState<PriceResult[]>([]);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(true);

  const handleSearch = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // If we already have results, just toggle visibility
    if (state === 'results') {
      setVisible((v) => !v);
      return;
    }

    setState('loading');
    setError('');

    try {
      const res = await fetch(`/api/licitaciones/${licitacionId}/search-prices`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Error buscando precios');
        setState('error');
        return;
      }

      setResults(data.data.results || []);
      setVisible(true);
      setState('results');
    } catch {
      setError('Error de conexion');
      setState('error');
    }
  };

  const isModal = variant === 'modal';

  return (
    <div
      className={isModal ? 'rounded-md border p-3' : 'border-t pt-3 mt-1'}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        {isModal && <h4 className="font-medium text-sm">Precios de Mercado</h4>}
        <button
          onClick={handleSearch}
          disabled={state === 'loading'}
          className={`
            inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors
            ${state === 'loading'
              ? 'bg-blue-400 cursor-wait'
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }
            ${!isModal ? 'w-full justify-center sm:w-auto' : ''}
          `}
        >
          {state === 'loading' ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Buscando...
            </>
          ) : state === 'results' ? (
            visible ? 'Ocultar Precios' : 'Mostrar Precios'
          ) : (
            'Buscar Precios'
          )}
        </button>
      </div>

      {state === 'error' && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}

      {state === 'results' && visible && results.length > 0 && (
        <div className="mt-2 space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className="rounded border bg-muted/50 p-2 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-xs leading-snug">{r.item}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs whitespace-nowrap">
                  {r.price}
                </span>
              </div>
              {r.notes && (
                <p className="text-xs text-muted-foreground mt-0.5">{r.notes}</p>
              )}
              {r.sourceUrl && (
                <a
                  href={r.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline mt-0.5 inline-block"
                  onClick={(e) => e.stopPropagation()}
                >
                  {r.sourceName || 'Ver fuente'} ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {state === 'results' && visible && results.length === 0 && (
        <p className="text-xs text-muted-foreground mt-2">No se encontraron precios.</p>
      )}
    </div>
  );
}
