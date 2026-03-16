# Stack Research

**Domain:** Next.js large file upload (video/audio) with cloud object storage
**Researched:** 2026-03-16
**Confidence:** HIGH (pricing from official docs; library data from official changelogs; Vercel limits from official KB)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Cloudflare R2 | — (managed service) | Cloud object storage for submitted video/audio | Zero egress fees, $0.015/GB/month storage, S3-compatible API, 10 GB/month free tier. Lowest total cost for a community project that reads files back out occasionally. |
| `@aws-sdk/client-s3` | 3.x (latest) | Generate presigned PUT URLs server-side | R2 is S3-compatible; the official AWS SDK v3 is the standard way to generate presigned URLs against R2. No R2-specific SDK needed. |
| `@aws-sdk/s3-request-presigner` | 3.x (latest) | Sign the presigned URLs | Pairs with `@aws-sdk/client-s3` to call `getSignedUrl()`. Required companion package. |
| Uppy | 5.x (latest) | Client-side upload UI with progress, mobile support, retries | Uppy 5.0 (August 2025) added headless React hooks and components — integrates cleanly with custom UI. Built-in multipart S3 support (`shouldUseMultipart` threshold defaulting to 100 MB), resumable uploads, and mobile-optimized. Active ecosystem, open source. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@uppy/core` | 5.x | Uppy core engine | Always — foundation for all Uppy plugins |
| `@uppy/react` | 5.x | React hooks: `useUppyState`, `useUppyEvent` | Always in React/Next.js; use headless approach to match existing UI |
| `@uppy/aws-s3` | 5.x | S3/R2 multipart + regular upload plugin | Always — handles both small and large files; switches to multipart automatically above 100 MB |
| `@uppy/dashboard` | 5.x | Pre-built upload UI (optional) | Only if you want to replace the existing drag-drop UI; skip if building custom UI with hooks |
| `uuid` or `nanoid` | latest | Generate unique file keys for R2 objects | Prevents filename collisions from anonymous uploads; server-side in the presigned URL API route |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Cloudflare Dashboard / Wrangler CLI | Create R2 bucket, configure CORS policy | CORS policy is required before browser-direct uploads will work — often forgotten step |
| `wrangler` CLI | Manage R2 buckets from terminal | `npx wrangler r2 bucket create mouse-doc-uploads` |
| AWS SDK v3 credential env vars | R2 credentials injected via env vars | `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET_NAME` |

---

## Upload Architecture: Presigned URL (Direct-to-Storage)

**Use presigned URLs. Do not proxy through Next.js API routes.**

The server generates a temporary signed PUT URL. The browser uploads directly to R2. The Next.js function is never in the file path.

```
Browser                     Next.js API Route              Cloudflare R2
   |                               |                              |
   | POST /api/upload/sign         |                              |
   | { filename, contentType }     |                              |
   |------------------------------>|                              |
   |                               | getSignedUrl(PutObject)      |
   |                               |----------------------------->|
   |                               | presigned URL (15 min TTL)   |
   |                               |<-----------------------------|
   | { uploadUrl, fileKey }        |                              |
   |<------------------------------|                              |
   |                                                              |
   | PUT presignedUrl (file bytes, directly from browser)        |
   |------------------------------------------------------------->|
   | 200 OK                                                       |
   |<-------------------------------------------------------------|
   |                                                              |
   | POST /api/upload/complete                                    |
   | { fileKey, name, message, connection }                       |
   |------------------------------>|                              |
   |                               | (save metadata if needed)    |
   | { success: true }             |                              |
   |<------------------------------|                              |
