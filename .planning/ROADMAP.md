# Roadmap: MOUSE — 50 Years on the Mat

## Overview

The site already has a landing page. What's missing is everything behind the "Share Your Story" button: a backend that generates presigned upload URLs, a wired upload UI with real progress feedback, and a submission form that saves metadata to Airtable and confirms success to the user. Three phases, strict dependencies — backend before UI, UI before metadata — because each phase produces a verified artifact that the next phase builds on.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (1.1, 2.1): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Backend Infrastructure** - R2 bucket provisioned, CORS verified, presigned URL endpoint working with a real browser PUT
- [ ] **Phase 2: Upload UI** - ShareStory component wired to presign endpoint, XHR progress bar, error handling, iOS file picker
- [ ] **Phase 3: Form, Metadata, and Confirmation** - All form fields wired, Airtable metadata write, text-only path, success confirmation screen

## Phase Details

### Phase 1: Backend Infrastructure
**Goal**: The storage backend is provisioned, secured, and verified — a real browser can PUT a file directly to R2 and get 200.
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. A real browser PUT from the Vercel production domain to R2 returns HTTP 200 with no CORS errors in DevTools
  2. R2 API credentials are not visible in any client-side bundle or network request
  3. Calling `/api/upload/presign` returns a time-limited signed PUT URL and a unique `fileKey` (UUID-prefixed)
  4. The R2 bucket rejects direct public access — files are only reachable via presigned URL
**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Install deps, Jest setup, R2 client module, presign route with unit tests
- [ ] 01-02-PLAN.md — R2 bucket provisioning, CORS config, env vars, browser smoke test

### Phase 2: Upload UI
**Goal**: A user on any device can select a file, watch it upload with a progress bar, and get clear feedback if something goes wrong.
**Depends on**: Phase 1
**Requirements**: UPLD-01, UPLD-02, UPLD-03, UPLD-04, UPLD-05
**Success Criteria** (what must be TRUE):
  1. On iOS Safari, tapping the upload button opens the file picker (camera roll and files accessible)
  2. On desktop, dragging a file onto the drop zone initiates the upload
  3. A progress bar is visible and updates in real time during the upload
  4. If the upload fails, a clear error message and a retry button appear — no silent failure
  5. Only video and audio files are accepted; selecting a wrong file type shows a validation error before upload starts
**Plans:** 3 plans

Plans:
- [ ] 02-01-PLAN.md — File validation utility + useFileUpload XHR hook with TDD unit tests
- [ ] 02-02-PLAN.md — Extract ShareStory, build sub-components (UploadZone, ProgressBar, FileListRow, ErrorBanner), wire to hook
- [ ] 02-03-PLAN.md — Deploy preview and manual device verification (iOS Safari, desktop drag-drop, progress, errors)

### Phase 3: Form, Metadata, and Confirmation
**Goal**: A complete submission reaches Chris — form fields captured, file keyed in R2, metadata record in Airtable, and the user sees a warm confirmation.
**Depends on**: Phase 2
**Requirements**: FORM-01, FORM-02, FORM-03, FORM-04, FORM-05, FORM-06, META-01, META-02, CONF-01, CONF-02
**Success Criteria** (what must be TRUE):
  1. Submitting without a file or text story is blocked — the form requires at least one
  2. A submission with a file creates an Airtable record containing name, connection, optional contact info, the R2 file key, and timestamp
  3. A text-only submission (no file) creates an Airtable record containing the typed story text and all form fields
  4. After a successful submission, the user sees a confirmation screen personalized with their name
  5. Chris can open Airtable and see all submissions with enough context to identify and retrieve each one
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Infrastructure | 1/2 | In Progress|  |
| 2. Upload UI | 0/3 | Not started | - |
| 3. Form, Metadata, and Confirmation | 0/? | Not started | - |
