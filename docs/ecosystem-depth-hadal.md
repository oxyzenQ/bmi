<!--
  SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
  SPDX-License-Identifier: AGPL-3.0-only OR Commercial
-->

# The Hadal Depth Benchmark — BMI Stellar versus the BMI-calculator ecosystem

Date: 2026-11-28. This document is the corrected, verified landing of an
external ecosystem-depth report ("BMI Stellar vs Palung Mariana"), run
through the repository's own audit discipline before anything from it was
accepted: every number in the cross-check section was re-measured on this
tree, every physics anchor of the metaphor was checked against its public
source, and one arithmetic slip in the original was corrected. Nothing was
accepted because it flattered the project — one claim was measured and
refuted (section 4).

## 1. The benchmark design

An external analysis queried `"bmi calculator"` on the GitHub REST API
(access 2026-11-27: 59,556 repository matches, top hits cloned at depth 1
and structurally audited — CI workflows, test files, licenses, LOC), then
mapped the ecosystem onto an ocean-depth scale. The sampled competitors
(after one noisy hit removed — a 391-star MERN e-commerce platform that
matches the query without being a BMI app): 8 repositories, all tutorial-
origin, pushes last seen 2020–2024, none still operating.

| Depth anchor                                                                        | Project                          | The measured shape                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 m — surface                                                                       | tutorial repos (47–110 LOC)      | one input screen, the kg/m² formula, four WHO categories                                                                                                                                                                                                       |
| 40 m — recreational dive limit                                                      | iampawan (60 stars, 713 LOC)     | 1 test, 0 CI                                                                                                                                                                                                                                                   |
| 332 m — world scuba record (Ahmed Gabr, 2014)                                       | MarcinusX (405 stars, Flutter)   | 1 widget test, MIT, a real Johny Vino design — dormant since 2023-09                                                                                                                                                                                           |
| 3,800 m — Titanic wreck                                                             | GermaVinsmoke (202 stars, React) | 4 test files, codecov/coveralls badges, 7-day plaintext localStorage history — the ecosystem's deepest "functional" point                                                                                                                                      |
| 8,178–8,336 m — the snailfish zone (Mariana snailfish 2017; the filmed record 2023) | antonio-pedro99 / amsavarthan    | the largest non-vendored LOC (1,915–2,368), modern stacks — 0 tests, 0 CI, 0 encryption                                                                                                                                                                        |
| 10,935 m ±6 — Challenger Deep                                                       | BMI Stellar                      | the hull: 67 test files / 882 tests, 10 CI workflows, 18 gate scripts + gate-keepers + commit gates, argon2id + AES-256-GCM at rest with exact pins, 50 SHA-pinned actions, cargo-deny + CodeQL, D3 Ed25519 provenance (RFC 8032), AGPL-3.0-only OR Commercial |

Structural findings from the sample worth keeping: 4 of 8 repositories
ship no license file at all (one displays an MIT badge with no license
file behind it), 0 of 8 have any active CI workflow (two still display
badges for a CI service that died years ago), and the combined test-file
count of all 8 is 7 — four of which belong to one repository. One
repository reports ~27.8k LOC of which ~20k is vendored bootstrap and
utility libraries — the raw-number lesson this repository's loc ratchet
already encodes.

## 2. The verdict the report reached, stated honestly

The report split the question, and the split is the honest part:

- **Question 1 — "calculate a BMI."** The formula is eleven lines. On
  this question the whole hull is overkill (LOC ~38× the sample median,
  tests ~9× the combined sample, CI 33 jobs vs 0). Overkill score:
  9.5/10.
- **Question 2 — "keep personal health data private, offline, serverless,
  telemetry-free, and revivable after 1–5 dormant years."** On this
  question every sampled competitor scores zero on every dimension, and
  the report's own closing line holds: this is not aimless overkill, it
  is extreme consistency about one decision — health data is secret, and
  that decision needs a hadal-class hull.

The scale's honest limit (stated by this landing, not by the original):
Challenger Deep is a claim about **relative** depth inside a sampled
niche of dead tutorial repositories. It is the truthful floor of that
niche — but for question 2 the fair peer set is not BMI calculators at
all, and outside the niche the metaphor does not transfer automatically.

