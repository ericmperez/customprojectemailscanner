'use client';

import { cn, formatSiteVisitDate, computeWorthItScore } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import type { Licitacion } from '@/lib/types';

interface LicitacionCardProps {
  lic: Licitacion;
  isFavorite: boolean;
  isSelected: boolean;
  onToggleFavorite: (id: string) => void;
  onToggleSelection: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onResetPending: (id: string) => void;
  onToggleInterested: (id: string, interested: boolean) => void;
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
}: LicitacionCardProps) {
  const status = (lic.approvalStatus || 'pending').toLowerCase();
  const visitLocation = (lic.visitLocation || '').toString().trim();
  const isVisit = visitLocation && visitLocation.toLowerCase() !== 'no disponible';
  const urgency = computeUrgency(lic);
  const worthItScore = computeWorthItScore(lic);

  const closeDateDisplay = lic.biddingCloseDate && lic.biddingCloseDate !== 'No disponible'
    ? lic.biddingCloseDate
    : null;
  const visitDateDisplay = formatSiteVisitDate(lic.siteVisitDate);
  const hasVisitDate = visitDateDisplay !== 'No disponible';
  const estimatedValue = lic.estimatedValue && lic.estimatedValue !== 'No disponible'
    ? lic.estimatedValue
    : null;

  // Build meta parts: category · location
  const metaParts: string[] = [];
  if (lic.category) metaParts.push(lic.category);
  if (lic.location) metaParts.push(lic.location);

  return (
    <div
      className={cn(
        'rounded-xl border bg-card shadow-sm transition-all hover:shadow-md cursor-pointer',
        lic.isEmergency
          ? 'border-2 border-red-600 bg-red-50 ring-2 ring-red-400/50 shadow-lg shadow-red-200'
          : cn(
              status === 'approved' && 'border-l-4 border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
              status === 'rejected' && 'border-l-4 border-l-red-500 opacity-75',
              status === 'pending' && 'border-l-4 border-l-amber-500',
            ),
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onOpenDetail(lic.id)}
    >
      {/* Zone 1: Top Strip */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        {/* Checkbox - 44px touch target */}
        <div
          className="flex items-center justify-center w-11 h-11 shrink-0 -ml-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelection(lic.id)}
            aria-label="Seleccionar licitación"
            className="size-5"
          />
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
          {lic.isEmergency && (
            <Badge className="bg-red-600 text-white border-red-700 animate-pulse text-xs font-bold">
              🚨 EMERGENCIA
            </Badge>
          )}
          <Badge variant="outline" className={cn(
            'text-xs font-bold',
            worthItScore >= 7 ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300' :
            worthItScore >= 4 ? 'border-amber-500 text-amber-700 dark:text-amber-300' :
            'border-gray-300 text-gray-500'
          )}>
            {worthItScore}/10
          </Badge>

          <Badge variant="outline" className={cn(
            'text-xs',
            isVisit ? 'border-blue-400 text-blue-700 dark:text-blue-300' : 'text-muted-foreground'
          )}>
            {isVisit ? '🏗️ Visita' : '🛒 Compra'}
          </Badge>

          {urgency && (
            <Badge className={cn(
              'text-xs',
              urgency.level === 'critical'
                ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-200'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200'
            )}>
              {urgency.level === 'critical' ? '🔥' : '⚠️'} {urgency.text}
            </Badge>
          )}
        </div>

        {/* Quick actions - 44px touch targets */}
        <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onToggleFavorite(lic.id)}
            className="w-11 h-11 flex items-center justify-center text-lg hover:scale-110 transition-transform"
            title="Favorito"
            aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          >
            {isFavorite ? '⭐' : '☆'}
          </button>
          <button
            onClick={() => onToggleInterested(lic.id, !lic.interested)}
            className="w-11 h-11 flex items-center justify-center text-lg hover:scale-110 transition-transform"
            title={lic.interested ? 'Quitar interés' : 'Marcar interesada'}
            aria-label={lic.interested ? 'Quitar interés' : 'Marcar interesada'}
          >
            {lic.interested ? '❤️' : '🤍'}
          </button>
        </div>
      </div>

      {/* Zone 2: Content Body */}
      <div className="px-4 pb-3">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 mb-1">
          {lic.title || lic.subject || 'Sin titulo'}
        </h3>

        {metaParts.length > 0 && (
          <p className="text-xs text-muted-foreground mb-1 line-clamp-1">
            {metaParts.join(' · ')}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {isVisit && hasVisitDate ? (
            <span>🗓️ Visita: {visitDateDisplay}</span>
          ) : closeDateDisplay ? (
            <span>📅 Cierre: {closeDateDisplay}</span>
          ) : null}
          {isVisit && lic.location && (
            <span className="text-blue-600 dark:text-blue-400 font-medium">📍 {lic.location}</span>
          )}
          {estimatedValue && (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              💰 {estimatedValue}
            </span>
          )}
        </div>

        {/* Quick links: PDF & Quote */}
        <div className="flex items-center gap-2 mt-1.5" onClick={(e) => e.stopPropagation()}>
          {(lic.pdfUrl || lic.pdfLink) && (
            <a
              href={lic.pdfUrl || lic.pdfLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
              title="Abrir PDF"
            >
              📄 PDF
            </a>
          )}
          {lic.quoteUrl && (
            <a
              href={lic.quoteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
              title="Entrar cotizacion"
            >
              🔗 Cotizacion
            </a>
          )}
        </div>
      </div>

      {/* Zone 3: Action Footer */}
      <div className="px-4 pb-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-3 pt-2 border-t">
          {status === 'pending' ? (
            <>
              <button
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors active:bg-emerald-800"
                onClick={() => onApprove(lic.id)}
                aria-label="Aprobar licitación"
              >
                ✓ Aprobar
              </button>
              <button
                className="flex-1 rounded-lg bg-red-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition-colors active:bg-red-800"
                onClick={() => onReject(lic.id)}
                aria-label="Rechazar licitación"
              >
                ✗ Rechazar
              </button>
            </>
          ) : (
            <button
              className="flex-1 rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-medium text-white hover:bg-amber-600 transition-colors active:bg-amber-700"
              onClick={() => onResetPending(lic.id)}
              aria-label="Volver a pendiente"
            >
              ↺ Volver a Pendiente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
