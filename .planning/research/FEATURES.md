# Feature Research

**Domain:** Media submission / user-generated content collection (documentary story gathering)
**Researched:** 2026-03-16
**Confidence:** HIGH for upload UX patterns; MEDIUM for domain-specific form field conventions

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| File picker (button + drag-drop) | Standard upload affordance since ~2015; mobile users expect button tap, desktop users expect drag-drop — both are needed | LOW | Drag-drop alone fails older users; button alone wastes desktop UX. Dual-mode is the minimum. |
| Upload progress indicator | Without it, users assume the page is frozen and hit back or reload — killing the upload | LOW–MEDIUM | A percentage bar or animated indicator; accuracy less important than reassurance. Required for any file >5MB. |
| Error message on failure | Users need to know if something went wrong; silent failure is the worst outcome | LOW | At minimum: "Upload failed. Please try again." with a retry button. |
| Name field | Every story needs attribution; the filmmaker needs to know who submitted | LOW | Required field. First + last or full name. |
| Connection to subject field | This is a documentary about a specific person — the filmmaker needs to know the relationship | LOW | Free-text or dropdown: former wrestler, student, colleague, community member, family. |
| Story context / caption field | Media without context is less useful; even a sentence helps the filmmaker | LOW | Textarea, optional. "What's your story about?" |
| Text-only submission path | Some users cannot or will not record — excluding them cuts real contributions | LOW–MEDIUM | Must work as an alternative to file upload, not an afterthought. |
| Success confirmation | Without confirmation, users re-submit or wonder if anything happened — especially a problem for older users | LOW | Full-page or large in-page confirmation. "Thank you — your story was received." |
| Mobile-compatible file picker | Most submitters will be on phones; camera roll and voice memo access are critical | LOW–MEDIUM | `accept="video/*,audio/*"` on file input; test on iOS Safari specifically. |
| Basic file type validation (client-side) | Prevents users from uploading .docx or .zip files that are useless to the filmmaker | LOW | Client-side check before upload begins. Show human-readable error: "Please upload a video or audio file." |

### Differentiators (Competitive Advantage)

Features that set this apart. Not required, but meaningfully improve submission rates or filmmaker workflow.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Chunked / resumable upload (TUS protocol) | Phone uploads on unreliable connections fail without it; 100MB+ files are risky without chunking | MEDIUM | TUS is the open standard; Uppy implements it client-side. Cloudflare Stream and Supabase Storage both support TUS server-side. Critical for the large-file use case. |
| Retry on failure with user feedback | "Connection lost — retrying in 5 seconds…" removes panic; users stay on the page | MEDIUM | Requires TUS or manual retry logic. Exponential backoff with visible countdown. |
| File size warning before upload begins | Phone users don't know their video is 800MB; a pre-upload warning prevents abandoned uploads | LOW | Check `file.size` before starting; show "This is a large file — uploads may take a few minutes on mobile." |
| Contact info field (optional) | Filmmaker may want to follow up with a promising subject; no contact = no interview | LOW | Email or phone, clearly optional. Frame as "So we can reach you if we'd like to learn more." |
| Character counter on text field | Helps users calibrate how much to write | LOW | CSS + JS counter. Small quality-of-life improvement. |
| Personalized thank-you message | "Thanks, [Name] — your story about Coach Mouse matters to this film." builds emotional connection | LOW | Requires storing the submitted name client-side and displaying it on the confirmation screen. |
| File preview before submission | Lets users verify they picked the right file before uploading | LOW–MEDIUM | Video thumbnail or audio waveform. Reduces wrong-file submissions. |
| Multi-file upload | Some users may have both a video AND a text note | MEDIUM | Uppy supports this natively. Question is whether it complicates the UX for older users. Defer unless explicitly requested. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems — deliberately excluded.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Email confirmation to submitter | Feels like good UX; confirms receipt | Requires email infrastructure (SMTP, transactional email service), adds backend complexity, introduces delivery failure modes, and creates GDPR/spam surface area — all for a form that's collecting stories, not managing accounts | Strong in-page confirmation message handles user anxiety. Optionally log submission server-side with timestamp. |
| Admin dashboard / submissions inbox | Filmmaker wants to browse what came in | Significant build complexity; requires auth, pagination, storage integration, and ongoing maintenance | Chris accesses files directly through the storage provider's UI (Cloudflare R2, Backblaze B2 all have file browsers). Zero build cost. |
| File preview / playback in browser | Seems like a good review tool | Adds significant complexity, requires video streaming or presigned URL generation, and is not needed for story collection — files are for research, not display | Download from storage UI. |
| Real-time transcription | Would be useful for searchability | Far outside scope; requires ML pipeline or third-party service (Whisper, Deepgram) | Raw files for now. Transcription is a post-collection workflow decision. |
| User accounts / login | Would allow "save my submission" | Removes the frictionless anonymous contribution model; older users will not create accounts for a one-time submission | Anonymous submissions only. Name + contact is sufficient attribution. |
| Duplicate submission detection | Prevents accidental re-submits | Requires deduplication logic (hash comparison), complicates backend, and false positives are worse than duplicates | Let duplicates happen; Chris can identify them manually when reviewing. |
| Client-side video compression | Reduce upload size before sending | MediaRecorder/WebCodecs API is inconsistently supported on older iOS/Android versions; compression failures are invisible to users | Accept raw files; storage is cheap. |
| Email capture for marketing | Filmmaker might want to follow up | Crosses a trust boundary — people are sharing personal stories, not signing up for a list | Keep contact info optional and framed explicitly as filmmaker follow-up only. |

