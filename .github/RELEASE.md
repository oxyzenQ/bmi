# Release Process Documentation

## 🚀 Automated Release Workflow

This project uses GitHub Actions to automatically create releases when you push a new tag.

## How to Create a Release

### 1. Ensure Your Code is Ready

Make sure all changes are committed and pushed to the main branch:

```bash
git add .
git commit -m "Prepare for release 1.0"
git push origin main
```

### 2. Create and Push a Tag

```bash
# Create a new tag (e.g., 1.0, 2.0, 1.2.3)
git tag 1.0

# Push the tag to GitHub
git push origin 1.0
```

### 3. Automatic Release Creation

Once the tag is pushed, GitHub Actions will automatically:

1. ✅ Checkout the code
2. ✅ Setup the build environment (Bun)
3. ✅ Install dependencies
4. ✅ Build the project
5. ✅ Generate changelog from commits
6. ✅ Create release package: `bmi-stellar-edition-{version}.zip`
7. ✅ Generate SHA256 checksum
8. ✅ Create GitHub Release with professional description

## 📋 Release Package Contents

The release package includes:

- `build/` - Built application files
- `package.json` - Project metadata
- `README.md` - Project documentation
- `LICENSE.md` - GPL v3 License

## 🔍 Changelog Generation

### First Release (e.g., 1.0)
- Includes all commits from the first commit to the release tag

### Subsequent Releases (e.g., 1.1, 2.0)
- Includes commits from the previous tag to the current tag
- Example: If you have tags `1.0` and `1.1`, the changelog for `1.1` will include commits between `1.0` and `1.1`

## 📦 Release Artifacts

Each release includes:

1. **Package**: `bmi-stellar-edition-{version}.zip`
   - Contains the built application and necessary files
   
2. **Checksum**: `bmi-stellar-edition-{version}.zip.sha256`
   - SHA256 hash for package verification

## 🔒 Verifying Package Integrity

Users can verify the downloaded package using:

```bash
sha256sum -c bmi-stellar-edition-{version}.zip.sha256
```

## 📝 Release Notes Structure

Each release automatically includes:

- **What's New**: Brief introduction
- **Installation**: Step-by-step installation instructions
- **Changelog**: Detailed commit history since last release
- **Security**: Package verification instructions
- **License**: GPL v3 license information
- **Acknowledgments**: Credits and tech stack

## 🏷️ Version Naming Conventions

Recommended tag formats:

- **Major releases**: `1.0`, `2.0`, `3.0`
- **Minor releases**: `1.1`, `1.2`, `2.1`
- **Patch releases**: `1.0.1`, `1.0.2`, `2.1.3`
- **Pre-releases**: `1.0-beta`, `2.0-rc1`

## 🛠️ Troubleshooting

### Release Failed?

Check the Actions tab in GitHub to see error logs:
1. Go to your repository on GitHub
2. Click "Actions" tab
3. Find the failed workflow run
4. Review the logs to identify the issue

### Common Issues

- **Build failure**: Ensure `bun run build` works locally
- **Tag already exists**: Delete the tag and recreate it:
  ```bash
  git tag -d 1.0
  git push origin :refs/tags/1.0
  git tag 1.0
  git push origin 1.0
  ```

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Git Tagging Guide](https://git-scm.com/book/en/v2/Git-Basics-Tagging)
- [Semantic Versioning](https://semver.org/)

---

**Note**: Make sure you have the necessary permissions to create releases in the repository settings.
