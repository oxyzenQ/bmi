#!/bin/bash

# A Simple BMI Calc - One-Click Development Script
# Author: Rezky Nightly
# Package Manager: Bun

echo "🚀 A Simple BMI Calc - Development Setup"
echo "========================================="

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

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    print_error "Bun is not installed. Please install Bun first: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

print_success "Bun $(bun -v) detected"

# Clean previous builds
print_status "Cleaning previous builds..."
bun run clean 2>/dev/null || true

# Install dependencies
print_status "Installing dependencies..."
if bun install; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Run type checking
print_status "Running type checking..."
if bun run type-check; then
    print_success "Type checking passed"
else
    print_warning "Type checking failed - continuing anyway"
fi

# Run linting
print_status "Running linting..."
if bun run lint; then
    print_success "Linting passed"
else
    print_warning "Linting failed - continuing anyway"
fi

# Start development server
print_status "Starting development server..."
echo ""
echo "🎉 Development server starting..."
echo "📱 Local: http://localhost:5173"
echo "🌐 Network: http://$(hostname -i | awk '{print $1}'):5173"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the development server
bun run dev
