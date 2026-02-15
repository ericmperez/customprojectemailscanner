import { NextRequest, NextResponse } from 'next/server';
import { getOrgDbId, getUserName } from '@/lib/auth';
import LicitacionesService from '@/lib/services/licitaciones.service';
import { formatNoteWithAttribution } from '@/lib/utils/notes';
import { logActivity } from '@/lib/services/supabase.service';

const licitacionesService = new LicitacionesService();

export async function PATCH(
  request: NextRequest,
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
    const userName = await getUserName();

    const body = await request.json().catch(() => ({}));
    const rawNotes = typeof body.notes === 'string' ? body.notes.slice(0, 5000) : '';
    const notes = formatNoteWithAttribution(rawNotes || 'Rechazada', userName);

    const licitacion = await licitacionesService.updateApprovalStatus(orgId, id, 'rejected', notes);

    logActivity(orgId, 'reject', id, licitacion?.title ?? null, userName);

    return NextResponse.json({ success: true, data: licitacion });
  } catch (error) {
    console.error(`Error rejecting licitacion ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
