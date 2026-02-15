import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ConfidenceFieldSettings, CorrectionExample } from '@/lib/types';

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
export async function isEmailProcessed(orgId: string, emailId: string): Promise<boolean> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('processed_emails')
    .select('id')
    .eq('org_id', orgId)
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
  orgId: string,
  record: ProcessedEmailRecord
): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from('processed_emails').insert({
    org_id: orgId,
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
 * Path structure: {orgId}/{emailId}/{filename} for per-org isolation.
 */
export async function uploadPdf(
  orgId: string,
  pdfBase64: string,
  filename: string,
  emailId: string
): Promise<{ path: string; publicUrl: string }> {
  const supabase = getClient();

  // Convert base64 to Buffer
  const buffer = Buffer.from(pdfBase64, 'base64');

  // Create an org-isolated path
  const storagePath = `${orgId}/${emailId}/${filename}`;

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
export async function getAllProcessedEmailIds(orgId: string): Promise<string[]> {
  const supabase = getClient();
  const ids: string[] = [];
  let offset = 0;
  const limit = 1000;

  // Paginate through all records
  while (true) {
    const { data, error } = await supabase
      .from('processed_emails')
      .select('email_id')
      .eq('org_id', orgId)
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
export async function getConfidenceSettings(orgId: string): Promise<ConfidenceFieldSettings> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('org_id', orgId)
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
 * Save the last email fetch timestamp to app_settings, including who triggered it.
 */
export async function saveLastFetchTimestamp(orgId: string, triggeredBy: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      {
        org_id: orgId,
        key: 'last_email_fetch',
        value: { timestamp: new Date().toISOString(), triggeredBy },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,key' }
    );

  if (error) {
    console.error('Error saving last fetch timestamp:', error);
  }
}

export interface LastFetchInfo {
  timestamp: string;
  triggeredBy: string;
}

/**
 * Get the last email fetch info from app_settings.
 */
export async function getLastFetchInfo(orgId: string): Promise<LastFetchInfo | null> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('org_id', orgId)
      .eq('key', 'last_email_fetch')
      .single();

    if (error || !data) return null;
    const val = data.value as { timestamp?: string; triggeredBy?: string };
    return {
      timestamp: val.timestamp ?? '',
      triggeredBy: val.triggeredBy ?? 'Desconocido',
    };
  } catch {
    return null;
  }
}

/**
 * Get just the last email fetch timestamp string (convenience wrapper).
 */
export async function getLastFetchTimestamp(orgId: string): Promise<string | null> {
  const info = await getLastFetchInfo(orgId);
  return info?.timestamp ?? null;
}

/**
 * Save confidence field settings to app_settings table (upsert).
 */
export async function saveConfidenceSettings(
  orgId: string,
  settings: ConfidenceFieldSettings
): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      { org_id: orgId, key: 'confidence_fields', value: settings, updated_at: new Date().toISOString() },
      { onConflict: 'org_id,key' }
    );

  if (error) {
    console.error('Error saving confidence settings:', error);
    throw error;
  }
}

// ── AI Settings (Custom Instructions + Correction Examples) ──────────

export interface AISettings {
  instructions: string;
  examples: CorrectionExample[];
}

/**
 * Fetch AI custom instructions and correction examples from app_settings.
 */
export async function getAISettings(orgId: string): Promise<AISettings> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('org_id', orgId)
      .in('key', ['ai_custom_instructions', 'ai_extraction_examples']);

    if (error || !data) {
      return { instructions: '', examples: [] };
    }

    let instructions = '';
    let examples: CorrectionExample[] = [];

    for (const row of data) {
      if (row.key === 'ai_custom_instructions') {
        instructions = (row.value as { text?: string })?.text ?? '';
      } else if (row.key === 'ai_extraction_examples') {
        examples = ((row.value as { items?: CorrectionExample[] })?.items ?? []) as CorrectionExample[];
      }
    }

    return { instructions, examples };
  } catch {
    return { instructions: '', examples: [] };
  }
}

/**
 * Save AI custom instructions text to app_settings (upsert).
 */
export async function saveAIInstructions(orgId: string, text: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      { org_id: orgId, key: 'ai_custom_instructions', value: { text }, updated_at: new Date().toISOString() },
      { onConflict: 'org_id,key' }
    );

  if (error) {
    console.error('Error saving AI instructions:', error);
    throw error;
  }
}

/**
 * Save AI correction examples to app_settings (upsert).
 */
export async function saveAIExamples(orgId: string, examples: CorrectionExample[]): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      { org_id: orgId, key: 'ai_extraction_examples', value: { items: examples }, updated_at: new Date().toISOString() },
      { onConflict: 'org_id,key' }
    );

  if (error) {
    console.error('Error saving AI examples:', error);
    throw error;
  }
}

// ── Correction Examples with Embeddings (pgvector) ───────────────────

export interface CorrectionRow {
  id: string;
  field: string;
  original: string;
  corrected: string;
  context: string | null;
  saved_at: string;
}

/**
 * Save a correction example with its embedding to the correction_examples table.
 */
export async function saveCorrectionWithEmbedding(
  orgId: string,
  field: string,
  original: string,
  corrected: string,
  context: string | undefined,
  embedding: number[]
): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from('correction_examples').insert({
    org_id: orgId,
    field,
    original,
    corrected,
    context: context || null,
    embedding: JSON.stringify(embedding),
  });

  if (error) {
    console.error('Error saving correction with embedding:', error);
    throw error;
  }
}

/**
 * Find corrections semantically similar to the given embedding via pgvector RPC.
 */
