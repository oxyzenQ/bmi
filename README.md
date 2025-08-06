# 🚀 BMI Calculator SvelteKit

A modern, responsive Body Mass Index calculator built with **SvelteKit**, **TypeScript**, and **Tailwind CSS**. Features a beautiful space-themed design with dark/light mode, interactive charts, and exceptional performance.

## ✨ Features

- 🎨 **Space Theme Design** - Beautiful plasma colors and smooth animations
- 🌙 **Dark/Light Mode** - Toggle between themes with localStorage persistence
- 📊 **Interactive BMI Chart** - Custom SVG visualization with health tips
- 📱 **Mobile Optimized** - Responsive design with touch-friendly interactions
- ⚡ **Lightning Fast** - 98/100 Mobile, 99/100 Desktop Lighthouse scores
- 🔒 **Privacy First** - All calculations performed locally
- ♿ **Accessible** - WCAG compliant with keyboard navigation
- 🚀 **Production Ready** - Optimized for deployment on Vercel

## 🏆 Performance

- **Mobile**: 98/100 Lighthouse Performance
- **Desktop**: 99/100 Lighthouse Performance
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1

## 🛠️ Tech Stack

- **Framework**: SvelteKit 2.x with Svelte 5
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Icons**: Font Awesome 6.4
- **Fonts**: Inter (Google Fonts)
- **Deployment**: Vercel

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### One-Click Development

```bash
# Start development server with all checks
./dev.sh
```

### One-Click Production Build

```bash
# Build and serve production version
./build.sh
```

### Manual Commands

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format

# Run tests
npm run test
```

## 📁 Project Structure

```
├── src/
│   ├── lib/
│   │   ├── components/     # Reusable components
│   │   │   ├── BmiChart.svelte
│   │   │   ├── ThemeToggle.svelte
│   │   │   └── LoadingSpinner.svelte
│   │   └── stores/         # Svelte stores
│   │       └── theme.ts
│   ├── routes/             # SvelteKit pages
│   │   ├── +page.svelte    # Home page
│   │   ├── calculator/     # BMI calculator
│   │   └── about/          # About page
│   ├── app.css             # Global styles
│   └── app.html            # HTML template
├── static/                 # Public assets
│   └── assets/             # Images and icons
├── dev.sh                  # One-click development
├── build.sh                # One-click production
└── package.json
```

## 🎯 Usage

1. **Home Page** - Welcome screen with navigation
2. **Calculator** - Enter age, gender, height, and weight
3. **Results** - View BMI calculation with interactive chart
4. **Theme Toggle** - Switch between dark and light modes
5. **About** - Learn more about BMI and health

## 🚀 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect repository to Vercel
3. Deploy automatically

### Manual Deployment

```bash
npm run build
# Upload build/ directory to your hosting provider
```

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run check` - Type checking and linting
- `npm run format` - Format code with Prettier
- `npm run test` - Run tests
- `npm run clean` - Clean build directories

### Code Quality

- **TypeScript** for type safety
- **ESLint** for code linting
- **Prettier** for code formatting
- **Svelte Check** for Svelte-specific validation

## 📊 Performance Optimizations

- ✅ Server-side rendering (SSR)
- ✅ Tailwind CSS v4 optimization
- ✅ Custom SVG charts (no heavy libraries)
- ✅ Lazy loading for images
- ✅ Preload critical resources
- ✅ Optimized bundle splitting
- ✅ Mobile-first responsive design

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Rezky Nightly**

---

⭐ **Star this repository if you found it helpful!**
