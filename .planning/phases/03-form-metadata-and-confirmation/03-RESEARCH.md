# Phase 3: Form, Metadata, and Confirmation — Research

**Researched:** 2026-03-17
**Domain:** Airtable REST API, Next.js App Router route handlers, React form state, client-side validation
**Confidence:** HIGH

---

## Summary

Phase 3 completes the submission pipeline: form fields (name, relation, email, phone, text story) are collected in the existing `ShareStory.tsx` component, a new `/api/submit/metadata` route handler writes a record to Airtable, and the confirmation screen is extended to handle text-only submissions. No new libraries are introduced — the entire implementation uses the existing stack (Next.js App Router route handlers, native `fetch`, React `useState`).

The critical external dependency is Airtable's REST API. The recommended approach is **raw `fetch` against the REST API** rather than the `airtable` npm package (v0.12.2, CJS-only, last updated June 2025 but not maintained for ESM-first environments). The REST API is stable, well-documented, and requires only three env vars: `AIRTABLE_PAT`, `AIRTABLE_BASE_ID`, and `AIRTABLE_TABLE_ID`.

The one non-trivial design decision is handling the failure case where a file successfully PUT to R2 but the Airtable write fails — the UI-SPEC already defines the MetadataErrorBanner and retry pattern for this exact scenario.

**Primary recommendation:** Use raw `fetch` to call `https://api.airtable.com/v0/{baseId}/{tableId}` from the Next.js route handler. Three env vars. No SDK.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FORM-01 | User enters their name (required) | Already in ShareStory state (`name`). Needs required validation on submit. |
| FORM-02 | User enters their connection to Coach McCollum (required) | Already in ShareStory state (`relation`). Needs required validation on submit. |
| FORM-03 | User enters email address (optional) | New state field `email`. Format validation (must contain @) on blur + submit. |
| FORM-04 | User enters phone number (optional) | New state field `phone`. No format validation in v1. |
| FORM-05 | User can type a text story in a textarea | New state field `textStory`. Full-width textarea, min-height 120px. |
| FORM-06 | Form requires either a file or text story before submission | Validation on submit: `files.length === 0 && textStory.trim().length === 0` blocks submit. |
| META-01 | `/api/submit/metadata` route saves submission record to Airtable | New route handler at `app/api/submit/metadata/route.ts`. POST to Airtable REST API. |
| META-02 | Record includes: name, email, phone, connection, file key or text story, timestamp | Airtable `fields` object maps directly to named columns. Timestamp from `new Date().toISOString()`. |
| CONF-01 | User sees success confirmation screen after submission completes | Already implemented (`submitted === true`). Needs to trigger after metadata POST succeeds (not just after upload). |
| CONF-02 | Success screen is personalized with user's name | Already implemented (`Thank you{name ? ', ${name}' : ''}.`). No changes needed. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 15.x (existing) | Route handler for `/api/submit/metadata` | Already in project, App Router pattern matches `/api/upload/presign` |
| native `fetch` | built-in | HTTP call to Airtable REST API from route handler | No SDK needed; fetch is available in Node 18+ / Next.js edge runtime |
| React `useState` | 19.x (existing) | Form field state, validation error state, metadata POST state | Already used throughout `ShareStory.tsx` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `airtable` npm | 0.12.2 | Official Airtable JS client | NOT recommended here — CJS-only, last updated 3 years without maintenance focus, adds no value over 5 lines of raw fetch for a single record write |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| raw `fetch` | `airtable` npm package | npm package is CJS-only (0.12.2, `main: ./lib/airtable.js`) in an ESM-first Next.js project. The project already had to add `transformIgnorePatterns` for `nanoid`; adding another CJS package increases test complexity with no benefit. raw fetch is 5–10 lines and directly testable. |
| raw `fetch` | `axios` | axios adds a runtime dep for what is a single POST. Not in existing project. |

**Installation:** No new packages required. Three new environment variables only.

**Version verification:** `npm view airtable version` → `0.12.2` (published 2025-06-02, but CJS-only module).

---

## Architecture Patterns

