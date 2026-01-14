# BMI Calculator

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/oxyzenQ/bmi)

A modern, space‑themed **Body Mass Index (BMI)** calculator built with **SvelteKit + TypeScript**, designed for a accessible user experience.

- **Live**: https://bmi-logigo.vercel.app

## Highlights

- **Instant BMI results**
  Includes category classification and guidance.
- **High‑quality animations (optional)**
  Results reveal, count‑up number, and gauge/range animations.
- **Render Mode toggle**
  Turn advanced visuals on/off for better performance or battery life.
  Stored in `localStorage` as `bmi.renderMode`.
- **Reduced motion support**
  Respects `prefers-reduced-motion`.
- **Privacy-first**
  No tracking — preferences and history are stored locally.
- **Offline ready**
  Includes a service worker in production builds.

## Tech Stack

- **Framework**: SvelteKit
- **Language**: TypeScript
- **UI**: Svelte components + custom CSS
- **Runtime / tooling**: Bun
- **Deployment**: Vercel

## Quick Start

```bash
bun install
bun run dev
```

Open the local URL printed in your terminal.

## Scripts

```bash
bun run dev        # start dev server
bun run check      # svelte-check
bun run lint       # eslint
bun run test:run   # tests
bun run build      # production build
bun run preview    # preview build

./verify.sh        # check + lint + test + build
```

## Project Structure

```text
src/
  lib/components/   reusable UI components
  lib/ui/           app UI sections
  routes/           SvelteKit routes/pages
  global-styles.css global styling
```

## Contributing

PRs are welcome.

## License

GPL‑3.0 — see `LICENSE.md`.
