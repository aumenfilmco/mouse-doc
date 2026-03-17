---
phase: 03-form-metadata-and-confirmation
verified: 2026-03-17T00:00:00Z
status: human_needed
score: 21/21 must-haves verified
re_verification: false
human_verification:
  - test: "Validation errors fire correctly on submit"
    expected: "Empty name shows 'Your name is required.', empty relation shows 'Your connection to Coach McCollum is required.', no file and no text shows FORM-06 error above submit button"
    why_human: "DOM rendering and conditional error display cannot be verified without running the browser"
  - test: "Email blur validation shows and clears inline error"
    expected: "Typing 'bad' in email field and tabbing out shows 'Please enter a valid email address.' below the field; correcting to 'good@example.com' and tabbing out clears the error"
    why_human: "onBlur behavior and DOM state requires browser interaction"
  - test: "Text-only submission path end-to-end"
    expected: "Fill name + relation + textarea (no file), click submit — button shows 'SAVING...', confirmation screen appears with 'Thank you, {name}.', Airtable record has StoryText populated and FileKey empty"
    why_human: "Requires live Airtable credentials and visual confirmation of confirmation screen"
  - test: "File upload + metadata submission path end-to-end"
    expected: "Upload a file, fill all fields, click submit — button shows 'UPLOADING...' then 'SAVING...', confirmation appears, Airtable record has all fields including FileKey as a submissions/YYYY-MM/... path"
    why_human: "Requires live R2 and Airtable credentials, real file upload, and visual confirmation"
  - test: "MetadataErrorBanner retry behavior"
    expected: "If /api/submit/metadata returns a non-2xx, a red banner appears with 'We couldn't save your submission. Your file is safe — please try again.' and a 'Try again' button that re-POSTs"
    why_human: "Requires simulating a metadata API failure and verifying retry re-POST behavior in browser"
  - test: "Mobile responsive grid collapses"
    expected: "At viewport width less than 640px, name/relation stack vertically and email/phone stack vertically (single-column layout)"
    why_human: "Visual layout cannot be verified programmatically; requires browser resize or DevTools responsive mode"
---

# Phase 3: Form Metadata and Confirmation — Verification Report

**Phase Goal:** Complete submission form with metadata capture and confirmation screen
**Verified:** 2026-03-17
**Status:** human_needed (all automated checks passed; 6 items require browser/Airtable verification)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All 21 must-have truths across Plans 01, 02, and 03 are addressed. Results by plan:

#### Plan 01 Truths (backend logic)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | validateSubmission returns errors for empty name | VERIFIED | Line 18-20 of validateSubmission.ts: `if (input.name.trim() === "") { errors.name = "Your name is required."; }` — test #1 passes |
| 2 | validateSubmission returns errors for empty relation | VERIFIED | Line 22-24: `errors.relation = "Your connection to Coach McCollum is required."` — test #2 passes |
| 3 | validateSubmission returns email format error when email present but missing @ | VERIFIED | Line 26-28: `if (input.email !== "" && !input.email.includes("@"))` — test #4 passes |
| 4 | validateSubmission returns FORM-06 error when no files and no textStory | VERIFIED | Line 30-32: `if (!input.hasFile && input.textStory.trim() === "")` — test #3 passes |
| 5 | validateSubmission returns no errors for valid file-upload submission | VERIFIED | Test #5 passes: `{ valid: true, errors: {} }` |
| 6 | validateSubmission returns no errors for valid text-only submission | VERIFIED | Test #6 passes |
| 7 | /api/submit/metadata returns 200 and posts to Airtable on valid input | VERIFIED | route.ts line 45-68: fetch to `api.airtable.com/v0/${BASE_ID}/${TABLE_ID}` with all 7 fields; test #1 passes |
| 8 | /api/submit/metadata returns 400 when name is missing | VERIFIED | route.ts line 39-43: returns first validation error; test #2 passes |
| 9 | /api/submit/metadata returns 502 when Airtable responds with non-2xx | VERIFIED | route.ts line 71-73: `if (!res.ok)` returns 502; test #5 passes |