export async function findRelevantCorrections(
  orgId: string,
  embedding: number[],
  limit = 5,
  threshold = 0.5
): Promise<{ field: string; original: string; corrected: string; context: string | null; similarity: number }[]> {
  const supabase = getClient();
  const { data, error } = await supabase.rpc('match_corrections', {
    query_embedding: JSON.stringify(embedding),
    match_threshold: threshold,
    match_count: limit,
    p_org_id: orgId,
  });

  if (error) {
    console.error('Error finding relevant corrections:', error);
    return [];
  }

  return (data ?? []) as { field: string; original: string; corrected: string; context: string | null; similarity: number }[];
}

/**
 * Get all correction examples from the correction_examples table (for UI list).
 */
export async function getAllCorrectionExamples(orgId: string): Promise<CorrectionRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('correction_examples')
    .select('id, field, original, corrected, context, saved_at')
    .eq('org_id', orgId)
    .order('saved_at', { ascending: false });

  if (error) {
    console.error('Error fetching correction examples:', error);
    return [];
  }

  return (data ?? []) as CorrectionRow[];
}

/**
 * Delete a single correction example by UUID (scoped to org).
 */
export async function deleteCorrectionExample(orgId: string, id: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from('correction_examples')
    .delete()
    .eq('org_id', orgId)
    .eq('id', id);

  if (error) {
    console.error('Error deleting correction example:', error);
    throw error;
  }
}

/**
 * Clear all correction examples for an org.
 */
export async function clearCorrectionExamples(orgId: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from('correction_examples')
    .delete()
    .eq('org_id', orgId)
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    console.error('Error clearing correction examples:', error);
    throw error;
  }
}

// ── Activity Log ─────────────────────────────────────────────────────

export interface ActivityEntry {
  id: string;
  action: string;
  licitacion_id: string | null;
  licitacion_title: string | null;
  user_name: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Log a user activity. Fire-and-forget — errors are caught.
 */
export async function logActivity(
  orgId: string,
  action: string,
  licitacionId: string | null,
  licitacionTitle: string | null,
  userName: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = getClient();
    await supabase.from('activity_log').insert({
      org_id: orgId,
      action,
      licitacion_id: licitacionId,
      licitacion_title: licitacionTitle,
      user_name: userName,
      details: details || null,
    });
  } catch (err) {
    console.warn('[supabase] Failed to log activity (non-blocking):', err);
  }
}

/**
 * Fetch paginated activity log entries, newest first.
 */
export async function getActivityLog(
  orgId: string,
  limit = 50,
  offset = 0
): Promise<ActivityEntry[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, action, licitacion_id, licitacion_title, user_name, details, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching activity log:', error);
    return [];
  }

  return (data ?? []) as ActivityEntry[];
}

// ── Extraction Quality Log ───────────────────────────────────────────

export interface ExtractionLogEntry {
  email_id: string;
  pdf_filename?: string;
  confidence_score: number;
  had_text_extraction: boolean;
  validation_issues?: string[];
  auto_fixes?: string[];
  processing_time_ms?: number;
}

/**
 * Log an extraction result for quality tracking. Fire-and-forget — errors are caught.
 */
export async function logExtraction(orgId: string, entry: ExtractionLogEntry): Promise<void> {
  try {
    const supabase = getClient();
    await supabase.from('extraction_log').insert({
      org_id: orgId,
      email_id: entry.email_id,
      pdf_filename: entry.pdf_filename || null,
      confidence_score: entry.confidence_score,
      had_text_extraction: entry.had_text_extraction,
      validation_issues: entry.validation_issues ?? [],
      auto_fixes: entry.auto_fixes ?? [],
      processing_time_ms: entry.processing_time_ms || null,
    });
  } catch (err) {
    console.warn('[supabase] Failed to log extraction (non-blocking):', err);
  }
}

// ── Organization Credentials ─────────────────────────────────────────

export interface OrgCredentials {
  id: string;
  org_id: string;
  provider: string;
  email_address: string | null;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expiry: string | null;
  scopes: string[] | null;
  is_active: boolean;
}

/**
 * Get Gmail credentials for an org.
 */
export async function getOrgGmailCredentials(orgId: string): Promise<OrgCredentials | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('organization_credentials')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider', 'gmail')
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  return data as OrgCredentials;
}

/**
 * Save or update Gmail credentials for an org.
 */
export async function saveOrgGmailCredentials(
  orgId: string,
  emailAddress: string,
  accessTokenEnc: string,
  refreshTokenEnc: string,
  tokenExpiry: Date,
  scopes: string[]
): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from('organization_credentials')
    .upsert(
      {
        org_id: orgId,
        provider: 'gmail',
        email_address: emailAddress,
        access_token_enc: accessTokenEnc,
        refresh_token_enc: refreshTokenEnc,
        token_expiry: tokenExpiry.toISOString(),
        scopes,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,provider' }
    );

  if (error) {
    console.error('Error saving Gmail credentials:', error);
    throw error;
  }
}

/**
 * Deactivate Gmail credentials for an org.
 */
export async function deactivateOrgGmailCredentials(orgId: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from('organization_credentials')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('provider', 'gmail');

  if (error) {
    console.error('Error deactivating Gmail credentials:', error);
    throw error;
  }
}

/**
 * Get all organizations with active Gmail credentials (for cron processing).
 */
export async function getOrgsWithActiveGmail(): Promise<{ org_id: string; email_address: string; access_token_enc: string; refresh_token_enc: string; token_expiry: string }[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('organization_credentials')
    .select('org_id, email_address, access_token_enc, refresh_token_enc, token_expiry')
    .eq('provider', 'gmail')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching orgs with active Gmail:', error);
    return [];
  }

  return (data ?? []) as { org_id: string; email_address: string; access_token_enc: string; refresh_token_enc: string; token_expiry: string }[];
}
