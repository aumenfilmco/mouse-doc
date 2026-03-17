# Phase 2: Upload UI - Research

**Researched:** 2026-03-17
**Domain:** React component extraction, XHR file upload, drag-and-drop, iOS file picker, progress reporting, error handling
**Confidence:** HIGH

## Summary

Phase 2 is not a greenfield build — it is a behavioral replacement. `ShareStory` already exists as a working visual prototype in `app/page.tsx` (lines 263–446). The sole job of this phase is to extract that component into its own file and replace the fake `setSubmitted(true)` submit handler with a real XHR pipeline: call `/api/upload/presign` to get a signed PUT URL, then upload the file directly to R2 via `XMLHttpRequest` with `upload.onprogress` for real-time progress. No new dependencies are introduced; no design tokens change.

The UI contract is fully locked in `02-UI-SPEC.md`. All color values, spacing, typography, copy, component structure, accessibility attributes, and animation specs are already decided. The planner's job is to sequence tasks that implement the behavioral wiring against that contract. Research focus is therefore on the XHR upload implementation pattern, iOS Safari file picker requirements, drag-and-drop gotchas in React, and what test coverage is feasible for browser-native upload behavior.

The presign endpoint at `POST /api/upload/presign` accepts `{ filename, contentType }` and returns `{ uploadUrl, fileKey }`. The file bytes must never pass through Vercel (4.5 MB function limit). XHR is mandated over fetch because `XMLHttpRequest.upload.onprogress` provides byte-level progress events; fetch's `ReadableStream` cannot track upload progress in current browsers.

