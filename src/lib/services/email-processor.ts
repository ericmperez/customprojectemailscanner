import GmailService from '@/lib/services/gmail.service';
import LicitacionesService from '@/lib/services/licitaciones.service';
import { extractLicitacionData } from '@/lib/services/openai.service';
import {
  isEmailProcessed,
  markEmailAsProcessed,
  uploadPdf,
  getAllProcessedEmailIds,
} from '@/lib/services/supabase.service';
import { isBiddingOpen, isMinutaOrAsistencia } from '@/lib/services/cron.utils';

const MAX_EMAILS_PER_RUN = 7;
const TIME_BUDGET_MS = 45_000;
const LOOKBACK_DAYS = 90;

export interface ProcessingStats {
  emailsFound: number;
  alreadyProcessed: number;
  processed: number;
  skippedClosed: number;
  skippedMinuta: number;
  skippedNoAttachments: number;
  errors: number;
  details: string[];
}

/**
 * Core email processing logic shared between cron and manual triggers.
 * @param orgId - The organization ID to process for
 * @param startTime - The start timestamp for time budgeting
 * @param maxEmails - 0 means no limit (process all found emails)
 * @param gmailService - Optional pre-created GmailService; if not provided, creates one from env vars
 */
export async function processNewEmails(
  orgId: string,
  startTime: number,
  maxEmails: number = MAX_EMAILS_PER_RUN,
  gmailService?: GmailService
): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    emailsFound: 0,
    alreadyProcessed: 0,
    processed: 0,
    skippedClosed: 0,
    skippedMinuta: 0,
    skippedNoAttachments: 0,
    errors: 0,
    details: [],
  };

  // 1. Search Gmail for licitacion emails
  const afterDate = new Date();
  afterDate.setDate(afterDate.getDate() - LOOKBACK_DAYS);

  const gmail = gmailService || new GmailService();
  const messageIds = await gmail.searchLicitacionEmails(afterDate);
  stats.emailsFound = messageIds.length;
  console.log(`[fetch] Found ${messageIds.length} licitacion emails`);

  if (messageIds.length === 0) return stats;

  // 2. Pre-fetch all processed email IDs for O(1) dedup
  const processedIds = new Set(await getAllProcessedEmailIds(orgId));

  // 3. Filter out already-processed emails
  const newMessageIds = messageIds.filter((id) => !processedIds.has(id));
  stats.alreadyProcessed = messageIds.length - newMessageIds.length;
  console.log(
    `[fetch] ${newMessageIds.length} new emails (${stats.alreadyProcessed} already processed)`
  );

  // 4. Process emails (limited for cron, unlimited for manual)
  const batch = maxEmails > 0 ? newMessageIds.slice(0, maxEmails) : newMessageIds;
  const licitacionesService = new LicitacionesService();

  for (const messageId of batch) {
    // Time-budget check
    if (Date.now() - startTime > TIME_BUDGET_MS) {
      console.log(`[fetch] Time budget exceeded (${TIME_BUDGET_MS}ms), stopping early`);
      stats.details.push(`⏱️ Stopped early: time budget exceeded`);
      break;
    }

    try {
      // Double-check dedup (handles race conditions)
      const alreadyDone = await isEmailProcessed(orgId, messageId);
      if (alreadyDone) {
        stats.alreadyProcessed++;
        continue;
      }

      // Fetch email details + attachments
      console.log(`[fetch] Processing email: ${messageId}`);
      const email = await gmail.getEmailDetails(messageId);

      // Filter to PDF attachments, skip minutas
      const pdfAttachments = email.attachments.filter((att) => {
        if (isMinutaOrAsistencia(att.filename)) {
          stats.skippedMinuta++;
          console.log(`[fetch] Skipping minuta/asistencia: ${att.filename}`);
          return false;
        }
        return true;
      });

      if (pdfAttachments.length === 0) {
        stats.skippedNoAttachments++;
        console.log(`[fetch] No valid PDF attachments for: ${email.subject}`);
        continue;
      }

      // Process the first valid PDF attachment
      const pdf = pdfAttachments[0];
      console.log(`[fetch] Extracting data from: ${pdf.filename}`);

      // Send PDF to GPT-4o (pass orgId for per-org AI settings)
      const extracted = await extractLicitacionData(pdf.base64Data, pdf.filename, messageId, orgId);
      console.log(
        `[fetch] Extracted: ${extracted.title} | Location: ${extracted.location} | Confidence: ${extracted.confidence}%`
      );

      // Check if bidding is still open
      if (!isBiddingOpen(extracted.biddingCloseDate)) {
        stats.skippedClosed++;
        console.log(
          `[fetch] Skipping closed bidding: ${extracted.biddingCloseDate} - ${email.subject}`
        );
        await markEmailAsProcessed(orgId, {
          email_id: messageId,
          subject: email.subject,
          location: extracted.location,
          description: `[Skipped - bidding closed ${extracted.biddingCloseDate}]`,
          pdf_filename: pdf.filename,
        });
        continue;
      }

      // Upload PDF to Supabase Storage (org-isolated path)
      const { publicUrl } = await uploadPdf(orgId, pdf.base64Data, pdf.filename, messageId);
      console.log(`[fetch] PDF uploaded: ${publicUrl}`);

      // Use email subject as title fallback when GPT-4o returns a generic/unhelpful title
      const genericTitles = [
        'certificación de recibo de pliegos',
        'no disponible',
        'certificacion de recibo de pliegos',
      ];
      const resolvedTitle =
        extracted.title && !genericTitles.includes(extracted.title.toLowerCase())
          ? extracted.title
          : email.subject
              .replace(/^\[.*?\]\s*/, '')
              .replace(/^(INVITACION-|INVITACIÓN-)/i, '')
              .trim();

      // Upsert to Supabase licitaciones table
      const licitacionData: Record<string, unknown> = {
        processedAt: new Date().toISOString(),
        emailDate: email.date,
        subject: email.subject,
        title: resolvedTitle,
        location: extracted.location,
        description: extracted.description,
        summary: extracted.summary,
        category: extracted.category,
        priority: extracted.priority,
        pdfFilename: pdf.filename,
        pdfUrl: publicUrl,
        siteVisitDate: extracted.siteVisitDate,
        siteVisitTime: extracted.siteVisitTime,
        visitLocation: extracted.visitLocation,
        visitRequirements: extracted.visitRequirements,
        contactName: extracted.contactName,
        contactPhone: extracted.contactPhone,
        biddingCloseDate: extracted.biddingCloseDate,
        biddingCloseTime: extracted.biddingCloseTime,
        estimatedValue: extracted.estimatedValue || 'No disponible',
        extractionMethod: `GPT-4o (${extracted.confidence}%)`,
        emailId: messageId,
        approvalStatus: 'pending',
        interested: false,
        isEmergency: /emergencia/i.test(email.subject),
        decisionStatus: 'researching',
      };

      const result = await licitacionesService.saveLicitacion(orgId, licitacionData);
      console.log(`[fetch] Saved to Supabase: ${result.id}`);

      // Mark as processed in Supabase
      await markEmailAsProcessed(orgId, {
        email_id: messageId,
        subject: email.subject,
        location: extracted.location,
        description: extracted.description,
        pdf_filename: pdf.filename,
      });

      // Mark email as read in Gmail
      await gmail.markAsRead(messageId);

      stats.processed++;
      stats.details.push(
        `✓ ${email.subject} → ${extracted.location} (${extracted.confidence}%)`
      );
    } catch (emailError) {
      stats.errors++;
      const errMsg = emailError instanceof Error ? emailError.message : String(emailError);
      console.error(`[fetch] Error processing email ${messageId}:`, errMsg);
      stats.details.push(`✗ ${messageId}: ${errMsg}`);
    }
  }

  return stats;
}
