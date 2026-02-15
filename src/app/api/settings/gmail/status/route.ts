import { NextResponse } from 'next/server';
import { getOrgDbId } from '@/lib/auth';
import { getOrgGmailCredentials } from '@/lib/services/supabase.service';

export async function GET() {
  try {
    const orgId = await getOrgDbId();
    const creds = await getOrgGmailCredentials(orgId);

    if (!creds) {
      return NextResponse.json({
        success: true,
        data: { connected: false, emailAddress: null },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        emailAddress: creds.email_address,
        tokenExpiry: creds.token_expiry,
      },
    });
  } catch (error) {
    console.error('Error checking Gmail status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check Gmail status' },
      { status: 500 }
    );
  }
}
