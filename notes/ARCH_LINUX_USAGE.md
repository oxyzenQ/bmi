# Using Your App on Arch Linux

## ⚠️ Important: DEB Packages Don't Work on Arch

**Problem**: You built a DEB package, but it **cannot be installed on Arch Linux**.

```bash
# This FAILS on Arch:
sudo dpkg -i "A Simple BMI Calc_1.0.0_amd64.deb"
# Error: libwebkit2gtk-4.1-0 not found (Debian package names)
```

**Why**: 
- DEB packages are for **Debian/Ubuntu** systems
- They reference Debian-specific package names
- Arch uses different package names and pacman

---

## ✅ Solution: Use the Standalone Binary

### Run Your App on Arch
```bash
# Just run the binary directly
./src-tauri/target/release/a-simple-bmi-calc
```

**This works perfectly!** Your app is already running (check your desktop).

---

## 📦 Distribution Options

### For Arch Linux Users (Your System)
**Option 1: Standalone Binary** (Recommended)
```bash
# Copy binary to user bin
cp src-tauri/target/release/a-simple-bmi-calc ~/.local/bin/
# Run from anywhere
a-simple-bmi-calc
```

**Option 2: Create AUR Package** (Best for sharing)
```bash
# Create PKGBUILD for Arch User Repository
# Users install with: yay -S a-simple-bmi-calc
```

### For Debian/Ubuntu Users (Others)
**Use the DEB package you built**:
```bash
# Users on Debian/Ubuntu can install:
sudo dpkg -i "A Simple BMI Calc_1.0.0_amd64.deb"
sudo apt-get install -f  # Fix dependencies
```

---

## 🎯 Quick Setup (Arch Linux)

### 1. Install to User Directory
```bash
# Create local bin directory if it doesn't exist
mkdir -p ~/.local/bin

# Copy binary
cp src-tauri/target/release/a-simple-bmi-calc ~/.local/bin/

# Make sure ~/.local/bin is in PATH (add to ~/.zshrc if needed)
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Run from anywhere
a-simple-bmi-calc
```

### 2. Create Desktop Entry (Optional)
```bash
# Create desktop file
cat > ~/.local/share/applications/a-simple-bmi-calc.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=A Simple BMI Calc
Exec=/home/rezky_nightky/.local/bin/a-simple-bmi-calc
Icon=/home/rezky_nightky/git-repo/DEVV3/src-tauri/icons/128x128.png
Categories=Utility;Health;
Terminal=false
Comment=A simple BMI calculator
EOF

# Update desktop database
update-desktop-database ~/.local/share/applications/
```

Now it appears in your application menu!

---

## 🔧 Why Build DEB Then?

**Good question!** DEB packages are useful for:

1. **Distribution to Debian/Ubuntu users** - Share with friends on Ubuntu
2. **Testing packaging** - Ensure your metadata is correct
3. **CI/CD pipelines** - Automated builds for multiple platforms

**On Arch**, you should:
- Use the binary directly
- Or create an AUR package (PKGBUILD)

---

## 📚 Creating an AUR Package (Advanced)

If you want to share on Arch User Repository:

```bash
# Create PKGBUILD
cat > PKGBUILD << 'EOF'
pkgname=a-simple-bmi-calc
pkgver=1.0.0
pkgrel=1
pkgdesc="A simple BMI calculator with space-themed design"
arch=('x86_64')
url="https://github.com/yourusername/a-simple-bmi-calc"
license=('MIT')
depends=('webkit2gtk-4.1' 'gtk3')
source=("a-simple-bmi-calc-$pkgver::https://github.com/yourusername/releases/download/v$pkgver/a-simple-bmi-calc")
sha256sums=('SKIP')

package() {
    install -Dm755 "$srcdir/a-simple-bmi-calc-$pkgver" "$pkgdir/usr/bin/a-simple-bmi-calc"
}
EOF

# Build package
makepkg -si

# Users install with:
# yay -S a-simple-bmi-calc
```

---

## ✅ Current Status

Your app is **already running** (Process: 21161)!

Check your desktop - the BMI Calculator window should be open.

---

## 🎯 Recommended Workflow

### Development (Arch Linux)
```bash
./dev.sh                                    # Develop
bun tauri:build                            # Build
./src-tauri/target/release/a-simple-bmi-calc  # Test
```

### Distribution
```bash
# For Debian/Ubuntu users
./build-deb.sh                             # Build DEB
# Share: A Simple BMI Calc_1.0.0_amd64.deb

# For Arch users
# Share: the standalone binary
# Or: Create AUR package
```

---

## 📊 Summary

| System | Method | Command |
|--------|--------|---------|
| **Arch Linux** | Binary | `./src-tauri/target/release/a-simple-bmi-calc` |
| **Arch Linux** | AUR | `yay -S a-simple-bmi-calc` (if you create it) |
| **Debian/Ubuntu** | DEB | `sudo dpkg -i *.deb` |
| **Any Linux** | Binary | Download and run binary |

---

## 🚀 Next Steps

1. **Test your app** - It's running now! (Check desktop)
2. **Install to ~/.local/bin** - Run from anywhere
3. **Create desktop entry** - Add to app menu
4. **Share binary** - Give to Arch users
5. **Share DEB** - Give to Ubuntu users

---

**Your app works perfectly on Arch! Just use the binary instead of DEB packages.** 🎉
