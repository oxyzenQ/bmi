# Icon Generation and Custom Build Configuration

## 📱 App Icon Configuration

### Icon Source
- **Original Icon**: `static/assets/logobmii.webp`
- **Generated Icons**: `src-tauri/icons/`

### Generated Icon Formats

#### Desktop Icons
- `icon.icns` - macOS app icon
- `icon.ico` - Windows app icon  
- `32x32.png` - Small icon
- `64x64.png` - Medium icon
- `128x128.png` - Large icon
- `128x128@2x.png` - Retina display icon
- `icon.png` - Main PNG icon (1024x1024)

#### Windows Store (Appx)
- `StoreLogo.png` - 50x50
- `Square30x30Logo.png` - 30x30
- `Square44x44Logo.png` - 44x44
- `Square71x71Logo.png` - 71x71
- `Square89x89Logo.png` - 89x89
- `Square107x107Logo.png` - 107x107
- `Square142x142Logo.png` - 142x142
- `Square150x150Logo.png` - 150x150
- `Square284x284Logo.png` - 284x284
- `Square310x310Logo.png` - 310x310

#### Android Icons
Located in `src-tauri/icons/android/`:
- `mipmap-mdpi/` - 48x48 (~160dpi)
- `mipmap-hdpi/` - 72x72 (~240dpi)
- `mipmap-xhdpi/` - 96x96 (~320dpi)
- `mipmap-xxhdpi/` - 144x144 (~480dpi)
- `mipmap-xxxhdpi/` - 192x192 (~640dpi)

Each density includes:
- `ic_launcher.png` - Standard launcher icon
- `ic_launcher_round.png` - Round launcher icon
- `ic_launcher_foreground.png` - Adaptive icon foreground

#### iOS Icons
Located in `src-tauri/icons/ios/`:
- Multiple sizes from 20x20 to 512x512
- Includes @1x, @2x, and @3x variants
- App Store icon (1024x1024)

---

## 🔧 Icon Generation

### Manual Generation

```bash
# Generate all icons from source
bun tauri:icon:generate
# or
./generate-icons.sh
```

This script:
1. Converts WebP to PNG
2. Makes the image square (1024x1024)
3. Generates all platform-specific icons
4. Places them in `src-tauri/icons/`

### From Custom Image

```bash
# From any square PNG/JPEG (recommended: 1024x1024 or larger)
bunx @tauri-apps/cli icon path/to/your-icon.png
```

### Requirements
- **Source image**: Square (1:1 aspect ratio)
- **Recommended size**: 1024x1024 pixels or larger
- **Format**: PNG, JPEG, or WebP
- **Background**: Transparent PNG recommended for best results

### Dependencies
- **ImageMagick** (optional but recommended)
  ```bash
  # macOS
  brew install imagemagick
  
  # Ubuntu/Debian
  sudo apt install imagemagick
  
  # Arch Linux
  sudo pacman -S imagemagick
  ```

---

## 🏗️ Custom Build Configuration

### Tauri Configuration

File: `src-tauri/tauri.conf.json`

#### Build Settings
```json
{
  "build": {
    "beforeDevCommand": "bun run dev",
    "beforeBuildCommand": "bun run build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../build",
    "runner": null
  }
}
```

#### Bundle Configuration
```json
{
  "bundle": {
    "active": true,
    "targets": "all",
    "createUpdaterArtifacts": false,
    "category": "Utility",
    "shortDescription": "A simple BMI calculator",
    "copyright": "Copyright (c) 2025 Rezky Nightky"
  }
}
```

### Platform-Specific Settings

#### Windows (NSIS Installer)
```json
{
  "windows": {
    "webviewInstallMode": {
      "type": "downloadBootstrapper"
    },
    "nsis": {
      "installMode": "currentUser",
      "languages": ["en-US"]
    }
  }
}
```

#### macOS
```json
{
  "macOS": {
    "minimumSystemVersion": "11.0",
    "hardenedRuntime": true,
    "useBootstrapper": false
  }
}
```

#### Linux
```json
{
  "linux": {
    "deb": {
      "section": "utility",
      "priority": "optional"
    },
    "appimage": {
      "bundleMediaFramework": false
    },
    "rpm": {
      "epoch": 0,
      "release": "1"
    }
  }
}
```

#### Android
```json
{
  "android": {
    "minSdkVersion": 24,
    "versionCode": 1,
    "stripDebugSymbols": true,
    "splitPerAbi": true,
    "apkName": "a-simple-bmi-calc"
  }
}
```

---

## 📦 Build Output Structure

### Default Output Locations

