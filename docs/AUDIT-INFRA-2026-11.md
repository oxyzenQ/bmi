<!-- Copyright (C) 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# BMI Stellar Infra Audit - the zelynic Discipline Sync (night-improve-1..8)

Date: 2026-11-04. Scope: the full infrastructure surface of this
repository, audited against the mature reference implementation in the
same owner's `zelynic` repository (a Rust/eBPF CLI, v80.0.2, 12
workflows, 34,000+ lines of gate scripts). The instruction was
explicit: take what transfers, do not copy raw - zelynic is a kernel-
adjacent Rust binary, this is a SvelteKit web app, and several of its
lanes have no honest equivalent here. This document is the map: what
was ported, what was adapted, what is N/A and why, and what is left as
an owner decision.

## 1. Workflow inventory (zelynic 12 vs bmi 9)

| zelynic workflow                 | bmi workflow                              | Relationship                                                                                        |
| -------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Dragon Guard - CI                | Stellar Guard - CI (ci.yml)               | Equivalent (build + test gate)                                                                      |
| Dragon Guard - CodeQL            | CodeQL Security Scan (codeql.yml)         | Equivalent                                                                                          |
| Dragon Guard - Gate-keepers      | Stellar Guard - Gate-keepers (new)        | Ported (night-improve-5)                                                                            |
| Dragon Guard - Security Audit    | Security Audit (security-audit.yml)       | Equivalent (weekly advisories)                                                                      |
| Dragon Guard - Dependency Maint. | Maintenance deps weekly (maintenance.yml) | Equivalent (weekly refresh)                                                                         |
| Dragon Guard - Release           | Release (release.yml)                     | Adapted (tag build, no binaries)                                                                    |
| Dragon Guard - Miri              | -                                         | N/A (no Rust, no unsafe)                                                                            |
| Dragon Guard - Fuzz              | -                                         | N/A (no cargo-fuzz targets)                                                                         |
| Dragon Guard - Supermassive (x3) | -                                         | Adapted: the vitest battery (464 tests) is the CI test lane; the kernel rigs have no web equivalent |
| Dragon Guard - crates.io publish | -                                         | N/A (private npm package, told once in the README)                                                  |
| zelynic E2E / Container E2E      | Runtime Probe (runtime-probe.yml)         | Adapted (Node-major probe = the compatibility lane)                                                 |
| Documentation CI (docs-ci.yml)   | Documentation CI                          | Equivalent (codespell lane)                                                                         |
| Maintenance actions versioning   | self-heal-actions.yml                     | Upgraded to the zelynic SHA-pin engine (night-improve-2)                                            |

Conventions brought in line: actions pinned to full 40-hex SHAs with a
version comment (30/30 pins, verified live); `runs-on: ubuntu-24.04`
for the new lane; `concurrency: ${{ github.workflow }}-${{ github.ref }}`
on the new lane; `contents: read` least-privilege defaults; the
commit-message convention (`Internal research: ...` + `Signed-off-by`)
already matched the zelynic QA.md contract.

## 2. Ported disciplines (the one-per-file gate family)