## 3. Cross-check: what this repository verified on its own tree

The report audited commit `d4891a3`; this repository re-measured at the
consolidation commit and the depth claim holds as a growing, living
state — not a museum piece:

| Report claim                           | Re-measured 2026-11-28                                                                                                                   | Verdict                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 10 CI workflows                        | 10 workflow files in `.github/workflows/`                                                                                                | exact                                                          |
| 33 CI jobs                             | 17 static `runs-on` declarations by grep; a matrix-expanded count can legitimately reach 33, but it is not reproducible by a static pass | not independently confirmed — treat as plausible, not verified |
| 66 test files / 877 tests at `d4891a3` | 67 files / 882 tests at the consolidation commit (delta = the scroll-lock suite: +1 file, +5 tests)                                      | consistent, and growing                                        |
| CI green                               | the previous push's 5/5 lanes SUCCESS                                                                                                    | consistent                                                     |
| "active — new commit this week"        | commits within the week of the report                                                                                                    | consistent                                                     |

## 4. The one claim measured and refuted: the CSS fat

The report closed with a concession — "the 8 audit documents could
consolidate to 3, and the 6,127-line CSS still carries a little fat."
The first half was accepted and executed the same day (the consolidation
of November 2026's seven audit records into `AUDIT-SEC-2026-11.md` +
`AUDIT-ENG-2026-11.md`, with the frozen `AUDIT-2026-08.md` untouched —
8 records into 3, exactly as suggested). The second half was **measured
before being believed**, and the measurement refutes it: 331/331 class
selectors referenced, 306/306 custom properties consumed, zero pure
duplicate blocks, zero orphan keyframes, zero unreferenced files, and
the only mechanical trim available is ~9 lines (0.15%) bought at the
cost of comment-to-rule locality. Full census in `AUDIT-ENG-2026-11.md`
section 8; the measurement scripts ride as
`scripts/dev/css-fat-hunt.py` and `scripts/dev/css-fat-deep.py`. A fat
trim without a measurement is superstition — the claim of depth in this
document is only as good as the discipline that checks its own fat.

## 5. The corrected closing scale

The original report ended: "from Challenger Deep up to Everest's summit
(8,849 m) there are still 2,086 m of headroom left." That number is a
mixed-units slip — 10,935 − 8,849 compares a depth below sea level with
a height above it and calls the difference a distance. The corrected
figure: from the trench bottom to the Everest summit is
**10,935 m + 8,849 m ≈ 19,784 m** of climb (≈19.8 km). The intended
point survives the correction, and lands stronger: the headroom above
this benchmark is not a sliver — it is longer than the entire descent.

```
10,935 m  Challenger Deep   ████ BMI Stellar (67 files / 882 tests, 10 workflows, hull)
 8,336 m  snailfish record  ▊ amsavarthan (0 tests, 0 CI)
 8,178 m  Mariana snailfish ▊ antonio-pedro99 (0 tests, 0 CI)
 3,800 m  Titanic           ▌ GermaVinsmoke (7 days, plaintext)
   332 m  scuba record      ▎ MarcinusX
    40 m  recreational      ▏ iampawan
     0 m  surface           tutorial repos
        + 19,784 m climb from here to the Everest summit — the headroom above
```

Physics anchors, as cited by the original and kept here: NOAA/Caladan
surveys put Challenger Deep at 10,935 m ±6 (2021); pressure at that
depth exceeds 1,000× surface pressure (Royal Museums Greenwich); the
deepest filmed fish is a snailfish at 8,336 m in the Izu-Ogasawara
Trench (2023, Natural History Museum London), with the Mariana snailfish
recorded at 8,178 m (2017); the world scuba record is 332 m (Ahmed Gabr,
2014); the Titanic rests at ~3,800 m; the recreational dive limit is
40 m. GitHub sampling: GitHub REST API, access 2026-11-27, 59,556
matches for "bmi calculator", top-15 cloned and structurally audited.

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