### Route Handler Location
```
app/
├── api/
│   ├── upload/
│   │   └── presign/
│   │       └── route.ts    (existing — pattern to follow)
│   └── submit/
│       └── metadata/
│           └── route.ts    (NEW — Phase 3)
├── components/
│   ├── ShareStory.tsx      (MODIFY — add fields, validation, metadata POST call)
│   └── upload/             (existing — no changes)
└── hooks/
    └── useFileUpload.ts    (existing — no changes)
```

### Pattern 1: Airtable Record Create via raw fetch (route handler)
**What:** Server-side POST to Airtable REST API using `Authorization: Bearer {PAT}` header
**When to use:** Any time a form submission must be recorded in Airtable without exposing the PAT to the browser

```typescript
// app/api/submit/metadata/route.ts
// Source: https://airtable.com/developers/web/api/create-records (verified via search + direct docs)

export async function POST(request: Request) {
  const body = await request.json();
  const { name, relation, email, phone, textStory, fileKey } = body;

  const res = await fetch(
    `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_PAT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records: [
          {
            fields: {
              Name: name,
              Relation: relation,
              Email: email || "",
              Phone: phone || "",
              "Text Story": textStory || "",
              "File Key": fileKey || "",
              Timestamp: new Date().toISOString(),
            },
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Airtable write failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
```

### Pattern 2: Submit flow in ShareStory — file + metadata path
**What:** Upload file first, then POST metadata with the returned `fileKey`
**When to use:** User has selected a file (files.length > 0)

```typescript
// Pseudocode — exact shape inside handleSubmit:
// 1. Upload all files (existing for...of loop)
// 2. After all done: await fetch('/api/submit/metadata', { ...payload, fileKey })
// 3. On 2xx: setSubmitted(true)
// 4. On error: setMetadataError(true)
```

### Pattern 3: Submit flow — text-only path
**What:** Skip upload, POST metadata with empty `fileKey`
**When to use:** `files.length === 0 && textStory.trim().length > 0`

```typescript
// In handleSubmit, before the upload loop:
// if (files.length === 0) {
//   // go straight to metadata POST with fileKey: null
// }
```

### Pattern 4: Client-side validation order
**What:** Validate in field order, show first failing error only
**When to use:** On submit button click (name, relation = required; email = format if non-empty; FORM-06 = file OR text)

```typescript
// Validation order:
// 1. name.trim() === '' → setNameError('Your name is required.')
// 2. relation.trim() === '' → setRelationError('Your connection to Coach McCollum is required.')
// 3. email && !email.includes('@') → setEmailError('Please enter a valid email address.')
// 4. files.length === 0 && textStory.trim() === '' → setForm06Error('Please add a file or type your story — we need at least one.')
// Return early on first failure.
```

### Anti-Patterns to Avoid
- **Calling `/api/submit/metadata` before all uploads complete:** fileKey is only set after the last `await upload(file)` resolves. POST metadata only after the upload loop finishes.
- **Setting `submitted = true` immediately after upload:** Phase 2 used `setTimeout(0)` + functional state read. Phase 3 replaces this with a direct `await fetch('/api/submit/metadata', ...)` then `setSubmitted(true)` on success — cleaner and the timeout trick is no longer needed.
- **Storing `AIRTABLE_PAT` in a `NEXT_PUBLIC_` variable:** Never. Airtable PAT must be server-side only. Pattern matches `R2_ACCESS_KEY_ID` convention already in `.env.local.example`.
- **Validating required fields inside the route handler only:** Client-side validation should catch empty name/relation before the network round trip. Route handler does a server-side re-check as defense-in-depth only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Airtable client | Custom Airtable API wrapper class | 5-line raw `fetch` call | No wrapper is simpler than no wrapper — Airtable REST API is stable, one endpoint |
| Email format validation | Complex regex | `email.includes('@')` | UI-SPEC explicitly specifies: "must contain @" — that is the entire spec |
| Phone format validation | Regex, libphonenumber | None — no validation in v1 | UI-SPEC explicitly: "no format validation in v1" |
| Form state management | Redux, Zustand, react-hook-form | React `useState` | 4 fields with simple validation — library overhead not warranted |
| Loading state management | External state machine | `useState` boolean flags | `isSubmitting`, `isMetadataPosting` — two booleans, total |

**Key insight:** Every "custom solution" temptation here adds complexity for a form with 4 inputs and one external API call.

---

## Common Pitfalls

### Pitfall 1: Metadata POST timing — file OR text path divergence
**What goes wrong:** `handleSubmit` only has the upload path. The text-only path (no files) was never wired. Submit button silently does nothing or triggers the upload loop with an empty array.
**Why it happens:** Phase 2's `handleSubmit` guard is `if (files.length === 0) return` (implicit in `filesToUpload` being empty), so text-only clicks fall through with no action.
**How to avoid:** Explicitly branch at the top of `handleSubmit`: `if (files.length > 0) { ...upload loop... }` then always run the metadata POST.
**Warning signs:** Submit button active when only text typed, but clicking does nothing visible.

### Pitfall 2: `fileKey` state stale closure after upload loop
**What goes wrong:** `fileKey` state from `useFileUpload` is read immediately after the loop, but React batches the `setFileKey(key)` call — the state variable in the closure is still `null`.
**Why it happens:** Same React batching issue documented in Phase 2 for `fileStatuses`. The existing code sets `fileKey` via `setFileKey(key)` inside the loop.
**How to avoid:** Capture the returned fileKey from `await upload(file)` directly into a local variable inside `handleSubmit`, not from React state. Pass the local variable to the metadata POST.
**Warning signs:** Airtable record created with empty `File Key` field even when a file was uploaded.

### Pitfall 3: MetadataErrorBanner vs upload ErrorBanner conflict
**What goes wrong:** Two separate error banners rendered simultaneously — one for upload failure (existing `error` from `useFileUpload`), one for metadata failure (new). They visually stack and confuse the user.
**Why it happens:** Both error conditions are possible on the same form. If the upload fails first, `error` is set. If upload succeeds but metadata fails, `metadataError` is set.
**How to avoid:** Only show MetadataErrorBanner when upload has fully succeeded (all `fileStatuses[i] === 'done'` or text-only path) AND metadata POST failed. These are mutually exclusive states.
**Warning signs:** Both banners visible at once.

### Pitfall 4: Submit button `disabled` logic too complex
**What goes wrong:** Button is disabled when it should be enabled, or vice versa — especially for the text-only case.
**Why it happens:** Phase 2's `isDisabled = isUploading || files.length === 0`. This makes the button disabled for text-only submissions (files.length === 0 always true).
**How to avoid:** Phase 3 replaces this with: `isDisabled = isUploading || isMetadataPosting || (files.length === 0 && textStory.trim().length === 0)`. UI-SPEC section "Validation Rules" is the source of truth.
**Warning signs:** Text-only user can never click submit.

### Pitfall 5: Airtable field names must match exactly
**What goes wrong:** Route handler posts `{ "File Key": "submissions/..." }` but Airtable table has a column named `FileKey` or `file_key`. Record is created but the field is empty or an error is returned.
**Why it happens:** Airtable field names are case-sensitive and space-sensitive. The table must be created with columns matching the code exactly before first use.
**How to avoid:** Document the exact field names in the plan. Create the Airtable table with those exact names before deploying.
**Warning signs:** Airtable returns a 422 error with `"Unknown field name"`.

### Pitfall 6: Missing `AIRTABLE_PAT` env var on Vercel
**What goes wrong:** Metadata route works locally but returns 401 or 403 in production.
**Why it happens:** `.env.local.example` doesn't yet include Airtable vars. Vercel deployment doesn't have them set.
**How to avoid:** Add three vars to `.env.local.example` and document them in the plan. Vercel env vars must be set in dashboard before deployment.
**Warning signs:** `/api/submit/metadata` returns 502 in production only.

---

## Code Examples

Verified patterns from existing project codebase and Airtable REST API documentation:

### Airtable REST API: Create Record
```typescript
// Source: https://airtable.com/developers/web/api/create-records (confirmed pattern via search)
// POST https://api.airtable.com/v0/{baseId}/{tableId}
// Authorization: Bearer {AIRTABLE_PAT}
// Content-Type: application/json
// Body:
{
  "records": [
    {
      "fields": {
        "Name": "Jane Smith",
        "Relation": "Former wrestler, 1992-1996",
        "Email": "jane@example.com",
        "Phone": "555-1234",
        "Text Story": "",
        "File Key": "submissions/2026-03/abc123-story.mp4",
        "Timestamp": "2026-03-17T14:00:00.000Z"
      }
    }
  ]
}
// Response 200: { "records": [{ "id": "recXXX", "createdTime": "...", "fields": {...} }] }
// Response 422: { "error": { "type": "UNKNOWN_FIELD_NAME", "message": "Unknown field name: \"FileKey\"" } }
// Rate limit: 5 requests/second per base — not a concern for single-record writes at form submission rate
```

### Environment Variables (to add to .env.local.example)
```bash
# Airtable — NEVER prefix with NEXT_PUBLIC_
AIRTABLE_PAT=patXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
AIRTABLE_TABLE_ID=tblXXXXXXXXXXXXXX
```

### Airtable Table Schema (columns to create)
```
Column Name         | Type          | Notes
--------------------|---------------|----------------------------------
Name                | Single line   | Required
Relation            | Single line   | Required
Email               | Email         | Optional
Phone               | Phone number  | Optional
Text Story          | Long text     | Optional
File Key            | Single line   | R2 object key, empty for text-only
Timestamp           | Date/time     | ISO 8601 string
```

### Existing `handleSubmit` shape — what Phase 3 replaces
```typescript
// EXISTING (Phase 2) — sets submitted=true via setTimeout after upload:
setTimeout(() => {
  setFileStatuses((prev) => {
    const allDone = files.length > 0 && files.every((_, i) => prev[i] === "done");
    if (allDone) setSubmitted(true);
    return prev;
  });
}, 0);

// PHASE 3 REPLACEMENT — explicit metadata POST, then setSubmitted(true):
// After upload loop completes (or skipped for text-only):
const res = await fetch('/api/submit/metadata', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, relation, email, phone, textStory, fileKey: localFileKey }),
});
if (res.ok) {
  setSubmitted(true);
} else {
  setMetadataError(true);
}
```

### Client-side validation state additions
```typescript
// New state fields needed in ShareStory:
const [email, setEmail] = useState("");
const [phone, setPhone] = useState("");
const [textStory, setTextStory] = useState("");
const [nameError, setNameError] = useState<string | null>(null);
const [relationError, setRelationError] = useState<string | null>(null);
const [emailError, setEmailError] = useState<string | null>(null);
const [form06Error, setForm06Error] = useState<string | null>(null);
const [metadataError, setMetadataError] = useState(false);
const [isMetadataPosting, setIsMetadataPosting] = useState(false);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Airtable legacy API keys | Personal Access Tokens (PAT) | Feb 1, 2024 (deprecated) | Must use PAT, not legacy API key — env var stores a `patXXX` token |
| `airtable` npm package for Node.js | Raw fetch against REST API | Ongoing community shift | npm package is CJS-only at v0.12.2; for ESM-first Next.js, raw fetch is simpler and avoids transform complexity |
| pages/ router API routes | App Router `route.ts` handlers | Next.js 13+ | This project uses App Router — all routes are `app/api/...` with exported `POST` function (matches existing `/api/upload/presign`) |

