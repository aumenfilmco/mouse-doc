# Project Research Summary

**Project:** MOUSE Documentary Story Collection App
**Domain:** Large file upload (video/audio), Next.js 16, Vercel, cloud object storage
**Researched:** 2026-03-16
**Confidence:** HIGH

## Executive Summary

MOUSE is a community story-collection web app for a documentary film, designed to receive video and audio submissions from older alumni who are primarily phone-first and not highly technical. The core technical challenge is large file upload (50–500 MB) on a Vercel-hosted Next.js 16 app — a combination that creates a hard architectural constraint: Vercel's 4.5 MB serverless function body limit makes it impossible to proxy files through the server. The only viable pattern is presigned URL direct-to-storage upload, where the Next.js API routes only handle lightweight JSON (signing requests and saving metadata) while file bytes go directly from the browser to Cloudflare R2. This is well-documented, well-supported by the Uppy 5.x library, and the right call for this project.

The recommended stack is Cloudflare R2 (zero egress fees, ~$0.23/month for this use case), `@aws-sdk/client-s3` for presigned URL generation server-side, Uppy 5.x for the client-side upload UI with built-in progress, multipart, and retry handling, and Airtable as the metadata store so Chris can browse submissions without a custom admin UI. The form must support both file upload and text-only paths, and every UX decision should favor older, mobile-first users: large tap targets, plain-language labels, visible progress, clear confirmation.

The primary risks are operational and UX, not technical. The patterns for this type of app are well-established and all source material is from official documentation. The most dangerous mistakes are CORS misconfiguration on the R2 bucket (verified to behave differently from S3), routing file bytes through Vercel functions (immediate 413 error), and shipping without an upload progress bar (older users will re-submit, creating duplicate orphaned files). All three pitfalls must be addressed in the backend setup and upload UI phases before any other feature work begins.

## Key Findings

### Recommended Stack

Cloudflare R2 is the clear storage choice: zero egress fees eliminate the cost risk of repeated downloads, and at an estimated 15 GB of submissions R2 costs approximately $0.23/month total compared to $1.70/month for S3 or $25/month minimum for UploadThing. R2 is S3-compatible, so `@aws-sdk/client-s3@3.x` works without a vendor-specific SDK. Uppy 5.x (August 2025) provides headless React hooks that integrate cleanly with an existing component UI, handles multipart uploads automatically above 100 MB, exposes XHR-based progress events, and includes retry logic — replacing what would otherwise be weeks of custom implementation.

