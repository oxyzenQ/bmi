#!/bin/bash

# Install A Simple BMI Calc on Arch Linux
# This installs the standalone binary to ~/.local/bin

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { printf "${BLUE}[INFO]${NC} %s\n" "$1"; }
print_success() { printf "${GREEN}[SUCCESS]${NC} %s\n" "$1"; }
print_error() { printf "${RED}[ERROR]${NC} %s\n" "$1"; }

clear
echo "╔════════════════════════════════════════════════════════╗"
echo "║   A Simple BMI Calc - Arch Linux Installation         ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

BINARY="src-tauri/target/release/a-simple-bmi-calc"
INSTALL_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_SOURCE="src-tauri/icons/128x128.png"
ICON_DIR="$HOME/.local/share/icons/hicolor/128x128/apps"

# Check if binary exists
if [ ! -f "$BINARY" ]; then
    print_error "Binary not found at $BINARY"
    echo ""
    echo "Build it first with:"
    echo "  bun tauri:build"
    exit 1
fi

print_success "Binary found"
echo ""

# Create directories
print_status "Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$DESKTOP_DIR"
mkdir -p "$ICON_DIR"

# Copy binary
print_status "Installing binary to $INSTALL_DIR..."
cp "$BINARY" "$INSTALL_DIR/a-simple-bmi-calc"
chmod +x "$INSTALL_DIR/a-simple-bmi-calc"
print_success "Binary installed"

# Copy icon
if [ -f "$ICON_SOURCE" ]; then
    print_status "Installing icon..."
    cp "$ICON_SOURCE" "$ICON_DIR/a-simple-bmi-calc.png"
    print_success "Icon installed"
fi

# Create desktop entry
print_status "Creating desktop entry..."
cat > "$DESKTOP_DIR/a-simple-bmi-calc.desktop" << EOF
[Desktop Entry]
Type=Application
Name=A Simple BMI Calc
Exec=$INSTALL_DIR/a-simple-bmi-calc
Icon=a-simple-bmi-calc
Categories=Utility;Health;
Terminal=false
Comment=A simple BMI calculator with space-themed design
EOF

# Update desktop database
if command -v update-desktop-database &> /dev/null; then
    print_status "Updating desktop database..."
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║              INSTALLATION COMPLETE                     ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
print_success "A Simple BMI Calc installed successfully!"
echo ""
echo "🚀 Run it:"
printf "  ${GREEN}a-simple-bmi-calc${NC}\n"
echo ""
echo "📱 Or find it in your application menu: 'BMI'"
echo ""
echo "🗑️  Uninstall with:"
printf "  ${GREEN}rm $INSTALL_DIR/a-simple-bmi-calc${NC}\n"
printf "  ${GREEN}rm $DESKTOP_DIR/a-simple-bmi-calc.desktop${NC}\n"
printf "  ${GREEN}rm $ICON_DIR/a-simple-bmi-calc.png${NC}\n"
echo ""

# Check if ~/.local/bin is in PATH
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo "⚠️  Warning: ~/.local/bin is not in your PATH"
    echo ""
    echo "Add this to your ~/.zshrc or ~/.bashrc:"
    printf "  ${GREEN}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}\n"
    echo ""
    echo "Then run:"
    printf "  ${GREEN}source ~/.zshrc${NC}  # or source ~/.bashrc\n"
    echo ""
fi