**Primary recommendation:** Extract ShareStory to `app/components/ShareStory.tsx`, implement the XHR upload hook as `app/hooks/useFileUpload.ts`, and build sub-components (UploadZone, ProgressBar, FileListRow, ErrorBanner) as separate files under `app/components/upload/`. This matches the component inventory in the UI-SPEC and keeps test surface clean.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UPLD-01 | User can select a file via tap/click button (iOS-compatible `<input type="file">`) | iOS Safari requires `<input type="file" accept="video/*,audio/*">` to be directly clickable or triggered by a user-gesture event handler on a tappable element; hidden input + `inputRef.current.click()` from a button's onClick works reliably |
| UPLD-02 | User can drag-and-drop a file on desktop | Drag-and-drop via `onDragOver`/`onDrop` on the drop zone div — already prototyped in page.tsx. `e.preventDefault()` on dragOver is required or drop fires navigation. Mobile gets tap-to-browse only (no drag support expected on iOS). |
| UPLD-03 | User sees a progress bar during upload (XHR-based, not fetch) | `XMLHttpRequest` with `xhr.upload.addEventListener('progress', (e) => { if (e.lengthComputable) percent = (e.loaded/e.total)*100 })` — this is the only reliable cross-browser API for upload progress. Fetch cannot do this. |
| UPLD-04 | User sees a clear error message and retry button if upload fails | XHR `onerror` (network failure) + `onload` with `xhr.status >= 400` check. Non-2xx from R2 (including expired presign URL) triggers error state. Retry means re-calling presign + XHR from scratch. |
| UPLD-05 | Upload accepts video and audio files (video/*, audio/*) | `accept="video/*,audio/*"` on the file input. Client-side MIME type check on selected File object before presign call. R2 and the UI-SPEC both use `video/*,audio/*`. Wrong type shows ErrorBanner before upload starts. |
</phase_requirements>

---

## Standard Stack

### Core (no new dependencies — use what exists)
| Library / API | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| React | 19.2.3 | Component state and lifecycle | Already in project |
| TypeScript | ^5 | Type safety | Already in project |
| Next.js App Router | 16.1.6 | Component routing, server/client boundary | Already in project |
| `XMLHttpRequest` (browser native) | — | Upload with progress events | Locked by UPLD-03 — fetch cannot report upload progress |
| `useState` / `useRef` / `useEffect` | React 19 | Upload state machine, file input ref, IntersectionObserver | Already used in page.tsx |
| Tailwind CSS v4 | ^4 | Not used in ShareStory (inline styles only) | Inline styles are the project convention for this component |

### Supporting (testing only)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jest | ^30.3.0 | Unit tests | Test pure logic: presign fetch, MIME validation, state transitions |
| ts-jest | ^29.4.6 | TypeScript transform for jest | Already configured |
| `@testing-library/react` | NOT installed | Component testing | Do NOT add — not in project, not needed for unit-level coverage of upload logic |

**No new runtime dependencies.** The upload pipeline is: browser `XMLHttpRequest` → R2 presigned URL. Everything is native or already installed.

**Installation:** None required.

**Version verification:** All packages verified from `package.json` — no npm registry lookup needed since no new packages are introduced.

---

## Architecture Patterns

### Recommended Project Structure

```
app/
├── components/
│   ├── ShareStory.tsx          # Extracted from page.tsx, orchestrates upload pipeline
│   └── upload/
│       ├── UploadZone.tsx      # Drag-drop + click-to-browse, file type validation
│       ├── ProgressBar.tsx     # XHR progress visualization, ARIA progressbar
│       ├── FileListRow.tsx     # Per-file status: pending / uploading / done / failed
│       └── ErrorBanner.tsx     # File type error + upload failure, role="alert"
├── hooks/
│   └── useFileUpload.ts        # XHR upload state machine, returns { upload, progress, status, error, retry }
└── page.tsx                    # Imports <ShareStory /> — removes inline definition
```

### Pattern 1: XHR Upload State Machine

**What:** A custom hook `useFileUpload` manages the full lifecycle — idle → uploading → complete | error. Exposes `upload(file)`, `progress` (0–100), `status`, `error`, and `retry`.

**When to use:** Any time upload state needs to be shared between ProgressBar, FileListRow, and the submit button's disabled state.

**Example:**
```typescript
// app/hooks/useFileUpload.ts
// Source: project conventions (existing page.tsx patterns) + browser XHR API

type UploadStatus = 'idle' | 'uploading' | 'complete' | 'error';

interface UseFileUploadResult {
  upload: (file: File) => Promise<string | null>; // returns fileKey or null on failure
  progress: number;   // 0–100
  status: UploadStatus;
  error: string | null;
  reset: () => void;
}

export function useFileUpload(): UseFileUploadResult {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setProgress(0); setStatus('idle'); setError(null); };

  const upload = async (file: File): Promise<string | null> => {
    setStatus('uploading');
    setProgress(0);
    setError(null);

    // Step 1: Get presigned URL
    let uploadUrl: string, fileKey: string;
    try {
      const res = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!res.ok) throw new Error('Presign failed');
      ({ uploadUrl, fileKey } = await res.json());
    } catch {
      setStatus('error');
      setError('Upload failed. Check your connection and try again.');
      return null;
    }

    // Step 2: PUT to R2 via XHR (not fetch — needed for upload.onprogress)
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setProgress(100);
          setStatus('complete');
          resolve(fileKey);
        } else {
          setStatus('error');
          setError('Upload failed. Check your connection and try again.');
          resolve(null);
        }
      });
      xhr.addEventListener('error', () => {
        setStatus('error');
        setError('Connection lost. Your file wasn\'t uploaded — try again when you\'re back online.');
        resolve(null);
      });
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  };

  return { upload, progress, status, error, reset };
}
```

### Pattern 2: iOS-Safe File Input

**What:** Hidden `<input type="file">` triggered via `useRef` — the only reliable way to open the file picker on iOS Safari.

**When to use:** Always. Do NOT use `document.getElementById('file-input')?.click()` (the current page.tsx approach). Using a `ref` is the React-idiomatic pattern and avoids SSR `document` access issues.

**Example:**
```typescript
// app/components/upload/UploadZone.tsx
const fileInputRef = useRef<HTMLInputElement>(null);

// Drop zone is the tappable target — must have onClick that calls ref.current.click()
const handleZoneClick = () => fileInputRef.current?.click();

// CRITICAL for iOS Safari: the input must not have display:none replaced by
// visibility:hidden — both work. But the click() must come from a direct user
// gesture (not setTimeout, not async). The onClick handler IS a direct gesture.

<div
  role="button"
  tabIndex={0}
  onClick={handleZoneClick}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleZoneClick(); }}
  // ...styles
>
  <input
    ref={fileInputRef}
    type="file"
    accept="video/*,audio/*"
    style={{ display: 'none' }}
    onChange={(e) => e.target.files && onFilesSelected(Array.from(e.target.files))}
  />
  {/* visual drop zone content */}
