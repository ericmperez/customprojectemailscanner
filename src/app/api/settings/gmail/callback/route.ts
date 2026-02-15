import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { encrypt } from '@/lib/utils/encryption';
import { saveOrgGmailCredentials } from '@/lib/services/supabase.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get('code');
    const orgId = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return NextResponse.redirect(`${appUrl}/settings?gmail_error=${encodeURIComponent(error)}`);
    }

    if (!code || !orgId) {
      return NextResponse.json(
        { success: false, error: 'Missing authorization code or organization' },
        { status: 400 }
      );
    }

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/settings/gmail/callback`;

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return NextResponse.redirect(`${appUrl}/settings?gmail_error=no_tokens`);
    }

    // Get the user's email address
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const emailAddress = profile.data.emailAddress || '';

    // Encrypt tokens before storing
    const accessTokenEnc = encrypt(tokens.access_token);
    const refreshTokenEnc = encrypt(tokens.refresh_token);
    const tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000);
    const scopes = tokens.scope ? tokens.scope.split(' ') : [];

    // Store in DB
    await saveOrgGmailCredentials(
      orgId,
      emailAddress,
      accessTokenEnc,
      refreshTokenEnc,
      tokenExpiry,
      scopes
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${appUrl}/settings?gmail_connected=true`);
  } catch (error) {
    console.error('Error in Gmail OAuth callback:', error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${appUrl}/settings?gmail_error=callback_failed`);
  }
}
