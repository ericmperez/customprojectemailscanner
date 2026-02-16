import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { PriceResult, QuoteItem } from '@/lib/types';

export const maxDuration = 30;

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const items: QuoteItem[] = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Items array is required' },
        { status: 400 }
      );
    }

    // Build a concise item list for the search prompt
    const itemList = items
      .map((it, i) => `${i + 1}. ${it.item} — qty: ${it.qty} ${it.unit}`)
      .join('\n');

    const response = await getOpenAI().responses.create({
      model: 'gpt-4o',
      tools: [{ type: 'web_search' as const }],
      instructions: `You are a procurement price research assistant for Puerto Rico government bids.

Given a list of items with quantities, search the web IN ENGLISH and find a real market price for EACH item.

SEARCH IN ENGLISH on US and Puerto Rico websites. PRIORITIZE these sources:
1. Major US distributors that ship to Puerto Rico (Grainger, Home Depot, HD Supply, Lowe's, Amazon, Uline, Ferguson, MSC Industrial)
2. Puerto Rico suppliers and distributors
3. Government procurement databases (GSA Advantage, GSA schedules)
4. Manufacturer websites with MSRP

RESPOND ONLY with a JSON array with one object per item, in the same order as the input list:
[
  {
    "item": "item name from the list",
    "qty": <quantity from list>,
    "unit": "unit from list",
    "price": "$X,XXX.XX per <unit>",
    "sourceUrl": "https://actual-url-found",
    "sourceName": "Name of the supplier/website",
    "notes": "brief relevance note"
  }
]

IMPORTANT:
- Search in ENGLISH — items are already translated
- Find a price for EVERY item in the list — do not skip any
- Use REAL prices from REAL US/PR websites found via web search
- Include the actual product page URL where the price was found
- Price should be per-unit cost in USD (not total), include the unit
- If an exact item isn't found, find the closest equivalent and note it
- Keep notes brief (under 60 chars)`,
      input: itemList,
    });

    const outputText = response.output_text;
    let results: PriceResult[] = [];

    try {
      const jsonMatch = outputText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          results = parsed.map((r: Record<string, unknown>) => ({
            item: String(r.item || ''),
            qty: Number(r.qty) || 1,
            unit: String(r.unit || 'units'),
            price: String(r.price || ''),
            sourceUrl: String(r.sourceUrl || ''),
            sourceName: String(r.sourceName || ''),
            notes: String(r.notes || ''),
          }));
        }
      }
    } catch {
      // Fallback: try to extract price-like patterns from plain text
      const lines = outputText.split('\n').filter((l: string) => l.includes('$'));
      results = lines.slice(0, items.length).map((line: string, i: number) => {
        const priceMatch = line.match(/\$[\d,.]+/);
        const urlMatch = line.match(/https?:\/\/[^\s)]+/);
        return {
          item: items[i]?.item || line.trim().slice(0, 100),
          qty: items[i]?.qty || 1,
          unit: items[i]?.unit || 'units',
          price: priceMatch ? priceMatch[0] : 'Price not found',
          sourceUrl: urlMatch ? urlMatch[0] : '',
          sourceName: 'Web search',
          notes: 'Extracted from search results',
        };
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        searchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error searching prices:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search prices' },
      { status: 500 }
    );
  }
}
