'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { ActivityEntry } from '@/hooks/useActivityLog';

const ACTION_CONFIG: Record<string, { emoji: string; label: string }> = {
  approve: { emoji: '✅', label: 'Aprobó' },
  reject: { emoji: '❌', label: 'Rechazó' },
  pending: { emoji: '↺', label: 'Devolvió a pendiente' },
  favorite: { emoji: '⭐', label: 'Agregó a favoritos' },
  unfavorite: { emoji: '☆', label: 'Quitó de favoritos' },
  interested: { emoji: '❤️', label: 'Marcó interesada' },
  uninterested: { emoji: '🤍', label: 'Quitó interés' },
  edit_field: { emoji: '✏️', label: 'Editó campo' },
  fetch_emails: { emoji: '📨', label: 'Buscó emails' },
  bulk_approve: { emoji: '✅', label: 'Aprobó en lote' },
  bulk_reject: { emoji: '❌', label: 'Rechazó en lote' },
};

function getActionDisplay(action: string) {
  return ACTION_CONFIG[action] ?? { emoji: '📝', label: action };
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;

  return new Date(dateStr).toLocaleDateString('es-PR', {
    day: 'numeric',
    month: 'short',
  });
}

function EditDetails({ details }: { details: Record<string, unknown> | null }) {
  if (!details?.fields) return null;
  const fields = details.fields as string[];
  return (
    <span className="text-muted-foreground">
      {' '}({fields.join(', ')})
    </span>
  );
}

function FetchDetails({ details }: { details: Record<string, unknown> | null }) {
  if (!details?.processed && details?.processed !== 0) return null;
  const count = Number(details.processed);
  return (
    <span className="text-muted-foreground">
      {' '}({count} procesado{count !== 1 ? 's' : ''})
    </span>
  );
}

interface ActivitySidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: ActivityEntry[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export function ActivitySidebar({
  open,
  onOpenChange,
  entries,
  loading,
  hasMore,
  onLoadMore,
}: ActivitySidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[320px] sm:w-[380px] flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b">
          <SheetTitle className="text-base">🕐 Historial de Actividad</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {entries.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sin actividad reciente
            </p>
          )}

          <div className="space-y-1">
            {entries.map((entry) => {
              const { emoji, label } = getActionDisplay(entry.action);
              return (
                <div
                  key={entry.id}
                  className="rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="text-sm">
                    <span className="mr-1.5">{emoji}</span>
                    <span className="font-medium">{label}</span>
                    {entry.action === 'edit_field' && (
                      <EditDetails details={entry.details} />
                    )}
                    {entry.action === 'fetch_emails' && (
                      <FetchDetails details={entry.details} />
                    )}
                  </div>
                  {entry.licitacion_title && (
                    <p className="text-xs text-muted-foreground truncate pl-6">
                      {entry.licitacion_title}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground/70 pl-6">
                    {relativeTime(entry.created_at)} · {entry.user_name}
                  </p>
                </div>
              );
            })}
          </div>

          {loading && (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          )}

          {hasMore && !loading && entries.length > 0 && (
            <button
              onClick={onLoadMore}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-3"
            >
              Cargar más
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
