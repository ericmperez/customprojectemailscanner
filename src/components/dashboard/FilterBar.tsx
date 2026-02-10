'use client';

import { useRef, useState } from 'react';
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
}: FilterBarProps) {
  const [townDropdownOpen, setTownDropdownOpen] = useState(false);
  const [townSearch, setTownSearch] = useState('');
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

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      {/* Search */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Input
            ref={searchInputRef}
            placeholder="Buscar por titulo, ubicacion, descripcion, PDF, contacto..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
          />
        </div>

        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={filters.sort}
          onChange={(e) => onFilterChange('sort', e.target.value)}
        >
          <option value="">Sin ordenar</option>
          <option value="visit-date-asc">Visita mas cercana</option>
          <option value="close-date-asc">Cierre mas cercano</option>
          <option value="email-date-desc">Mas reciente</option>
          <option value="email-date-asc">Mas antigua</option>
          <option value="title-asc">A-Z (Titulo)</option>
          <option value="title-desc">Z-A (Titulo)</option>
          <option value="score-desc">Mayor puntuacion</option>
        </select>
      </div>

      {/* Filter selects */}
      <div className="flex gap-2 flex-wrap items-center">
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={filters.status}
          onChange={(e) => onFilterChange('status', e.target.value)}
        >
          <option value="">Todos</option>
          <option value="pending">Pendientes</option>
          <option value="approved">Aprobadas</option>
          <option value="rejected">Rechazadas</option>
        </select>

        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={filters.category}
          onChange={(e) => onFilterChange('category', e.target.value)}
        >
          <option value="">Todas las categorias</option>
          {filterOptions.categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* Town multi-select dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            className="rounded-md border bg-background px-3 py-2 text-sm flex items-center gap-2 min-w-[160px]"
            onClick={() => setTownDropdownOpen(!townDropdownOpen)}
          >
            <span className="truncate">{townLabel}</span>
            <span className="text-xs">{townDropdownOpen ? '▲' : '▼'}</span>
          </button>
          {townDropdownOpen && (
            <div className="absolute z-50 mt-1 w-64 rounded-md border bg-card shadow-lg p-2 max-h-60 overflow-auto">
              <Input
                placeholder="Buscar pueblo..."
                value={townSearch}
                onChange={(e) => setTownSearch(e.target.value)}
                className="mb-2"
              />
              {filteredTowns.map((town) => (
                <label
                  key={town}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded text-sm cursor-pointer"
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
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={filters.type}
          onChange={(e) => onFilterChange('type', e.target.value)}
        >
          <option value="">Todos los tipos</option>
          <option value="visits">Visitas</option>
          <option value="purchases">Compras</option>
        </select>

        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={filters.priority}
          onChange={(e) => onFilterChange('priority', e.target.value)}
        >
          <option value="">Todas las prioridades</option>
          <option value="High">Alta</option>
          <option value="Medium">Media</option>
          <option value="Low">Baja</option>
        </select>

        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={filters.dateRange}
          onChange={(e) => onFilterChange('dateRange', e.target.value)}
        >
          <option value="">Todas las fechas</option>
          <option value="next-week">Proxima semana</option>
          <option value="next-2-weeks">Proximas 2 semanas</option>
          <option value="next-month">Proximo mes</option>
          <option value="this-week">Esta semana</option>
          <option value="today">Hoy</option>
          <option value="past">Pasadas</option>
        </select>
      </div>

      {/* Quick filters + actions */}
      <div className="flex gap-2 flex-wrap items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onQuickFilter({ type: 'visits', dateRange: 'visits-this-week', status: 'pending', sort: 'visit-date-asc' })
          }
        >
          Visitas esta semana
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onQuickFilter({ status: 'pending', dateRange: 'next-week', sort: 'close-date-asc' })}
        >
          Cierre pronto
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onQuickFilter({ type: 'visits', status: 'pending', sort: 'visit-date-asc' })}
        >
          Visitas pendientes
        </Button>
        <Button
          variant="outline"
          size="sm"
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

        <div className="ml-auto flex gap-2 flex-wrap items-center">
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Limpiar Filtros
          </Button>
          <Button variant="outline" size="sm" onClick={onExportCSV}>
            Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={onExportICS}>
            Exportar .ics
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleCalendar}
          >
            {isCalendarView ? 'Ver Tarjetas' : 'Ver Calendario'}
          </Button>

          {/* View mode toggle */}
          <div className="flex rounded-md border">
            {(['cards', 'list', 'table'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                className={`px-2 py-1 text-sm ${viewMode === mode ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                onClick={() => onSetViewMode(mode)}
                title={`Vista de ${mode === 'cards' ? 'tarjetas' : mode === 'list' ? 'lista' : 'tabla'}`}
              >
                {mode === 'cards' ? '⊞' : mode === 'list' ? '☰' : '⊟'}
              </button>
            ))}
          </div>

          <Button variant="default" size="sm" onClick={onRefresh}>
            Refrescar
          </Button>

          <button
            className="text-lg px-1 hover:opacity-70 transition-opacity"
            onClick={onToggleTheme}
            title="Cambiar tema"
          >
            🌓
          </button>
        </div>
      </div>
    </div>
  );
}
