# Phase 1: Backend Infrastructure - Research

**Researched:** 2026-03-16
**Domain:** Cloudflare R2 provisioning, AWS SDK v3 presigned URLs, Next.js 16 App Router API routes, Vercel env vars
**Confidence:** HIGH (all critical claims verified against official Cloudflare, Next.js, and Vercel documentation)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Cloudflare R2 bucket is provisioned with correct CORS policy allowing browser PUT uploads | Wrangler CLI bucket creation + CORS set commands documented; exact JSON format and AllowedHeaders verified |
| INFRA-02 | R2 API credentials are stored as Vercel environment variables (never NEXT_PUBLIC_) | Vercel env var naming conventions verified; credential leak detection via bundle grep documented |
| INFRA-03 | `/api/upload/presign` route generates a time-limited signed PUT URL and returns `{ uploadUrl, fileKey }` | AWS SDK v3 `getSignedUrl` + `PutObjectCommand` exact pattern from official Cloudflare docs; Next.js App Router route handler path verified |
| INFRA-04 | Storage keys are generated server-side with UUID prefix to prevent collisions | nanoid/uuid pattern, key format convention, server-side generation rationale all documented |
</phase_requirements>

---

## Summary

Phase 1 establishes the storage backend. Every other phase depends on it. The core flow is: provision a private R2 bucket, configure CORS so browsers can PUT directly to it, create a Next.js API route that generates signed PUT URLs server-side, and verify the end-to-end path with a real browser PUT before writing any UI code. This phase is complete when the Phase 1 Success Criteria are met: a real browser PUT from the Vercel production domain returns HTTP 200 with no CORS errors, credentials are invisible in any client bundle, and direct object access returns 403.

The single highest-risk item is CORS. R2 does not accept the S3-style wildcard `AllowedHeaders: ["*"]`. Content-Type must be listed explicitly. CORS must be set via Wrangler CLI, not the dashboard editor (the dashboard CORS editor has a known history of being broken or unreliable per STATE.md and community reports). Everything else in this phase is straightforward SDK configuration.

The project uses the App Router at `app/` (not `src/app/`) based on the existing file structure. Next.js is 16.1.6, React 19, TypeScript, Tailwind v4. No AWS SDK or UUID library is installed yet.

**Primary recommendation:** Provision bucket and set CORS via Wrangler CLI before writing any TypeScript. Validate with a raw `curl` PUT, then validate from a browser. Only then implement the `/api/upload/presign` route.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@aws-sdk/client-s3` | 3.1009.0 | R2 S3-compatible client; provides `S3Client`, `PutObjectCommand` | R2 is S3-compatible; official Cloudflare docs use this SDK as the reference implementation |
| `@aws-sdk/s3-request-presigner` | 3.1009.0 | `getSignedUrl()` function to sign presigned PUT URLs | Required companion package to `client-s3`; same major version required |
| `nanoid` | 5.1.7 | Generate collision-resistant unique IDs for storage key prefixes | Smaller bundle than `uuid`; URL-safe; 21-character default gives 2^126 uniqueness |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `uuid` | 13.0.0 | Alternative UUID v4 generation | Only if `nanoid` conflicts; nanoid is preferred for new code |
| `wrangler` | CLI (npx) | Create R2 bucket, set CORS policy | Required for R2 provisioning; use `npx wrangler` rather than global install |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `nanoid` | `uuid` | uuid produces RFC-standard UUIDs (familiar format); nanoid is ~40% shorter and URL-safe by default. Either works. |
| `wrangler` for CORS | Cloudflare API (curl) | Wrangler wraps the API; direct curl to the S3 CORS API also works but requires more boilerplate. Wrangler is simpler. |

**Installation:**
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner nanoid
```

**Version verification (confirmed 2026-03-16 via npm registry):**
- `@aws-sdk/client-s3`: 3.1009.0
- `@aws-sdk/s3-request-presigner`: 3.1009.0 (must match major version with client-s3)
- `nanoid`: 5.1.7

---

## Architecture Patterns

### Recommended Project Structure

The project currently has `app/` at root (not `src/app/`). All new files follow this pattern:

```
app/
├── api/
│   └── upload/
│       └── presign/
│           └── route.ts       # POST — generate signed PUT URL
└── (existing pages)
lib/
└── storage/
    └── r2.ts                  # S3Client initialization, singleton pattern
```

The `lib/storage/r2.ts` module initializes the client once and exports it. The API route imports from `lib/storage/r2.ts` and calls `getSignedUrl`. This isolates all R2-specific config to a single file.

