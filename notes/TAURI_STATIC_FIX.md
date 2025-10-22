# Tauri Static Build Fix

## 🐛 Issues Fixed

### 1. "asset not found: index.html"
**Problem**: Tauri couldn't find the web frontend files.

**Cause**: Using `@sveltejs/adapter-vercel` which doesn't generate static files. Tauri needs static HTML/JS/CSS files.

**Solution**: Changed to `@sveltejs/adapter-static`

---

### 2. "Could not connect to localhost: Connection refused"
**Problem**: App showing blank white window trying to connect to localhost:5173

**Cause**: Binary was built before configuration changes, still trying to connect to dev server.

**Solution**: Rebuilt binary after configuration changes

---

## ✅ Changes Made

### 1. Changed SvelteKit Adapter
**File**: `svelte.config.js`

```javascript
// Before (Vercel - for SSR)
import adapter from '@sveltejs/adapter-vercel';

// After (Static - for Tauri)
import adapter from '@sveltejs/adapter-static';
```

**Configuration**:
```javascript
adapter: adapter({
    pages: 'build',
    assets: 'build',
    fallback: 'index.html',
    precompress: false,
    strict: true
})
```

---

### 2. Updated Tauri Config
**File**: `src-tauri/tauri.conf.json`

```json
{
  "build": {
    "frontendDist": "../build"  // Changed from "../.svelte-kit/output/client"
  }
}
```

---

### 3. Added Prerendering
**File**: `src/routes/+layout.ts` (NEW)

```typescript
export const prerender = true;
export const ssr = false;
```

This tells SvelteKit to:
- Pre-render all pages at build time
- Disable server-side rendering (not needed in desktop app)

---

### 4. Cleaned Up Rust Code
**File**: `src-tauri/src/lib.rs`

```rust
// Removed debug code that opens devtools
// Removed unused imports
// Simplified to minimal working code
```

---

## 📊 How It Works Now

### Build Process
```
1. bun run build
   ↓
2. SvelteKit static adapter generates files
   ↓
3. Output: build/index.html + assets
   ↓
4. cargo build --release
   ↓
5. Tauri bundles build/ directory into binary
   ↓
6. Binary loads index.html from embedded assets
```

---

## 🔍 Key Differences

### Vercel Adapter (SSR - Server-Side Rendering)
- ❌ Generates server functions
- ❌ Requires Node.js runtime
- ❌ No static index.html
- ❌ Can't work with Tauri

### Static Adapter (SSG - Static Site Generation)
- ✅ Generates pure HTML/CSS/JS
- ✅ No server needed
- ✅ Creates index.html
- ✅ Perfect for Tauri

---

## 🚀 Building Now

### Complete Build
```bash
# 1. Build web frontend (static)
bun run build

# 2. Build Rust binary (with embedded web files)
cd src-tauri
cargo build --release

# 3. Install
cd ..
./install-arch.sh
```

### Or Use Build Script
```bash
# This does everything
./build-deb.sh  # Includes web build + cargo build
```

---

## ✅ Verification

### Check Static Files
```bash
ls -la build/
# Should see: index.html, _app/, assets/
```

### Check Binary Works
```bash
a-simple-bmi-calc
# Should open with working UI, no errors
```

---

## 📝 Dependencies Added

```bash
bun add -D @sveltejs/adapter-static
```

**Note**: You can keep `@sveltejs/adapter-vercel` for web deployments if needed, just switch adapters in `svelte.config.js` depending on target.

---

## 🎯 Summary

**Problem**: Tauri needs static files, Vercel adapter doesn't provide them  
**Solution**: Use static adapter + proper configuration  
**Result**: Working desktop app with embedded frontend ✅

---

**Your app now works perfectly!** 🎉
