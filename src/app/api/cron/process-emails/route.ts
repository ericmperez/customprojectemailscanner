import { NextRequest, NextResponse } from 'next/server';
import GmailService from '@/lib/services/gmail.service';
import SheetsService from '@/lib/services/sheets.service';
import { extractLicitacionData } from '@/lib/services/openai.service';
import {
  isEmailProcessed,
  markEmailAsProcessed,
  uploadPdf,
  getAllProcessedEmailIds,
} from '@/lib/services/supabase.service';

export const maxDuration = 60;

const MAX_EMAILS_PER_RUN = 5;
const LOOKBACK_DAYS = 90;

/**
 * Check if a bidding close date is still in the future (or today).
 * Supports MM/DD/YYYY and Spanish date formats.
 */
function isBiddingOpen(closeDateStr: string): boolean {
  if (!closeDateStr || closeDateStr === 'No disponible') return true; // assume open if unknown

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Try MM/DD/YYYY
  const slashMatch = closeDateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10) - 1;
    const day = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);
    const closeDate = new Date(year, month, day);
    closeDate.setHours(23, 59, 59, 999);
    return closeDate >= today;
  }

  // Try Spanish format: "15 de marzo de 2025"
  const spanishMonths: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  };

  const spanishMatch = closeDateStr.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (spanishMatch) {
    const day = parseInt(spanishMatch[1], 10);
    const monthName = spanishMatch[2].toLowerCase();
    const year = parseInt(spanishMatch[3], 10);
    const month = spanishMonths[monthName];
    if (month !== undefined) {
      const closeDate = new Date(year, month, day);
      closeDate.setHours(23, 59, 59, 999);
      return closeDate >= today;
    }
  }

  // Try generic Date.parse as fallback
  const parsed = new Date(closeDateStr);
  if (!isNaN(parsed.getTime())) {
    parsed.setHours(23, 59, 59, 999);
    return parsed >= today;
  }

  return true; // assume open if unparseable
}

/**
 * Check if a PDF filename indicates meeting minutes (skip these).
 */
function isMinutaOrAsistencia(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.includes('minuta') || lower.includes('asistencia');
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify CRON_SECRET (Vercel sends it as Authorization: Bearer <token>)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  const stats = {
    emailsFound: 0,
    alreadyProcessed: 0,
    processed: 0,
    skippedClosed: 0,
    skippedMinuta: 0,
    skippedNoAttachments: 0,
    errors: 0,
    details: [] as string[],
  };

  try {
    // 1. Search Gmail for licitacion emails
    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - LOOKBACK_DAYS);

    const gmail = new GmailService();
    const messageIds = await gmail.searchLicitacionEmails(afterDate);
    stats.emailsFound = messageIds.length;
    console.log(`[cron] Found ${messageIds.length} licitacion emails`);

    if (messageIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No licitacion emails found',
        stats,
        duration: `${Date.now() - startTime}ms`,
      });
    }

    // 2. Pre-fetch all processed email IDs for O(1) dedup
    const processedIds = new Set(await getAllProcessedEmailIds());

    // 3. Filter out already-processed emails
    const newMessageIds = messageIds.filter((id) => !processedIds.has(id));
    stats.alreadyProcessed = messageIds.length - newMessageIds.length;
    console.log(
      `[cron] ${newMessageIds.length} new emails (${stats.alreadyProcessed} already processed)`
    );

    // 4. Process up to MAX_EMAILS_PER_RUN
    const batch = newMessageIds.slice(0, MAX_EMAILS_PER_RUN);
    const sheets = new SheetsService();

    for (const messageId of batch) {
      try {
        // Double-check dedup (handles race conditions)
        const alreadyDone = await isEmailProcessed(messageId);
        if (alreadyDone) {
          stats.alreadyProcessed++;
          continue;
        }

        // Fetch email details + attachments
        console.log(`[cron] Processing email: ${messageId}`);
        const email = await gmail.getEmailDetails(messageId);

        // Filter to PDF attachments, skip minutas
        const pdfAttachments = email.attachments.filter((att) => {
          if (isMinutaOrAsistencia(att.filename)) {
            stats.skippedMinuta++;
            console.log(`[cron] Skipping minuta/asistencia: ${att.filename}`);
            return false;
          }
          return true;
        });

        if (pdfAttachments.length === 0) {
          stats.skippedNoAttachments++;
          console.log(`[cron] No valid PDF attachments for: ${email.subject}`);
          continue;
        }

        // Process the first valid PDF attachment
        const pdf = pdfAttachments[0];
        console.log(`[cron] Extracting data from: ${pdf.filename}`);

        // Send PDF to GPT-4o
        const extracted = await extractLicitacionData(pdf.base64Data, pdf.filename);
        console.log(
          `[cron] Extracted: ${extracted.title} | Location: ${extracted.location} | Confidence: ${extracted.confidence}%`
        );

        // Check if bidding is still open
        if (!isBiddingOpen(extracted.biddingCloseDate)) {
          stats.skippedClosed++;
          console.log(
            `[cron] Skipping closed bidding: ${extracted.biddingCloseDate} - ${email.subject}`
          );
          // Still mark as processed so we don't re-check
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
        const { publicUrl } = await uploadPdf(
          pdf.base64Data,
          pdf.filename,
          messageId
        );
        console.log(`[cron] PDF uploaded: ${publicUrl}`);

        // Build the HYPERLINK formula for Google Sheets
        const pdfLinkFormula = `=HYPERLINK("${publicUrl}", "Ver PDF")`;

        // Use email subject as title fallback when GPT-4o returns a generic/unhelpful title
        const genericTitles = ['certificación de recibo de pliegos', 'no disponible', 'certificacion de recibo de pliegos'];
        const resolvedTitle = (extracted.title && !genericTitles.includes(extracted.title.toLowerCase()))
          ? extracted.title
          : email.subject.replace(/^\[.*?\]\s*/, '').replace(/^(INVITACION-|INVITACIÓN-)/i, '').trim();

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
          contactName: extracted.contactName,
          contactPhone: extracted.contactPhone,
          biddingCloseDate: extracted.biddingCloseDate,
          biddingCloseTime: extracted.biddingCloseTime,
          extractionMethod: `GPT-4o (${extracted.confidence}%)`,
          emailId: messageId,
          approvalStatus: 'pending',
          interested: false,
          decisionStatus: 'researching',
        };

        const result = await sheets.upsertLicitacion(sheetData);
        console.log(`[cron] Written to Sheets row: ${result.rowNumber}`);

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
        const errMsg =
          emailError instanceof Error ? emailError.message : String(emailError);
        console.error(`[cron] Error processing email ${messageId}:`, errMsg);
        stats.details.push(`✗ ${messageId}: ${errMsg}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${stats.processed} of ${stats.emailsFound} emails`,
      stats,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[cron] Fatal error:', errMsg);
    return NextResponse.json(
      {
        success: false,
        error: errMsg,
        stats,
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}