### Pattern 1: R2 Client Singleton

**What:** Initialize `S3Client` once per process, not per request.
**When to use:** Always — cold starts are expensive; re-using the client across requests is standard.

```typescript
// Source: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
import { S3Client } from "@aws-sdk/client-s3";

export const r2Client = new S3Client({
  region: "auto",  // required by SDK, ignored by R2
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
```

### Pattern 2: Presign Route Handler

**What:** POST endpoint that receives `{ filename, contentType }` and returns `{ uploadUrl, fileKey }`.
**When to use:** Always — this is the only correct pattern for Vercel + large file uploads.

```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/route
// Source: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";
import { r2Client } from "@/lib/storage/r2";

export async function POST(request: Request) {
  const { filename, contentType } = await request.json();

  const fileKey = `submissions/${new Date().toISOString().slice(0, 7)}/${nanoid()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  const uploadUrl = await getSignedUrl(
    r2Client,
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: fileKey,
      ContentType: contentType,
    }),
    { expiresIn: 900 }, // 15 minutes
  );

  return Response.json({ uploadUrl, fileKey });
}
```

**Notes on `ContentType` in `PutObjectCommand`:** Including `ContentType` in the command restricts the presigned URL — the browser PUT must use a matching `Content-Type` header or R2 will reject the request with a 403. This is correct behavior: it prevents mismatched content from being uploaded against the signed URL. The client must pass the exact MIME type it intends to upload with.

### Pattern 3: Storage Key Naming Convention

**What:** Server-generated key with UUID prefix and date-based path.
**When to use:** Always — never use client-supplied filenames as keys.

```
submissions/2026/03/{nanoid()}-{sanitized-original-name}.mp4
```

This format:
- Prevents collisions (nanoid prefix)
- Makes the bucket browsable chronologically without a database
- Strips unsafe characters from original filenames (spaces, Unicode, special chars)

### Anti-Patterns to Avoid

- **Using `NEXT_PUBLIC_` prefix on any R2 credential:** Credentials baked into the client bundle are permanently compromised. The ONLY environment variables with `NEXT_PUBLIC_` should be things like the public site URL — never access keys, secrets, or account IDs.
- **Using `file.name` as the storage key directly:** Client-supplied filenames collide, contain unsafe characters, and leak submitter info. Always generate the key server-side.
- **Including file bytes in the presign API request body:** The presign route receives JSON (`filename`, `contentType`) only. File bytes must never touch a Vercel function.
- **Setting `AllowedHeaders: ["*"]` in R2 CORS:** Wildcard AllowedHeaders do not work on R2. List `"Content-Type"` explicitly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Presigned URL generation | Custom HMAC signature logic | `@aws-sdk/s3-request-presigner` + `getSignedUrl` | Signature v4 with canonical headers, date handling, and credential scoping is complex and has security implications if done wrong |
| Unique key generation | `Math.random()` or timestamp-based IDs | `nanoid` | Timestamp IDs collide under concurrent submissions; Math.random() has inadequate entropy for collision resistance |
| URL expiry management | Custom token with expiry claim | Built-in `expiresIn` parameter on `getSignedUrl` | R2 enforces expiry server-side; no client-side TTL logic needed |

**Key insight:** The AWS SDK's presigner handles all the Signature Version 4 complexity (canonical request, string-to-sign, credential scope, signature derivation). Writing this from scratch is a well-known security pitfall.

---

## Common Pitfalls

### Pitfall 1: R2 CORS AllowedHeaders Wildcard Does Not Work

**What goes wrong:** Browser PUT returns CORS error. Preflight OPTIONS succeeds but the actual PUT is blocked because `Content-Type` is not in the allowed headers list.
**Why it happens:** Developers copy S3 CORS examples that use `["*"]` for AllowedHeaders. R2 does not honor the wildcard — it requires explicit header names.
**How to avoid:** Set `AllowedHeaders: ["Content-Type"]` (or `"content-type"` — case-insensitive in practice, but use the casing shown in official docs). Test with a real browser PUT from the production domain before writing any UI.
**Warning signs:** Upload works via `curl` (no CORS) but fails in browser DevTools with "No 'Access-Control-Allow-Origin' header" or "blocked by CORS policy."

### Pitfall 2: R2 Dashboard CORS Editor Is Unreliable

**What goes wrong:** CORS rules set via the dashboard appear to save but don't take effect, or the editor shows an error and the rules are silently not applied.
**Why it happens:** The R2 dashboard CORS editor has a known reliability issue (documented in PITFALLS.md and corroborated by Cloudflare community thread #432339).
**How to avoid:** Always configure CORS via `npx wrangler r2 bucket cors set <bucket> --file cors.json`. Verify with `npx wrangler r2 bucket cors list <bucket>`.
**Warning signs:** CORS error in browser even though the dashboard shows rules saved.

### Pitfall 3: `ContentType` Mismatch Between Presign and PUT

**What goes wrong:** The presign route generates a URL locked to `video/mp4`. The browser sends a PUT with `Content-Type: video/quicktime` (iOS .mov files). R2 rejects with 403.
**Why it happens:** iOS Safari reports `.mov` as `video/quicktime`, not `video/mp4`. If the client passes `file.type` from the file picker, it will be whatever the browser reports.
**How to avoid:** Pass `file.type` from the client verbatim to the presign endpoint, and include that exact value in both the `PutObjectCommand` and the browser's PUT `Content-Type` header. Do not hardcode MIME types.

### Pitfall 4: Vercel Environment Variables Not Applied to Existing Deployments

**What goes wrong:** Credentials are added to Vercel environment settings but the deployed function still fails with "missing credentials" errors.
**Why it happens:** Vercel env var changes only apply to NEW deployments — not to already-deployed functions.
**How to avoid:** After adding env vars in the Vercel dashboard, trigger a new deployment (push a commit or redeploy from the Vercel UI). For local development, use `.env.local` and run `vercel env pull` to sync.

### Pitfall 5: Credentials Leaked in Build Output

**What goes wrong:** R2 credentials end up in `.next/static/` chunks, visible to anyone who opens DevTools.
**Why it happens:** A credential env var accidentally gets a `NEXT_PUBLIC_` prefix, or an import of the `r2Client` module is included in a client component.
**How to avoid:** Keep `lib/storage/r2.ts` as a server-only module. Only import it inside `app/api/` route handlers. After build, verify: `grep -r "R2_SECRET\|R2_ACCESS\|CLOUDFLARE_ACCOUNT" .next/static/ 2>/dev/null` — should return nothing.

---

## Code Examples

### R2 Client Initialization

```typescript
// lib/storage/r2.ts
// Source: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
import { S3Client } from "@aws-sdk/client-s3";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
```

### Presign Route Handler

```typescript
// app/api/upload/presign/route.ts
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/route
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";
import { r2Client } from "@/lib/storage/r2";

