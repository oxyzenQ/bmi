# BMI Calculator

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/oxyzenQ/bmi)

A modern, space‑themed **Body Mass Index (BMI)** calculator built with **SvelteKit 2 + Svelte 5 + TypeScript**, designed for an accessible, privacy-first user experience.

- **Live**: <https://bmi-logigo.vercel.app>
- **License**: GPL‑3.0

## Highlights

- **Instant BMI results** — Category classification, health advice, and body-fat estimates.
- **Interactive radial gauge** — SVG gauge with tiered animations (ultra-smooth on high-end devices, instant on low-end).
- **BMI history tracking** — Stores up to 1 year of calculations locally; import/export with SHA-256 checksum verification.
- **Render Mode toggle** — Switch between rich visuals and basic mode for better performance or battery life.
- **Reduced motion support** — Respects `prefers-reduced-motion` system setting.
- **Privacy-first** — Zero tracking, no analytics, no external API calls. All data stays in `localStorage`.
- **Offline ready** — Service worker caches assets; works without network after first visit.
- **Fully accessible** — Keyboard navigation, ARIA labels, screen reader support, focus management.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | SvelteKit 2 (Svelte 5) |
| Language | TypeScript (strict mode) |
| Styling | Custom CSS with CSS variables |
| Icons | lucide-svelte |
| Fonts | Inter Variable + JetBrains Mono Variable (bundled locally) |
| Runtime / tooling | Bun |
| Linting | ESLint 9 + eslint-plugin-svelte |
| Formatting | Prettier + prettier-plugin-svelte |
| Testing | Vitest + @testing-library/svelte |
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
| `bun run test:run` | Run tests (Vitest) |
| `bun run build` | Production build |
| `bun run preview` | Preview production build |
| `./verify.sh` | Full verification: check → lint → test → build |

## Project Structure

```text
src/
  routes/
    +page.svelte          Main SPA page (pager navigation, BMI logic, lazy loading)
    +layout.svelte         Root layout (CosmicParticles, SplashScreen, service worker)
    +error.svelte          Custom error page (themed, accessible)
  lib/
    components/            Reusable UI components
      BmiForm.svelte         Height/weight/age input form
      BmiResults.svelte      BMI result display with health advice
      BmiRadialGauge.svelte  SVG radial gauge with tiered animations
      BmiHealthRisk.svelte   Health risk assessment panel
      BmiSnapshot.svelte     Current/best/target comparison + sparkline
      BmiHistorySparkline.svelte  SVG sparkline chart for BMI history
      BodyFatEstimate.svelte Body fat % estimate (age-adjusted)
      ReferenceTable.svelte  BMI reference table
      NotifyFloat.svelte     Modal notification (confirm/cancel flow)
      CosmicParticles.svelte Canvas particle background
      SplashScreen.svelte    Animated splash screen (disabled by default)
      __tests__/             Component tests
    ui/
      Hero.svelte            Welcome/hero section
    utils/
      performance.ts         Device capability detection (tier + reduced motion)
      history-io.ts          Export/import with SHA-256 checksum verification
  global-styles.css          Global styles, CSS variables, button system
  hooks.server.ts            Security headers (CSP, HSTS, COOP, CORP, COEP)
  service-worker.ts          Offline caching (stale-while-revalidate)
  app.html                   HTML shell with SEO meta tags

static/
  images/                    Background images
  assets/                    Logos and icons
  manifest.json              PWA manifest
  robots.txt                 Crawl policy
```

## Architecture Notes

### Pager Navigation
The app uses a single-page architecture with `{#key activeIndex}` for structural transitions between 6 sections (Welcome, Calculator, Gauge, Reference, About, Info). Navigation is via keyboard arrows, pointer swipe, wheel, navbar tabs, or prev/next buttons.

### Lazy Loading
Heavy components (BmiForm, BmiResults, BmiRadialGauge, BmiHealthRisk, BmiSnapshot, BodyFatEstimate, ReferenceTable) are loaded on-demand when their section becomes active, reducing initial bundle size.

### Svelte 5 Patterns
- `$state` / `$derived` / `$effect` used throughout (no legacy stores)
- `$derived.by()` kept **pure** — all side effects (localStorage reads) are in `$effect` blocks
- `$props()` for component props (Svelte 5 rune syntax)

### Performance Tiers
Device capabilities are detected at mount time:
- **High**: 8+ cores, 8+ GB RAM → full animations
- **Medium**: 4+ cores, 4+ GB RAM → standard animations
- **Low**: everything else → minimal animations

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

GPL‑3.0 — see [`LICENSE.md`](LICENSE.md).
