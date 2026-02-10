'use client';

import { cn, formatSiteVisitDate } from '@/lib/utils';
import type { Licitacion } from '@/lib/types';

interface LicitacionListItemProps {
  lic: Licitacion;
  isFavorite: boolean;
  isSelected: boolean;
  onToggleFavorite: (id: number) => void;
  onToggleSelection: (rowNumber: number) => void;
  onOpenDetail: (id: number) => void;
}

export function LicitacionListItem({
  lic,
  isFavorite,
  isSelected,
  onToggleFavorite,
  onToggleSelection,
  onOpenDetail,
}: LicitacionListItemProps) {
  const visitLocation = (lic.visitLocation || '').toString().trim();
  const isVisit = visitLocation && visitLocation.toLowerCase() !== 'no disponible';
  const siteVisitDateDisplay = formatSiteVisitDate(lic.siteVisitDate);
  const emailDate = formatSiteVisitDate(lic.emailDate) || 'Sin fecha';

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md border bg-card px-3 py-2 hover:bg-muted/50 transition-colors',
        isSelected && 'ring-2 ring-primary'
      )}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggleSelection(lic.rowNumber)}
        onClick={(e) => e.stopPropagation()}
      />
      <button
        className="text-base hover:scale-110 transition-transform shrink-0"
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(lic.rowNumber); }}
      >
        {isFavorite ? '⭐' : '☆'}
      </button>
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onOpenDetail(lic.id)}
      >
        <div className="flex items-center gap-2">
          <span>{isVisit ? '🏗️' : '🛒'}</span>
          <span className="font-medium text-sm truncate">
            {lic.title || lic.subject || 'Sin titulo'}
          </span>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
          <span>
            📅 {isVisit && siteVisitDateDisplay !== 'No disponible' ? siteVisitDateDisplay : emailDate}
          </span>
          {lic.category && <span>📂 {lic.category}</span>}
          {lic.contactName && <span>👤 {lic.contactName}</span>}
        </div>
      </div>
    </div>
  );
}
