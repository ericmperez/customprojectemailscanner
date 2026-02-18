import { NextRequest, NextResponse } from 'next/server';
import { getOrgDbId } from '@/lib/auth';
import {
  getCotizacionItems,
  addCotizacionItem,
  bulkInsertCotizacionItems,
  updateCotizacionItem,
  deleteCotizacionItem,
  deleteAllCotizacionItems,
} from '@/lib/services/supabase.service';

/**
 * GET — Fetch all cotizacion items for a licitacion.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const orgId = await getOrgDbId();
    const items = await getCotizacionItems(orgId, id);
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error(`Error fetching cotizacion items for ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST — Add item(s).
 * Single: { item_name, qty?, unit?, ... }
 * Bulk:   { items: [...], replace?: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const orgId = await getOrgDbId();
    const body = await request.json();

    // Bulk insert
    if (Array.isArray(body.items)) {
      if (body.replace) {
        await deleteAllCotizacionItems(orgId, id);
      }
      const items = await bulkInsertCotizacionItems(orgId, id, body.items);
      return NextResponse.json({ success: true, data: items });
    }

    // Single insert
    const itemName = typeof body.item_name === 'string' ? body.item_name.trim() : '';
    if (!itemName) {
      return NextResponse.json(
        { success: false, error: 'item_name is required' },
        { status: 400 }
      );
    }

    const item = await addCotizacionItem(orgId, id, {
      item_name: itemName,
      qty: body.qty,
      unit: body.unit,
      unit_price: body.unit_price,
      shipping: body.shipping,
      markup_pct: body.markup_pct,
      tax_pct: body.tax_pct,
      notes: body.notes,
    });
    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error(`Error adding cotizacion item for ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH — Update a single cotizacion item.
 * Body: { itemId, ...fields }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const orgId = await getOrgDbId();
    const body = await request.json();

    const { itemId, ...fields } = body;
    if (!itemId) {
      return NextResponse.json(
        { success: false, error: 'itemId is required' },
        { status: 400 }
      );
    }

    const item = await updateCotizacionItem(orgId, itemId, fields);
    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error(`Error updating cotizacion item for ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE — Remove a single cotizacion item.
 * Body: { itemId }
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

    await deleteCotizacionItem(orgId, itemId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error deleting cotizacion item:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
