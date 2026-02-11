import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ConfidenceFieldSettings } from '@/lib/types';

function getClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  // Prefer service_role key (bypasses RLS) for server-side operations
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_KEY');
  return createClient(url, key);
}

const PDF_BUCKET = process.env.SUPABASE_PDF_BUCKET || 'licitaciones-pdfs';

export interface ProcessedEmailRecord {
  email_id: string;
  subject: string;
  location: string;
  description: string;
  pdf_filename: string;
}

/**
 * Check if an email has already been processed (deduplication).
 */
export async function isEmailProcessed(emailId: string): Promise<boolean> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('processed_emails')
    .select('id')
    .eq('email_id', emailId)
    .limit(1);

  if (error) {
    console.error('Error checking processed email:', error);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

/**
 * Mark an email as processed in Supabase.
 */
export async function markEmailAsProcessed(
  record: ProcessedEmailRecord
): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from('processed_emails').insert({
    email_id: record.email_id,
    subject: record.subject,
    location: record.location,
    description: record.description,
    pdf_filename: record.pdf_filename,
  });

  if (error) {
    console.error('Error marking email as processed:', error);
    throw error;
  }
}

/**
 * Upload a PDF to Supabase Storage and return the public URL.
 */
export async function uploadPdf(
  pdfBase64: string,
  filename: string,
  emailId: string
): Promise<{ path: string; publicUrl: string }> {
  const supabase = getClient();

  // Convert base64 to Buffer
  const buffer = Buffer.from(pdfBase64, 'base64');

  // Create a unique path: emailId/filename
  const storagePath = `${emailId}/${filename}`;

  const { error } = await supabase.storage
    .from(PDF_BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) {
    console.error('Error uploading PDF:', error);
    throw error;
  }

  const { data: urlData } = supabase.storage
    .from(PDF_BUCKET)
    .getPublicUrl(storagePath);

  return {
    path: storagePath,
    publicUrl: urlData.publicUrl,
  };
}

/**
 * Fetch all processed email IDs for efficient O(1) pre-filtering.
 */
export async function getAllProcessedEmailIds(): Promise<string[]> {
  const supabase = getClient();
  const ids: string[] = [];
  let offset = 0;
  const limit = 1000;

  // Paginate through all records
  while (true) {
    const { data, error } = await supabase
      .from('processed_emails')
      .select('email_id')
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching processed email IDs:', error);
      break;
    }

    if (!data || data.length === 0) break;

    for (const row of data) {
      ids.push(row.email_id);
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return ids;
}

// Default confidence field settings (matches original hardcoded values)
const DEFAULT_CONFIDENCE_SETTINGS: ConfidenceFieldSettings = {
  critical: ['location', 'description', 'biddingCloseDate', 'contactPhone'],
  optional: [
    'title',
    'summary',
    'category',
    'siteVisitDate',
    'siteVisitTime',
    'visitLocation',
    'contactName',
    'biddingCloseTime',
    'estimatedValue',
  ],
  ignored: [],
};

/**
 * Fetch confidence field settings from app_settings table.
 * Falls back to hardcoded defaults if not found or on error.
 */
export async function getConfidenceSettings(): Promise<ConfidenceFieldSettings> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'confidence_fields')
      .single();

    if (error || !data) {
      return DEFAULT_CONFIDENCE_SETTINGS;
    }

    return data.value as ConfidenceFieldSettings;
  } catch {
    return DEFAULT_CONFIDENCE_SETTINGS;
  }
}

/**
 * Save the last email fetch timestamp to app_settings.
 */
export async function saveLastFetchTimestamp(): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      { key: 'last_email_fetch', value: { timestamp: new Date().toISOString() }, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

  if (error) {
    console.error('Error saving last fetch timestamp:', error);
  }
}

/**
 * Get the last email fetch timestamp from app_settings.
 */
export async function getLastFetchTimestamp(): Promise<string | null> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'last_email_fetch')
      .single();

    if (error || !data) return null;
    return (data.value as { timestamp: string }).timestamp ?? null;
  } catch {
    return null;
  }
}

/**
 * Save confidence field settings to app_settings table (upsert).
 */
export async function saveConfidenceSettings(
  settings: ConfidenceFieldSettings
): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      { key: 'confidence_fields', value: settings, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

  if (error) {
    console.error('Error saving confidence settings:', error);
    throw error;
  }
}
