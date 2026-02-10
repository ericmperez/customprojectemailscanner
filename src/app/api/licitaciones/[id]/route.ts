import { NextRequest, NextResponse } from 'next/server';
import LicitacionesService from '@/lib/services/licitaciones.service';

const licitacionesService = new LicitacionesService();

export async function GET(
  _request: NextRequest,
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
    const licitacion = await licitacionesService.getLicitacionById(numId);
    return NextResponse.json({ success: true, data: licitacion });
  } catch (error) {
    console.error(`Error fetching licitación ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
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
    const result = await licitacionesService.deleteLicitacion(numId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error(`Error deleting licitación ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
