---
phase: 01-backend-infrastructure
plan: 01
subsystem: infra
tags: [cloudflare-r2, aws-sdk-v3, presigned-url, nanoid, jest, ts-jest, next-app-router]

# Dependency graph
requires: []
provides:
  - "S3Client singleton for Cloudflare R2 at lib/storage/r2.ts"
  - "POST /api/upload/presign route returning { uploadUrl, fileKey }"
  - "Jest test infrastructure with ts-jest and @/ path alias"
  - "Unit tests covering response shape, key format, sanitization, SDK args, expiry, error handling, credential isolation"
  - ".env.local.example documenting all 4 required R2 env vars"
affects: [02-upload-ui, 03-metadata-submission]

# Tech tracking
tech-stack:
  added:
    - "@aws-sdk/client-s3 v3"
    - "@aws-sdk/s3-request-presigner v3"
    - "nanoid v5"
    - "jest v30"
    - "ts-jest v29"
    - "ts-node v10"
  patterns:
    - "S3Client singleton — initialized once at module level, imported by route handlers"
    - "Presigned PUT URL — route returns { uploadUrl, fileKey }; file bytes never touch Vercel"
    - "Server-side key generation — submissions/YYYY-MM/{nanoid21}-{sanitized_filename}"
    - "TDD cycle — RED (tests fail) then GREEN (implementation passes)"

key-files:
  created:
    - lib/storage/r2.ts
    - app/api/upload/presign/route.ts
    - __tests__/api/upload/presign.test.ts
    - jest.config.ts
    - .env.local.example
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "nanoid v5 is ESM-only; jest.config.ts must include transformIgnorePatterns and explicit transform config to handle it with ts-jest"
  - "jest.mock factory runs before variable initialization — mock functions must be defined inline in the factory, not via outer variables"
  - ".env.local.example force-added to git despite .env* gitignore pattern — template file must be committed"
  - "fileKey extraction in sanitization test uses slice(22) to skip 21-char nanoid + hyphen, not split('-').slice(1) (nanoid itself contains hyphens)"

patterns-established:
  - "R2 client pattern: export const r2Client = new S3Client({ region: 'auto', endpoint via CLOUDFLARE_ACCOUNT_ID })"
  - "Presign route pattern: POST accepts { filename, contentType }, returns { uploadUrl, fileKey } or 400"
  - "Key format: submissions/YYYY-MM/{nanoid()}-{filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"
  - "Test mock pattern: jest.mock factories inline, access mocks via require() in test bodies"

requirements-completed: [INFRA-02, INFRA-03, INFRA-04]

# Metrics
duration: 4min
completed: 2026-03-16
---

# Phase 1 Plan 01: Install Dependencies and Create Presign Route Summary

**Cloudflare R2 presigned PUT URL route using AWS SDK v3 with nanoid key generation, Jest TDD test suite covering 9 cases, zero NEXT_PUBLIC_ credential exposure**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-16T18:12:36Z
- **Completed:** 2026-03-16T18:16:37Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- POST /api/upload/presign returns `{ uploadUrl, fileKey }` with 900-second expiry signed by Cloudflare R2 via AWS SDK v3
- fileKey uses server-generated nanoid prefix under `submissions/YYYY-MM/` preventing filename collisions and client control of storage paths
- 9-test Jest suite validates response shape, key format regex, filename sanitization, SDK call args, expiry parameter, error handling (3 cases), and credential isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and configure Jest test infrastructure** - `8fdd3e6` (chore)
2. **Task 2: Create R2 client module and presign route with tests** - `03171d4` (feat)

## Files Created/Modified

- `lib/storage/r2.ts` — S3Client singleton configured for Cloudflare R2 endpoint, exports `r2Client`
- `app/api/upload/presign/route.ts` — POST handler: validates body, generates `submissions/YYYY-MM/{nanoid}-{safeName}` key, calls getSignedUrl with expiresIn 900, returns `{ uploadUrl, fileKey }`
- `__tests__/api/upload/presign.test.ts` — 9 unit tests covering all plan behaviors; AWS SDK mocked
- `jest.config.ts` — Jest config with ts-jest, node environment, @/ alias, transformIgnorePatterns for nanoid ESM
- `.env.local.example` — Template documenting CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
- `package.json` — Added test script and new dependencies
- `package-lock.json` — Updated lockfile

## Decisions Made

