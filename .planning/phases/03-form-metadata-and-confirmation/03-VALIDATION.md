---
phase: 3
slug: form-metadata-and-confirmation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | jest.config.ts |
| **Quick run command** | `npm test -- --testPathPattern="submit\|airtable\|form"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~12 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="submit\|airtable\|form"`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | META-01, META-02 | unit | `npm test -- --testPathPattern="airtable"` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | FORM-01, FORM-02, FORM-03, FORM-04 | unit | `npm test -- --testPathPattern="validateSubmission"` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | FORM-05, FORM-06, CONF-01, CONF-02 | build | `npx next build 2>&1 \| tail -10` | — | ⬜ pending |
| 03-02-02 | 02 | 2 | FORM-01, META-01, CONF-01 | build+test | `npx next build 2>&1 \| tail -5 && npm test` | — | ⬜ pending |
| 03-03-01 | 03 | 3 | all | manual | see Manual-Only | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/api/submit.test.ts` — stubs for Airtable route handler (META-01, META-02)
- [ ] `__tests__/utils/validateSubmission.test.ts` — stubs for form validation logic (FORM-01 through FORM-04)

*Existing jest + jsdom infrastructure in place — only test stubs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| File submission creates Airtable record with all fields | META-01 | Requires real Airtable credentials and network | Submit form with file → open Airtable base → verify record appears with name, connection, fileKey, timestamp |
| Text-only submission creates Airtable record | META-02 | Requires real Airtable and no-file path | Submit with text story only → verify Airtable record contains story text, no fileKey |
| Confirmation screen shows submitter's name | CONF-01 | UI rendering — not worth mocking | Submit as "Jane" → verify "Thank you, Jane." appears |
| Submitting without file or story is blocked | FORM-05 | Requires real browser interaction | Leave both file and text story empty → click submit → verify blocked with error message |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
