import { NextRequest, NextResponse } from 'next/server';
import { getOrgDbId, getUserName } from '@/lib/auth';
import {
  getLicitacionAttachments,
  uploadLicitacionAttachment,
  logActivity,
} from '@/lib/services/supabase.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * GET — List attachments for a licitacion.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const orgId = await getOrgDbId();
    const attachments = await getLicitacionAttachments(orgId, id);
    return NextResponse.json({ success: true, data: attachments });
  } catch (error) {
    console.error(`Error fetching attachments for ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST — Upload a new attachment (FormData: file + label).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const orgId = await getOrgDbId();
    const userName = await getUserName();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const label = (formData.get('label') as string)?.trim() || '';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'file is required' },
        { status: 400 }
      );
    }

    if (!label) {
      return NextResponse.json(
        { success: false, error: 'label is required' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'El archivo excede el límite de 10 MB' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const attachment = await uploadLicitacionAttachment(
      orgId,
      id,
      label,
      file.name,
      buffer,
      file.type || 'application/octet-stream',
      userName
    );

    // Log activity (fire-and-forget)
    logActivity(orgId, 'attachment_upload', id, null, userName, {
      filename: file.name,
      label,
    });

    return NextResponse.json({ success: true, data: attachment });
  } catch (error) {
    console.error(`Error uploading attachment for ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