#### Plan 02 Truths (form UI wiring)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 10 | User can enter email in a dedicated input field | VERIFIED | ShareStory.tsx line 379-395: `type="email"` input with `value={email}` and `onChange={(e) => setEmail(e.target.value)}` |
| 11 | User can enter phone in a dedicated input field | VERIFIED | ShareStory.tsx line 398-407: `type="tel"` input with `value={phone}` and `onChange={(e) => setPhone(e.target.value)}` |
| 12 | User can type a text story in a textarea | VERIFIED | ShareStory.tsx line 411-432: `<textarea>` with `value={textStory}` and `onChange` handler |
| 13 | Submitting without a file or text story is blocked with a visible error | VERIFIED | handleSubmit calls validateSubmission with `hasFile: files.length > 0`; form06Error rendered at line 506-516 |
| 14 | Submitting without a name shows a validation error | VERIFIED | handleSubmit sets nameError from validation.errors.name; rendered at line 355 |
| 15 | Submitting without a relation shows a validation error | VERIFIED | handleSubmit sets relationError; rendered at line 372 |
| 16 | Email with no @ shows a validation error on blur | VERIFIED | onBlur handler at line 387-394 calls `setEmailError("Please enter a valid email address.")` when email lacks @ |
| 17 | Submitting with a file creates an Airtable record via /api/submit/metadata | VERIFIED | handleSubmit line 180-191: `fetch("/api/submit/metadata", ...)` with `fileKey: localFileKey` after upload loop |
| 18 | Submitting text-only (no file) creates an Airtable record via /api/submit/metadata | VERIFIED | handleSubmit: `if (files.length > 0)` guard skips upload loop; falls through to metadata POST at line 180 |
| 19 | After successful metadata POST, user sees confirmation screen with their name | VERIFIED | `if (res.ok) { setSubmitted(true); }` at line 193-194; confirmation renders `Thank you{name ? ", ${name}" : ""}.` at line 563 |
| 20 | If metadata POST fails, MetadataErrorBanner appears with retry button | VERIFIED | `setMetadataError(true)` at lines 196 and 199; MetadataErrorBanner rendered at lines 465-503 with `handleMetadataRetry` on "Try again" button |
| 21 | Submit button shows SAVING... during metadata POST | VERIFIED | Line 526: `{isUploading ? "UPLOADING..." : isMetadataPosting ? "SAVING..." : "SUBMIT YOUR STORY"}` |

#### Plan 03 Truths (manual E2E verification)

Plan 03 truths are listed in the `human_verification` section — all require browser and live Airtable credentials.

**Score:** 21/21 automated truths verified

---

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `app/utils/validateSubmission.ts` | VERIFIED | 39 lines, exports `validateSubmission`, `SubmissionInput`, `ValidationResult` — substantive implementation |
| `__tests__/utils/validateSubmission.test.ts` | VERIFIED | 105 lines (min 40), 7 test cases, all passing |
| `app/api/submit/metadata/route.ts` | VERIFIED | 77 lines, exports `POST`, calls Airtable API, uses validateSubmission |
| `__tests__/api/submit.test.ts` | VERIFIED | 177 lines (min 50), 6 test cases, all passing |
| `.env.local.example` | VERIFIED | Contains AIRTABLE_PAT, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID |
| `app/components/ShareStory.tsx` | VERIFIED | 583 lines, contains all 5 form fields, validation wiring, metadata POST, confirmation |

---

## Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `app/api/submit/metadata/route.ts` | `https://api.airtable.com/v0/{baseId}/{tableId}` | fetch POST with Bearer token | WIRED | Line 45-46: `fetch(\`https://api.airtable.com/v0/...\`, { headers: { Authorization: \`Bearer ${process.env.AIRTABLE_PAT}\` } })` |
| `app/api/submit/metadata/route.ts` | `app/utils/validateSubmission.ts` | import validateSubmission | WIRED | Line 2: `import { validateSubmission } from "@/app/utils/validateSubmission"` — called at line 30 |
| `app/components/ShareStory.tsx` | `/api/submit/metadata` | fetch POST in handleSubmit | WIRED | Line 180: `fetch("/api/submit/metadata", { method: "POST", ... })` — response handled at lines 193-200 |
| `app/components/ShareStory.tsx` | `app/utils/validateSubmission.ts` | import validateSubmission | WIRED | Line 8: `import { validateSubmission } from "@/app/utils/validateSubmission"` — called at line 137 |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FORM-01 | 03-01, 03-02 | User enters their name (required) | SATISFIED | name input with aria-required, nameError state, validation error rendered below field |
| FORM-02 | 03-01, 03-02 | User enters their connection to Coach McCollum (required) | SATISFIED | relation input with aria-required, relationError rendered below field |
| FORM-03 | 03-01, 03-02 | User enters email address (optional) | SATISFIED | type="email" input with onBlur email format validation |
| FORM-04 | 03-01, 03-02 | User enters phone number (optional) | SATISFIED | type="tel" input present |
| FORM-05 | 03-02 | User can type a text story as alternative or addition to file upload | SATISFIED | `<textarea>` present with value/onChange wiring |
| FORM-06 | 03-01, 03-02 | Form requires either a file or text story before submission | SATISFIED | validateSubmission checks `!hasFile && textStory.trim() === ""`; isDisabled enforces `files.length === 0 && textStory.trim().length === 0` |
| META-01 | 03-01, 03-02 | /api/submit/metadata saves submission record to Airtable after upload | SATISFIED | route.ts POSTs to Airtable REST API; ShareStory.tsx calls it after upload completes |
| META-02 | 03-01, 03-02 | Submission record includes name, email, phone, connection, file key or story, timestamp | SATISFIED | route.ts fields: Name, Connection, Email, Phone, StoryText, FileKey, SubmittedAt |
| CONF-01 | 03-02 | User sees a success confirmation screen after submission | SATISFIED | `setSubmitted(true)` on `res.ok`; `{!submitted ? <form> : <ConfirmationCard>}` conditional render |
| CONF-02 | 03-02 | Success screen is personalized with user's name | SATISFIED | Confirmation renders: `Thank you{name ? \`, ${name}\` : ""}.` |

