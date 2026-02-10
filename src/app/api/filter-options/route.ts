import { NextResponse } from 'next/server';
import LicitacionesService from '@/lib/services/licitaciones.service';

const licitacionesService = new LicitacionesService();

export async function GET() {
  try {
    const options = await licitacionesService.getDistinctFilterValues();
    return NextResponse.json({ success: true, data: options });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
