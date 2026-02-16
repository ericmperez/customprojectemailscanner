import { NextRequest, NextResponse } from 'next/server';
import { getOrgDbId, getUserName } from '@/lib/auth';
import LicitacionesService from '@/lib/services/licitaciones.service';
import { logActivity } from '@/lib/services/supabase.service';

const licitacionesService = new LicitacionesService();

const VALID_DECISION_STATUSES = ['researching', 'interested', 'bid-submitted', 'won', 'lost'];

const EDITABLE_STRING_FIELDS = [
  'title',
  'location',
  'description',
  'contactName',
  'contactPhone',
  'siteVisitDate',
  'biddingCloseDate',
  'estimatedValue',
] as const;

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
    const body = await request.json().catch(() => ({}));
    const fields: Record<string, unknown> = {};

    if (typeof body.interested === 'boolean') {
      fields.interested = body.interested;
    }

    if (body.visitAttendance !== undefined) {
      if (body.visitAttendance !== null && body.visitAttendance !== 'attending' && body.visitAttendance !== 'skipped') {
        return NextResponse.json(
          { success: false, error: 'Invalid visitAttendance. Must be "attending", "skipped", or null' },
          { status: 400 }
        );
      }
      fields.visitAttendance = body.visitAttendance;
    }

    if (typeof body.decisionStatus === 'string') {
      if (!VALID_DECISION_STATUSES.includes(body.decisionStatus)) {
        return NextResponse.json(
          { success: false, error: `Invalid decisionStatus. Must be one of: ${VALID_DECISION_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      fields.decisionStatus = body.decisionStatus;
    }

    // Accept editable string fields
    for (const field of EDITABLE_STRING_FIELDS) {
      if (typeof body[field] === 'string') {
        fields[field] = body[field];
      }
    }

    if (Object.keys(fields).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const orgId = await getOrgDbId();
    const { updated: licitacion, oldValues } = await licitacionesService.updateFields(orgId, id, fields);

    const userName = await getUserName();
    logActivity(orgId, 'edit_field', id, licitacion?.title ?? null, userName, {
      fields: Object.keys(fields),
      oldValues,
      newValues: fields,
    });

    return NextResponse.json({ success: true, data: licitacion, oldValues });
  } catch (error) {
    console.error(`Error updating fields for licitacion ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
