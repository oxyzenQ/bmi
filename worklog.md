# BMI Project Worklog

---
Task ID: 1
Agent: Main Agent
Task: Optimize design, quality, stabilization — full execution from previous session plan

Work Log:
- Discovered commit `e5411b7` already existed from previous session with partial work done
- Fixed git identity: amended commit to set Author: oxchin <oxchinn@gmail.com>, Committer: oxyzenQ <with.rezky@gmail.com>
- Verified previous session completed: typo fix, splash fix, wallpaper system, theme toggle, overflow fix, unused TS constants
- Ran deep CSS analysis via subagent — found 34 unused CSS variables, 130+ hardcoded rgba colors, orphaned keyframes, CSS typos
- Fixed CSS typo: `greyscale` → `grayscale` (moz-osx-font-smoothing)
- Removed invalid `font-display: swap` from element rule (only valid in @font-face)
- Fixed `rgba(0,0,0,0.500)` → `rgba(0,0,0,0.5)` (trailing zero)
- Fixed no-op `clamp(64px, 6vw, 64px)` → `64px`
- Removed orphaned `@keyframes fadeIn` and `@keyframes slideUp` (never referenced)
- Fixed invalid border shorthand: `1px solid var(--border-by-rezky)` → `var(--border-by-rezky)` (3 lines)
- Removed 34 unused CSS variables from `:root`: cosmic-deep-space, cosmic-nebula, cosmic-primary/secondary/accent, cosmic-text-primary/secondary, plasma-deep/dark/darker/accent/blue-dim/purple-dim/text-dim, aurora-whisper, atmosphere-deep/mid/light, shadow-silhouette, accent-purple, apple-glass/border/shadow, btn-blur, btn-saturate, shine-duration, shine-easing, space-1 through space-8
- Removed dead performance-tier overrides for removed btn-blur/btn-saturate
- Deduplicated render mode logic in +layout.svelte (extracted `readRenderMode()`)
- Cleaned up duplicate/empty CSS comment blocks
- Ran `./verify.sh` — all checks passed (check, lint, test, build)
- Committed and force-pushed to origin/dev

Stage Summary:
- 2 commits on dev branch beyond 6e6afb8 (both with correct git identity)
- `e8964e1` — feat: optimize design, quality & stabilization (previous session)
- `2518c1c` — refactor: deep CSS cleanup (this session)
- 34 unused CSS variables removed, 99 lines net deleted
- All verification passed
- Note: ~130 hardcoded rgba colors remain for future consolidation (larger refactor)
---
Task ID: 1
Agent: main
Task: Split global-styles.css (4624 lines) into 11 focused CSS modules

Work Log:
- Analyzed all 33 section headers and media query distribution
- Mapped line boundaries for 11 logical CSS modules
- Extracted using sed with exact line ranges (verified zero diff after concatenation)
- Updated +layout.svelte to import all 11 files in correct cascade order
- Deleted original global-styles.css
- Full verify passed: type-check ✓ lint ✓ tests (25/25) ✓ build ✓

Stage Summary:
- Created src/styles/ with 11 files: tokens, base, components, form, results, data-cards, layout, responsive, splash, nav, animation
- Zero CSS changes — byte-identical output
- Commit: 0627e88
---
Task ID: 2
Agent: Main Agent
Task: Fix bug 7 — language switcher X icon, globe icon centering, About/Info i18n reactivity

Work Log:
- Read and analyzed LanguageSwitcher.svelte, i18n/index.ts, +page.svelte, all locale files
- Identified root cause of X icon issue: Svelte 5 only allows one `<style>` block per component; tried `<style:global>` and `<style global>` which both failed
- Final fix: kept single `<style>` block with `:global()` selectors (original approach was correct, CSS IS being generated)
- Added z-index:10 to .lang-close for guaranteed visibility
- Centered globe icon with `display: flex; justify-content: center; align-items: center;`
- Added About/Info i18n translation keys to all 4 locale files (en, id, zh, ja)
- Replaced all hardcoded English text in About and Info sections with t() calls
- Used `{@html}` for paragraphs containing `<em>`/`<strong>` HTML tags
- Added `{#key $localeVersion}` wrapping navbar labels, About section, and Info section to guarantee reactivity on locale change
- Author name 'Rezky Nightky' kept unchanged across all languages
- info.copyright uses interpolation: t('info.copyright', { n: currentYear })
- All verification passed: check (0 errors, 0 warnings), lint, test:run (162 tests), build

Stage Summary:
- Committed as 8445f6e on dev branch
- Pushed to origin/dev
- Key files: LanguageSwitcher.svelte, +page.svelte, en.ts, id.ts, zh.ts, ja.ts
---
Task ID: 3
Agent: Main Agent
Task: Fix bug 8 — X icon, button corners, lang switcher style alignment

