# Handoff — List & Funnel Infrastructure

**Date:** 2026-04-22
**Scope:** Out-of-milestone inline work building the email list + submission pipeline that sits on top of the v1.0 landing page. Not tracked under a GSD phase.

---

## What shipped

| Commit | What |
|--------|------|
| `d19fe72` | `public/chris-signature.png` asset for email signoff |
| `335bbd7` | `.gitignore` rules for `.mcp.json`, `.claude/`, `/skills/` |
| `14e348f` | `/api/formly-webhook` — upserts Formly submissions into Brevo |
| `0f15409` | Webhook v2 — maps `ARCHIVAL` and `INTERVIEW_INTEREST` fields |
| `a083800` | Landing page copy reframed for non-wrestlers (form section + hero CTA) |
| `17b4316` | Microsoft Clarity tracking tag (project `wft89h3mlr`) |

All live on production (`https://www.coachmouse.com`).

---

## Email list infrastructure

### Brevo

- **List ID:** `5` — name `MOUSE — Documentary Updates`
- **Sender:** `Chris Aumen · Aumen Film Co <chris@aumenfilm.co>` (verified)
- **Plan:** Free tier, 300 sends/day, unlimited contacts
- **First campaign sent:** campaign id `8`, 33 recipients, 2026-04-22 13:41 ET

### Custom attributes on MOUSE contacts

| Attribute | Type | Source |
|-----------|------|--------|
| `FIRSTNAME`, `LASTNAME` | text | standard Brevo |
| `SMS` | text | Brevo built-in (phone, E.164 normalized) |
| `SOURCE` | text | always `formly-coachmouse-form` from webhook |
| `RELATION` | text | Formly "Which best describes you?" |
| `CITY` | text | Formly "Current City, State" |
| `AGE` | float | Formly "Age" |
| `GRAD_YEAR` | float | Formly "What year did you graduate High School?" |
| `STORY_TEXT` | text | Formly "Do you have a story to share?" |
| `ARCHIVAL` | text | Formly "Do you have archival footage to share?" |
| `INTERVIEW_INTEREST` | text | Formly "Want to be considered for an interview?" (`Yes`/`No`) |

Segment on `INTERVIEW_INTEREST = Yes` to pull interview candidates. Segment on `ARCHIVAL != ""` to find people with footage worth chasing.

---

## Submission pipeline

```
Formly form (https://aumen.co/coachmouse-form)
    │
    ├─► Google Sheet (Formly's native integration)
    │
    └─► POST https://www.coachmouse.com/api/formly-webhook?secret=...
            │
            ▼
        Next.js route (app/api/formly-webhook/route.ts)
            • Validates FORMLY_WEBHOOK_SECRET
            • Extracts fields across multiple payload shapes
            • Upserts contact into Brevo list 5
```

### Webhook

- **Endpoint:** `https://www.coachmouse.com/api/formly-webhook`
- **Auth:** shared secret via `x-webhook-secret` header or `?secret=` query
- **Field extraction:** handles flat object, nested `{data|submission|payload|response|formResponse}`, and answer arrays (Typeform-style). Deduplicates via Brevo `updateEnabled: true`.
- **Smoke-tested:** returns 200 with all fields mapped correctly (verified against live Formly submission from Chris, see `chris@aumenfilm.co` contact attributes).

### Formly form current shape (2026-04-22)

Question order matches the webhook's expected labels:

1. First Name
2. Last Name
3. Email Address
4. Which best describes you? *(relation)*
5. Want to be considered for an interview? *(Yes/No gate)*
6. Age ← hidden if Q5 = No
7. Current City, State ← hidden if Q5 = No
8. Phone Number ← hidden if Q5 = No
9. What year did you graduate High School? ← shown only for wrestlers/alumni AND Q5 = Yes
10. Do you have a story to share? Type it here. ← hidden if Q5 = No
11. Do you have archival footage to share? ← hidden if Q5 = No

