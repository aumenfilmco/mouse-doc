# MOUSE — 50 Years on the Mat

## What This Is

A documentary landing page and story-collection web app for *MOUSE*, a feature-length film honoring Coach Dave "Mouse" McCollum — the winningest wrestling coach in District 3 history. The site lets former wrestlers, students, colleagues, and community members submit video, audio, or written stories to be considered as research material for the film. Built by Aumen Film Co.

## Core Value

Former wrestlers and community members can easily submit their stories (video, audio, or text) from any device — and those files land somewhere Chris can actually access them.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can upload video or audio files via drag-and-drop or file browser
- [ ] Uploaded files are stored in cost-effective cloud storage and accessible to Chris
- [ ] User can optionally type their story as text instead of (or in addition to) uploading a file
- [ ] User submits their name and connection to Coach McCollum alongside their story
- [ ] Upload works on mobile (phone camera roll / voice memo) and desktop
- [ ] Large files (100MB+) are supported for desktop uploads
- [ ] User sees a success confirmation after submission

### Out of Scope

- User accounts / authentication — anonymous submissions only, no login required
- Admin dashboard — Chris accesses files directly from storage provider UI
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
| Storage provider | Need to evaluate R2, B2, S3 on price + DX | — Pending (research phase) |
| Text input alongside upload | Users who can't/won't record can still contribute | — Pending |

---
*Last updated: 2026-03-16 after initialization*
