# Linux x86_64 Optimized Build Guide

## 🐧 Current System
- **Architecture**: x86_64 (64-bit Intel/AMD)
- **Platform**: Linux
- **Build Target**: Optimized native Linux binaries

---

## ✅ Build Status

### Web Build
**Status**: ✅ **Working**

The web build is functional and can be built immediately:
```bash
bun run build
```

**Output**: `.svelte-kit/output/` or `build/`

### Desktop Build (Tauri)
**Status**: ⚠️ **Requires Rust Installation**

To build native Linux desktop applications, you need to install Rust and Tauri dependencies.

---

## 🔧 Prerequisites

### 1. Install Rust (Required for Tauri)

```bash
# Install Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Choose option 1 (default installation)
# After installation, restart your terminal or run:
source $HOME/.cargo/env

# Verify installation
rustc --version
cargo --version
```

### 2. Install Tauri Dependencies (Linux)

```bash
# Ubuntu/Debian
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

# Fedora/RHEL
sudo dnf install webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libappindicator-gtk3-devel \
  librsvg2-devel

# Arch Linux
sudo pacman -S webkit2gtk-4.1 \
  base-devel \
  curl \
  wget \
  file \
  openssl \
  appmenu-gtk-module \
  gtk3 \
  libappindicator-gtk3 \
  librsvg \
  libvips
```

---

## 🚀 Build Commands

### Quick Test Build

Run the automated test script:
```bash
./test-build-linux-x64.sh
```

This script will:
1. Check all dependencies
2. Clean previous builds
3. Install node dependencies
4. Build web frontend
5. Build Tauri desktop app (if Rust is installed)
6. Show build artifacts and sizes

### Manual Build Steps

#### 1. Web Only Build
```bash
# Install dependencies
bun install

# Build web app
bun run build

# Output: build/ or .svelte-kit/output/
```

#### 2. Desktop Build (After Installing Rust)
```bash
# Standard build
bun tauri:build

# Optimized x86_64 build
RUSTFLAGS="-C target-cpu=x86-64-v2" bun tauri:build

# Maximum optimization
RUSTFLAGS="-C target-cpu=native -C opt-level=z -C lto=fat" bun tauri:build
```

#### 3. Native x64 Optimized Build
```bash
# Use the optimized build command
bun tauri:build:optimized

# This sets:
# - target-cpu=native (uses your CPU features)
# - opt-level=z (maximum size optimization)
# - lto=fat (full link-time optimization)
```

---

## 📦 Build Outputs

### x86_64 Linux Packages

After successful build, you'll find:

```
src-tauri/target/x86_64-unknown-linux-gnu/release/
├── a-simple-bmi-calc              # Binary (3-5 MB)
└── bundle/
    ├── deb/
    │   └── a-simple-bmi-calc_1.0.0_amd64.deb
    ├── appimage/
    │   └── a-simple-bmi-calc_1.0.0_amd64.AppImage
    └── rpm/
        └── a-simple-bmi-calc-1.0.0-1.x86_64.rpm
```

### Package Sizes (Optimized)
- **Binary**: ~3-5 MB
- **.deb**: ~5-7 MB
- **.AppImage**: ~8-12 MB
- **.rpm**: ~5-7 MB

---

## 🎯 Optimization Levels

### Level 1: Standard Build
```bash
bun tauri:build
```
- Size: ~8-10 MB
- Build time: ~2 minutes (first build)
- Optimization: Default Rust release profile

### Level 2: Size Optimized
```bash
RUSTFLAGS="-C opt-level=z -C lto=fat -C strip=symbols" bun tauri:build
```
- Size: ~4-6 MB (50% reduction)
- Build time: ~3-4 minutes
- Optimization: Maximum size reduction

### Level 3: Native CPU Optimized
```bash
bun tauri:build:optimized
```
- Size: ~3-5 MB
- Build time: ~3-4 minutes
- Optimization: Uses your CPU-specific features
- **Best for**: Local use, maximum performance

