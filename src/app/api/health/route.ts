import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { status: 'degraded', reason: 'Missing Supabase config' },
        { status: 503 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.from('processed_emails').select('id').limit(1);

    if (error) {
      return NextResponse.json(
        { status: 'degraded', reason: 'Supabase unreachable' },
        { status: 503 }
      );
    }

    return NextResponse.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { status: 'unhealthy', reason: 'Health check failed' },
      { status: 503 }
    );
  }
}