- Used `transformIgnorePatterns: ["node_modules/(?!(nanoid)/)"]` in jest.config.ts because nanoid v5 ships ESM-only and ts-jest needs to transform it for CommonJS Jest
- Defined jest.mock factories inline rather than referencing outer const variables — Jest hoists mock calls and the const would not yet be initialized
- Force-added `.env.local.example` with `git add -f` because the `.gitignore` uses `.env*` which matches example/template files that should be committed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed ts-node (required for jest.config.ts parsing)**
- **Found during:** Task 1 verification
- **Issue:** Jest 30 requires ts-node to parse a TypeScript jest.config.ts file; it was not included in the plan's install command
- **Fix:** Ran `npm install --save-dev ts-node`
- **Files modified:** package.json, package-lock.json
- **Verification:** `npx jest` ran successfully with placeholder test passing
- **Committed in:** `8fdd3e6` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed jest.mock initialization order (cannot reference outer variable in factory)**
- **Found during:** Task 2 RED phase run
- **Issue:** `const mockGetSignedUrl = jest.fn()` defined before `jest.mock(...)` factory — Jest hoists mock calls so the variable is uninitialized when factory runs
- **Fix:** Moved `jest.fn()` inline into the mock factory; access the mock in tests via `require("@aws-sdk/s3-request-presigner")`
- **Files modified:** `__tests__/api/upload/presign.test.ts`
- **Verification:** Test suite ran without ReferenceError
- **Committed in:** `03171d4` (Task 2 commit)

**3. [Rule 1 - Bug] Added transformIgnorePatterns for nanoid ESM module**
- **Found during:** Task 2 GREEN phase run
- **Issue:** nanoid v5 uses `import` statement in its entry point — Jest's default CJS transform skips node_modules and cannot parse it
- **Fix:** Added `transformIgnorePatterns: ["node_modules/(?!(nanoid)/)"]` and explicit `transform` config to jest.config.ts
- **Files modified:** `jest.config.ts`
- **Verification:** nanoid imported correctly in route; all 9 tests pass
- **Committed in:** `03171d4` (Task 2 commit)

**4. [Rule 1 - Bug] Fixed sanitization test name extraction logic**
- **Found during:** Task 2 GREEN phase — 1 test failing after other fixes
- **Issue:** Test extracted name portion with `.split("-").slice(1).join("-")` — nanoid itself contains hyphens, so this split produced wrong result
- **Fix:** Used `.slice(22)` to skip the fixed-length 21-char nanoid plus its hyphen separator
- **Files modified:** `__tests__/api/upload/presign.test.ts`
- **Verification:** `my_video__1_.mov` assertion passes
- **Committed in:** `03171d4` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (1 blocking, 3 bug)
**Impact on plan:** All fixes necessary for test infrastructure to run. No scope creep. Core implementation matches plan exactly.

## Issues Encountered

None beyond what is documented in deviations above.

## User Setup Required

**External services require manual configuration before the presign route can generate real URLs.** Add these to `.env.local` (copy from `.env.local.example`):

| Env Var | Where to get it |
|---------|----------------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard → R2 → Overview → Account ID (right sidebar) |
| `R2_ACCESS_KEY_ID` | Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create API Token |
| `R2_SECRET_ACCESS_KEY` | Same token creation — shown only once |
| `R2_BUCKET_NAME` | Set to `mouse-doc-uploads` (create bucket first via wrangler) |

Unit tests use mocks and pass without real credentials. A live bucket and real env vars are needed for the end-to-end smoke test (Phase 1 manual verification).

## Next Phase Readiness

- POST /api/upload/presign is ready to call from any client component
- Unit tests are green and provide regression coverage
- R2 client module is isolated to `lib/storage/` — importing it in any client component would expose credentials (safe as long as it stays in `app/api/`)
- Phase 2 (upload UI) can wire `ShareStory` to call this endpoint and PUT to the returned `uploadUrl`
- Blocker still open: R2 bucket needs to be provisioned and CORS configured via Wrangler before any browser PUT will succeed

## Self-Check: PASSED

- lib/storage/r2.ts: FOUND
- app/api/upload/presign/route.ts: FOUND
- __tests__/api/upload/presign.test.ts: FOUND
- jest.config.ts: FOUND
- .env.local.example: FOUND
- 01-01-SUMMARY.md: FOUND
- Commit 8fdd3e6: FOUND
- Commit 03171d4: FOUND

---
*Phase: 01-backend-infrastructure*
*Completed: 2026-03-16*