**Deprecated/outdated:**
- Legacy Airtable API keys (`keyXXX` format): fully deprecated Feb 2024, will not work. Use `patXXX` Personal Access Tokens only.
- `pages/api/` pattern: project uses App Router, all routes in `app/api/`.

---

## Open Questions

1. **Airtable table ID vs table name in the URL**
   - What we know: Airtable REST API accepts both table name (URL-encoded string) and table ID (`tblXXX`) in the endpoint path. Table IDs are stable even if the table is renamed.
   - What's unclear: Which should the env var store? Using `AIRTABLE_TABLE_ID` with the `tblXXX` ID is safer than the table name.
   - Recommendation: Env var stores table ID (`tblXXX`). Plan should document where to find it (Airtable base URL or API docs tab in the base).

2. **What happens when Airtable write fails after successful R2 PUT**
   - What we know: The R2 file exists with no metadata record. STATE.md flags this as a known concern.
   - What's unclear: Is retry sufficient (repost the same payload), or does the file need to be cleaned up?
   - Recommendation: The MetadataErrorBanner retry pattern (re-POST same payload with the captured local `fileKey`) is sufficient for v1. File cleanup (R2 delete on metadata failure) is a v2 concern.

3. **Grid collapse at 640px — CSS media query approach**
   - What we know: Inline styles are the project convention. CSS `@media` queries cannot be expressed as inline `style` props in React.
   - What's unclear: Is there an established pattern in the existing codebase for responsive breakpoints?
   - Recommendation: Use the existing `window.innerWidth` + `useEffect` + `useState` pattern if needed, OR use Tailwind responsive classes (`grid-cols-2 sm:grid-cols-2`) only for the grid wrapper while keeping field styles inline. Check if Tailwind is already applied to any elements in `ShareStory.tsx` — currently it appears not to be. Either a JS-based breakpoint hook or Tailwind class on the grid wrapper alone are both acceptable; the plan should pick one.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + ts-jest |
