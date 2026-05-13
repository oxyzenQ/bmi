<p align="center">
  <img src="static/assets/bmi-logigo-v2.png" alt="BMI Calculator — Stellar Edition" width="280" />
</p>

<h1 align="center">BMI Calculator — Stellar v18.0</h1>

<p align="center">
  A luxury, space-themed <strong>Body Mass Index (BMI)</strong> calculator built with <strong>SvelteKit 2 + Svelte 5 (Runes) + TypeScript</strong>, designed for an accessible, privacy-first user experience with production-grade polish.
</p>

<p align="center">
  <a href="https://bmi-logigo.vercel.app"><strong>Live Demo</strong></a> ·
  <a href="LICENSE.md">GPL-3.0</a> ·
  v18.0.0 (Stellar Edition)
</p>

---

## Highlights

- **Instant BMI results** — Category classification, health advice, BMI Prime, ideal weight range, and body-fat estimates.
- **TDEE estimator** — Total Daily Energy Expenditure with gender toggle and 5 activity levels.
- **Goal tracker** — Set target BMI, track progress with current/best/target comparison and sparkline chart.
- **Interactive radial gauge** — SVG gauge with tiered animations (ultra-smooth on high-end, instant on low-end).
- **BMI history sparkline** — Interactive SVG chart with tooltips and BMI zone highlighting; stores up to 1 year locally.
- **Encrypted backup** — AES-256-GCM encryption with Argon2id key derivation (32 MB memory, 2 iterations). SHA-256 checksum for tamper detection. Import/export with passphrase protection.
- **Social sharing** — Web Share API, copy-to-clipboard, and BMI result card image export (canvas).
- **Import/Export history** — JSON export with SHA-256 checksum verification for data integrity.
- **Multi-language (i18n)** — English, Indonesian (Bahasa), Japanese, Chinese. Floating language switcher panel.
- **Luxury space theme** — Glassmorphism containers with `@supports` progressive enhancement, cosmic particles, shooting stars, aurora effects, skeleton loading.
- **Keyboard shortcuts** — Arrow keys for navigation, Enter to calculate, Escape to clear.
- **Drag & drop import** — Drop a JSON backup file directly onto the import zone for quick restore.
- **Encryption badge** — Visual trust indicator showing AES-256-GCM encryption status on export.
- **Export summary** — Preview card showing record count, encryption method, and format version before export.
- **Strong warning UX** — Prominent warning block for destructive actions (passphrase loss, data override).
- **Progress indicators** — Indeterminate progress bar during encryption/decryption operations.
- **Render Mode toggle** — Switch between rich visuals and basic mode for performance or battery.
- **Reduced motion support** — Respects `prefers-reduced-motion` and `prefers-contrast` system settings (Bug #19 fix: reduced motion disables animations, not visual effects like backdrop-filter).
- **Privacy-first** — Zero tracking (no analytics pixels). All data stays in `localStorage`. No passphrase stored for encrypted backups.
- **Offline ready** — Service worker caches assets; installable PWA with offline badge.
- **Fully accessible** — ARIA labels, roles, focus trap, keyboard navigation, screen reader support.
- **Responsive** — Aggressive breakpoints down to 320px; anti-zoom protection; font clamps. Consistent glassmorphism across desktop and mobile (Bug #19 fix).
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
    +layout.svelte         Root layout (CosmicParticles, PWA install, Web Vitals)
    +layout.ts             Root layout loader (locale detection, security)
    +error.svelte          Custom error page (themed, accessible)
  styles/                  Modular CSS (11 files, imported in cascade order)
    tokens.css             Design tokens: fonts, opacity system, glassmorphism tokens
    base.css               Global resets, typography, utility classes
    components.css         Glassmorphism containers (@supports progressive enhancement)
    form.css               BMI form layout, inputs, validation, pill indicators
    results.css            BMI results card, share/action buttons, empty states
    data-cards.css         Stat grid, TDEE, radial gauge, reference table
    layout.css             About section, cosmic particles, footer
    responsive.css         Responsive breakpoints, mobile performance (T-rules)
    nav.css                Pager / bottom navbar, performance tier optimizations
    lang-switcher.css      Language switcher floating panel (portaled to body)
    animation.css          Skeleton loading, shooting stars, haptic feedback, progress bar, encryption badge, empty states, drag & drop zone
  lib/
    components/            Reusable UI components
      BmiForm.svelte         Height/weight/age/gender/activity input form
      BmiResults.svelte      BMI result display, health advice, share buttons
      BmiRadialGauge.svelte  SVG radial gauge with tiered animations
      BmiHealthRisk.svelte   Health risk assessment panel
      BmiSnapshot.svelte     Current/best/target comparison + sparkline
      BmiGoalTracker.svelte  Goal setting and progress tracking
      BmiHistorySparkline.svelte  Interactive SVG sparkline chart
      BodyFatEstimate.svelte Body fat % estimate (age-adjusted)
      ReferenceTable.svelte  BMI reference table
      NotifyFloat.svelte     Toast notification (confirm/cancel flow)
      FeedbackModal.svelte   Feedback modal (blocking, portal-rendered)
      EncryptionModal.svelte Encryption passphrase modal for backup
      BackupStatus.svelte    Backup operation status display
      LanguageSwitcher.svelte Floating language switcher (portal to body)
      CosmicParticles.svelte Canvas particle background (purple rain)
      __tests__/             Component tests (Vitest)
    ui/
      Hero.svelte            Welcome/hero section
    i18n/                    Internationalization system
      index.ts               Translation loader and locale management
      types.ts               Translation type definitions
      locales/
        en.ts                English translations
        id.ts                Indonesian (Bahasa) translations
        ja.ts                Japanese translations
        zh.ts                Chinese translations
    utils/
      bmi-calculator.ts     Core BMI calculation engine
      bmi-category.ts       BMI category classification + color mapping
      storage.ts            Centralized localStorage/IndexedDB access layer
      db.ts                 IndexedDB wrapper for structured data
      history-io.ts         Export/import with SHA-256 checksum verification
      backup.ts             Encrypted backup (AES-GCM + Argon2id/PBKDF2)
      crypto.ts             Encryption utilities (AES-GCM, Argon2id, PBKDF2 key derivation, SHA-256 checksum)
      performance.ts        Device capability detection (tier + reduced motion)
      share.ts              Web Share API, clipboard, formatted BMI text
      share-image.ts        Canvas-based BMI result card image generation
      animation-config.ts   Animation timing and easing configuration
      lazy-load.ts          Dynamic component lazy loading
      __tests__/            Unit tests
  hooks.server.ts            Security headers (CSP, HSTS, COOP, CORP, COEP)
  service-worker.ts          Offline caching (stale-while-revalidate)
  app.html                   HTML shell with SEO meta tags

scripts/
  bmi-update-version.ts      Version bumping script

static/
  images/                    Background images (blackhole, spaceship, space)
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
Heavy components (BmiForm, BmiResults, BmiRadialGauge, BmiHealthRisk, BmiSnapshot, BmiGoalTracker, BodyFatEstimate, ReferenceTable) are loaded on-demand when their section becomes active, reducing initial bundle size. Uses `lazy-load.ts` utility for dynamic imports.

### Svelte 5 Runes API
- `$state` / `$derived` / `$effect` used throughout (no legacy stores)
- `$derived.by()` kept pure; all side effects (localStorage reads) are in `$effect` blocks
- `$props()` for component props (Svelte 5 rune syntax)
- `$bindable()` for two-way bound props

### CSS Architecture
Styles split into 11 focused modules under `src/styles/`, imported in cascade order in `+layout.svelte`:

1. **tokens.css** — All CSS custom properties (colors, opacity tokens, spacing, elevation, micro-delay, glassmorphism tokens)
2. **base.css** — Global resets, typography, utility classes
3. **components.css** — Glassmorphism containers with `@supports` progressive enhancement
4. **form.css** — BMI form layout, inputs, validation
5. **results.css** — BMI results card, share/action buttons
6. **data-cards.css** — Stat grid, TDEE, radial gauge, reference table
7. **layout.css** — About section, cosmic particles, footer
8. **responsive.css** — Responsive breakpoints + mobile performance optimizations (T-rules)
9. **nav.css** — Pager navigation, performance tier optimizations
10. **lang-switcher.css** — Language switcher panel (portaled to body)
11. **animation.css** — Skeleton loading, shooting stars, micro-interactions

### Glassmorphism System (Bug #19 Fix)
All glass containers use a consistent progressive enhancement pattern:

```
Fallback (no backdrop-filter support):  rgba(10, 2, 28, 0.82) — solid, dark
Enhanced (backdrop-filter supported):   rgba(10, 2, 28, 0.55) + blur(8px) saturate(140%) — glass
```

Glass design tokens are centralized in `tokens.css` (`--glass-bg-*`, `--glass-blur-*`, `--glass-saturation-*`). Mobile touch devices (`hover: none`) use slightly stronger backgrounds with reduced blur for GPU performance, but maintain visual consistency with desktop. The `@supports` feature query ensures containers never appear transparent, even on browsers that don't support `backdrop-filter`.

### Encryption System
Backup data is encrypted using a layered security architecture:

- **Key derivation (primary)**: Argon2id (RFC 9106) — memory-hard KDF, resistant to GPU/ASIC attacks
  - Memory: 32 MB (32,768 KiB), Time cost: 2, Parallelism: 1 (mobile-safe), Output: 256-bit key
- **Key derivation (legacy)**: PBKDF2 with SHA-256, 600,000 iterations — still supported for older exports
- **Encryption cipher**: AES-256-GCM with random 12-byte IV
- **Integrity**: SHA-256 checksum of plaintext (constant-time comparison) — explicit tamper detection
- **Hint**: Stored in `localStorage` only, never in the encrypted file
- **No passphrase storage**: Users must remember their passphrase — no recovery mechanism
- **Format**: `bmi-encrypted-v1` with `cipher`, `kdf`, and `kdfParams` metadata

#### Encrypted Export Structure
```json
{
  "format": "bmi-encrypted-v1",
  "cipher": "aes-256-gcm",
  "kdf": "argon2id",
  "kdfParams": { "type": 2, "mem": 32768, "time": 2, "parallelism": 1, "hashLen": 32 },
  "salt": "<base64>", "iv": "<base64>", "data": "<base64 ciphertext>",
  "meta": { "exportedAt": "...", "recordCount": 42, "version": 3, "checksum": "<SHA-256>" }
}
```

### Performance Tiers
Device capabilities detected at mount time via `performance.ts`:
- **High**: 8+ cores, 8+ GB RAM, 4G -> full animations, contain optimizations
- **Medium**: 4+ cores, 4+ GB RAM -> standard animations, style containment
- **Low**: everything else -> minimal animations, simplified shadows, no backdrop-filter

### Mobile Performance Optimizations (responsive.css T-rules)
The `@media (hover: none) and (pointer: coarse)` block applies permanent GPU optimizations on touch devices:
- **T-1/T-1b**: Simplified body filters and removed gradient overlay
- **T-2**: Containment on scroll container
- **T-3**: Simplified box-shadows, removed transitions on interactive elements
- **T-5**: Removed shine sweep pseudo-elements
- **T-11**: Lightweight blur on navbars
- **T-GLASS**: Consistent glassmorphism treatment for all containers
- **T-GLASS-CALC/HERO/RESULTS**: Per-container glass tuning for visual hierarchy

### Data Persistence
All user data stored in `localStorage` under namespaced keys (via centralized `storage.ts`):
- `bmi.history` — BMI calculation history (max 1 year)
- `bmi.unitSystem` — metric/imperial preference
- `bmi.renderMode` — render quality preference
- Cross-tab sync via `StorageEvent`

### Internationalization (i18n)
4 languages supported: English, Indonesian, Japanese, Chinese. Translation files in `src/lib/i18n/locales/`. Language switcher is portaled to `document.body` via `use:portal` action. Locale detection from browser `navigator.language` on first visit.

## Security

- **CSP**: Strict Content-Security-Policy in production (no inline scripts)
- **HSTS**: Preload-ready (max-age=63072000, includeSubDomains)
- **COOP/CORP/COEP**: Cross-origin isolation with `credentialless`
- **Permissions-Policy**: Disables camera, mic, geolocation, etc.
- **isSecureContext check**: Health data only stored in secure contexts
- **Import validation**: HMAC-SHA256 signature + SHA-256 checksum on all data imports
- **Tamper detection**: Explicit checksum verification distinguishes tampered files from wrong passphrases
- **Encryption**: AES-256-GCM with Argon2id key derivation (PBKDF2 legacy support)

## Known Constraints

- Some older mobile browsers (Android Chrome < 76, older WebViews) may not support `backdrop-filter`. The `@supports` progressive enhancement ensures these fall back to a strong opaque background instead of appearing transparent.
- `prefers-reduced-motion` disables animations and transitions but preserves visual effects (glassmorphism, colors, shadows) for consistent appearance.
- Performance tier "low" disables `backdrop-filter` for GPU savings but maintains strong semi-transparent backgrounds.
- Encrypted backups require the user to remember their passphrase — there is no recovery mechanism (by design, for privacy).

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make changes, run `./verify.sh` before committing
4. Push and open a PR

## License

GPL-3.0 — see [`LICENSE.md`](LICENSE.md).
