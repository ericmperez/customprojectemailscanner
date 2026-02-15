import { NextRequest, NextResponse } from 'next/server';
import LicitacionesService from '@/lib/services/licitaciones.service';
import { getOrgDbId } from '@/lib/auth';
import type { Filters } from '@/lib/types';

const licitacionesService = new LicitacionesService();

export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgDbId();
    const { searchParams } = request.nextUrl;

    const visitLocationParam = searchParams.getAll('visitLocation');
    const townParam = searchParams.getAll('town');

    const filters: Filters = {
      status: searchParams.get('status') || undefined,
      category: searchParams.get('category') || undefined,
      priority: searchParams.get('priority') || undefined,
      visitLocation: visitLocationParam.length
        ? visitLocationParam.flatMap((v) => v.split(',')).filter(Boolean)
        : undefined,
      town: townParam.length
        ? townParam.flatMap((v) => v.split(',')).filter(Boolean)
        : undefined,
      dateRange: searchParams.get('dateRange') || undefined,
    };

    if (!filters.visitLocation?.length) delete filters.visitLocation;
    if (!filters.town?.length) delete filters.town;

    const visits = await licitacionesService.getSiteVisitEvents(orgId, filters);
    return NextResponse.json({ success: true, data: visits });
  } catch (error) {
    console.error('Error fetching site visit events:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
