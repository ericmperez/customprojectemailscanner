import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import LicitacionesService from '@/lib/services/licitaciones.service';
import type { PriceResult } from '@/lib/types';

export const maxDuration = 30;

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
  const numId = parseInt(id, 10);
  if (isNaN(numId) || numId < 1) {
    return NextResponse.json(
      { success: false, error: 'ID must be a positive integer' },
      { status: 400 }
    );
  }

  try {
    const lic = await licitacionesService.getLicitacionById(numId);
    if (!lic) {
      return NextResponse.json(
        { success: false, error: 'Licitacion not found' },
        { status: 404 }
      );
    }

    const description = (lic.description || '').slice(0, 2000);
    if (!description || description === 'No disponible') {
      return NextResponse.json(
        { success: false, error: 'No description available for price search' },
        { status: 400 }
      );
    }

    const query = `${lic.title || lic.subject || ''} - ${description}`.slice(0, 2500);

    const response = await getOpenAI().responses.create({
      model: 'gpt-4o',
      tools: [{ type: 'web_search' as const }],
      instructions: `You are a procurement price research assistant for Puerto Rico government licitaciones (bids).

Given the description of items/materials/services from a licitación, search the web and find exactly 3 real market prices for the most important items mentioned.

PRIORITIZE these sources:
1. Puerto Rico / Caribbean suppliers and distributors
2. Government procurement databases (GSA, PR government)
3. Major US distributors (Grainger, Home Depot Pro, HD Supply, Amazon Business, Uline)
4. Manufacturer websites with MSRP

RESPOND ONLY with a JSON array of exactly 3 objects with this structure:
[
  {
    "item": "specific item name",
    "price": "$X,XXX.XX (include units like per unit, per box, per sqft)",
    "sourceUrl": "https://actual-url-found",
    "sourceName": "Name of the supplier/website",
    "notes": "brief relevance note (e.g. 'Closest match for PR market')"
  }
]

IMPORTANT:
- Use REAL prices from REAL websites found via web search
- Include the actual source URL where the price was found
- If exact items aren't found, find the closest equivalent
- Prices should include units (per unit, per gallon, per sqft, etc.)
- Keep notes brief (under 60 chars)`,
      input: query,
    });

    const outputText = response.output_text;
    let results: PriceResult[] = [];

    // Try to parse JSON from the response
    try {
      // Extract JSON array from response (may be wrapped in markdown code blocks)
      const jsonMatch = outputText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          results = parsed.map((r: Record<string, unknown>) => ({
            item: String(r.item || ''),
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
      results = lines.slice(0, 3).map((line: string) => {
        const priceMatch = line.match(/\$[\d,.]+/);
        const urlMatch = line.match(/https?:\/\/[^\s)]+/);
        return {
          item: line.replace(/\$[\d,.]+/, '').replace(/https?:\/\/[^\s)]+/, '').trim().slice(0, 100),
          price: priceMatch ? priceMatch[0] : 'Price not parsed',
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
        query: (lic.title || lic.subject || '').slice(0, 200),
        searchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(`Error searching prices for licitación ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to search prices' },
      { status: 500 }
    );
  }
}
