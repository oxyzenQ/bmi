# BMI Stellar Further Documentation

This file holds the long-form notes that used to live in README.md. Keep README.md short and use this document for deeper architecture, security, and maintenance details.

## Highlights

- Instant BMI results with category classification, health advice, BMI Prime, ideal weight range, and body-fat estimates.
- TDEE estimator with gender toggle and five activity levels.
- Goal tracker with current, best, and target comparison.
- Interactive radial gauge and BMI history sparkline.
- Passphrase-encrypted backup with AES-256-GCM, Argon2id, and checksum validation.
- Multi-language UI: English, Indonesian, Japanese, and Chinese.
- Touch-device mobile scroll policy with simplified heavy visual effects during scroll.
- Keyboard shortcuts, drag-and-drop import, offline PWA support, and Web Vitals monitoring.

## CSS Architecture

Styles are split into focused modules under `src/styles/` and imported in cascade order from `src/routes/+layout.svelte`.

| File | Responsibility |
|---|---|
| `tokens.css` | Fonts, colors, spacing, radius, timing, z-index, glass, and semantic tokens |
| `base.css` | Global reset, typography, utility classes |
| `icons.css` | Icon sizing and semantic icon colors |
| `components.css` | Central container surfaces, button system, hero base styles |
| `form.css` | BMI form layout, inputs, validation |
| `results.css` | BMI results card, share/action buttons, empty states |
| `data-cards.css` | Stat grid, TDEE, radial gauge, reference table |
| `layout.css` | About section, wallpaper-related layout, footer |
| `responsive-base.css` | Base responsive contracts and fluid media |
| `responsive-width.css` | Width breakpoints and surface sizing |
| `responsive-height.css` | Height-based compression rules |
| `responsive-backdrop.css` | No-backdrop fallback for unsupported browsers |
| `nav.css` | Top/bottom pager navigation |
| `lang-switcher.css` | Floating language switcher panel |
| `animation.css` | Skeleton loading and micro-interactions |
| `responsive-mobile-perf.css` | Touch-device scroll/tap/rendering overrides |
| `responsive-content.css` | Final correction layer for widths, rhythm, radius, and shadow policy |

## Pager Navigation

The app is a single-page experience with six sections. Navigation is available through:

- Top tabs
- Bottom previous/next controls
- Keyboard arrows
- Hash routing
- Wheel navigation on desktop
- Strict horizontal swipe on touch devices

Mobile vertical scroll stays native. Horizontal navigation is intentionally strict so diagonal or vertical scrolling does not accidentally change pages.

## Lazy Loading

Heavy components are loaded on demand when their section becomes active. This keeps the first screen lighter while preserving the richer calculator, chart, and reference views.

Main lazy-loaded areas include:

- BMI form/results
- Radial gauge
- Health risk and snapshot cards
- Goal tracker
- Body-fat estimate
- Reference table

## Data Persistence

Data is stored locally through centralized storage utilities.

| Key | Purpose |
|---|---|
| `bmi.history` | BMI calculation history |
| `bmi.unitSystem` | Metric/imperial preference |
| `bmi.renderMode` | Render quality preference |

The app uses cross-tab synchronization where appropriate and keeps health data client-side.

## Encryption System

Backup encryption uses:

- AES-256-GCM with a random 12-byte IV
- Argon2id as the primary key derivation function
- PBKDF2 SHA-256 support for older export imports
- SHA-256 checksum verification for tamper detection
- No passphrase storage

The user must remember the passphrase. There is no recovery mechanism by design.

## Internationalization

Translation files live in `src/lib/i18n/locales/`.

Supported languages:

- English
- Indonesian
- Japanese
- Chinese

The language switcher is portaled to `document.body` so it can float above the pager layout without being clipped by section containers.

## Share Image

`src/lib/utils/share-image.ts` generates the BMI share card. Current design goals:

- PNG-only output
- 1080 x 1080 canvas
- Premium black/minimal card
- Brand gradient title
- Dynamic app version from the canonical app-version utility
- i18n-safe title/share metadata

## Workflows

GitHub workflows live in `.github/workflows/`.

| Workflow | Purpose |
|---|---|
| `ci.yml` | Type-check, lint, test, and build |
| `codeql.yml` | Security analysis |
| `release.yml` | Tagged release artifact publishing |
| `auto-update.yml` | Dependency update PR automation |
| `self-heal-actions.yml` | Optional patch/minor action version updater |

## Release Notes

Use the version script instead of manually editing version strings.

```bash
bun run bmi-update-version --dry-run 19.1.0
bun run bmi-update-version 19.1.0
bun run check
bun run build
```

Release tags use the visible version format:

```txt
Stellar-v19.0
Stellar-v19.1
```

## Known Constraints

- Older browsers without `backdrop-filter` use opaque fallbacks.
- Touch devices intentionally use simpler dark transparent surfaces in heavy scroll areas.
- Reduced motion disables animations and transitions while preserving visual styling.
- Encrypted backups cannot be recovered without the passphrase.
