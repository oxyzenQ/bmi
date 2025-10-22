# Tauri Development Guide

**Project:** A Simple BMI Calc  
**Platform:** Desktop (Windows, macOS, Linux) & Mobile (Android)  
**Framework:** Tauri 2.0 + SvelteKit

---

## 📋 Overview

This project uses **Tauri 2.0** to build native desktop and Android applications from the same SvelteKit codebase. Tauri uses Rust for the backend and system WebView for rendering, resulting in:

- **Small bundle sizes** (~3-5MB vs 100MB+ Electron)
- **Fast performance** (native Rust backend)
- **Low memory usage** (uses system WebView)
- **Cross-platform** (Windows, macOS, Linux, Android)

---

## 🔧 Prerequisites

### All Platforms

1. **Rust** - Install from [rustup.rs](https://rustup.rs/)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Bun** - Already installed for this project
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

### Linux (Ubuntu/Debian)

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

### macOS

```bash
# Install Xcode Command Line Tools
xcode-select --install
```

### Windows

1. **Microsoft Visual Studio C++ Build Tools**
   - Download from [Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - Install "Desktop development with C++" workload

2. **WebView2 Runtime**
   - Usually pre-installed on Windows 11
   - Download from [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### Android Development

1. **Android Studio** - [Download](https://developer.android.com/studio)
2. **Android SDK** (API 24+)
3. **Android NDK** (version 25 or higher)
4. **Java JDK** (version 17 or 18)

**Environment Variables:**
```bash
# Add to ~/.bashrc or ~/.zshrc
export ANDROID_HOME="$HOME/Android/Sdk"
export NDK_HOME="$ANDROID_HOME/ndk/$(ls -1 $ANDROID_HOME/ndk)"
export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"  # Adjust path
```

---

## 🚀 Development Workflow

### Web Development (Default)

```bash
# Standard web development (no Tauri)
bun run dev
bun run build
```

### Desktop Development

```bash
# Run desktop app in development mode
bun tauri:dev

# Build desktop app for release
bun tauri:build
```

**Development Features:**
- Hot reload (web changes reflect instantly)
- DevTools enabled in debug builds
- Native window controls
- System tray integration (if configured)

### Android Development

**First-time setup:**
```bash
# Initialize Android project
bun tauri android init
```

**Development:**
```bash
# Run on connected device or emulator
bun tauri:dev:android

# Build release APK
bun tauri:build:android

# Build release AAB (for Play Store)
bun tauri android build --apk
bun tauri android build --aab
```

---

## 🎨 App Icons

### Generate Icons

Tauri can generate all required icon sizes from a single source image:

```bash
# Source image should be 1024x1024 PNG with transparency
bun tauri:icon path/to/icon.png
```

This generates:
- `icons/32x32.png`
- `icons/128x128.png`
- `icons/128x128@2x.png`
- `icons/icon.icns` (macOS)
- `icons/icon.ico` (Windows)

### Manual Icon Placement

Place icons in `src-tauri/icons/`:
```
src-tauri/icons/
├── 32x32.png
├── 128x128.png
├── 128x128@2x.png
├── icon.icns
└── icon.ico
```

---

## 📦 Build Configuration

### Main Configuration

File: `src-tauri/tauri.conf.json`

**Key sections:**
- `productName` - App display name
- `identifier` - Unique app ID (reverse domain notation)
- `build.frontendDist` - Path to built web files (`../build`)
- `bundle.targets` - Build targets (deb, appimage, nsis, app, dmg)
- `app.windows` - Window configuration (size, title, theme)

### Rust Dependencies

File: `src-tauri/Cargo.toml`

**Core dependencies:**
- `tauri` - Main Tauri framework
- `tauri-plugin-shell` - Shell command execution
- `tauri-plugin-updater` - Auto-update support
- `serde` & `serde_json` - JSON serialization

### Build Optimization

The release profile in `Cargo.toml` is optimized for:
- Small binary size (`opt-level = "s"`)
- Link-time optimization (`lto = true`)
- Stripped symbols (`strip = true`)

---

## 📱 Platform-Specific Builds

### Windows

**Output formats:**
- `.exe` - Executable installer
- `.msi` - Windows Installer package

**Build command:**
```bash
bun tauri:build
```

**Location:** `src-tauri/target/release/bundle/`

### macOS

**Output formats:**
- `.app` - Application bundle
- `.dmg` - Disk image installer

**Build command:**
```bash
bun tauri:build
```

**Code signing (for distribution):**
1. Get Apple Developer certificate
2. Configure in `tauri.conf.json` → `bundle.macOS.signingIdentity`

### Linux

**Output formats:**
- `.deb` - Debian package
- `.AppImage` - Portable executable
- `.rpm` - RPM package (if configured)

**Build command:**
```bash
bun tauri:build
```

### Android

**Output formats:**
- `.apk` - Android Package (for testing/sideloading)
- `.aab` - Android App Bundle (for Play Store)

**Build commands:**
```bash
# Debug build
bun tauri android build --debug

# Release build (requires signing)
bun tauri android build --release
```

**App Signing:**
1. Generate keystore:
   ```bash
   keytool -genkey -v -keystore release-key.keystore \
     -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Configure in `src-tauri/gen/android/app/build.gradle.kts`

---

## 🔐 Security & Permissions

### Desktop Permissions

Configured in `src-tauri/capabilities/default.json`:

```json
{
  "permissions": [
    "core:default",
    "shell:allow-open"
  ]
}
```

### Android Permissions

Required permissions are auto-configured based on Tauri plugins used. Common ones:
- `INTERNET` - Network access
- `WRITE_EXTERNAL_STORAGE` - File access (API < 29)

Add custom permissions in `src-tauri/gen/android/app/src/main/AndroidManifest.xml`

---

## 🛠️ Troubleshooting

### Build Errors

**"Rust toolchain not found"**
```bash
rustup update
rustup default stable
```

**"WebView2 not found" (Windows)**
- Install [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

**"webkit2gtk not found" (Linux)**
```bash
sudo apt install libwebkit2gtk-4.1-dev
```

### Android Build Issues

**"NDK not found"**
```bash
# Install via Android Studio SDK Manager
# Or set NDK_HOME environment variable
export NDK_HOME="$ANDROID_HOME/ndk/25.2.9519653"
```

**"Build failed with gradle error"**
```bash
# Clean gradle cache
cd src-tauri/gen/android
./gradlew clean
```

### Development Tips

**Clear Tauri cache:**
```bash
bun run clean
rm -rf src-tauri/target
```

**Check Tauri info:**
```bash
bun tauri info
```

**Enable verbose logging:**
```bash
RUST_LOG=debug bun tauri:dev
```

---

## 📚 Additional Resources

- [Tauri Documentation](https://tauri.app/)
- [Tauri API Reference](https://tauri.app/v2/reference/)
- [Android Development](https://tauri.app/v2/guides/building/android/)
- [Publishing Apps](https://tauri.app/v2/guides/distribution/)

---

## 🎯 Next Steps

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Test desktop app:**
   ```bash
   bun tauri:dev
   ```

3. **Generate app icons:**
   ```bash
   bun tauri:icon static/favicon.webp
   ```

4. **Build for production:**
   ```bash
   bun tauri:build
   ```

5. **Setup Android (optional):**
   ```bash
   bun tauri android init
   bun tauri:dev:android
   ```

---

**Happy Building! 🚀**
