'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { QuoteItem, PriceResult } from '@/lib/types';
import { parseEstimatedValue, formatCurrency } from '@/lib/utils';
import { matchSuppliersToItems } from '@/lib/data/pr-suppliers';

interface PriceSearchSectionProps {
  licitacionId: string;
  variant: 'card' | 'modal';
  onEstimatedValueSaved?: (value: string) => void;
}

type Phase = 'idle' | 'loading' | 'extracting' | 'searching' | 'saving' | 'done' | 'error';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'hace un momento';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

export function PriceSearchSection({ licitacionId, variant, onEstimatedValueSaved }: PriceSearchSectionProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [prices, setPrices] = useState<PriceResult[]>([]);
  const [error, setError] = useState('');
  const [tableVisible, setTableVisible] = useState(true);
  const [savedValue, setSavedValue] = useState(false);
  const [searchedAt, setSearchedAt] = useState<string | null>(null);
  const [hasSavedResults, setHasSavedResults] = useState(false);

  // Load saved price results on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setPhase('loading');
      try {
        const res = await fetch(`/api/licitaciones/${licitacionId}/price-results`);
        const json = await res.json();
        if (cancelled) return;
        if (json.success && json.data) {
          setItems(json.data.items);
          setPrices(json.data.results);
          setSearchedAt(json.data.searchedAt);
          setHasSavedResults(true);
          setPhase('done');
          return;
        }
      } catch {
        // Failed to load saved — just show idle state
      }
      if (!cancelled) setPhase('idle');
    }
    load();
    return () => { cancelled = true; };
  }, [licitacionId]);

  const computedTotal = useMemo(() => {
    if (prices.length === 0 || items.length === 0) return null;
    let total = 0;
    let hasAny = false;
    for (let i = 0; i < items.length; i++) {
      const price = prices[i];
      if (!price?.price) continue;
      const unitPrice = parseEstimatedValue(price.price);
      if (unitPrice === null) continue;
      total += items[i].qty * unitPrice;
      hasAny = true;
    }
    return hasAny ? total : null;
  }, [prices, items]);

  const matchedSuppliers = useMemo(() => matchSuppliersToItems(items), [items]);

  const saveEstimatedValue = async (total: number) => {
    setPhase('saving');
    try {
      const formatted = formatCurrency(total);
      const res = await fetch(`/api/licitaciones/${licitacionId}/update-fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimatedValue: formatted }),
      });
      const data = await res.json();
      if (data.success) {
        setSavedValue(true);
        onEstimatedValueSaved?.(formatted);
      }
    } catch {
      // saving failed silently — user can still see the results
    }
    setPhase('done');
  };

  const runSearch = useCallback(async () => {
    setError('');
    setSavedValue(false);

    // Step 1: Extract items
    setPhase('extracting');
    let extractedItems: QuoteItem[];
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
      extractedItems = data.data.items || [];
      if (extractedItems.length === 0) {
        setError('No se encontraron items en la descripcion');
        setPhase('error');
        return;
      }
      setItems(extractedItems);
    } catch {
      setError('Error de conexion al extraer items');
      setPhase('error');
      return;
    }

    // Step 2: Search prices for all items
    setPhase('searching');
    try {
      const res = await fetch(`/api/licitaciones/${licitacionId}/search-prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: extractedItems }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Error buscando precios');
        setPhase('error');
        return;
      }
      const results: PriceResult[] = data.data.results || [];
      setPrices(results);
      setSearchedAt(data.data.searchedAt || new Date().toISOString());
      setHasSavedResults(true);
      setTableVisible(true);

      // Step 3: Auto-save estimated value
      let total = 0;
      let hasAny = false;
      for (let i = 0; i < extractedItems.length; i++) {
        const price = results[i];
        if (!price?.price) continue;
        const unitPrice = parseEstimatedValue(price.price);
        if (unitPrice === null) continue;
        total += extractedItems[i].qty * unitPrice;
        hasAny = true;
      }
      if (hasAny) {
        await saveEstimatedValue(total);
      } else {
        setPhase('done');
      }
    } catch {
      setError('Error de conexion al buscar precios');
      setPhase('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licitacionId]);

  const handleGetPrices = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // If already done, toggle visibility
    if (phase === 'done') {
      setTableVisible((v) => !v);
      return;
    }

    await runSearch();
  };

  const handleResearch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Clear existing results and re-run
    setPrices([]);
    setItems([]);
    setSearchedAt(null);
    setHasSavedResults(false);
    await runSearch();
  };

  const isModal = variant === 'modal';
  const isWorking = phase === 'extracting' || phase === 'searching' || phase === 'saving';

  const statusLabel = phase === 'loading'
    ? 'Cargando precios...'
    : phase === 'extracting'
      ? 'Extrayendo items...'
      : phase === 'searching'
        ? 'Buscando precios USA/PR...'
        : phase === 'saving'
          ? 'Guardando valor...'
          : null;

  const formatPhone = (phone: string) => phone.replace(/\D/g, '');

  return (
    <div
      className={isModal ? 'rounded-md border p-3' : 'border-t pt-3 mt-1'}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header + Buttons */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {isModal && <h4 className="font-medium text-sm">Cotizacion</h4>}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search time indicator */}
          {searchedAt && phase === 'done' && (
            <span className="text-xs text-muted-foreground">
              Buscado: {timeAgo(searchedAt)}
            </span>
          )}
          {/* Re-search button */}
          {hasSavedResults && phase === 'done' && (
            <button
              onClick={handleResearch}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground border hover:bg-muted transition-colors"
            >
              🔄 Re-buscar
            </button>
          )}
          {/* Main button */}
          <button
            onClick={handleGetPrices}
            disabled={isWorking || phase === 'loading'}
            className={`
              inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors
              ${isWorking || phase === 'loading'
                ? 'bg-emerald-400 cursor-wait'
                : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
              }
              ${!isModal && phase === 'idle' ? 'w-full justify-center sm:w-auto' : ''}
            `}
          >
            {isWorking || phase === 'loading' ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {statusLabel}
              </>
            ) : phase === 'done' ? (
              tableVisible ? 'Ocultar Precios' : 'Mostrar Precios'
            ) : (
              'Buscar Precios'
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}

      {/* Results table */}
      {items.length > 0 && prices.length > 0 && tableVisible && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-1 pr-2 font-medium">#</th>
                <th className="pb-1 pr-2 font-medium">Item</th>
                <th className="pb-1 pr-2 font-medium text-right">Cant.</th>
                <th className="pb-1 font-medium">Unidad</th>
                <th className="pb-1 pr-2 font-medium text-right">Precio Unit.</th>
                <th className="pb-1 font-medium">Fuente</th>
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
                  </tr>
                );
              })}
            </tbody>
            {computedTotal !== null && (
              <tfoot>
                <tr className="border-t-2">
                  <td className="py-2 pr-2" />
                  <td className="py-2 pr-2 font-bold text-right" colSpan={3}>Total Estimado:</td>
                  <td className="py-2 pr-2 text-right text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">
                    {formatCurrency(computedTotal)}
                  </td>
                  <td className="py-2">
                    {savedValue && (
                      <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">✅ Guardado</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Price notes */}
      {prices.length > 0 && tableVisible && (
        <div className="mt-2 space-y-1">
          {prices.filter((p) => p.notes).map((p, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              <span className="font-medium">{p.item}:</span> {p.notes}
            </p>
          ))}
        </div>
      )}

      {/* PR Supplier Directory */}
      {items.length > 0 && prices.length > 0 && tableVisible && (
        <div className="mt-4 border-t pt-3">
          <h5 className="text-sm font-medium mb-2">📞 Suplidores en Puerto Rico</h5>
          <div className="grid gap-2 sm:grid-cols-2">
            {matchedSuppliers.map((sup) => (
              <div
                key={sup.name}
                className="rounded-md border p-2 text-xs space-y-0.5"
              >
                <div className="font-semibold">{sup.name}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={`tel:${sup.phone}`}
                    className="text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    📞 {sup.phone}
                  </a>
                  <a
                    href={`https://wa.me/1${formatPhone(sup.phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    💬 WhatsApp
                  </a>
                  {sup.email && (
                    <a
                      href={`mailto:${sup.email}`}
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      📧 {sup.email}
                    </a>
                  )}
                </div>
                <div className="text-muted-foreground">
                  {sup.town} — {sup.categories.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
