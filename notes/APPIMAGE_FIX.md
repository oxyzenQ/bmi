# AppImage Build Fix

## 🔍 Issue Found

Your AppImage build is failing because **FUSE2** is not installed.

**Error**: `dlopen(): error loading libfuse.so.2`

---

## ✅ Solution

Install FUSE2 on Arch Linux:

```bash
sudo pacman -S fuse2
```

---

## 🚀 After Installing

Rebuild with AppImage only:

```bash
# Option 1: Using Tauri
bun tauri:build

# Option 2: Manual cargo build + bundle
cd src-tauri
cargo build --release
cd ..
bun tauri:build
```

---

## 📦 What is FUSE2?

**FUSE** (Filesystem in Userspace) allows AppImages to mount themselves as filesystems.

- **fuse2**: Legacy FUSE version (required by linuxdeploy)
- **fuse3**: Modern version (you might already have this)
- **Both can coexist**: Installing fuse2 won't affect fuse3

---

## 🎯 Quick Commands

### Install FUSE2
```bash
sudo pacman -S fuse2
```

### Verify Installation
```bash
pacman -Qi fuse2
```

### Rebuild AppImage
```bash
bun tauri:build
```

### Check Build Output
```bash
ls -lh src-tauri/target/release/bundle/appimage/
```

---

## 📊 Expected Result

After installing FUSE2 and rebuilding:

```
src-tauri/target/release/bundle/appimage/
└── A Simple BMI Calc_1.0.0_amd64.AppImage  (~10-15 MB)
```

---

## 🧪 Test AppImage

After successful build:

```bash
# Make executable (if needed)
chmod +x "src-tauri/target/release/bundle/appimage/A Simple BMI Calc_1.0.0_amd64.AppImage"

# Run it
"src-tauri/target/release/bundle/appimage/A Simple BMI Calc_1.0.0_amd64.AppImage"
```

---

## ⚠️ Alternative: Extract AppImage Without FUSE

If you can't install FUSE2, you can still extract and use the app:

```bash
cd src-tauri/target/release/bundle/appimage/
chmod +x "A Simple BMI Calc_1.0.0_amd64.AppImage"
"A Simple BMI Calc_1.0.0_amd64.AppImage" --appimage-extract

# Run extracted app
./squashfs-root/AppRun
```

---

## 🔧 Why This Happens

- **linuxdeploy** (AppImage bundler) requires FUSE2
- Arch Linux doesn't install FUSE2 by default anymore
- The build tools downloaded but can't run without FUSE2

---

## ✅ Complete Fix Steps

1. **Install FUSE2**:
   ```bash
   sudo pacman -S fuse2
   ```

2. **Clean previous build** (optional):
   ```bash
   rm -rf src-tauri/target/release/bundle/
   ```

3. **Rebuild**:
   ```bash
   bun tauri:build
   ```

4. **Verify output**:
   ```bash
   ls -lh src-tauri/target/release/bundle/appimage/*.AppImage
   ```

5. **Test it**:
   ```bash
   ./src-tauri/target/release/bundle/appimage/*.AppImage
   ```

---

**Install FUSE2, then rebuild! 🚀**
