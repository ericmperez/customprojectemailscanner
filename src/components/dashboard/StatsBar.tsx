'use client';

import type { Stats } from '@/lib/types';
import { cn } from '@/lib/utils';

interface StatsBarProps {
  stats: Stats;
  activeStatus: string;
  onStatusClick: (status: string) => void;
}

const STAT_ITEMS = [
  { key: 'pending' as const, label: 'Pendientes', color: 'bg-amber-500' },
  { key: 'approved' as const, label: 'Aprobadas', color: 'bg-emerald-500' },
  { key: 'rejected' as const, label: 'Rechazadas', color: 'bg-red-500' },
];

export function StatsBar({ stats, activeStatus, onStatusClick }: StatsBarProps) {
  return (
    <div className="flex gap-3 flex-wrap">
      {STAT_ITEMS.map(({ key, label, color }) => {
        const isActive = activeStatus === key || activeStatus === '';
        return (
          <button
            key={key}
            onClick={() => onStatusClick(activeStatus === key ? '' : key)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all cursor-pointer select-none',
              'hover:shadow-md',
              isActive
                ? 'opacity-100 scale-105 shadow-md border-border'
                : 'opacity-60 scale-100 border-transparent'
            )}
          >
            <span className={cn('h-2.5 w-2.5 rounded-full', color)} />
            <span className="text-muted-foreground">{label}</span>
            <span className="font-bold text-foreground">{stats[key]}</span>
          </button>
        );
      })}
    </div>
  );
}
