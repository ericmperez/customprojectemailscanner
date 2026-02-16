import { NextRequest, NextResponse } from 'next/server';
import { getOrgDbId, getUserName } from '@/lib/auth';
import {
  getChecklist,
  initializeChecklist,
  toggleChecklistItem,
  addChecklistItem,
  deleteChecklistItem,
  logActivity,
} from '@/lib/services/supabase.service';

/**
 * GET — Fetch checklist items for a licitacion.
 * Auto-creates default items if none exist (lazy initialization).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const orgId = await getOrgDbId();
    let items = await getChecklist(orgId, id);

    // Lazy initialization: create default items if none exist
    if (items.length === 0) {
      items = await initializeChecklist(orgId, id);
    }

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error(`Error fetching checklist for ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH — Toggle a checklist item's completed status.
 * Body: { itemId: string, completed: boolean }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const orgId = await getOrgDbId();
    const userName = await getUserName();
    const body = await request.json();

    const { itemId, completed } = body;
    if (!itemId || typeof completed !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'itemId and completed (boolean) are required' },
        { status: 400 }
      );
    }

    const item = await toggleChecklistItem(orgId, itemId, completed, userName);

    // Log activity (fire-and-forget)
    logActivity(orgId, 'checklist_toggle', id, null, userName, {
      label: item?.label,
      completed,
    });

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error(`Error toggling checklist item for ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST — Add a new checklist item.
 * Body: { label: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const orgId = await getOrgDbId();
    const body = await request.json();

    const label = typeof body.label === 'string' ? body.label.trim() : '';
    if (!label) {
      return NextResponse.json(
        { success: false, error: 'label is required' },
        { status: 400 }
      );
    }

    const item = await addChecklistItem(orgId, id, label);
    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error(`Error adding checklist item for ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE — Remove a checklist item.
 * Body: { itemId: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: _id } = await params;
  try {
    const orgId = await getOrgDbId();
    const body = await request.json();

    const { itemId } = body;
    if (!itemId) {
      return NextResponse.json(
        { success: false, error: 'itemId is required' },
        { status: 400 }
      );
    }

    await deleteChecklistItem(orgId, itemId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error deleting checklist item:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
