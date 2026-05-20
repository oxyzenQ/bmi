# Contributing to BMI Stellar

Thank you for considering a contribution. This guide covers everything you need to set up, develop, and submit changes that meet the project's standards.

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
   bun install
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
9. `responsive-*.css` — Responsive overrides (base, width, height, backdrop, mobile-perf, content)
10. `nav.css` — Pager navigation
11. `lang-switcher.css` — Language switcher panel
12. `animation.css` — Skeleton loading, micro-interactions

See [Furthermore Docs](../docs/furthermore.md) for the full architecture diagram.

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

### PR Title Format

Use the same conventional commit format:

```
feat(share): add body-fat percentage to share card
fix(css): resolve backdrop-filter regression on iOS Safari
```

## Code Standards

- **Type Safety First:** TypeScript strict mode is mandatory. Avoid `any` — use proper type definitions and generics.
- **Svelte 5 Runes:** Embrace `$state`, `$derived`, `$effect`, and `$props` — do not use legacy Svelte 4 patterns.
- **Styling:** Use existing CSS custom properties from `tokens.css`. Add new tokens when a value is reused across 2+ files. Avoid inline styles.
- **Accessibility:** Every interactive element must have a visible `:focus-visible` indicator. Use ARIA attributes (`aria-label`, `role`, `aria-modal`, etc.) for screen reader support. Test keyboard navigation.
- **Performance:** Profile new animations on mobile. The three-tier system (high/medium/low) in `animation-config.ts` must be respected.
- **Clarity over Cleverness:** Write descriptive names, keep functions small and focused, and add comments for non-obvious logic.

## Questions

Open an [issue](https://github.com/oxyzenQ/bmi/issues) for questions, feature proposals, or architectural discussions.
