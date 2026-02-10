'use client';

import { cn, truncate, formatSiteVisitDate, formatTimeLabel, resolvePdfUrl, badgeText, parseConfidence, computeWorthItScore } from '@/lib/utils';
import type { Licitacion } from '@/lib/types';

interface LicitacionCardProps {
  lic: Licitacion;
  isFavorite: boolean;
  isSelected: boolean;
  onToggleFavorite: (id: number) => void;
  onToggleSelection: (rowNumber: number) => void;
  onOpenDetail: (id: number) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onResetPending: (id: number) => void;
  onToggleInterested: (id: number, interested: boolean) => void;
  onQuickDismiss: (id: number) => void;
}

function computeUrgency(lic: Licitacion) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const visitLocation = (lic.visitLocation || '').toString().trim();
  const isVisit = visitLocation && visitLocation.toLowerCase() !== 'no disponible';

  if (isVisit) {
    let deadlineDate: Date | null = null;
    let deadlineLabel = 'Visita';

    if (lic.siteVisitDate && lic.siteVisitDate !== 'No disponible') {
      const vd = new Date(lic.siteVisitDate);
      if (!Number.isNaN(vd.getTime())) deadlineDate = vd;
    }
    if (lic.biddingCloseDate && lic.biddingCloseDate !== 'No disponible') {
      const cd = new Date(lic.biddingCloseDate);
      if (!Number.isNaN(cd.getTime()) && (!deadlineDate || cd < deadlineDate)) {
        deadlineDate = cd;
        deadlineLabel = 'Cierra';
      }
    }

    if (deadlineDate) {
      const daysRemaining = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      let turnaroundDays = Infinity;
      if (lic.emailDate) {
        const emailDate = new Date(lic.emailDate);
        if (!Number.isNaN(emailDate.getTime())) {
          turnaroundDays = Math.ceil((deadlineDate.getTime() - emailDate.getTime()) / (1000 * 60 * 60 * 24));
        }
      }
      const isTight = turnaroundDays <= 7;

      if (daysRemaining >= 0) {
        const dayLabel = daysRemaining === 1 ? 'dia' : 'dias';
        if (daysRemaining <= 3 || (isTight && daysRemaining <= 5)) {
          return { level: 'critical' as const, text: `${deadlineLabel} en ${daysRemaining} ${dayLabel}` };
        }
        if (daysRemaining <= 7 || (isTight && daysRemaining <= 10)) {
          return { level: 'high' as const, text: `${deadlineLabel} en ${daysRemaining} ${dayLabel}` };
        }
        if (daysRemaining <= 10) {
          return { level: 'high' as const, text: `${deadlineLabel} en ${daysRemaining} dias` };
        }
      }
    }
  } else {
    if (lic.biddingCloseDate && lic.biddingCloseDate !== 'No disponible') {
      const closeDate = new Date(lic.biddingCloseDate);
      if (!Number.isNaN(closeDate.getTime())) {
        const diffDays = Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 3) {
          const dayLabel = diffDays === 1 ? 'dia' : 'dias';
          return { level: 'critical' as const, text: `Cierra en ${diffDays} ${dayLabel}` };
        }
        if (diffDays >= 4 && diffDays <= 7) {
          return { level: 'high' as const, text: `Cierra en ${diffDays} dias` };
        }
      }
    }
  }

  return null;
}

