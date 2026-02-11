import { FeatureCard } from './FeatureCard';
import type { ChangelogRelease } from '@/lib/data/changelog';

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-PR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function ReleaseTimeline({ releases }: { releases: ChangelogRelease[] }) {
  return (
    <div className="space-y-8">
      {releases.map((release, idx) => (
        <div key={release.version} className="relative pl-8">
          {/* Connector line */}
          {idx < releases.length - 1 && (
            <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border" />
          )}

          {/* Version circle */}
          <div className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary bg-background text-[10px] font-bold text-primary">
            {release.version.split('.')[1]}
          </div>

          {/* Release header */}
          <div className="mb-4">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h3 className="text-lg font-semibold">v{release.version}</h3>
              <span className="text-sm text-muted-foreground">{formatDate(release.date)}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{release.headline}</p>
          </div>

          {/* Feature cards */}
          <div className="space-y-3">
            {release.features.map((feature) => (
              <FeatureCard key={feature.title} feature={feature} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
