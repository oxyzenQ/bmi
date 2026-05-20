<div align="center">
  <img src="static/assets/new_bmi_logo_2026.webp" alt="BMI Stellar" width="240" />

  <h1>BMI Stellar</h1>

  <p><strong>Privacy-first BMI, TDEE, body-fat, and progress tracking — built with SvelteKit, Svelte 5, TypeScript, and Bun.</strong></p>

  <p>
    <a href="https://bmi-stellar.vercel.app"><img src="https://img.shields.io/badge/Live_Demo-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" /></a>
    <a href="LICENSE.md"><img src="https://img.shields.io/badge/License-GPL_3.0-blue.svg?style=for-the-badge" alt="License: GPL-3.0" /></a>
    <a href="https://github.com/sveltejs/svelte"><img src="https://img.shields.io/badge/Svelte_5-FF3E00?style=for-the-badge&logo=svelte&logoColor=white" alt="Svelte 5" /></a>
    <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white" alt="Bun" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  </p>

  <p>
    <a href="https://ko-fi.com/rezky">
      <img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support me on Ko-fi" />
    </a>
  </p>
</div>

---

## Table of Contents

- [What It Does](#-what-it-does)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Core Scripts](#-core-scripts)
- [Project Layout](#-project-layout)
- [Versioning](#-versioning)
- [Security Model](#-security-model)
- [Support](#-support)
- [License](#-license)

---

## What It Does

BMI Stellar is a comprehensive, privacy-first health metrics application that runs entirely in your browser. No accounts, no servers, no tracking — your data never leaves your device unless you explicitly export it.

- **Comprehensive Metrics:** Calculates BMI, category classification, BMI Prime, ideal weight range, and personalized health guidance — all computed locally with zero network calls.
- **TDEE Estimation:** Total Daily Energy Expenditure estimator with gender-aware inputs, five activity levels, and context-aware kcal/day display.
- **Body-Fat Estimation:** Gender-specific body-fat percentage estimation using Navy and BMI-based methods.
- **Progress Tracking:** BMI history with interactive sparkline charts, goal tracking against target weight, and trend indicators.
- **Premium Share Cards:** Generates 1080x1080 Canvas-rendered PNG cards with brand gradients, mini gauge, and i18n-safe text for Instagram Story, X, or direct download.
- **Encrypted Backups:** AES-256-GCM encryption with Argon2id key derivation, SHA-256 integrity checksums, and zero-knowledge passphrase verification. Legacy PBKDF2 imports supported.
- **Multilingual:** Native support for English, Indonesian, Japanese, and Chinese with universal unit symbols (kg, cm, lb, in, kcal) across all locales.
- **Offline PWA:** Installable Progressive Web App with service worker, offline support, and Web Vitals monitoring.
- **Accessibility First:** WCAG 2.1 compliant focus-visible indicators, ARIA dialog/radiogroup patterns, keyboard navigation, and `prefers-reduced-motion` support.
- **Performance Adaptive:** Three-tier animation system (high/medium/low) that adjusts to device capability, with simplified visual effects on touch devices during heavy scrolling.

> [!TIP]
> For the full architectural deep dive — CSS cascade, encryption internals, pager navigation, animation tiers — see [Furthermore Documentation](docs/furthermore.md).

## Tech Stack

| Layer          | Technology                                                     |
| -------------- | -------------------------------------------------------------- |
| **Framework**  | SvelteKit 2 + Svelte 5 Runes (`$state`, `$derived`, `$effect`) |
| **Language**   | TypeScript (strict mode)                                       |
| **Runtime**    | Bun                                                            |
| **Styling**    | 17-file modular CSS cascade with custom properties             |
| **Encryption** | `@noble/hashes` (Argon2id, pure JS, no WASM) + Web Crypto API  |
| **Icons**      | Lucide Svelte                                                  |
| **Fonts**      | Inter Variable + JetBrains Mono Variable                       |
| **Tests**      | Vitest + Testing Library (456 tests, 30 suites)                |
| **Deployment** | Vercel (adapter-vercel)                                        |

## Quick Start

```bash
# Clone the repository
git clone https://github.com/oxyzenQ/bmi.git
cd bmi

# Install dependencies
bun install

# Start the development server (with HMR)
bun run dev
```

Open the local URL printed in your terminal (usually `http://localhost:5173`).

## Core Scripts

| Command                                          | Description                                               |
| ------------------------------------------------ | --------------------------------------------------------- |
| `bun run dev`                                    | Start local dev server with HMR                           |
| `bun run check`                                  | Svelte and TypeScript diagnostics                         |
| `bun run lint`                                   | ESLint with Svelte plugin                                 |
| `bun run test`                                   | Vitest in watch mode                                      |
| `bun run test:run`                               | Single test run                                           |
| `bun run test:ci`                                | CI-friendly test run (forked, 2 workers)                  |
| `bun run test:fast`                              | Fast test run (excludes crypto/history-io)                |
| `bun run build`                                  | Production build                                          |
| `bun run format`                                 | Prettier auto-format                                      |
| `bun run format:check`                           | Prettier check (no write)                                 |
| `bun run verify`                                 | Full gate: format:check + check + lint + test:run + build |
| `bun run bmi-update-version <version>`           | Sync version across all canonical files                   |
| `bun run bmi-update-version --dry-run <version>` | Preview a version update without writing                  |

## Project Layout

```txt
src/
├── lib/
│   ├── components/          # UI components (forms, modals, gauges, charts)
│   │   ├── sections/        # Page-level sections (Settings, About)
│   │   ├── form/            # Form sub-components (inputs, toggle, actions)
│   │   ├── encryption/      # Encryption modal sub-components
│   │   └── page/            # Pager controls and gauge section
│   ├── utils/               # Core logic (BMI, crypto, storage, sharing, scroll)
│   ├── i18n/                # Locale engine + 4 translation dictionaries
│   ├── stores/              # PWA install/update state
│   ├── actions/             # Svelte actions (portal)
│   ├── types/               # TypeScript type definitions
│   └── ui/                  # Shared UI primitives (Hero)
├── styles/                  # 17-file modular CSS cascade
├── routes/                  # SvelteKit pages (+layout, +page, +error)
├── service-worker.ts        # PWA service worker
scripts/                     # Maintenance scripts (bmi-update-version)
docs/                        # Long-form documentation (furthermore.md)
.github/workflows/           # CI, release, security, and maintenance workflows
```

## Versioning

The canonical version lives in `package.json` and propagates through `README.md`, `LICENSE.md`, and backup metadata via `scripts/bmi-update-version.ts`.

> [!IMPORTANT]
> Always use `bun run bmi-update-version <version>` to update the version. This ensures all canonical files remain perfectly synchronized. Never edit version strings manually.

Release tags follow the format `Stellar-v<major>.<minor>` (e.g., `Stellar-v20.0`).

## Security Model

- **Local First:** All health data remains on your device. No tracking pixels, no external telemetry, no server-side storage.
- **AES-256-GCM Encryption:** All backups use authenticated encryption with a random 12-byte IV.
- **Argon2id Key Derivation:** OWASP-recommended KDF (64 MiB memory, 3 iterations) — highly resistant to GPU cracking.
- **Zero Knowledge:** Passphrases are never stored, cached, or transmitted. Verification uses encrypted verifier ciphertext only.
- **Legacy Support:** PBKDF2 (600,000 iterations, SHA-256) backup imports remain supported for older exports.
- **Integrity:** SHA-256 checksums verify backup data against tampering.

See [SECURITY.md](SECURITY.md) for the full security policy and vulnerability reporting process.

## Support

BMI Stellar is an open-source passion project built and maintained independently.

If this project has helped you, inspired your own application, or saved you development time, consider supporting future maintenance:

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/rezky)

_Support is completely optional, and the project will forever remain open-source._

## License

Distributed under the GPL-3.0 License. See [LICENSE.md](LICENSE.md) for more information.
