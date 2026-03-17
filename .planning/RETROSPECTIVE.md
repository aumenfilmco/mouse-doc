# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-17
**Phases:** 3 | **Plans:** 8 | **Sessions:** ~8 (1 per plan)

### What Was Built
- Cloudflare R2 presigned PUT URL backend — file bytes never touch Vercel, server-side key generation
- Upload UI — UploadZone (drag-drop + iOS-safe), ProgressBar (ARIA), FileListRow, ErrorBanner with XHR progress
- Form — 5-field submission form with client-side validation, text-only path, Airtable metadata write, confirmation screen
- 38 automated tests with zero regressions across the full stack

### What Worked
- TDD discipline held throughout — every backend module written RED → GREEN, no exceptions
- Phase dependency design (backend → UI → form) meant each phase had a real verified artifact to build on
- Extracting XHR logic to standalone `performUpload` function made testing completely clean without React testing utilities
- Manual device verification checkpoint (iOS Safari + desktop drag-drop) caught the CORS format bug before it could affect users
- Presigned URL architecture eliminated the Vercel 4.5MB function limit as a concern entirely

### What Was Inefficient
- INFRA-01 checkbox in REQUIREMENTS.md was never updated to `[x]` despite the requirement being demonstrably met in 01-02 — traceability table maintenance lagged behind reality
- MILESTONES.md "Key accomplishments" not auto-populated by CLI (summary `one_liner` field not in expected frontmatter format) — required manual fill
- STATE.md had incorrect `percent: 50` and `milestone_name: "milestone"` after CLI milestone complete ran — needed manual correction

### Patterns Established
- Separate XHR logic (`performUpload`) from React state (`useFileUpload`) — core async behavior stays testable in jsdom without React test utilities
- Per-file `@jest-environment jsdom` docblock instead of changing global `jest.config.ts` testEnvironment
- `localFileKey` captured from async function return value (not React state) to avoid stale closure in event handlers
- CORS for R2: use Cloudflare native `allowed.origins` nested-object format, not S3-style bare array — wrangler 4.74 requires this

### Key Lessons
1. **Cloudflare native CORS format** — Always use `{ "allowed": { "origins": [...] } }` for R2 CORS; S3-style `AllowedOrigins` is silently ignored by wrangler 4.74
2. **Add localhost to CORS early** — Adding localhost:3000/3001 in Phase 1 saved round-trips to preview environment during all subsequent phases
3. **nanoid v5 ESM** — Requires `transformIgnorePatterns: ["node_modules/(?!(nanoid)/)"]` in jest.config.ts; otherwise ts-jest can't parse it
4. **jest.mock factory initialization** — Never reference outer `const` variables in `jest.mock()` factories; define `jest.fn()` inline and access via `require()` in test bodies
5. **React state batching in async loops** — After a `for...of` upload loop, use `setTimeout(0)` callback to read latest state via functional setter; the loop closure holds stale state

### Cost Observations
- Model mix: ~100% sonnet (gsd balanced profile)
- Sessions: ~8 (one per plan execution)
- Notable: Entire MVP shipped in 2 days with 8 plans, 38 tests, zero manual code fixes — TDD caught all issues during RED phase before implementation

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 MVP | ~8 | 3 | First milestone — baseline established |

### Cumulative Quality

| Milestone | Tests | Zero-Dep Additions |
|-----------|-------|--------------------|
| v1.0 MVP | 38 | 0 (inline styles, no new shared utilities) |

### Top Lessons (Verified Across Milestones)

1. TDD RED→GREEN discipline prevents late-discovered bugs and makes verification trivial
2. Presigned URL architecture is the correct pattern for browser-to-storage uploads in serverless environments