</div>
```

**iOS Safari note:** `capture=""` attribute is intentionally omitted. With `capture`, iOS forces the camera app and bypasses the file picker (no access to camera roll or existing files). Without `capture`, the iOS sheet offers camera, photo library, and files — which is the desired behavior.

### Pattern 3: MIME Type Validation Before Upload

**What:** Check `file.type` against allowed MIME prefix before calling presign. Show ErrorBanner immediately, no network request wasted.

**When to use:** `onChange` handler of the file input, before any state is updated with the file.

**Example:**
```typescript
// Pure function — easily unit-tested
export function isAcceptedFileType(file: File): boolean {
  return file.type.startsWith('video/') || file.type.startsWith('audio/');
}
```

**Caveat:** `file.type` is browser-reported and can be empty string for some file types on Android/Windows. If `file.type` is empty string, do not reject — let the server validate. Only reject when `file.type` is explicitly non-video/non-audio.

### Anti-Patterns to Avoid

- **`document.getElementById` in React components:** Breaks SSR, bypasses React's rendering model. Use `useRef` instead. The current `page.tsx` uses `document.getElementById('file-input')?.click()` — this must be replaced with a ref in the extracted component.
- **`fetch` for the R2 PUT:** fetch's body is a ReadableStream with no upload progress events in current browsers. Only `XMLHttpRequest.upload.onprogress` provides byte-level progress during PUT. Using fetch would break UPLD-03.
- **`capture="environment"` or `capture="user"` on the file input:** Forces iOS camera app, removes access to existing files. The UI-SPEC copy says "tap to browse — accepts video and audio files", implying existing files must be accessible.
- **Calling `xhr.click()` from async context:** On iOS Safari, a file input `.click()` called from a Promise callback or `async/await` continuation is not a trusted user gesture and will be silently ignored. The file picker won't open. Keep `fileInputRef.current?.click()` in a synchronous event handler.
- **Silent failure on XHR non-2xx:** R2 returns 403 for expired presign URLs and 400 for content-type mismatches. The `onerror` event does NOT fire for HTTP errors — only `onload` fires. Always check `xhr.status` inside `onload`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Upload progress | Custom polling or timer-based fake progress | `XMLHttpRequest.upload.onprogress` | Native browser API, fires on actual bytes transferred |
| File type validation | Manual extension parsing (`file.name.split('.')`) | `file.type.startsWith('video/')` | MIME type is set by OS, not user-controlled; extension is trivially spoofable |
| Retry logic | Complex exponential backoff | Reset state, re-call presign, re-send XHR | Presign URLs expire in 900s anyway; retry must get a fresh URL |
| Multi-file sequencing | Promise.all for concurrent uploads | Sequential upload per file | R2 supports concurrent PUTs, but a single video is typically 50–500 MB — one at a time is simpler and avoids bandwidth saturation on mobile |

**Key insight:** This phase does not need a library. The complexity surface is: one XHR PUT per file, one progress event listener, two error paths (presign fail, PUT fail). A custom hook of ~60 lines covers it.

---

## Common Pitfalls

### Pitfall 1: iOS Safari Rejects Programmatic `.click()` from Async Context
**What goes wrong:** The file picker silently fails to open after selecting a file or pressing a button, especially on iOS 15+.
**Why it happens:** iOS Safari enforces that `.click()` on file inputs must originate from a synchronous user-gesture event. Any `.click()` called inside a Promise `.then()`, `async/await` continuation, or `setTimeout` is treated as programmatic (not user-initiated) and is blocked.
**How to avoid:** `fileInputRef.current?.click()` must be called directly in the event handler function, not after any `await` or in a callback.
**Warning signs:** Works on desktop Chrome, fails silently on iOS Safari. No error in console.

### Pitfall 2: R2 Returns HTTP 403 (Expired Presign) and XHR Does Not Fire `onerror`
**What goes wrong:** Upload appears to "hang" or fail silently — no error state shown.
**Why it happens:** HTTP-level errors (4xx, 5xx) trigger `xhr.onload`, not `xhr.onerror`. `onerror` only fires for network-level failures (DNS, TCP). A developer testing only `onerror` will miss all HTTP error codes.
**How to avoid:** Always check `xhr.status` inside the `onload` handler. If `xhr.status < 200 || xhr.status >= 300`, treat as failure and show ErrorBanner.
**Warning signs:** Manual test where you let the presigned URL expire (900s) and retry — no error message appears.

### Pitfall 3: `document.getElementById` in SSR Context
**What goes wrong:** `TypeError: Cannot read properties of undefined (reading 'getElementById')` during Next.js build or SSR render.
**Why it happens:** `document` does not exist on the server. The current `page.tsx` uses it inside an event handler (which never runs on server), but when extracted to a proper component this pattern becomes fragile.
**How to avoid:** Replace with `useRef<HTMLInputElement>(null)` and call `ref.current?.click()`.
**Warning signs:** Build succeeds but hydration error appears in browser console.

### Pitfall 4: `accept="video/*,audio/*"` Shows Wrong Files on Some Android Browsers
**What goes wrong:** Some Android Chrome versions show all files despite `accept` attribute, or show a very limited set.
**Why it happens:** The `accept` attribute is a hint to the OS file picker, not a hard filter enforced by the browser. Android's file picker implementation varies by OEM and Android version.
**How to avoid:** Always validate `file.type` on the client side after selection (isAcceptedFileType check) regardless of what the picker showed. Show ErrorBanner for rejected types.
**Warning signs:** User reports uploading a PDF; file arrives in R2 without rejection.

### Pitfall 5: Content-Type Header Mismatch Causes R2 403
**What goes wrong:** R2 returns 403 even with a valid presigned URL.
**Why it happens:** The presign route signs the URL for a specific `ContentType`. If the XHR PUT sends a different `Content-Type` header (or no header), R2 rejects the request because the signature doesn't match.
**How to avoid:** The XHR must set `xhr.setRequestHeader('Content-Type', file.type)` using the same value that was passed to `/api/upload/presign`. The presign route expects `contentType` in the request body — pass `file.type` there.
**Warning signs:** Network tab shows 403 on the PUT; presign call succeeded (200).

### Pitfall 6: Multiple File Uploads and Progress Tracking
**What goes wrong:** Progress bar shows incorrect percentage when multiple files are queued, jumps around, or always shows 100% after first file.
**Why it happens:** A single `progress` number tracks only one XHR instance. If files upload sequentially, progress resets between files. If files upload concurrently, multiple `onprogress` events race to update shared state.
**How to avoid:** For Phase 2, upload files sequentially (one at a time). Track per-file status in FileListRow (pending/uploading/done/failed). The ProgressBar shows progress of the currently uploading file only.
**Warning signs:** User selects 3 files, progress bar shows 100% after file 1, then resets to 0% for file 2.

---

## Code Examples

Verified patterns from existing project source:

### Presign API Contract (from `app/api/upload/presign/route.ts`)
```typescript
// POST /api/upload/presign
// Request:  { filename: string, contentType: string }
// Response: { uploadUrl: string, fileKey: string }
// Expiry:   900 seconds (15 minutes)
// Key format: submissions/YYYY-MM/{nanoid21}-{safeName}

