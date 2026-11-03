<!-- Copyright (C) 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# BMI Stellar LTS Readiness Audit - End-to-End Real Usage

Date: 2026-11-04. Scope: the whole product driven the way a user
drives it - the production build served by `vite preview`, exercised
through a real Chrome session (agent-browser/CDP), plus the full
automated gate (515 unit tests, type-check, lint, format, PWA shell
gate, dependency audit). The question: is this free enough from bugs,
leaks, and problems to land as the LTS production baseline?

## 1. Method

- Fresh production build (`bun run build`), served by `vite preview`.
- Real browser session: welcome screen, section navigation, the full
  calculator flow (metric and imperial), the auto-saved history, the
  gauge/snapshot/trend/body-fat/goal cards, the celebration modal,
  reload persistence, storage inventory, and a network-egress audit at
  the CDP level (independent of the page's own resource buffer, which
  the app is free to clear).
- Automated lanes: `bun run test:ci` (515/515), `svelte-check`
  (0 errors, 0 warnings), eslint, prettier, `audit:deps`,
  `audit:pwa-offline`, the 13-section gate-keepers lane, and the full
  `build.sh check-all -q` gate.

## 2. Verified working (live, exact-value checks)

| Surface               | Input                      | Expected                          | Rendered  | Verdict |
| --------------------- | -------------------------- | --------------------------------- | --------- | ------- |
| BMI (metric)          | 30y, 175 cm, 70 kg         | 70/1.75^2 = 22.86                 | 22.86     | exact   |
| BMI (imperial)        | 30y, 68.9 in, 154.3 lb     | exact-constant conversion = 22.85 | 22.85     | exact   |
| BMR (Mifflin-St Jeor) | male, 70 kg, 175 cm, 30y   | 1648.75 -> 1649                   | 1649      | exact   |
| TDEE (1.55x)          | BMR x 1.55                 | 2555.56 -> 2556                   | 2556      | exact   |
| Body fat (Deurenberg) | male, 30y, BMI 22.86       | 18.13 -> 18.1%                    | 18.1%     | exact   |
| Category + risk       | BMI 22.86                  | Normal Weight, LOW risk           | matches   | exact   |
| Goal tracker          | target 22.0, current 22.86 | 0.86 BMI points to lose           | matches   | exact   |
| Progressive unlock    | age -> height -> weight    | chained enablement                | matches   | pass    |
| History               | calculate                  | auto-saved entry                  | Entries:1 | pass    |
| Console / page errors | whole session              | none                              | 0 and 0   | pass    |

Storage inventory after the full journey: IndexedDB `bmi-calculator`;
localStorage `bmi.locale`, `bmi.history`, `bmi.unitSystem`, and (new)
`bmi.updateCheckAt`. Nothing else. The unit toggle clears the numeric
inputs by design (imperial and metric fields are different inputs);
the last calculated result legitimately persists until the next
calculation or Clear all data.

## 3. Findings and the fix that landed

### F1. The automatic update check fired on every production load (fixed)

`+layout.svelte` scheduled `checkForPwaUpdate('auto')` three seconds
after every load, and each check issues two cross-origin GETs
(`raw.githubusercontent.com` for `package.json`,
`api.github.com` for the latest commit). Disclosed in the README
Limitations, no payload, no cookies, no health data - but the
frequency maximized the exposed IP/user-agent/timing surface the
privacy posture promises to minimize, and the unauthenticated
api.github.com pool (60 req/hour per IP) burns out fast on shared
egress, which kills the check exactly where it is needed.

Fix landed in this audit: the timer-driven check now runs at most once
every 12 hours per device (`shouldRunAutoUpdateCheck` +
`bmi.updateCheckAt` in localStorage; a failed or offline attempt is
not recorded, so the next load retries instead of blinding the check).
Manual checks in About and service-worker-driven confirmations never
throttle. Proven live at the CDP level: seeded key, delta 0 requests
across a reload; cleared key, delta exactly one request pair. Three
new unit tests cover the helper (515 total, all green). The README
Limitations line now states the throttled behavior.

### F2. Service-worker-served staleness is real (documented, not a bug)

During verification, reloads kept serving the previous bundle until
the new service worker took over - the standard PWA prompt-based
update model working as designed (`applyPwaUpdate` exists for the
user-facing path). Auditors verifying a fresh build against `vite
preview` must unregister the worker or use a fresh profile first.
Recorded here so the next session does not mistake the model for a
caching bug.

