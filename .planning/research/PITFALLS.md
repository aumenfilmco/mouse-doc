# Pitfalls Research

**Domain:** Next.js large file upload (video/audio), Vercel deployment, cloud object storage
**Researched:** 2026-03-16
**Confidence:** HIGH (Vercel limits verified against official docs; browser quirks from react-dropzone issue tracker and MDN; CORS issues from Cloudflare and AWS community posts)

---

## Critical Pitfalls

### Pitfall 1: Routing File Bytes Through a Vercel Function

**What goes wrong:**
A developer writes a Next.js API route that receives the file as a multipart form POST, then re-uploads it to the storage provider. On Vercel, the request body is hard-capped at **4.5 MB**. Any video or audio file above that limit returns HTTP 413 `FUNCTION_PAYLOAD_TOO_LARGE` immediately — no retry, no error message surfaced to the user, just a silent failure.

**Why it happens:**
The pattern of "API route handles everything" feels clean and familiar. Developers copy tutorials that work fine for avatar photos (< 1 MB) without noticing the payload ceiling.

**How to avoid:**
Never proxy file bytes through a Vercel function. Generate a presigned PUT URL server-side (in a lightweight API route that only issues the URL), then upload the file **directly from the browser to the storage provider**. The function only handles metadata — the binary bytes never touch Vercel infrastructure.

**Warning signs:**
- Uploads of files above ~4 MB fail in staging but not locally
- Error logs show 413 or `FUNCTION_PAYLOAD_TOO_LARGE`
- Tutorials in the codebase use `formData.get('file')` inside an API route and then call `storage.put(buffer)`

**Phase to address:**
Backend setup phase (the very first time an upload API route is written — do not build the proxy pattern and refactor later).

---

### Pitfall 2: CORS Misconfiguration on the Storage Bucket

**What goes wrong:**
The presigned PUT URL is generated correctly, but the browser's preflight OPTIONS request to the storage bucket fails with a CORS error. The upload never starts. On Cloudflare R2 specifically, using a wildcard `*` for `AllowedHeaders` does not work — R2 requires explicit header names (at minimum `content-type`). Developers copy S3 CORS config that uses `*` and spend hours debugging what looks like a credentials problem.

**Why it happens:**
CORS rules are configured once and forgotten. R2's stricter rules vs. S3 are not prominently documented. Developers test from localhost where the CORS policy may not apply (same-origin in dev), so the bug only surfaces in production or staging deployments.

**How to avoid:**
Configure CORS on the bucket before writing any upload code. For R2, set `AllowedHeaders` to `["content-type"]` and `AllowedMethods` to `["PUT"]`. For S3, use `["*"]` for headers. Lock `AllowedOrigins` to your production domain — not `["*"]` — before launch. CORS changes on R2 must be made via the S3-compatible API (the dashboard editor has historically been broken for this).

Example minimal R2 CORS config:
```json
[
  {
    "AllowedOrigins": ["https://your-production-domain.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3000
  }
]
```

**Warning signs:**
- Browser console shows "CORS policy: No 'Access-Control-Allow-Origin' header" on the PUT request
- Upload works via `curl` (no CORS) but fails in browser
- No preflight OPTIONS handler appears in storage access logs

**Phase to address:**
Backend setup phase — CORS config must be verified with a real browser PUT before any UI is wired up.

---

### Pitfall 3: Storage Credentials Leaked via NEXT_PUBLIC_ Prefix

**What goes wrong:**
A developer adds `NEXT_PUBLIC_R2_SECRET_ACCESS_KEY` (or similar) to expose the presigned URL endpoint in the client bundle. The secret key is now permanently baked into the JavaScript bundle, visible to anyone who opens DevTools. Rotating the key requires a full redeployment and does not revoke the already-distributed bundle.

**Why it happens:**
The `NEXT_PUBLIC_` prefix is used anytime a value needs to be read in a client component. Developers new to Next.js apply it liberally without recognizing the distinction between "config the client needs to know" vs. "secrets that must stay server-side."

