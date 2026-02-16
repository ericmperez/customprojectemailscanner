# Licitaciones Dashboard

Multi-tenant SaaS platform for government bid (licitacion) management in Puerto Rico. Automatically ingests bid notifications from Gmail, extracts structured data from PDFs using AI, and provides a dashboard for tracking, approving, and managing licitaciones.

## Stack

- **Framework**: Next.js 16 (App Router) + TypeScript + React 19
- **Styling**: Tailwind CSS 4 + shadcn/ui + Radix UI
- **Auth**: Clerk with Organizations (multi-tenant)
- **Database**: Supabase (Postgres) with Row-Level Security
- **AI**: OpenAI GPT-4o for PDF data extraction
- **Email**: Gmail API (per-org OAuth)
- **Deploy**: Vercel with hourly cron job
- **Testing**: Vitest + React Testing Library + jsdom

## Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run test         # Run tests (vitest)
npm run test:watch   # Watch mode
npm run lint         # ESLint
```

## Architecture

### Multi-Tenancy

Every table has an `org_id` column. All data is isolated per organization:

- Clerk Organizations provide auth-level isolation
- Supabase RLS policies enforce data isolation at the DB level
- `getOrgDbId()` in `src/lib/auth.ts` resolves the current Clerk org to an internal UUID
- All service methods take `orgId` as their first parameter
- The cron job iterates over all orgs with active Gmail credentials

### Data Flow

```
Gmail inbox → cron/manual fetch → email-processor → OpenAI PDF extraction
→ validation → Supabase licitaciones table → Dashboard UI
```

1. Cron (`/api/cron/process-emails`) or manual fetch (`/api/fetch-emails`) triggers email ingestion
2. `email-processor.ts` searches Gmail for bid-related emails with PDF attachments
3. PDFs are sent to OpenAI GPT-4o for structured data extraction
4. Extracted data is validated and upserted into the `licitaciones` table
5. Dashboard displays licitaciones with filtering, approval workflow, and calendar views

### Key Directories

```
src/
├── app/
│   ├── api/                    # API routes (all require org context)
│   │   ├── cron/               # Hourly email processing (all orgs)
│   │   ├── fetch-emails/       # Manual email fetch (single org)
│   │   ├── licitaciones/       # CRUD + approve/reject/update
│   │   ├── settings/           # Gmail OAuth, AI config, confidence
│   │   ├── stats/              # Dashboard statistics
│   │   └── visits/             # Site visit calendar data
│   ├── onboarding/             # New org setup wizard
│   └── settings/               # Settings page (Gmail, AI, Team)
├── components/
│   ├── dashboard/              # DashboardShell, FilterBar, StatsBar
│   ├── licitaciones/           # Card, List, Table view components
│   ├── modals/                 # DetailModal, ApprovalModal, dialogs
│   ├── settings/               # Gmail, AI settings panels
│   └── ui/                     # shadcn/ui primitives
├── hooks/                      # Custom React hooks (data fetching, state)
└── lib/
    ├── auth.ts                 # getOrgDbId(), getClerkOrgId(), getUserName()
    ├── types.ts                # Licitacion, Stats, Filters, etc.
    ├── services/
    │   ├── supabase-licitaciones.service.ts  # Licitacion CRUD (primary)
    │   ├── supabase.service.ts               # Settings, activity log, credentials
    │   ├── gmail.service.ts                  # Gmail API + per-org OAuth factory
    │   ├── openai.service.ts                 # GPT-4o PDF extraction
    │   ├── email-processor.ts                # Email ingestion pipeline
    │   ├── licitaciones.service.ts           # Facade over supabase-licitaciones
    │   └── validation.service.ts             # Extraction validation
    └── utils/
        ├── encryption.ts       # AES-256-GCM for OAuth token storage
        └── retry.ts            # withRetry() wrapper for external API calls
```

### Database Tables

- `organizations` — Clerk org mapping, plan info
- `licitaciones` — Core bid data (UUID primary key, `org_id` foreign key)
- `organization_credentials` — Encrypted Gmail OAuth tokens per org
- `processed_emails` — Deduplication tracking
- `app_settings` — Per-org AI and confidence settings
- `correction_examples` — Semantic correction training data (with pgvector embeddings)
- `activity_log` — User action audit trail
- `extraction_log` — AI extraction quality tracking
- `usage_records` — Email/PDF/AI token usage per org per month

SQL migrations: `supabase/migrations/`

## Conventions

- **Language**: All UI text is in Spanish
- **Icons**: Emoji icons preferred over lucide-react for action buttons (star, heart, dismiss)
- **IDs**: `Licitacion.id` is a UUID string (not a number)
- **Auth pattern**: Every API route calls `getOrgDbId()` first, passes `orgId` to services
- **Error handling**: `withRetry()` wraps external API calls; `ConfirmationDialog` replaces `confirm()`
- **Auto-reject**: Expired licitaciones are auto-rejected via `autoRejectExpired(orgId)` (fire-and-forget from GET `/api/licitaciones`)
- **Activity logging**: `logActivity()` is fire-and-forget (no await)
- **Gmail OAuth**: Tokens encrypted with AES-256-GCM, stored in `organization_credentials`
- **Suspense**: Any component using `useSearchParams()` must be in its own file wrapped in `<Suspense>` (Next.js 16 requirement)

## Environment Variables

Required in `.env.local` and Vercel:

```
SUPABASE_URL                        # Supabase project URL
SUPABASE_KEY                        # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY           # Supabase service role (bypasses RLS)
SUPABASE_PDF_BUCKET                 # Storage bucket for PDFs

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY   # Clerk frontend key
CLERK_SECRET_KEY                    # Clerk backend key

OPENAI_API_KEY                      # GPT-4o for PDF extraction

GMAIL_CLIENT_ID                     # Google OAuth client ID (app-level)
GMAIL_CLIENT_SECRET                 # Google OAuth client secret (app-level)
GMAIL_REDIRECT_URI                  # OAuth callback URL

ENCRYPTION_KEY                      # AES-256 key for token encryption (64 hex chars)

CRON_SECRET                         # Vercel cron auth token
```

## Cron Job

- Runs hourly via Vercel Cron (`vercel.json`)
- `maxDuration: 60` (Vercel limit), internal budget: 55s
- Processes all orgs with active Gmail credentials sequentially
- Per-org time budget: `55s / orgCount` (min 10s each)
- Max 7 emails per org per cron run

## Testing

```bash
npm run test                # Run all tests
npm run test -- --run src/lib/services/__tests__/  # Run specific directory
```

- Test files co-located in `__tests__/` directories
- Test factories in `src/__tests__/factories.ts`
- Mock setup in `src/__tests__/setup.ts`

### Pre-Commit Rule

**IMPORTANT**: Before every commit, you MUST run `npx vitest run` and verify that all new and modified test files pass. Do not commit code that introduces test failures. If pre-existing tests fail (tests you did not modify), that is acceptable, but any test file you created or changed must pass.
