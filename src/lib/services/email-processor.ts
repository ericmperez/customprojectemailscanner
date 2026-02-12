import GmailService from '@/lib/services/gmail.service';
import SheetsService from '@/lib/services/sheets.service';
import { extractLicitacionData } from '@/lib/services/openai.service';
import {
  isEmailProcessed,
  markEmailAsProcessed,
  uploadPdf,
  getAllProcessedEmailIds,
} from '@/lib/services/supabase.service';
import { isBiddingOpen, isMinutaOrAsistencia } from '@/lib/services/cron.utils';

const MAX_EMAILS_PER_RUN = 5;
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
 */
export async function processNewEmails(startTime: number): Promise<ProcessingStats> {
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

  const gmail = new GmailService();
  const messageIds = await gmail.searchLicitacionEmails(afterDate);
  stats.emailsFound = messageIds.length;
  console.log(`[fetch] Found ${messageIds.length} licitacion emails`);

  if (messageIds.length === 0) return stats;

  // 2. Pre-fetch all processed email IDs for O(1) dedup
  const processedIds = new Set(await getAllProcessedEmailIds());

  // 3. Filter out already-processed emails
  const newMessageIds = messageIds.filter((id) => !processedIds.has(id));
  stats.alreadyProcessed = messageIds.length - newMessageIds.length;
  console.log(
    `[fetch] ${newMessageIds.length} new emails (${stats.alreadyProcessed} already processed)`
  );

  // 4. Process up to MAX_EMAILS_PER_RUN
  const batch = newMessageIds.slice(0, MAX_EMAILS_PER_RUN);
  const sheets = new SheetsService();

  for (const messageId of batch) {
    // Time-budget check
    if (Date.now() - startTime > TIME_BUDGET_MS) {
      console.log(`[fetch] Time budget exceeded (${TIME_BUDGET_MS}ms), stopping early`);
      stats.details.push(`⏱️ Stopped early: time budget exceeded`);
      break;
    }

    try {
      // Double-check dedup (handles race conditions)
      const alreadyDone = await isEmailProcessed(messageId);
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

      // Send PDF to GPT-4o
      const extracted = await extractLicitacionData(pdf.base64Data, pdf.filename);
      console.log(
        `[fetch] Extracted: ${extracted.title} | Location: ${extracted.location} | Confidence: ${extracted.confidence}%`
      );

      // Check if bidding is still open
      if (!isBiddingOpen(extracted.biddingCloseDate)) {
        stats.skippedClosed++;
        console.log(
          `[fetch] Skipping closed bidding: ${extracted.biddingCloseDate} - ${email.subject}`
        );
        await markEmailAsProcessed({
          email_id: messageId,
          subject: email.subject,
          location: extracted.location,
          description: `[Skipped - bidding closed ${extracted.biddingCloseDate}]`,
          pdf_filename: pdf.filename,
        });
        continue;
      }

      // Upload PDF to Supabase Storage
      const { publicUrl } = await uploadPdf(pdf.base64Data, pdf.filename, messageId);
      console.log(`[fetch] PDF uploaded: ${publicUrl}`);

      // Build the HYPERLINK formula for Google Sheets
      const pdfLinkFormula = `=HYPERLINK("${publicUrl}", "Ver PDF")`;

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

      // Upsert to Google Sheets
      const sheetData: Record<string, unknown> = {
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
        pdfLink: pdfLinkFormula,
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
        decisionStatus: 'researching',
      };

      const result = await sheets.upsertLicitacion(sheetData);
      console.log(`[fetch] Written to Sheets row: ${result.rowNumber}`);

      // Mark as processed in Supabase
      await markEmailAsProcessed({
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
