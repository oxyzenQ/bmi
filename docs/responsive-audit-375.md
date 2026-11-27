<!--
  SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
  SPDX-License-Identifier: AGPL-3.0-only OR Commercial
-->

# Responsive Depth Audit — 375 x 667 Floor (iPhone SE)

Date: 2026-11-04 (night-style-2). Re-run: 2026-11-27 (night-cafe-10,
changelog modal, release-changes trigger, and the unlock door added to
the surface walk). Tooling: Playwright-driven headless
Chromium via the repo dev server, viewport-driven, plus a DOM-wide
programmatic overflow scanner.

## Method

1. **Viewport floor.** All audits ran at 375 x 667 CSS pixels, the
   smallest supported device per the owner's floor, with one extra
   pass at 667 x 375 (SE landscape) for the rotation case.
2. **Programmatic sweep.** For every pager section the scroll
   container was stepped in 550 px increments end to end; at each
   step a scanner walked every rendered element and flagged:
   page-level `scrollWidth` beyond the viewport, any element whose
   bounding box crossed the right edge by more than 2 px without a
   clipping ancestor, and any element crossing the left edge.
3. **Surface walk.** All six pager sections (Welcome, Calculator,
   Gauge incl. goal tracker, Reference, About, Info) plus the
   success modal, language picker, Secure Export modal, and the
   generated share card were exercised live.
4. **Live share card.** `generateBmiCard` was invoked in-page with a
   real result payload and the PNG rendered back into the viewport
   for inspection of the night-style-2 brand pass.

## Results

| Surface                             | 375 x 667               | 667 x 375 | Notes                                                   |
| ----------------------------------- | ----------------------- | --------- | ------------------------------------------------------- |
| Welcome                             | clean                   | clean     | nav chip bar, hero, pills                               |
| Calculator (form)                   | clean                   | clean     | stacked fields, unit toggle                             |
| Gauge + goal tracker (4881 px tall) | clean, 9 steps          | clean     | densest section                                         |
| Reference                           | clean, 3 steps          | clean     |                                                         |
| About                               | clean, 7 steps          | clean     |                                                         |
| Info + footer                       | clean                   | clean     | wallpaper clearly visible                               |
| Success modal                       | fits                    | -         | full-width sheet pattern                                |
| Language picker                     | fits, 4 rows            | -         |                                                         |
| Secure Export modal                 | fits                    | -         | full-bleed sheet; body scrolls to Verify                |
| Share card PNG                      | 1080 x 1080             | -         | purple-black gradient + grey footer verified            |
| Bottom nav chips                    | horizontal scroll bar   | fits      | `.pager-nav-shell` overflow-x auto (intended pattern)   |
| Changelog modal (night-cafe-10)     | fits, centered          | -         | gradient panel, bezel seam, OK button centered          |
| Release-changes trigger             | centered (was 24px off) | fits      | 640px container cap fixed; 0px offset both orientations |
| Unlock door (night-cafe-10)         | fits, centered          | -         | one passphrase field, wrong passphrase refused live     |

Zero horizontal-overflow findings, zero out-of-bounds elements, zero
clipped controls across every scanned step.

## Night-cafe-10 deep pass: Info + language switcher

Re-run: 2026-11-27 (night-cafe-10), same method, focused on the two
approved surfaces: the Info section (`SettingsSection`) and the
language switcher (`LanguageSwitcher`, portaled to body), both
orientations, driven through the real UI - hash navigation, real taps,
real locale switches through the panel's own option rows, and the
panel's bounding box measured per state.

| Surface                     | 375 x 667        | 667 x 375        | Notes                                           |
| --------------------------- | ---------------- | ---------------- | ----------------------------------------------- |
| Info section sweep          | clean, 2 steps   | clean, 2 steps   | no page or element overflow                     |
| Switcher trigger            | in nav chip bar  | in nav chip bar  | h=44px both orientations                        |
| Panel centering             | gaps L=R=58px    | gaps L=R=194px   | centered within 2px, fully inside the viewport  |
| Panel after locale switches | centered, inside | centered, inside | en / id / zh / ja all fit; no reflow overflow   |
| Option rows                 | 44px after fix   | 44px after fix   | was 41-42px - below the 44px touch-target floor |
| Escape close                | closes           | closes           | panel unmounts                                  |

One real finding, fixed in the same pass: the `.lang-option` rows
rendered 41-42px tall on the floor viewport - under the 44px
touch-target minimum the close button already met - and now carry an
explicit `min-height: 44px`, re-measured live at exactly 44px in both
orientations after the fix. Everything else on both surfaces was
already clean: the panel is geometrically centered at every locale,
no overflow crossed the 2px tolerance anywhere, and the Info section
sweeps without a single finding.

