# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-10

### Added
- **Testing infrastructure**: Vitest with React Testing Library, jsdom, and v8 coverage
- **Test coverage**: 80%+ threshold on statements, branches, functions, and lines
- **Test suites**: Utils (152 cases), services (109 cases), hooks (70 cases), API routes (46 cases), components (22 cases)
- **Test utilities**: Factory builders (`buildLicitacion`, `buildStats`), `createMockNextRequest` helper, custom render wrapper
- **CHANGELOG.md**: Following Keep a Changelog format
- **Semver versioning**: Convention established for patch/minor/major bumps
- Package scripts: `test`, `test:watch`, `test:coverage`

### Changed
- Extracted `isBiddingOpen()` and `isMinutaOrAsistencia()` from cron route into `src/lib/services/cron.utils.ts` for testability
- Updated ESLint config to ignore `coverage/` directory

## [0.1.0] - 2025-01-01

### Added
- **Email processing pipeline**: Gmail integration to scan for licitacion PDFs
- **AI extraction**: GPT-4o-powered PDF data extraction with confidence scoring
- **Google Sheets backend**: Full CRUD for licitaciones via Google Sheets API
- **Supabase integration**: Email deduplication, PDF storage, and app settings
- **Dashboard**: Cards, list, and table views with stats bar
- **Filtering system**: Status, category, town, priority, date range, and saved presets
- **Approval workflow**: Approve, reject, and reset licitaciones with notes
- **Calendar view**: Site visit events with iCalendar export
- **CSV export**: Download licitaciones data as CSV
- **Keyboard shortcuts**: Quick filters, search, export, and navigation
- **Price search**: Buscar Precios integration via GPT-4o web search
- **Confidence settings**: Configurable field weights for extraction scoring
- **Auto-reject**: Expired licitaciones automatically rejected on list fetch
- **Responsive design**: Mobile-optimized layout and touch interactions
- **Authentication**: Clerk-based user authentication with middleware
- **Dark mode**: Theme toggle via next-themes

[0.2.0]: https://github.com/user/repo/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/user/repo/releases/tag/v0.1.0
