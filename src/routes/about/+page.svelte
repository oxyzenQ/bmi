<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '@iconify/svelte';

  onMount(() => {
    // Randomize background position effect
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
  <title>About BMI Calculator Mature</title>
  <meta name="description" content="Learn about BMI Calculator Mature - A modern, responsive Body Mass Index calculator with space-themed design" />
</svelte:head>

<div class="min-h-screen py-8">
  <div class="space-container max-w-4xl">
    <div class="flex items-center justify-between mb-8">
      <a href="/" class="text-white hover:text-blue-400 transition-colors">
        <Icon icon="fa6-solid:arrow-left" class="mr-2" />
        Back to Home
      </a>
      <img 
        src="/assets/logobmii.webp" 
        alt="BMI Logo" 
        width="60" 
        height="60"
        loading="lazy"
        decoding="async"
      />
    </div>

    <header class="text-center mb-12">
      <h1 class="text-4xl font-bold text-white mb-4">
        About BMI Calculator Mature
      </h1>
      <p class="text-xl text-gray-300 max-w-2xl mx-auto">
        A modern, responsive Body Mass Index calculator with space-themed design, 
        built to help you monitor your health journey.
      </p>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
      <div class="space-container">
        <div class="text-center">
          <Icon icon="fa6-solid:calculator" class="text-4xl text-blue-400 mb-4" />
          <h3 class="text-xl font-semibold text-white mb-2">
            Accurate Calculations
          </h3>
          <p class="text-gray-300">
            Get precise BMI calculations using the standard formula with instant results and category classification.
          </p>
        </div>
      </div>

      <div class="space-container">
        <div class="text-center">
          <Icon icon="fa6-solid:mobile-screen-button" class="text-4xl text-purple-400 mb-4" />
          <h3 class="text-xl font-semibold text-white mb-2">
            Mobile Responsive
          </h3>
          <p class="text-gray-300">
            Fully responsive design that works perfectly on all devices, from smartphones to desktops.
          </p>
        </div>
      </div>

      <div class="space-container">
        <div class="text-center">
          <Icon icon="fa6-solid:palette" class="text-4xl text-yellow-400 mb-4" />
          <h3 class="text-xl font-semibold text-white mb-2">
            Space Theme
          </h3>
          <p class="text-gray-300">
            Beautiful space-themed interface with plasma colors and smooth animations for an engaging experience.
          </p>
        </div>
      </div>

      <div class="space-container">
        <div class="text-center">
          <Icon icon="fa6-solid:shield" class="text-4xl text-green-400 mb-4" />
          <h3 class="text-xl font-semibold text-white mb-2">
            Privacy First
          </h3>
          <p class="text-gray-300">
            All calculations are performed locally in your browser. No data is stored or transmitted to external servers.
          </p>
        </div>
      </div>

      <div class="space-container">
        <div class="text-center">
          <Icon icon="fa6-solid:bolt" class="text-4xl text-purple-400 mb-4" />
          <h3 class="text-xl font-semibold text-white mb-2">
            Fast & Lightweight
          </h3>
          <p class="text-gray-300">
            Optimized for performance with minimal loading times and smooth interactions across all devices.
          </p>
        </div>
      </div>

      <div class="space-container">
        <div class="text-center">
          <Icon icon="fa6-solid:heart" class="text-4xl text-red-400 mb-4" />
          <h3 class="text-xl font-semibold text-white mb-2">
            Health Focused
          </h3>
          <p class="text-gray-300">
            Provides clear BMI categories and health guidance to help you understand your results better.
          </p>
        </div>
      </div>
    </div>

    <div class="space-container mb-12">
      <h2 class="text-2xl font-bold text-white mb-6 text-center">
        Understanding BMI
      </h2>
      <div class="max-w-3xl mx-auto">
        <img 
          src="/assets/bmi-chart.webp" 
          alt="BMI Chart" 
          width="600" 
          height="400"
          class="w-full rounded-lg mb-6"
          loading="lazy"
          decoding="async"
        />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-300">
          <div>
            <h4 class="text-lg font-semibold text-white mb-2">What is BMI?</h4>
            <p class="mb-4">
              Body Mass Index (BMI) is a simple calculation using a person's height and weight. 
              The BMI formula divides an adult's weight in kilograms by their height in meters squared.
            </p>
            <p>
              While BMI doesn't directly measure body fat, it's a useful screening tool for 
              categorizing weight ranges that may lead to health problems.
            </p>
          </div>
          <div>
            <h4 class="text-lg font-semibold text-white mb-2">BMI Categories</h4>
            <div class="space-y-2">
              <p><span class="text-blue-400 font-medium">Underweight:</span> Below 18.5</p>
              <p><span class="text-green-400 font-medium">Healthy weight:</span> 18.5 - 24.9</p>
              <p><span class="text-yellow-400 font-medium">Overweight:</span> 25.0 - 29.9</p>
              <p><span class="text-red-400 font-medium">Obesity:</span> 30.0 and above</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="text-center">
      <a href="/calculator" class="space-button text-lg">
        <Icon icon="fa6-solid:calculator" class="mr-2" />
        Try the Calculator
      </a>
    </div>

    <footer class="mt-16 text-center text-sm text-gray-400 border-t border-gray-600 pt-8">
      <p>
        <Icon icon="fa6-regular:copyright" class="text-green-400 mr-1" />
        2024-2025 LOGIGO. All rights reserved. Designed by Rezky Nightly.
        <Icon icon="fa6-solid:champagne-glasses" class="text-purple-400 ml-1" />
      </p>
      <p class="mt-2">
        Built with SvelteKit, TypeScript, and Tailwind CSS
      </p>
    </footer>
  </div>
</div>
