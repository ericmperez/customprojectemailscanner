'use client';

import { useState } from 'react';
import type { QuoteItem, PriceResult } from '@/lib/types';

interface PriceSearchSectionProps {
  licitacionId: string;
  variant: 'card' | 'modal';
}

type Phase = 'idle' | 'extracting' | 'items' | 'searching' | 'results' | 'error';

export function PriceSearchSection({ licitacionId, variant }: PriceSearchSectionProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [prices, setPrices] = useState<PriceResult[]>([]);
  const [error, setError] = useState('');
  const [itemsVisible, setItemsVisible] = useState(true);
  const [pricesVisible, setPricesVisible] = useState(true);

  const handleExtractItems = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // If already extracted, toggle visibility
    if (phase === 'items' || phase === 'results') {
      setItemsVisible((v) => !v);
      return;
    }

    setPhase('extracting');
    setError('');

    try {
      const res = await fetch(`/api/licitaciones/${licitacionId}/extract-items`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Error extrayendo items');
        setPhase('error');
        return;
      }

      setItems(data.data.items || []);
      setItemsVisible(true);
      setPhase('items');
    } catch {
      setError('Error de conexion');
      setPhase('error');
    }
  };

  const handleSearchPrices = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // If already have prices, toggle visibility
    if (phase === 'results') {
      setPricesVisible((v) => !v);
      return;
    }

    setPhase('searching');
    setError('');

    try {
      const res = await fetch(`/api/licitaciones/${licitacionId}/search-prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Error buscando precios');
        setPhase('items'); // Go back to items phase on error
        return;
      }

      setPrices(data.data.results || []);
      setPricesVisible(true);
      setPhase('results');
    } catch {
      setError('Error de conexion');
      setPhase('items');
    }
  };

  const isModal = variant === 'modal';
  const hasItems = items.length > 0;

  return (
    <div
      className={isModal ? 'rounded-md border p-3' : 'border-t pt-3 mt-1'}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header + Buttons */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {isModal && <h4 className="font-medium text-sm">Cotizacion</h4>}
        <div className="flex gap-2">
          {/* Step 1: Extract items */}
          <button
            onClick={handleExtractItems}
            disabled={phase === 'extracting'}
            className={`
              inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors
              ${phase === 'extracting'
                ? 'bg-blue-400 cursor-wait'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
              }
              ${!isModal && !hasItems ? 'w-full justify-center sm:w-auto' : ''}
            `}
          >
            {phase === 'extracting' ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Extrayendo...
              </>
            ) : hasItems ? (
              itemsVisible ? 'Ocultar Items' : 'Mostrar Items'
            ) : (
              'Listar Items'
            )}
          </button>

          {/* Step 2: Search prices (only after items extracted) */}
          {hasItems && (
            <button
              onClick={handleSearchPrices}
              disabled={phase === 'searching'}
              className={`
                inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors
                ${phase === 'searching'
                  ? 'bg-emerald-400 cursor-wait'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                }
              `}
            >
              {phase === 'searching' ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Buscando...
                </>
              ) : prices.length > 0 ? (
                pricesVisible ? 'Ocultar Precios' : 'Mostrar Precios'
              ) : (
                'Buscar Precios'
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}

      {/* Items table */}
      {hasItems && itemsVisible && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-1 pr-2 font-medium">#</th>
                <th className="pb-1 pr-2 font-medium">Item</th>
                <th className="pb-1 pr-2 font-medium text-right">Cant.</th>
                <th className="pb-1 font-medium">Unidad</th>
                {/* Price column if we have results */}
                {prices.length > 0 && pricesVisible && (
                  <>
                    <th className="pb-1 pr-2 font-medium text-right">Precio Unit.</th>
                    <th className="pb-1 font-medium">Fuente</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const price = prices[i];
                return (
                  <tr key={i} className="border-b border-muted/50 last:border-0">
                    <td className="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                    <td className="py-1.5 pr-2">{item.item}</td>
                    <td className="py-1.5 pr-2 text-right font-medium">{item.qty}</td>
                    <td className="py-1.5">{item.unit}</td>
                    {prices.length > 0 && pricesVisible && (
                      <>
                        <td className="py-1.5 pr-2 text-right text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">
                          {price?.price || '—'}
                        </td>
                        <td className="py-1.5">
                          {price?.sourceUrl ? (
                            <a
                              href={price.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {price.sourceName || 'Ver'} ↗
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Price notes (shown below table when prices exist) */}
      {prices.length > 0 && pricesVisible && itemsVisible && (
        <div className="mt-2 space-y-1">
          {prices.filter((p) => p.notes).map((p, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              <span className="font-medium">{p.item}:</span> {p.notes}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
