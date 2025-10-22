# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-10-22

### Added

- ✅ **DEB Package Build** - Optimized Debian package builder
  - `build-deb.sh` - One-click DEB package creation
  - Removed AppImage/RPM support (DEB-only focus)
  - Optimized for Arch Linux development
  - 3.2 MB package size

- ✅ **Project Organization** - Clean structure
  - `notes/` directory for documentation
  - Moved 10 MD files to notes/
  - Removed unused build scripts
  - Simplified package.json commands

### Previous Features
- ✅ **Custom Build Configuration** - Enhanced Tauri build settings
  - Custom output directory support
  - Platform-specific bundle configurations
  - Windows NSIS installer settings
  - Linux deb/rpm/AppImage options
  - Android split APK naming
  - Bundle metadata (description, copyright, category)
  - generate-icons.sh script for icon generation
  - ICON_AND_BUILD_CONFIG.md comprehensive guide

- ✅ **App Icon System** - Complete icon generation from logobmii.webp
  - 50+ icon sizes generated automatically
  - Desktop icons (Windows .ico, macOS .icns, PNG)
  - Android adaptive icons (all densities)
  - iOS icons (all sizes)
  - Windows Store icons (Appx)
  - Script to convert WebP to square PNG

- ✅ **ARM64 Build Optimizations** - 50-60% smaller binaries
  - Optimized Cargo profiles (LTO, opt-level=z)
  - Architecture-specific compiler flags
  - .cargo/config.toml for ARM64 targets
  - build-arm64.sh script for automated builds
  - Vite production optimizations
  - Split APKs per ABI for Android
  - BUILD_OPTIMIZATION.md comprehensive guide

- ✅ **Tauri 2.0 Integration** - Desktop and Android app support
  - Desktop builds for Windows, macOS, Linux
  - Android APK/AAB builds
  - Rust-based backend for performance
  - Native system WebView rendering
  - App icon generation support
  - Complete Tauri configuration in `src-tauri/`
  - Comprehensive Tauri development guide (TAURI_GUIDE.md)

### Changed
- 🔄 **Package Manager Migration** - npm → Bun
  - All scripts updated to use Bun
  - Faster dependency installation
  - Better performance in CI/CD
  - Updated shell scripts (dev.sh, build.sh, info.sh)

- 📝 **Project Renamed** - "BMI Calculator SvelteKit" → "A Simple BMI Calc"
  - Updated all documentation
  - Updated package.json metadata
  - Updated HTML meta tags
  - Updated shell script headers

- 🤖 **Optimized Dependabot**
  - Grouped dependency updates
  - Auto-merge enabled for dependency PRs
  - Automatic branch cleanup
  - Reduced PR count by ~70%
  - Timezone changed to Asia/Jakarta

- 📚 **Documentation Updates**
  - README.md - Added Tauri instructions and Bun commands
  - MAINTENANCE_GUIDE.md - Updated tech stack
  - MIGRATION_TO_BUN.md - Complete migration guide
  - TAURI_GUIDE.md - New comprehensive Tauri guide

### Removed
- ❌ **Capacitor/Cordova** - Replaced with Tauri
  - Removed codemagic.yaml (Capacitor CI/CD)
  - No more Capacitor dependencies
  
- ❌ **Unused Files**
  - src/app-deprecated.css (72KB deprecated styles)
  - package-lock.json (npm lock file)
  - .github/workflows/nextjs.yml (incorrect workflow)

### Fixed
- 🔧 vercel.json - Updated build command to use Bun
- 🔧 .gitignore - Added Tauri build artifacts
- 🔧 Clean script - Now removes Tauri target directory

### Security
- 🔐 Tauri capabilities configured for minimal permissions
- 🔐 CSP (Content Security Policy) ready for configuration
- 🔐 Android permissions auto-managed by Tauri

---

## Project Statistics

**Before Migration:**
- Package Manager: npm
- Mobile: Capacitor (not implemented)
- Dependencies: 48 packages
- Build Time: ~15s
- Bundle Size: Standard SvelteKit

**After Migration:**
- Package Manager: Bun (4x faster installs)
- Desktop/Mobile: Tauri 2.0 (Rust-based)
- Dependencies: 49 packages (+Tauri CLI)
- Build Time: ~8s (web), ~45s (desktop first build)
- Bundle Size: 3-5MB (desktop), ~8MB (Android)

---

## Migration Summary

### Phase 1: Package Manager (Bun)
- Removed npm artifacts
- Updated all scripts and documentation
- Created new GitHub Actions workflows
- Optimized Dependabot configuration

### Phase 2: Project Rename
- Updated project name across all files
- Renamed to "A Simple BMI Calc"
- Updated meta tags and SEO

### Phase 3: Tauri Integration
- Removed Capacitor/Cordova
- Created Tauri configuration
- Added Rust source files
- Updated build system
- Added comprehensive documentation

---

## Next Release Plans

### Planned Features
- [ ] iOS support via Tauri
- [ ] Auto-update functionality (desktop)
- [ ] System tray integration (desktop)
- [ ] Native notifications
- [ ] Offline PWA support
- [ ] Multi-language support

### Improvements
- [ ] Icon set generation
- [ ] CI/CD for Tauri builds
- [ ] Code signing automation
- [ ] Play Store deployment guide

---

**Full Documentation:**
- [README.md](README.md) - Quick start guide
- [TAURI_GUIDE.md](TAURI_GUIDE.md) - Complete Tauri setup
- [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) - Project maintenance
- [MIGRATION_TO_BUN.md](MIGRATION_TO_BUN.md) - Migration details
