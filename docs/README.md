<!--
  SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
  SPDX-License-Identifier: AGPL-3.0-only OR Commercial
-->

# BMI Stellar Documentation Index

The docs map. The source files are the truth; these documents describe
them. Every living document may go stale - cross-check against the tree
before relying on a specific number, path, or symbol name.

## Governance and discipline (repository root)

| Document                                            | Purpose                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| [README.md](../README.md)                           | The project front page: demo, quick start, scripts, versioning, packaging note |
| [RULES.md](../RULES.md)                             | Engineering rules: the three-tier LOC law and the scripts/ layout contract     |
| [BRANDING.md](../BRANDING.md)                       | Brand identity, name-usage law, logo, palette, typography, tone                |
| [DORMANT.md](../DORMANT.md)                         | The wake-up checklist for a quiet period of 1-5 years                          |
| [SECURITY.md](../SECURITY.md)                       | Security policy and the hardening ledger (CSP, crypto, storage)                |
| [TRADEMARK.md](../TRADEMARK.md)                     | Trademark policy: the Marks are not covered by the AGPL                        |
| [COMMERCIAL_LICENSE.md](../COMMERCIAL_LICENSE.md)   | The dual-license commercial terms                                              |
| [AI_AGENTS_READ_THIS.md](../AI_AGENTS_READ_THIS.md) | The AI agent contract: what to refuse, what stays welcome                      |
| [LICENSE](../LICENSE)                               | AGPL-3.0-only, the full text                                                   |
| [CHANGELOG.md](../CHANGELOG.md)                     | The release ledger (Keep a Changelog), fed by scripts/dev/version-to.sh        |

## Long-form documents (this directory)

| Document                                             | Purpose                                                                                                                                 |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [INNOVATIONS.md](INNOVATIONS.md)                     | The innovation ledger: every implemented mechanism in dependency order                                                                  |
| [AXP1-ZnQ.md](AXP1-ZnQ.md)                           | The AXP1-ZnQ (Architect's eXecution Protocol 1) contract: the repos-for-ci address catalog, the failover resolver, the Sunday refresher |
| [furthermore.md](furthermore.md)                     | The full architectural context behind the releases                                                                                      |
| [AUDIT-2026-08.md](AUDIT-2026-08.md)                 | Frozen audit record, August 2026                                                                                                        |
| [AUDIT-2026-11.md](AUDIT-2026-11.md)                 | Frozen audit record, November 2026 (exacting honesty pass)                                                                              |
| [AUDIT-PRIVACY-2026-11.md](AUDIT-PRIVACY-2026-11.md) | Frozen privacy audit record, November 2026                                                                                              |
| [AUDIT-INFRA-2026-11.md](AUDIT-INFRA-2026-11.md)     | The infra audit: the zelynic discipline sync (night-improve-1..8)                                                                       |
| [AUDIT-LTS-2026-11.md](AUDIT-LTS-2026-11.md)         | Frozen LTS readiness audit, end-to-end real usage, November 2026                                                                        |
| [AUDIT-D3-2026-11.md](AUDIT-D3-2026-11.md)           | The D3 publisher binding + release channel audit (night-netrunner-Z1)                                                                   |
| [AUDIT-ARC-2026-11.md](AUDIT-ARC-2026-11.md)         | Architecture depth audit: smoothbore hot paths, determinism, safety (night-arc-gems-1)                                                  |
| [responsive-audit-375.md](responsive-audit-375.md)   | Frozen responsive depth audit at the 375 x 667 floor, 2026-11-04                                                                        |
| [assets/](../assets/)                                | The brand master plate at the repository root, signed via `signature.b3sum`                                                             |

## The gates (scripts/)

| Gate                                       | What it enforces                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `scripts/gates/check-loc.ts`               | 1000 hard cap + the 600-line ratchet                                                                |
| `scripts/gates/check-scripts-loc.sh`       | 1000 cap for scripts/** with the `# LOC_EXEMPT:` IOU                                                |
| `scripts/gates/check-headers.ts`           | Copyright/SPDX headers on every core file                                                           |
| `scripts/gates/check-branding.ts`          | No retired logo/screenshot assets come back                                                         |
| `scripts/gates/check-signature.ts`         | The provenance depth matrix: BLAKE3-pinned masked words + every recorded surface                    |
| `scripts/gates/check-pwa-offline-shell.ts` | The offline app-shell contract in the service worker                                                |
| `scripts/gates/audit-deps.ts`              | Dependency advisories against the expiring allowlist                                                |
| `scripts/gates/check-version-sync.ts`      | The version parity law (package.json, DORMANT, README + the family Cargo.toml surfaces, section 38) |
| `scripts/gates/check-proof-manifest.ts`    | The proof census guard: the for-all tier table re-read out of the tree                              |
| `scripts/gates/check-name-case.py`         | BMI Stellar / bmi-stellar name casing over every tracked file                                       |
| `scripts/gates/check-signature-assets.sh`  | BLAKE3 digests of the brand images (`assets/signature.b3sum`)                                       |
| `scripts/gates/check-actions-pins.sh`      | Every `uses:` pin is a 40-hex SHA; `--apply` heals stale release pins                               |
| `scripts/gates/check-permissions.sh`       | 644 files, 755 shebang executables                                                                  |
| `scripts/gates/check-commit-gate.sh`       | The fast pre-commit lane (the hook shim's engine)                                                   |
| `scripts/gate-keepers.sh`                  | The wholesale non-code lane (one section per concern)                                               |
| `scripts/ci/actions-version-sweep.sh`      | The tag-to-SHA heal engine (dry-run / apply)                                                        |

<!-- BMI-DISCLAIMER -->
<!--
  Documentation Disclaimer — read before relying on any data point.

  This document may contain stale data, hardcoded counts, or outdated
  file paths and symbol names. Maintainers update source code but may
  forget to sync every doc — perfect sync across every .md file is a
  known maintenance burden with diminishing returns.

  Source code (`src/**/*.ts`, `src/**/*.svelte`) is the single source
  of truth. Always cross-check against the actual source files before
  relying on any specific number (test count, record bound, key
  length), file path, function name, or config key.

  If you find a discrepancy, please open a PR — the doc is wrong, not
  the source.
-->
