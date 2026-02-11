import { Badge } from '@/components/ui/badge';
import type { FeatureType } from '@/lib/data/changelog';

const CONFIG: Record<FeatureType, { label: string; emoji: string; className: string }> = {
  feature: {
    label: 'Nuevo',
    emoji: '✨',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  improvement: {
    label: 'Mejora',
    emoji: '🔧',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  },
  fix: {
    label: 'Correccion',
    emoji: '🐛',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
};

export function CategoryBadge({ type }: { type: FeatureType }) {
  const { label, emoji, className } = CONFIG[type];
  return (
    <Badge variant="outline" className={className}>
      {emoji} {label}
    </Badge>
  );
}
