'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn, truncate, formatTimeLabel } from '@/lib/utils';
import type { Visit } from '@/lib/types';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface CalendarViewProps {
  filters: Record<string, string | string[]>;
  onOpenDetail: (id: number) => void;
}

export function CalendarView({ filters, onOpenDetail }: CalendarViewProps) {
  const [events, setEvents] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);
  const [monthDate, setMonthDate] = useState(new Date());

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const calFilters = { ...filters, status: 'approved' };
      const params = new URLSearchParams();
      Object.entries(calFilters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.filter(Boolean).forEach((item) => params.append(key, item));
        } else if (value) {
          params.append(key, value);
        }
      });
      const query = params.toString();
      const response = await fetch(`/api/visits${query ? `?${query}` : ''}`);
      const result = await response.json();
      if (result.success) {
        const data = Array.isArray(result.data) ? result.data : [];
        setEvents(data);

        // Auto-navigate to first upcoming event month
        if (data.length > 0) {
          const now = new Date();
          const upcoming = data.find((e: Visit) => {
            const dt = new Date(`${e.visitDate}T${e.visitTime || '00:00'}:00`);
            return !Number.isNaN(dt.getTime()) && dt >= now;
          });
          const target = upcoming || data[0];
          if (target) {
            const td = new Date(`${target.visitDate}T00:00:00`);
            if (!Number.isNaN(td.getTime())) {
              setMonthDate(new Date(td.getFullYear(), td.getMonth(), 1));
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading calendar events:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const days: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  const trailing = (7 - (days.length % 7)) % 7;
  for (let i = 0; i < trailing; i++) days.push(null);

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMonthDate(new Date(year, month - 1, 1))}
        >
          ‹
        </Button>
        <h2 className="text-lg font-semibold">
          {MONTH_NAMES[month]} {year}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMonthDate(new Date(year, month + 1, 1))}
        >
          ›
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {!loading && (
        <>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
            {['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
            {days.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} className="bg-card min-h-[80px] p-1" />;
              }

              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = events.filter((e) => e.visitDate === dateKey);
              const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

              return (
                <div
                  key={dateKey}
                  className={cn(
                    'bg-card min-h-[80px] p-1 relative',
                    isToday && 'ring-2 ring-primary ring-inset',
                    dayEvents.length > 0 && 'bg-primary/5'
                  )}
                >
                  <div className={cn('text-xs font-medium mb-0.5', isToday && 'text-primary font-bold')}>
                    {day}
                  </div>
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className="text-[10px] leading-tight bg-primary/10 text-primary rounded px-1 py-0.5 mb-0.5 cursor-pointer hover:bg-primary/20 transition-colors truncate"
                      onClick={() => onOpenDetail(event.id)}
                      title={event.title || event.subject}
                    >
                      {formatTimeLabel(event.visitTime) || ''}
                      {' '}
                      {truncate(event.title || event.subject, 20)}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{dayEvents.length - 3} mas
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Visit list below calendar */}
          {events.length > 0 && (
            <div className="rounded-md border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Visitas Programadas</h3>
                <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                  {events.length}
                </span>
              </div>
              <div className="space-y-2">
                {events.map((event) => {
                  const dateValue = new Date(`${event.visitDate}T00:00:00`);
                  const dateLabel = Number.isNaN(dateValue.getTime())
                    ? event.visitDate
                    : dateValue.toLocaleDateString('es-PR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      });

                  return (
                    <div
                      key={event.id}
                      className="flex items-center justify-between gap-4 rounded-md border bg-card p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => onOpenDetail(event.id)}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {event.title || event.subject}
                        </p>
                        <div className="flex gap-3 text-xs text-muted-foreground flex-wrap mt-0.5">
                          <span>📅 {dateLabel}</span>
                          <span>🕒 {formatTimeLabel(event.visitTime) || 'Sin hora'}</span>
                          <span>📍 {event.visitLocation || 'No especificado'}</span>
                        </div>
                      </div>
                      {event.pdfUrl && event.pdfUrl !== '#' && (
                        <a
                          href={event.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-primary text-sm hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          📄 PDF
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {events.length === 0 && !loading && (
            <p className="text-center text-muted-foreground py-8">
              📅 No hay visitas programadas para este mes
            </p>
          )}
        </>
      )}
    </div>
  );
}
