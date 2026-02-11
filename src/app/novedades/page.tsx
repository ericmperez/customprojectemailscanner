import Link from 'next/link';
import { CHANGELOG } from '@/lib/data/changelog';
import { ReleaseTimeline } from '@/components/novedades/ReleaseTimeline';

export const metadata = {
  title: 'Novedades - Licitaciones',
};

export default function NovedadesPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">🆕 Novedades</h1>
          <Link
            href="/"
            className="text-sm text-primary hover:underline"
          >
            ← Volver al dashboard
          </Link>
        </div>

        <p className="text-muted-foreground">
          Historial de cambios y nuevas funcionalidades.
        </p>

        <ReleaseTimeline releases={CHANGELOG} />
      </div>
    </div>
  );
}
