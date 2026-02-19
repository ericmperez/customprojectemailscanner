import { NextRequest, NextResponse } from 'next/server';
import { getOrgDbId } from '@/lib/auth';
import { getPriceResults, deletePriceResults } from '@/lib/services/supabase.service';

/**
 * GET — Load saved price results for a licitacion.
 * Returns items + results reconstructed from DB rows, plus searchedAt timestamp.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const orgId = await getOrgDbId();
    const rows = await getPriceResults(orgId, id);

    if (rows.length === 0) {
      return NextResponse.json({ success: true, data: null });
    }

    // Reconstruct QuoteItem[] and PriceResult[] from saved rows
    const items = rows.map((r) => ({
      item: r.item_name,
      qty: Number(r.qty),
      unit: r.unit,
    }));

    const results = rows.map((r) => ({
      item: r.item_name,
      qty: Number(r.qty),
      unit: r.unit,
      price: r.unit_price || '',
      sourceUrl: r.source_url || '',
      sourceName: r.source_name || '',
      notes: r.notes || '',
    }));

    return NextResponse.json({
      success: true,
      data: {
        items,
        results,
        searchedAt: rows[0].searched_at,
      },
    });
  } catch (error) {
    console.error(`Error fetching price results for ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE — Clear saved price results for re-search.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const orgId = await getOrgDbId();
    await deletePriceResults(orgId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error deleting price results for ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
