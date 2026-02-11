import { NextResponse } from 'next/server';
import { getAISettings, saveAIInstructions, saveAIExamples } from '@/lib/services/supabase.service';
import type { CorrectionExample } from '@/lib/types';

const MAX_INSTRUCTIONS_LENGTH = 2000;
const MAX_EXAMPLES = 20;

export async function GET() {
  try {
    const settings = await getAISettings();
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching AI settings:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    if (typeof body.instructions === 'string') {
      if (body.instructions.length > MAX_INSTRUCTIONS_LENGTH) {
        return NextResponse.json(
          { success: false, error: `Instructions must be ${MAX_INSTRUCTIONS_LENGTH} characters or less` },
          { status: 400 }
        );
      }
      await saveAIInstructions(body.instructions);
    }

    if (Array.isArray(body.examples)) {
      if (body.examples.length > MAX_EXAMPLES) {
        return NextResponse.json(
          { success: false, error: `Maximum ${MAX_EXAMPLES} examples allowed` },
          { status: 400 }
        );
      }
      // Validate each example has required fields
      for (const ex of body.examples as CorrectionExample[]) {
        if (!ex.field || !ex.original || !ex.corrected || !ex.savedAt) {
          return NextResponse.json(
            { success: false, error: 'Each example must have field, original, corrected, and savedAt' },
            { status: 400 }
          );
        }
      }
      await saveAIExamples(body.examples);
    }

    const updated = await getAISettings();
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error saving AI settings:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
