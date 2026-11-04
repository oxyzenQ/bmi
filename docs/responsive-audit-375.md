# Responsive Depth Audit — 375 x 667 Floor (iPhone SE)

Date: 2026-11-04 (night-style-2). Tooling: Playwright-driven headless
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

| Surface                             | 375 x 667             | 667 x 375 | Notes                                                 |
| ----------------------------------- | --------------------- | --------- | ----------------------------------------------------- |
| Welcome                             | clean                 | clean     | nav chip bar, hero, pills                             |
| Calculator (form)                   | clean                 | clean     | stacked fields, unit toggle                           |
| Gauge + goal tracker (4881 px tall) | clean, 9 steps        | clean     | densest section                                       |
| Reference                           | clean, 3 steps        | clean     |                                                       |
| About                               | clean, 7 steps        | clean     |                                                       |
| Info + footer                       | clean                 | clean     | wallpaper clearly visible                             |
| Success modal                       | fits                  | -         | full-width sheet pattern                              |
| Language picker                     | fits, 4 rows          | -         |                                                       |
| Secure Export modal                 | fits                  | -         | full-bleed sheet; body scrolls to Verify              |
| Share card PNG                      | 1080 x 1080           | -         | purple-black gradient + grey footer verified          |
| Bottom nav chips                    | horizontal scroll bar | fits      | `.pager-nav-shell` overflow-x auto (intended pattern) |

Zero horizontal-overflow findings, zero out-of-bounds elements, zero
clipped controls across every scanned step.

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

No defects found; no fixes required. The audit stands as the baseline
for the 375 x 667 floor and should be re-run after any layout-level
change to the pager sections or modal shells.
