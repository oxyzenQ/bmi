# 🌌 BMI Stellar — Post-Release Stabilization Roadmap

> v15.0 completed a foundation reset (encryption layer, storage overhaul, i18n, responsive rewrite).
> This roadmap shifts focus from feature expansion to engineering quality.

---

## Phase 1: Stabilization Arc (v15.x)

### v15.1 — UI Stabilization
- [x] Global `box-sizing: border-box` reset
- [x] Modal spacing consistency audit
- [x] Floating window padding audit (EncryptionModal, FeedbackModal, etc.)
- [x] Responsive overflow fixes on edge-case viewports
- [x] Mobile edge-case fixes (small phones, iOS Safari)

### v15.2 — Observability
- [x] Replace silent `catch {}` with `warnDev()` utility (30+ instances)
- [x] Create `warnDev()` logger utility (dev-only, stripped in production)
- [x] Crypto/storage error visibility — every failure path logs context
- [x] Dev-only diagnostics panel or console helpers

### v15.3 — Regression Fortress
- [x] Add regression test for every bug fixed in v15.1–v15.2
- [x] CI hardening (pin Bun version, stabilize Vitest env)
- [x] Verify all export/import edge cases have test coverage
- [x] Lock dependency versions that affect behavior

---

## Phase 2: Reliability (v16.0) — Major Version

Architecture-level release, not a feature release.

- [x] Argon2id parameter review (memory, iterations, parallelism)
- [x] Encryption failure handling audit (AES-GCM auth tag mismatch paths)
- [x] Export/import integrity audit (HMAC, signature verification edge cases)
- [x] Storage corruption recovery paths
- [x] Migration rollback safety
- [x] Remove remaining silent failures in critical paths

---

## Phase 3: UX Consistency (v17.0)

- [x] Design language consistency pass (spacing, typography, colors)
- [x] Animation timing harmonization
- [x] Spacing system enforcement via design tokens
- [x] Modal/floating window visual consistency
- [x] i18n visual polish (text overflow, CJK compact layout)
- [x] Responsive audit: ultrawide, tablet, small phones

---

## Phase 4: Maintainability (v18.0)

- [ ] Split `responsive.css` (1905 lines) into focused modules
- [ ] CSS deduplication and dead code elimination
- [ ] Reusable modal system (extract common pattern)
- [ ] Design token enforcement (no magic values)
- [ ] Bundle optimization & code splitting audit
- [ ] Internal utility cleanup

---

## Phase 5: Next-Generation Features (v20.0+)

*Only after v15–v18 foundation hardening is complete.*

- Encrypted sync
- Cloud backup
- Account system
- Health analytics
- Wearable integration

---

## Version Strategy

| Version     | Purpose                       | Status |
| ----------- | ----------------------------- | ------ |
| v15.0       | Foundation reset              | ✅ Done |
| v15.1       | UI Stabilization              | ✅ Done |
| v15.2       | Observability                 | ✅ Done |
| v15.3       | Regression Fortress           | ✅ Done |
| v16.0       | Reliability hardening         | ✅ Done |
| v17.0       | UX consistency                | ✅ Done |
| v18.0       | Performance & maintainability | 🔲     |
| v20.0       | Next-generation features      | 🔲     |

---

**Rule: No major new features until v18.0 is complete.**
