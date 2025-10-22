# Quick Build Commands Reference

## 🚀 Standard Builds

```bash
# Web only
bun run build

# Desktop (current platform)
bun tauri:build

# Android
bun tauri:build:android
```

## ⚡ Optimized Builds

```bash
# ARM64 (macOS/Linux) - 50-60% smaller
bun tauri:build:arm64

# Native CPU optimization
bun tauri:build:optimized

# Web production build
bun run build:optimized
```

## 📊 Analysis

```bash
# Bundle size analysis
bun run analyze

# Build info
bun tauri info

# Check targets
rustup target list | grep installed
```

## 🏗️ Platform-Specific

### macOS Apple Silicon
```bash
rustup target add aarch64-apple-darwin
cd src-tauri && cargo build --release --target aarch64-apple-darwin
```

### Linux ARM64
```bash
rustup target add aarch64-unknown-linux-gnu
cd src-tauri && cargo build --release --target aarch64-unknown-linux-gnu
```

### Android ARM64
```bash
bun tauri android init
bun tauri:build:android
```

## 📝 Notes

- First ARM64 build takes ~2-3 minutes (compiles Rust)
- Subsequent builds: ~10-60 seconds
- Output: `src-tauri/target/[arch]/release/bundle/`
- See [BUILD_OPTIMIZATION.md](../BUILD_OPTIMIZATION.md) for details
