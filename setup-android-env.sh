#!/bin/bash

# Setup Android Environment for Tauri
# This sets up the required environment variables

echo "🔧 Setting up Android environment for Tauri..."
echo ""

# Find Android SDK location
if [ -d "$HOME/Android/Sdk" ]; then
    ANDROID_SDK="$HOME/Android/Sdk"
elif [ -d "/opt/android-sdk" ]; then
    ANDROID_SDK="/opt/android-sdk"
elif [ -d "/usr/lib/android-sdk" ]; then
    ANDROID_SDK="/usr/lib/android-sdk"
else
    echo "❌ Android SDK not found in common locations"
    echo ""
    echo "Expected locations:"
    echo "  - $HOME/Android/Sdk"
    echo "  - /opt/android-sdk"
    echo "  - /usr/lib/android-sdk"
    echo ""
    echo "Install Android Studio or run:"
    echo "  yay -S android-studio"
    exit 1
fi

echo "✅ Found Android SDK: $ANDROID_SDK"

# Check for NDK
if [ -d "$ANDROID_SDK/ndk" ]; then
    # Find latest NDK version
    NDK_VERSION=$(ls -1 "$ANDROID_SDK/ndk" | sort -V | tail -1)
    ANDROID_NDK="$ANDROID_SDK/ndk/$NDK_VERSION"
    echo "✅ Found Android NDK: $NDK_VERSION"
else
    echo "⚠️  Android NDK not found"
    echo "   Install via Android Studio SDK Manager"
    ANDROID_NDK="$ANDROID_SDK/ndk/26.1.10909125"
fi

# Check for command line tools
if [ -d "$ANDROID_SDK/cmdline-tools/latest" ]; then
    echo "✅ Found command-line tools"
else
    echo "⚠️  Command-line tools not found"
fi

# Check Java
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -1 | cut -d'"' -f2)
    echo "✅ Found Java: $JAVA_VERSION"
    JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))
else
    echo "❌ Java not found"
    echo "   Install: sudo pacman -S jdk-openjdk"
    exit 1
fi

echo ""
echo "📝 Add these to your ~/.zshrc or ~/.bashrc:"
echo ""
echo "# Android Environment"
echo "export ANDROID_HOME=\"$ANDROID_SDK\""
echo "export ANDROID_NDK_HOME=\"$ANDROID_NDK\""
echo "export JAVA_HOME=\"$JAVA_HOME\""
echo "export PATH=\$PATH:\$ANDROID_HOME/platform-tools"
echo "export PATH=\$PATH:\$ANDROID_HOME/cmdline-tools/latest/bin"
echo "export PATH=\$PATH:\$ANDROID_HOME/emulator"
echo ""
echo "Then run: source ~/.zshrc"
echo ""

# Offer to append
read -p "Do you want to append these to ~/.zshrc? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "" >> ~/.zshrc
    echo "# Android Environment (added by setup-android-env.sh)" >> ~/.zshrc
    echo "export ANDROID_HOME=\"$ANDROID_SDK\"" >> ~/.zshrc
    echo "export ANDROID_NDK_HOME=\"$ANDROID_NDK\"" >> ~/.zshrc
    echo "export JAVA_HOME=\"$JAVA_HOME\"" >> ~/.zshrc
    echo "export PATH=\$PATH:\$ANDROID_HOME/platform-tools" >> ~/.zshrc
    echo "export PATH=\$PATH:\$ANDROID_HOME/cmdline-tools/latest/bin" >> ~/.zshrc
    echo "export PATH=\$PATH:\$ANDROID_HOME/emulator" >> ~/.zshrc
    echo ""
    echo "✅ Added to ~/.zshrc"
    echo ""
    echo "🔄 Run this to apply changes:"
    echo "   source ~/.zshrc"
    echo ""
    echo "Then try again:"
    echo "   bun tauri android init"
else
    echo ""
    echo "Copy the commands above manually"
fi
