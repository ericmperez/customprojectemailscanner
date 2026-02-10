import { NextRequest, NextResponse } from 'next/server';
import LicitacionesService from '@/lib/services/licitaciones.service';

const licitacionesService = new LicitacionesService();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId) || numId < 1) {
    return NextResponse.json(
      { success: false, error: 'ID must be a positive integer' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const notes = typeof body.notes === 'string' ? body.notes.slice(0, 5000) : '';

    const licitacion = await licitacionesService.updateApprovalStatus(numId, 'approved', notes);
    return NextResponse.json({ success: true, data: licitacion });
  } catch (error) {
    console.error(`Error approving licitación ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
