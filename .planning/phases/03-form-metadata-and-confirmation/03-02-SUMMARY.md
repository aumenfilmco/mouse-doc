---
phase: 03-form-metadata-and-confirmation
plan: 02
subsystem: ui
tags: [react, airtable, form-validation, inline-styles, fetch]

# Dependency graph
requires:
  - phase: 03-01
    provides: validateSubmission utility, useFileUpload hook, /api/submit/metadata route
provides:
  - Complete submission form with email, phone, textarea, validation, metadata POST, MetadataErrorBanner, and confirmation trigger
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - localFileKey captured directly from upload() return value (not React state) to avoid stale closure in async handleSubmit
    - fileKey stored in React state as a fallback for the retry handler's closure
    - isMobile responsive grid via useEffect + window.innerWidth (no Tailwind — inline styles project pattern)
    - inputStyle object extracted for DRY inline styles across all input fields

key-files:
  created: []
  modified:
    - app/components/ShareStory.tsx

key-decisions:
  - "localFileKey captured from upload() return value inside handleSubmit — not from React state (stale closure risk documented in 03-RESEARCH.md)"
  - "fileKey React state retained as retry fallback — handleMetadataRetry reads state since it cannot access handleSubmit's closed-over localFileKey"
  - "Both tasks (form fields + handleSubmit wiring) implemented in a single commit — same file, atomic change"

patterns-established:
  - "Responsive grid: isMobile useState + useEffect with window.innerWidth resize listener — project uses inline styles, no Tailwind breakpoints"
  - "Validation error display: p role=alert below each input field, cleared on blur; FORM-06 error above submit button"

requirements-completed: [FORM-01, FORM-02, FORM-03, FORM-04, FORM-05, FORM-06, META-01, META-02, CONF-01, CONF-02]

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 3 Plan 02: Form Fields, Validation, and Metadata POST Summary

**Full submission pipeline wired in ShareStory.tsx: 5-field form with client-side validation, text-only + file paths both posting to Airtable via /api/submit/metadata, MetadataErrorBanner with retry, and confirmation screen trigger on success**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-17T15:44:59Z
- **Completed:** 2026-03-17T15:47:36Z
- **Tasks:** 2 (both implemented in a single atomic commit — same file)
- **Files modified:** 1

## Accomplishments
- Added email, phone, and textarea fields with correct placeholders, styles, and aria attributes per UI-SPEC
- Added client-side validation using validateSubmission from Plan 01; errors render inline below each field
- Rewrote handleSubmit: validation gate → optional file upload → metadata POST to /api/submit/metadata
- Text-only path: when no files selected and textStory non-empty, submit bypasses upload loop and POSTs directly to metadata endpoint
- Added MetadataErrorBanner with "Try again" retry button; re-POSTs metadata without re-uploading
- Submit button reflects three states: UPLOADING... / SAVING... / SUBMIT YOUR STORY
- Mobile grid collapses to single column below 640px via isMobile responsive state
- Build succeeded, all 38 tests passed with no regressions

## Task Commits

1. **Tasks 1+2: Add form fields, validation, handleSubmit wiring, MetadataErrorBanner, confirmation** - `522be28` (feat)

**Plan metadata:** _(pending docs commit)_

## Files Created/Modified
- `app/components/ShareStory.tsx` - Extended with email/phone/textarea fields, validation state, responsive grid, rewritten handleSubmit, handleMetadataRetry, MetadataErrorBanner

## Decisions Made
- localFileKey captured directly from upload() return value (not from fileKey React state) to avoid stale closure — this was the key pitfall from 03-RESEARCH.md
- fileKey React state is still set (setFileKey(key)) after each successful upload so the retry handler can reference it via closure
- Both tasks combined into one commit since they modify the same file; the final state satisfies all acceptance criteria for both tasks

## Deviations from Plan

None — plan executed exactly as written. Both tasks implemented together since they operate on the same file with no intermediate verification step that required separate commits.

## Issues Encountered

None — build and tests passed on first attempt.

## User Setup Required

Airtable setup is required before the metadata POST will succeed in production. See plan frontmatter for exact steps:
- Create `AIRTABLE_PAT`, `AIRTABLE_BASE_ID`, `AIRTABLE_TABLE_ID` environment variables
- Create Airtable table with columns: Name, Connection, Email, Phone, StoryText, FileKey, SubmittedAt

## Next Phase Readiness

Phase 3 complete. The full submission pipeline is functional end-to-end:
- File submissions: upload to R2 → metadata POST to Airtable → confirmation screen
- Text-only submissions: metadata POST directly to Airtable → confirmation screen
- All validation, error states, and accessibility requirements met per UI-SPEC

---
*Phase: 03-form-metadata-and-confirmation*
*Completed: 2026-03-17*

## Self-Check: PASSED

- ShareStory.tsx: FOUND
- 03-02-SUMMARY.md: FOUND
- Commit 522be28: FOUND
