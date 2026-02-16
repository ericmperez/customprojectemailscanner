import { google, gmail_v1 } from 'googleapis';
import { withRetry } from '@/lib/utils/retry';
import { encrypt, decrypt } from '@/lib/utils/encryption';
import {
  getOrgGmailCredentials,
  saveOrgGmailCredentials,
} from '@/lib/services/supabase.service';

export interface GmailCredentials {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry?: Date;
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  base64Data: string; // standard base64 (not URL-safe)
  size: number;
}

export interface EmailDetails {
  id: string;
  subject: string;
  from: string;
  date: string;
  bodyText: string;
  attachments: EmailAttachment[];
}

class GmailService {
  private oauth2Client;
  private gmail;
  private orgId: string | null;

  /**
   * Create a GmailService with explicit credentials.
   * If no credentials provided, falls back to env vars (legacy single-tenant mode).
   */
  constructor(credentials?: GmailCredentials, orgId?: string) {
    const clientId = credentials?.clientId || process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GMAIL_CLIENT_ID;
    const clientSecret = credentials?.clientSecret || process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = process.env.GMAIL_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/settings/gmail/callback`;

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    if (credentials) {
      this.oauth2Client.setCredentials({
        access_token: credentials.accessToken,
        refresh_token: credentials.refreshToken,
        expiry_date: credentials.tokenExpiry?.getTime(),
      });
    } else {
      // Legacy: use env var refresh token
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      });
    }

    // Listen for token refresh events to persist new tokens
    this.orgId = orgId || null;
    if (orgId) {
      this.oauth2Client.on('tokens', (tokens) => {
        this.handleTokenRefresh(orgId, tokens).catch((err) =>
          console.error('[gmail] Failed to persist refreshed token:', err)
        );
      });
    }

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  /**
   * Persist refreshed tokens back to DB.
   */
  private async handleTokenRefresh(
    orgId: string,
    tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null }
  ): Promise<void> {
    if (!tokens.access_token) return;

    const creds = await getOrgGmailCredentials(orgId);
    if (!creds) return;

    const accessTokenEnc = encrypt(tokens.access_token);
    const refreshTokenEnc = tokens.refresh_token
      ? encrypt(tokens.refresh_token)
      : creds.refresh_token_enc || '';
    const tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : new Date();

    await saveOrgGmailCredentials(
      orgId,
      creds.email_address || '',
      accessTokenEnc,
      refreshTokenEnc,
      tokenExpiry,
      creds.scopes || []
    );
  }

  /**
   * Search Gmail for licitacion emails with PDF attachments.
   * Paginates through all results using nextPageToken.
   */
  async searchLicitacionEmails(afterDate?: Date): Promise<string[]> {
    let query = '(subject:(Licitación OR Licitacion OR Subasta OR Invitación OR Invitacion OR Cotización OR Cotizacion OR Propuesta OR Pliego OR Notificación OR Notificacion OR Pet.Oferta) OR from:acueductos OR from:juntadesubastas OR from:gobierno.pr OR filename:BID) has:attachment filename:pdf';

    if (afterDate) {
      const yyyy = afterDate.getFullYear();
      const mm = String(afterDate.getMonth() + 1).padStart(2, '0');
      const dd = String(afterDate.getDate()).padStart(2, '0');
      query += ` after:${yyyy}/${mm}/${dd}`;
    }

    const messageIds: string[] = [];
    let pageToken: string | undefined;

    do {
      const response = await withRetry(
        () =>
          this.gmail.users.messages.list({
            userId: 'me',
            q: query,
            pageToken,
            maxResults: 100,
          }),
        { maxRetries: 2 }
      );

      const messages = response.data.messages || [];
      for (const msg of messages) {
        if (msg.id) messageIds.push(msg.id);
      }

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return messageIds;
  }

  /**
   * Fetch full message details and extract PDF attachments.
   */
  async getEmailDetails(messageId: string): Promise<EmailDetails> {
    const response = await withRetry(
      () =>
        this.gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full',
        }),
      { maxRetries: 2 }
    );

    const message = response.data;
    const headers = message.payload?.headers || [];

    const getHeader = (name: string): string => {
      const header = headers.find(
        (h) => h.name?.toLowerCase() === name.toLowerCase()
      );
      return header?.value || '';
    };

    const attachments = await this.extractAttachments(message);
    const bodyText = this.extractBodyText(message);

    return {
      id: messageId,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      date: getHeader('Date'),
      bodyText,
      attachments,
    };
  }

  /**
   * Extract the plain-text or HTML body from a message's MIME parts.
   * Prefers text/plain; falls back to text/html with tags stripped.
   */
  private extractBodyText(message: gmail_v1.Schema$Message): string {
    let plainText = '';
    let htmlText = '';

    const walkParts = (parts: unknown[]) => {
      for (const part of parts) {
        const p = part as {
          mimeType?: string;
          body?: { data?: string };
          parts?: unknown[];
        };
        if (p.parts) walkParts(p.parts);
        if (p.body?.data) {
          const decoded = Buffer.from(p.body.data, 'base64').toString('utf-8');
          if (p.mimeType === 'text/plain' && !plainText) plainText = decoded;
          if (p.mimeType === 'text/html' && !htmlText) htmlText = decoded;
        }
      }
    };

    // Check top-level body first (simple messages without parts)
    const payload = message.payload;
    if (payload?.body?.data) {
      const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      if (payload.mimeType === 'text/plain') plainText = decoded;
      if (payload.mimeType === 'text/html') htmlText = decoded;
    }
    if (payload?.parts) walkParts(payload.parts);

    if (plainText) return plainText;
    // Strip HTML tags as fallback
    if (htmlText) return htmlText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return '';
  }

  /**
   * Recursively walk MIME parts to find PDF attachments,
   * then fetch their data via the attachments API.
   */
  private async extractAttachments(
    message: gmail_v1.Schema$Message
  ): Promise<EmailAttachment[]> {
    const attachments: EmailAttachment[] = [];

    const walkParts = (parts: unknown[]) => {
      for (const part of parts) {
        const p = part as {
          mimeType?: string;
          filename?: string;
          body?: { attachmentId?: string; size?: number; data?: string };
          parts?: unknown[];
        };

        if (p.parts) {
          walkParts(p.parts);
        }

        if (
          p.mimeType === 'application/pdf' &&
          p.filename &&
          p.body?.attachmentId
        ) {
          attachments.push({
            filename: p.filename,
            mimeType: p.mimeType,
            base64Data: '', // filled below
            size: p.body.size || 0,
          });
          // Store attachmentId temporarily on the object
          (attachments[attachments.length - 1] as unknown as Record<string, string>)._attachmentId =
            p.body.attachmentId;
        }
      }
    };

    if (message.payload?.parts) {
      walkParts(message.payload.parts);
    }

    // Fetch actual attachment data
    for (const att of attachments) {
      const attachmentId = (att as unknown as Record<string, string>)._attachmentId;
      if (!attachmentId || !message.id) continue;

      const attachmentResponse = await this.gmail.users.messages.attachments.get({
        userId: 'me',
        messageId: message.id,
        id: attachmentId,
      });

      const urlSafeBase64 = attachmentResponse.data.data || '';
      // Gmail returns URL-safe base64 (uses - and _), convert to standard base64
      att.base64Data = urlSafeBase64.replace(/-/g, '+').replace(/_/g, '/');
      att.size = attachmentResponse.data.size || att.size;

      // Clean up temporary property
      delete (att as unknown as Record<string, string>)._attachmentId;
    }

    return attachments;
  }

  /**
   * Mark an email as read by removing the UNREAD label.
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
  }

  /**
   * Get the OAuth2 client (for generating auth URLs, etc.)
   */
  getOAuth2Client() {
    return this.oauth2Client;
  }
}

/**
 * Factory: create a GmailService for a specific organization using stored credentials.
 */
export async function createGmailServiceForOrg(orgId: string): Promise<GmailService | null> {
  const creds = await getOrgGmailCredentials(orgId);
  if (!creds || !creds.access_token_enc || !creds.refresh_token_enc) {
    return null;
  }

  try {
    const accessToken = decrypt(creds.access_token_enc);
    const refreshToken = decrypt(creds.refresh_token_enc);

    return new GmailService(
      {
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GMAIL_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET || '',
        accessToken,
        refreshToken,
        tokenExpiry: creds.token_expiry ? new Date(creds.token_expiry) : undefined,
      },
      orgId
    );
  } catch (err) {
    console.error(`[gmail] Failed to create service for org ${orgId}:`, err);
    return null;
  }
}

export default GmailService;
