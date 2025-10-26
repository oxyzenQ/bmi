<div align="center">

# 🚀 BMI Calculator Stellar Edition

**Modern, Fast, Privacy-First Body Mass Index Calculator**

<p>
  <a href="https://github.com/oxyzenq/bmi/releases">
    <img src="https://img.shields.io/github/v/release/oxyzenq/bmi?style=flat&logo=rocket&logoColor=white&color=8B5CF6&labelColor=1E1B4B&label=Version" alt="Version"/>
  </a>
  <a href="https://bmi-logigo.vercel.app">
    <img src="https://img.shields.io/badge/Demo-Live-10B981?style=flat&logo=vercel&logoColor=white&labelColor=065F46" alt="Live Demo"/>
  </a>
  <a href="LICENSE.md">
    <img src="https://img.shields.io/badge/License-GPL--3.0-EC4899?style=flat&logo=gnu&logoColor=white&labelColor=831843" alt="License"/>
  </a>
  <img src="https://img.shields.io/badge/Lighthouse-98+-F59E0B?style=flat&logo=lighthouse&logoColor=white&labelColor=78350F" alt="Lighthouse Score"/>
</p>

<p>
  <img src="https://img.shields.io/badge/SvelteKit-FF3E00?style=flat&logo=svelte&logoColor=white&labelColor=7C2D12" alt="SvelteKit"/>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white&labelColor=1E3A8A" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Bun-000000?style=flat&logo=bun&logoColor=white&labelColor=18181B" alt="Bun"/>
  <a href="https://github.com/oxyzenq/bmi/security/code-scanning">
    <img src="https://img.shields.io/badge/Security-Verified-06B6D4?style=flat&logo=security&logoColor=white&labelColor=164E63" alt="Security"/>
  </a>
  <img src="https://img.shields.io/github/stars/oxyzenq/bmi?style=flat&logo=github&logoColor=white&color=FBBF24&labelColor=92400E" alt="Stars"/>
</p>

