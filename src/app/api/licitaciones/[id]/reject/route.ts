import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import LicitacionesService from '@/lib/services/licitaciones.service';
import { formatNoteWithAttribution } from '@/lib/utils/notes';

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
    const user = await currentUser();
    const userName =
      [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Usuario';

    const body = await request.json().catch(() => ({}));
    const rawNotes = typeof body.notes === 'string' ? body.notes.slice(0, 5000) : '';
    const notes = formatNoteWithAttribution(rawNotes || 'Rechazada', userName);

    const licitacion = await licitacionesService.updateApprovalStatus(numId, 'rejected', notes);
    return NextResponse.json({ success: true, data: licitacion });
  } catch (error) {
    console.error(`Error rejecting licitación ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