## Feature Dependencies

```
[File upload input]
    └──requires──> [Progress indicator]
                       └──requires──> [Error + retry handling]

[TUS / chunked upload]
    └──requires──> [Server-side TUS endpoint or TUS-compatible storage]
    └──enhances──> [Progress indicator] (byte-level accuracy)
    └──enhances──> [Retry on failure]

[Text submission]
    └──requires──> [Story context textarea] (shared component)

[Success confirmation]
    └──enhanced by──> [Name field] (personalized message)

[Contact info field]
    └──optional, standalone]

[File type validation]
    └──precedes──> [File upload input] (client-side gate)

[File size warning]
    └──precedes──> [File upload input] (pre-upload gate)
```

### Dependency Notes

- **Progress indicator requires upload to be asynchronous:** Synchronous form POST gives no progress signal. The upload must be handled via XHR, fetch with streaming, or a library like Uppy that exposes progress events.
- **TUS requires server-side support:** You cannot use TUS with a plain presigned URL to S3/R2. The storage provider or a TUS server (Tusd, Uppy Companion) must handle it. Cloudflare Stream has native TUS support; R2 does not — this affects the storage decision.
- **Text submission and file upload share the same form:** They are alternatives, not separate flows. The backend must handle "file upload with optional text" and "text only with no file" as valid submission variants.
- **Success confirmation depends on upload completing:** The confirmation must only trigger after server acknowledgment, not after the client sends the request.

## MVP Definition

### Launch With (v1)

Minimum viable product — what is needed to receive the first story submissions.

- [ ] File picker (button + drag-drop, dual-mode) — primary submission mechanism
- [ ] Upload progress bar — without this, phone users abandon during slow uploads
- [ ] Error message + retry button on failure — silent failure is unacceptable
- [ ] Name field (required) — filmmaker cannot use an anonymous story without attribution
- [ ] Connection to Coach McCollum (required) — context for who the submitter is
- [ ] Story context textarea (optional) — short caption; helps filmmaker evaluate submissions
- [ ] Text-only path — alternative for users who cannot or will not record
- [ ] Contact info field (optional) — critical for filmmaker follow-up with interview subjects
- [ ] Client-side file type validation — prevent garbage uploads before they start
- [ ] File size warning — manage expectations on mobile before upload begins
- [ ] Success confirmation page/screen — must be visible and warm; older users need clear feedback

### Add After Validation (v1.x)

Features to add once the core upload flow is confirmed working in production.

- [ ] Chunked / resumable upload (TUS) — add when large-file failure rate becomes observable; required before promoting desktop upload to heavy users
- [ ] Retry with countdown feedback — add alongside TUS implementation
- [ ] Personalized thank-you message — low effort, meaningful; add after first batch of submissions confirms the form is working

### Future Consideration (v2+)

Features to defer until there is a reason to build them.

