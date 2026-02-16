import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import LicitacionesService from '@/lib/services/licitaciones.service';
import { getOrgDbId } from '@/lib/auth';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const licitacionesService = new LicitacionesService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'ID is required' },
      { status: 400 }
    );
  }

  try {
    const orgId = await getOrgDbId();
    const lic = await licitacionesService.getLicitacionById(orgId, id);
    if (!lic) {
      return NextResponse.json(
        { success: false, error: 'Licitacion not found' },
        { status: 404 }
      );
    }

    const description = (lic.description || '').slice(0, 3000);
    if (!description || description === 'No disponible') {
      return NextResponse.json(
        { success: false, error: 'No description available' },
        { status: 400 }
      );
    }

    const response = await getOpenAI().responses.create({
      model: 'gpt-4o-mini',
      instructions: `You are a procurement document parser. Extract ALL items/materials/services from the licitación description with their quantities.

RESPOND ONLY with a JSON array. Each object must have:
- "item": the item/material/service name IN ENGLISH (translate from Spanish, be specific, include specs if mentioned)
- "qty": numeric quantity (use 1 if not specified)
- "unit": unit of measure in English (e.g. "units", "sqft", "gallons", "lbs", "rolls", "boxes", "cases", "ea", "lot")

Example:
[
  { "item": "White latex paint 5 gal", "qty": 10, "unit": "buckets" },
  { "item": "4-inch paint brush", "qty": 24, "unit": "units" },
  { "item": "DPD HACH 1 Powder Pillows Free Chlorine Reagent 10mL", "qty": 100, "unit": "cases" }
]

IMPORTANT:
- Extract EVERY item mentioned, do not skip any
- TRANSLATE all item names and units to English for US supplier searchability
- If a range is given (e.g. "10-15"), use the higher number
- Group identical items, sum their quantities
- If the description is vague (e.g. "servicio de limpieza"), still list it as 1 lot
- QUANTITY AND UNIT are often on the FAR RIGHT side of the text (e.g. "100 CS" at the end of a line means 100 cases). Common unit codes: CS=cases, EA=each, BX=boxes, GL=gallons, PK=packs, BG=bags, DR=drums, RL=rolls, LB=pounds, CF=cubic feet
- The number before the unit code is the quantity, NOT part of the item name`,
      input: description,
    });

    const outputText = response.output_text;
    let items: { item: string; qty: number; unit: string }[] = [];

    try {
      const jsonMatch = outputText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          items = parsed.map((r: Record<string, unknown>) => ({
            item: String(r.item || ''),
            qty: Number(r.qty) || 1,
            unit: String(r.unit || 'units'),
          }));
        }
      }
    } catch {
      return NextResponse.json(
        { success: false, error: 'Failed to parse items from description' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { items },
    });
  } catch (error) {
    console.error(`Error extracting items for licitación ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to extract items' },
      { status: 500 }
    );
  }
}
