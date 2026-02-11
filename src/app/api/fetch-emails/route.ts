import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { processNewEmails } from '@/lib/services/email-processor';
import { saveLastFetchTimestamp } from '@/lib/services/supabase.service';

export const maxDuration = 60;

export async function POST() {
  const startTime = Date.now();

  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.emailAddresses[0]?.emailAddress ||
      'Usuario';

    const stats = await processNewEmails(startTime);

    await saveLastFetchTimestamp(userName);

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
