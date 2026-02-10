import { NextRequest, NextResponse } from 'next/server';
import LicitacionesService from '@/lib/services/licitaciones.service';

const licitacionesService = new LicitacionesService();

const VALID_DECISION_STATUSES = ['researching', 'interested', 'bid-submitted', 'won', 'lost'];

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
    const fields: { interested?: boolean; decisionStatus?: string } = {};

    if (typeof body.interested === 'boolean') {
      fields.interested = body.interested;
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

    if (Object.keys(fields).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const licitacion = await licitacionesService.updateFields(numId, fields);
    return NextResponse.json({ success: true, data: licitacion });
  } catch (error) {
    console.error(`Error updating fields for licitación ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
