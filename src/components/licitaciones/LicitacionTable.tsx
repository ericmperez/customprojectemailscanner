'use client';

import { cn, formatSiteVisitDate, badgeText, computeWorthItScore } from '@/lib/utils';
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
              />
            </th>
            <th className="p-2 text-left w-8"></th>
            <th className="p-2 text-left">Titulo</th>
            <th className="p-2 text-left">Tipo</th>
            <th className="p-2 text-left">Prioridad</th>
            <th className="p-2 text-left">Punt.</th>
            <th className="p-2 text-left">Categoria</th>
            <th className="p-2 text-left">Fecha</th>
            <th className="p-2 text-left">Valor Est.</th>
            <th className="p-2 text-left">Contacto</th>
            <th className="p-2 text-left">Estado</th>
            <th className="p-2 text-left w-20">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {licitaciones.map((lic) => {
            const visitLocation = (lic.visitLocation || '').toString().trim();
            const isVisit = visitLocation && visitLocation.toLowerCase() !== 'no disponible';
            const siteVisitDateDisplay = formatSiteVisitDate(lic.siteVisitDate);
            const emailDate = formatSiteVisitDate(lic.emailDate) || 'Sin fecha';
            const priorityLower = (lic.priority || '').toLowerCase();
            const priorityLabel = priorityLower === 'high' ? 'Alta' : priorityLower === 'medium' ? 'Media' : priorityLower === 'low' ? 'Baja' : '-';
            const score = computeWorthItScore(lic);

            return (
              <tr
                key={lic.id}
                className="border-t hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onOpenDetail(lic.id)}
              >
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected(lic.rowNumber)}
                    onChange={() => onToggleSelection(lic.rowNumber)}
                  />
                </td>
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="hover:scale-110 transition-transform"
                    onClick={() => onToggleFavorite(lic.rowNumber)}
                  >
                    {isFavorite(lic.rowNumber) ? '⭐' : '☆'}
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
                    'text-xs font-medium px-1.5 py-0.5 rounded-full',
                    priorityLower === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                    priorityLower === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                    priorityLower === 'low' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : ''
                  )}>
                    {priorityLabel}
                  </span>
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
                  {isVisit && siteVisitDateDisplay !== 'No disponible' ? siteVisitDateDisplay : emailDate}
                </td>
                <td className="p-2 text-emerald-600 dark:text-emerald-400 text-xs">
                  {lic.estimatedValue && lic.estimatedValue !== 'No disponible' ? lic.estimatedValue : '-'}
                </td>
                <td className="p-2">{lic.contactName || '-'}</td>
                <td className="p-2">{badgeText(lic.approvalStatus)}</td>
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <button
                      className="hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded p-1"
                      onClick={() => onApprove(lic.rowNumber)}
                      title="Aprobar"
                    >
                      ✓
                    </button>
                    <button
                      className="hover:bg-red-100 dark:hover:bg-red-900 rounded p-1"
                      onClick={() => onReject(lic.rowNumber)}
                      title="Rechazar"
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
