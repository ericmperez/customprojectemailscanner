'use client';

import { useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { FilterOptions } from '@/lib/types';
import type { FilterState } from '@/hooks/useFilters';
import type { ViewMode } from '@/hooks/useViewMode';
import type { SavedFilterPreset } from '@/hooks/useSavedFilters';
import { SavedFiltersSection } from './SavedFiltersSection';

interface FilterBarProps {
  filters: FilterState;
  filterOptions: FilterOptions;
  viewMode: ViewMode;
  isCalendarView: boolean;
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onClearFilters: () => void;
  onQuickFilter: (overrides: Partial<FilterState>) => void;
  onRefresh: () => void;
  onExportCSV: () => void;
  onExportICS: () => void;
  onToggleCalendar: () => void;
  onSetViewMode: (mode: ViewMode) => void;
  onToggleTheme: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  savedPresets: SavedFilterPreset[];
  maxPresetsReached: boolean;
  onRecallPreset: (filters: Partial<FilterState>) => void;
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: string) => void;
  onRenamePreset: (id: string, newName: string) => void;
  onOpenSettings: () => void;
  onOpenNovedades: () => void;
  hasNewVersion?: boolean;
}

export function FilterBar({
  filters,
  filterOptions,
  viewMode,
  isCalendarView,
  onFilterChange,
  onClearFilters,
  onQuickFilter,
  onRefresh,
  onExportCSV,
  onExportICS,
  onToggleCalendar,
  onSetViewMode,
  onToggleTheme,
  searchInputRef,
  savedPresets,
  maxPresetsReached,
  onRecallPreset,
  onSavePreset,
  onDeletePreset,
  onRenamePreset,
  onOpenSettings,
  onOpenNovedades,
  hasNewVersion,
}: FilterBarProps) {
  const [townDropdownOpen, setTownDropdownOpen] = useState(false);
  const [townSearch, setTownSearch] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredTowns = filterOptions.towns.filter((t) =>
    t.toLowerCase().includes(townSearch.toLowerCase())
  );

  const townLabel =
    filters.town.length === 0
      ? 'Todos los pueblos'
      : filters.town.length === 1
        ? filters.town[0]
        : `${filters.town.length} pueblos`;

  // Count active filters (excluding search and sort)
  const activeFilterCount = [
    filters.status,
    filters.category,
    filters.type,
    filters.priority,
    filters.dateRange,
  ].filter(Boolean).length + (filters.town.length > 0 ? 1 : 0);

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3 sm:p-4">
      {/* Top row: Search + Sort + mobile toggles */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <label className="sr-only" htmlFor="search-licitaciones">Buscar licitaciones</label>
          <Input
            id="search-licitaciones"
            ref={searchInputRef}
            placeholder="Buscar..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="w-full"
          />
        </div>

        <select
          className="rounded-md border bg-background px-2 py-2 text-sm min-w-0 max-w-[140px] sm:max-w-none sm:px-3"
          value={filters.sort}
          onChange={(e) => onFilterChange('sort', e.target.value)}
          aria-label="Ordenar por"
        >
          <option value="">Ordenar</option>
          <option value="visit-date-asc">Visita +cercana</option>
          <option value="close-date-asc">Cierre +cercano</option>
          <option value="email-date-desc">Mas reciente</option>
          <option value="email-date-asc">Mas antigua</option>
          <option value="title-asc">A-Z</option>
          <option value="title-desc">Z-A</option>
          <option value="score-desc">Puntuacion</option>
        </select>

        {/* Mobile: Filter toggle button */}
        <button
          className="sm:hidden rounded-md border bg-background px-3 py-2 text-sm font-medium flex items-center gap-1.5"
          onClick={() => setFiltersExpanded(!filtersExpanded)}
        >
          Filtros
          {activeFilterCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs rounded-full px-1.5 min-w-[20px] text-center">
              {activeFilterCount}
            </span>
          )}
          <span className="text-xs">{filtersExpanded ? '▲' : '▼'}</span>
        </button>

        {/* Mobile: Actions toggle */}
        <button
          className="sm:hidden rounded-md border bg-background px-3 py-2 text-sm"
          onClick={() => setActionsExpanded(!actionsExpanded)}
        >
          ⋯
        </button>
      </div>

      {/* Filter selects - always visible on desktop, collapsible on mobile */}
      <div className={`${filtersExpanded ? 'flex' : 'hidden'} sm:flex gap-2 flex-wrap items-center`}>
        <select
          className="rounded-md border bg-background px-2 py-2 text-sm flex-1 min-w-[120px] sm:flex-none sm:px-3"
          value={filters.status}
          onChange={(e) => onFilterChange('status', e.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos</option>
          <option value="pending">Pendientes</option>
          <option value="approved">Aprobadas</option>
          <option value="rejected">Rechazadas</option>
        </select>

        <select
          className="rounded-md border bg-background px-2 py-2 text-sm flex-1 min-w-[120px] sm:flex-none sm:px-3"
          value={filters.category}
          onChange={(e) => onFilterChange('category', e.target.value)}
          aria-label="Filtrar por categoría"
        >
          <option value="">Categorias</option>
          {filterOptions.categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* Town multi-select dropdown */}
        <div className="relative flex-1 min-w-[120px] sm:flex-none" ref={dropdownRef}>
          <button
            type="button"
            className="rounded-md border bg-background px-2 py-2 text-sm flex items-center gap-2 w-full sm:w-auto sm:min-w-[160px] sm:px-3"
            onClick={() => setTownDropdownOpen(!townDropdownOpen)}
            aria-label="Filtrar por pueblo"
          >
            <span className="truncate">{townLabel}</span>
            <span className="text-xs ml-auto">{townDropdownOpen ? '▲' : '▼'}</span>
          </button>
          {townDropdownOpen && (
            <div className="absolute z-50 mt-1 w-full sm:w-64 rounded-md border bg-card shadow-lg p-2 max-h-60 overflow-auto">
              <Input
                placeholder="Buscar pueblo..."
                value={townSearch}
                onChange={(e) => setTownSearch(e.target.value)}
                className="mb-2"
              />
              {filteredTowns.map((town) => (
                <label
                  key={town}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={filters.town.includes(town)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...filters.town, town]
                        : filters.town.filter((t) => t !== town);
                      onFilterChange('town', next);
                    }}
                  />
                  {town}
                </label>
              ))}
              <div className="flex justify-between mt-2 pt-2 border-t">
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => onFilterChange('town', filterOptions.towns)}
                >
                  Seleccionar todos
                </button>
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => onFilterChange('town', [])}
                >
                  Limpiar
                </button>
              </div>
            </div>
          )}
        </div>

        <select
          className="rounded-md border bg-background px-2 py-2 text-sm flex-1 min-w-[120px] sm:flex-none sm:px-3"
          value={filters.type}
          onChange={(e) => onFilterChange('type', e.target.value)}
          aria-label="Filtrar por tipo"
        >
          <option value="">Tipo</option>
          <option value="visits">Visitas</option>
          <option value="purchases">Compras</option>
        </select>

        <select
          className="rounded-md border bg-background px-2 py-2 text-sm flex-1 min-w-[120px] sm:flex-none sm:px-3"
          value={filters.priority}
          onChange={(e) => onFilterChange('priority', e.target.value)}
          aria-label="Filtrar por prioridad"
        >
          <option value="">Prioridad</option>
          <option value="High">Alta</option>
          <option value="Medium">Media</option>
          <option value="Low">Baja</option>
        </select>

        <select
          className="rounded-md border bg-background px-2 py-2 text-sm flex-1 min-w-[120px] sm:flex-none sm:px-3"
          value={filters.dateRange}
          onChange={(e) => onFilterChange('dateRange', e.target.value)}
          aria-label="Filtrar por fecha"
        >
          <option value="">Fechas</option>
          <option value="next-week">Proxima semana</option>
          <option value="next-2-weeks">Proximas 2 semanas</option>
          <option value="next-month">Proximo mes</option>
          <option value="this-week">Esta semana</option>
          <option value="today">Hoy</option>
          <option value="past">Pasadas</option>
        </select>
      </div>

      {/* Quick filters - scrollable on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 sm:overflow-visible sm:flex-wrap items-center">
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() =>
            onQuickFilter({ type: 'visits', dateRange: 'visits-this-week', status: 'pending', sort: 'visit-date-asc' })
          }
        >
          Visitas esta semana
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => onQuickFilter({ status: 'pending', dateRange: 'next-week', sort: 'close-date-asc' })}
        >
          Cierre pronto
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => onQuickFilter({ type: 'visits', status: 'pending', sort: 'visit-date-asc' })}
        >
          Visitas pendientes
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => onQuickFilter({ interested: 'true', status: '' })}
        >
          Interesadas
        </Button>

        <SavedFiltersSection
          presets={savedPresets}
          maxReached={maxPresetsReached}
          onRecallPreset={onRecallPreset}
          onSavePreset={onSavePreset}
          onDeletePreset={onDeletePreset}
          onRenamePreset={onRenamePreset}
        />
      </div>

      {/* Action buttons - always visible on desktop, collapsible on mobile */}
      <div className={`${actionsExpanded ? 'flex' : 'hidden'} sm:flex gap-2 flex-wrap items-center`}>
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          Limpiar Filtros
        </Button>
        <Button variant="outline" size="sm" onClick={onExportCSV}>
          CSV
        </Button>
        <Button variant="outline" size="sm" onClick={onExportICS}>
          .ics
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleCalendar}
        >
          {isCalendarView ? 'Tarjetas' : 'Calendario'}
        </Button>

        {/* View mode toggle */}
        <div className="flex rounded-md border">
          {(['cards', 'list', 'table'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              className={`px-2.5 py-1.5 text-sm ${viewMode === mode ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              onClick={() => onSetViewMode(mode)}
              title={`Vista de ${mode === 'cards' ? 'tarjetas' : mode === 'list' ? 'lista' : 'tabla'}`}
              aria-label={`Vista de ${mode === 'cards' ? 'tarjetas' : mode === 'list' ? 'lista' : 'tabla'}`}
            >
              {mode === 'cards' ? '⊞' : mode === 'list' ? '☰' : '⊟'}
            </button>
          ))}
        </div>

        <Button variant="default" size="sm" onClick={onRefresh}>
          Refrescar
        </Button>

        <button
          className="rounded-md border bg-background p-2 hover:bg-muted transition-colors"
          onClick={onOpenSettings}
          title="Configuracion de confianza"
          aria-label="Configuracion de confianza"
        >
          <Settings className="h-4 w-4" />
        </button>

        <button
          className="relative text-lg px-1 hover:opacity-70 transition-opacity"
          onClick={onOpenNovedades}
          title="Novedades"
          aria-label="Ver novedades"
        >
          🆕
          {hasNewVersion && (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500" />
          )}
        </button>

        <button
          className="text-lg px-1 hover:opacity-70 transition-opacity"
          onClick={onToggleTheme}
          title="Cambiar tema"
          aria-label="Cambiar tema claro/oscuro"
        >
          🌓
        </button>
      </div>
    </div>
  );
}