const res = await fetch('/api/upload/presign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ filename: file.name, contentType: file.type }),
});
const { uploadUrl, fileKey } = await res.json();
```

### XHR PUT to R2 with Progress (canonical pattern for UPLD-03)
```typescript
// CORRECT: XHR with upload.onprogress
const xhr = new XMLHttpRequest();

xhr.upload.addEventListener('progress', (e: ProgressEvent) => {
  if (e.lengthComputable) {
    const percent = Math.round((e.loaded / e.total) * 100);
    setProgress(percent);
  }
});

xhr.addEventListener('load', () => {
  // IMPORTANT: onerror does NOT fire for HTTP errors — check status here
  if (xhr.status >= 200 && xhr.status < 300) {
    setStatus('complete');
  } else {
    setStatus('error');
    setError('Upload failed. Check your connection and try again.');
  }
});

xhr.addEventListener('error', () => {
  // Only fires for network-level failures (no DNS, TCP reset, offline)
  setStatus('error');
  setError("Connection lost. Your file wasn't uploaded — try again when you're back online.");
});

xhr.open('PUT', uploadUrl);
xhr.setRequestHeader('Content-Type', file.type); // MUST match what was sent to presign
xhr.send(file); // send the File object directly — browser sets Content-Length
```

### ProgressBar ARIA Requirements (from UI-SPEC)
```tsx
// app/components/upload/ProgressBar.tsx
<div
  role="progressbar"
  aria-valuenow={progress}
  aria-valuemin={0}
  aria-valuemax={100}
  style={{ display: progress === 0 && status !== 'uploading' ? 'none' : 'block' }}
