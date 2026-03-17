# MOUSE — 50 Years on the Mat

## What This Is

A documentary landing page and story-collection web app for *MOUSE*, a feature-length film honoring Coach Dave "Mouse" McCollum — the winningest wrestling coach in District 3 history. The site lets former wrestlers, students, colleagues, and community members submit video, audio, or written stories to be considered as research material for the film. Built by Aumen Film Co.

## Core Value

Former wrestlers and community members can easily submit their stories (video, audio, or text) from any device — and those files land somewhere Chris can actually access them.

## Requirements

### Validated

- ✓ User can upload video or audio files via drag-and-drop or file browser — Phase 2
- ✓ Uploaded files are stored in cost-effective cloud storage and accessible to Chris — Phase 1 (Cloudflare R2) + NAS sync
- ✓ User can optionally type their story as text instead of (or in addition to) uploading a file — Phase 3
- ✓ User submits their name and connection to Coach McCollum alongside their story — Phase 3
- ✓ Upload works on mobile (phone camera roll / voice memo) and desktop — Phase 2
- ✓ User sees a success confirmation after submission — Phase 3

### Active

- [ ] Large files (100MB+) are supported for desktop uploads (untested — R2 supports up to 5GB via presigned PUT, but not verified with real large files)

### Out of Scope

- User accounts / authentication — anonymous submissions only, no login required
- Admin dashboard — Chris accesses files directly from Airtable + NAS sync
- Video playback / preview in-browser — files are for research, not display
- Real-time transcription or processing — raw files only

## Context

- **Existing UI**: Landing page is fully built (Next.js 16 + React 19, TypeScript). The `ShareStory` component has the drag-and-drop UI but no backend — `handleSubmit` is a no-op.
- **Deployment**: Likely Vercel (existing `vercel.json` in related projects).
- **Storage decision pending**: Chris wants to research cost-effective options (Cloudflare R2, Backblaze B2, AWS S3, etc.) before committing.
- **Submitters**: Primarily older alumni — phone-first, not tech-savvy. UX must be simple.
- **File sizes**: Phone videos ~50–200MB, desktop recordings potentially 500MB+.

## Constraints

- **Budget**: Storage cost should be minimal — this is a community documentary, not a funded production platform.
- **Accessibility**: Easy for Chris to retrieve submitted files without a custom admin tool.
- **Stack**: Next.js 16 + React 19 — must stay in this ecosystem.
- **Timeline**: No hard deadline, but want to start collecting stories soon.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Storage provider | Need to evaluate R2, B2, S3 on price + DX | Cloudflare R2 — zero egress fees, ~$0.23/month estimated, S3-compatible |
| Text input alongside upload | Users who can't/won't record can still contribute | Shipped — textarea + text-only submission path both live |
| Metadata store | Chris browses submissions without a custom admin UI | Airtable — all submissions write Name, Connection, Email, Phone, StoryText, FileKey, SubmittedAt |
| File delivery to Chris | Files in R2 need to reach Chris without manual downloads | Hourly rclone sync to QNAP NAS at `Aumen Film Co/2026/Mouse Documentary/00_Preproduction` |
| Presigned URL architecture | File bytes must never touch Vercel functions (4.5MB limit) | Browser PUTs directly to R2 via presigned URL — Vercel only issues the URL |

---
*Last updated: 2026-03-17 after Phase 3 — v1.0 milestone complete*
