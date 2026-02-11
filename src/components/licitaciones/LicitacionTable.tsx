'use client';

import { cn, formatSiteVisitDate, computeWorthItScore } from '@/lib/utils';
import type { Licitacion } from '@/lib/types';

interface LicitacionTableProps {
  licitaciones: Licitacion[];
  isFavorite: (id: number) => boolean;
  isSelected: (rowNumber: number) => boolean;
  onToggleFavorite: (id: number) => void;
  onToggleSelection: (rowNumber: number) => void;
  onSelectAll: (rowNumbers: number[]) => void;
  onOpenDetail: (id: number) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onToggleInterested: (id: number, interested: boolean) => void;
}

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
}: LicitacionTableProps) {
  const allSelected = licitaciones.length > 0 && licitaciones.every((l) => isSelected(l.rowNumber));

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
                    onSelectAll(licitaciones.map((l) => l.rowNumber));
                  }
                }}
                aria-label="Seleccionar todas"
              />
            </th>
            <th className="p-2 text-left w-8"></th>
            <th className="p-2 text-left w-8"></th>
            <th className="p-2 text-left">Titulo</th>
            <th className="p-2 text-left">Tipo</th>
            <th className="p-2 text-left">Punt.</th>
            <th className="p-2 text-left">Categoria</th>
            <th className="p-2 text-left">Fecha</th>
            <th className="p-2 text-left">Plazo</th>
            <th className="p-2 text-left">Contacto</th>
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
                  lic.approvalStatus === 'approved'
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
                    checked={isSelected(lic.rowNumber)}
                    onChange={() => onToggleSelection(lic.rowNumber)}
                    aria-label="Seleccionar licitación"
                  />
                </td>
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="hover:scale-110 transition-transform"
                    onClick={() => onToggleFavorite(lic.rowNumber)}
                    aria-label={isFavorite(lic.rowNumber) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  >
                    {isFavorite(lic.rowNumber) ? '⭐' : '☆'}
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
                    {lic.title || lic.subject || 'Sin titulo'}
                  </div>
                  {lic.summary && lic.summary !== 'No disponible' && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {lic.summary}
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
                  <div className="flex gap-1">
                    <button
                      className="hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded p-1"
                      onClick={() => onApprove(lic.rowNumber)}
                      title="Aprobar"
                      aria-label="Aprobar licitación"
                    >
                      ✓
                    </button>
                    <button
                      className="hover:bg-red-100 dark:hover:bg-red-900 rounded p-1"
                      onClick={() => onReject(lic.rowNumber)}
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
