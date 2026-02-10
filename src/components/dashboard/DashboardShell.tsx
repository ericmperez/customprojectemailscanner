'use client';

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

import { UserButton } from '@clerk/nextjs';
import { StatsBar } from './StatsBar';
import { FilterBar } from './FilterBar';
import { LicitacionCard } from '@/components/licitaciones/LicitacionCard';
import { LicitacionListItem } from '@/components/licitaciones/LicitacionListItem';
import { LicitacionTable } from '@/components/licitaciones/LicitacionTable';
import { CalendarView } from '@/components/calendar/CalendarView';
import { ApprovalModal } from '@/components/modals/ApprovalModal';
import { DetailModal } from '@/components/modals/DetailModal';

import { useLicitaciones } from '@/hooks/useLicitaciones';
import { useStats } from '@/hooks/useStats';
import { useFavorites } from '@/hooks/useFavorites';
import { useViewMode } from '@/hooks/useViewMode';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useFilters, DEFAULT_FILTERS } from '@/hooks/useFilters';
import { useSavedFilters } from '@/hooks/useSavedFilters';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { arrayToCSV, downloadCSV, exportToICalendar } from '@/lib/utils';
import type { Licitacion } from '@/lib/types';

export function DashboardShell() {
  const { theme, setTheme } = useTheme();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Hooks
  const { licitaciones, loading, loadLicitaciones, searchFilter } = useLicitaciones();
  const { stats, loadStats } = useStats();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { viewMode, setViewMode } = useViewMode();
  const { selectedCards, toggleSelection, selectAll, clearSelection, isSelected, selectedCount } =
    useBulkSelection();
  const { filters, filterOptions, updateFilter, clearFilters, setQuickFilter, applyPreset, buildQueryFilters } =
    useFilters();
  const { presets: savedPresets, savePreset, deletePreset, renamePreset, maxReached: maxPresetsReached } =
    useSavedFilters();

  // Modal state
  const [isCalendarView, setIsCalendarView] = useState(false);
  const [approvalModal, setApprovalModal] = useState<{
    open: boolean;
    action: 'approve' | 'reject' | null;
    id: number | null;
  }>({ open: false, action: null, id: null });
  const [detailModal, setDetailModal] = useState<{ open: boolean; lic: Licitacion | null }>({
    open: false,
    lic: null,
  });
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Derived data: apply client-side search + favorites filter
  const displayedLicitaciones = useMemo(() => {
    let items = searchFilter(licitaciones, filters.search);
    if (showFavoritesOnly) {
      items = items.filter((lic) => isFavorite(lic.id || lic.rowNumber));
    }
    return items;
  }, [licitaciones, filters.search, showFavoritesOnly, searchFilter, isFavorite]);

  // Load data on filter change
  const refresh = useCallback(() => {
    const query = buildQueryFilters();
    loadLicitaciones(query, filters.sort);
    loadStats();
    clearSelection();
    setShowFavoritesOnly(false);
  }, [buildQueryFilters, filters.sort, loadLicitaciones, loadStats, clearSelection]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Approval actions
  const handleApprove = useCallback((id: number) => {
    setApprovalModal({ open: true, action: 'approve', id });
  }, []);

  const handleReject = useCallback((id: number) => {
    setApprovalModal({ open: true, action: 'reject', id });
  }, []);

  const handleResetPending = useCallback(
    async (id: number) => {
      if (!confirm('¿Volver esta licitación a estado pendiente?')) return;
      try {
        const response = await fetch(`/api/licitaciones/${id}/pending`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: '' }),
        });
        const result = await response.json();
        if (result.success) {
          toast.success('Licitacion marcada como pendiente');
          refresh();
        } else {
          toast.error('Error al actualizar');
        }
      } catch {
        toast.error('Error al actualizar');
      }
    },
    [refresh]
  );

  const handleApprovalConfirm = useCallback(
    async (notes: string) => {
      if (!approvalModal.id || !approvalModal.action) return;
      try {
        const response = await fetch(
          `/api/licitaciones/${approvalModal.id}/${approvalModal.action}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes }),
          }
        );
        const result = await response.json();
        if (result.success) {
          const text = approvalModal.action === 'approve' ? 'aprobada' : 'rechazada';
          toast.success(`Licitacion ${text} exitosamente`);
          refresh();
        } else {
          toast.error('Error al actualizar');
        }
      } catch {
        toast.error('Error al actualizar');
      }
      setApprovalModal({ open: false, action: null, id: null });
    },
    [approvalModal, refresh]
  );

  // Bulk actions
  const handleBulkApprove = useCallback(async () => {
    if (selectedCount === 0) return;
    if (!confirm(`¿Aprobar ${selectedCount} licitación(es)?`)) return;
    try {
      await Promise.all(
        Array.from(selectedCards).map((rowNumber) =>
          fetch(`/api/licitaciones/${rowNumber}/approve`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: '[Aprobado en lote]' }),
          })
        )
      );
      toast.success(`${selectedCount} licitación(es) aprobada(s)`);
      refresh();
    } catch {
      toast.error('Error al aprobar licitaciones');
    }
  }, [selectedCards, selectedCount, refresh]);

  const handleBulkReject = useCallback(async () => {
    if (selectedCount === 0) return;
    if (!confirm(`¿Rechazar ${selectedCount} licitación(es)?`)) return;
    try {
      await Promise.all(
        Array.from(selectedCards).map((rowNumber) =>
          fetch(`/api/licitaciones/${rowNumber}/reject`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: '[Rechazado en lote]' }),
          })
        )
      );
      toast.success(`${selectedCount} licitación(es) rechazada(s)`);
      refresh();
    } catch {
      toast.error('Error al rechazar licitaciones');
    }
  }, [selectedCards, selectedCount, refresh]);

  // Export
  const handleExportCSV = useCallback(() => {
    if (displayedLicitaciones.length === 0) {
      toast.warning('No hay licitaciones para exportar');
      return;
    }
    const csv = arrayToCSV(displayedLicitaciones);
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `licitaciones_${timestamp}.csv`);
    toast.success(`${displayedLicitaciones.length} licitación(es) exportadas`);
  }, [displayedLicitaciones]);

  const handleExportICS = useCallback(() => {
    if (displayedLicitaciones.length === 0) {
      toast.warning('No hay licitaciones para exportar');
      return;
    }
    const visits = displayedLicitaciones.filter(
      (lic) => lic.siteVisitDate && lic.siteVisitDate !== 'No disponible'
    );
    if (visits.length === 0) {
      toast.warning('No hay visitas para exportar al calendario');
      return;
    }
    exportToICalendar(displayedLicitaciones);
    toast.success(`${visits.length} visita(s) exportadas al calendario`);
  }, [displayedLicitaciones]);

  // Saved filter presets
  const handleSavePreset = useCallback(
    (name: string) => {
      const diff: Record<string, unknown> = {};
      for (const key of Object.keys(DEFAULT_FILTERS) as (keyof typeof DEFAULT_FILTERS)[]) {
        const current = filters[key];
        const def = DEFAULT_FILTERS[key];
        if (Array.isArray(current) && Array.isArray(def)) {
          if (current.length !== def.length || current.some((v, i) => v !== def[i])) {
            diff[key] = current;
          }
        } else if (current !== def) {
          diff[key] = current;
        }
      }
      const ok = savePreset(name, diff);
      if (ok) {
        toast.success(`Preset "${name}" guardado`);
      } else {
        toast.warning('Maximo de 10 presets alcanzado');
      }
    },
    [filters, savePreset]
  );

  const handleRecallPreset = useCallback(
    (presetFilters: Partial<typeof filters>) => {
      applyPreset(presetFilters);
    },
    [applyPreset]
  );

  // Open detail modal with full object from already-fetched list
  const openDetail = useCallback(
    (id: number) => {
      const found = displayedLicitaciones.find((l) => l.id === id) ?? null;
      setDetailModal({ open: true, lic: found });
    },
    [displayedLicitaciones]
  );

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSearch: () => searchInputRef.current?.focus(),
    onRefresh: refresh,
    onClearFilters: clearFilters,
    onExport: handleExportCSV,
    onToggleCalendar: () => setIsCalendarView((prev) => !prev),
    onVisitsThisWeek: () =>
      setQuickFilter({ type: 'visits', dateRange: 'visits-this-week', status: 'pending', sort: 'visit-date-asc' }),
    onClosingSoon: () =>
      setQuickFilter({ status: 'pending', dateRange: 'next-week', sort: 'close-date-asc' }),
    onPendingVisits: () =>
      setQuickFilter({ type: 'visits', status: 'pending', sort: 'visit-date-asc' }),
    onToggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    onCloseModal: () => {
      setApprovalModal({ open: false, action: null, id: null });
      setDetailModal({ open: false, lic: null });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">📋 Licitaciones Dashboard</h1>
          <div className="flex items-center gap-3">
            <StatsBar
              stats={stats}
              activeStatus={filters.status}
              onStatusClick={(status) => updateFilter('status', status)}
            />
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>

        {/* Filters */}
        <FilterBar
          filters={filters}
          filterOptions={filterOptions}
          viewMode={viewMode}
          isCalendarView={isCalendarView}
          onFilterChange={updateFilter}
          onClearFilters={clearFilters}
          onQuickFilter={setQuickFilter}
          onRefresh={refresh}
          onExportCSV={handleExportCSV}
          onExportICS={handleExportICS}
          onToggleCalendar={() => setIsCalendarView((prev) => !prev)}
          onSetViewMode={setViewMode}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          searchInputRef={searchInputRef}
          savedPresets={savedPresets}
          maxPresetsReached={maxPresetsReached}
          onRecallPreset={handleRecallPreset}
          onSavePreset={handleSavePreset}
          onDeletePreset={deletePreset}
          onRenamePreset={renamePreset}
        />

        {/* Bulk actions bar */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <span className="text-sm font-medium">{selectedCount} seleccionada(s)</span>
            <button
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
              onClick={handleBulkApprove}
            >
              ✓ Aprobar
            </button>
            <button
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
              onClick={handleBulkReject}
            >
              ✗ Rechazar
            </button>
            <button
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
              onClick={clearSelection}
            >
              Limpiar
            </button>
          </div>
        )}

        {/* Main content */}
        {isCalendarView ? (
          <CalendarView
            filters={buildQueryFilters()}
            onOpenDetail={openDetail}
          />
        ) : (
          <>
            {/* Loading skeleton */}
            {loading && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-lg border bg-card p-4 animate-pulse space-y-3">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                    <div className="flex gap-2 pt-2">
                      <div className="h-8 bg-muted rounded flex-1" />
                      <div className="h-8 bg-muted rounded flex-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && displayedLicitaciones.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mb-4 opacity-50">
                  <rect x="12" y="20" width="56" height="44" rx="4" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 30h56" stroke="currentColor" strokeWidth="2" />
                  <circle cx="20" cy="25" r="2" fill="currentColor" />
                  <circle cx="28" cy="25" r="2" fill="currentColor" />
                  <circle cx="36" cy="25" r="2" fill="currentColor" />
                  <rect x="22" y="38" width="36" height="3" rx="1.5" fill="currentColor" opacity="0.3" />
                  <rect x="22" y="46" width="24" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
                </svg>
                <p>
                  {filters.search
                    ? `No se encontraron resultados para "${filters.search}"`
                    : 'No hay licitaciones que coincidan con los filtros'}
                </p>
              </div>
            )}

            {/* Cards view */}
            {!loading && displayedLicitaciones.length > 0 && viewMode === 'cards' && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {displayedLicitaciones.map((lic) => (
                  <LicitacionCard
                    key={lic.id}
                    lic={lic}
                    isFavorite={isFavorite(lic.rowNumber)}
                    isSelected={isSelected(lic.rowNumber)}
                    onToggleFavorite={toggleFavorite}
                    onToggleSelection={toggleSelection}
                    onOpenDetail={openDetail}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onResetPending={handleResetPending}
                  />
                ))}
              </div>
            )}

            {/* List view */}
            {!loading && displayedLicitaciones.length > 0 && viewMode === 'list' && (
              <div className="space-y-1">
                {displayedLicitaciones.map((lic) => (
                  <LicitacionListItem
                    key={lic.id}
                    lic={lic}
                    isFavorite={isFavorite(lic.rowNumber)}
                    isSelected={isSelected(lic.rowNumber)}
                    onToggleFavorite={toggleFavorite}
                    onToggleSelection={toggleSelection}
                    onOpenDetail={openDetail}
                  />
                ))}
              </div>
            )}

            {/* Table view */}
            {!loading && displayedLicitaciones.length > 0 && viewMode === 'table' && (
              <LicitacionTable
                licitaciones={displayedLicitaciones}
                isFavorite={isFavorite}
                isSelected={isSelected}
                onToggleFavorite={toggleFavorite}
                onToggleSelection={toggleSelection}
                onSelectAll={selectAll}
                onOpenDetail={openDetail}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <ApprovalModal
        open={approvalModal.open}
        action={approvalModal.action}
        onClose={() => setApprovalModal({ open: false, action: null, id: null })}
        onConfirm={handleApprovalConfirm}
      />

      <DetailModal
        open={detailModal.open}
        licitacionId={detailModal.lic?.id ?? null}
        licitacion={detailModal.lic}
        onClose={() => setDetailModal({ open: false, lic: null })}
        onRefresh={refresh}
      />
    </div>
  );
}
