import { NextRequest, NextResponse } from 'next/server';

/**
 * Cron job for processing licitación emails.
 *
 * The LicitacionAgent (Gmail scanner + PDF extractor + AI parser) lives in the
 * original Express project at `/customprojectemailscanner/src/index.js`.
 * It has heavy dependencies (Gmail, Drive, PDF, Groq AI, Supabase, Sheets)
 * that haven't been ported to this Next.js project yet.
 *
 * TODO: Either copy the agent pipeline into this project or keep the cron
 * pointing at the original Express deployment.
 */

export async function GET(request: NextRequest) {
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

  // Placeholder — agent not yet ported to this project
  return NextResponse.json({
    success: false,
    message:
      'Email processing agent not yet available in the Next.js project. ' +
      'Use the original Express deployment for cron processing.',
    timestamp: new Date().toISOString(),
  });
}
