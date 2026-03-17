---
phase: 2
slug: upload-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | jest.config.ts |
| **Quick run command** | `npm test -- --testPathPattern="upload"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="upload"`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | UPLD-01 | unit | `npm test -- --testPathPattern="useUpload"` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | UPLD-02 | unit | `npm test -- --testPathPattern="useUpload"` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | UPLD-03 | unit | `npm test -- --testPathPattern="useUpload"` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | UPLD-04 | unit | `npm test -- --testPathPattern="useUpload"` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | UPLD-01 | manual | see Manual-Only | — | ⬜ pending |
| 02-02-02 | 02 | 2 | UPLD-02 | manual | see Manual-Only | — | ⬜ pending |
| 02-02-03 | 02 | 2 | UPLD-05 | unit | `npm test -- --testPathPattern="UploadZone"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/hooks/useUpload.test.ts` — stubs for XHR upload hook (UPLD-01 through UPLD-04)
- [ ] `__tests__/components/UploadZone.test.tsx` — stubs for file type validation (UPLD-05)

*Existing jest infrastructure in place — only test stubs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS Safari file picker opens camera roll and Files | UPLD-01 | JSDOM cannot simulate iOS file picker | On iPhone: tap upload zone → verify both Camera Roll and Files app options appear |
| Desktop drag-and-drop initiates upload | UPLD-02 | JSDOM drag events are unreliable | On desktop: drag video file onto drop zone → verify upload starts |
| Progress bar updates in real time | UPLD-03 | XHR progress events not available in JSDOM | Upload a large file → verify progress bar increments visibly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
