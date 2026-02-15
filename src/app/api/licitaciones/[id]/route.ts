import { NextRequest, NextResponse } from 'next/server';
import LicitacionesService from '@/lib/services/licitaciones.service';
import { getOrgDbId } from '@/lib/auth';

const licitacionesService = new LicitacionesService();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || id.length < 1) {
    return NextResponse.json(
      { success: false, error: 'Invalid ID' },
      { status: 400 }
    );
  }

  try {
    const orgId = await getOrgDbId();
    const licitacion = await licitacionesService.getLicitacionById(orgId, id);
    return NextResponse.json({ success: true, data: licitacion });
  } catch (error) {
    console.error(`Error fetching licitacion ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || id.length < 1) {
    return NextResponse.json(
      { success: false, error: 'Invalid ID' },
      { status: 400 }
    );
  }

  try {
    const orgId = await getOrgDbId();
    const result = await licitacionesService.deleteLicitacion(orgId, id);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error(`Error deleting licitacion ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
