import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Space theme colors from original CSS
        'space-deep': '#070a1c',
        'space-dark': '#040717',
        'space-accent': '#1b1f3a',
        'plasma-blue': '#4285f4',
        'plasma-purple': '#9b59b6',
        'star-glow': '#f4e542',
        'nebula-glow': '#7f7fd5',
        'space-text': '#e0e0e0',
        'space-subtext': '#c5c8e6',
      },
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'space-gradient': 'radial-gradient(circle at 40% 80%, #070a1c 10%, #1b1f3a 40%, #040717 100%)',
        'button-gradient': 'linear-gradient(135deg, #4285f4, #9b59b6)',
      },
    },
  },
  plugins: [],
};
export default config;