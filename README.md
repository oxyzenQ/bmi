# BMI Calculator - Next.js
[![Netlify Status](https://api.netlify.com/api/v1/badges/a7a07f26-2cc0-4eb9-a804-3fc501b9b4e3/deploy-status?branch=main)](https://app.netlify.com/projects/preeminent-torte-dbb4a3/deploys)

A modern, responsive Body Mass Index calculator built with Next.js, TypeScript, and Tailwind CSS. Features a beautiful space-themed design with plasma colors and smooth animations.

## 🚀 Features

- **Accurate BMI Calculations**: Precise BMI calculations with instant results and category classification
- **Responsive Design**: Mobile-first approach that works perfectly on all devices
- **Space-Themed UI**: Beautiful space-themed interface with plasma colors and smooth animations
- **Privacy First**: All calculations performed locally in your browser
- **Fast & Lightweight**: Optimized for performance with minimal loading times
- **Modern Tech Stack**: Built with Next.js, TypeScript, and Tailwind CSS

## 🛠️ Local Development Setup

### Prerequisites
- Node.js 18, Latest or higher
- npm or yarn package manager

### Installation

1. **Copy the package.json file**:
   ```bash
   cp package-local.json package.json
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** and navigate to `http://localhost:3000`

### Build for Production

```bash
# Build the application
npm run build

# Start production server
npm run start

# Or export as static files
npm run export
```

## 📱 BMI Categories

- **Underweight**: Below 18.5
- **Healthy weight**: 18.5 - 24.9
- **Overweight**: 25.0 - 29.9
- **Obesity**: 30.0 and above

## 🎨 Design Features

- Space-themed gradient backgrounds
- Plasma blue and purple color scheme
- Smooth animations and transitions
- Mobile-responsive navigation
- Clean, modern typography using Inter font

## 🔧 Technology Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Font Awesome
- **Fonts**: Inter (Google Fonts)

## 📁 Project Structure

```
/
├── src/
│   ├── app/
│   │   ├── calculator/page.tsx    # BMI Calculator page
│   │   ├── about/page.tsx         # About page
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Home page
│   │   ├── not-found.tsx          # 404 page
│   │   └── globals.css            # Global styles
├── public/assets/                 # Static assets
├── next.config.js                 # Next.js configuration
├── tailwind.config.ts             # Tailwind configuration
├── tsconfig.json                  # TypeScript configuration
└── postcss.config.js              # PostCSS configuration
```

## 🚀 Deployment

This project is optimized for deployment on Vercel:

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy with zero configuration

The application can also be deployed to any static hosting service using `npm run export`.

## 👨‍💻 Author

**Rezky Nightly**
- Modern web developer focused on performance and user experience
- Specialist in Next.js, TypeScript, and responsive design

## 📄 License

MIT License - feel free to use this project for your own purposes.

---

*Built with ❤️ using Next.js and modern web technologies*