### F3. Minor UX note: celebration modal focus (no change)

After the first calculation a celebration modal opens. It closes via
its Close notification button and honors `closeOnEscape` when focus
sits inside the dialog; an Escape pressed while focus is elsewhere on
the page does not close it. Standard focus-dependent behavior, the
dialog carries the correct role and label. No change made.

### F4. The privacy egress inventory is complete and now minimal

The whole client makes exactly two classes of outbound requests:
Vercel Analytics/Speed Insights on the hosted demo (already disclosed
in the README, deploy-dependent, no health values) and the throttled
update check above. No third-party fonts, no CDN scripts, no tracking
pixels - fonts and icons ship self-hosted. CSP in
`src/hooks.server.ts` allowlists exactly these hosts.

## 4. Verdict

LTS-ready. Every computed number the product surfaces matched its
published formula exactly under real usage, the whole 515-test
battery is green, the storage surface is minimal and named, and the
one privacy-claim gap (per-load update checks) is closed with a
tested, verified throttle plus an updated disclosure. The remaining
owner-decision items stay as recorded in the infra audit doc.

## 5. Brand palette verification (the purple, grey, white focus)

Checked against the original brand art, not just the docs: the logo
master plate (`docs/assets/bmi-logo-masters.png`) is a dark plate
(black-to-navy field with violet accent detail), and the live design
tokens resolve to the same family - `--cosmic-purple: #8000ff`,
`--cosmic-blue: #9a4dff`, violet accent decomposition
`rgba(139, 92, 246, ...)`, slate greys for surfaces and secondary
text, `--stellar-white: #ffffff` for primary text. BRANDING.md
section 4 documents exactly these resolved values and its note about
the rgba decomposition matches `src/styles/tokens.css` line for line,
so the palette law, the tokens, and the art agree. No drift found;
no change needed.

## 6. Toolchain, dependency, and CI-pinning audit for dormancy (2026-11-04)

Question: is every dependency, tool, compiler, and runtime the project
touches actually fit for a 1-5 year dormant stretch - nothing EOLs
under a frozen pin, nothing rots silently, nothing needs a human
before `scripts/setup.sh` works again?

### 6.1 Runtime and toolchain pins (single sources of truth)

| Surface        | Pin                                    | Source of truth       |
| -------------- | -------------------------------------- | --------------------- |
| Bun            | `1.3.11` (latest published: `1.4.4`)   | `packageManager`      |
| Node range     | `>=22 <25`                             | `engines`             |
| Node in CI     | `24` (LTS, EOL 2028-04-30)             | `NODE_VERSION` env    |
| Vercel runtime | `nodejs24.x`                           | `VERCEL_NODE_RUNTIME` |
| Local asdf     | bun `1.3.11`, node `24.x`              | `.tool-versions`      |
| CI runners     | `ubuntu-24.04` (never `ubuntu-latest`) | all 9 workflows       |
| CodeQL bundle  | `codeql-bundle-v2.27.4`, SHA-pinned    | `codeql.yml`          |

Bun is resolved in CI from `package.json#packageManager` itself (a
local `node -p` read, not a GitHub API call), `setup.sh` phase 1
enforces the same pin, and `.tool-versions` was aligned `22.x -> 24.x`
in this audit: the file had no gate reading it, Node 22 maintenance
ends 2027-04-30 while Node 24 (the CI major) is serviced to
2028-04-30, and the value now agrees with `engines` and `NODE_VERSION`.
Bun publishes no EOL calendar; the wake-up order already answers that
by making Bun/Node upgrades step 4 of `DORMANT.md`.

### 6.2 CI actions and gate-tool supply chain