| Config file | `jest.config.ts` |
| Quick run command | `npx jest --testPathPattern=metadata` |
| Full suite command | `npx jest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| META-01 | `/api/submit/metadata` returns 200 and calls Airtable API | unit | `npx jest --testPathPattern=metadata` | ❌ Wave 0 |
| META-01 | Route returns 400 when name missing | unit | `npx jest --testPathPattern=metadata` | ❌ Wave 0 |
| META-01 | Route returns 502 when Airtable returns non-2xx | unit | `npx jest --testPathPattern=metadata` | ❌ Wave 0 |
| META-02 | All fields (name, relation, email, phone, textStory, fileKey, timestamp) sent to Airtable | unit | `npx jest --testPathPattern=metadata` | ❌ Wave 0 |
| FORM-06 | Validation blocks submit when files AND textStory both empty | unit (pure fn) | `npx jest --testPathPattern=formValidation` | ❌ Wave 0 |
| CONF-01/02 | Confirmation screen shows after metadata POST success | manual smoke | `npx run dev` + browser | N/A |

**Note:** `ShareStory.tsx` client component tests would require `@testing-library/react`, which is not installed and has been explicitly avoided in this project (see 02-01-SUMMARY.md). Form validation logic that can be extracted to a pure function should be tested directly. The metadata route handler is the primary unit-testable artifact.

### Sampling Rate
- **Per task commit:** `npx jest` (full suite, 25+ tests, runs in < 10s)
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/api/metadata.test.ts` — covers META-01, META-02 (mock `fetch` to Airtable)
- [ ] `__tests__/utils/formValidation.test.ts` — covers FORM-06 validation logic (if extracted to a pure utility function)

