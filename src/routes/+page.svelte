<script lang="ts">
  import Hero from '$lib/ui/Hero.svelte';
  import BmiForm from '$lib/components/BmiForm.svelte';
  import BmiResults from '$lib/components/BmiResults.svelte';
  import BmiRadialGauge from '$lib/components/BmiRadialGauge.svelte';
  import ArticleCard from '$lib/components/ArticleCard.svelte';
  import ReferenceTable from '$lib/components/ReferenceTable.svelte';
  import { onMount } from 'svelte';
  // lucide icons for ArticleCard
  import { Heart, Activity, Utensils, BedDouble, Droplet, Brain, Stethoscope, Sun, Wind, Dna, FlaskConical, Leaf } from 'lucide-svelte';
  
  let bmiValue: number | null = null;
  let articlesVisible = true;
  let articlesContainer: HTMLElement | null = null;
  let category: string | null = null;
  
  // Form inputs default empty strings for validation UX
  let age: string = '';
  let height: string = '';
  let weight: string = '';
  let isModalOpen = false;
  let modalTitle = '';
  let modalContent = '';
  // Charts are always visible - no show/hide logic needed
  
  // BMI history for tracking calculations
  let bmiHistory: Array<{bmi: number, timestamp: Date}> = [];

  // Lazy modal component
  let ModalComp: typeof import('$lib/components/ArticleModal.svelte').default | null = null;
  
  function computeBMIFromInputs(h: string, w: string, a: string) {
    const parsedHeight = parseFloat(h);
    const parsedWeight = parseFloat(w);
    const parsedAge = parseInt(a);
    
    if (!isNaN(parsedHeight) && !isNaN(parsedWeight) && parsedHeight > 0 && parsedWeight > 0) {
      const heightInM = parsedHeight / 100;
      const bmi = parsedWeight / (heightInM * heightInM);
      bmiValue = parseFloat(bmi.toFixed(2));

      // Determine category with improved accuracy
      if (bmi < 18.5) {
        category = 'Underweight';
      } else if (bmi >= 18.5 && bmi < 25.0) {
        category = 'Normal Weight';
      } else if (bmi >= 25.0 && bmi < 30.0) {
        category = 'Overweight';
      } else {
        category = 'Obese';
      }
      
      // Add to history
      bmiHistory = [...bmiHistory, { bmi: bmiValue, timestamp: new Date() }];
    } else {
      bmiValue = null;
      category = null;
    }
  }

  // Manual calculation only - remove auto calculation
  function handleCalculate() {
    computeBMIFromInputs(height, weight, age);
  }

  function clearAllData() {
    age = '';
    height = '';
    weight = '';
    bmiValue = null; // Gauge will show empty/neutral state
    category = null;
    bmiHistory = []; // Clear history
  }

  function handleOpenModal(event: CustomEvent) {
    console.log('Modal event received:', event.detail); // Debug
    modalTitle = event.detail.title || 'Article';
    modalContent = event.detail.description || 'Content loading...';
    // Lazy-load modal on first open
    if (!ModalComp) {
      import('$lib/components/ArticleModal.svelte').then((m) => {
        ModalComp = m.default;
        isModalOpen = true;
      });
      return;
    }
    isModalOpen = true;
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    
    // Force modal to show with timeout
    setTimeout(() => {
      const modal = document.querySelector('.modal-overlay');
      if (modal) {
        (modal as HTMLElement).style.display = 'flex';
        (modal as HTMLElement).style.zIndex = '99999';
      }
    }, 10);
  }

  function handleCloseModal() {
    isModalOpen = false;
    // Restore body scroll when modal is closed
    document.body.style.overflow = 'auto';
    // Unmount modal component for performance
    setTimeout(() => {
      if (!isModalOpen) ModalComp = null;
    }, 300); // Wait for close animation
  }

  onMount(() => {
    // Smooth scrolling optimization
    document.documentElement.style.scrollBehavior = 'smooth';
    
    // Articles are now always visible by default, no lazy loading needed
    // Keep performance optimization for smooth scrolling
    const handleScroll = () => {
      requestAnimationFrame(() => {
        // Smooth scroll handling if needed
      });
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  });
</script>

<svelte:head>
  <title>BMI Calculator - Calculate Your Body Mass Index</title>
  <meta name="description" content="Calculate your BMI with our modern, accessible calculator. Get instant results, health recommendations, and learn about BMI categories." />
  <link rel="preload" as="image" href="/images/HDRV3Stellar.png" fetchpriority="high" />
</svelte:head>

<div class="main-container">
  <div>
    <Hero />
  </div>

  <!-- BMI Calculator Section -->
  <section class="bmi-section">
    <div class="bmi-grid">
      <div class="bmi-card form-card">
        <BmiForm 
          bind:age
          bind:height
          bind:weight
          onClear={clearAllData}
          onCalculate={handleCalculate}
        />
      </div>
      <div class="bmi-card">
        <BmiResults 
          {bmiValue}
          {category}
          age={age === '' ? null : parseInt(age)}
        />
      </div>
    </div>
    
    <!-- BMI Gauge - Always visible -->
    <div class="charts-section">
      <BmiRadialGauge 
        bmi={bmiValue || 0}
        category={category}
      />
    </div>
  </section>

  <!-- Reference Table -->
  <ReferenceTable />

  <!-- Health Articles Section -->
  <section class="article-section" bind:this={articlesContainer}>
    <div class="main-container">
      <div class="section-header">
        <h2 class="title">Health & Wellness Articles</h2>
        <p class="subtitle">Expert insights and evidence-based guidance for optimal health</p>
      </div>
      {#if articlesVisible}
        <div class="article-grid">
          <ArticleCard
            title="Healthy Living Tips"
            description="Discover evidence-based strategies for maintaining a healthy weight and improving overall wellness."
            icon={Heart}
            on:openModal={handleOpenModal}
          />
          
          <ArticleCard
            title="Exercise Guidelines"
            description="Learn about effective workout routines tailored to different BMI categories and fitness levels."
            icon={Activity}
            on:openModal={handleOpenModal}
          />
          
          <ArticleCard
            title="Nutrition Advice"
            description="Explore balanced nutrition plans and dietary recommendations for optimal health outcomes."
            icon={Utensils}
            on:openModal={handleOpenModal}
          />

          <!-- New Cards -->
          <ArticleCard
            title="Sleep & Recovery"
            description="Understand how quality sleep and recovery improve metabolism, performance, and overall health."
            icon={BedDouble}
            on:openModal={handleOpenModal}
          />

          <ArticleCard
            title="Hydration Essentials"
            description="Why water matters: daily hydration goals, smart timing, and how fluids affect BMI and energy."
            icon={Droplet}
            on:openModal={handleOpenModal}
          />

          <ArticleCard
            title="Mental Wellness"
            description="Stress, mindfulness, and habit-building: science-backed tactics for a healthier relationship with food."
            icon={Brain}
            on:openModal={handleOpenModal}
          />

          <ArticleCard
            title="Preventive Care"
            description="Screenings, labs, and checkups: what to track yearly to stay ahead of health risks."
            icon={Stethoscope}
            on:openModal={handleOpenModal}
          />

          <ArticleCard
            title="Sunlight & Circadian Health"
            description="Light exposure, vitamin D, and circadian rhythm—optimize your day for better sleep and weight."
            icon={Sun}
            on:openModal={handleOpenModal}
          />

          <ArticleCard
            title="Breath & Cardio Health"
            description="Breathing mechanics, VO2, and lung health basics to support sustainable fitness progress."
            icon={Wind}
            on:openModal={handleOpenModal}
          />

          <ArticleCard
            title="Metabolic Optimization"
            description="Advanced strategies for optimizing metabolic health through targeted nutrition, timing, and lifestyle interventions."
            icon={Dna}
            on:openModal={handleOpenModal}
          />

          <ArticleCard
            title="Hormonal Balance"
            description="Understanding key hormones that affect weight, metabolism, and overall health for optimal body composition."
            icon={FlaskConical}
            on:openModal={handleOpenModal}
          />

          <ArticleCard
            title="Recovery & Longevity"
            description="Evidence-based recovery protocols and longevity practices to enhance healthspan and optimize aging."
            icon={Leaf}
            on:openModal={handleOpenModal}
          />
        </div>
      {:else}
        <div class="article-grid" style="min-height: 240px;">
          <div class="bmi-card" style="text-align:center; color: #a3b2c7; display:flex; align-items:center; justify-content:center;">
            Loading articles...
          </div>
        </div>
      {/if}
    </div>
  </section>
</div>

<footer class="footer-disclaimer">
  <p>
    BMI is a screening tool and should not be used as a sole diagnostic method. 
    Please consult healthcare professionals for comprehensive health assessment.
  </p>
</footer>

<div class="github-footer">
  <a 
    href="https://github.com/oxyzenq/devv3" 
    target="_blank" 
    rel="noopener noreferrer"
    class="github-link"
  >
    <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
    <span>by rezky_nightky</span>
  </a>
</div>

{#if isModalOpen && ModalComp}
  <svelte:component
    this={ModalComp}
    title={modalTitle}
    content={modalContent}
    isOpen={isModalOpen}
    on:close={handleCloseModal}
  />
{/if}
<!-- styles moved to app.css -->
