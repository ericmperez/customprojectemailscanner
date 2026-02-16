'use client';

import { useMemo } from 'react';
import { cn, formatSiteVisitDate } from '@/lib/utils';
import type { Licitacion } from '@/lib/types';

interface VisitListViewProps {
  licitaciones: Licitacion[];
  onOpenDetail: (id: string) => void;
  onToggleAttendance: (id: string, attendance: 'attending' | 'skipped' | null) => void;
}

interface VisitGroup {
  label: string;
  items: Licitacion[];
  collapsed?: boolean;
}

function getVisitGroups(licitaciones: Licitacion[]): VisitGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const dayOfWeek = today.getDay();
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (6 - dayOfWeek));

  const startOfNextWeek = new Date(endOfWeek);
  startOfNextWeek.setDate(endOfWeek.getDate() + 1);
  const endOfNextWeek = new Date(startOfNextWeek);
  endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);

  const groups: Record<string, Licitacion[]> = {
    today: [],
    tomorrow: [],
    thisWeek: [],
    nextWeek: [],
    later: [],
    past: [],
  };

  for (const lic of licitaciones) {
    const dateStr = lic.siteVisitDate;
    if (!dateStr || dateStr === 'No disponible') continue;

    const visitDate = new Date(dateStr);
    if (isNaN(visitDate.getTime())) continue;
    const visitDay = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate());

    if (visitDay < today) {
      groups.past.push(lic);
    } else if (visitDay.getTime() === today.getTime()) {
      groups.today.push(lic);
    } else if (visitDay.getTime() === tomorrow.getTime()) {
      groups.tomorrow.push(lic);
    } else if (visitDay <= endOfWeek) {
      groups.thisWeek.push(lic);
    } else if (visitDay <= endOfNextWeek) {
      groups.nextWeek.push(lic);
    } else {
      groups.later.push(lic);
    }
  }

  const result: VisitGroup[] = [];
  if (groups.today.length > 0) result.push({ label: 'Hoy', items: groups.today });
  if (groups.tomorrow.length > 0) result.push({ label: 'Manana', items: groups.tomorrow });
  if (groups.thisWeek.length > 0) result.push({ label: 'Esta semana', items: groups.thisWeek });
  if (groups.nextWeek.length > 0) result.push({ label: 'Proxima semana', items: groups.nextWeek });
  if (groups.later.length > 0) result.push({ label: 'Mas adelante', items: groups.later });
  if (groups.past.length > 0) result.push({ label: 'Pasadas', items: groups.past, collapsed: true });

  return result;
}

function VisitRow({
  lic,
  onOpenDetail,
  onToggleAttendance,
}: {
  lic: Licitacion;
  onOpenDetail: (id: string) => void;
  onToggleAttendance: (id: string, attendance: 'attending' | 'skipped' | null) => void;
}) {
  const attendance = lic.visitAttendance;
  const isAttending = attendance === 'attending';
  const isSkipped = attendance === 'skipped';

  const visitDateDisplay = formatSiteVisitDate(lic.siteVisitDate);
  const visitTime = lic.siteVisitTime && lic.siteVisitTime !== 'No disponible' ? lic.siteVisitTime : null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 sm:gap-3 rounded-md border bg-card px-2 py-2.5 sm:px-3 sm:py-2 transition-colors',
        isAttending && 'border-l-4 border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20',
        isSkipped && 'border-l-4 border-l-gray-300 dark:border-l-gray-600 opacity-60',
        !isAttending && !isSkipped && 'border-l-4 border-l-amber-400',
        'hover:bg-muted/50 active:bg-muted/70'
      )}
    >
      {/* Attendance buttons */}
      <div className="flex flex-col gap-1 shrink-0">
        <button
          className={cn(
            'text-sm px-1.5 py-0.5 rounded transition-colors',
            isAttending
              ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
              : 'hover:bg-emerald-50 dark:hover:bg-emerald-950'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleAttendance(lic.id, isAttending ? null : 'attending');
          }}
          title={isAttending ? 'Cancelar asistencia' : 'Asistir'}
          aria-label={isAttending ? 'Cancelar asistencia' : 'Asistir a visita'}
        >
          {isAttending ? '✅' : '☑️'}
        </button>
        <button
          className={cn(
            'text-sm px-1.5 py-0.5 rounded transition-colors',
            isSkipped
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleAttendance(lic.id, isSkipped ? null : 'skipped');
          }}
          title={isSkipped ? 'Deshacer' : 'Saltar visita'}
          aria-label={isSkipped ? 'Deshacer saltar' : 'Saltar visita'}
        >
          {isSkipped ? '⏭️' : '⏩'}
        </button>
      </div>

      {/* Content */}
      <div
        className={cn('flex-1 min-w-0 cursor-pointer', isSkipped && 'line-through decoration-gray-400')}
        onClick={() => onOpenDetail(lic.id)}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">
            {lic.title || lic.subject || 'Sin titulo'}
          </span>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap items-center">
          <span>📅 {visitDateDisplay}{visitTime ? ` a las ${visitTime}` : ''}</span>
          <span>📍 {lic.visitLocation || 'Sin ubicacion'}</span>
          {lic.visitRequirements && lic.visitRequirements !== 'No disponible' && (
            <span className="text-amber-600 dark:text-amber-400">📋 {lic.visitRequirements}</span>
          )}
          {lic.category && <span>📂 {lic.category}</span>}
          {lic.interested && <span>❤️</span>}
          {(lic.pdfUrl || lic.pdfLink) && (
            <a
              href={lic.pdfUrl || lic.pdfLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
              title="Abrir PDF"
            >
              📄 PDF
            </a>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div className="shrink-0 hidden sm:block">
        <span
          className={cn(
            'px-2 py-0.5 rounded-full text-xs font-medium',
            lic.approvalStatus === 'approved'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : lic.approvalStatus === 'rejected'
                ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
          )}
        >
          {lic.approvalStatus === 'approved' ? 'Aprobada' : lic.approvalStatus === 'rejected' ? 'Rechazada' : 'Pendiente'}
        </span>
      </div>
    </div>
  );
}

export function VisitListView({
  licitaciones,
  onOpenDetail,
  onToggleAttendance,
}: VisitListViewProps) {
  const groups = useMemo(() => getVisitGroups(licitaciones), [licitaciones]);

  if (licitaciones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-4xl mb-3">🏗️</p>
        <p>No hay visitas que mostrar</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <VisitGroupSection
          key={group.label}
          group={group}
          onOpenDetail={onOpenDetail}
          onToggleAttendance={onToggleAttendance}
        />
      ))}
    </div>
  );
}

function VisitGroupSection({
  group,
  onOpenDetail,
  onToggleAttendance,
}: {
  group: VisitGroup;
  onOpenDetail: (id: string) => void;
  onToggleAttendance: (id: string, attendance: 'attending' | 'skipped' | null) => void;
}) {
  const attendingCount = group.items.filter((l) => l.visitAttendance === 'attending').length;

  return (
    <details open={!group.collapsed}>
      <summary className="cursor-pointer select-none flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-1.5 hover:text-foreground transition-colors">
        <span>{group.label}</span>
        <span className="text-xs font-normal">
          ({group.items.length} visita{group.items.length !== 1 ? 's' : ''}{attendingCount > 0 ? ` · ${attendingCount} asistiendo` : ''})
        </span>
      </summary>
      <div className="space-y-1">
        {group.items.map((lic) => (
          <VisitRow
            key={lic.id}
            lic={lic}
            onOpenDetail={onOpenDetail}
            onToggleAttendance={onToggleAttendance}
          />
        ))}
      </div>
    </details>
  );
}
