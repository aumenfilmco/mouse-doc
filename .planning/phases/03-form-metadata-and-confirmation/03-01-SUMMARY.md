---
phase: 03-form-metadata-and-confirmation
plan: 01
subsystem: api
tags: [airtable, validation, next-js, tdd, jest, typescript]

# Dependency graph
requires:
  - phase: 01-backend-infrastructure
    provides: Route handler pattern (presign route.ts), jest.config.ts with transformIgnorePatterns
  - phase: 02-upload-ui
    provides: useFileUpload hook returning fileKey string for metadata POST payload
provides:
  - Pure validateSubmission function (app/utils/validateSubmission.ts) — importable by both route and client component
  - /api/submit/metadata POST route handler — writes Airtable record via raw fetch
affects:
  - 03-02 (UI wiring — ShareStory.tsx calls validateSubmission and /api/submit/metadata)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure validation utility extracted to app/utils/ — importable by both server route and client component"
    - "Route handler uses validateSubmission for server-side defense-in-depth validation"
    - "Airtable written via raw fetch with Bearer PAT — no SDK, 5-line pattern"
    - "TDD: RED (test fails with module-not-found) → GREEN (all tests pass)"

key-files:
  created:
    - app/utils/validateSubmission.ts
    - __tests__/utils/validateSubmission.test.ts
    - app/api/submit/metadata/route.ts
    - __tests__/api/submit.test.ts
  modified:
    - .env.local.example

key-decisions:
  - "Airtable field names: Name, Connection, Email, Phone, StoryText, FileKey, SubmittedAt — user must create Airtable table with these exact column names before deployment"
  - "validateSubmission collects ALL errors in one pass (not short-circuit) — caller decides which to surface (UI shows first error in field order)"
  - "Route handler returns first validation error from Object.values(errors)[0] — matches validation order: name, relation, email, form06"

patterns-established:
  - "Validation utilities in app/utils/ — pure functions with no React or Next.js imports"
  - "TDD pattern: test file imports module that doesn't exist → suite fails to run (module-not-found = RED) → implement → all green"

requirements-completed: [FORM-01, FORM-02, FORM-03, FORM-04, FORM-06, META-01, META-02]

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 3 Plan 01: Validation + Metadata Route Summary

**validateSubmission pure function and /api/submit/metadata Airtable POST route, both fully TDD with 13 new tests (38 total suite green)**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-17T15:39:47Z
- **Completed:** 2026-03-17T15:42:37Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Pure `validateSubmission` function handles all FORM-01 through FORM-06 validation rules with 7 unit tests
- `/api/submit/metadata` route handler POSTs to Airtable REST API with correct auth, field mapping, and error handling — 6 unit tests
- Server-side route reuses `validateSubmission` (defense-in-depth) — validation logic is shared, not duplicated
- `.env.local.example` updated with three Airtable env vars required before deployment
- Full test suite green: 38 tests across 5 suites, 0 regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create validateSubmission pure function with TDD** - `64f569e` (feat)
2. **Task 2: Create /api/submit/metadata route handler with TDD** - `7b9b607` (feat)

**Plan metadata:** (docs commit — see below)

_Note: TDD tasks committed after GREEN phase (tests + implementation in single commit per task)_

## Files Created/Modified
- `app/utils/validateSubmission.ts` - Pure validation function: name required, relation required, email format, FORM-06 file-or-text
- `__tests__/utils/validateSubmission.test.ts` - 7 unit tests covering all 7 validation behaviors
- `app/api/submit/metadata/route.ts` - POST handler: validates input, POSTs record to Airtable, returns 200/400/502
- `__tests__/api/submit.test.ts` - 6 unit tests with mocked global fetch verifying URL, headers, and field mapping
- `.env.local.example` - Added AIRTABLE_PAT, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID

## Decisions Made
- Airtable field names chosen per plan spec: `Name`, `Connection`, `Email`, `Phone`, `StoryText`, `FileKey`, `SubmittedAt`. The RESEARCH.md used `Relation` and `Text Story` / `File Key` with spaces — the PLAN.md spec takes precedence (no spaces, `Connection` not `Relation`). User must create Airtable table columns with these exact names.
- `validateSubmission` collects all errors in one pass and returns them as an object — the route handler and UI each decide independently which to surface first. This is more flexible than short-circuit validation.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- None.

## User Setup Required

Airtable configuration required before the metadata route works in production:

1. Add three env vars to Vercel dashboard (and `.env.local` for local dev):
   - `AIRTABLE_PAT` — Personal Access Token (format: `patXXX...`)
   - `AIRTABLE_BASE_ID` — Base ID from Airtable URL (format: `appXXX...`)
   - `AIRTABLE_TABLE_ID` — Table ID (format: `tblXXX...`)
2. Create Airtable table with these exact column names (case-sensitive):
   - `Name` (Single line text)
   - `Connection` (Single line text)
   - `Email` (Email)
   - `Phone` (Phone number)
   - `StoryText` (Long text)
   - `FileKey` (Single line text)
   - `SubmittedAt` (Date/time, ISO 8601)

## Next Phase Readiness
- Plan 02 (UI wiring) can now import `validateSubmission` from `@/app/utils/validateSubmission` for client-side validation
- Plan 02 can call `POST /api/submit/metadata` with the field shape: `{ name, relation, email, phone, textStory, fileKey }`
- No blockers — all server-side foundations ready

---
*Phase: 03-form-metadata-and-confirmation*
*Completed: 2026-03-17*

## Self-Check: PASSED

All artifacts verified:
- app/utils/validateSubmission.ts: FOUND
- __tests__/utils/validateSubmission.test.ts: FOUND
- app/api/submit/metadata/route.ts: FOUND
- __tests__/api/submit.test.ts: FOUND
- .env.local.example: FOUND
- Commit 64f569e: FOUND
- Commit 7b9b607: FOUND
