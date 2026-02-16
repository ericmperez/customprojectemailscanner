'use client';

import { cn, formatSiteVisitDate, computeWorthItScore } from '@/lib/utils';
import type { Licitacion } from '@/lib/types';

interface LicitacionTableProps {
  licitaciones: Licitacion[];
  isFavorite: (id: string) => boolean;
  isSelected: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  onToggleSelection: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onOpenDetail: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onToggleInterested: (id: string, interested: boolean) => void;
  currentSort?: string;
  onSort?: (sort: string) => void;
}

type SortableColumn = {
  label: string;
  ascKey: string;
  descKey: string;
  defaultDir: 'asc' | 'desc';
};

const SORTABLE_COLUMNS: Record<string, SortableColumn> = {
  title: { label: 'Titulo', ascKey: 'title-asc', descKey: 'title-desc', defaultDir: 'asc' },
  type: { label: 'Tipo', ascKey: 'type-asc', descKey: 'type-desc', defaultDir: 'asc' },
  score: { label: 'Punt.', ascKey: 'score-asc', descKey: 'score-desc', defaultDir: 'desc' },
  category: { label: 'Categoria', ascKey: 'category-asc', descKey: 'category-desc', defaultDir: 'asc' },
  emailDate: { label: 'Fecha', ascKey: 'email-date-asc', descKey: 'email-date-desc', defaultDir: 'desc' },
  closeDate: { label: 'Plazo', ascKey: 'close-date-asc', descKey: 'close-date-desc', defaultDir: 'asc' },
  contact: { label: 'Contacto', ascKey: 'contact-asc', descKey: 'contact-desc', defaultDir: 'asc' },
};