**How to avoid:**
Storage credentials (`access key`, `secret key`, bucket name, account ID) must **never** carry the `NEXT_PUBLIC_` prefix. Only the generated presigned URL (a time-limited, operation-scoped token) should leave the server. Presigned URL generation lives in a server-only API route or Server Action. After build, verify no secrets appear in `.next/static/` by grepping the output chunks.

**Warning signs:**
- Any env var named like `NEXT_PUBLIC_*_SECRET*` or `NEXT_PUBLIC_*_KEY*`
- Storage credentials appear in the browser network tab's request headers on a client-initiated request
- `.env.local` contains storage secrets, and those keys also appear in `vercel.json` or are set as "plain text" (not secret) in Vercel's dashboard

**Phase to address:**
Backend setup phase — enforce this rule before the first API route is committed.

---

### Pitfall 4: No Multipart Upload for Large Files — One-Shot PUT Fails on Bad Connections

**What goes wrong:**
A single presigned PUT URL upload for a 200–500 MB file over a cellular connection fails partway through, and the entire transfer must restart from zero. On iOS with poor signal — the primary use case for this project — a 500 MB upload failing at 95% means the user starts over. Most users on older phone hardware will simply give up.

**Why it happens:**
Single-part presigned PUT is trivially simple to implement. Multipart upload (splitting into chunks, uploading in parallel, reassembling) is more complex and often deferred to "later." For files below ~100 MB on a good WiFi connection it seems fine in testing, but the failure mode only appears on mobile LTE/5G with fluctuating signal.

**How to avoid:**
Use multipart upload for any file above ~50 MB. Vercel Blob's `put()` with `multipart: true` handles chunking and per-chunk retry automatically. If using R2 or S3 directly, implement the S3 CreateMultipartUpload / UploadPart / CompleteMultipartUpload sequence. The library `uppy` handles this out of the box and provides resumability. For this project's audience (older alumni on phones), retry-on-chunk-failure is essential, not optional.

**Warning signs:**
- Upload implementation uses a single `fetch(presignedUrl, { method: 'PUT', body: file })`
- No chunking logic in upload handler
- Testing was done only on desktop WiFi

**Phase to address:**
Upload implementation phase — multipart must be part of the initial implementation, not retrofitted.

---

### Pitfall 5: Using `fetch` for Upload Progress — Users Can't See Progress, Submit Multiple Times

**What goes wrong:**
`fetch` does not expose `uploadprogress` events. An upload of a 200 MB file over cellular takes 60–120 seconds with zero visual feedback. Users (especially older, non-tech-savvy alumni) assume the form is frozen or broken and tap Submit again, queueing multiple duplicate submissions. Each retry may create orphaned partial uploads in the storage bucket.

**Why it happens:**
`fetch` is the modern, idiomatic way to make HTTP requests in React. Progress events are often added "later as a nice-to-have" but never land because the feature appears to work without them.

**How to avoid:**
Use `XMLHttpRequest` (XHR) for the actual file PUT — only XHR exposes the `xhr.upload.onprogress` event for real-time upload progress. Wrap XHR in a Promise so it integrates cleanly with async/await patterns. Alternatively, use a library like `uppy` which abstracts this. Disable the submit button immediately on first click and show a progress bar (percent complete) alongside a "this may take a few minutes on mobile" message.

**Warning signs:**
- Upload code uses `fetch(url, { method: 'PUT', body: file })` with no `onprogress` handler
- No progress bar or spinner in the UI during upload
- Submit button remains enabled after first click

**Phase to address:**
Upload UI phase — progress feedback must be part of the definition of done, not a follow-up ticket.

---

### Pitfall 6: iOS Safari Drag-and-Drop Is Not Supported — The Dropzone Is a Dead Zone

**What goes wrong:**
The existing `ShareStory` component uses drag-and-drop as the primary upload affordance. Drag-and-drop does not work in iOS Safari. The target audience is older alumni submitting from phones — the drag-and-drop zone is entirely non-functional for the majority of expected submitters.

