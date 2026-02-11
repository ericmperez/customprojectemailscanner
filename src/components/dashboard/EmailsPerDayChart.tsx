'use client';

import { useMemo } from 'react';
import type { Licitacion } from '@/lib/types';

const DAYS_TO_SHOW = 14;

function formatDay(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-PR', { weekday: 'narrow', day: 'numeric' });
}

interface EmailsPerDayChartProps {
  licitaciones: Licitacion[];
}

export function EmailsPerDayChart({ licitaciones }: EmailsPerDayChartProps) {
  const bars = useMemo(() => {
    // Build date range: last DAYS_TO_SHOW days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: string[] = [];
    for (let i = DAYS_TO_SHOW - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    // Count emails per day
    const counts = new Map<string, number>();
    for (const day of days) counts.set(day, 0);
    for (const lic of licitaciones) {
      const day = (lic.emailDate || '').slice(0, 10);
      if (counts.has(day)) {
        counts.set(day, (counts.get(day) || 0) + 1);
      }
    }

    const max = Math.max(1, ...counts.values());
    return days.map((day) => ({
      day,
      label: formatDay(day),
      count: counts.get(day) || 0,
      pct: ((counts.get(day) || 0) / max) * 100,
    }));
  }, [licitaciones]);

  const total = bars.reduce((s, b) => s + b.count, 0);

  return (
    <div className="rounded-lg border bg-card p-3 sm:p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-medium">📧 Emails por dia</h3>
        <span className="text-xs text-muted-foreground">{total} ultimos {DAYS_TO_SHOW} dias</span>
      </div>
      <div className="flex items-end gap-[3px] h-20">
        {bars.map((bar) => (
          <div key={bar.day} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="w-full flex flex-col justify-end h-14">
              {bar.count > 0 && (
                <span className="text-[10px] text-center text-muted-foreground leading-none mb-0.5">
                  {bar.count}
                </span>
              )}
              <div
                className="w-full rounded-sm bg-blue-500 dark:bg-blue-400 transition-all duration-300"
                style={{ height: bar.count > 0 ? `${Math.max(bar.pct, 8)}%` : '0%' }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground leading-none truncate w-full text-center">
              {bar.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