- [ ] Multi-file upload — only if submitters consistently ask "can I send more than one?"
- [ ] File preview before submission — only if wrong-file submissions become a problem
- [ ] Email notification to filmmaker — only if Chris stops checking the storage UI regularly
- [ ] Any admin UI — only if file volume exceeds what the storage provider UI can handle

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| File picker (button + drag-drop) | HIGH | LOW | P1 |
| Upload progress indicator | HIGH | LOW | P1 |
| Error + retry on failure | HIGH | LOW–MEDIUM | P1 |
| Name field | HIGH | LOW | P1 |
| Connection field | HIGH | LOW | P1 |
| Text-only submission path | HIGH | LOW | P1 |
| Success confirmation | HIGH | LOW | P1 |
| File type validation (client) | MEDIUM | LOW | P1 |
| File size warning | MEDIUM | LOW | P1 |
| Contact info field (optional) | HIGH | LOW | P1 |
| Story context textarea | MEDIUM | LOW | P1 |
| Chunked / TUS upload | HIGH | MEDIUM | P2 |
| Retry with countdown | MEDIUM | MEDIUM | P2 |
| Personalized thank-you | MEDIUM | LOW | P2 |
| File preview before submit | LOW | MEDIUM | P3 |
| Multi-file upload | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

Direct competitors are not commercially relevant here — the analogues are community story-collection tools, oral history platforms, and journalism tipline forms.

| Feature | Oral History Association (form-based) | Google Forms + Drive (DIY) | Our Approach |
|---------|--------------------------------------|---------------------------|--------------|
| File upload | Not supported | Limited (15GB Drive quota, no large video) | Direct to cloud storage (R2/B2/S3), no quota issue |
| Progress indicator | None | None | Explicit progress bar |
| Text alternative | Yes (textarea) | Yes | Yes, first-class alternative |
| Mobile UX | Poor | Acceptable | Designed first for phone camera roll |
| Confirmation | Generic | Generic | Warm, personal, mission-connected |
| Admin access | N/A | Shared Drive folder | Direct storage provider UI |
| Large file support | No | No | Yes (100MB–500MB+) |

## Mobile-Specific Considerations

The PROJECT.md identifies submitters as "primarily older alumni — phone-first, not tech-savvy." This drives several UX requirements:

- **Button must be large and labeled in plain language.** "Choose a video or audio file" not "Upload media."
- **No drag-and-drop only.** iOS users cannot drag from the Files app to a browser drop zone reliably. The tap-to-pick button is the primary path on mobile.
- **`accept` attribute must be set correctly.** `accept="video/*,audio/*"` on the file input triggers the correct system picker on iOS (camera roll + voice memos) and Android.
- **Progress must be visible without scrolling.** If the progress bar is below the fold on a small screen, users will not see it and will assume nothing is happening.
- **Upload can take minutes on cellular.** The confirmation screen must not auto-redirect or time out. It must stay stable.
- **Error messages must be in plain language.** "413 Payload Too Large" means nothing. "Your file is too large for this form — please try a shorter recording" is actionable.
- **Do not require email to submit.** Older users frequently abandon forms that require email. Keep email optional and framed as filmmaker follow-up.

## Sources

- [10 File Upload System Features Every Developer Should Know in 2025](https://www.portotheme.com/10-file-upload-system-features-every-developer-should-know-in-2025/)
- [Optimizing online file uploads with chunking and parallel uploads | Transloadit](https://transloadit.com/devtips/optimizing-online-file-uploads-with-chunking-and-parallel-uploads/)
- [tus - resumable file uploads](https://tus.io/)
- [Next.js | Uppy](https://uppy.io/docs/nextjs/)
- [UX best practices for designing a file uploader | Uploadcare](https://uploadcare.com/blog/file-uploader-ux-best-practices/)
- [File Upload UI for Non-Technical Users | Filestack](https://blog.filestack.com/file-upload-ui-for-non-technical-users/)
- [Success Message UX Examples and Best Practices - Pencil and Paper](https://www.pencilandpaper.io/articles/success-ux)
- [Guide For User-Generated Content Workflow - MASV](https://massive.io/workflow/user-generated-content-workflow/)
- [UX for Elderly Users: How to Design Patient-Friendly Interfaces | Cadabra Studio](https://cadabra.studio/blog/ux-for-elderly/)
- [Designing Mobile-Friendly Forms: A UI/UX Guide | Medium](https://medium.com/@Alekseidesign/designing-mobile-friendly-forms-a-ui-ux-guide-483fe477f3f3)
- [UploadThing: A Modern File Upload Solution for Next.js Applications | CodeParrot](https://codeparrot.ai/blogs/uploadthing-a-modern-file-upload-solution-for-nextjs-applications)
- [Resumable Large File Uploads With Tus | Buildo](https://www.buildo.com/blog-posts/resumable-large-file-uploads-with-tus)

---
*Feature research for: Media submission / story collection web app (documentary)*
*Researched: 2026-03-16*
