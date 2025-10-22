# Arch Linux Setup for Tauri Development

## 🎯 Quick Fix - Install Missing Dependencies

Your build failed because **webkit2gtk-4.1** is not installed.

### Install All Tauri Dependencies (One Command)

```bash
sudo pacman -S --needed \
  webkit2gtk-4.1 \
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

### After Installation

Run the build again:
```bash
./test-build-linux-x64.sh
# or
bun tauri:build:optimized
```

---

## 📦 Package Breakdown

| Package | Purpose |
|---------|---------|
| **webkit2gtk-4.1** | WebView engine (REQUIRED) |
| **base-devel** | Compilation tools (gcc, make, etc.) |
| **curl, wget** | Download utilities |
| **file** | File type detection |
| **openssl** | SSL/TLS support |
| **appmenu-gtk-module** | App menu integration |
| **gtk3** | GTK UI toolkit |
| **libappindicator-gtk3** | System tray support |
| **librsvg** | SVG rendering |
| **libvips** | Image processing |

---

## ✅ Verification

After installing, verify webkit2gtk is available:

```bash
# Check if installed
pacman -Qi webkit2gtk-4.1

# Check pkg-config
pkg-config --modversion javascriptcoregtk-4.1
```

Expected output: `2.50.1` (or similar version)

---

## 🚀 Build Commands

Once dependencies are installed:

### Standard Build
```bash
bun tauri:build
```

### Optimized Build (Recommended)
```bash
bun tauri:build:optimized
```

### Test Build with Validation
```bash
./test-build-linux-x64.sh
```

---

## 📊 Expected Results

After successful build:

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

---

## 🐛 Troubleshooting

### "webkit2gtk-4.1 not found"
```bash
# Update package database
sudo pacman -Sy

# Install webkit2gtk-4.1
sudo pacman -S webkit2gtk-4.1
```

### "Package not in sync with database"
```bash
# Full system update
sudo pacman -Syu

# Then install dependencies
sudo pacman -S webkit2gtk-4.1
```

### Check installed version
```bash
pacman -Q webkit2gtk-4.1
```

---

## 💡 Why This Happened

Tauri uses the system's WebView for rendering the UI (unlike Electron which bundles Chromium). On Linux, this means:

- **Uses**: webkit2gtk (lightweight, ~40 MB installed)
- **NOT using**: Full Chromium bundle (~100+ MB)
- **Benefit**: Much smaller app size (3-5 MB vs 100+ MB)

That's why webkit2gtk is **required** for Tauri builds on Linux.

---

## 📚 Additional Resources

- [Tauri Prerequisites - Linux](https://tauri.app/v2/guides/prerequisites/linux/)
- [Arch Linux Wiki - WebKit](https://wiki.archlinux.org/title/WebKit)
- [Tauri Documentation](https://tauri.app/v2/)

---

**Install the dependencies above, then run the build again! 🚀**