export function LicitacionTable({
  licitaciones,
  isFavorite,
  isSelected,
  onToggleFavorite,
  onToggleSelection,
  onSelectAll,
  onOpenDetail,
  onApprove,
  onReject,
  onToggleInterested,
  currentSort,
  onSort,
}: LicitacionTableProps) {
  const allSelected = licitaciones.length > 0 && licitaciones.every((l) => isSelected(l.id));

  const handleColumnSort = (colKey: string) => {
    if (!onSort) return;
    const col = SORTABLE_COLUMNS[colKey];
    if (!col) return;
    // If already sorting by this column, toggle direction; otherwise use default
    if (currentSort === col.ascKey) {
      onSort(col.descKey);
    } else if (currentSort === col.descKey) {
      onSort(col.ascKey);
    } else {
      onSort(col.defaultDir === 'asc' ? col.ascKey : col.descKey);
    }
  };

  const getSortIndicator = (colKey: string) => {
    const col = SORTABLE_COLUMNS[colKey];
    if (!col || !currentSort) return null;
    if (currentSort === col.ascKey) return ' ▲';
    if (currentSort === col.descKey) return ' ▼';
    return null;
  };

  const renderSortableHeader = (colKey: string, extraClass = '') => {
    const col = SORTABLE_COLUMNS[colKey];
    if (!col) return null;
    const isActive = currentSort === col.ascKey || currentSort === col.descKey;
    return (
      <th
        className={cn(
          'p-2 text-left select-none',
          onSort && 'cursor-pointer hover:bg-muted/80',
          isActive && 'text-foreground',
          extraClass
        )}
        onClick={() => handleColumnSort(colKey)}
      >
        {col.label}
        {getSortIndicator(colKey) && (
          <span className="text-xs ml-0.5">{getSortIndicator(colKey)}</span>
        )}
      </th>
    );
  };

  return (
    <div className="overflow-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="p-2 text-left w-8">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => {
                  if (allSelected) {
                    onSelectAll([]);
                  } else {
                    onSelectAll(licitaciones.map((l) => l.id));
                  }
                }}
                aria-label="Seleccionar todas"
              />
            </th>
            <th className="p-2 text-left w-8"></th>
            <th className="p-2 text-left w-8"></th>
            {renderSortableHeader('title')}
            {renderSortableHeader('type')}
            {renderSortableHeader('score')}
            {renderSortableHeader('category')}
            {renderSortableHeader('emailDate')}
            {renderSortableHeader('closeDate')}
            {renderSortableHeader('contact')}
            <th className="p-2 text-left w-16">Links</th>
            <th className="p-2 text-left w-20">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {licitaciones.map((lic) => {
            const visitLocation = (lic.visitLocation || '').toString().trim();
            const isVisit = visitLocation && visitLocation.toLowerCase() !== 'no disponible';
            const siteVisitDateDisplay = formatSiteVisitDate(lic.siteVisitDate);
            const emailDate = formatSiteVisitDate(lic.emailDate) || 'Sin fecha';
            const score = computeWorthItScore(lic);

            let windowDays: number | null = null;
            if (lic.emailDate && lic.biddingCloseDate && lic.biddingCloseDate !== 'No disponible') {
              const email = new Date(lic.emailDate);
              const close = new Date(lic.biddingCloseDate);
              if (!Number.isNaN(email.getTime()) && !Number.isNaN(close.getTime())) {
                windowDays = Math.ceil((close.getTime() - email.getTime()) / (1000 * 60 * 60 * 24));
              }
            }

            return (
              <tr
                key={lic.id}
                className={cn(
                  'border-t cursor-pointer transition-colors',
                  lic.isEmergency
                    ? 'bg-red-100 hover:bg-red-200 border-l-4 border-l-red-600'
                    : lic.approvalStatus === 'approved'
                      ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60'
                      : windowDays !== null && windowDays <= 2
                        ? 'bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/60'
                        : 'hover:bg-muted/50'
                )}
                onClick={() => onOpenDetail(lic.id)}
              >
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected(lic.id)}
                    onChange={() => onToggleSelection(lic.id)}
                    aria-label="Seleccionar licitación"
                  />
                </td>
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="hover:scale-110 transition-transform"
                    onClick={() => onToggleFavorite(lic.id)}
                    aria-label={isFavorite(lic.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  >
                    {isFavorite(lic.id) ? '⭐' : '☆'}
                  </button>
                </td>
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="hover:scale-110 transition-transform"
                    onClick={() => onToggleInterested(lic.id, !lic.interested)}
                    title={lic.interested ? 'Quitar interés' : 'Marcar interesada'}
                    aria-label={lic.interested ? 'Quitar interés' : 'Marcar interesada'}
                  >
                    {lic.interested ? '❤️' : '🤍'}
                  </button>
                </td>
                <td className="p-2 max-w-[300px]">
                  <div className="font-medium truncate">
                    {lic.isEmergency && '🚨 '}{lic.title || lic.subject || 'Sin titulo'}
                  </div>
                  {lic.summary && lic.summary !== 'No disponible' && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {lic.summary}
                    </div>
                  )}
                  {isVisit && lic.location && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                      📍 {lic.location}
                    </div>
                  )}
                </td>
                <td className="p-2 whitespace-nowrap">
                  {isVisit ? '🏗️ Visita' : '🛒 Compra'}
                </td>
                <td className="p-2">
                  <span className={cn(
                    'font-bold text-sm',
                    score >= 7 ? 'text-emerald-600 dark:text-emerald-400' : score >= 4 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'
                  )}>
                    {score}
                  </span>
                </td>
                <td className="p-2">{lic.category || '-'}</td>
                <td className="p-2 whitespace-nowrap">
                  {emailDate}
                  {isVisit && siteVisitDateDisplay !== 'No disponible' && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      🗓️ {siteVisitDateDisplay}
                    </div>
                  )}
                </td>
                <td className="p-2 whitespace-nowrap">
                  {windowDays !== null ? (
                    <span className={cn(
                      'text-xs font-medium',
                      windowDays <= 7 ? 'text-red-600 dark:text-red-400' :
                      windowDays <= 14 ? 'text-amber-600 dark:text-amber-400' :
                      'text-muted-foreground'
                    )}>
                      {windowDays <= 2 && '🚨 '}{windowDays}d
                    </span>
                  ) : '-'}
                </td>
                <td className="p-2">{lic.contactName || '-'}</td>
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1.5">
                    {(lic.pdfUrl || lic.pdfLink) && (
                      <a
                        href={lic.pdfUrl || lic.pdfLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline text-xs"
                        title="Abrir PDF"
                      >
                        📄
                      </a>
                    )}
                    {lic.quoteUrl && (
                      <a
                        href={lic.quoteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline text-xs"
                        title="Entrar cotizacion"
                      >
                        🔗
                      </a>
                    )}
                  </div>
                </td>
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <button
                      className="hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded p-1"
                      onClick={() => onApprove(lic.id)}
                      title="Aprobar"
                      aria-label="Aprobar licitación"
                    >
                      ✓
                    </button>
                    <button
                      className="hover:bg-red-100 dark:hover:bg-red-900 rounded p-1"
                      onClick={() => onReject(lic.id)}
                      title="Rechazar"
                      aria-label="Rechazar licitación"
                    >
                      ✗
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
