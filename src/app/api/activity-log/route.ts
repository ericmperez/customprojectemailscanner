import { NextRequest, NextResponse } from 'next/server';
import { getOrgDbId, getUserName } from '@/lib/auth';
import { logActivity, getActivityLog } from '@/lib/services/supabase.service';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10) || 0;

  try {
    const orgId = await getOrgDbId();
    const entries = await getActivityLog(orgId, limit, offset);
    return NextResponse.json({ success: true, data: entries });
  } catch (error) {
    console.error('Error fetching activity log:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgDbId();
    const userName = await getUserName();

    const body = await request.json().catch(() => ({}));
    const { action, licitacionId, licitacionTitle } = body;

    if (!action || typeof action !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing action' },
        { status: 400 }
      );
    }

    logActivity(orgId, action, licitacionId ?? null, licitacionTitle ?? null, userName);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error logging activity:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
