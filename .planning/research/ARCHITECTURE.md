# Architecture Research

**Domain:** Large file upload for a Next.js 16 documentary story-collection web app (video/audio submissions)
**Researched:** 2026-03-16
**Confidence:** HIGH — core constraints (Vercel 4.5MB limit, presigned URL pattern) are verified against official documentation

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ShareStory component                                     │   │
│  │  - Drag-and-drop / file picker                           │   │
│  │  - Text story textarea                                    │   │
│  │  - Name + connection fields                              │   │
│  │  - Upload progress bar                                   │   │
│  └────────────┬──────────────────────────┬───────────────┘   │
│               │ Step 1: GET presigned URL │ Step 3: POST meta  │
│               │ (filename, filetype)      │ (after upload done)│
└───────────────┼───────────────────────────┼───────────────────┘
                │                           │
┌───────────────▼──────────────────────┐   │
│         Next.js API Routes           │   │
│  ┌────────────────────────────────┐  │   │
│  │ /api/upload/presign            │  │   │
│  │ - Validates file type/size     │  │   │
│  │ - Signs a PUT URL (60s expiry) │  │   │
│  │ - Returns { url, key }         │  │   │
│  └───────────────────┬────────────┘  │   │
│                      │               │   │
│  ┌────────────────────────────────┐  │◄──┘
│  │ /api/submit/metadata           │  │
│  │ - Receives name, connection,   │  │
│  │   story text, storage key      │  │
│  │ - Writes metadata record       │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
                │ Step 2: PUT file directly
                ▼ (bypasses Next.js entirely)
┌──────────────────────────────────────┐
│     Cloud Object Storage             │
│  (Cloudflare R2 / Backblaze B2 /     │
│   AWS S3 — S3-compatible)            │
│                                      │
│  video-files/                        │
│  └── {uuid}-submission.mp4           │
└──────────────────────────────────────┘
                │
                ▼ (parallel, after upload)
┌──────────────────────────────────────┐
│     Metadata Store                   │
│  (Airtable / JSON in bucket /        │
│   Vercel KV — see options below)     │
│                                      │
│  { name, connection, story, key,     │
│    timestamp, filename, filesize }   │
└──────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `ShareStory` (React) | Collect file + form fields, drive upload lifecycle | Existing component — `handleSubmit` needs wiring |
| `/api/upload/presign` | Generate time-limited signed PUT URL for storage provider | Next.js App Router route handler, runs on server, holds secret keys |
| `/api/submit/metadata` | Write submission record after successful upload | Next.js App Router route handler, calls metadata store API |
| Cloud storage bucket | Persistent binary storage for video/audio files | Cloudflare R2, Backblaze B2, or AWS S3 |
| Metadata store | Human-readable record of who submitted what | Airtable, JSON companion file in bucket, or Vercel KV |

## Why the Presigned URL Pattern Is Mandatory Here

### The Constraint

Vercel Serverless Functions have a **hard 4.5 MB request body limit** that is not configurable. This is enforced at the platform level regardless of any Next.js config settings. A Next.js API route that accepts a file directly will return `413 FUNCTION_PAYLOAD_TOO_LARGE` for any file above 4.5 MB.

For this project, expected file sizes are 50 MB–500 MB+. Routing files through a Next.js API route is not viable on Vercel.

### The Solution: Client-to-Storage Direct Upload

The presigned URL pattern removes files from the serverless function path entirely:

1. The browser asks a lightweight API route: "Give me a temporary URL I can PUT a file to."
2. The API route calls the storage SDK (server-side, credentials never leave the server) and returns a signed URL valid for 60–300 seconds.
3. The browser PUTs the file directly to the storage provider. The file never touches Vercel.
4. On success, the browser calls a second lightweight API route to save the submission metadata.

Both API calls (steps 1 and 4) carry only JSON — well under 4.5 MB.

### Comparison: Server Proxy vs. Presigned URL

| Concern | Server Proxy | Presigned URL (Direct Upload) |
|---------|-------------|-------------------------------|
| Vercel compatibility | Fails for files > 4.5 MB | Works — files bypass Vercel |
| Complexity | Simpler client code | Two-step flow (presign, then upload) |
| Cost | Double bandwidth (client → server → storage) | Single transfer (client → storage) |
| Security | Credentials stay server-side | Credentials stay server-side; URL is time-limited |
| Upload speed | Slower (double hop) | Faster (direct to storage CDN edge) |
| Error handling | Centralized | Client handles PUT errors, must report back |
| **Verdict for this project** | **Not viable on Vercel** | **Required** |

## Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── upload/
│   │   │   └── presign/
│   │   │       └── route.ts       # POST — generate signed PUT URL
│   │   └── submit/
│   │       └── metadata/
│   │           └── route.ts       # POST — save submission record
│   └── (existing pages)/
├── components/
│   └── ShareStory/
│       └── index.tsx              # Existing — wire up upload logic
├── lib/
│   ├── storage/
│   │   └── client.ts              # Storage SDK init (R2/B2/S3)
│   └── metadata/
│       └── writer.ts              # Metadata store adapter
└── types/
    └── submission.ts              # Shared type: SubmissionPayload
```

### Structure Rationale

- **`api/upload/presign/`**: Separate from `api/submit/metadata/` — presigning is stateless and fast; metadata writing may involve external API calls. Keeping them separate allows independent error handling and retries.
- **`lib/storage/`**: Isolates the storage SDK. If the provider changes (R2 → B2), only this file changes.
- **`lib/metadata/`**: Isolates the metadata destination. If Airtable is replaced by a database, only this adapter changes.
- **`types/submission.ts`**: Single source of truth for the shape of a submission — shared between client form and API handlers.

## Architectural Patterns

### Pattern 1: Two-Phase Submit (Presign then Commit)

**What:** The client sends two separate requests — first to get a signed upload URL, then to confirm the upload and save metadata.

**When to use:** Any time the file must bypass the application server (Vercel, Lambda, etc.).

**Trade-offs:** Requires the client to handle a two-step async flow. If the upload succeeds but the metadata POST fails, the file exists in storage without a record. Mitigation: use the storage key as the idempotency key, and allow a retry of the metadata POST.

**Flow:**
```typescript
// Step 1: Client requests presigned URL
const { url, key } = await fetch('/api/upload/presign', {
  method: 'POST',
  body: JSON.stringify({ filename: file.name, contentType: file.type }),
}).then(r => r.json())

// Step 2: Client uploads directly to storage (no Next.js in path)
await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })

// Step 3: Client saves metadata
await fetch('/api/submit/metadata', {
  method: 'POST',
  body: JSON.stringify({ key, name, connection, story }),
})
```

### Pattern 2: Multipart Upload for Files > 100 MB

**What:** For files above ~100 MB, a single PUT may time out or fail mid-transfer with no recovery. Multipart upload splits the file into 5–100 MB chunks, each with its own presigned URL, uploaded in parallel or sequentially.

**When to use:** Files > 100 MB. AWS and Cloudflare both recommend this threshold. For files > 5 GB, multipart is mandatory (single PUT has a 5 GB limit on most S3-compatible providers).

**Trade-offs:** Significantly more complex — requires backend endpoints to initiate upload, generate per-part presigned URLs, and finalize the upload with ETags. Libraries like `@aws-sdk/lib-storage` handle this automatically. Adds ~3 API round trips before bytes transfer.

**Practical decision for this project:** For a first implementation, a single-PUT presigned URL with a 5-minute expiry handles files up to ~1 GB on a reasonable connection. Multipart should be deferred to a later phase unless early testing shows failures on large files.

### Pattern 3: Storage Key Naming Convention

**What:** Generate the storage key (filename) server-side at presign time, not client-side.

**When to use:** Always — never trust the client to name files in your bucket.

**Trade-offs:** Requires returning the key to the client so it can be included in the metadata POST. Negligible complexity.

**Example key format:**
```
submissions/{year}/{month}/{uuid}-{sanitized-original-filename}
// e.g. submissions/2026/03/a3f7c2d1-coach-memory.mp4
```
This makes the bucket browsable chronologically without a database.

## Data Flow

### Upload + Submit Flow

```
User fills form + selects file
    ↓
ShareStory component calls /api/upload/presign
    ↓ POST { filename, contentType, filesize }
Next.js route handler
    ↓ Calls storage SDK (server-side credentials)
    ↓ Generates key = "submissions/{date}/{uuid}-{filename}"
    ↓ Returns { presignedUrl, key }
    ↓
