import { NextRequest, NextResponse } from 'next/server';
import { getOrgDbId, getUserName } from '@/lib/auth';
import { deleteLicitacionAttachment, logActivity } from '@/lib/services/supabase.service';

/**
 * DELETE — Remove a licitacion attachment.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id, attachmentId } = await params;
  try {
    const orgId = await getOrgDbId();
    const userName = await getUserName();

    await deleteLicitacionAttachment(orgId, attachmentId);

    // Log activity (fire-and-forget)
    logActivity(orgId, 'attachment_delete', id, null, userName, { attachmentId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error deleting attachment ${attachmentId}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
