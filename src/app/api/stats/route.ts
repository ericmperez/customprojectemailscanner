import { NextResponse } from 'next/server';
import LicitacionesService from '@/lib/services/licitaciones.service';
import { getLastFetchTimestamp } from '@/lib/services/supabase.service';

const licitacionesService = new LicitacionesService();

export async function GET() {
  try {
    const [stats, lastFetch] = await Promise.all([
      licitacionesService.getStats(),
      getLastFetchTimestamp(),
    ]);
    return NextResponse.json({ success: true, data: stats, lastFetch });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