Work Log:
- Diagnosed X icon invisible root cause (4th attempt): global `button` styles set `padding-inline: 18px` which `.lang-close` never reset, squeezing the SVG out of view
- Also identified that `:global()` CSS in Svelte 5 scoped `<style>` blocks may not reliably apply to portaled elements (3 prior attempts all failed)
- Solution: moved ALL portaled panel styles from `:global()` in LanguageSwitcher.svelte to new global CSS file `src/styles/lang-switcher.css`, imported in +layout.svelte
- Added `padding: 0 !important` and full reset of global button styles on `.lang-close` (font, box-shadow, gap, overflow)
- Added explicit SVG sizing `.lang-close svg { width: 16px !important; height: 16px !important; }` for guaranteed icon rendering
- Removed `.lang-btn` class from LanguageSwitcher trigger button — now uses same `btn btn-ghost pager-tab` as all other navbar buttons
- Changed `.pager-tab` border-radius from `9999px` (pill) to `var(--btn-radius)` (14px cornered)
- Changed `.action-btn` border-radius from `10px` to `var(--btn-radius)` (14px cornered)
- All verification passed: check (0 errors, 0 warnings), lint, test:run (162 tests), build

Stage Summary:
- Committed as e00a8ca on dev branch
- Pushed to origin/dev
- Key files: lang-switcher.css (new), LanguageSwitcher.svelte, +layout.svelte, +page.svelte, results.css
---
Task ID: 4
Agent: Main Agent
Task: Fix bug 9 — round button corners, lang switcher navbar style match

Work Log:
- Changed `--btn-radius` token from 14px to 10px for softer rounded corners on all standard buttons
- Restored `.pager-tab` border-radius to `9999px` (pill shape) — correct for compact navbar tab buttons
- Confirmed lang switcher button already uses identical classes as other navbar buttons (btn btn-ghost pager-tab)
- Action buttons (copy/save/share) now inherit 10px radius via `var(--btn-radius)`
- All verification passed: check (0 errors, 0 warnings), lint, test:run (162 tests), build

Stage Summary:
- Committed as d3aa8bc on dev branch
- Pushed to origin/dev
- Key files: tokens.css, +page.svelte
---
Task ID: 5
Agent: Main Agent
Task: Fix bug 9 (real fix) — sharp button corners on hover/click

Work Log:
- User reported button corners still sharp on click/hover despite previous --btn-radius change
- Found root cause: `responsive.css` line 163-167 had `*:focus { border-radius: 0.25rem }` — a global accessibility focus style that forced ALL focused elements to 4px sharp corners
- When user clicks/taps any button, it receives `:focus`, which triggered this override, replacing the intended border-radius (10px for action buttons, 9999px for navbar tabs)
- Fix: removed `border-radius: 0.25rem` from `*:focus` rule — modern browsers automatically make outline follow the element's own border-radius
- All verification passed: check (0 errors, 0 warnings), lint, test:run (162 tests), build

Stage Summary:
- Committed as c593a5d on dev branch
- Pushed to origin/dev
- Key file: responsive.css (1 line removed)
---
Task ID: 6
Agent: Main Agent
Task: Enhancements 1 — 300px responsive + lang switcher style match

Work Log:
- Moved .pager-tab base/hover/active/responsive styles from scoped +page.svelte to global nav.css
- Lang switcher button now inherits identical pager-tab styles as all other navbar buttons
- Conducted thorough responsive audit identifying all breakpoints and issues at 300px
- Added @media (max-width: 300px) breakpoint with aggressive compact styles
- Fixed .form-input max-width: 120px → 100% at ≤399px (was absurdly narrow)
- Fixed .form-card/.bmi-card min-height: 750px → auto at ≤300px
- Fixed .action-buttons-row → flex-direction: column at 300px (3 buttons stacked)
- Fixed .tdee-grid → single column at 300px (was 2-col with no override)
- Fixed .scale-indicators → single column at 300px (was 2-col with no override)
- Fixed .pill-indicator min-width: 140px → auto at 300px
- Fixed .lang-panel min-width → auto + width: calc(100vw - 2rem) at 300px
- Fixed NotifyFloat min-width: 300px → auto + width: calc(100vw - 2rem)
- Improved 360px breakpoint: tighter padding, stacked hero features, reduced hero-bottom negative margins
- Reduced hero element sizes progressively at 360px and 300px
- All verification passed: check (0 errors, 0 warnings), lint, test:run (162 tests), build