```

**Why not server-proxy?**
Vercel serverless functions have a hard 4.5 MB request body limit. A 200 MB phone video will return a `413: FUNCTION_PAYLOAD_TOO_LARGE` error immediately. There is no configuration override for this limit — it is enforced at the infrastructure level before your code runs. Presigned URLs completely bypass this constraint.

---

## Cost Comparison

| Provider | Storage ($/GB/month) | Egress ($/GB) | Free Tier | Notes |
|----------|---------------------|---------------|-----------|-------|
| **Cloudflare R2** | **$0.015** | **$0.00** | 10 GB storage, 1M Class A ops, 10M Class B ops/month | Best choice. Zero egress is the key differentiator for a project with occasional read-back. |
| Backblaze B2 | $0.006 | $0.01 (after 3x monthly free) | 10 GB storage | Cheapest raw storage. But egress costs accumulate when Chris downloads submissions. B2+Cloudflare CDN pairing gives free egress, but adds complexity this project doesn't need. |
| AWS S3 Standard | $0.023 | $0.09 (after first 100 GB/month) | None (12-month free tier only) | Most expensive storage AND egress. Enormous ecosystem, but overkill and costly for a community project. |
| UploadThing | $0.08/GB additional (above $25/month base) | Included | Unclear free tier | Vendor abstraction — hides R2/S3 underneath. $25/month base is over-budget for a community film project. |

**Concrete estimate for MOUSE project (rough):**
- 100 submissions at average 150 MB = 15 GB stored
- Chris downloads each file once = 15 GB egress
- R2: 15 GB × $0.015 = **$0.23/month storage, $0.00 egress = ~$0.23/month total**
- B2: 15 GB × $0.006 = $0.09/month storage, 15 GB egress may be within 3x free = potentially free
- S3: 15 GB × $0.023 = $0.35/month storage + 15 GB × $0.09 = $1.35 egress = **~$1.70/month**
- UploadThing: **$25/month minimum**

R2 wins on simplicity + cost. B2 is cheaper on storage alone but adds complexity with the CDN partnership for free egress.

---

## Installation

```bash
# Cloud storage SDK (R2 is S3-compatible)
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# Upload client (use modular installs)
npm install @uppy/core @uppy/react @uppy/aws-s3

# Optional: pre-built dashboard UI (skip if using custom drag-drop UI)
# npm install @uppy/dashboard

# Key generation
npm install nanoid
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Cloudflare R2 | Backblaze B2 | When raw storage cost is the only concern and you're already using Cloudflare CDN for egress (free egress via B2+CF pairing). Adds CORS and CDN config complexity. |
| Cloudflare R2 | AWS S3 | When the project already has AWS infrastructure (IAM roles, VPC, existing buckets), or needs S3-specific features like Intelligent-Tiering or event triggers to Lambda. Not cost-justified here. |
| Uppy 5.x | Native `fetch` + `XMLHttpRequest` | For trivially small files or when bundle size is critical. For 50–500 MB video uploads with mobile users, rolling your own multipart + progress + retry logic takes weeks. Uppy is battle-tested. |
| Uppy 5.x | UploadThing | When you want maximum Next.js DX abstraction and don't care about cost. $25/month minimum is excessive for a community project. |
| Presigned URL (direct-to-storage) | Server-side proxy | Only use server proxy on self-hosted Node (not Vercel), when you need server-side file scanning/validation before storage, or when file sizes are under 4 MB. Not viable on Vercel for large files. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Next.js Server Actions for file upload | 1 MB default body limit for Server Actions; even with config override, still subject to Vercel's 4.5 MB function payload ceiling. A 200 MB phone video will fail unconditionally. | Presigned URL flow with client-direct upload to R2 |
| `multer` / `busboy` API routes on Vercel | Serverless function body limit of 4.5 MB applies regardless of body parser. Works only on self-hosted Node with no payload ceiling. | Presigned URL flow |
| AWS S3 for this project | $0.09/GB egress means every download Chris does to review submissions costs real money. S3 storage ($0.023/GB) is also more expensive than R2 ($0.015/GB). No meaningful advantage here. | Cloudflare R2 |
| UploadThing | $25/month base fee before storing a single byte. Provides no technical capability beyond what R2 + Uppy provides directly. It is an abstraction layer with a monthly cost attached. | Cloudflare R2 + Uppy |
| `@uppy/tus` protocol against R2 | R2 does not natively implement the tus server protocol. You would need a separate tus server (e.g., tusd). The `@uppy/aws-s3` multipart plugin already provides resumability via S3 multipart. | `@uppy/aws-s3` with `shouldUseMultipart` |

---

## Stack Patterns by Variant

**If submitter is on mobile (phone video, voice memo):**
- Files are typically 50–200 MB
- Uppy's `@uppy/aws-s3` plugin will use standard single-part presigned PUT (under 100 MB default threshold)
- Must configure R2 CORS to allow PUT from your Vercel domain
- iOS Safari sends `video/quicktime` MIME type for `.mov` files — accept both `video/*` and `audio/*` broadly, not specific types

**If submitter is on desktop (screen recording, DAW export):**
- Files can reach 500 MB+
- Uppy will automatically switch to multipart upload (default threshold: 100 MB)
- Multipart requires a server endpoint that generates per-part presigned URLs — Uppy's `@uppy/aws-s3` plugin handles this automatically if you wire the `createMultipartUpload`, `signPart`, and `completeMultipartUpload` API routes
- Alternatively, set Uppy's `shouldUseMultipart` to `false` to force single presigned PUT for simplicity if 500 MB desktop uploads are rare

