# BMI Calculator Mature

## Project Overview
A responsive BMI (Body Mass Index) calculator web application built with HTML, CSS, and JavaScript. Features a modern space-themed design with plasma colors and smooth animations.

## Architecture
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript for type safety
- **Styling**: Tailwind CSS with custom space theme variables
- **Assets**: Images optimized with Next.js Image component in `/public/assets`
- **Pages**: React components with file-based routing in `/src/app`
- **Components**: Modular React components with hooks and state management
- **Configuration**: PostCSS with Tailwind CSS and Autoprefixer

## Key Features
- BMI calculation with category classification (Underweight, Healthy, Overweight, Obesity)
- Responsive design with mobile-first approach
- Space-themed UI with plasma colors and smooth animations
- Multi-page navigation (Home, Calculator, About, Profile)
- Form validation and reset functionality
- Dynamic background positioning effects

## File Structure
```
/
├── index.html (Landing page)
├── assets/ (Images, logos, and media files)
├── html/ (Additional HTML pages)
├── script/ (JavaScript modules)
├── styles/ (CSS stylesheets)
└── replit.md (Project documentation)
```

## Security Considerations
- Pure client-side application with no server-side data processing
- Input validation implemented in JavaScript
- No external API dependencies for core functionality
- Uses CDN resources for fonts and icons (Font Awesome, Inter font)

## Development Setup
- Runs on Next.js development server (port 5000)
- Hot reload and fast refresh for rapid development
- TypeScript compilation and Tailwind CSS processing
- ESLint for code quality and consistency

## User Preferences
- Author: Rezky Nightly
- Design preference: Modern, space-themed aesthetic preserved
- Technology stack: Next.js with TypeScript and Tailwind CSS
- Responsive design approach: Mobile-first (maintained)
- Deployment preference: Vercel-optimized with zero configuration

## Recent Changes
- **2025-08-03**: Successfully migrated from static HTML to Next.js framework
- **2025-08-03**: Converted all pages to React components with TypeScript
- **2025-08-03**: Integrated Tailwind CSS with custom space theme variables
- **2025-08-03**: Set up Next.js development server with hot reload
- **2025-08-03**: Preserved all original design and BMI calculation functionality
- **2025-08-03**: Added local development setup with package-local.json

## Deployment Notes
- Static web application suitable for any HTTP server
- No database or backend dependencies
- All assets are self-contained within the project directory