**Core technologies:**
- **Cloudflare R2**: Cloud object storage — zero egress fees, S3-compatible API, 10 GB/month free tier
- **`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (3.x)**: Presigned URL generation server-side — standard AWS SDK works against R2 with custom endpoint
- **Uppy 5.x (`@uppy/core`, `@uppy/react`, `@uppy/aws-s3`)**: Client upload UI — multipart, progress, retry, React hooks, React 19/Next.js 16 compatible
- **Airtable (via `airtable` npm package)**: Metadata store — visual UI for Chris to browse submissions, free tier covers documentary-scale volume
- **`nanoid`**: Server-side key generation — prevents filename collisions and client-controlled bucket naming

### Expected Features

The submitter audience (older phone-first alumni) drives UX requirements more than the upload technology does. Every table-stakes feature exists to serve users who will be confused, patient, or on a slow cellular connection.

**Must have (table stakes — v1 launch):**
- File picker with both button tap and drag-drop — iOS users cannot drag; button is the primary path
- Upload progress bar — without it, users assume the page is frozen and re-submit
- Error message and retry button on failure — silent failure is unacceptable
- Name field (required) — filmmaker needs attribution for every story
- Connection to Coach McCollum field (required) — context for who is submitting
- Story context textarea (optional) — short caption helps filmmaker evaluate submissions
- Contact info field (optional) — required for filmmaker follow-up with interview subjects
- Text-only submission path — alternative for users who cannot or will not record
- Client-side file type validation — prevent garbage uploads before they start
- File size warning before upload — manage expectations on mobile before a long transfer begins
- Success confirmation screen — must be warm, visible, and stable on mobile

**Should have (v1.x post-launch):**
- Multipart / resumable upload — essential for 200 MB+ files on cellular; add when failure rate is observed
- Retry with countdown feedback — add alongside multipart
- Personalized thank-you message — low effort, meaningful for a community project

**Defer (v2+):**
- Multi-file upload — only if submitters request it
- File preview before submission — only if wrong-file submissions become a problem
- Email notification to filmmaker — only if checking the Airtable/storage UI becomes a burden
- Any admin UI — storage provider UI is sufficient at this scale

### Architecture Approach

The architecture is a three-step client-driven flow: (1) browser requests a presigned PUT URL from a lightweight Next.js API route, (2) browser PUTs the file directly to R2 (bypassing Vercel entirely), (3) browser POSTs metadata to a second lightweight API route, which writes a record to Airtable. Both API calls carry only JSON. Files never touch Vercel infrastructure. Storage credentials never leave the server. The presigned URL is time-limited (60 seconds is sufficient) and scoped to PutObject on a single generated key only.

**Major components:**
1. **`ShareStory` React component** — collects file + form fields, drives the three-step upload lifecycle, shows progress and confirmation states
2. **`/api/upload/presign` route handler** — validates file type/size server-side, generates UUID-based storage key, returns presigned PUT URL (server-only credentials)
3. **`/api/submit/metadata` route handler** — receives form data + storage key after successful upload, writes Airtable record, optionally triggers email notification
4. **Cloudflare R2 bucket** — persistent binary storage, private, CORS-configured for the Vercel production domain
5. **Airtable base** — human-readable submission records keyed by storage object key; Chris's primary review interface
6. **`lib/storage/client.ts`** — isolated storage SDK init; if provider changes, only this file changes
7. **`lib/metadata/writer.ts`** — isolated metadata adapter; if Airtable is replaced, only this file changes

### Critical Pitfalls

1. **Routing file bytes through a Vercel function** — Vercel's hard 4.5 MB body limit returns HTTP 413 immediately for any video or audio file. Never use `formData.get('file')` in a route handler. The presigned URL pattern is the only viable approach.

2. **CORS misconfiguration on R2** — R2 does not accept `AllowedHeaders: ["*"]` (the standard S3 config). Must explicitly list `["content-type"]`. CORS must also be configured via the Wrangler CLI or S3-compatible API — the R2 dashboard editor is unreliable. Configure CORS before writing a single line of upload code and verify with a real browser PUT from the production domain.

3. **Storage credentials with `NEXT_PUBLIC_` prefix** — Any env var with this prefix is baked into the client bundle and visible in DevTools. Credentials must be server-only (no prefix). Only the generated presigned URL (time-limited, operation-limited) should reach the browser.

4. **No upload progress bar** — `fetch` does not expose upload progress events; only XHR does. Without a progress bar, older users re-submit during slow cellular uploads, creating duplicate orphaned files in the bucket. Progress must be part of the definition of done, not a follow-up ticket.

5. **iOS drag-and-drop is a dead zone** — Drag-and-drop does not work in iOS Safari. The existing `ShareStory` component must have a clearly labeled `<input type="file">` button as the primary upload trigger. Drag-drop is a desktop enhancement only. Test on a real iPhone before shipping.

6. **Saving metadata before confirming upload success** — If the Airtable record is created before the file PUT succeeds, failed uploads leave orphaned metadata records pointing to nonexistent files. The correct sequence is: presign → upload → confirm. Metadata write is always the final step.

## Implications for Roadmap

Based on research, the architectural constraints and pitfall-phase mappings suggest a four-phase structure. The dependencies are strict: backend infrastructure must be verified before any UI is built, and upload UI must be complete before metadata and confirmation features are added.

### Phase 1: Backend Infrastructure and Storage Setup
**Rationale:** CORS, credentials, and presigned URL generation must be verified working in a real browser before any UI work begins. These are the highest-risk items with zero tolerance for retrofitting — the proxy-pattern mistake is easy to make and expensive to reverse. All security pitfalls (credentials, bucket policy, CORS) are addressed here.
**Delivers:** A working presigned URL endpoint, a private R2 bucket with correct CORS policy, and a verified browser PUT from the production domain returning 200.
**Addresses:** Name field, connection field, story field data shapes defined in `types/submission.ts`
**Avoids:** Pitfalls 1 (413 proxy), 2 (CORS), 3 (credential leak), 8 (public bucket)

### Phase 2: File Upload UI and Progress Handling
**Rationale:** Once the backend is verified, the client upload flow can be built with confidence. This phase is the core user-facing deliverable — it must include progress, error handling, and mobile file picker behavior. Progress is non-negotiable given the audience.
**Delivers:** A wired `ShareStory` component that calls `/api/upload/presign`, PUTs directly to R2 via XHR with progress events, handles errors with retry, and supports iOS file picker correctly.
**Uses:** Uppy 5.x `@uppy/react` hooks + `@uppy/aws-s3` plugin; or XHR-based custom implementation if Uppy adds bundle-size concern
**Implements:** `ShareStory` component wired to presign endpoint; XHR progress bar; file type validation; file size warning; iOS input fallback
**Avoids:** Pitfalls 4 (no multipart), 5 (no progress), 6 (iOS drag-drop dead zone), 7 (MIME type iOS bug)

### Phase 3: Form Completion, Metadata, and Confirmation
**Rationale:** With the upload flow working end-to-end, the submission record and success state can be added. Metadata is only written after confirmed upload success (strict ordering), and the confirmation screen is the final user-facing touch.
**Delivers:** `/api/submit/metadata` route writing to Airtable; text-only submission path; all required and optional form fields wired; warm success confirmation screen with submitter name.
**Addresses:** All P1 features from FEATURES.md feature prioritization matrix
**Implements:** Airtable metadata adapter in `lib/metadata/writer.ts`; success/error confirmation screens; text-only path as first-class alternative

### Phase 4: Resilience and UX Polish
**Rationale:** The v1.x improvements — multipart/resumable upload, retry with countdown, personalized thank-you — should be added after the core flow is validated in production. These require more complex backend endpoints (per-part presigned URLs, upload state management) and should not block launch.
**Delivers:** Multipart upload for files above 50 MB with per-chunk retry; personalized thank-you message; optional email notification to Chris on new submission.
**Addresses:** P2 features (chunked upload, retry feedback, personalized confirmation)
**Research flag:** Multipart upload endpoint pattern (CreateMultipartUpload / UploadPart / CompleteMultipartUpload) may benefit from a research-phase pass before implementation.

### Phase Ordering Rationale

- **Infrastructure before UI** is forced by the CORS and credentials constraints — there is no safe way to build the client without a working, verified backend.
- **Upload before metadata** is forced by the two-phase submit pattern — the storage key generated in phase 1 is required input for the metadata route in phase 3.
- **Core flow before resilience** reflects the architectural recommendation that single-PUT presigned URLs are sufficient for an MVP and multipart adds significant complexity that should only be introduced after real-world failure rates are observable.
- This order also means every phase produces a testable artifact before the next phase begins, reducing integration risk.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Multipart upload):** The per-part presigned URL sequence (CreateMultipartUpload, UploadPart, CompleteMultipartUpload) is well-documented in AWS SDK docs but has multiple implementation variants. The Uppy `@uppy/aws-s3` plugin handles this if used — if a custom implementation is chosen, a research-phase pass on the exact endpoint contract is recommended.
- **Phase 3 (Airtable integration):** Airtable's REST API is stable, but rate limits (5 writes/second on free tier) should be verified against expected submission burst volume. Edge case: what happens if the Airtable write fails after the upload succeeds?

Phases with standard patterns (skip research-phase):
- **Phase 1 (Storage + presign):** Well-documented in official Cloudflare and AWS SDK docs. Patterns are established.
- **Phase 2 (Upload UI):** Uppy 5.x documentation is comprehensive. XHR progress is a solved problem.
- **Phase 3 (Form + confirmation):** Standard React form patterns; Airtable SDK is simple.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All pricing, version compatibility, and Vercel limits sourced from official documentation |
| Features | HIGH (upload UX) / MEDIUM (form field conventions) | Upload UX patterns are well-researched; specific form fields for documentary story collection are inferred from domain knowledge |
| Architecture | HIGH | Core constraints (Vercel 4.5 MB, presigned URL pattern) verified against official Vercel and Cloudflare docs |
| Pitfalls | HIGH | Most pitfalls verified against official docs, issue trackers, and confirmed Vercel KB articles |

**Overall confidence:** HIGH

### Gaps to Address

- **Metadata failure handling:** If the Airtable write fails after a successful file upload, the file exists in R2 without a record. The recommended mitigation (retry idempotency using the storage key) needs to be designed explicitly during phase 3 planning.
- **UploadThing pricing:** Sourced from a secondary article (January 2025) rather than official pricing page directly. Irrelevant to the chosen stack but noted.
- **Multipart threshold calibration:** The 100 MB default `shouldUseMultipart` threshold in Uppy may need tuning based on real submission file sizes. Defer to phase 4 testing.
- **Email notification provider:** Research recommends Resend or SendGrid as optional supplements to Airtable. Provider choice (and free tier limits) should be confirmed during phase 4 planning if email notification is desired.

## Sources

### Primary (HIGH confidence)
- Cloudflare R2 pricing — https://developers.cloudflare.com/r2/pricing/ ($0.015/GB, zero egress, 10 GB free)
- Cloudflare R2 presigned URLs — https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- Cloudflare R2 CORS — https://developers.cloudflare.com/r2/buckets/cors/
- Cloudflare R2 S3 compatibility — https://developers.cloudflare.com/r2/api/s3/api/
- Vercel function body size limit — https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions (4.5 MB hard limit)
- Vercel function limitations — https://vercel.com/docs/functions/limitations
- Uppy 5.0 release — https://uppy.io/blog/uppy-5.0/ (React 19, headless hooks, August 2025)
- Uppy Next.js docs — https://uppy.io/docs/nextjs/
- AWS S3 pricing — https://aws.amazon.com/s3/pricing/
- Backblaze B2 pricing — https://www.backblaze.com/cloud-storage/pricing

### Secondary (MEDIUM confidence)
- Presigned URLs in Next.js App Router with S3 — https://conermurphy.com/blog/presigned-urls-nextjs-s3-upload/ (pattern aligns with official SDK docs)
- AWS Multipart Upload with Presigned URLs — https://dev.to/traindex/multipart-upload-for-large-files-using-pre-signed-urls-aws-4hg4 (cross-referenced with AWS docs)
- UX best practices for file uploader — https://uploadcare.com/blog/file-uploader-ux-best-practices/
- UX for Elderly Users — https://cadabra.studio/blog/ux-for-elderly/

### Tertiary (LOW confidence / needs validation)
- UploadThing pricing ($25/month base) — https://uploadthing.com/pricing (page rendered as CSS; price sourced from secondary article, January 2025 — irrelevant to chosen stack)

---
*Research completed: 2026-03-16*
*Ready for roadmap: yes*
