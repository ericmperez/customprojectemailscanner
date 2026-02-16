'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const POLL_INTERVAL_MS = 60_000; // check every 60 seconds

export function VersionChecker() {
  const currentBuildId = useRef<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    async function checkVersion() {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const { buildId } = await res.json();

        if (currentBuildId.current === null) {
          // First check - store the current version
          currentBuildId.current = buildId;
          return;
        }

        if (buildId !== currentBuildId.current) {
          toast.info('Nueva version disponible. Recargando...', { duration: 2000 });
          setTimeout(() => window.location.reload(), 2000);
        }
      } catch {
        // Silently ignore network errors
      }
    }

    // Initial check after a short delay
    const initial = setTimeout(checkVersion, 5000);
    timer = setInterval(checkVersion, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, []);

  return null;
}
