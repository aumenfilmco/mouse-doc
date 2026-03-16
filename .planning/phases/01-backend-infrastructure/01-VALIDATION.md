---
phase: 1
slug: backend-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x (to be installed in Wave 0) |
| **Config file** | `jest.config.ts` — Wave 0 installs |
| **Quick run command** | `npm test -- --testPathPattern=api/upload` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern=api/upload`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | — | setup | `npm test` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | INFRA-01 | manual | CORS smoke test via curl | n/a | ⬜ pending |
| 1-01-03 | 01 | 1 | INFRA-02, INFRA-03 | unit | `npm test -- --testPathPattern=presign` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | INFRA-04 | manual | Direct bucket URL returns 403 | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `jest.config.ts` — configure Jest for Next.js App Router (jest-environment-node, transform via ts-jest or babel-jest)
- [ ] `__tests__/api/upload/presign.test.ts` — stubs for INFRA-02, INFRA-03: mock S3Client, verify UUID key format, verify no secrets in response

*Framework: Jest not currently installed — Wave 0 installs jest, @types/jest, ts-jest.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser PUT to R2 returns 200 with no CORS errors | INFRA-01 | Requires real network request to live R2 bucket | Open DevTools → Network tab → run smoke test script → verify status 200, no CORS errors in console |
| R2 bucket rejects direct public access | INFRA-04 | Requires live bucket URL test | curl the R2 bucket base URL directly (without presigned params) → expect 403 or 404 |
| R2 credentials absent from client JS bundle | INFRA-02 | Bundle analysis required | Run `npm run build` → search `.next/static/` for CLOUDFLARE, R2_ACCESS, R2_SECRET strings → must return empty |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
