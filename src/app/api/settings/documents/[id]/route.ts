import { NextResponse } from 'next/server';
import { getOrgDbId } from '@/lib/auth';
import { deleteOrgDocument } from '@/lib/services/supabase.service';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getOrgDbId();
    const { id } = await params;
    await deleteOrgDocument(orgId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting org document:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar el documento' },
      { status: 500 }
    );
  }
}
