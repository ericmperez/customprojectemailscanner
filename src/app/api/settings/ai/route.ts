import { NextResponse } from 'next/server';
import {
  getAISettings,
  saveAIInstructions,
  saveAIExamples,
  getAllCorrectionExamples,
  deleteCorrectionExample,
  clearCorrectionExamples,
} from '@/lib/services/supabase.service';
import { getOrgDbId } from '@/lib/auth';
import type { CorrectionExample } from '@/lib/types';

const MAX_INSTRUCTIONS_LENGTH = 2000;
const MAX_EXAMPLES = 20;

export async function GET() {
  try {
    const orgId = await getOrgDbId();
    const settings = await getAISettings(orgId);

    // Also fetch from correction_examples table (new source of truth)
    let vectorExamples: { id: string; field: string; original: string; corrected: string; context: string | null; saved_at: string }[] = [];
    try {
      vectorExamples = await getAllCorrectionExamples(orgId);
    } catch {
      // Fall back to app_settings examples only
    }

    return NextResponse.json({
      success: true,
      data: {
        ...settings,
        vectorExamples,
      },
    });
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
    const orgId = await getOrgDbId();
    const body = await request.json();

    if (typeof body.instructions === 'string') {
      if (body.instructions.length > MAX_INSTRUCTIONS_LENGTH) {
        return NextResponse.json(
          { success: false, error: `Instructions must be ${MAX_INSTRUCTIONS_LENGTH} characters or less` },
          { status: 400 }
        );
      }
      await saveAIInstructions(orgId, body.instructions);
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
      await saveAIExamples(orgId, body.examples);
    }

    // Clear all correction examples (both tables)
    if (body.clearExamples === true) {
      await clearCorrectionExamples(orgId);
      await saveAIExamples(orgId, []);
    }

    // Delete a single vector correction example by UUID
    if (typeof body.deleteExampleId === 'string') {
      await deleteCorrectionExample(orgId, body.deleteExampleId);
    }

    const updated = await getAISettings(orgId);
    let vectorExamples: { id: string; field: string; original: string; corrected: string; context: string | null; saved_at: string }[] = [];
    try {
      vectorExamples = await getAllCorrectionExamples(orgId);
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true, data: { ...updated, vectorExamples } });
  } catch (error) {
    console.error('Error saving AI settings:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