>
  <div style={{ width: `${progress}%`, height: 4, background: '#B91C1C', transition: 'width 0.1s linear' }} />
</div>
```

### ErrorBanner Screen Reader Announcement (from UI-SPEC)
```tsx
// app/components/upload/ErrorBanner.tsx
// role="alert" causes screen readers to announce the message immediately
<div role="alert" style={{ background: '#7F1D1D20', border: '1px solid #B91C1C', padding: '12px 16px' }}>
  <span style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 14, fontWeight: 600, color: '#B91C1C' }}>
    {errorMessage}
  </span>
  {' '}
  <button onClick={onRetry} style={{ color: '#B91C1C', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
    Try again
  </button>
</div>
```

### Extracting ShareStory from page.tsx
```typescript
// page.tsx becomes:
import ShareStory from "@/app/components/ShareStory";

// ... inside MouseLandingPage:
<ShareStory />

// app/components/ShareStory.tsx:
"use client"; // required — uses useState, useRef, useEffect
export default function ShareStory() { ... }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Uppy or Filepond for upload UI | Native XHR — no library | Decided in STATE.md (Phase 1) | No npm dependency, smaller bundle, full control |
| `fetch` for upload | `XMLHttpRequest` with `upload.onprogress` | Browser API evolution | fetch still cannot report upload progress in 2025 browsers |
| Inline component in page.tsx | Extracted to `app/components/ShareStory.tsx` | Phase 2 work | Makes the component testable and maintainable |

**Deprecated/outdated:**
- `document.getElementById` pattern in `page.tsx` ShareStory: works in current prototype but not safe in extracted component — replace with `useRef`.
- Single monolithic `ShareStory` in `page.tsx`: Phase 2 extracts it into separate files per UI-SPEC component inventory.

---

## Open Questions

1. **Multiple file uploads: sequential or parallel?**
   - What we know: UI-SPEC shows per-file status in FileListRow (pending/uploading/done/failed), suggesting sequential upload is the intended behavior
   - What's unclear: The UI-SPEC does not explicitly say "one at a time" vs "parallel"
   - Recommendation: Sequential. Video files are large; parallel uploads on mobile would saturate bandwidth. Sequential keeps progress bar semantics simple (current file's progress). One XHR at a time.

2. **Should Phase 2 call the submit button at all, or is that Phase 3?**
   - What we know: Phase 2 scope is UPLD-01 through UPLD-05 (upload only). Phase 3 adds form fields and metadata submission. The submit button exists in the current prototype.
   - What's unclear: The UI-SPEC says Phase 2 "replaces fake submit with XHR upload pipeline" — this implies the button triggers upload, not a full form submit.
   - Recommendation: Phase 2 submit button triggers upload of selected file(s) only. The confirmation state (fake `setSubmitted`) is preserved as a post-upload UI transition. Phase 3 will replace that transition with the real form submit + metadata write. The button copy stays "SUBMIT YOUR STORY" per UI-SPEC.

3. **What happens if user selects a file, upload succeeds, then presses "back" — is the fileKey preserved?**
   - What we know: Phase 2 has no form persistence. Phase 3 needs the fileKey to write to Airtable.
   - What's unclear: Does Phase 2 need to surface the fileKey for Phase 3, or is that Phase 3's concern?
   - Recommendation: Return fileKey from the upload and store it in ShareStory state (e.g., `const [fileKey, setFileKey] = useState<string | null>(null)`). This makes it available for Phase 3 to wire without re-architecting. This is a 2-line addition with no impact on Phase 2 behavior.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30 + ts-jest 29 |
| Config file | `jest.config.ts` (root) |
| Quick run command | `npx jest --testPathPattern=upload` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UPLD-01 | iOS-compatible file input renders and triggers via ref click | manual-only | — | — |
| UPLD-02 | Drag-and-drop event handlers call handleFiles | unit | `npx jest __tests__/components/upload/UploadZone.test.ts -x` | ❌ Wave 0 |
| UPLD-03 | XHR upload.onprogress updates progress state | unit (jsdom XHR mock) | `npx jest __tests__/hooks/useFileUpload.test.ts -x` | ❌ Wave 0 |
| UPLD-04 | XHR onerror and non-2xx onload set error state | unit | `npx jest __tests__/hooks/useFileUpload.test.ts -x` | ❌ Wave 0 |
| UPLD-05 | isAcceptedFileType rejects non-video/non-audio MIME types | unit | `npx jest __tests__/utils/fileValidation.test.ts -x` | ❌ Wave 0 |

**UPLD-01 is manual-only:** iOS Safari file picker behavior cannot be exercised in jsdom or Node.js test environments. It must be verified by loading the deployed page on a real iOS device and tapping the upload zone.

**UPLD-02, UPLD-03, UPLD-04:** jsdom provides a mock XMLHttpRequest that fires synthetic events. These unit tests mock the XHR and presign fetch to verify state machine transitions, not real network behavior.

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern=upload`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/hooks/useFileUpload.test.ts` — covers UPLD-03, UPLD-04 (XHR state machine: progress updates, error on onerror, error on non-2xx onload)
- [ ] `__tests__/components/upload/UploadZone.test.ts` — covers UPLD-02 (drag events call onFilesSelected)
- [ ] `__tests__/utils/fileValidation.test.ts` — covers UPLD-05 (isAcceptedFileType logic)
- [ ] `jest.config.ts` note: existing config uses `testEnvironment: "node"` — upload component tests need `testEnvironment: "jsdom"` for XHR mock. Use per-file `@jest-environment jsdom` docblock comment rather than changing global config.

---

## Sources

### Primary (HIGH confidence)
- `app/page.tsx` (lines 263–446) — existing ShareStory component — full visual prototype, state, event handlers
- `app/api/upload/presign/route.ts` — exact API contract: accepts `{ filename, contentType }`, returns `{ uploadUrl, fileKey }`, 900s expiry
- `.planning/phases/02-upload-ui/02-UI-SPEC.md` — locked visual and interaction contract
- `jest.config.ts` — existing test infrastructure configuration
- `.planning/STATE.md` — decision log: Uppy deferred, XHR mandated, native approach confirmed
- `package.json` — all installed dependencies verified

### Secondary (MEDIUM confidence)
- Browser XHR API specification: `XMLHttpRequest.upload.onprogress` is the only reliable cross-browser upload progress API; fetch Streams API cannot track upload progress in 2025 browsers (verified from training data, no web search available)
- iOS Safari file input behavior: `capture` attribute omission, programmatic `.click()` must be from synchronous user gesture — patterns confirmed from project conventions and documented browser behavior

### Tertiary (LOW confidence — web search unavailable)
- iOS 18 Safari file picker edge cases: could not verify against release notes (web search offline)
- R2-specific CORS behavior with `Content-Type` mismatch: documented in Phase 1 summary as confirmed working; specific 403 behavior on mismatch is from training data only

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json, no new dependencies
- Architecture: HIGH — based on reading actual source files and UI-SPEC
- XHR upload pattern: HIGH — browser-native API, well-established, confirmed by existing Phase 1 pattern
- iOS Safari pitfalls: MEDIUM — training data; web search was unavailable for 2025 verification
- Test coverage: HIGH — test framework and config already exist; gaps identified from directory scan

**Research date:** 2026-03-17
**Valid until:** 2026-06-17 (stable APIs — XHR, R2 presign, Next.js App Router component extraction patterns)
