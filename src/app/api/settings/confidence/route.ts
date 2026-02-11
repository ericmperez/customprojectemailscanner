import { NextResponse } from 'next/server';
import { CONFIDENCE_FIELDS } from '@/lib/types';
import type { ConfidenceFieldSettings, ConfidenceFieldName } from '@/lib/types';
import { getConfidenceSettings, saveConfidenceSettings } from '@/lib/services/supabase.service';

export async function GET() {
  try {
    const settings = await getConfidenceSettings();
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching confidence settings:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as ConfidenceFieldSettings;

    // Validate: every field must appear exactly once across all 3 lists
    const allFields = [...body.critical, ...body.optional, ...body.ignored];
    const fieldSet = new Set(allFields);

    if (allFields.length !== CONFIDENCE_FIELDS.length || fieldSet.size !== CONFIDENCE_FIELDS.length) {
      return NextResponse.json(
        { success: false, error: 'Every field must appear exactly once across critical, optional, and ignored' },
        { status: 400 }
      );
    }

    for (const field of CONFIDENCE_FIELDS) {
      if (!fieldSet.has(field)) {
        return NextResponse.json(
          { success: false, error: `Missing field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate: only known field names
    for (const field of allFields) {
      if (!(CONFIDENCE_FIELDS as readonly string[]).includes(field)) {
        return NextResponse.json(
          { success: false, error: `Unknown field: ${field}` },
          { status: 400 }
        );
      }
    }

    const settings: ConfidenceFieldSettings = {
      critical: body.critical as ConfidenceFieldName[],
      optional: body.optional as ConfidenceFieldName[],
      ignored: body.ignored as ConfidenceFieldName[],
    };

    await saveConfidenceSettings(settings);
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error saving confidence settings:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