```
src-tauri/target/
├── debug/                    # Development builds
│   └── a-simple-bmi-calc    # Debug binary
└── release/                  # Production builds
    ├── bundle/              # Platform packages
    │   ├── deb/            # Linux .deb
    │   ├── appimage/       # Linux .AppImage
    │   ├── dmg/            # macOS .dmg
    │   ├── macos/          # macOS .app
    │   ├── nsis/           # Windows installer
    │   └── msi/            # Windows MSI
    └── a-simple-bmi-calc    # Optimized binary
```

### Android Output

```
src-tauri/gen/android/app/build/outputs/
├── apk/
│   ├── arm64-v8a/
│   │   └── app-arm64-v8a-release.apk
│   ├── armeabi-v7a/
│   │   └── app-armeabi-v7a-release.apk
│   ├── x86/
│   │   └── app-x86-release.apk
│   ├── x86_64/
│   │   └── app-x86_64-release.apk
│   └── universal/
│       └── app-universal-release.apk
└── bundle/
    └── release/
        └── app-release.aab         # For Play Store
```

---

## 🚀 Build Commands

### Standard Builds
```bash
# Desktop (current platform)
bun tauri:build

# Android
bun tauri:build:android

# Web only
bun run build
```

### Optimized Builds
```bash
# ARM64 optimized
bun tauri:build:arm64

# Native CPU optimization
bun tauri:build:optimized

# Custom build (with environment variable)
bun tauri:build:custom
```

### Icon Management
```bash
# Generate icons from logobmii.webp
bun tauri:icon:generate

# Generate from custom image
bun tauri:icon path/to/icon.png
```

---

## 🎨 Customization

### Change App Icon

1. **Replace source image**:
   ```bash
   cp your-new-icon.png static/assets/logobmii.webp
   ```

2. **Regenerate icons**:
   ```bash
   bun tauri:icon:generate
   ```

3. **Rebuild app**:
   ```bash
   bun tauri:build
   ```

### Custom Output Directory

Set environment variable before building:
```bash
# Linux/macOS
export TAURI_TARGET_DIR=/path/to/custom/output
bun tauri:build

# Windows
set TAURI_TARGET_DIR=C:\path\to\custom\output
bun tauri:build
```

### Custom Bundle Name

Edit `src-tauri/tauri.conf.json`:
```json
{
  "productName": "Your Custom Name",
  "identifier": "com.yourcompany.appname"
}
```

### Custom Version

Update both files:
- `package.json`: `"version": "1.0.0"`
- `src-tauri/tauri.conf.json`: `"version": "1.0.0"`
- `src-tauri/Cargo.toml`: `version = "1.0.0"`

---

## 📝 Build Metadata

### Package Information
- **Name**: a-simple-bmi-calc
- **Display Name**: A Simple BMI Calc
- **Identifier**: com.rezkynightky.simplebmicalc
- **Category**: Utility
- **Version**: 1.0.0
- **License**: MIT
- **Author**: Rezky Nightky

### Supported Platforms
- ✅ Windows (x64, ARM64)
- ✅ macOS (Intel, Apple Silicon)
- ✅ Linux (x64, ARM64)
- ✅ Android (all ABIs)
- 🔜 iOS (future)

---

## 🔍 Troubleshooting

### Icon Generation Issues

**Problem**: "Source image must be square"
```bash
# Solution: Use the generate-icons.sh script
./generate-icons.sh
```

**Problem**: ImageMagick not found
```bash
# Install ImageMagick
brew install imagemagick    # macOS
sudo apt install imagemagick    # Linux
```

### Build Issues

**Problem**: Icons not found during build
```bash
# Regenerate icons
bun tauri:icon:generate

# Verify icons exist
ls -la src-tauri/icons/
```

**Problem**: Custom output directory not working
```bash
# Ensure environment variable is set
echo $TAURI_TARGET_DIR

# Use absolute path
export TAURI_TARGET_DIR=$(pwd)/custom-build
```

### Android Icon Issues

**Problem**: Android icons not showing
```bash
# Regenerate Android icons
./generate-icons.sh

# Check Android icon directories
ls -la src-tauri/icons/android/
```

---

## 📚 Additional Resources

- [Tauri Icon Documentation](https://tauri.app/v2/guides/features/icons/)
- [Tauri Build Configuration](https://tauri.app/v2/reference/config/)
- [Android Icon Guidelines](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)
- [iOS Icon Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Windows App Icons](https://docs.microsoft.com/en-us/windows/apps/design/style/iconography/app-icon-design)

---

## ✅ Checklist

### Before Building
- [ ] Icon source exists (`static/assets/logobmii.webp`)
- [ ] Icons generated (`bun tauri:icon:generate`)
- [ ] Web build completed (`bun run build`)
- [ ] Version numbers updated in all files
- [ ] Bundle name and identifier configured

### After Building
- [ ] Test app launches correctly
- [ ] Icon displays properly
- [ ] App size is reasonable
- [ ] All features work
- [ ] Signing/certificates configured (if needed)

---

**Icon Management Made Easy! 🎨**
