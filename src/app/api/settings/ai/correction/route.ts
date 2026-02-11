import { NextResponse } from 'next/server';
import { getAISettings, saveAIExamples } from '@/lib/services/supabase.service';
import type { CorrectionExample } from '@/lib/types';

const MAX_EXAMPLES = 20;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.field || typeof body.field !== 'string') {
      return NextResponse.json(
        { success: false, error: 'field is required' },
        { status: 400 }
      );
    }
    if (!body.original || typeof body.original !== 'string') {
      return NextResponse.json(
        { success: false, error: 'original is required' },
        { status: 400 }
      );
    }
    if (!body.corrected || typeof body.corrected !== 'string') {
      return NextResponse.json(
        { success: false, error: 'corrected is required' },
        { status: 400 }
      );
    }

    const newExample: CorrectionExample = {
      field: body.field,
      original: body.original,
      corrected: body.corrected,
      context: body.context || undefined,
      savedAt: new Date().toISOString(),
    };

    const { examples } = await getAISettings();

    // Append new example, trim to max (FIFO — oldest removed)
    const updated = [...examples, newExample];
    if (updated.length > MAX_EXAMPLES) {
      updated.splice(0, updated.length - MAX_EXAMPLES);
    }

    await saveAIExamples(updated);
    return NextResponse.json({ success: true, data: { examples: updated } });
  } catch (error) {
    console.error('Error saving correction example:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
