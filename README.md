# 🚀 A Simple BMI Calc

A simple BMI calc - modern, responsive Body Mass Index calculator built with **SvelteKit** and **TypeScript**. Features a beautiful space-themed design with interactive charts and exceptional performance.

## ✨ Features

- 🎨 **Space Theme Design** - Beautiful plasma colors and smooth animations
- 📊 **Interactive BMI Chart** - Custom SVG visualization with health tips
- 📱 **Mobile Optimized** - Responsive design with touch-friendly interactions
- ⚡ **Lightning Fast** - 98/100 Mobile, 99/100 Desktop Lighthouse scores
- 🔒 **Privacy First** - All calculations performed locally
- ♿ **Accessible** - Simple navigation one single page
- 🚀 **Production Ready** - Optimized for deployment on Vercel

## 🏆 Performance

- **Mobile**: 98/100 Lighthouse Performance
- **Desktop**: 99/100 Lighthouse Performance
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1


## 🛠️ Tech Stack

- **Framework**: SvelteKit, Svelte latest
- **Language**: TypeScript
- **Desktop/Mobile**: Tauri 2.0 (Rust-based)
- **Styling**: Modern CSS (no Tailwind)
- **Icons**: lucide-svelte
- **Fonts**: Inter & Jetbrainsmono via @fontsource (@fontsource-variable/x)
- **Deployment**: Vercel (web), Tauri (desktop/Android)

## 🚀 Quick Start

### Prerequisites

- Bun 1.0+ (Package manager & runtime)
- Install Bun: `curl -fsSL https://bun.sh/install | bash`

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
bun install

# Development
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Type checking
bun run type-check

# Linting
bun run lint

# Format code
bun run format

# Run tests
bun test
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
2. **Calculator** - Enter age, height, and weight
3. **Results** - View BMI calculation with interactive gauge chart
4. **About** - Learn more about BMI and health

## 🚀 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect repository to Vercel
3. Deploy automatically

### Manual Deployment

```bash
bun run build
# Upload build/ directory to your hosting provider
```

## 📱 Desktop & Mobile (Tauri)

### Prerequisites for Tauri

**Linux:**
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

**macOS:**
```bash
xcode-select --install
```

**Windows:**
- Install [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### Tauri Development

```bash
# Run desktop app in development mode
bun tauri:dev

# Build desktop app for current platform
bun tauri:build

# Generate app icons from source image
bun tauri:icon path/to/icon.png
```

### Android Development with Tauri

**Prerequisites:**
1. Install [Android Studio](https://developer.android.com/studio)
2. Install Android SDK and NDK
3. Set up environment variables

```bash
# Initialize Android project (first time only)
bun tauri android init

# Run on Android device/emulator
bun tauri:dev:android

# Build Android APK/AAB
bun tauri:build:android
```

### Build Targets

Desktop builds are available for:
- **Windows** (`.exe`, `.msi`)
- **macOS** (`.app`, `.dmg`)
- **Linux** (`.deb`, `.AppImage`)

Mobile builds:
- **Android** (`.apk`, `.aab`)

## 🔧 Development

### Available Scripts

**Web Development:**
- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run preview` - Preview production build
- `bun run check` - Type checking and linting
- `bun run format` - Format code with Prettier
- `bun test` - Run tests
- `bun run clean` - Clean build directories

**Tauri (Desktop):**
- `bun tauri:dev` - Run desktop app in dev mode
- `bun tauri:build` - Build desktop app
- `./src-tauri/target/release/a-simple-bmi-calc` - Run built binary
- `./install-arch.sh` - Install on Arch Linux (to ~/.local/bin)
- `./build-deb.sh` - Build DEB package (for Debian/Ubuntu users)
- `bun tauri:icon:generate` - Generate icons from logobmii.webp

### Code Quality

- **TypeScript** for type safety
- **ESLint** for code linting
- **Prettier** for code formatting
- **Svelte Check** for Svelte-specific validation

## 📊 Performance Optimizations

### Web Performance
- ✅ Server-side rendering (SSR)
- ✅ Custom gauge charts (no heavy libraries)
- ✅ Lazy loading for images
- ✅ Preload critical resources
- ✅ Optimized bundle splitting
- ✅ Mobile-first responsive design

### Build Optimizations (ARM64)
- ✅ **50-60% smaller** binaries with LTO and size optimization
- ✅ **ARM64-specific** compiler flags (NEON, M1 optimization)
- ✅ **Split APKs** per ABI for Android (smaller downloads)
- ✅ **Stripped debug symbols** in release builds
- ✅ **ES2020 target** for modern JavaScript
- ✅ **esbuild minification** for faster builds

**📖 See [BUILD_OPTIMIZATION.md](BUILD_OPTIMIZATION.md) for detailed optimization guide**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Rezky Nightky**

---

⭐ **Star this repository if you found it helpful!**
