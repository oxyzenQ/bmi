#!/bin/bash

# Generate App Icons from logobmii.webp
# Author: Rezky Nightly

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "🎨 Generating App Icons"
echo "======================="
echo ""

SOURCE_IMAGE="static/assets/logobmii.webp"
TEMP_PNG="temp-icon-1024.png"
OUTPUT_DIR="src-tauri/icons"

# Check if source exists
if [ ! -f "$SOURCE_IMAGE" ]; then
    print_error "Source image not found: $SOURCE_IMAGE"
    exit 1
fi

print_status "Source image: $SOURCE_IMAGE"

# Check for ImageMagick
if command -v convert &> /dev/null; then
    print_status "Converting WebP to PNG with ImageMagick..."
    
    # Convert to PNG and make it square (1024x1024)
    # This will resize to fit within 1024x1024 and center on transparent background
    convert "$SOURCE_IMAGE" \
        -background none \
        -gravity center \
        -extent 1024x1024 \
        "$TEMP_PNG"
    
    print_success "Converted to square PNG: $TEMP_PNG"
    
elif command -v magick &> /dev/null; then
    print_status "Converting WebP to PNG with ImageMagick..."
    
    magick "$SOURCE_IMAGE" \
        -background none \
        -gravity center \
        -extent 1024x1024 \
        "$TEMP_PNG"
    
    print_success "Converted to square PNG: $TEMP_PNG"
    
else
    print_warning "ImageMagick not found. Trying direct conversion..."
    print_warning "Note: Icon may not be perfectly square"
    print_warning "Install ImageMagick for best results: brew install imagemagick (macOS) or apt install imagemagick (Linux)"
    
    # Try using Tauri directly with webp (may fail if not square)
    cp "$SOURCE_IMAGE" "$TEMP_PNG"
fi

# Generate icons using Tauri CLI
print_status "Generating icons with Tauri..."
echo ""

if bunx @tauri-apps/cli icon "$TEMP_PNG" --output "$OUTPUT_DIR"; then
    print_success "Icons generated successfully!"
else
    print_error "Failed to generate icons"
    rm -f "$TEMP_PNG"
    exit 1
fi

# Clean up
rm -f "$TEMP_PNG"

# List generated icons
echo ""
print_status "Generated icons:"
ls -lh "$OUTPUT_DIR/"

echo ""
print_success "Icon generation complete!"
print_status "Icons location: $OUTPUT_DIR/"
echo ""