export function LicitacionCard({
  lic,
  isFavorite,
  isSelected,
  onToggleFavorite,
  onToggleSelection,
  onOpenDetail,
  onApprove,
  onReject,
  onResetPending,
  onToggleInterested,
  onQuickDismiss,
}: LicitacionCardProps) {
  const status = (lic.approvalStatus || 'pending').toLowerCase();
  const visitLocation = (lic.visitLocation || '').toString().trim();
  const isVisit = visitLocation && visitLocation.toLowerCase() !== 'no disponible';

  const siteVisitDateDisplay = formatSiteVisitDate(lic.siteVisitDate);
  const siteVisitTimeDisplay = formatTimeLabel(lic.siteVisitTime);
  const emailDate = lic.emailDate ? new Date(lic.emailDate).toLocaleDateString('es-PR') : 'N/A';
  const pdfLink = lic.pdfUrl || resolvePdfUrl(lic.pdfLink);
  const urgency = computeUrgency(lic);
  const confidence = parseConfidence(lic.extractionMethod);
  const worthItScore = computeWorthItScore(lic);
  const priorityLower = (lic.priority || '').toLowerCase();

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 transition-all hover:shadow-md cursor-pointer relative',
        status === 'approved' && 'border-l-4 border-l-emerald-500',
        status === 'rejected' && 'border-l-4 border-l-red-500',
        status === 'pending' && 'border-l-4 border-l-amber-500',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onOpenDetail(lic.id)}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        className="absolute top-3 left-3 z-10"
        checked={isSelected}
        onChange={(e) => { e.stopPropagation(); onToggleSelection(lic.rowNumber); }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Header */}
      <div className="flex justify-between items-start gap-2 mb-2 ml-6">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2">
          {lic.title || lic.subject || 'Sin titulo'}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {/* Worth It score */}
          <span
            className={cn(
              'text-xs font-bold px-1.5 py-0.5 rounded whitespace-nowrap',
              worthItScore >= 7 ? 'text-emerald-700 dark:text-emerald-300' : worthItScore >= 4 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-500'
            )}
            title={`Puntuacion: ${worthItScore}/10`}
          >
            {worthItScore}/10
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(lic.rowNumber); }}
            className="text-lg hover:scale-110 transition-transform"
            title="Favorito"
          >
            {isFavorite ? '⭐' : '☆'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleInterested(lic.id, !lic.interested); }}
            className="text-lg hover:scale-110 transition-transform"
            title={lic.interested ? 'Quitar interés' : 'Marcar interesada'}
          >
            {lic.interested ? '❤️' : '🤍'}
          </button>
          {status === 'pending' && (
            <button
              onClick={(e) => { e.stopPropagation(); onQuickDismiss(lic.id); }}
              className="text-sm hover:scale-110 transition-transform text-gray-400 hover:text-red-500"
              title="Descartar"
            >
              ✕
            </button>
          )}
          {urgency && (
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap',
                urgency.level === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
              )}
            >
              {urgency.level === 'critical' ? '🔥' : '⚠️'} {urgency.text}
            </span>
          )}
          {/* Priority badge */}
          {priorityLower && (
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap',
                priorityLower === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                priorityLower === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
              )}
            >
              {priorityLower === 'high' ? 'Alta' : priorityLower === 'medium' ? 'Media' : 'Baja'}
            </span>
          )}
          {/* Confidence pill */}
          {confidence !== null && (
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap',
                confidence >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' :
                confidence >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
              )}
            >
              {confidence}%
            </span>
          )}
          <span
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap',
              isVisit ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            )}
          >
            {isVisit ? '🏗️ Visita' : '🛒 Compra'}
          </span>
        </div>
      </div>

      {/* Summary */}
      {lic.summary && lic.summary !== 'No disponible' && (
        <p className="text-sm text-muted-foreground italic mb-2 ml-6 line-clamp-2">{lic.summary}</p>
      )}

      {/* Meta */}
      <div className="flex gap-3 text-xs text-muted-foreground mb-2 flex-wrap">
        {isVisit && siteVisitDateDisplay !== 'No disponible' ? (
          <>
            <span>🗓️ Visita: {siteVisitDateDisplay}</span>
            {siteVisitTimeDisplay && <span>🕐 {siteVisitTimeDisplay}</span>}
          </>
        ) : (
          <span>📅 {emailDate}</span>
        )}
        {lic.category && <span>📂 {lic.category}</span>}
      </div>

      {/* Location */}
      {lic.location && (
        <div className="mb-2">
          <span className="text-xs text-muted-foreground font-medium">Ubicacion</span>
          <p className="text-sm">{lic.location}</p>
        </div>
      )}

      {/* Description */}
      {lic.description && (
        <div className="mb-2">
          <span className="text-xs text-muted-foreground font-medium">Descripcion</span>
          <p className="text-sm text-muted-foreground">{truncate(lic.description, 150)}</p>
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        {lic.biddingCloseDate && lic.biddingCloseDate !== 'No disponible' && (
          <div>
            <span className="text-muted-foreground font-medium">Cierre</span>
            <p>{lic.biddingCloseDate} {lic.biddingCloseTime || ''}</p>
          </div>
        )}
        {siteVisitDateDisplay !== 'No disponible' && (
          <div>
            <span className="text-muted-foreground font-medium">Visita</span>
            <p>{siteVisitDateDisplay} {siteVisitTimeDisplay || ''}</p>
          </div>
        )}
        {lic.contactName && (
          <div>
            <span className="text-muted-foreground font-medium">Contacto</span>
            <p>{lic.contactName}</p>
            {lic.contactPhone && (
              <a
                href={`tel:${lic.contactPhone.replace(/\D/g, '')}`}
                className="text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                📞 {lic.contactPhone}
              </a>
            )}
          </div>
        )}
        {pdfLink && pdfLink !== '#' && (
          <div>
            <span className="text-muted-foreground font-medium">PDF</span>
            <a
              href={pdfLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline block"
              onClick={(e) => e.stopPropagation()}
            >
              📄 {lic.pdfFilename || 'Ver PDF'}
            </a>
          </div>
        )}
        {lic.estimatedValue && lic.estimatedValue !== 'No disponible' && (
          <div>
            <span className="text-muted-foreground font-medium">Valor Est.</span>
            <p className="text-emerald-600 dark:text-emerald-400 font-medium">{lic.estimatedValue}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
        {status === 'pending' ? (
          <>
            <button
              className="flex-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
              onClick={() => onApprove(lic.id)}
            >
              ✓ Aprobar
            </button>
            <button
              className="flex-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
              onClick={() => onReject(lic.id)}
            >
              ✗ Rechazar
            </button>
          </>
        ) : (
          <button
            className="flex-1 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 transition-colors"
            onClick={() => onResetPending(lic.id)}
          >
            ↺ Volver a Pendiente
          </button>
        )}
      </div>
    </div>
  );
}