ShareStory component PUTs file to presignedUrl
    ↓ Direct HTTP PUT to storage provider endpoint
    ↓ Returns 200 OK (or error)
    ↓
ShareStory component calls /api/submit/metadata
    ↓ POST { key, name, connection, story, filename, filesize }
Next.js route handler
    ↓ Writes record to metadata store
    ↓ Returns { success: true }
    ↓
ShareStory shows success confirmation
```

### Key Data Flows

1. **Credentials never reach the browser.** Storage API keys live in environment variables, accessed only by the Next.js API route. The presigned URL is time-limited and operation-limited (PUT only, specific key only).

2. **Files never touch Vercel.** The PUT goes from browser directly to the storage provider. Vercel only handles the two JSON API calls.

3. **Metadata is stored separately from files.** The storage bucket holds raw binaries. The metadata store (Airtable, KV, JSON) holds human-readable submission records with a reference key linking back to the file.

## Metadata Storage Options

The metadata payload is small: name, connection to coach, optional text story, storage key, filename, filesize, timestamp. This is approximately 1–3 KB per submission.

| Option | Complexity | Cost | Chris's Access | Best For |
|--------|-----------|------|---------------|----------|
| **Airtable** | Low — REST API, `airtable` npm package | Free tier (1200 records/base) | Excellent — Airtable UI is visual, sortable, exportable | Recommended for non-technical review workflow |
| **JSON file in storage bucket** | Very low — just write `{key}.json` alongside video | Storage cost only (~$0) | Moderate — must download or use bucket viewer | Simplest code; no external API dependency |
| **Vercel KV (Upstash Redis)** | Low | Free tier (30k requests/month) | Poor — Redis CLI or custom admin page | Only if Vercel-native stack matters |
| **Google Sheets** | Medium — Sheets API OAuth is painful | Free | Good — familiar spreadsheet UI | Avoid: OAuth setup cost exceeds benefit |
| **Email (SendGrid/Resend)** | Low | Free tier available | Excellent — lands in inbox | Good as a notification supplement, not primary store |

**Recommendation: Airtable as primary metadata store, optionally supplemented by an email notification.**

Rationale:
- Chris needs to browse submissions without a custom admin UI. Airtable's free tier is well within capacity for a documentary project (dozens to low hundreds of submissions). The Airtable UI lets him sort by date, filter by connection type, and see all text stories inline.
- The `airtable` npm package makes record creation trivial from a Next.js API route.
- If Airtable ever becomes a problem, the metadata shape is simple enough to migrate.
- A companion email notification (via Resend or similar) gives an immediate alert when a submission arrives, while Airtable serves as the permanent record.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Cloudflare R2 (or B2/S3) | S3-compatible SDK (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`) | Credentials in env vars: `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET` |
| Airtable | REST via `airtable` npm package | `AIRTABLE_API_KEY` + `AIRTABLE_BASE_ID` + `AIRTABLE_TABLE_NAME` in env vars |
| Email notification (optional) | Resend SDK or SendGrid in `/api/submit/metadata` | Fires after successful Airtable write; sends to Chris's email |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `ShareStory` component ↔ `/api/upload/presign` | JSON POST / JSON response | Sends `{ filename, contentType }`, receives `{ url, key }` |
| `ShareStory` component ↔ Storage provider | Direct HTTP PUT with `Content-Type` header | No auth headers — auth is embedded in presigned URL |
| `ShareStory` component ↔ `/api/submit/metadata` | JSON POST / JSON response | Sends `{ key, name, connection, story }`, receives `{ success }` |
| `/api/submit/metadata` ↔ Airtable | Airtable REST API via npm SDK | Server-side only; credentials not exposed to client |

## Suggested Build Order

Dependencies drive this order. Each step unblocks the next.

```
1. Storage bucket setup + presign route
   │  Verifies storage credentials work, establishes key naming convention
   │
2. Client upload (PUT to presigned URL)
   │  Wires ShareStory component to call presign endpoint, then PUT
   │  Validates that large files actually reach storage
   │
3. Success/error state in UI
   │  User sees upload progress and confirmation
   │  Must work before adding metadata step
   │
4. Metadata route (/api/submit/metadata)
   │  Airtable record creation with storage key + form fields
   │  Depends on knowing the storage key from step 1
   │
5. Email notification (optional add-on)
   │  Fires from within metadata route after Airtable write succeeds
   │  Zero risk to core upload flow
   │
6. Multipart upload (large file resilience)
      Only needed if testing reveals failures on large files
      Significant complexity — defer until validated by real usage
```

