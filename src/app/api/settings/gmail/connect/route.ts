import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getOrgDbId } from '@/lib/auth';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
];

export async function GET() {
  try {
    const orgId = await getOrgDbId();

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/settings/gmail/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { success: false, error: 'Google OAuth not configured' },
        { status: 500 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state: orgId, // Pass orgId through state param for callback
    });

    return NextResponse.json({ success: true, data: { authUrl } });
  } catch (error) {
    console.error('Error initiating Gmail OAuth:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initiate Gmail connection' },
      { status: 500 }
    );
  }
}
