# Requirements: MOUSE — 50 Years on the Mat

**Defined:** 2026-03-16
**Core Value:** Former wrestlers and community members can easily submit their stories (video, audio, or text) from any device — and those files land somewhere Chris can actually access them.

## v1 Requirements

### Infrastructure

- [ ] **INFRA-01**: Cloudflare R2 bucket is provisioned with correct CORS policy allowing browser PUT uploads
- [ ] **INFRA-02**: R2 API credentials are stored as Vercel environment variables (never NEXT_PUBLIC_)
- [ ] **INFRA-03**: `/api/upload/presign` route generates a time-limited signed PUT URL and returns `{ uploadUrl, fileKey }`
- [ ] **INFRA-04**: Storage keys are generated server-side with UUID prefix to prevent collisions

### Metadata

- [ ] **META-01**: `/api/submit/metadata` route saves submission record to Airtable after upload confirms
- [ ] **META-02**: Submission record includes: name, email, phone, connection to Coach McCollum, file key (or text story), timestamp

### Upload UI

- [ ] **UPLD-01**: User can select a file via tap/click button (iOS-compatible `<input type="file">`)
- [ ] **UPLD-02**: User can drag-and-drop a file on desktop
- [ ] **UPLD-03**: User sees a progress bar during upload (XHR-based, not fetch)
- [ ] **UPLD-04**: User sees a clear error message and retry button if upload fails
- [ ] **UPLD-05**: Upload accepts video and audio files (video/*, audio/*)

### Form

- [ ] **FORM-01**: User enters their name (required)
- [ ] **FORM-02**: User enters their connection to Coach McCollum (required)
- [ ] **FORM-03**: User enters email address (optional)
- [ ] **FORM-04**: User enters phone number (optional)
- [ ] **FORM-05**: User can type a text story in a textarea as an alternative or addition to file upload
- [ ] **FORM-06**: Form requires either a file or text story before submission is allowed

### Confirmation

- [ ] **CONF-01**: User sees a success confirmation screen after submission completes
- [ ] **CONF-02**: Success screen is personalized with the user's name

## v2 Requirements

### Resilience

- **RESIL-01**: Multipart/chunked upload for files over 500MB (requires additional API routes)
- **RESIL-02**: Auto-resume interrupted uploads on reconnect (TUS protocol)

### Notifications

- **NOTF-01**: Chris receives email notification when a new submission arrives
- **NOTF-02**: Submitter receives confirmation email after successful upload

### Admin

- **ADMIN-01**: Lightweight submission viewer (beyond Airtable UI) — defer until volume warrants it

## Out of Scope

| Feature | Reason |
|---------|--------|
| User accounts / login | Anonymous submissions only — no auth infrastructure needed |
| Video playback in-browser | Files are research material, not display content |
| Admin dashboard (v1) | Chris accesses files via R2 + Airtable directly |
| Real-time transcription | Out of scope for story collection phase |
| Social sharing | Not relevant to documentary research use case |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| UPLD-01 | Phase 2 | Pending |
| UPLD-02 | Phase 2 | Pending |
| UPLD-03 | Phase 2 | Pending |
| UPLD-04 | Phase 2 | Pending |
| UPLD-05 | Phase 2 | Pending |
| FORM-01 | Phase 3 | Pending |
| FORM-02 | Phase 3 | Pending |
| FORM-03 | Phase 3 | Pending |
| FORM-04 | Phase 3 | Pending |
| FORM-05 | Phase 3 | Pending |
| FORM-06 | Phase 3 | Pending |
| META-01 | Phase 3 | Pending |
| META-02 | Phase 3 | Pending |
| CONF-01 | Phase 3 | Pending |
| CONF-02 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 after initial definition*