### Level 4: x86-64-v2 (Recommended)
```bash
RUSTFLAGS="-C target-cpu=x86-64-v2 -C opt-level=z -C lto=fat" bun tauri:build
```
- Size: ~3-5 MB
- Build time: ~3-4 minutes
- Optimization: Modern x64 CPUs (2009+)
- **Best for**: Distribution to other users

---

## 🧪 Testing Builds

### Test Binary Directly
```bash
# Run the built binary
./src-tauri/target/x86_64-unknown-linux-gnu/release/a-simple-bmi-calc
```

### Install .deb Package
```bash
# Install
sudo dpkg -i src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/deb/*.deb

# Run installed app
a-simple-bmi-calc

# Uninstall
sudo apt remove a-simple-bmi-calc
```

### Run AppImage
```bash
# Make executable
chmod +x src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/appimage/*.AppImage

# Run
./src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/appimage/*.AppImage
```

---

## 📊 Build Time Comparison

| Build Type | First Build | Incremental | Binary Size |
|------------|-------------|-------------|-------------|
| Web only | ~5s | ~2s | 500-600 KB |
| Standard Desktop | ~2 min | ~30s | 8-10 MB |
| Optimized Desktop | ~3-4 min | ~45s | 3-5 MB |

### First Build Notice
The first Rust build takes longer because it compiles all dependencies. Subsequent builds are much faster due to incremental compilation.

---

## 🔍 Troubleshooting

### "Rust not found" after installation
```bash
# Restart your terminal or run:
source $HOME/.cargo/env

# Verify
rustc --version
```

### "webkit2gtk not found"
```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev

# If that doesn't work, try:
sudo apt install libwebkit2gtk-4.0-dev
```

### Build fails with "linker not found"
```bash
# Install build essentials
sudo apt install build-essential
```

### Binary is too large
```bash
# Use maximum optimization
RUSTFLAGS="-C opt-level=z -C lto=fat -C strip=symbols -C panic=abort" \
  cargo build --release

# Check size
du -h src-tauri/target/release/a-simple-bmi-calc
```

### "Permission denied" when running binary
```bash
chmod +x src-tauri/target/release/a-simple-bmi-calc
```

---

## 🎨 Custom Build Configurations

### Strip Debug Symbols
Already configured in `Cargo.toml`:
```toml
[profile.release]
strip = true
```

### Enable LTO (Link-Time Optimization)
Already configured:
```toml
[profile.release]
lto = "fat"
```

### Target-Specific Flags
Configured in `src-tauri/.cargo/config.toml`:
```toml
[target.x86_64-unknown-linux-gnu]
rustflags = ["-C", "target-cpu=x86-64-v2"]
```

---

## 📋 Build Checklist

### Before Building
- [ ] Bun installed (`bun -v`)
- [ ] Rust installed (`rustc --version`)
- [ ] Tauri dependencies installed
- [ ] Icons generated (`bun tauri:icon:generate`)
- [ ] Web build successful (`bun run build`)

### During Build
- [ ] No compilation errors
- [ ] All dependencies resolved
- [ ] Linking successful

### After Building
- [ ] Binary exists and is executable
- [ ] Package files created (.deb, .AppImage, .rpm)
- [ ] Binary size is reasonable (3-10 MB)
- [ ] App launches correctly
- [ ] All features work

---

## 📚 Additional Resources

- [Rust Installation Guide](https://www.rust-lang.org/tools/install)
- [Tauri Linux Prerequisites](https://tauri.app/v2/guides/prerequisites/linux/)
- [Cargo Build Documentation](https://doc.rust-lang.org/cargo/commands/cargo-build.html)
- [Rust Optimization Guide](https://nnethercote.github.io/perf-book/)

---

## 🎉 Quick Start Summary

### If you have Rust installed:
```bash
# Run the test build script
./test-build-linux-x64.sh

# Or manually:
bun install
bun run build
bun tauri:build:optimized
```

### If you DON'T have Rust installed:
```bash
# 1. Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. Install Tauri dependencies
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# 3. Restart terminal, then:
./test-build-linux-x64.sh
```

---

**Ready to build! 🚀**
