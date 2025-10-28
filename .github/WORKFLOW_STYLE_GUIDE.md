# 🎨 GitHub Actions Workflow Style Guide

## 🎯 Overview

All GitHub Actions workflows follow an elegant, consistent style with creative commit messages and beautiful titles.

---

## 📋 Workflow Titles

All workflows use elegant emoji-prefixed titles for visual consistency:

| Workflow | Title | Purpose |
|----------|-------|---------|
| `auto-update.yml` | 🔄 Auto Update Dependencies | Daily dependency updates |
| `ci.yml` | ✅ CI/CD Pipeline | Code quality checks |
| `codeql.yml` | 🔒 CodeQL Security Scan | Security analysis |
| `release.yml` | 🎉 Release Publisher | Version releases |

### Title Guidelines

- **Always** start with an emoji that represents the workflow purpose
- Use **title case** for professional appearance
- Keep titles **concise but descriptive**
- Maintain **visual consistency** across all workflows

---

## 💬 Creative Commit Messages

The `github-actions[bot]` uses a pool of **15 creative commit messages** that are randomly selected for each dependency update.

### Message Pool

1. ✨ **chore(deps): sprinkle fresh dependency updates like cosmic stardust**
2. 🚀 **chore(deps): boost dependencies to warp speed - all systems go!**
3. 🎨 **chore(deps): polish dependencies to stellar perfection**
4. ⚡ **chore(deps): supercharge packages with lightning-fast updates**
5. 🌟 **chore(deps): elevate dependencies to new heights of excellence**
6. 🔮 **chore(deps): enchant codebase with mystical dependency magic**
7. 🎯 **chore(deps): hit bullseye with precision dependency updates**
8. 🌊 **chore(deps): ride the wave of cutting-edge package versions**
9. 🎪 **chore(deps): roll out the red carpet for fresh dependencies**
10. 🏆 **chore(deps): crown packages with championship-worthy updates**
11. 🎭 **chore(deps): orchestrate a symphony of updated dependencies**
12. 🚁 **chore(deps): airlift dependencies to cloud nine**
13. 🎨 **chore(deps): paint the town with vibrant new package colors**
14. 🔥 **chore(deps): ignite performance with blazing dependency updates**
15. 💎 **chore(deps): polish dependencies until they shine like diamonds**

### Message Structure

Each commit includes:

```
[Random Creative Title]

🤖 Automated by the tireless GitHub Actions Bot
📦 Updated X file(s)
⏰ [Full timestamp with day and date]
🎯 Workflow: auto-update.yml
```

### Message Guidelines

- **Creativity**: Use vivid metaphors and imagery
- **Consistency**: Always follow conventional commits format `chore(deps):`
- **Variety**: Random selection ensures commits never feel repetitive
- **Personality**: Add character while maintaining professionalism
- **Emojis**: Use relevant emojis that enhance the message

---

## 🎭 Commit Message Themes

### 🌌 Cosmic Theme
- Stardust, warp speed, stellar perfection
- Reflects the "Stellar Edition" branding

### ⚡ Power Theme
- Supercharge, boost, ignite, blazing
- Emphasizes performance improvements

### 🎨 Elegance Theme
- Polish, paint, orchestrate, crown
- Highlights quality and refinement

### 🎯 Precision Theme
- Hit bullseye, precision, elevate
- Shows attention to detail

### 🌊 Dynamic Theme
- Ride the wave, airlift, roll out
- Conveys forward momentum

---

## 🛠️ Implementation Details

### Random Message Selection

```bash
# Array of creative messages
MESSAGES=(
  "✨ chore(deps): sprinkle fresh dependency updates like cosmic stardust"
  # ... more messages
)

# Random selection
RANDOM_MSG=${MESSAGES[$RANDOM % ${#MESSAGES[@]}]}
```

### Commit Metadata

Every commit automatically includes:
- 🤖 Bot attribution
- 📦 File count
- ⏰ Full timestamp with weekday
- 🎯 Workflow identification

---

## ✨ Examples

### Example Commit 1
```
🚀 chore(deps): boost dependencies to warp speed - all systems go!

🤖 Automated by the tireless GitHub Actions Bot
📦 Updated 3 file(s)
⏰ Tuesday, October 28, 2025 at 00:00:15 UTC
🎯 Workflow: auto-update.yml
```

### Example Commit 2
```
💎 chore(deps): polish dependencies until they shine like diamonds

🤖 Automated by the tireless GitHub Actions Bot
📦 Updated 2 file(s)
⏰ Wednesday, October 29, 2025 at 00:00:42 UTC
🎯 Workflow: auto-update.yml
```

### Example Commit 3
```
🌊 chore(deps): ride the wave of cutting-edge package versions

🤖 Automated by the tireless GitHub Actions Bot
📦 Updated 5 file(s)
⏰ Thursday, October 30, 2025 at 00:01:08 UTC
🎯 Workflow: auto-update.yml
```

---

## 📊 Benefits

### For Developers
- **Engaging**: Fun commit messages make git history more enjoyable
- **Informative**: Clear metadata in every commit
- **Trackable**: Easy to identify bot commits

### For Project
- **Professional**: Maintains conventional commit standards
- **Branded**: Aligns with "Stellar Edition" theme
- **Consistent**: Uniform style across all automation

### For Community
- **Welcoming**: Friendly, approachable tone
- **Transparent**: Clear attribution and timing
- **Memorable**: Unique messages stand out in commit history

---

## 🎯 Adding New Messages

To add new creative messages to the pool:

1. **Follow the theme**: Use vivid, engaging language
2. **Keep it clean**: Professional but fun
3. **Add emoji**: Choose relevant emoji prefix
4. **Test length**: Keep under 72 characters for git
5. **Update array**: Add to `MESSAGES` array in `auto-update.yml`

### Template
```
[emoji] chore(deps): [creative action verb] [metaphorical description]
```

### Good Examples
- ✨ chore(deps): illuminate codebase with brilliant dependency updates
- 🎪 chore(deps): perform spectacular dependency acrobatics
- 🏔️ chore(deps): summit the peaks of package perfection

### Avoid
- Overly long messages (>72 chars)
- Inside jokes or obscure references
- Repetitive or generic phrases
- Emojis that don't relate to the action

---

## 🔄 Workflow Integration

### Auto Update Workflow
- **Frequency**: Daily at 00:00 UTC (07:00 WIB)
- **Triggers**: Schedule + Manual
- **Output**: Creative commit + summary

### CI/CD Pipeline
- **Purpose**: Quality assurance
- **No commits**: Only runs checks
- **Focus**: Fast feedback

### Security Scan
- **Purpose**: Vulnerability detection
- **No commits**: Only analysis
- **Focus**: Safety first

### Release Publisher
- **Purpose**: Version deployment
- **No commits**: Creates releases
- **Focus**: Distribution

---

## 📚 Resources

### Related Files
- `.github/workflows/auto-update.yml` - Main implementation
- `.github/AUTO_UPDATE.md` - Workflow documentation
- `CHANGELOG.md` - Project history

### Conventional Commits
- Format: `type(scope): description`
- Used: `chore(deps): ...`
- Docs: [conventionalcommits.org](https://www.conventionalcommits.org/)

---

## 🎨 Style Principles

1. **Be Creative** - Use imaginative language
2. **Stay Professional** - Maintain git standards
3. **Add Personality** - Make commits memorable
4. **Keep Consistent** - Follow established patterns
5. **Think Branding** - Align with project identity

---

**Maintained by:** Team LOGIGO  
**Updated:** October 2025  
**Version:** Stellar Edition 3.0
