import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Get the Clerk organization ID from the current session.
 * Throws if user is not in an organization.
 */
export async function getClerkOrgId(): Promise<string> {
  const { orgId } = await auth();
  if (!orgId) {
    throw new Error('Organization required. Please select or create an organization.');
  }
  return orgId;
}

// In-memory cache for clerk_org_id → internal UUID mapping (per-request lifetime)
const orgIdCache = new Map<string, string>();

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_KEY');
  return createClient(url, key);
}

/**
 * Get the internal DB org UUID from the current Clerk session.
 * Looks up the organizations table by clerk_org_id.
 * Creates the org record on first access (auto-provisioning).
 */
export async function getOrgDbId(): Promise<string> {
  const clerkOrgId = await getClerkOrgId();

  // Check cache first
  const cached = orgIdCache.get(clerkOrgId);
  if (cached) return cached;

  const supabase = getSupabaseAdmin();

  // Look up existing org
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', clerkOrgId)
    .single();

  if (data && !error) {
    orgIdCache.set(clerkOrgId, data.id);
    return data.id;
  }

  // Auto-provision: create org record from Clerk org metadata
  const { orgSlug } = await auth();
  const { data: newOrg, error: insertError } = await supabase
    .from('organizations')
    .insert({
      clerk_org_id: clerkOrgId,
      name: orgSlug || clerkOrgId,
      slug: orgSlug || clerkOrgId,
    })
    .select('id')
    .single();

  if (insertError || !newOrg) {
    // Race condition: another request may have created it
    const { data: retry } = await supabase
      .from('organizations')
      .select('id')
      .eq('clerk_org_id', clerkOrgId)
      .single();

    if (retry) {
      orgIdCache.set(clerkOrgId, retry.id);
      return retry.id;
    }

    throw new Error(`Failed to resolve organization: ${insertError?.message}`);
  }

  orgIdCache.set(clerkOrgId, newOrg.id);
  return newOrg.id;
}

/**
 * Get user display name from Clerk session.
 */
export async function getUserName(): Promise<string> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return 'Usuario';
  const fullName = sessionClaims?.full_name as string | undefined;
  if (fullName) return fullName;
  const firstName = sessionClaims?.first_name as string | undefined;
  const lastName = sessionClaims?.last_name as string | undefined;
  return [firstName, lastName].filter(Boolean).join(' ') || 'Usuario';
}
