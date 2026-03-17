---
phase: 02-upload-ui
plan: 03
subsystem: ui
tags: [react, typescript, vercel, ios-safari, drag-drop, cors, manual-verification]

# Dependency graph
requires:
  - phase: 02-upload-ui
    plan: 02
    provides: UploadZone, ProgressBar, FileListRow, ErrorBanner, ShareStory components
  - phase: 02-upload-ui
    plan: 01
    provides: useFileUpload hook, isAcceptedFileType utility
provides:
  - Human-verified confirmation that iOS Safari file picker works on iPhone (UPLD-01)
  - Human-verified confirmation that desktop drag-and-drop works (UPLD-02)
  - Human-verified confirmation that progress bar fills during real XHR upload (UPLD-03)
  - Human-verified confirmation that error banner with retry appears on network failure (UPLD-04)
  - Human-verified confirmation that unsupported file types are rejected before upload (UPLD-05)
affects: [03-metadata-form]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CORS allowed.origins uses Cloudflare native nested-object format (not bare array) for wrangler 4.74 compatibility
    - localhost origins added to CORS for local dev without separate wrangler config

key-files:
  created: []
  modified:
    - cors.json (CORS fix — localhost origins + Cloudflare native format committed as 5c9427c)

key-decisions:
  - "CORS cors.json updated to Cloudflare native format (allowed.origins nested object) — required by wrangler 4.74; bare array with PascalCase AllowedOrigins caused silent failures during local dev"
  - "localhost:3000 and localhost:3001 added to CORS origins — enables local dev uploads without deploying, eliminates CORS errors when testing against real R2 bucket"

patterns-established:
  - "Pattern: Add localhost origins to CORS in early dev phases — saves round-trips to preview environment during component iteration"

requirements-completed: [UPLD-01, UPLD-02, UPLD-03, UPLD-04]

# Metrics
duration: ~10min
completed: 2026-03-17
---

# Phase 2 Plan 03: Upload UI Device Verification Summary

**All 5 upload UI behaviors verified on real devices: iOS Safari file picker (iPhone), desktop drag-and-drop, XHR progress bar, error/retry flow, and file type rejection — CORS fix for local dev committed as part of verification**

## Performance

- **Duration:** ~10 min (includes CORS fix iteration)
- **Started:** 2026-03-17T13:00:00Z
- **Completed:** 2026-03-17
- **Tasks:** 2 (1 auto, 1 human-verify checkpoint — approved)
- **Files modified:** 1 (cors.json)

## Accomplishments

- Build passes with zero R2 credential leaks in client bundle (`grep -r "R2_SECRET" .next/static/` returns empty)
- All 4 upload sub-components confirmed present (`ls app/components/upload/` shows UploadZone, ProgressBar, FileListRow, ErrorBanner)
- iOS Safari on iPhone correctly presents Camera, Photo Library, and Browse (Files app) options — no forced camera capture
- Desktop drag-and-drop initiates upload; red border visible on drag hover
- Progress bar visibly fills during real XHR upload with percentage label updating in real time
- Error banner with "Try again" link appears correctly on network failure (CORS block scenario triggered the error path)
- File type validation (UploadZone `isAcceptedFileType`) rejects PDFs and images before upload starts
- CORS fix: cors.json updated to Cloudflare native format — resolves local dev upload failures

## Task Commits

1. **Task 1: Deploy to preview and run automated smoke checks** — no new commit (read-only verification, build already clean)
2. **Task 2: Manual device verification** — approved by user

**CORS fix (deviation):** `5c9427c` — fix(cors): add localhost origins for local dev; use native Cloudflare format

## Files Created/Modified

- `cors.json` — Updated to Cloudflare native `allowed.origins` nested-object format; added localhost:3000 and localhost:3001 for local dev

## Decisions Made

- **CORS native format fix:** wrangler 4.74 requires the Cloudflare native format for R2 CORS rules (`{ "allowed": { "origins": [...] } }` not `[{ "AllowedOrigins": [...] }]`). The bare S3-style array was silently ignored, causing every PUT from the browser to fail with a CORS error. This was discovered during local dev upload testing.
- **localhost origins included in CORS:** Adding localhost:3000 and localhost:3001 to the R2 CORS allowlist means developers can test real uploads locally without deploying to a preview environment. No security implication since R2 credentials are server-side only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CORS format incompatible with wrangler 4.74**
- **Found during:** Task 1 / Task 2 setup (local dev upload attempt)
- **Issue:** cors.json used S3-style bare array format (`AllowedOrigins` PascalCase), which wrangler 4.74 does not accept for R2. All browser PUT requests to R2 failed with CORS errors during local testing.
- **Fix:** Updated cors.json to Cloudflare native format with `allowed.origins` nested object; added localhost origins for local dev
- **Files modified:** cors.json
- **Verification:** Local dev uploads succeed; `npx next build` still passes; preview deployment at https://mouse-doc.vercel.app functional
- **Committed in:** 5c9427c

---

**Total deviations:** 1 auto-fixed (CORS format bug)
**Impact on plan:** Required for local dev verification to succeed. No scope creep — cors.json was already in scope from Phase 1 infrastructure.

## Issues Encountered

- CORS format mismatch (wrangler 4.74 native format vs. S3-style) caused upload failures during local dev testing. Fixed in 5c9427c before manual device verification proceeded.

## User Setup Required

None — CORS fix was applied to the deployed R2 bucket via `wrangler r2 bucket cors put`. No manual steps required.

## Next Phase Readiness

- Complete upload pipeline verified on real devices — Phase 3 (metadata form) can build on top of the confirmed-working upload foundation
- `fileKey` is stored in ShareStory state after upload — Phase 3 metadata endpoint can read it for the Airtable write
- `relation` and `name` fields already in ShareStory state — Phase 3 adds them to the POST /api/submit payload
- No blockers for Phase 3 planning

---
*Phase: 02-upload-ui*
*Completed: 2026-03-17*

## Self-Check: PASSED
- cors.json: modified in commit 5c9427c (pre-existing, not created by this plan)
- .planning/phases/02-upload-ui/02-03-SUMMARY.md: FOUND (this file)
- Commit 5c9427c: FOUND (fix(cors): add localhost origins for local dev; use native Cloudflare format)
