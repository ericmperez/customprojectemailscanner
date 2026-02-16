'use client';

import { useEffect, useState, useRef } from 'react';
import { useOrganization, useUser } from '@clerk/nextjs';
import { supabaseClient } from '@/lib/supabase-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface OnlineUser {
  userId: string;
  name: string;
  imageUrl: string | null;
}

export function usePresence() {
  const { organization } = useOrganization();
  const { user } = useUser();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!supabaseClient || !organization?.id || !user?.id) return;

    const channelName = `presence:${organization.id}`;
    const channel = supabaseClient.channel(channelName);
    channelRef.current = channel;

    const currentUser: OnlineUser = {
      userId: user.id,
      name: user.fullName || user.firstName || 'Usuario',
      imageUrl: user.imageUrl || null,
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<OnlineUser>();
        const users: OnlineUser[] = [];
        const seen = new Set<string>();

        for (const presences of Object.values(state)) {
          for (const p of presences) {
            if (!seen.has(p.userId)) {
              seen.add(p.userId);
              users.push({ userId: p.userId, name: p.name, imageUrl: p.imageUrl });
            }
          }
        }
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(currentUser);
        }
      });

    return () => {
      channel.untrack();
      supabaseClient?.removeChannel(channel);
      channelRef.current = null;
    };
  }, [organization?.id, user?.id, user?.fullName, user?.firstName, user?.imageUrl]);

  return { onlineUsers };
}
