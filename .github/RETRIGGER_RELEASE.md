# Re-trigger Release for Tag 1.0

The workflow has been fixed! Follow these steps to re-trigger the release:

## Steps

```bash
# 1. Stage and commit the workflow fix
git add .github/workflows/release.yml
git commit -m "Fix: Use static adapter for release builds"

# 2. Push the commit
git push origin main

# 3. Delete the existing 1.0 tag locally and remotely
git tag -d 1.0
git push origin :refs/tags/1.0

# 4. Create the tag again on the latest commit
git tag -a 1.0 -m "Unleash"

# 5. Push the tag to trigger the release workflow
git push origin 1.0
```

## What Was Fixed

The workflow now:
- ✅ Installs `@sveltejs/adapter-static` during CI
- ✅ Temporarily switches to static adapter for the build
- ✅ Enables prerendering for static export
- ✅ Outputs to `build/` directory (instead of `.vercel/output`)
- ✅ Restores original Vercel adapter config after build
- ✅ Creates the release package from the static build

The release will now succeed! 🚀