**Why it happens:**
Drag-and-drop works fine in desktop browsers during development. Mobile testing is skipped or done only with Chrome DevTools mobile simulation, which does not replicate iOS Safari's actual file picker behavior.

**How to avoid:**
Treat drag-and-drop as a progressive enhancement for desktop only. The primary upload action must be a clearly labeled `<input type="file">` button (or a large tap target that programmatically triggers `input.click()`). On iOS, this opens the native file picker (camera, Photos library, Files app), which is the correct interaction pattern. Do not hide or de-emphasize the file button in favor of the drop zone.

**Warning signs:**
- The only upload trigger is `onDrop` / `onDragOver` — no `<input type="file">` fallback
- Upload component tested exclusively in desktop Chrome
- Dropzone occupies the full upload area with no button alternative

**Phase to address:**
Upload UI phase — verify on a real iOS device before shipping.

---

### Pitfall 7: MIME Type Validation Breaks on iOS Safari with Comma-Separated Types

**What goes wrong:**
A `react-dropzone` config using `accept={{ 'video/*': [], 'audio/*': [] }}` (or a comma-separated `accept` attribute) causes iOS Safari to grey out all files in the picker, making it impossible to select anything. This is a confirmed iOS Safari bug: comma-separated MIME types in the `accept` attribute are not handled correctly for certain combinations.

**Why it happens:**
react-dropzone and the underlying `<input accept>` attribute work correctly on all desktop browsers and Android. iOS Safari uses UTIs (Uniform Type Identifiers) internally and its parsing of comma-separated MIME lists is inconsistent. The bug is not obvious — the file picker opens but nothing is selectable.

**How to avoid:**
Test MIME type filtering on a real iOS device during development. If any combination causes greyed-out files, fall back to `accept="video/*,audio/*"` using a single wildcard group, or remove client-side type restrictions entirely and validate MIME type server-side when the presigned URL is requested. Server-side validation is more reliable anyway (browser-reported MIME types can be spoofed).

**Warning signs:**
- File picker opens on iOS but no files are selectable (all greyed out)
- The `accept` prop contains multiple MIME types separated by commas
- Type validation is only enforced client-side

**Phase to address:**
Upload UI phase — test on real iOS hardware before shipping.

---

### Pitfall 8: Bucket Accidentally Made Public — All Submissions Accessible to Anyone

**What goes wrong:**
A developer enables the "public bucket" option on R2 or S3 to simplify access, not realizing this exposes every submission URL to anyone who guesses or enumerates the object key. Story submissions from community members — potentially sensitive personal recollections — become publicly accessible without authentication.

**Why it happens:**
Public buckets are simpler to set up: no presigned URL complexity, no expiry concerns. Documentation for "how to access your files" often points to the public URL as the simplest path. The "public by default" risk isn't surfaced prominently in quickstart guides.

**How to avoid:**
Keep the bucket private. Use presigned GET URLs (time-limited, scoped to a specific object key) when Chris needs to download a submission. Set object ACL to private on upload. For R2, never enable the "Public Bucket" toggle. For S3, leave "Block all public access" settings at their defaults (all checked). Access files via the storage provider's console or via presigned GET URLs generated in a server-only route.

**Warning signs:**
- R2 "Public Bucket" toggle is enabled
- S3 "Block all public access" settings are unchecked
- Object URLs are exposed in client-side JavaScript without expiry
- Bucket policy contains `"Effect": "Allow"` with `"Principal": "*"`

