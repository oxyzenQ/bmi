#!/bin/bash

# BMI Calculator SvelteKit - One-Click Production Build Script
# Author: Rezky Nightly

echo "🏗️  BMI Calculator SvelteKit - Production Build"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

print_success "Node.js $(node -v) detected"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_success "npm $(npm -v) detected"

# Clean previous builds
print_status "Cleaning previous builds..."
npm run clean 2>/dev/null || true

# Install dependencies
print_status "Installing dependencies..."
if npm install; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Run type checking
print_status "Running type checking..."
if npm run type-check; then
    print_success "Type checking passed"
else
    print_error "Type checking failed"
    exit 1
fi

# Run linting
print_status "Running linting..."
if npm run lint; then
    print_success "Linting passed"
else
    print_error "Linting failed"
    exit 1
fi

# Run tests
print_status "Running tests..."
if npm run test:run; then
    print_success "Tests passed"
else
    print_warning "Tests failed - continuing anyway"
fi

# Build for production
print_status "Building for production..."
if npm run build; then
    print_success "Production build completed successfully"
else
    print_error "Production build failed"
    exit 1
fi

# Check if build directory exists
if [ ! -d ".svelte-kit/output" ]; then
    print_error "Build directory not found"
    exit 1
fi

# Show build info
echo ""
echo "📊 Build Information:"
echo "===================="
BUILD_SIZE=$(du -sh build 2>/dev/null | cut -f1)
echo "📦 Build size: $BUILD_SIZE"
echo "📁 Build directory: ./build"
echo ""

# Start production server
print_status "Starting production server..."
echo ""
echo "🎉 Production server starting..."
echo "📱 Local: http://localhost:4173"
echo "🌐 Network: http://$(hostname -i | awk '{print $1}'):4173"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the production server
npm run preview