**If Chris is on Vercel Hobby plan:**
- Function timeout is 10 seconds (300 seconds with Fluid Compute)
- The presigned URL signing endpoint completes in < 1 second — no timeout concern
- The metadata save endpoint (if any) also completes in < 1 second — no timeout concern
- Timeout is irrelevant with direct-to-storage architecture

**If Chris is on Vercel Pro:**
- Function timeout is 60 seconds (800 seconds with Fluid Compute)
- No meaningful difference for this architecture

---

## Next.js 16 / Vercel Specific Considerations

### Body Size Limits (CRITICAL)

| Context | Limit | Configurable? |
|---------|-------|---------------|
| Vercel serverless function request body | **4.5 MB hard limit** | NO — enforced at infrastructure level |
| Next.js Server Actions | **1 MB default** | Yes, via `serverActions.bodySizeLimit` in next.config.js — but still bound by the 4.5 MB Vercel ceiling |
| Direct-to-storage (presigned URL) | **No limit** | N/A — browser uploads directly to R2, bypassing Vercel entirely |

The 4.5 MB limit is not a Next.js configuration — it is a Vercel platform constraint that returns a `413` error before your route handler code executes. Presigned URLs are the only viable solution for files over 4.5 MB on Vercel.

### CORS Configuration Required

R2 buckets deny browser-based uploads by default. Before any upload works, configure a CORS policy on the bucket:

```json
[
  {
    "AllowedOrigins": ["https://your-vercel-domain.vercel.app"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type", "Content-Disposition"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

The `ETag` header exposure is required for multipart uploads (Uppy needs the ETag from each part to complete the upload).

### Mobile Safari Notes

- iOS Safari reports `.mov` (QuickTime) files as `video/quicktime`, not `video/mp4` — accept `video/*` broadly
- Audio memos exported from iOS may be `audio/x-m4a` — accept `audio/*` broadly
- Memory-constrained devices may time out on very large file reads before upload begins — Uppy streams files rather than reading them fully into memory, which helps

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@uppy/core@5.x` | React 19, Next.js 16 | Uppy 5.0 (August 2025) fully supports React 19 |
| `@aws-sdk/client-s3@3.x` | Node.js 18+, Next.js API routes | Use in server-side route handlers only — never import in client components |
| `@aws-sdk/s3-request-presigner@3.x` | Pairs with `@aws-sdk/client-s3@3.x` | Must match major version with client-s3 |
| Cloudflare R2 | `@aws-sdk/client-s3@3.x` | R2 endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`; region: `auto` |

---

## Sources

- Cloudflare R2 official pricing: https://developers.cloudflare.com/r2/pricing/ — storage $0.015/GB, egress $0.00, free tier 10 GB/month (HIGH confidence)
- Backblaze B2 official pricing: https://www.backblaze.com/cloud-storage/pricing — storage $0.006/GB, egress $0.01/GB beyond 3x free (HIGH confidence)
- AWS S3 official pricing: https://aws.amazon.com/s3/pricing/ — storage $0.023/GB, egress $0.09/GB after first 100 GB (HIGH confidence)
- Vercel body size limit KB: https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions — 4.5 MB hard limit confirmed (HIGH confidence)
- Vercel function timeout limits: https://vercel.com/docs/functions/limitations — Hobby 10s / Pro 60s (HIGH confidence)
- Uppy 5.0 release blog: https://uppy.io/blog/uppy-5.0/ — headless components, React hooks, August 2025 (HIGH confidence)
- Uppy Next.js docs: https://uppy.io/docs/nextjs/ — integration requirements, current as of Uppy 5.0 (HIGH confidence)
- Cloudflare R2 S3 compatibility: https://developers.cloudflare.com/r2/api/s3/api/ — `@aws-sdk/client-s3` confirmed compatible (HIGH confidence)
- Cloudflare R2 presigned URLs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/ — PutObject presigned URL workflow (HIGH confidence)
- Cloudflare R2 CORS docs: https://developers.cloudflare.com/r2/buckets/cors/ — CORS required for browser uploads (HIGH confidence)
- UploadThing pricing: https://uploadthing.com/pricing — $25/month base, $0.08/GB additional (MEDIUM confidence — page rendered as CSS, pricing sourced from secondary article dated Jan 2025)

---

*Stack research for: Next.js 16 large file upload — MOUSE documentary story collection app*
*Researched: 2026-03-16*