**All 10 declared requirement IDs verified as satisfied.**

**Orphaned requirements check:** REQUIREMENTS.md maps FORM-01 through FORM-06, META-01, META-02, CONF-01, CONF-02 to Phase 3. All 10 appear in the plans' `requirements` fields. No orphaned requirements.

---

## Anti-Patterns Found

None. Scanned `app/utils/validateSubmission.ts`, `app/api/submit/metadata/route.ts`, and `app/components/ShareStory.tsx` for:
- TODO/FIXME/HACK/PLACEHOLDER comments — none found
- Empty implementations (`return null`, `return {}`, `=> {}`) — none found
- `setTimeout` stubs in handleSubmit — none found (old block removed as required by plan)
- Console-log-only handlers — none found

---

## Human Verification Required

The following items cannot be verified programmatically. They require a running dev server and (for tests 3-5) live Airtable credentials.

### 1. Validation Errors Fire on Submit

**Test:** Navigate to `http://localhost:3000/#story`. Leave all fields empty, click "SUBMIT YOUR STORY".
**Expected:** Error "Your name is required." appears below the name field. Fill in name, click again — "Your connection to Coach McCollum is required." appears. Fill relation, click again with no file and no text — "Please add a file or type your story — we need at least one." appears above the submit button.
**Why human:** Conditional DOM rendering and React state error flow require browser execution.

### 2. Email Blur Validation

**Test:** Type "bad" in the email field, then tab out. Then change to "good@example.com" and tab out.
**Expected:** After "bad" and blur: "Please enter a valid email address." appears below the email field. After "good@example.com" and blur: error disappears.
**Why human:** onBlur event and DOM error-clear behavior require browser interaction.

### 3. Text-Only Submission End-to-End

**Test:** Fill name + relation. Type a story in the textarea. Leave no file selected. Click submit.
**Expected:** Button briefly shows "SAVING...", then confirmation card shows "Thank you, {name}." Open Airtable — verify a record exists with Name, Connection, StoryText populated and FileKey empty.
**Why human:** Requires live Airtable credentials (AIRTABLE_PAT, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID) and visual confirmation of the confirmation screen.

### 4. File Upload + Metadata Submission End-to-End

**Test:** Refresh page. Fill name + relation + email + phone. Upload a small audio or video file. Click submit.
**Expected:** Button shows "UPLOADING...", progress bar fills, then "SAVING...", then confirmation screen. Airtable record has all 7 fields including a FileKey like `submissions/YYYY-MM/uuid-filename.ext`.
**Why human:** Requires live R2 and Airtable credentials, real file upload to R2, and visual verification of both states.

### 5. MetadataErrorBanner and Retry

**Test:** Simulate a metadata failure (temporarily set a wrong AIRTABLE_PAT or AIRTABLE_TABLE_ID, or intercept in DevTools). Submit a valid form.
**Expected:** Red banner appears: "We couldn't save your submission. Your file is safe — please try again." with a "Try again" button. Clicking "Try again" re-POSTs to `/api/submit/metadata` without re-uploading the file.
**Why human:** Requires controlled failure of the Airtable endpoint and observation of retry behavior.

### 6. Mobile Responsive Grid

**Test:** Open the form on a viewport narrower than 640px (browser DevTools responsive mode or physical mobile device).
**Expected:** Name and relation inputs stack vertically (single column). Email and phone inputs stack vertically.
**Why human:** Visual layout is controlled by the `isMobile` state from `window.innerWidth`; cannot verify CSS rendering programmatically.

---

## Gaps Summary

No gaps found. All automated checks passed.

The only outstanding items are the 6 human verification tests — these test visual rendering, real-time state transitions, and external service integration (Airtable/R2), none of which can be verified by static code inspection or unit tests alone. Plan 03-03 SUMMARY.md documents that a human already approved all 5 test scenarios against live Airtable. If that approval is considered sufficient, the phase can be considered fully complete. If a fresh human verification pass is desired, the 6 tests above constitute the full checklist.

---

_Verified: 2026-03-17_
_Verifier: Claude (gsd-verifier)_
