import { NextResponse } from 'next/server';
import { getOrgDbId, getUserName } from '@/lib/auth';
import { getOrgDocuments, uploadOrgDocument } from '@/lib/services/supabase.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function GET() {
  try {
    const orgId = await getOrgDbId();
    const documents = await getOrgDocuments(orgId);
    return NextResponse.json({ success: true, data: documents });
  } catch (error) {
    console.error('Error fetching org documents:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const orgId = await getOrgDbId();
    const userName = await getUserName();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const label = (formData.get('label') as string)?.trim();

    if (!file || !label) {
      return NextResponse.json(
        { success: false, error: 'Se requiere archivo y etiqueta' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'El archivo excede el limite de 10 MB' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const doc = await uploadOrgDocument(
      orgId,
      label,
      file.name,
      buffer,
      file.type || 'application/octet-stream',
      userName
    );

    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    console.error('Error uploading org document:', error);
    return NextResponse.json(
      { success: false, error: 'Error al subir el documento' },
      { status: 500 }
    );
  }
}
