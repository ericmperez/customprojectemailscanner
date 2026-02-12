import { google, gmail_v1 } from 'googleapis';
import { withRetry } from '@/lib/utils/retry';

const config = {
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    redirectUri: process.env.GMAIL_REDIRECT_URI,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  },
};

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
  attachments: EmailAttachment[];
}

class GmailService {
  private oauth2Client;
  private gmail;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      config.gmail.clientId,
      config.gmail.clientSecret,
      config.gmail.redirectUri
    );

    this.oauth2Client.setCredentials({
      refresh_token: config.gmail.refreshToken,
    });

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
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

    return {
      id: messageId,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      date: getHeader('Date'),
      attachments,
    };
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
}

export default GmailService;
