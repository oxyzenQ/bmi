<script lang="ts">
  import { ArrowLeft, Calculator, Smartphone, ShieldCheck, Zap, Heart, Star, CheckCircle2, Rocket } from 'lucide-svelte';
</script>

<svelte:head>
  <title>About BMI Calculator Mature</title>
  <meta name="description" content="Learn about BMI Calculator Mature - A modern, responsive Body Mass Index calculator with space-themed design" />
</svelte:head>

<div class="main-container" style="padding-top: 2rem; padding-bottom: 2rem;">
  <div class="glass-panel" style="max-width: 1024px; margin: 0 auto;">
    <div class="panel-header" style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 1rem;">
      <a href="/" class="btn btn-outline btn-sm" aria-label="Back to Home">
        <ArrowLeft width="18" height="18" style="margin-right:6px" color="#dbeafe" />
        Back to Home
      </a>
      <div class="page-logo-avatar" aria-hidden="true">
        <img 
          src="/assets/logobmii.webp" 
          alt="BMI Logo" 
          width="60" 
          height="60"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>

    <header style="text-align:center; margin-bottom: 1.5rem;">
      <h1 class="section-title" style="margin-bottom: 0.5rem;">
        About BMI Calculator Mature
      </h1>
      <p class="section-subtitle" style="max-width: 720px; margin-inline:auto;">
        A modern, responsive Body Mass Index calculator with space-themed design, 
        built to help you monitor your health journey.
      </p>
    </header>

    <div class="feature-grid" style="margin-bottom: 1.5rem;">
      <div class="glass-card">
        <div style="text-align:center;">
          <div style="margin-bottom:0.75rem;">
            <Calculator width="40" height="40" color="#60a5fa" />
          </div>
          <h3 class="section-title" style="font-size: 1.25rem; margin-bottom: 0.35rem;">
            Accurate Calculations
          </h3>
          <p class="section-subtitle">
            Get precise BMI calculations using the standard formula with instant results and category classification.
          </p>
        </div>
      </div>

      <div class="glass-card">
        <div style="text-align:center;">
          <div style="margin-bottom:0.75rem;">
            <Smartphone width="40" height="40" color="#a78bfa" />
          </div>
          <h3 class="section-title" style="font-size: 1.25rem; margin-bottom: 0.35rem;">
            Mobile Responsive
          </h3>
          <p class="section-subtitle">
            Fully responsive design that works perfectly on all devices, from smartphones to desktops.
          </p>
        </div>
      </div>

      <div class="glass-card">
        <div style="text-align:center;">
          <div style="margin-bottom:0.75rem;">
            <Star width="40" height="40" color="#facc15" />
          </div>
          <h3 class="section-title" style="font-size: 1.25rem; margin-bottom: 0.35rem;">
            Space Theme
          </h3>
          <p class="section-subtitle">
            Beautiful space-themed interface with plasma colors and smooth animations for an engaging experience.
          </p>
        </div>
      </div>

      <div class="glass-card">
        <div style="text-align:center;">
          <div style="margin-bottom:0.75rem;">
            <ShieldCheck width="40" height="40" color="#22c55e" />
          </div>
          <h3 class="section-title" style="font-size: 1.25rem; margin-bottom: 0.35rem;">
            Privacy First
          </h3>
          <p class="section-subtitle">
            All calculations are performed locally in your browser. No data is stored or transmitted to external servers.
          </p>
        </div>
      </div>

      <div class="glass-card">
        <div style="text-align:center;">
          <div style="margin-bottom:0.75rem;">
            <Zap width="40" height="40" color="#a855f7" />
          </div>
          <h3 class="section-title" style="font-size: 1.25rem; margin-bottom: 0.35rem;">
            Fast & Lightweight
          </h3>
          <p class="section-subtitle">
            Optimized for performance with minimal loading times and smooth interactions across all devices.
          </p>
        </div>
      </div>

      <div class="glass-card">
        <div style="text-align:center;">
          <div style="margin-bottom:0.75rem;">
            <Heart width="40" height="40" color="#ef4444" />
          </div>
          <h3 class="section-title" style="font-size: 1.25rem; margin-bottom: 0.35rem;">
            Health Focused
          </h3>
          <p class="section-subtitle">
            Provides clear BMI categories and health guidance to help you understand your results better.
          </p>
        </div>
      </div>
    </div>

    <div class="glass-card" style="margin-bottom: 1.5rem;">
      <h2 class="section-title" style="text-align:center; margin-bottom: 0.75rem;">
        Understanding BMI
      </h2>
      <div style="max-width: 800px; margin-inline:auto;">
        <img 
          src="/assets/bmi-chart.webp" 
          alt="BMI Chart" 
          width="600" 
          height="400"
          style="width: 100%; height: auto; border-radius: 12px; margin-bottom: 0.75rem;"
          loading="lazy"
          decoding="async"
        />
        <div class="section-subtitle feature-grid feature-grid--two">
          <div>
            <h4 class="section-title" style="font-size: 1.125rem; margin-bottom: 0.35rem;">What is BMI?</h4>
            <p style="margin-bottom: 0.5rem;">
              Body Mass Index (BMI) is a simple calculation using a person's height and weight. 
              The BMI formula divides an adult's weight in kilograms by their height in meters squared.
            </p>
            <p>
              While BMI doesn't directly measure body fat, it's a useful screening tool for 
              categorizing weight ranges that may lead to health problems.
            </p>
          </div>
          <div>
            <h4 class="section-title" style="font-size: 1.125rem; margin-bottom: 0.35rem;">BMI Categories</h4>
            <div style="display:grid; gap: 0.35rem;">
              <p><span class="status-blue" style="font-weight:600;">Underweight:</span> Below 18.5</p>
              <p><span class="status-green" style="font-weight:600;">Healthy weight:</span> 18.5 - 24.9</p>
              <p><span class="status-yellow" style="font-weight:600;">Overweight:</span> 25.0 - 29.9</p>
              <p><span class="status-red" style="font-weight:600;">Obesity:</span> 30.0 and above</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div style="text-align:center;">
      <a href="/calculator" class="btn btn-primary btn-lg">
        <Calculator width="18" height="18" style="margin-right:6px" color="#e2e8f0" />
        Try the Calculator
      </a>
    </div>

    <footer style="margin-top: 2rem; text-align:center; font-size: 0.95rem; color: #a3b2c7; border-top: 1px solid rgba(255,255,255,0.12); padding-top: 1rem;">
      <p>
        <CheckCircle2 width="16" height="16" style="margin-right:6px; vertical-align:middle;" color="#22c55e" />
        2024-2025 LOGIGO. All rights reserved. Designed by Rezky Nightly.
        <Rocket width="16" height="16" style="margin-left:6px; vertical-align:middle;" color="#a78bfa" />
      </p>
      <p style="margin-top: 0.5rem;">
        Built with SvelteKit, TypeScript, and modern CSS
      </p>
    </footer>
  </div>
</div>