Every `uses:` across the nine workflows is a 40-hex SHA with a version
comment (`checkout v7.0.1`, `setup-node v7.1.0`, `setup-bun v2.2.0`,
`cache v6.1.0`, `upload-artifact v7.0.2`, `download-artifact v8.0.2`,
`codeql-action` bundle `2.27.4`, `action-gh-release v3.0.3`), enforced
by the `check-actions-pins` gate. Weekly lanes keep the pins honest
without human input: `self-heal-actions` (Mon 00:00 UTC) heals them to
latest releases, `maintenance` (Mon 00:00) validates a deps-only
`bun.lock` refresh through the full quality gate, `codeql` (Mon 00:00)
and `security-audit` (Mon 00:05) rescan, and `runtime-probe` (Sun
01:00) probes `nodejs24.x/26.x/28.x` with the full gate and prepares
the next Node bump as a reviewed change. Gate tools install
verifiable: `yamllint==1.37.1` and `codespell==2.4.1` are exact pip
pins, actionlint `1.7.7` is checked against the publisher checksum
file, b3sum `1.8.7` is proven against the BLAKE3 known-answer vectors
(it ships no checksum asset), and shellcheck comes preinstalled on the
pinned runner image. None of the repo scripts call `api.github.com` or
`raw.githubusercontent.com`, so the rate-limit failure mode that the
hosted app had (F1) has no toolchain analog.

### 6.3 Dependency freshness against the live registry (2026-11-04)

`bun.lock` holds 460 packages; all 33 direct dependencies resolve, and
all 11 security overrides land at their intended floors (`undici
7.30.1`, `cookie 0.7.2`, `tar 7.5.22`, `devalue 5.9.4`,
`brace-expansion 5.0.12`, `source-map-js 1.2.2`,
`postcss-selector-parser 7.1.7`, `@humanfs/node 0.16.8`, plus the
`postcss`/`vite`/`esbuild` floors).

| Package                  | Resolved  | Registry latest | Standing                                    |
| ------------------------ | --------- | --------------- | ------------------------------------------- |
| vite                     | `8.3.5`   | `8.3.5`         | current                                     |
| eslint                   | `10.14.0` | `10.14.0`       | current                                     |
| prettier                 | `3.9.10`  | `3.9.10`        | current                                     |
| svelte-check             | `4.7.8`   | `4.7.8`         | current                                     |
| esbuild                  | `0.28.2`  | `0.28.2`        | current                                     |
| svelte                   | `5.55.9`  | `5.57.3`        | same major, minor behind                    |
| @noble/hashes            | `2.2.0`   | `2.4.0`         | same major; crypto, exact pin, no weakening |
| @sveltejs/kit            | `2.70.2`  | `3.1.1`         | next major exists; deliberate pin           |
| typescript               | `6.0.3`   | `7.0.2`         | next major exists; deliberate pin           |
| vitest                   | `4.1.12`  | `5.1.0`         | next major exists; deliberate pin           |
| @sveltejs/adapter-vercel | `6.3.4`   | `7.0.2`         | next major exists; deliberate pin           |

The five exact pins (kit, svelte, typescript, vitest, and the crypto
hash library) are the dormant-correct choice: majors (kit 3, TS 7,
vitest 5) are owner decisions recorded in the infra audit, not
maintenance bumps.

### 6.4 Advisory posture, live run

`bun run audit:deps` on 2026-11-04: 5 advisories, 0 blocking, all 5
allowlisted with concrete reasons and a common expiry of 2027-05-01 -
`@sveltejs/kit` low x2 (no 2.x fix; the fix is the 3.0.0 major),
`deepmerge` low (no fixed release upstream), `glob` and `minimatch`
moderate (build/dev-time only, via `@vercel/nft` tracing and the lint
toolchain). Expired, stale-severity, or mismatched entries fail closed
and force re-review, so the list cannot rot into a silence switch.

### 6.5 Watch items (none blocking)

1. A future `runtime-probe` Node 26 bump must raise the `engines` upper
   bound (`<25`) in the same change, or the manifest and CI disagree.
2. The two kit low GHSAs ride on 2.x until the 3.0.0 owner decision;
   the allowlist expiry forces the 2027-05-01 re-review.
3. shellcheck's version floats with the runner image (0.10.0 locally);
   it is skip-with-warning by design, so a future image change degrades
   gracefully rather than red.
4. Local gate-tool drift is cosmetic only (yamllint 1.38.0 vs CI
   1.37.1, codespell 2.4.3 vs 2.4.1); CI pins are authoritative.

### 6.6 Verdict

Suitable for dormant. Every runtime and tool is pinned to a single
source of truth, every action is SHA-pinned with a weekly heal lane,
the advisory list is policy-gated with a forced re-review date, no
accepted advisory or runtime EOL lands before 2027-05-01 (Node 24
runs to 2028-04-30), and the registry delta is entirely either
current, same-major, or a deliberately deferred major with the
wake-up path already written down in `DORMANT.md`.
