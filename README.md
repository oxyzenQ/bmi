<div align="center">
  <img src="static/assets/new_bmi_logo_2026.webp" alt="BMI Stellar" width="240" />

  <h1>BMI Stellar v20.0</h1>

  <p><strong>Privacy-first BMI, TDEE, body-fat, and progress tracking app built with SvelteKit, Svelte 5, TypeScript, and Bun.</strong></p>

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

## 📑 Table of Contents

- [✨ What It Does](#-what-it-does)
- [🛠️ Tech Stack](#️-tech-stack)
- [🚀 Quick Start](#-quick-start)
- [📜 Core Scripts](#-core-scripts)
- [📂 Project Layout](#-project-layout)
- [🔖 Versioning](#-versioning)
- [🔒 Security Model](#-security-model)
- [❤️ Support](#️-support)
- [⚖️ License](#️-license)

---

## ✨ What It Does

- **Comprehensive Metrics:** Calculates BMI, category, BMI Prime, ideal weight range, and health guidance.
- **Advanced Estimations:** Estimates TDEE and body fat with gender-aware inputs.
- **Progress Tracking:** Tracks BMI history, goal progress, snapshots, and trend charts locally.
- **Secure Backups:** Exports/imports encrypted backups with AES-256-GCM and Argon2id.
- **Multilingual Support:** Supports English, Indonesian, Japanese, and Chinese natively.
- **Modern PWA:** Runs as an installable offline-ready Progressive Web App.
- **Premium UI/UX:** Uses compact responsive containers, glassmorphism aesthetics, and touch-safe mobile scrolling.

> [!TIP]
> For a deep dive into architecture and design constraints, please refer to our [Furthermore Documentation](docs/furthermore.md).

## 🛠️ Tech Stack

| Layer          | Technology                    |
| -------------- | ----------------------------- |
| **Framework**  | SvelteKit 2 + Svelte 5 Runes  |
| **Language**   | TypeScript                    |
| **Runtime**    | Bun                           |
| **Styling**    | Modular CSS custom properties |
| **Tests**      | Vitest + Testing Library      |
| **Deployment** | Vercel                        |

## 🚀 Quick Start

Get the project running locally in seconds using Bun:

```bash
bun install
bun run dev
```

Open the local URL printed in your terminal (usually `http://localhost:5173`).

## 📜 Core Scripts

| Command                                          | Description                             |
| ------------------------------------------------ | --------------------------------------- |
| `bun run dev`                                    | Start local dev server                  |
| `bun run check`                                  | Svelte and TypeScript diagnostics       |
| `bun run lint`                                   | ESLint                                  |
| `bun run test:ci`                                | CI-friendly test run                    |
| `bun run build`                                  | Production build                        |
| `bun run verify`                                 | run check + lint + test + build         |
| `bun run bmi-update-version <version>`           | Sync app version across canonical files |
| `bun run bmi-update-version --dry-run <version>` | Preview a version update                |

## 📂 Project Layout

```txt
src/lib/components/          # UI components and floating windows
src/lib/components/sections/ # Page-level sections
src/lib/utils/               # Core logic (BMI, crypto, storage, versioning)
src/lib/i18n/                # Locale system and translation files
src/styles/                  # Modular CSS layers
scripts/                     # Maintenance scripts
docs/                        # Long-form documentation
.github/workflows/           # CI, release, security, and maintenance workflows
```

## 🔖 Versioning

The canonical version begins in `package.json`.

> [!IMPORTANT]
> Use `scripts/bmi-update-version.ts` via the npm scripts provided above. This ensures `package.json`, backup metadata, `README.md`, and `LICENSE.md` remain perfectly synchronized.

## 🔒 Security Model

- **Local First:** All health data remains local on your device.
- **Military Grade Encryption:** Backups utilize AES-256-GCM encryption.
- **Robust Key Derivation:** Argon2id is employed as the primary key derivation function.
- **Backward Compatibility:** PBKDF2 backup imports remain supported for older exports.
- **Zero Knowledge:** Passphrases are _never_ stored.

## ❤️ Support

BMI Stellar is an open-source passion project built and maintained independently.

If this project has helped you, inspired your own application, or saved you development time, consider supporting future maintenance:

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/rezky)

_Support is completely optional, and the project will forever remain open-source._

## ⚖️ License

Distributed under the GPL-3.0 License. See [LICENSE.md](LICENSE.md) for more information.