| Discipline                    | zelynic source                                                    | bmi landing                                                                                                                         |
| ----------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| scripts/ tree layout          | scripts/{gates,dev,ci,lib}/                                       | Same tree (night-improve-1)                                                                                                         |
| LOC caps                      | check-loc.sh 600 no-mercy, check-scripts-loc.sh 1000 + IOU marker | check-loc.ts three tiers: 1000 hard, 600 ratchet (`loc-ratchet.json`, 14 entries), 1000 scripts + `# LOC_EXEMPT:` (night-improve-7) |
| Actions-pin shape + self-heal | check-actions-pins.sh + actions-version-sweep.sh                  | check-actions-pins.sh + actions-version-sweep.sh (night-improve-2)                                                                  |
| Version manager               | dev/version-to.sh (changelog ledger, probed writes)               | dev/version-to.ts (changelog splice, honest probes) + check-version-sync.ts (night-improve-3)                                       |
| Package metadata completeness | Cargo.toml [package] masterclass                                  | package.json repository/bugs/homepage/funding (night-improve-4)                                                                     |
| Wholesale gate-keepers lane   | gate-keepers.sh (22 sections)                                     | gate-keepers.sh (12 sections: the emoji sweep and the name-case rule landed with night-improve-8)                                   |
| Commit-time hook shim         | .githooks/pre-commit -> check-commit-gate.sh                      | Same shape, self-installed by section 0 + setup.sh                                                                                  |
| Bring-up                      | setup.sh (3 phases)                                               | setup.sh (toolchain, frozen install, hook wiring)                                                                                   |
| Permission guard              | check-permissions.sh (644/755 + shebang parity)                   | check-permissions.sh; the repo-wide 755 drift was normalized (219 files 644, 10 executables 755)                                    |
| CLI surface (-V, doctor)      | binary -V / doctor, show_system_info tree                         | build.sh -V + doctor (live version, tree output, [OK]/[WARN]/[FAIL])                                                                |
| Docs index                    | docs/README.md map                                                | docs/README.md map (this file's sibling)                                                                                            |
| Funding declaration           | .github/FUNDING.yml (ko_fi)                                       | .github/FUNDING.yml (ko_fi: rezky)                                                                                                  |

## 3. Adapted, not copied (the honest deltas)

- **LOC law.** zelynic's 600-line Rust cap is enforced "no mercy"
  because the language splits cleanly into modules. This tree's legacy
  (14 files at 600-969 lines, including the i18n locale dictionaries
  where splitting is meaningless) cannot be split without a functional
  refactor, so the law landed as a ratchet: the 14 legacy files are
  watermarked at their current size and may never grow; new files get
  the 600 cap outright; the debt ledger can only shrink. The scripts
  cap ports verbatim (1000 + `# LOC_EXEMPT:`).
- **Test placement.** zelynic's "every .rs test file under the single
  test/ tree" (Pattern C, `autotests = false`) is a Cargo layout rule.
  The vitest/SvelteKit convention collocates tests under
  `__tests__/`; moving 30 test files would be churn against the
  framework idiom. Not ported, documented here instead.
- **src/ root single-file policy.** zelynic's src/ holds exactly
  main.rs. A SvelteKit src/ root is framework-mandated layout
  (hooks.server.ts, service-worker.ts, app.d.ts, app.html). N/A.
- **Release pipeline.** zelynic ships two static musl tarballs
  (x86-64-v3/v4) with SHA-512 + BLAKE3 + SHAKE256 (quantum-resistant)
  checksums and detached GPG signatures. This project ships a Vercel
  deployment: there are no release artifacts to checksum or sign, and
  the tag lane (Stellar-vX.Y) builds and validates instead. N/A for as
  long as the app is web-only.
- **The self-heal credential.** zelynic retired its weekly server-side
  pin lane to avoid a standing push secret; bmi keeps the weekly lane
  because `PAT_WORKFLOW` already exists and the owner built the lane
  deliberately. The engine behind it is now the same shape as
  zelynic's (tag-to-SHA heals, majors crossed, fail-closed write
  guard, honest skips).

## 4. Deliberately not ported (with reasons)

| Item                                       | Reason                                                                                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Miri UB lane                               | No Rust, no unsafe blocks, no UB surface                                                                                                                        |
| Fuzz lane                                  | No cargo-fuzz targets; the vitest property-style suites cover the crypto/storage cores                                                                          |
| crates.io publish                          | Private npm package; the README tells the packaging story once                                                                                                  |
| KVM micro-VM sandbox                       | No root-requiring kernel surface; the app is user-space web                                                                                                     |
| Supermassive kernel rigs                   | cgroup/eBPF hardware proofs have no web equivalent                                                                                                              |
| eBPF prebuilt parity lane                  | No eBPF objects                                                                                                                                                 |
| Rust version-sync gate                     | The analog already exists: .tool-versions + packageManager + engines pins                                                                                       |
| check-language (Indonesian-vocab detector) | This app IS multilingual by design (4 locale dictionaries); a vocab gate would flag legitimate product content. The English-only discipline stays a review norm |
| CLA.md / NOTICE                            | Legal instruments are owner decisions; recommended below, not added unilaterally                                                                                |

## 5. Defects found and fixed along the way

1. `codeql.yml` carried a malformed branch filter (`branches: ain, dev]`
   - the flow-sequence opening was eaten at some point), so the
     filter silently degraded. Fixed in the consistency pass.
2. All 30 action pins were floating version tags, several 2-3 majors
   behind (checkout v5, cache v5, upload-artifact v5,
   download-artifact v6, setup-node v6) because the old weekly lane
   only bumped inside a major. Healed to SHAs, engine now crosses
   majors.
3. The whole tree was tracked at mode 755 (every file, LICENSE
   included) - a first-commit filesystem artifact that survived every
   commit since. Normalized to 644/755-shebang-parity under a new
   permission gate.
4. `README.md` alt texts used the lowercase two-word name (5 instances),
   outside the BRANDING 2.1 law. Fixed in the naming pass.

## 6. Open items (owner decisions, intentionally not done here)

1. **CLA.md / NOTICE.** zelynic pairs its dual license with a CLA and
   a NOTICE summary. Both are legal instruments; adding them changes
   contribution terms and should be an owner decision, not an agent's.
2. **markdownlint-cli2 lane.** zelynic lints every .md; bmi has no
   markdownlint config yet. Adding one is cheap but is a new config
   surface; recommended as a follow-up with the config committed
   alongside.
3. **A browser E2E lane.** The PWA offline shell has a source-level
   gate (check-pwa-offline-shell.ts) and 464 unit tests, but no
   Playwright-class browser battery. Recommended as a future
   supermassive-style lane for the install/offline/backup flows.
4. **Branch protection.** The gates are advisory to a direct-push
   main. Requiring `Stellar Guard - CI` and `Stellar Guard -
Gate-keepers` checks on main would close the last gap; that is a
   repository-settings decision.
