import { NextResponse } from 'next/server';
import LicitacionesService from '@/lib/services/licitaciones.service';

const licitacionesService = new LicitacionesService();

export async function GET() {
  try {
    const stats = await licitacionesService.getStats();
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