**Phase to address:**
Backend setup phase — verify bucket access policy before accepting any real submissions.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single-part PUT for all files | Simpler implementation | 100%+ failure rate for large files on mobile networks | Never for files > 50 MB |
| Proxy file bytes through Next.js API route | Familiar pattern, one code path | Hard 4.5 MB ceiling, rewrites required | Never on Vercel |
| `NEXT_PUBLIC_` on storage credentials | Avoid building a server route | Credentials permanently exposed in JS bundle | Never |
| No upload progress | Ship faster | Users submit duplicates; orphaned uploads accumulate in bucket | Only acceptable in internal-only tools |
| `accept="*"` (no MIME filtering) | Avoids iOS bug | Users upload wrong file types (docs, zips); wasted storage | Acceptable if server-side type check is implemented |
| Wildcard CORS (`AllowedOrigins: ["*"]`) | Works everywhere during dev | Anyone can PUT to your bucket using your presigned URLs | Development only — never in production |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Cloudflare R2 CORS | Using `AllowedHeaders: ["*"]` (S3 pattern) | Use `AllowedHeaders: ["content-type"]` explicitly |
| Cloudflare R2 CORS config | Editing via dashboard (broken) | Configure via `wrangler` CLI or S3-compatible API |
| AWS S3 presigned PUT | Generating URL with `s3:GetObject` permission instead of `s3:PutObject` | IAM policy must grant `PutObject` to the specific bucket/prefix |
| Vercel env vars | Setting storage secret as `NEXT_PUBLIC_*` | Server-only vars (no prefix) for all credentials |
| react-dropzone `accept` on iOS | Comma-separated MIME types grey out all files | Test combos on real device; validate server-side instead |
| Presigned URL expiry | Setting 1-hour expiry, starting upload after URL expires | Generate URL immediately before upload; 15-min expiry is sufficient |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Generating presigned URL on every keystroke/render | Unnecessary API calls, credential churn | Generate URL only on form submit, immediately before upload begins | Any usage |
| Single-threaded sequential chunk uploads | 500 MB file takes 20+ minutes on slow connection | Parallel chunk uploads (standard in S3 multipart) | Files > 100 MB |
| Uploading to storage region far from user | High latency, slow transfers | Choose storage region closest to majority of submitters (US East for PA alumni) | Noticeable above 50 MB |
| No file size check before upload starts | User waits 10 minutes for a 2 GB file, fails at storage limit | Validate `file.size` client-side before requesting presigned URL | First oversized submission |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No file size limit on presigned URL generation | Anyone can upload arbitrarily large files, running up storage costs | Check `file.size` client-side; enforce max via Content-Length condition in presigned URL |
| Presigned URL generation without rate limiting | Credential abuse, storage cost bomb | Add basic rate limiting (e.g., 5 requests/IP/minute) on the URL generation endpoint |
| Bucket policy allows `s3:DeleteObject` | Submissions can be deleted by anyone who has a presigned URL | IAM role/token used for presigned PUT must only grant `PutObject`, never `DeleteObject` |
| Logging storage secrets in console/Vercel logs | Credentials appear in Vercel's log dashboard | Never `console.log(process.env.SECRET_*)`; use structured logging that redacts env vars |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No progress indicator | Older users tap Submit multiple times thinking it's frozen | XHR progress bar with percentage; disable submit button on first click |
| "File too large" error shown after upload attempt | User waits for upload to start, then gets rejected | Check `file.size` immediately on file selection, before any upload begins |
| Drag-and-drop as primary call-to-action | iPhone users (majority of audience) see a decorative box they can't use | Prominent "Choose File" button as primary CTA; drop zone as desktop enhancement |
| Generic error messages ("Upload failed") | User doesn't know if they should retry or give up | Specific messages: "Connection lost — tap Retry to continue" vs. "File too large — maximum 1 GB" |
| No success confirmation with file name | User isn't sure if the right file was submitted | Show file name and size in the confirmation screen |

---

## "Looks Done But Isn't" Checklist