---

## Sources

### Primary (HIGH confidence)
- Airtable REST API docs (verified via search + direct content fetch): `POST https://api.airtable.com/v0/{baseId}/{tableId}`, Authorization header `Bearer {PAT}`, `records[].fields` body structure — confirmed at https://airtable.com/developers/web/api/create-records
- npm registry (`npm view airtable version`): `0.12.2`, published `2025-06-02`, `main: ./lib/airtable.js` (CJS-only) — verified live
- Existing project code: `app/api/upload/presign/route.ts` — route handler pattern to replicate, `app/components/ShareStory.tsx` — existing state shape and submit flow, `jest.config.ts` — test config and transformIgnorePatterns

### Secondary (MEDIUM confidence)
- Airtable PAT deprecation of legacy API keys (Feb 2024): confirmed via multiple search results including https://support.airtable.com/docs/creating-personal-access-tokens
- Rate limit 5 req/sec per base: confirmed via search (https://support.airtable.com/docs/managing-api-call-limits-in-airtable referenced, page content not extractable but consistent across multiple sources)
- Airtable field name case-sensitivity: consistent across community sources and documentation references

### Tertiary (LOW confidence)
- `airtable` npm package CJS compatibility issues with ESM-first Next.js: inferred from package's `main: ./lib/airtable.js` (no `module` or `exports` field) combined with this project's existing `transformIgnorePatterns` for `nanoid`. Not verified by a specific issue report.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; existing stack confirmed
- Airtable REST API: HIGH — endpoint, auth header, body schema confirmed from official docs references
- Architecture: HIGH — route handler pattern copied from existing `/api/upload/presign`
- Pitfalls: MEDIUM — closure/batching issues are confirmed from Phase 2 learnings; Airtable field naming pitfall is general knowledge
- Test strategy: HIGH — mirrors Phase 2 test patterns exactly

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (Airtable API is stable; PAT auth has been current since Feb 2024)
