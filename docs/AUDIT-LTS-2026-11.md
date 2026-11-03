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