The display logic in Formly creates a natural two-step gate: anyone can join the list with just name + email + relation + Yes/No; only those who opt in see the richer fields.

---

## Vercel

- **Project:** `prj_zx7houq4conviFG58R6NTStsWxEO` (team `chris-projects-d333f9de`)
- **Production env vars (required for webhook):**
  - `BREVO_API_KEY` — Brevo REST API key (see `reference_brevo.md`)
  - `FORMLY_WEBHOOK_SECRET` — long random string, shared with Formly's webhook config
  - Also still in use from v1.0: `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

Env vars must exist before a redeploy for runtime access. If either Brevo key or webhook secret changes, update Vercel env *and* redeploy.

---

## Analytics stack

| Tool | Installed | Purpose |
|------|-----------|---------|
| Meta Pixel | `436850605424202` | FB/IG ad audience building |
| LinkedIn Insight Tag | `9978313` | LinkedIn audience building |
| Microsoft Clarity | `wft89h3mlr` | Heatmaps, scroll depth, session recordings |

All three wired in `app/layout.tsx` as `<Script strategy="afterInteractive">`. Clarity is the one to open when asking behavioral questions about the landing page (bounce, scroll-to-form, dead clicks).

---

## Email templates

- **Blast campaign** HTML lives only in Brevo (campaign id `8`); the working copy used to generate it is at `/tmp/mouse-email.html` which is ephemeral. If re-using the design, pull HTML out of Brevo via `/v3/emailCampaigns/8`.
- **Formly auto-response** edited in Formly directly (not in this repo). Latest copy matches the "share the teaser first, then next steps, then spread the word" flow aligned with the blast.

---

## Decisions consciously made

- **Did not build a native email-only widget** on `coachmouse.com`. The embedded Formly form already captures name + email in its first three fields, so a parallel widget would double the data pipeline for a marginal UX win. Revisit only if Clarity data shows landers bouncing before reaching the form section.
- **Dropped the R2 upload UX for archival material**. Too few usable submissions expected, and we prefer curating via follow-up. Formly now collects a short text description of what someone has; Chris reaches out individually to vet and ingest. The R2 upload code from v1.0 still exists and still works — it's just no longer the primary archival path.
- **Secret in webhook URL**, not HMAC. Shared-secret-in-URL is sufficient at this scale; upgrading to HMAC signature verification is future work only if Formly starts logging full URLs publicly or the audience scales 100x.
- **Update videos made public** on YouTube. Search footprint + algorithm signal outweigh the "intimate list-only" feel for this audience. Anything sensitive (sponsor conversations, talent shortlists) stays in email.

---

## Open follow-ups (not blocking)

1. **Copy test with Clarity data** — after ~1 week of traffic, look at scroll depth distribution on `/`. If mobile users are bouncing before the form section, tighten the "One man. One mat. Five decades." block or move the form higher.
2. **Clarity masking** — if Formly iframe recordings feel invasive, add `data-clarity-mask="true"` to the wrapper.
3. **Sponsor pitch deck / outreach** — next major piece of work, not yet scoped. Sponsorship section on the site (`#sponsor`) exists but is generic.
4. **Second blast timing** — next list email should land after Chris has 2-3 sponsor conversations to report on, or after visible teaser-share momentum (views per platform). No cadence locked yet.
5. **Native email-only widget** *(conditional)* — only if Clarity shows meaningful drop-off before the form. See "Decisions consciously made."

---

## For future Claude sessions

- Authoritative source on live state: this repo's `main` branch + Brevo list 5.
- Secrets: `.mcp.json` (local, gitignored) has Brevo MCP config. Raw REST key in `reference_brevo.md` (user memory).
- To restart the Brevo MCP, open a new Claude session in this project — `.mcp.json` auto-loads.
- If Formly payload shape ever changes and webhook stops extracting fields cleanly: Vercel dashboard → Logs → filter `/api/formly-webhook` → look for `[formly-webhook] raw payload:` line, then update the label matchers in `app/api/formly-webhook/route.ts`.
