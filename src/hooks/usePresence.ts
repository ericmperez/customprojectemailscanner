'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useOrganization, useUser } from '@clerk/nextjs';
import { supabaseClient } from '@/lib/supabase-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface OnlineUser {
  userId: string;
  name: string;
  imageUrl: string | null;
  secondsToday: number;
}

const HEARTBEAT_INTERVAL_MS = 30_000;

export function usePresence() {
  const { organization } = useOrganization();
  const { user } = useUser();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Send heartbeat to accumulate daily time
  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch('/api/presence', { method: 'POST' });
    } catch {
      // ignore
    }
  }, []);

  // Fetch daily time for all online users
  const fetchTimes = useCallback(async () => {
    try {
      const res = await fetch('/api/presence');
      if (!res.ok) return null;
      const result = await res.json();
      if (result.success) return result.data as { userId: string; secondsToday: number }[];
    } catch {
      // ignore
    }
    return null;
  }, []);

  useEffect(() => {
    if (!supabaseClient || !organization?.id || !user?.id) return;

    const channelName = `presence:${organization.id}`;
    const channel = supabaseClient.channel(channelName);
    channelRef.current = channel;

    const currentUser = {
      userId: user.id,
      name: user.fullName || user.firstName || 'Usuario',
      imageUrl: user.imageUrl || null,
    };

    // Merge realtime presence with daily time data
    let timeData: Map<string, number> = new Map();

    const syncUsers = () => {
      const state = channel.presenceState<typeof currentUser>();
      const users: OnlineUser[] = [];
      const seen = new Set<string>();

      for (const presences of Object.values(state)) {
        for (const p of presences) {
          if (!seen.has(p.userId)) {
            seen.add(p.userId);
            users.push({
              userId: p.userId,
              name: p.name,
              imageUrl: p.imageUrl,
              secondsToday: timeData.get(p.userId) || 0,
            });
          }
        }
      }
      setOnlineUsers(users);
    };

    const refreshTimes = async () => {
      const data = await fetchTimes();
      if (data) {
        timeData = new Map(data.map((d) => [d.userId, d.secondsToday]));
        syncUsers();
      }
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        syncUsers();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(currentUser);
          sendHeartbeat();
          refreshTimes();
        }
      });

    // Periodic heartbeat + time refresh
    const timer = setInterval(() => {
      sendHeartbeat();
      refreshTimes();
    }, HEARTBEAT_INTERVAL_MS);

    const onFocus = () => {
      sendHeartbeat();
      refreshTimes();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      channel.untrack();
      supabaseClient?.removeChannel(channel);
      channelRef.current = null;
    };
  }, [organization?.id, user?.id, user?.fullName, user?.firstName, user?.imageUrl, sendHeartbeat, fetchTimes]);

  return { onlineUsers };
}