## Night-cafe-mclaren-11 pass: full-estate anti-gimmick proof + CSS depth sweep

Re-run: 2026-11-27 (night-cafe-mclaren-11). Two mandates in one
session: prove every prior pass behaves, not just compiles (the
anti-gimmick proof), then sweep the whole UX/UI CSS estate at the same
depth. Tooling: Playwright-driven headless Chromium against the dev
server, hardware signals emulated through `addInitScript` for the
jelly tier probes, a DOM-wide scanner walking every rendered element
per 550px scroll step.

### Anti-gimmick proof (every prior pass re-proven live)

| Prior pass              | Live proof                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jelly low-tier cap      | 4 cores / 4 GB emulated: 38.4px give (the 0.6 ratio of the 80px base, exactly); 16 cores / 8 GB: ~63px; both settle to an empty transform            |
| Language rows           | 44px measured on all four rows, both orientations                                                                                                    |
| Changelog latest        | v80.6.0 first section carries the release line with commit ef04cb7 plus 14 change notes; every splice-era release (80.5.2+) carries its commit chips |
| Unlock door             | seeded sealed envelope survives a cold reload, wrong passphrase refused live, right passphrase restores the readable ledger                          |
| Release-changes trigger | 0px offset from its container center, both orientations                                                                                              |

The suite behind these (65 files, 860 tests) is green locally.

### CSS depth sweep results

| Dimension                                       | 375 x 667 | 667 x 375 | 1280 x 800 | Notes                                                                       |
| ----------------------------------------------- | --------- | --------- | ---------- | --------------------------------------------------------------------------- |
| Page + element overflow (6 sections)            | zero      | zero      | zero       | scanner walked every rendered element per step, 2px tolerance               |
| Changelog modal overflow                        | zero      | zero      | -          | scanned with the modal open                                                 |
| Touch-target census                             | 1 finding | 1 finding | 1 finding  | the About repo link (fixed, below); sr-only input exempt (a11y pattern)     |
| `will-change` while idle                        | zero      | zero      | zero       | the jelly sets and clears it per frame                                      |
| Active `backdrop-filter` on mobile              | zero      | zero      | -          | the perf-tier overrides hold                                                |
| Box-shadow blur over 40px, visible              | zero      | zero      | zero       | no paint-heavy surfaces                                                     |
| Text under 11.5px                               | zero      | zero      | zero       |                                                                             |
| `transition: all` / layout-property transitions | zero      | zero      | zero       | compositor-clean (transform/opacity only)                                   |
| Running animations while idle                   | zero      | zero      | zero       | nothing animates unseen                                                     |
| Keyboard focus rings                            | correct   | correct   | correct    | `:focus-visible` restores the ring; inputs carry a border-color focus style |

One real finding, fixed in the same pass: the About repo link
(`.app-info .info-row a`) rendered 28px tall - under the 44px
touch-target floor the language rows already meet. It now carries
`min-height: 44px` with flex centering; the text does not move, the
hit box opens, re-measured live at exactly 44px in all three
viewports with zero overflow after the fix.

Skip-and-justify (peak, no change made):

- The skeleton spinner keyframes animate `border-*-color` - paint-only
  on a ring measured in tens of pixels, visible only during lazy-load
  skeletons; the compositor cannot own border-color and converting it
  would change the visual for a cost no profiler can see.
- The scroll-to-top button measured 35x35 once - the hidden
  `scale(0.7)` pre-visible pose caught mid-transition; its settled
  visible pose is 50x50 and needs nothing.

## Scope notes

- The floor is 375 x 667 by owner mandate; narrower devices are out
  of contract.
- The history sparkline requires two or more saved measurements and
  was reviewed at the code level (its 768-line ratchet file) rather
  than seeded live.
- Landscape boxes wider than the viewport are block containers with
  centered content; nothing visible is cut and the section scrolls
  normally.

## Verdict

Night-style-2 baseline: no defects. Night-cafe-10 re-run found one
defect - the release-changes trigger rode a 260px-capped container and
sat 24px off-center at 375 x 667 - fixed by keeping the width cap on
the buttons only; the changelog modal and the unlock door now join the
surface walk and measure centered at 0px. Night-cafe-mclaren-11
re-proved every shipped pass live and swept the full CSS estate: one
defect found (the About repo link under the 44px touch-target floor),
fixed and re-measured; everything else verified at peak. The audit
stands as the baseline for the 375 x 667 floor and should be re-run
after any layout-level change to the pager sections or modal shells.

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