**Critical dependency:** The metadata POST (`/api/submit/metadata`) must include the storage key (`key`), which is only known after step 1 (presigning). This means the client must maintain state across all three steps (presign → upload → submit) in a single form submission flow.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–500 submissions | Single-PUT presigned URL, Airtable free tier, no queue needed |
| 500–5,000 submissions | Airtable paid plan, consider adding a lightweight DB (Neon/PlanetScale); multipart upload for reliability |
| 5,000+ submissions | Unlikely for this project scope; would revisit storage and metadata layers |

This is a community documentary project. Scaling to thousands of concurrent uploaders is not a design constraint.

## Anti-Patterns

### Anti-Pattern 1: Proxying Large Files Through Next.js API Routes on Vercel

**What people do:** Use a Next.js API route with `multer` or `formidable` to receive the upload, then forward to storage.

**Why it's wrong:** Vercel enforces a hard 4.5 MB request body limit. Files above this size receive `413 FUNCTION_PAYLOAD_TOO_LARGE` and are dropped. Configuration changes (`bodyParser: false`, `sizeLimit`) do not override this platform-level limit.

**Do this instead:** Presigned URL pattern — storage provider receives the file directly from the browser.

### Anti-Pattern 2: Saving Metadata Before Confirming Upload Success

**What people do:** Write the Airtable record immediately when the user hits submit, then start the upload.

**Why it's wrong:** If the upload fails or is abandoned, the metadata record references a file that does not exist in storage.

**Do this instead:** Only call `/api/submit/metadata` after the PUT to the storage presigned URL returns a 200 status. The flow is presign → upload → confirm. Confirm is the last step.

### Anti-Pattern 3: Storing Storage Credentials in Client-Side Code

**What people do:** Include S3/R2 access keys in the React component or `NEXT_PUBLIC_` environment variables to call storage directly.

**Why it's wrong:** Credentials are visible in browser network requests and source maps. Anyone can write to or delete from the bucket.

**Do this instead:** All credential usage happens in the Next.js API route (server-side). The client only receives the time-limited, operation-limited presigned URL.

### Anti-Pattern 4: Using the File's Original Name as the Storage Key

**What people do:** Use `file.name` directly as the object key: `submissions/coach-memory.mp4`.

**Why it's wrong:** Two submissions with the same filename overwrite each other. Filenames from phones contain spaces and Unicode that break URLs. The client controls the naming.

**Do this instead:** Generate the key server-side using a UUID: `submissions/2026/03/{uuid}-{sanitized-name}.mp4`.

## Sources

- [Vercel: How to bypass the 4.5MB body size limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions) — HIGH confidence, official Vercel KB
- [Vercel Functions Limitations](https://vercel.com/docs/functions/limitations) — HIGH confidence, official docs
- [Cloudflare R2: Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) — HIGH confidence, official Cloudflare docs
- [Cloudflare R2: Upload Objects](https://developers.cloudflare.com/r2/objects/upload-objects/) — HIGH confidence, official docs
- [Backblaze B2: S3 Compatible API Presigned URLs](https://help.backblaze.com/hc/en-us/articles/360047815993) — HIGH confidence, official Backblaze help
- [Presigned URLs in Next.js App Router with S3](https://conermurphy.com/blog/presigned-urls-nextjs-s3-upload/) — MEDIUM confidence, verified against SDK docs
- [Upload to S3 in Next.js and save references](https://neon.com/guides/next-upload-aws-s3) — MEDIUM confidence, pattern aligns with official S3 docs
- [AWS Multipart Upload with Presigned URLs](https://dev.to/traindex/multipart-upload-for-large-files-using-pre-signed-urls-aws-4hg4) — MEDIUM confidence, cross-referenced with AWS docs
- [Next.js API Routes body size limit issues](https://github.com/vercel/next.js/issues/57501) — HIGH confidence, confirmed by multiple reports

---
*Architecture research for: large file upload pipeline, Next.js 16 + Vercel + S3-compatible storage*
*Researched: 2026-03-16*