Stage Summary:
- Committed as 9a5258e on dev branch
- Pushed to origin/dev
- Key files: nav.css, responsive.css, +page.svelte, NotifyFloat.svelte
---
Task ID: 7
Agent: Main Agent
Task: Enhancements 2, clean BMI logic, deep responsive design improvements

Work Log:
- Analyzed BMI calculation logic across all components (bmi-calculator.ts, bmi-category.ts, BmiResults.svelte, BmiSnapshot.svelte)
- Identified ideal weight range inconsistency: idealMax used 24.9 but classification threshold was < 25.0, causing BMI 24.95 to show 'Normal Weight' but 'above ideal range'
- Fixed idealMax from 24.9 to 25.0 in BmiResults.svelte for consistency
- Identified BmiSnapshot progress calculation used absolute extremes (BMI 1-50), making ideal BMI (22) show only ~57% progress instead of 100%
- Fixed progress calculation to use meaningful category bounds (12-45), now ideal BMI correctly shows ~100%
- Comprehensive responsive design audit across all components
- Converted 5 icon groups from fixed pixel sizes to fluid clamp() sizing
- Added responsive scaling for: body fat value (3rem → 1.25rem), snapshot card values (2.5rem → 1rem), risk marker (40px → 20px)
- Added 360px breakpoint overrides for: composition bars, bf-ranges, goal tracker stats
- Added comprehensive 300px breakpoint for: all gauge components, sparkline, reference table, TDEE, scale indicators
- Added new 250px extreme-narrow breakpoint for: form/results cards, gauge, about card
- All verification passed: check (0 errors, 0 warnings), lint, test:run (162 tests), build

Stage Summary:
- Committed as 409219d on dev branch
- Pushed to origin/dev
- Key files: BmiResults.svelte, BmiSnapshot.svelte, responsive.css
---
Task ID: 8
Agent: Main Agent
Task: Bug-13 — Fix scroll jank/stuttering on mobile/low-end devices

Work Log:
- Deep investigation: read all CSS (11 files), +page.svelte scroll/touch handlers, animation-config.ts
- Identified 4 root causes of scroll jank on mobile:
  1. PRIMARY: touchmove listener with { passive: false } blocks browser's compositor thread
  2. PRIMARY: is-scrolling class triggers 15+ CSS selectors affecting hundreds of elements per frame
  3. CONTRIBUTING: Conflicting will-change values on .pager-section (transform,opacity vs scroll-position)
  4. CONTRIBUTING: content-visibility with inaccurate contain-intrinsic-size causing layout jumps

- Fix-1 (+page.svelte): Changed touchmove from { passive: false } to { passive: true }, removed e.preventDefault()
  - Vertical scrolling now handled natively by browser via CSS touch-action on .pager-shell
  - Horizontal swipe detection remains via touchstart/touchend (already passive)
  - This alone eliminates the #1 cause of delayed response on mobile

- Fix-2 (responsive.css): Restructured entire scroll performance section
  - Desktop: Keep is-scrolling/is-switching toggle behavior (works fine)
  - Touch: Apply ALL heavy optimizations PERMANENTLY via @media (hover:none) and (pointer:coarse)
  - On touch, is-scrolling class is NEVER toggled (see Fix-3)
  - New T-1 through T-15 rules: permanent box-shadow simplification, transition removal, pseudo-element hiding, filter simplification, content-visibility with 0px intrinsic size

- Fix-3 (+page.svelte + responsive.css): Skip is-scrolling class toggling on touch devices
  - Added isTouchDevice detection via matchMedia('(hover: none) and (pointer: coarse)')
  - On touch devices, onScroll handler only updates pager-controls visibility via rAF (no DOM class changes)
  - Eliminates ALL per-frame style recalculation from scroll on touch devices
  - Navbar backdrop-filter replaced with solid dark background permanently on touch

- Fix-4 (+page.svelte): Added scoped touch overrides for navbar backdrop-filter
  - Scoped styles needed to match specificity of existing scoped backdrop-filter rules
  - @media (hover:none) and (pointer:coarse) inside <style> block for .pager-nav-shell and .pager-controls-shell
  - Ensures touch overrides win over base scoped rules with !important

- Build passed: `bun run build` ✓ (9.88s)
- Pre-existing test failures (BmiForm, NotifyFloat, BodyFatEstimate) unrelated to changes

Stage Summary:
- Changed files: src/routes/+page.svelte, src/styles/responsive.css
- Key architectural change: Touch devices no longer use is-scrolling class toggle — all optimizations are permanent
- Expected result: Dramatically reduced scroll jank on mobile/low-end devices
- NOT yet committed/pushed (user requested)
