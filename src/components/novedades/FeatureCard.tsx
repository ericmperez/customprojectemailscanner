import { CategoryBadge } from './CategoryBadge';
import type { ChangelogFeature } from '@/lib/data/changelog';

export function FeatureCard({ feature }: { feature: ChangelogFeature }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-start gap-3">
        <CategoryBadge type={feature.type} />
        <div className="min-w-0">
          <h4 className="font-medium text-sm">{feature.title}</h4>
          <p className="text-sm text-muted-foreground mt-1">{feature.description}</p>
        </div>
      </div>
    </div>
  );
}
