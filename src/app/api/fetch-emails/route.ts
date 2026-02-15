import { NextResponse } from 'next/server';
import { getOrgDbId, getUserName } from '@/lib/auth';
import { processNewEmails } from '@/lib/services/email-processor';
import { saveLastFetchTimestamp, logActivity } from '@/lib/services/supabase.service';

export const maxDuration = 60;

export async function POST() {
  const startTime = Date.now();

  try {
    const orgId = await getOrgDbId();
    const userName = await getUserName();

    const stats = await processNewEmails(orgId, startTime, 0);

    await saveLastFetchTimestamp(orgId, userName);

    logActivity(orgId, 'fetch_emails', null, null, userName, {
      emailsFound: stats.emailsFound,
      processed: stats.processed,
    });

    return NextResponse.json({
      success: true,
      message: `Processed ${stats.processed} of ${stats.emailsFound} emails`,
      stats,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[manual-fetch] Fatal error:', errMsg);
    return NextResponse.json(
      { success: false, error: errMsg, duration: `${Date.now() - startTime}ms` },
      { status: 500 }
    );
  }
}
