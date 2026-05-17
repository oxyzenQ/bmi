<p align="center">
  <img src="static/assets/new_bmi_logo_2026.webp" alt="BMI Stellar" width="240" />
</p>

<h1 align="center">BMI Stellar v19.0</h1>

<p align="center">
  Privacy-first BMI, TDEE, body-fat, and progress tracking app built with SvelteKit, Svelte 5, TypeScript, and Bun.
</p>

<p align="center">
  <a href="https://bmi-stellar.vercel.app"><strong>Live Demo</strong></a> |
  <a href="LICENSE.md">GPL-3.0</a> |
  <a href="docs/furthermore.md">Further Docs</a>
</p>

---

## What It Does

- Calculates BMI, category, BMI Prime, ideal weight range, and health guidance.
- Estimates TDEE and body fat with gender-aware inputs.
- Tracks BMI history, goal progress, snapshots, and trend charts locally.
- Exports/imports encrypted backups with AES-256-GCM and Argon2id.
- Supports English, Indonesian, Japanese, and Chinese.
- Runs as an installable offline-ready PWA.
- Uses compact responsive containers and touch-safe mobile scrolling.

For furthermore read this file: [docs/furthermore.md](docs/furthermore.md).

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | SvelteKit 2 + Svelte 5 Runes |
| Language | TypeScript |
| Runtime | Bun |
| Styling | Modular CSS custom properties |
| Tests | Vitest + Testing Library |
| Deployment | Vercel |

## Quick Start

```bash
bun install
bun run dev
```

Open the local URL printed in your terminal, usually `http://localhost:5173`.

## Core Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start local dev server |
| `bun run check` | Svelte and TypeScript diagnostics |
| `bun run lint` | ESLint |
| `bun run test:ci` | CI-friendly test run |
| `bun run build` | Production build |
| `bun run verify` | check + lint + test + build |
| `bun run bmi-update-version <version>` | Sync app version across canonical files |
| `bun run bmi-update-version --dry-run <version>` | Preview a version update |

## Project Layout

```txt
src/lib/components/     UI components and floating windows
src/lib/components/sections/
                        Page-level sections
src/lib/utils/          BMI, storage, crypto, share image, version utilities
src/lib/i18n/           Locale system and translation files
src/styles/             Modular CSS layers
scripts/                Maintenance scripts
docs/                   Long-form documentation
.github/workflows/      CI, release, security, and maintenance workflows
```

## Versioning

The canonical version starts in `package.json`. Use `scripts/bmi-update-version.ts` through the npm scripts above so `package.json`, backup metadata, README, and LICENSE stay aligned.

## Security Model

- Health data stays local.
- Backups use AES-256-GCM encryption.
- Argon2id is the primary key derivation function.
- PBKDF2 backup imports remain supported for older exports.
- Passphrases are never stored.

## License

GPL-3.0. See [LICENSE.md](LICENSE.md).
