---
phase: 01-backend-infrastructure
plan: 02
status: complete
completed: 2026-03-16
---

# Plan 01-02 Summary: R2 Provisioning & End-to-End Verification

## What Was Done

- Created `cors.json` with explicit `AllowedHeaders: ["Content-Type"]` (not wildcard), applied via Wrangler CLI
- Provisioned `mouse-doc-uploads` R2 bucket (private, no public access)
- Created R2 API token with Object Read & Write permissions scoped to the bucket
- Set all four env vars in `.env.local` and Vercel (all environments)
- Fixed credential issue: initial R2_SECRET_ACCESS_KEY was truncated (63 chars); re-copied full 64-char key from Cloudflare Dashboard
- CORS origins locked to production domains after testing

## Verification Results

| Check | Result |
|---|---|
| Browser PUT from app origin to R2 | ✅ HTTP 200, no CORS errors |
| Presign route returns `{ uploadUrl, fileKey }` | ✅ fileKey: `submissions/2026-03/{nanoid}-{filename}` |
| Direct bucket URL access (no presigned params) | ✅ 403 Access Denied |
| `npm run build` succeeds | ✅ |
| No R2 credentials in `.next/static/` | ✅ grep returns empty |

## Phase 1 Requirements Met

- **INFRA-01**: Browser PUT returns 200 with no CORS errors
- **INFRA-02**: No credentials in client-side build output
- **INFRA-03**: Presign route returns `{ uploadUrl, fileKey }`
- **INFRA-04**: fileKey matches `submissions/YYYY-MM/{nanoid}-{sanitized_name}`

## Key Decisions

- Used Wrangler CLI for CORS (not dashboard — dashboard editor is unreliable per research)
- `AllowedHeaders: ["Content-Type"]` explicit list required; R2 rejects wildcard headers
- CORS origins locked to production domains (not wildcard) before Phase 2
