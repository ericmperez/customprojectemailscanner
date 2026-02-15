'use client';

import { cn, formatSiteVisitDate, computeWorthItScore } from '@/lib/utils';
import type { Licitacion } from '@/lib/types';

interface LicitacionListItemProps {
  lic: Licitacion;
  isFavorite: boolean;
  isSelected: boolean;
  onToggleFavorite: (id: number) => void;
  onToggleSelection: (rowNumber: number) => void;
  onOpenDetail: (id: number) => void;
  onToggleInterested: (id: number, interested: boolean) => void;
}

export function LicitacionListItem({
  lic,
  isFavorite,
  isSelected,
  onToggleFavorite,
  onToggleSelection,
  onOpenDetail,
  onToggleInterested,
}: LicitacionListItemProps) {
  const visitLocation = (lic.visitLocation || '').toString().trim();
  const isVisit = visitLocation && visitLocation.toLowerCase() !== 'no disponible';
  const siteVisitDateDisplay = formatSiteVisitDate(lic.siteVisitDate);
  const emailDate = formatSiteVisitDate(lic.emailDate) || 'Sin fecha';
  const priorityLower = (lic.priority || '').toLowerCase();
  const priorityLabel = priorityLower === 'high' ? 'Alta' : priorityLower === 'medium' ? 'Media' : priorityLower === 'low' ? 'Baja' : '';
  const score = computeWorthItScore(lic);

  return (
    <div
      className={cn(
        'flex items-center gap-2 sm:gap-3 rounded-md border bg-card px-2 py-2.5 sm:px-3 sm:py-2 hover:bg-muted/50 transition-colors active:bg-muted/70',
        lic.isEmergency
          ? 'border-2 border-red-600 bg-red-50'
          : (lic.approvalStatus || 'pending') === 'approved' && 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60',
        isSelected && 'ring-2 ring-primary'
      )}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggleSelection(lic.rowNumber)}
        onClick={(e) => e.stopPropagation()}
        aria-label="Seleccionar licitación"
      />
      <button
        className="text-base hover:scale-110 transition-transform shrink-0"
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(lic.rowNumber); }}
        aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      >
        {isFavorite ? '⭐' : '☆'}
      </button>
      <button
        className="text-base hover:scale-110 transition-transform shrink-0"
        onClick={(e) => { e.stopPropagation(); onToggleInterested(lic.id, !lic.interested); }}
        title={lic.interested ? 'Quitar interés' : 'Marcar interesada'}
        aria-label={lic.interested ? 'Quitar interés' : 'Marcar interesada'}
      >
        {lic.interested ? '❤️' : '🤍'}
      </button>
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onOpenDetail(lic.id)}
      >
        <div className="flex items-center gap-2">
          <span>{lic.isEmergency && '🚨'}{isVisit ? '🏗️' : '🛒'}</span>
          <span className="font-medium text-sm truncate">
            {lic.title || lic.subject || 'Sin titulo'}
          </span>
        </div>
        {lic.summary && lic.summary !== 'No disponible' && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{lic.summary}</p>
        )}
        <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap items-center">
          {lic.isEmergency && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white font-bold text-xs">
              EMERGENCIA
            </span>
          )}
          <span>
            📅 {isVisit && siteVisitDateDisplay !== 'No disponible' ? siteVisitDateDisplay : emailDate}
          </span>
          {lic.category && <span>📂 {lic.category}</span>}
          {priorityLabel && (
            <span className={cn(
              'px-1.5 py-0.5 rounded-full text-xs font-medium',
              priorityLower === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
              priorityLower === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
              'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
            )}>
              {priorityLabel}
            </span>
          )}
          <span className={cn(
            'font-bold text-xs',
            score >= 7 ? 'text-emerald-600 dark:text-emerald-400' : score >= 4 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'
          )} title={`Puntuacion: ${score}/10`}>
            {score}/10
          </span>
          {lic.contactName && <span>👤 {lic.contactName}</span>}
          {lic.estimatedValue && lic.estimatedValue !== 'No disponible' && (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">💰 {lic.estimatedValue}</span>
          )}
        </div>
      </div>
    </div>
  );
}
