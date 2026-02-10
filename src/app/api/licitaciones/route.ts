import { NextRequest, NextResponse } from 'next/server';
import LicitacionesService from '@/lib/services/licitaciones.service';
import type { Filters } from '@/lib/types';

const licitacionesService = new LicitacionesService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const visitLocationParam = searchParams.getAll('visitLocation');
    const townParam = searchParams.getAll('town');

    const filters: Filters = {
      status: searchParams.get('status') || undefined,
      category: searchParams.get('category') || undefined,
      type: searchParams.get('type') || undefined,
      priority: searchParams.get('priority') || undefined,
      visitLocation: visitLocationParam.length
        ? visitLocationParam.flatMap((v) => v.split(',')).filter(Boolean)
        : undefined,
      town: townParam.length
        ? townParam.flatMap((v) => v.split(',')).filter(Boolean)
        : undefined,
      dateRange: searchParams.get('dateRange') || undefined,
      interested: searchParams.get('interested') || undefined,
    };

    if (!filters.visitLocation?.length) delete filters.visitLocation;
    if (!filters.town?.length) delete filters.town;

    // Run auto-reject for expired licitaciones (fire in background, don't block response)
    licitacionesService.autoRejectExpired().catch((err) =>
      console.error('Auto-reject failed:', err)
    );

    const licitaciones = await licitacionesService.getAllLicitaciones(filters);
    return NextResponse.json({ success: true, data: licitaciones });
  } catch (error) {
    console.error('Error fetching licitaciones:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
