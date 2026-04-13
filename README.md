# BMI Calculator — Stellar v10.5

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/oxyzenQ/bmi)

A luxury, space-themed **Body Mass Index (BMI)** calculator built with **SvelteKit 2 + Svelte 5 (Runes) + TypeScript**, designed for an accessible, privacy-first user experience with production-grade polish.

- **Live**: <https://bmi-logigo.vercel.app>
- **License**: GPL-3.0
- **Version**: 10.5.0 (Stellar Edition)

## Highlights

- **Instant BMI results** — Category classification, health advice, BMI Prime, ideal weight range, and body-fat estimates.
- **TDEE estimator** — Total Daily Energy Expenditure with gender toggle and 5 activity levels.
- **Interactive radial gauge** — SVG gauge with tiered animations (ultra-smooth on high-end, instant on low-end).
- **BMI history sparkline** — Interactive SVG chart with tooltips and BMI zone highlighting; stores up to 1 year locally.
- **Social sharing** — Web Share API, copy-to-clipboard, and BMI result card image export (canvas).
- **Import/Export history** — JSON export with SHA-256 checksum verification for data integrity.
- **Luxury space theme** — Glassmorphism containers, cosmic particles, shooting stars, aurora effects, skeleton loading.
- **Keyboard shortcuts** — Arrow keys for navigation, Enter to calculate, Escape to clear.
- **Render Mode toggle** — Switch between rich visuals and basic mode for performance or battery.
- **Reduced motion support** — Respects `prefers-reduced-motion` and `prefers-contrast` system settings.
- **Privacy-first** — Zero tracking (no analytics pixels). All data stays in `localStorage`.
- **Offline ready** — Service worker caches assets; installable PWA with offline badge.
- **Fully accessible** — ARIA labels, roles, focus trap, keyboard navigation, screen reader support.
- **Responsive** — Aggressive breakpoints down to 320px; anti-zoom protection; font clamps.
- **Web Vitals** — LCP, CLS, INP monitoring; performance tier auto-detection.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | SvelteKit 2.57 (Svelte 5.55 Runes) |
| Language | TypeScript (strict mode) |
| Styling | Modular CSS with CSS custom properties (11 files in `src/styles/`) |
| Icons | lucide-svelte |
| Fonts | Inter Variable + JetBrains Mono Variable (bundled locally) |
| Runtime / tooling | Bun |
| Linting | ESLint 9 + eslint-plugin-svelte |
| Formatting | Prettier + prettier-plugin-svelte |
| Testing | Vitest + @testing-library/svelte (25 tests) |
| Analytics | Vercel Analytics + Speed Insights |
| Deployment | Vercel (Node.js 22 runtime) |

## Quick Start

```bash
bun install
bun run dev
```

Open the local URL printed in your terminal (default: `http://localhost:5173`).

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start dev server with HMR |
| `bun run check` | Type-check via svelte-check |
| `bun run lint` | Lint with ESLint |
| `bun run test:run` | Run tests (Vitest, 25 tests) |
| `bun run build` | Production build |
| `bun run preview` | Preview production build |
| `./verify.sh` | Full verification: check -> lint -> test -> build |

## Project Structure

