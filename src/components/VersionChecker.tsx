'use client';

import { useEffect, useRef } from 'react';

const POLL_INTERVAL_MS = 15_000; // check every 15 seconds

export function VersionChecker() {
  const currentBuildId = useRef<string | null>(null);
  const reloading = useRef(false);

  useEffect(() => {
    async function checkVersion() {
      if (reloading.current) return;
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const { buildId } = await res.json();

        if (currentBuildId.current === null) {
          currentBuildId.current = buildId;
          return;
        }

        if (buildId !== currentBuildId.current) {
          reloading.current = true;
          window.location.reload();
        }
      } catch {
        // Silently ignore network errors
      }
    }

    // Initial check
    const initial = setTimeout(checkVersion, 3000);
    // Poll every 15s
    const timer = setInterval(checkVersion, POLL_INTERVAL_MS);
    // Check immediately when user tabs back
    const onFocus = () => checkVersion();
    window.addEventListener('focus', onFocus);

    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return null;
}
