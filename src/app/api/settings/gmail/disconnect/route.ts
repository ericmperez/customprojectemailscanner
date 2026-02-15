import { NextResponse } from 'next/server';
import { getOrgDbId } from '@/lib/auth';
import { deactivateOrgGmailCredentials } from '@/lib/services/supabase.service';

export async function DELETE() {
  try {
    const orgId = await getOrgDbId();
    await deactivateOrgGmailCredentials(orgId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Gmail:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to disconnect Gmail' },
      { status: 500 }
    );
  }
}
