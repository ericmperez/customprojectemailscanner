import { PR_MUNICIPALITIES } from '@/lib/constants/pr-municipalities';

export interface ValidationResult {
  value: string;
  fixed: boolean;
  issue?: string;
}

export interface ExtractionValidation {
  validated: Record<string, string>;
  issues: string[];
  fixes: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Strip accents and lowercase for comparison */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Levenshtein distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Pre-compute normalized municipality names for fast matching
const NORMALIZED_MUNICIPALITIES = PR_MUNICIPALITIES.map((m) => ({
  original: m,
  normalized: normalize(m),
}));

// ── Validators ───────────────────────────────────────────────────────

/**
 * Validate and auto-fix municipality/location.
 * - Exact match (accent-insensitive)
 * - Extract municipality from longer strings (e.g., "EBAS Torrecilla, Loíza" → "Loíza")
 * - Fuzzy match within Levenshtein distance ≤2
 */
export function validateLocation(location: string): ValidationResult {
  if (!location || location === 'No disponible') {
    return { value: location, fixed: false };
  }

  const norm = normalize(location);

  // Exact match
  const exact = NORMALIZED_MUNICIPALITIES.find((m) => m.normalized === norm);
  if (exact) return { value: exact.original, fixed: exact.original !== location };

  // Try to extract municipality from a longer string — check each word/segment
  const segments = location.split(/[,\-–—/]+/).map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const segNorm = normalize(seg);
    const segMatch = NORMALIZED_MUNICIPALITIES.find((m) => m.normalized === segNorm);
    if (segMatch) return { value: segMatch.original, fixed: true };
  }

  // Also try individual words (for "San Juan" style two-word municipalities)
  // Check pairs of consecutive words first, then single words
  const words = location.split(/\s+/);
  for (let i = 0; i < words.length - 1; i++) {
    const pair = words[i] + ' ' + words[i + 1];
    const pairNorm = normalize(pair);
    const pairMatch = NORMALIZED_MUNICIPALITIES.find((m) => m.normalized === pairNorm);
    if (pairMatch) return { value: pairMatch.original, fixed: true };
  }
  for (const word of words) {
    const wordNorm = normalize(word);
    const wordMatch = NORMALIZED_MUNICIPALITIES.find((m) => m.normalized === wordNorm);
    if (wordMatch) return { value: wordMatch.original, fixed: true };
  }

  // Fuzzy match: find closest municipality within distance ≤ 2
  let bestMatch: string | null = null;
  let bestDist = Infinity;
  for (const m of NORMALIZED_MUNICIPALITIES) {
    const dist = levenshtein(norm, m.normalized);
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = m.original;
    }
  }
  if (bestDist <= 2 && bestMatch) {
    return { value: bestMatch, fixed: true };
  }

  return { value: location, fixed: false, issue: 'location_unknown' };
}

/**
 * Validate and auto-fix PR phone numbers.
 * Must start with 787 or 939. Normalizes to (XXX) XXX-XXXX format.
 */
export function validatePhone(phone: string): ValidationResult {
  if (!phone || phone === 'No disponible') {
    return { value: phone, fixed: false };
  }

  // Strip everything except digits
  const digits = phone.replace(/\D/g, '');

  // Handle 11-digit with leading 1 (e.g., 17875551234)
  const cleaned = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;

  if (cleaned.length !== 10) {
    return { value: phone, fixed: false, issue: 'phone_invalid' };
  }

  const areaCode = cleaned.slice(0, 3);
  if (areaCode !== '787' && areaCode !== '939') {
    return { value: phone, fixed: false, issue: 'phone_invalid' };
  }

  const formatted = `(${areaCode}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  return { value: formatted, fixed: formatted !== phone };
}

/**
 * Validate and auto-fix dates to MM/DD/YYYY format.
 * - Auto-fix single-digit months/days
 * - Detect DD/MM swap when month > 12
 */
export function validateDate(dateStr: string): ValidationResult {
  if (!dateStr || dateStr === 'No disponible') {
    return { value: dateStr, fixed: false };
  }

  // Try to parse MM/DD/YYYY or M/D/YYYY
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    let month = parseInt(slashMatch[1], 10);
    let day = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);

    // Detect DD/MM swap: if month > 12, swap
    if (month > 12 && day <= 12) {
      [month, day] = [day, month];
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020 && year <= 2050) {
      const formatted = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
      return { value: formatted, fixed: formatted !== dateStr };
    }
  }

  // Try dash format: MM-DD-YYYY
  const dashMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    let month = parseInt(dashMatch[1], 10);
    let day = parseInt(dashMatch[2], 10);
    const year = parseInt(dashMatch[3], 10);

    if (month > 12 && day <= 12) {
      [month, day] = [day, month];
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020 && year <= 2050) {
      const formatted = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
      return { value: formatted, fixed: true };
    }
  }

  return { value: dateStr, fixed: false, issue: 'date_invalid' };
}

/**
 * Orchestrator: run all validators on extracted data.
 * Returns the validated data with auto-fixes applied, plus lists of issues and fixes.
 */
export function validateExtraction(data: Record<string, string>): ExtractionValidation {
  const validated = { ...data };
  const issues: string[] = [];
  const fixes: string[] = [];

  // Location
  if (validated.location) {
    const loc = validateLocation(validated.location);
    if (loc.fixed) {
      fixes.push(`location: "${validated.location}" → "${loc.value}"`);
      validated.location = loc.value;
    }
    if (loc.issue) issues.push(loc.issue);
  }

  // Phone
  if (validated.contactPhone) {
    const phone = validatePhone(validated.contactPhone);
    if (phone.fixed) {
      fixes.push(`contactPhone: "${validated.contactPhone}" → "${phone.value}"`);
      validated.contactPhone = phone.value;
    }
    if (phone.issue) issues.push(phone.issue);
  }

  // Dates
  for (const field of ['siteVisitDate', 'biddingCloseDate'] as const) {
    if (validated[field]) {
      const date = validateDate(validated[field]);
      if (date.fixed) {
        fixes.push(`${field}: "${validated[field]}" → "${date.value}"`);
        validated[field] = date.value;
      }
      if (date.issue) issues.push(`${field}_${date.issue}`);
    }
  }

  return { validated, issues, fixes };
}