- [ ] **Upload API route:** Verify file bytes are NOT passing through Vercel (route should only return a presigned URL, not accept the file body)
- [ ] **CORS:** Confirm a real browser PUT to the presigned URL succeeds from the production domain (not just curl or localhost)
- [ ] **Credentials:** Run `grep -r "NEXT_PUBLIC_" .env*` — zero storage credential keys should have this prefix
- [ ] **Mobile file picker:** Test on a real iOS device — drag-and-drop dead zone is invisible in desktop DevTools
- [ ] **MIME filtering:** Test file picker on iOS with the accept config — verify files are NOT greyed out
- [ ] **Progress bar:** Confirm progress events fire during a real upload (not just a spinner that shows on submit)
- [ ] **Submit button:** Confirm it is disabled after first click and re-enables only on error or after redirect
- [ ] **Bucket permissions:** Confirm bucket is private — attempt to access an object URL directly in an incognito browser and verify 403
- [ ] **Large file test:** Upload a real 200 MB file from a mobile device on cellular — not just desktop WiFi
- [ ] **Error recovery:** Kill network mid-upload and verify the user sees a retryable error, not a silent hang

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Proxy pattern already built | HIGH | Refactor API route to return presigned URL only; rewrite client upload logic to PUT directly to storage |
| Storage credentials leaked in bundle | HIGH | Rotate all storage credentials immediately; redeploy; audit git history for committed secrets; review who had access |
| Bucket accidentally public | MEDIUM | Disable public access setting; audit access logs for unauthorized reads; notify affected submitters if PII was exposed |
| CORS misconfigured | LOW | Update bucket CORS rules via CLI; retest in 1–2 minutes (R2/S3 changes propagate quickly) |
| No progress bar shipped | LOW | Replace `fetch` PUT with XHR; add progress state; < 1 day of work |
| iOS MIME type bug | LOW | Remove client-side type restriction; add server-side validation on presigned URL generation endpoint |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| File bytes through Vercel function (413) | Backend setup | API route returns only a presigned URL; no `req.body` file buffer |
| CORS misconfiguration | Backend setup | Browser DevTools Network tab shows PUT 200 from production domain |
| Storage credentials in client bundle | Backend setup | `grep NEXT_PUBLIC_ .env*` returns no secret keys |
| No multipart / no retry | Upload implementation | 200 MB test upload on cellular succeeds after simulated network drop |
| No progress feedback / duplicate submits | Upload UI | Progress bar visible; submit button disabled after first click |
| iOS drag-and-drop dead zone | Upload UI | Tested on real iPhone — file picker opens via button tap |
| MIME type filtering breaks iOS | Upload UI | Tested on real iPhone — video/audio files are selectable |
| Bucket accidentally public | Backend setup | Direct object URL returns 403 in incognito browser |

---

## Sources

- [Vercel Functions Limits — Official Docs](https://vercel.com/docs/functions/limitations) (body size 4.5 MB, duration limits — verified directly)
- [Vercel Knowledge Base: How to bypass 4.5 MB body size limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)
- [Cloudflare R2 CORS issue — Community Thread](https://community.cloudflare.com/t/cors-issue-with-r2-presigned-url/428567)
- [Cloudflare R2 Public Buckets docs](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [CORS error uploading via presigned URL from browser — AWS re:Post](https://repost.aws/questions/QUbRJA9UqWRNuUTq5ujzXdOw/cors-error-when-trying-to-upload-via-presigned-url-from-browser-but-not-in-non-browser-environment)
- [Vercel Blob multipart uploads changelog](https://vercel.com/changelog/5tb-file-transfers-with-vercel-blob-multipart-uploads)
- [react-dropzone iOS Safari comma MIME type bug — Issue #538](https://github.com/react-dropzone/react-dropzone/issues/538)
- [Drag and Drop not working in Safari — react-dropzone Issue #726](https://github.com/react-dropzone/react-dropzone/issues/726)
- [Fetch streams not for upload progress — Jake Archibald](https://jakearchibald.com/2025/fetch-streams-not-for-progress/)
- [Next.js NEXT_PUBLIC_ pitfalls — DEV Community](https://dev.to/koyablue/the-pitfalls-of-nextpublic-environment-variables-96c)
- [Next.js Data Security Guide — Official Docs](https://nextjs.org/docs/app/guides/data-security)

---
*Pitfalls research for: Next.js large file upload (video/audio) on Vercel*
*Researched: 2026-03-16*
