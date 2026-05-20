# 🤝 Contributing to BMI Stellar Edition

First off, thank you for considering contributing to BMI Stellar! It's people like you that make open-source a fantastic community to learn, inspire, and create. 🎉

## 📑 Table of Contents

- [Getting Started](#-getting-started)
- [Development Workflow](#-development-workflow)
- [Project Architecture](#-project-architecture)
- [Commit Guidelines](#-commit-guidelines)
- [Pull Request Process](#-pull-request-process)
- [Code Standards](#-code-standards)
- [Questions?](#-questions)

---

## 🚀 Getting Started

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

## 💻 Development Workflow

Our workflow relies heavily on `bun` for speed and efficiency.

```bash
# Start the local development server (with HMR)
bun run dev

# Run unit tests
bun test

# Lint your code
bun run lint

# Automatically format your code with Prettier
bun run format

# Run the complete verification suite (highly recommended before pushing)
bun run verify
```

## 🏗️ Project Architecture

To help you find your way around, here is a quick map of the codebase:

- `src/lib/components/`: Reusable UI elements (buttons, inputs, glass panels).
- `src/lib/utils/`: Core mathematical and cryptographic logic.
- `src/styles/`: The modular CSS architecture (see [Furthermore Docs](../docs/furthermore.md) for details).
- `src/routes/`: SvelteKit pages and layouts.

## 📝 Commit Guidelines

We use conventional commits to automatically generate changelogs and maintain a clean history. Please use clear, descriptive commit messages:

- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation updates only
- `style:` Changes that do not affect the meaning of the code (white-space, formatting, etc)
- `refactor:` A code change that neither fixes a bug nor adds a feature
- `perf:` A code change that improves performance
- `test:` Adding missing tests or correcting existing ones
- `chore:` Maintenance tasks, dependency updates, etc.

_Example: `feat: add dynamic body fat percentage calculator`_

## 🔄 Pull Request Process

To ensure a smooth review process, please follow this checklist before opening your PR:

1. ✅ **Pass Checks:** Ensure `bun run verify` passes entirely.
2. ✅ **Stay Updated:** Rebase your branch against the latest `main` branch.
3. ✅ **Documentation:** Update relevant documentation if your changes affect architecture or usage.
4. ✅ **Description:** Provide a clear, comprehensive PR description explaining _why_ the change is needed.
5. ✅ **Link Issues:** Reference any related issues (e.g., "Fixes #123").

## 📏 Code Standards

- **Type Safety First:** We use **TypeScript**. Strict typing is mandatory. Avoid `any` at all costs.
- **Svelte 5 Runes:** Embrace modern Svelte paradigms (e.g., `$state`, `$derived`).
- **Styling:** Adhere to the existing **modular CSS custom properties** system rather than introducing inline styles.
- **Performance:** Keep components lightweight. Profile any new animations to ensure 60fps on mobile.
- **Clarity over Cleverness:** Write meaningful comments and keep functions small and highly focused.

## 💬 Questions?

Don't hesitate to ask! Open an [issue](https://github.com/oxyzenq/bmi/issues) for questions, feature proposals, or architectural discussions.

---

**Thank you for contributing to BMI Stellar!** 🚀
