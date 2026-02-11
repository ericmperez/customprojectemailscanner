import { NextResponse } from 'next/server';
import LicitacionesService from '@/lib/services/licitaciones.service';
import { getLastFetchInfo } from '@/lib/services/supabase.service';

const licitacionesService = new LicitacionesService();

export async function GET() {
  try {
    const [stats, lastFetchInfo] = await Promise.all([
      licitacionesService.getStats(),
      getLastFetchInfo(),
    ]);
    return NextResponse.json({ success: true, data: stats, lastFetch: lastFetchInfo });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
