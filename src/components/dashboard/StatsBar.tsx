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
    <div className="flex gap-1.5 sm:gap-3 flex-wrap">
      {STAT_ITEMS.map(({ key, label, color }) => {
        const isActive = activeStatus === key || activeStatus === '';
        return (
          <button
            key={key}
            onClick={() => onStatusClick(activeStatus === key ? '' : key)}
            className={cn(
              'flex items-center gap-1 sm:gap-2 rounded-lg border px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium transition-all cursor-pointer select-none',
              'hover:shadow-md',
              isActive
                ? 'opacity-100 sm:scale-105 shadow-md border-border'
                : 'opacity-60 scale-100 border-transparent'
            )}
          >
            <span className={cn('h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full', color)} />
            <span className="text-muted-foreground hidden sm:inline">{label}</span>
            <span className="font-bold text-foreground">{stats[key]}</span>
          </button>
        );
      })}
      {stats.interested > 0 && (
        <span className="flex items-center gap-1 sm:gap-2 rounded-lg border border-transparent px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium opacity-80 select-none">
          <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-pink-500" />
          <span className="text-muted-foreground hidden sm:inline">Interesadas</span>
          <span className="font-bold text-foreground">{stats.interested}</span>
        </span>
      )}
    </div>
  );
}
