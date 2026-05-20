# Contributing to BMI Stellar

Thank you for considering a contribution. This guide covers how to set up, develop, test, and submit changes that preserve BMI Stellar's core promises: correct health math, local-first privacy, smooth mobile interaction, accessible UI, and a polished dark premium identity.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Architecture](#project-architecture)
- [Internationalization Guidelines](#internationalization-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Standards](#code-standards)
- [Questions](#questions)

---

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/bmi.git
   cd bmi
   ```
3. **Install** dependencies using Bun:
   ```bash
   bun install --frozen-lockfile
   ```
4. **Create** a branch for your work:
   ```bash
   git checkout -b feature/your-awesome-feature
   ```

## Development Workflow

All commands use `bun` for speed and consistency.

```bash
# Start the local development server (with HMR)
bun run dev

# Run all tests
bun run test:run

# Fast test run (excludes crypto/history-io)
bun run test:fast

# Type-check Svelte and TypeScript
bun run check

# Lint your code
bun run lint

# Auto-format with Prettier
bun run format

# Check formatting without writing
bun run format:check

# Run the complete verification suite (required before pushing)
bun run verify
```

> [!IMPORTANT]
> Always run `bun run verify` before pushing. This gate runs `format:check + check + lint + test:run + build` and catches regressions that individual commands may miss.

## Project Architecture

The codebase is organized around a clear separation of concerns:

```
src/lib/components/     # UI components — forms, modals, gauges, charts, sections
src/lib/components/form/       # Form sub-components (inputs, toggle, actions)
src/lib/components/encryption/ # Encryption modal sub-components
src/lib/components/page/       # Pager controls and gauge section
src/lib/utils/          # Core logic — BMI math, crypto, storage, scroll, share
src/lib/i18n/           # Locale engine + 4 translation dictionaries (en, id, ja, zh)
src/lib/stores/         # PWA install/update reactive state
src/lib/actions/        # Svelte actions (DOM portal)
src/lib/types/          # TypeScript type definitions
src/styles/             # 17-file modular CSS cascade (see below)
src/routes/             # SvelteKit pages and layouts
scripts/                # Maintenance scripts (bmi-update-version)
```

### CSS Cascade

Styles follow a strict import order in `+layout.svelte`. Each layer builds on the previous:

1. `tokens.css` — Design tokens (all CSS custom properties)
2. `base.css` — Resets, typography
3. `icons.css` — Icon sizing
4. `components.css` — Glassmorphism, button system, hero
5. `form.css` — Form layout, inputs, validation
6. `results.css` — Results card, share buttons
7. `data-cards.css` — Stat grid, TDEE, gauge
8. `layout.css` — Layout, footer
9. `responsive-base.css` — Shared responsive contracts and component focus contracts
10. `responsive-width.css` — Width breakpoints
11. `responsive-height.css` — Height breakpoints
12. `responsive-backdrop.css` — `backdrop-filter` feature fallbacks
13. `nav.css` — Pager navigation and bottom controls
14. `lang-switcher.css` — Language switcher panel
15. `animation.css` — Skeleton loading and micro-interactions
16. `responsive-mobile-perf.css` — Touch-device rendering and scroll performance overrides
17. `responsive-content.css` — Final responsive correction layer

See [Furthermore Docs](../docs/furthermore.md) for the full architecture diagram.

### Non-Negotiable Guardrails

- **BMI/TDEE/body-fat formulas:** Do not change calculation behavior without tests and a clear issue or PR rationale.
- **Share image export:** Preserve PNG-only, 1:1 square output unless the change explicitly targets share rendering.
- **Encrypted backups:** Do not change the encrypted backup envelope, KDF, cipher, or compatibility behavior casually.
- **Mobile scroll:** Treat scroll/touch/wheel changes as high-risk. Preserve vertical scroll inside long sections and intentional horizontal section swipes.
- **Visual identity:** Keep the dark premium Stellar language intact. Avoid broad redesigns in maintenance PRs.
- **Dependencies:** Avoid new dependencies unless they remove substantial risk or complexity.

## Internationalization Guidelines

When adding or modifying user-facing text:

1. **Add keys to all 4 locales:** `en.ts`, `id.ts`, `ja.ts`, `zh.ts` — the English dictionary is the source of truth.
2. **Unit symbols are universal:** Use `kg`, `cm`, `lb`, `in`, `kcal` in compact numeric contexts across all languages. Never translate unit symbols.
3. **Translate human-readable labels:** Height, Weight, BMI Prime, Ideal Range, TDEE, activity levels, gender, status labels, and recommendations should be properly localized.
4. **Key naming:** Use dot-notation with domain prefixes (`form.`, `results.`, `share.`, `risk.`, `crypto.`, etc.).
5. **Interpolation:** Use `{param}` syntax for dynamic values (e.g., `'share.weight_line': 'Weight: {n} {unit}'`).

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) to automatically generate changelogs and maintain a clean history.

### Format

```
<type>(<scope>): <description>

[optional body]
```

### Types

| Type       | Purpose                                    |
| ---------- | ------------------------------------------ |
| `feat`     | A new feature                              |
| `fix`      | A bug fix                                  |
| `docs`     | Documentation changes only                 |
| `style`    | Formatting, whitespace — no logic changes  |
| `refactor` | Code restructuring without behavior change |
| `perf`     | Performance improvement                    |
| `test`     | Adding or correcting tests                 |
| `chore`    | Maintenance, dependency updates, tooling   |

### Scopes

Common scopes include: `a11y`, `i18n`, `css`, `crypto`, `form`, `results`, `share`, `pwa`, `nav`, `build`.

### Examples

```
feat(share): add TDEE context caption to share card
fix(a11y): restore focus-visible ring on password inputs
docs(i18n): document unit symbol policy in contributing guide
perf(nav): disable backdrop-filter on low-tier devices
```

## Pull Request Process

Before opening a PR, complete this checklist:

1. **Verify:** `bun run verify` passes entirely (format:check + check + lint + test:run + build).
2. **Rebase:** Your branch is up to date with the latest `dev` branch.
3. **Documentation:** Architecture or usage changes are reflected in `docs/furthermore.md` or this file.
4. **i18n:** New user-facing strings exist in all 4 locale files.
5. **Description:** Your PR explains _why_ the change is needed, not just _what_ was changed.
6. **Issues:** Related issues are referenced (e.g., "Fixes #123").

### Suggested PR Verification Notes

Include the commands you ran and any manual checks that matter for the changed area:

| Change Area           | Manual QA to Mention                                               |
| --------------------- | ------------------------------------------------------------------ |
| BMI/results           | Metric and imperial calculation paths                              |
| History/import/export | Unencrypted import/export and encrypted import/export              |
| Mobile navigation     | Android Chrome/iOS Safari assumptions, slow scroll, diagonal swipe |
| PWA                   | Install prompt, update prompt, offline refresh                     |
| Share image           | PNG-only, 1:1 square output, readable social preview               |
| Accessibility         | Keyboard focus, modal escape/close, reduced motion                 |

### PR Title Format

Use the same conventional commit format:

```
feat(share): add body-fat percentage to share card
fix(css): resolve backdrop-filter regression on iOS Safari
```

## Code Standards

- **Type Safety First:** TypeScript strict mode is mandatory. Avoid `any` — use proper type definitions and generics.
- **Svelte 5 Runes:** Use `$state`, `$derived`, `$effect`, and `$props` where they fit. Do not introduce legacy Svelte 4 patterns into new code.
- **Styling:** Use existing CSS custom properties from `tokens.css`. Add new tokens only when a value is reused across files. Avoid inline styles and avoid `!important` unless the cascade genuinely requires it.
- **Accessibility:** Every interactive element must have an intentional keyboard-visible state. Prefer component-owned `:focus-visible` styles over broad global outlines. Use ARIA attributes (`aria-label`, `role`, `aria-modal`, etc.) for screen reader support and test keyboard navigation.
- **Performance:** Profile new animations on mobile. The three-tier system (high/medium/low) in `animation-config.ts` and touch-device CSS in `responsive-mobile-perf.css` must be respected.
- **Security:** Never log health data, backup payloads, passphrases, encryption keys, verifier plaintext, or decrypted import contents.
- **Clarity over Cleverness:** Write descriptive names, keep functions small and focused, and add comments for non-obvious logic.

## Questions

Open an [issue](https://github.com/oxyzenQ/bmi/issues) for questions, feature proposals, or architectural discussions.