export async function POST(request: Request) {
  const { filename, contentType } = await request.json();

  // Sanitize filename: replace spaces and unsafe chars with underscores
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Generate server-side key — client never controls the storage path
  const date = new Date().toISOString().slice(0, 7); // "2026-03"
  const fileKey = `submissions/${date}/${nanoid()}-${safeName}`;

  const uploadUrl = await getSignedUrl(
    r2Client,
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: fileKey,
      ContentType: contentType,
    }),
    { expiresIn: 900 }, // 15-minute window
  );

  return Response.json({ uploadUrl, fileKey });
}
```

### R2 CORS Configuration File (for Wrangler CLI)

```json
{
  "rules": [
    {
      "AllowedOrigins": ["https://your-project.vercel.app"],
      "AllowedMethods": ["PUT"],
      "AllowedHeaders": ["Content-Type"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

**Note on format confidence:** The official Cloudflare docs CORS page shows two different formats — a flat `AllowedOrigins/AllowedMethods` format for the dashboard and a nested `allowed.origins/allowed.methods` format for Wrangler. Community sources (GitHub issues, developer posts) consistently show the `rules` array with Pascal-case `AllowedOrigins` keys as the working Wrangler format. This is MEDIUM confidence — **verify with `npx wrangler r2 bucket cors list` after applying to confirm rules are set correctly.**

### Wrangler CLI Commands

```bash
# Authenticate (required once)
npx wrangler login

# Create the bucket
npx wrangler r2 bucket create mouse-doc-uploads

# Verify bucket exists
npx wrangler r2 bucket list

# Apply CORS policy (cors.json must exist first)
npx wrangler r2 bucket cors set mouse-doc-uploads --file cors.json

# Verify CORS rules were applied
npx wrangler r2 bucket cors list mouse-doc-uploads
```

### Environment Variables — .env.local

```bash
# .env.local (never commit this file)
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
R2_ACCESS_KEY_ID=your_access_key_id_here
R2_SECRET_ACCESS_KEY=your_secret_access_key_here
R2_BUCKET_NAME=mouse-doc-uploads
R2_PUBLIC_URL=                     # Leave empty for Phase 1 — bucket stays private
```

### End-to-End Smoke Test (curl, no browser)

```bash
# Step 1: Get a presigned URL from the running Next.js dev server
RESULT=$(curl -s -X POST http://localhost:3000/api/upload/presign \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.mp4","contentType":"video/mp4"}')

echo $RESULT
# Expected: {"uploadUrl":"https://<account>.r2.cloudflarestorage.com/...","fileKey":"submissions/2026-03/..."}

# Step 2: Extract the URL and PUT a test file
UPLOAD_URL=$(echo $RESULT | python3 -c "import sys,json; print(json.load(sys.stdin)['uploadUrl'])")
curl -s -o /dev/null -w "%{http_code}" -X PUT "$UPLOAD_URL" \
  -H "Content-Type: video/mp4" \
  --data-binary @/dev/null

# Expected output: 200
```

### End-to-End Smoke Test (browser DevTools console)

```javascript
// Run in browser DevTools on the production Vercel URL
// This tests CORS — curl tests bypass CORS entirely

const { uploadUrl, fileKey } = await fetch('/api/upload/presign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ filename: 'test.mp4', contentType: 'video/mp4' }),
}).then(r => r.json());

console.log('fileKey:', fileKey);

// Create a tiny fake file
const blob = new Blob(['test content'], { type: 'video/mp4' });

const res = await fetch(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'video/mp4' },
  body: blob,
});

console.log('Status:', res.status); // Expected: 200
// If CORS is broken, this throws before reaching the status line
```

### Credential Leak Verification

```bash
# After running `npm run build`, verify no credentials in static bundle
grep -r "R2_SECRET\|R2_ACCESS\|CLOUDFLARE_ACCOUNT" .next/static/ 2>/dev/null
# Expected: no output (empty)

# Also check for any NEXT_PUBLIC_ prefixed storage vars
grep -r "NEXT_PUBLIC_" .env* 2>/dev/null | grep -i "r2\|secret\|key\|account"
# Expected: no output (empty)
```

---

## R2 Credential Setup Steps

This is a dashboard workflow — no code required, just documentation for the plan.

1. Go to Cloudflare Dashboard → R2 Object Storage → Manage R2 API Tokens
2. Select "Create Account API Token"
3. Under Permissions: select "Object Read & Write"
4. Optionally scope to the specific bucket (`mouse-doc-uploads`)
5. Click Create — **copy the Secret Access Key immediately** (shown only once)
6. Note the three values: Access Key ID, Secret Access Key, Account ID (visible on R2 overview page)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router (`pages/api/upload.ts`) | App Router (`app/api/upload/presign/route.ts`) | Next.js 13 (stable in 15/16) | Route handlers use Web API `Request`/`Response`; no `req`/`res` Node-style arguments |
| `@aws-sdk` v2 (`aws-sdk` package) | `@aws-sdk` v3 modular (`@aws-sdk/client-s3`) | 2020 (v3 stable) | Modular imports — only ship the S3 client, not the entire AWS SDK; tree-shakeable |
| R2 CORS via dashboard | R2 CORS via Wrangler CLI | Ongoing (dashboard editor unreliable) | Must use CLI; dashboard editor has reliability issues per community reports |

**Deprecated/outdated:**
- `aws-sdk` (v2): monolithic package, not tree-shakeable, not recommended for new code. Use `@aws-sdk/client-s3` (v3).
- Pages Router API routes (`pages/api/`): this project uses App Router exclusively.

---

## Open Questions

1. **Wrangler CORS JSON format — exact schema**
   - What we know: Two formats appear in Cloudflare docs — nested `allowed.origins` and flat `AllowedOrigins`. Community sources show `{ "rules": [{ "AllowedOrigins": [...], ... }] }` as working.
   - What's unclear: The official Cloudflare docs page shows conflicting examples. The exact canonical format for the `--file` argument is not unambiguously documented in a single place.
   - Recommendation: After running `npx wrangler r2 bucket cors set`, immediately run `npx wrangler r2 bucket cors list` to verify the rules are present. If the list returns empty, try the alternative format. The smoke test (browser DevTools PUT) is the ground-truth validator.

2. **Vercel preview domain for CORS AllowedOrigins**
   - What we know: CORS `AllowedOrigins` must exactly match the request origin. Vercel preview deployments use generated URLs (`project-git-branch-team.vercel.app`).
   - What's unclear: Whether the CORS policy needs `["*"]` during development/preview phase, or whether a production-only policy is sufficient for Phase 1 verification.
   - Recommendation: For Phase 1 verification only, set `AllowedOrigins: ["*"]` to unblock testing. Before Phase 2 ships to production, lock it to the production domain. Never ship `["*"]` to production.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed — no test config files found in project root |
| Config file | None — Wave 0 must install |
| Quick run command | `npx jest --testPathPattern=presign` (after Wave 0 setup) |
| Full suite command | `npx jest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | R2 bucket has CORS policy allowing browser PUT | Manual smoke test | Browser DevTools console script (see Code Examples) | ❌ Wave 0 |
| INFRA-02 | R2 credentials not in client bundle | Build artifact check | `grep -r "R2_SECRET" .next/static/` returns empty | ❌ Wave 0 (shell script) |
| INFRA-03 | `/api/upload/presign` returns `{ uploadUrl, fileKey }` | Unit | `npx jest tests/presign.test.ts -x` | ❌ Wave 0 |
| INFRA-04 | fileKey is UUID-prefixed, generated server-side | Unit | `npx jest tests/presign.test.ts -x` | ❌ Wave 0 |

**Note on INFRA-01:** CORS behavior is inherently browser-specific and cannot be meaningfully unit tested. The validation is the browser smoke test — the plan must include a manual verification step.

### Sampling Rate

- **Per task commit:** `npx jest tests/presign.test.ts -x` (if Jest is installed)
- **Per wave merge:** `npx jest`
- **Phase gate:** Browser smoke test (INFRA-01) + build artifact grep (INFRA-02) + full jest suite green

### Wave 0 Gaps

- [ ] `tests/presign.test.ts` — covers INFRA-03, INFRA-04 (mock S3Client, assert response shape and key format)
- [ ] `jest.config.ts` — jest configuration for Next.js App Router
- [ ] Framework install: `npm install --save-dev jest @types/jest ts-jest jest-environment-node`
- [ ] `tests/setup.ts` — env var mocks for `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

---

## Sources

### Primary (HIGH confidence)

- [Cloudflare R2 Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) — exact S3Client config, `getSignedUrl` pattern, TTL limits (1s–7 days)
- [Cloudflare R2 CORS Configuration](https://developers.cloudflare.com/r2/buckets/cors/) — Wrangler CLI commands, JSON format, AllowedHeaders requirements
- [Cloudflare R2 API Tokens](https://developers.cloudflare.com/r2/api/s3/tokens/) — token creation steps, Object Read & Write permission, credentials produced
- [Cloudflare R2 Create Buckets](https://developers.cloudflare.com/r2/buckets/create-buckets/) — `wrangler r2 bucket create` command, naming rules
- [Cloudflare R2 Public Buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/) — new buckets are private by default; Public URL Access must be explicitly enabled
- [Next.js 16 Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route) — file path convention, `POST(request: Request)` pattern, `request.json()`, `Response.json()`; verified version 16.1.6 with lastUpdated 2026-02-27
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables) — naming, NEXT_PUBLIC_ prefix behavior, per-environment scoping, `vercel env pull`

### Secondary (MEDIUM confidence)

- [Cloudflare Community: CORS Wrangler file format](https://community.cloudflare.com/t/problem-with-settings-cors-policies-on-r2/432339) — confirms `{ "rules": [{ "AllowedOrigins": [...] }] }` format for Wrangler `--file`; multiple responders corroborate
- [Liran Tal: Cloudflare R2 Pre-signed URL Uploads](https://lirantal.com/blog/cloudflare-r2-presigned-url-uploads-hono) — confirms AWS SDK v3 pattern with R2 endpoint override; consistent with official docs

### Tertiary (LOW confidence)

- None — all critical claims verified against primary sources

---

## Metadata

**Confidence breakdown:**
- Standard stack (packages + versions): HIGH — verified via `npm view` against npm registry 2026-03-16
- Architecture patterns (route structure, SDK usage): HIGH — verified against official Next.js 16 and Cloudflare docs
- CORS configuration: MEDIUM — JSON format for Wrangler `--file` has conflicting examples in docs; verified through community sources; ground-truth is the smoke test
- Pitfalls: HIGH — sourced from official docs, known Cloudflare community issues, and prior project research (PITFALLS.md)

**Research date:** 2026-03-16
**Valid until:** 2026-06-16 (90 days — R2 and Next.js APIs are stable; AWS SDK v3 version will drift but pattern is stable)