**[🌐 Live Demo](https://bmi-logigo.vercel.app)** • **[📦 Download](https://github.com/oxyzenq/bmi/releases)** • **[🐛 Report Bug](https://github.com/oxyzenq/bmi/issues)** • **[💡 Request Feature](https://github.com/oxyzenq/bmi/discussions)**

</div>

## ✨ Highlights

<table>
  <tr>
    <td align="center">🎨</td>
    <td><b>Space-Themed UI</b><br/>Beautiful glassmorphism design</td>
    <td align="center">📊</td>
    <td><b>Interactive Charts</b><br/>Visual BMI history tracking</td>
  </tr>
  <tr>
    <td align="center">⚡</td>
    <td><b>98+ Lighthouse Score</b><br/>Blazing fast performance</td>
    <td align="center">🔒</td>
    <td><b>Privacy-First</b><br/>All data stored locally</td>
  </tr>
  <tr>
    <td align="center">📱</td>
    <td><b>Mobile-Ready</b><br/>Responsive on all devices</td>
    <td align="center">🌍</td>
    <td><b>Offline Support</b><br/>Works without internet</td>
  </tr>
</table>

## 🛠️ Tech Stack

```
Frontend      SvelteKit 2.x + TypeScript
Runtime       Bun (fastest JS runtime)
Styling       TailwindCSS + Custom CSS
Icons         Lucide Icons
Charts        Gauge chart
Build Tool    Vite
Deployment    Vercel (Edge Functions)
```

## 🚀 Quick Start

### Prerequisites
- **Bun** ≥ 1.0 ([Install](https://bun.sh))
- **Git** ([Install](https://git-scm.com))

### Installation

```bash
# Clone repository
git clone https://github.com/oxyzenq/bmi.git
cd bmi

# Install dependencies
bun install

# Start development server
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) 🚀

### Production Build

```bash
# Build for production
bun run build

# Preview production build
bun run preview
```

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server with hot reload |
| `bun run build` | Build optimized production bundle |
| `bun run preview` | Preview production build locally |
| `bun run format` | Format code with Prettier |
| `bun run lint` | Lint code with ESLint |
| `bun run check` | Type-check with SvelteKit sync |
| `bun test` | Run unit tests with Vitest |

<details>
<summary><b>Release Package Installation</b></summary>

Download the latest release from [Releases](https://github.com/oxyzenq/bmi/releases):

```bash
# Extract package
unzip bmi-stellar-edition-1.0.zip -d bmi-calculator
cd bmi-calculator

# Install dependencies
bun install

# Start production server
bun run preview
```

Access at `http://localhost:4173`

</details>

## 🏗️ Project Architecture

```
bmi/
├── src/
│   ├── lib/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── Calculator.svelte
│   │   │   ├── Chart.svelte
│   │   │   └── Header.svelte
│   │   ├── stores/           # State management (Svelte stores)
│   │   │   └── bmi.ts
│   │   └── utils/            # Helper functions
│   │       └── calculations.ts
│   ├── routes/               # SvelteKit routes (file-based routing)
│   │   ├── +page.svelte      # Home page
│   │   ├── calculator/       # Calculator page
│   │   │   └── +page.svelte
│   │   └── about/            # About page
│   │       └── +page.svelte
│   ├── app.html              # HTML template
│   └── app.css               # Global styles
├── static/                   # Static assets (favicon, etc.)
├── tests/                    # Unit & integration tests
└── package.json
```

## 🎨 Features in Detail

### 🧮 Smart BMI Calculator
- **Multiple unit systems:** Metric (kg/cm) & Imperial (lb/in)
- **Real-time calculation:** Instant results as you type
- **BMI categories:** Underweight, Normal, Overweight, Obese
- **Health recommendations:** Personalized advice based on BMI

### 📊 Data Visualization
- **Interactive charts:** Gauge chart
- **Local storage:** All data saved in browser (privacy-first)

### 🎯 User Experience
- **Keyboard shortcuts:** Navigate with arrow keys
- **Accessibility:** WCAG 2.1 AA compliant
- **Dark mode:** Auto-detect system preference
- **Animations:** Smooth transitions with reduced motion support

## 🤝 Contributing

We welcome contributions! Please follow these steps:

### 1. Fork & Clone
```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/bmi.git
cd bmi
```

### 2. Create Feature Branch
```bash
git checkout -b feature/amazing-feature
```

### 3. Make Changes
```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Make your changes and test
bun run lint
bun test
```

### 4. Commit & Push
```bash
# Commit with conventional commits
git commit -m "feat: add amazing feature"

# Push to your fork
git push origin feature/amazing-feature
```

### 5. Create Pull Request
Open a PR from your fork to `main` branch with:
- Clear description of changes
- Screenshots (if UI changes)
- Test results

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for detailed guidelines.

## 🧪 Testing

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Watch mode
bun test --watch
```

## 📊 Performance

| Metric | Score |
|--------|-------|
| Performance | 98 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |
| PWA | ✅ Ready |

*Tested with Google Lighthouse on desktop*

## 🔒 Privacy & Security

- ✅ **No tracking:** Zero analytics or telemetry
- ✅ **Local-first:** All data stored in browser localStorage
- ✅ **No cookies:** No tracking cookies used
- ✅ **Open source:** Fully auditable code
- ✅ **CodeQL scans:** Automated security scanning
- ✅ **CSP headers:** Content Security Policy enabled

## 🗺️ Roadmap

- [ ] Multi-language support (i18n)
- [ ] BMI calculator for children/teens
- [ ] Body fat percentage calculator
- [ ] Calorie calculator integration
- [ ] Export PDF reports
- [ ] PWA offline support
- [ ] Dark/light theme toggle

## 📄 License

This project is licensed under the **GNU General Public License v3.0**.

See [LICENSE.md](LICENSE.md) for full details.

```
Copyright (C) 2024 Team LOGIGO

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License.
```

## 🙏 Acknowledgments

- **SvelteKit Team** - Amazing framework
- **Bun Team** - Blazing fast runtime
- **Lucide Icons** - Beautiful icon set
- **Contributors** - Thank you! ❤️

<div align="center">
<picture>
  <source
    media="(prefers-color-scheme: dark)"
    srcset="https://api.star-history.com/svg?repos=oxyzenq/bmi&type=Date&theme=dark"
  />
  <source
    media="(prefers-color-scheme: light)"
    srcset="https://api.star-history.com/svg?repos=oxyzenq/bmi&type=Date"
  />
  <img
    alt="Star History Chart"
    src="https://api.star-history.com/svg?repos=oxyzenq/bmi&type=Date"
  />
</picture>

**Built with 💜 by Team LOGIGO**

**Powered by SvelteKit • TypeScript • Bun**

<p>
  <a href="https://github.com/oxyzenq/bmi">
    <img src="https://img.shields.io/github/stars/oxyzenq/bmi?style=social" alt="GitHub Stars"/>
  </a>
  <a href="https://github.com/oxyzenq/bmi/fork">
    <img src="https://img.shields.io/github/forks/oxyzenq/bmi?style=social" alt="GitHub Forks"/>
  </a>
  <a href="https://github.com/oxyzenq/bmi/watchers">
    <img src="https://img.shields.io/github/watchers/oxyzenq/bmi?style=social" alt="GitHub Watchers"/>
  </a>
</p>

**[⬆ Back to Top](#-bmi-calculator-stellar-edition)**

</div>
