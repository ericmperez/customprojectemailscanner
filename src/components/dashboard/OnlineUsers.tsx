'use client';

import { useEffect, useState, useCallback } from 'react';

interface OnlineUser {
  userId: string;
  name: string;
  imageUrl: string;
  secondsToday: number;
}

const HEARTBEAT_INTERVAL_MS = 30_000; // send heartbeat every 30s
const POLL_INTERVAL_MS = 30_000; // refresh online list every 30s

function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function OnlineUsers() {
  const [users, setUsers] = useState<OnlineUser[]>([]);

  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch('/api/presence', { method: 'POST' });
    } catch {
      // ignore
    }
  }, []);

  const fetchOnline = useCallback(async () => {
    try {
      const res = await fetch('/api/presence');
      if (!res.ok) return;
      const result = await res.json();
      if (result.success) setUsers(result.data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Send initial heartbeat and fetch online users
    sendHeartbeat();
    fetchOnline();

    const heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    const pollTimer = setInterval(fetchOnline, POLL_INTERVAL_MS);

    // Heartbeat on focus
    const onFocus = () => {
      sendHeartbeat();
      fetchOnline();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(heartbeatTimer);
      clearInterval(pollTimer);
      window.removeEventListener('focus', onFocus);
    };
  }, [sendHeartbeat, fetchOnline]);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      {users.map((user) => (
        <div key={user.userId} className="flex flex-col items-center gap-0.5">
          <div className="relative">
            {user.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={user.name}
                className="w-8 h-8 rounded-full border-2 border-emerald-400"
                title={user.name}
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full border-2 border-emerald-400 bg-muted flex items-center justify-center text-xs font-bold"
                title={user.name}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />
          </div>
          <span className="text-[10px] text-muted-foreground leading-none">
            {formatTime(user.secondsToday)}
          </span>
        </div>
      ))}
    </div>
  );
}
