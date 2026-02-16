import { NextResponse } from 'next/server';
import { getOrgDbId } from '@/lib/auth';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const ONLINE_THRESHOLD_MS = 120_000; // 2 minutes
const HEARTBEAT_WINDOW_MS = 60_000; // count time if last beat was within 60s

function getSupabase() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!;
  return createClient(url, key);
}

// GET - return online users for this org
export async function GET() {
  try {
    const orgId = await getOrgDbId();
    const supabase = getSupabase();
    const cutoff = new Date(Date.now() - ONLINE_THRESHOLD_MS).toISOString();

    const { data, error } = await supabase
      .from('user_presence')
      .select('user_id, user_name, user_image_url, last_heartbeat, seconds_today, today_date')
      .eq('org_id', orgId)
      .gte('last_heartbeat', cutoff);

    if (error) throw error;

    const today = new Date().toISOString().slice(0, 10);
    const users = (data || []).map((u) => ({
      userId: u.user_id,
      name: u.user_name || 'Usuario',
      imageUrl: u.user_image_url || '',
      secondsToday: u.today_date === today ? u.seconds_today : 0,
    }));

    return NextResponse.json({ success: true, data: users });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST - heartbeat from client
export async function POST() {
  try {
    const orgId = await getOrgDbId();
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const userName = (sessionClaims?.full_name as string)
      || [sessionClaims?.first_name, sessionClaims?.last_name].filter(Boolean).join(' ')
      || 'Usuario';
    const userImageUrl = (sessionClaims?.image_url as string) || '';

    const supabase = getSupabase();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    // Get existing presence record
    const { data: existing } = await supabase
      .from('user_presence')
      .select('last_heartbeat, today_date, seconds_today')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .single();

    let secondsToday = 0;

    if (existing) {
      const lastBeat = new Date(existing.last_heartbeat).getTime();
      const elapsed = now.getTime() - lastBeat;
      const sameDay = existing.today_date === todayStr;

      if (sameDay && elapsed <= HEARTBEAT_WINDOW_MS) {
        // Continuous session - accumulate time
        secondsToday = existing.seconds_today + Math.round(elapsed / 1000);
      } else if (sameDay) {
        // Gap in session - keep existing total
        secondsToday = existing.seconds_today;
      }
      // else new day - reset to 0
    }

    const { error } = await supabase
      .from('user_presence')
      .upsert({
        org_id: orgId,
        user_id: userId,
        user_name: userName,
        user_image_url: userImageUrl,
        last_heartbeat: now.toISOString(),
        today_date: todayStr,
        seconds_today: secondsToday,
      }, { onConflict: 'org_id,user_id' });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
