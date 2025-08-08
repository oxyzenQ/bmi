import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{html,js,svelte,ts}",
    "./src/routes/**/*.{html,js,svelte,ts}",
    "./src/lib/**/*.{html,js,svelte,ts}",
  ],
  theme: {
    extend: {
      colors: {
        // Enhanced Space theme colors
        'space-deep': '#070a1c',
        'space-dark': '#040717',
        'space-accent': '#1b1f3a',
        'plasma-blue': '#4285f4',
        'plasma-purple': '#9b59b6',
        'star-glow': '#f4e542',
        'nebula-glow': '#7f7fd5',
        'space-text': '#e0e0e0',
        'space-subtext': '#c5c8e6',
        // New cosmic colors
        'cosmic-blue': '#60a5fa',
        'cosmic-purple': '#a78bfa',
        'cosmic-indigo': '#6366f1',
        'cosmic-cyan': '#06b6d4',
        'cosmic-pink': '#ec4899',
        'cosmic-orange': '#f97316',
        'cosmic-yellow': '#eab308',
        'cosmic-green': '#10b981',
        'cosmic-red': '#ef4444',
        // Glass colors
        'glass-bg': 'rgba(30, 41, 59, 0.7)',
        'glass-border': 'rgba(255, 255, 255, 0.1)',
        'glass-highlight': 'rgba(255, 255, 255, 0.05)',
        'glass-shadow': 'rgba(0, 0, 0, 0.3)',
        // Glow colors
        'glow-blue': 'rgba(96, 165, 250, 0.3)',
        'glow-purple': 'rgba(168, 85, 247, 0.3)',
        'glow-cyan': 'rgba(6, 182, 212, 0.3)',
        'glow-pink': 'rgba(236, 72, 153, 0.3)',
        // Apple-inspired colors
        'apple-glass': 'rgba(255, 255, 255, 0.08)',
        'apple-border': 'rgba(255, 255, 255, 0.12)',
        'apple-highlight': 'rgba(255, 255, 255, 0.04)',
      },
      fontFamily: {
        'inter': ['Inter Variable', 'Inter', 'sans-serif'],
        'poppins': ['Poppins', 'sans-serif'],
        'cosmic': ['Inter Variable', 'Inter', 'sans-serif'],
        'apple': ['Inter Variable', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      backgroundImage: {
        'space-gradient': 'radial-gradient(circle at 40% 80%, #070a1c 10%, #1b1f3a 40%, #040717 100%)',
        'button-gradient': 'linear-gradient(135deg, #4285f4, #9b59b6)',
        'cosmic-gradient': 'linear-gradient(135deg, #60a5fa, #a78bfa, #6366f1)',
        'glass-gradient': 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.6))',
        'nebula-gradient': 'linear-gradient(135deg, rgba(96, 165, 250, 0.1), rgba(168, 85, 247, 0.1))',
        'apple-glass': 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))',
      },
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '32px',
        '3xl': '40px',
      },
      boxShadow: {
        'cosmic': '0 0 20px rgba(96, 165, 250, 0.3)',
        'cosmic-lg': '0 0 40px rgba(96, 165, 250, 0.4)',
        'cosmic-xl': '0 0 60px rgba(96, 165, 250, 0.5)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'glass-hover': '0 12px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
        'liquid': '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 20px rgba(96, 165, 250, 0.1)',
        'liquid-hover': '0 16px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 0 40px rgba(96, 165, 250, 0.25)',
        'apple': '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        'apple-hover': '0 12px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
      },
      animation: {
        'float': 'float 20s infinite linear',
        'glow': 'glow 3s ease-in-out infinite alternate',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 3s infinite',
        'spin-slow': 'spin 8s linear infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'icon-glow': 'iconGlow 3s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%': { transform: 'translateY(100vh) translateX(0)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(-100px) translateX(100px)', opacity: '0' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(96, 165, 250, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(96, 165, 250, 0.6)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        iconGlow: {
          '0%': { opacity: '0.3', transform: 'scale(1)' },
          '100%': { opacity: '0.6', transform: 'scale(1.1)' },
        },
      },
      transitionTimingFunction: {
        'cosmic': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'smooth': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'apple': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
        '9xl': ['8rem', { lineHeight: '1' }],
      },
    },
  },
  plugins: [
    // Custom plugin for Apple-inspired glassmorphism utilities
    function ({ addUtilities, theme }) {
      const appleUtilities = {
        '.apple-glass': {
          background: theme('colors.apple-glass'),
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: `1px solid ${theme('colors.apple-border')}`,
          boxShadow: theme('boxShadow.apple'),
        },
        '.liquid-glass': {
          background: theme('backgroundImage.apple-glass'),
          backdropFilter: 'blur(28px) saturate(200%)',
          WebkitBackdropFilter: 'blur(28px) saturate(200%)',
          border: `1px solid ${theme('colors.apple-border')}`,
          boxShadow: theme('boxShadow.liquid'),
        },
        '.cosmic-glow': {
          boxShadow: theme('boxShadow.cosmic'),
        },
        '.cosmic-glow-lg': {
          boxShadow: theme('boxShadow.cosmic-lg'),
        },
        '.cosmic-glow-xl': {
          boxShadow: theme('boxShadow.cosmic-xl'),
        },
        '.apple-glow': {
          boxShadow: theme('boxShadow.apple'),
        },
        '.apple-glow-hover': {
          boxShadow: theme('boxShadow.apple-hover'),
        },
      };
      addUtilities(appleUtilities);
    },
  ],
};
export default config;