<script lang="ts">
  import { onMount } from 'svelte';

  onMount(() => {
    // Randomize background position on load and scroll
    const randomizeBackgroundPosition = () => {
      const xPos = Math.floor(Math.random() * 101);
      const yPos = Math.floor(Math.random() * 101);
      document.body.style.backgroundPosition = `${xPos}% ${yPos}%`;
    };

    randomizeBackgroundPosition();
    
    let isScrolling = false;
    const handleScroll = () => {
      if (!isScrolling) {
        isScrolling = true;
        requestAnimationFrame(() => {
          randomizeBackgroundPosition();
          isScrolling = false;
        });
      }
    };

    window.addEventListener('scroll', handleScroll);
    
    return () => window.removeEventListener('scroll', handleScroll);
  });
</script>

<svelte:head>
  <title>BMI Calculator Mature - Welcome</title>
  <meta name="description" content="A modern, responsive Body Mass Index calculator with space-themed design" />
</svelte:head>

<div class="min-h-screen flex flex-col items-center justify-center">
  <div class="space-container flex flex-col items-center max-w-lg w-full">
    <img 
      src="/assets/logobmii.png" 
      alt="BMI Logo" 
      width="120" 
      height="120"
      class="mb-6"
      loading="lazy"
      decoding="async"
    />
    
    <h1 class="text-4xl font-bold text-white mb-4 text-center">
      Welcome to Our App
    </h1>
    
    <div class="mb-8">
      <p class="text-xl text-gray-300 flex items-center gap-2">
        BMI Calculator Mature 
        <i class="fa-solid fa-leaf text-green-400"></i>
      </p>
    </div>
    
    <div class="space-y-4 w-full">
      <div class="flex justify-center">
        <a href="/calculator" class="space-button text-lg">
          <i class="fa-solid fa-right-long"></i>
          Try Our Calculator
        </a>
      </div>
    </div>
    
    <div class="mt-8">
      <a href="/about" class="text-white hover:text-blue-400 transition-colors flex items-center gap-2">
        <i class="fa-solid fa-receipt"></i>
        About
      </a>
    </div>
    
    <footer class="mt-12 text-center text-sm text-gray-400 border-t border-gray-600 pt-6">
      <p>
        <i class="fa-regular fa-copyright text-green-400 mr-1"></i>
        2024-2025 LOGIGO. All rights reserved. Designed by Rezky Nightly.
        <i class="fa-solid fa-champagne-glasses text-purple-400 ml-1"></i>
      </p>
    </footer>
  </div>
</div>

<style>
  .min-h-screen {
    min-height: 100vh;
  }
  
  .flex {
    display: flex;
  }
  
  .flex-col {
    flex-direction: column;
  }
  
  .items-center {
    align-items: center;
  }
  
  .justify-center {
    justify-content: center;
  }
  
  .max-w-lg {
    max-width: 32rem;
  }
  
  .w-full {
    width: 100%;
  }
  
  .mb-4 {
    margin-bottom: 1rem;
  }
  
  .mb-6 {
    margin-bottom: 1.5rem;
  }
  
  .mb-8 {
    margin-bottom: 2rem;
  }
  
  .mt-8 {
    margin-top: 2rem;
  }
  
  .mt-12 {
    margin-top: 3rem;
  }
  
  .pt-6 {
    padding-top: 1.5rem;
  }
  
  .gap-2 {
    gap: 0.5rem;
  }
  
  .text-4xl {
    font-size: 2.25rem;
    line-height: 2.5rem;
  }
  
  .text-xl {
    font-size: 1.25rem;
    line-height: 1.75rem;
  }
  
  .text-lg {
    font-size: 1.125rem;
    line-height: 1.75rem;
  }
  
  .text-sm {
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
  
  .font-bold {
    font-weight: 700;
  }
  
  .text-white {
    color: #ffffff;
  }
  
  .text-gray-300 {
    color: #d1d5db;
  }
  
  .text-gray-400 {
    color: #9ca3af;
  }
  
  .text-green-400 {
    color: #4ade80;
  }
  
  .text-purple-400 {
    color: #c084fc;
  }
  
  .text-center {
    text-align: center;
  }
  
  .border-t {
    border-top-width: 1px;
  }
  
  .border-gray-600 {
    border-color: #4b5563;
  }
  
  .transition-colors {
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
  }
  
  .hover\:text-blue-400:hover {
    color: #60a5fa;
  }
  
  .space-container {
    background: transparent;
    border-radius: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    border-left: 1px solid rgba(255, 255, 255, 0.15);
    border-right: 1px solid rgba(255, 255, 255, 0.15);
    padding: 30px;
    margin: 20px auto;
    max-width: 1000px;
    text-align: center;
  }
  
  .space-button {
    background: linear-gradient(135deg, #4285f4, #9b59b6);
    color: #e0e0e0;
    padding: 12px 30px;
    border-radius: 1rem;
    border: none;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    transition: all 0.3s ease;
    font-weight: 500;
  }
  
  .space-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(66, 133, 244, 0.3);
  }
  
  .fa-champagne-glasses { color: purple; }
  .fa-copyright { color: rgba(0, 128, 0, 0.8); }
  .fa-leaf { color: #4ade80; }
</style>
