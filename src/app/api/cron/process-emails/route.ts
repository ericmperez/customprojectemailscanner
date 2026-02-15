import { NextRequest, NextResponse } from 'next/server';
import { processNewEmails, ProcessingStats } from '@/lib/services/email-processor';
import { saveLastFetchTimestamp, getOrgsWithActiveGmail } from '@/lib/services/supabase.service';
import { createGmailServiceForOrg } from '@/lib/services/gmail.service';

export const maxDuration = 60;

const TOTAL_TIME_BUDGET_MS = 55_000; // Leave 5s buffer for Vercel's 60s limit
const MIN_PER_ORG_MS = 10_000;

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

  try {
    // Fetch all organizations with active Gmail credentials
    const orgs = await getOrgsWithActiveGmail();

    if (orgs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No organizations with active Gmail credentials',
        stats: [],
        duration: `${Date.now() - startTime}ms`,
      });
    }

    // Calculate per-org time budget
    const perOrgBudget = Math.max(
      MIN_PER_ORG_MS,
      Math.floor(TOTAL_TIME_BUDGET_MS / orgs.length)
    );

    const results: { orgId: string; email: string; stats: ProcessingStats | null; error?: string }[] = [];

    // Process each org sequentially (to stay within time budget)
    for (const org of orgs) {
      // Check total time budget
      if (Date.now() - startTime > TOTAL_TIME_BUDGET_MS) {
        console.log(`[cron] Total time budget exceeded, stopping`);
        break;
      }

      const orgStartTime = Date.now();

      try {
        // Create Gmail service for this org
        const gmailService = await createGmailServiceForOrg(org.org_id);
        if (!gmailService) {
          results.push({
            orgId: org.org_id,
            email: org.email_address,
            stats: null,
            error: 'Failed to create Gmail service (invalid credentials)',
          });
          continue;
        }

        // Process emails for this org with per-org time budget
        const stats = await processNewEmails(
          org.org_id,
          orgStartTime,
          7, // max emails per org per cron run
          gmailService
        );

        await saveLastFetchTimestamp(org.org_id, 'Cron automático');

        results.push({
          orgId: org.org_id,
          email: org.email_address,
          stats,
        });

        console.log(
          `[cron] Org ${org.org_id}: processed ${stats.processed}/${stats.emailsFound} emails in ${Date.now() - orgStartTime}ms`
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[cron] Error processing org ${org.org_id}:`, errMsg);
        results.push({
          orgId: org.org_id,
          email: org.email_address,
          stats: null,
          error: errMsg,
        });
      }
    }

    const totalProcessed = results.reduce((sum, r) => sum + (r.stats?.processed || 0), 0);

    return NextResponse.json({
      success: true,
      message: `Processed ${totalProcessed} emails across ${orgs.length} org(s)`,
      orgsProcessed: results.length,
      totalOrgs: orgs.length,
      results,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[cron] Fatal error:', errMsg);
    return NextResponse.json(
      { success: false, error: errMsg, duration: `${Date.now() - startTime}ms` },
      { status: 500 }
    );
  }
}