```text
src/
  routes/
    +page.svelte          Main SPA page (pager navigation, BMI logic, lazy loading)
    +layout.svelte         Root layout (CosmicParticles, SplashScreen, PWA install)
    +error.svelte          Custom error page (themed, accessible)
  styles/                  Modular CSS (split from monolithic global-styles.css)
    tokens.css             Design tokens: fonts, all CSS custom properties
    base.css               Global resets, typography, utility classes
    components.css         Glassmorphism containers, button system, hero
    form.css               BMI form layout, inputs, validation
    results.css            BMI results card, share/action buttons, empty states
    data-cards.css         Stat grid, TDEE, radial gauge, reference table
    layout.css             Keyboard shortcuts, cosmic particles, footer
    responsive.css         Responsive breakpoints, reduced motion support
    splash.css             Splash screen, performance tier optimizations
    nav.css                Pager / bottom navbar
    animation.css          Skeleton loading, shooting stars, haptic feedback
  lib/
    components/            Reusable UI components
      BmiForm.svelte         Height/weight/age/gender/activity input form
      BmiResults.svelte      BMI result display, health advice, share buttons
      BmiRadialGauge.svelte  SVG radial gauge with tiered animations
      BmiHealthRisk.svelte   Health risk assessment panel
      BmiSnapshot.svelte     Current/best/target comparison + sparkline
      BmiHistorySparkline.svelte  Interactive SVG sparkline chart
      BodyFatEstimate.svelte Body fat % estimate (age-adjusted)
      ReferenceTable.svelte  BMI reference table
      NotifyFloat.svelte     Toast notification (confirm/cancel flow)
      CosmicParticles.svelte Canvas particle background
      SplashScreen.svelte    Animated splash screen (disabled by default)
      __tests__/             Component tests
    ui/
      Hero.svelte            Welcome/hero section
    utils/
      performance.ts         Device capability detection (tier + reduced motion)
      history-io.ts          Export/import with SHA-256 checksum verification
      share.ts               Web Share API, clipboard, formatted BMI text
      share-image.ts         Canvas-based BMI result card image generation
  hooks.server.ts            Security headers (CSP, HSTS, COOP, CORP, COEP)
  service-worker.ts          Offline caching (stale-while-revalidate)
  app.html                   HTML shell with SEO meta tags

static/
  images/                    Background images
  assets/                    Logos, icons, screenshots
  manifest.json              PWA manifest (v3)
  robots.txt                 Crawl policy

.github/workflows/           CI/CD pipelines
  ci.yml                     Quality checks (type-check, lint, test, build)
  auto-update.yml            Daily dependency updates
  codeql.yml                 Security scanning (CodeQL)
  release.yml                GitHub release publisher
  self-heal-actions.yml      Automated action version bumping
```

## Architecture Notes

### Pager Navigation
Single-page architecture with `{#key activeIndex}` for structural transitions between 6 sections (Welcome, Calculator, Results/Gauge, History, Reference, About). Navigation via keyboard arrows, pointer swipe, wheel, navbar tabs, or prev/next buttons.

### Lazy Loading
Heavy components (BmiForm, BmiResults, BmiRadialGauge, BmiHealthRisk, BmiSnapshot, BodyFatEstimate, ReferenceTable) are loaded on-demand when their section becomes active, reducing initial bundle size.

### Svelte 5 Runes API
- `$state` / `$derived` / `$effect` used throughout (no legacy stores)
- `$derived.by()` kept pure; all side effects (localStorage reads) are in `$effect` blocks
- `$props()` for component props (Svelte 5 rune syntax)
- `$bindable()` for two-way bound props

### CSS Architecture
Styles split into 11 focused modules under `src/styles/`, imported in cascade order in `+layout.svelte`. Design tokens (all CSS custom properties) load first in `tokens.css`. Responsive breakpoints consolidated in `responsive.css`.

### Performance Tiers
Device capabilities detected at mount time:
- **High**: 8+ cores, 8+ GB RAM, 4G -> full animations
- **Medium**: 4+ cores, 4+ GB RAM -> standard animations
- **Low**: everything else -> minimal animations

### Data Persistence
All user data stored in `localStorage` under namespaced keys:
- `bmi.history` — BMI calculation history (max 1 year)
- `bmi.unitSystem` — metric/imperial preference
- `bmi.renderMode` — render quality preference
- Cross-tab sync via `StorageEvent`

## Security

- **CSP**: Strict Content-Security-Policy in production (no inline scripts)
- **HSTS**: Preload-ready (max-age=63072000, includeSubDomains)
- **COOP/CORP/COEP**: Cross-origin isolation with `credentialless`
- **Permissions-Policy**: Disables camera, mic, geolocation, etc.
- **isSecureContext check**: Health data only stored in secure contexts
- **Import validation**: SHA-256 checksum verification on all data imports

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make changes, run `./verify.sh` before committing
4. Push and open a PR

## License

GPL-3.0 — see [`LICENSE.md`](LICENSE.md).
