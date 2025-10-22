# A Simple BMI Calc - Maintenance Guide

## Project Overview
A simple BMI calc - modern BMI (Body Mass Index) calculator web application built with SvelteKit and TypeScript. The application features a space-themed design with premium glassmorphism effects, interactive charts, and comprehensive health articles.

## Tech Stack
- **Framework**: SvelteKit 2.x with Svelte 5
- **Language**: TypeScript for type safety
- **Package Manager**: Bun (fast, all-in-one toolkit)
- **Desktop/Mobile**: Tauri 2.0 (Rust-based, cross-platform)
- **Styling**: Modern CSS (no Tailwind)
- **Fonts**: Inter Variable (text) + JetBrains Mono Variable (numbers)
- **Icons**: Lucide Svelte
- **Testing**: Vitest + Testing Library
- **Deployment**: Vercel (web), Tauri builds (desktop/Android)

## Project Structure

```
src/
├── app.css                 # Global styles, glassmorphism, animations
├── app.html               # HTML template
├── lib/
│   ├── components/        # Reusable Svelte components
│   │   ├── ArticleCard.svelte      # Article preview cards
│   │   ├── ArticleModal.svelte     # Article popup modal
│   │   ├── BmiChart.svelte         # Static BMI reference chart
│   │   ├── BmiDynamicChart.svelte  # Interactive BMI visualization
│   │   ├── BmiForm.svelte          # BMI calculation form
│   │   ├── BmiResults.svelte       # BMI calculation results
│   │   ├── CosmicParticles.svelte  # Background particle effects
│   │   ├── LoadingSpinner.svelte   # Loading animation
│   │   ├── ReferenceTable.svelte   # BMI reference table
│   │   └── __tests__/             # Component tests
│   ├── assets/            # Static assets (favicon, etc.)
│   └── ui/
│       └── Hero.svelte    # Hero section with animations
├── routes/
│   ├── +layout.svelte     # Global layout
│   ├── +page.svelte       # Home page
│   ├── about/+page.svelte # About page
│   └── calculator/+page.svelte # Calculator page
└── test-setup.ts          # Test configuration

static/
├── images/                # Background images
├── favicon.webp          # Site favicon
└── robots.txt            # SEO robots file
```

## Performance Optimizations Applied

### 1. CSS Performance
- **Containment**: Added `contain: layout style paint` to animated elements
- **GPU Acceleration**: Used `transform: translateZ(0)` and `will-change` properties
- **Font Loading**: Implemented `font-display: swap` for better loading performance
- **Reduced Motion**: Comprehensive support for `prefers-reduced-motion`

### 2. Animation Optimizations
- **Smooth Easing**: Custom easing functions with CSS variables
- **Staggered Animations**: Bubble effects with performance-friendly timing
- **Isolation**: Used `isolation: isolate` to create new stacking contexts

### 3. Bundle Optimization
- **Local Fonts**: All fonts embedded locally (no CDN requests)
- **Tree Shaking**: Unused components and files removed
- **Minimal Dependencies**: Only essential packages included

## Key Features

### 1. BMI Calculation
- Real-time BMI calculation with form validation
- Interactive dynamic chart showing BMI trends
- Health status indicators and recommendations
- Always-visible chart with default zero data when no input

### 2. Visual Effects
- **Glassmorphism**: Premium glass-like containers with blur effects
- **Glossy Sweeps**: Subtle animated shine effects on containers
- **Cosmic Theme**: Space-themed background with particle effects
- **Responsive Design**: Mobile-first approach with fluid layouts

### 3. Content System
- 12 comprehensive health articles with expert content
- Lazy loading with IntersectionObserver for performance
- Modal popups with smooth animations
- Centered metadata display (icons, dates, reading time)

## Adding New Features

### 1. Adding a New Component
```bash
# Create component file
touch src/lib/components/NewComponent.svelte

# Create test file
touch src/lib/components/__tests__/NewComponent.test.ts
```

### 2. Component Template
```svelte
<script lang="ts">
  // Import dependencies
  import { onMount } from 'svelte';
  
  // Define props with types
  export let prop: string = 'default';
  
  // Component logic here
</script>

<!-- HTML template -->
<div class="component-container">
  <!-- Content -->
</div>

<style>
  .component-container {
    /* Styles with performance optimizations */
    contain: layout style;
    will-change: auto;
  }
</style>
```

### 3. Adding New Articles
Edit the articles array in `src/routes/+page.svelte`:
```javascript
const articles = [
  {
    id: 'new-article',
    title: 'Article Title',
    excerpt: 'Brief description...',
    content: 'Full article content...',
    author: 'Author Name',
    readTime: '5 min read',
    date: '2024-01-01',
    icon: 'IconName' // From lucide-svelte
  }
];
```

## Performance Best Practices

### 1. CSS Guidelines
- Use `contain` property for isolated components
- Add `will-change` only when necessary, remove after animation
- Prefer `transform` and `opacity` for animations
- Use CSS variables for consistent timing and easing

### 2. JavaScript Optimizations
- Implement lazy loading for heavy components
- Use `onMount` for DOM-dependent operations
- Debounce user inputs for real-time calculations
- Avoid memory leaks with proper cleanup

### 3. Animation Guidelines
- Keep animations under 300ms for micro-interactions
- Use `cubic-bezier` for natural motion
- Respect `prefers-reduced-motion` user preference
- Batch DOM reads/writes to avoid layout thrashing

## Debugging Common Issues

### 1. Build Errors
```bash
# Check TypeScript errors
bun run check

# Build production bundle
bun run build

# Preview production build
bun run preview
```

### 2. Performance Issues
- Check Chrome DevTools Performance tab
- Look for layout thrashing in animations
- Verify `contain` and `will-change` usage
- Monitor bundle size with build output

### 3. Animation Problems
- Ensure GPU acceleration with `transform: translateZ(0)`
- Check for conflicting CSS properties
- Verify reduced motion preferences are respected
- Test on lower-end devices

## Testing

### Running Tests
```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

### Test Structure
- Unit tests for components in `__tests__/` directories
- Mock wrappers for event testing in `mocks/` subdirectories
- Integration tests for user workflows

## Deployment

### Vercel Deployment
```bash
# Build for production
bun run build

# Deploy to Vercel (automatic via Git)
git push origin main
```

### Environment Variables
No environment variables required - all calculations are client-side.

## Maintenance Tasks

### Regular Updates
1. **Dependencies**: Update packages monthly
2. **Performance**: Monitor Core Web Vitals
3. **Accessibility**: Test with screen readers
4. **Browser Compatibility**: Test on major browsers

### Code Quality
1. **Linting**: Run `bun run lint` before commits
2. **Formatting**: Use Prettier for consistent code style
3. **Type Safety**: Maintain strict TypeScript configuration
4. **Testing**: Keep test coverage above 80%

## Troubleshooting

### Common Issues
1. **Font Loading**: Ensure local fonts are properly imported
2. **Animation Jank**: Check for layout-triggering CSS properties
3. **Mobile Performance**: Test on actual devices, not just DevTools
4. **Memory Leaks**: Clean up event listeners and observers

### Performance Monitoring
- Use Lighthouse for regular audits
- Monitor First Contentful Paint (FCP)
- Track Cumulative Layout Shift (CLS)
- Measure Time to Interactive (TTI)

## Contact & Support
For technical issues or feature requests, refer to the project repository or contact the development team.

---

*Last updated: January 2025*
*Version: 1.0.0*
