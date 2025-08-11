<script lang="ts">
  import Hero from '$lib/ui/Hero.svelte';
  import BmiForm from '$lib/components/BmiForm.svelte';
  import BmiResults from '$lib/components/BmiResults.svelte';
  import BmiDynamicChart from '$lib/components/BmiDynamicChart.svelte';
  import ArticleCard from '$lib/components/ArticleCard.svelte';
  import ArticleModal from '$lib/components/ArticleModal.svelte';
  import ReferenceTable from '$lib/components/ReferenceTable.svelte';
  import { onMount } from 'svelte';
  
  let bmiValue: number | null = null;
  let articlesVisible = false;
  let articlesContainer: HTMLElement | null = null;
  let category: string | null = null;
  
  let age: number | null = null;
  let height: number | null = null;
  let weight: number | null = null;
  let isModalOpen = false;
  let modalTitle = '';
  let modalContent = '';

  function calculateBMI(ageInput: number, heightInput: number, weightInput: number) {
    const heightInMeters = heightInput / 100;
    const bmi = weightInput / (heightInMeters * heightInMeters);
    
    let categoryResult = '';

    if (bmi < 18.5) {
      categoryResult = 'Underweight';
    } else if (bmi >= 18.5 && bmi < 24.9) {
      categoryResult = 'Normal Weight';
    } else if (bmi >= 25 && bmi < 29.9) {
      categoryResult = 'Overweight';
    } else {
      categoryResult = 'Obese';
    }

    bmiValue = parseFloat(bmi.toFixed(1));
    category = categoryResult;
    age = ageInput;
    height = heightInput;
    weight = weightInput;
  }

  function resetResults() {
    bmiValue = null;
    category = null;
    age = null;
    height = null;
    weight = null;
  }

  function handleOpenModal(event: CustomEvent) {
    modalTitle = event.detail.title;
    modalContent = event.detail.description;
    isModalOpen = true;
  }

  function handleCloseModal() {
    isModalOpen = false;
  }

  onMount(() => {
    // Smooth scrolling optimization
    document.documentElement.style.scrollBehavior = 'smooth';
    
    // Lazy load articles section when it comes into view
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !articlesVisible) {
            articlesVisible = true;
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px' }
    );
    
    if (articlesContainer) {
      observer.observe(articlesContainer);
    }
    
    // Performance optimization: Use passive event listeners
    const handleScroll = () => {
      requestAnimationFrame(() => {
        // Smooth scroll handling if needed
      });
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  });
</script>

<svelte:head>
  <title>BMI Calculator - Calculate Your Body Mass Index</title>
  <meta name="description" content="Calculate your BMI with our modern, accessible calculator. Get instant results, health recommendations, and learn about BMI categories." />
</svelte:head>

<div class="main-container">
  <Hero />

  <!-- BMI Calculator Section -->
  <section class="bmi-section">
    <div class="bmi-grid">
      <BmiForm 
        onCalculate={calculateBMI}
        onReset={resetResults}
      />
      <BmiResults 
        {bmiValue}
        {category}
        {age}
      />
    </div>
    
    <!-- Dynamic BMI Chart - Always Visible -->
    <BmiDynamicChart 
      bmiValue={bmiValue || 0}
      category={category || 'Normal Weight'}
      age={age || 25}
      height={height || 170}
      weight={weight || 70}
    />
  </section>

  <!-- Reference Table -->
  <ReferenceTable />

  <!-- Health Articles Section -->
  <section class="py-16 px-4" bind:this={articlesContainer}>
    <div class="max-w-6xl mx-auto">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-white mb-4">Health & Wellness Articles</h2>
        <p class="text-slate-300 text-lg">Expert insights and evidence-based guidance for optimal health</p>
      </div>
      
      {#if articlesVisible}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 article-grid">
          <ArticleCard
            title="Healthy Living Tips"
            description="Discover evidence-based strategies for maintaining a healthy weight and improving overall wellness."
            icon="fa6-solid:heart-pulse"
            on:openModal={handleOpenModal}
          />
          
          <ArticleCard
            title="Exercise Guidelines"
            description="Learn about effective workout routines tailored to different BMI categories and fitness levels."
            icon="fa6-solid:person-running"
            on:openModal={handleOpenModal}
          />
          
          <ArticleCard
            title="Nutrition Advice"
            description="Explore balanced nutrition plans and dietary recommendations for optimal health outcomes."
            icon="fa6-solid:utensils"
            on:openModal={handleOpenModal}
          />

          <!-- New Cards -->
          <ArticleCard
            title="Sleep & Recovery"
            description="Understand how quality sleep and recovery improve metabolism, performance, and overall health."
            icon="fa6-solid:bed"
            on:openModal={handleOpenModal}
          />

          <ArticleCard
            title="Hydration Essentials"
            description="Why water matters: daily hydration goals, smart timing, and how fluids affect BMI and energy."
            icon="fa6-solid:water"
            on:openModal={handleOpenModal}
          />

          <ArticleCard
            title="Mental Wellness"
            description="Stress, mindfulness, and habit-building: science-backed tactics for a healthier relationship with food."
            icon="fa6-solid:brain"
            on:openModal={handleOpenModal}
          />

          <ArticleCard
            title="Preventive Care"
            description="Screenings, labs, and checkups: what to track yearly to stay ahead of health risks."
            icon="fa6-solid:stethoscope"
            on:openModal={handleOpenModal}
          />

          <ArticleCard
            title="Sunlight & Circadian Health"
            description="Light exposure, vitamin D, and circadian rhythm—optimize your day for better sleep and weight."
            icon="fa6-solid:sun"
            on:openModal={handleOpenModal}
          />

          <ArticleCard
            title="Breath & Cardio Health"
            description="Breathing mechanics, VO2, and lung health basics to support sustainable fitness progress."
            icon="fa6-solid:lungs"
            on:openModal={handleOpenModal}
          />

          <ArticleCard
            title="Metabolic Optimization"
            description="Advanced strategies for optimizing metabolic health through targeted nutrition, timing, and lifestyle interventions."
            icon="fa6-solid:dna"
            on:openModal={handleOpenModal}
          />

          <ArticleCard
            title="Hormonal Balance"
            description="Understanding key hormones that affect weight, metabolism, and overall health for optimal body composition."
            icon="fa6-solid:flask"
            on:openModal={handleOpenModal}
          />

          <ArticleCard
            title="Recovery & Longevity"
            description="Evidence-based recovery protocols and longevity practices to enhance healthspan and optimize aging."
            icon="fa6-solid:leaf"
            on:openModal={handleOpenModal}
          />
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[400px] items-center justify-center">
          <div class="col-span-full text-center text-slate-400">
            <div class="animate-pulse">Loading articles...</div>
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

{#if isModalOpen}
  <ArticleModal
    title={modalTitle}
    content={modalContent}
    isOpen={isModalOpen}
    on:close={handleCloseModal}
  />
{/if}

<style>
  :global(html) {
    scroll-behavior: smooth;
  }
  
  :global(body) {
    overflow-x: hidden;
  }
  
  .article-grid {
    animation: fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .article-grid :global(.article-card) {
    will-change: transform, opacity;
    backface-visibility: hidden;
    transform: translateZ(0);
    contain: layout style paint;
  }
  
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px) translateZ(0);
    }
    to {
      opacity: 1;
      transform: translateY(0) translateZ(0);
    }
  }
  
  @media (prefers-reduced-motion: reduce) {
    :global(html) {
      scroll-behavior: auto;
    }
    
    .article-grid,
    .article-grid :global(.article-card) {
      animation: none;
    }
  }
  
  /* Performance optimizations */
  :global(*) {
    box-sizing: border-box;
  }
  
  :global(img) {
    will-change: auto;
  }

  /* Footer glass + glossy shine */
  .footer-disclaimer {
    position: relative;
    margin: 2rem auto 1rem;
    max-width: 1000px;
    padding: 1rem 1.25rem;
    color: #cbd5e1;
    text-align: center;
    background: rgba(15, 23, 42, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
    overflow: hidden;
  }

  .footer-disclaimer::before {
    content: '';
    position: absolute;
    top: 0;
    left: -30%;
    width: 30%;
    height: 100%;
    background: linear-gradient(100deg, transparent, rgba(255,255,255,0.14), transparent);
    filter: blur(8px);
    transform: skewX(-12deg);
    opacity: 0.0;
    animation: footerGloss 6s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes footerGloss {
    0% { left: -30%; opacity: 0; }
    8% { opacity: 0.45; }
    16% { left: 110%; opacity: 0; }
    100% { left: 110%; opacity: 0; }
  }
  
  /* Smooth scrolling for webkit browsers */
  :global(::-webkit-scrollbar) {
    width: 8px;
  }
  
  :global(::-webkit-scrollbar-track) {
    background: rgba(15, 23, 42, 0.5);
  }
  
  :global(::-webkit-scrollbar-thumb) {
    background: rgba(96, 165, 250, 0.3);
    border-radius: 4px;
  }
  
  :global(::-webkit-scrollbar-thumb:hover) {
    background: rgba(96, 165, 250, 0.5);
  }
  
  /* GitHub Footer Styling */
  .github-footer {
    position: relative;
    margin: 2rem auto;
    max-width: 400px;
    text-align: center;
    overflow: hidden;
  }

  .github-link {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2rem;
    color: #e5e7eb;
    text-decoration: none;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 2rem;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(12px) saturate(150%);
    -webkit-backdrop-filter: blur(12px) saturate(150%);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }

  .github-link::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(96, 165, 250, 0.2), transparent);
    animation: githubShine 4s ease-in-out infinite;
    pointer-events: none;
  }

  .github-link:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 35px rgba(96, 165, 250, 0.2);
    border-color: rgba(96, 165, 250, 0.3);
  }

  .github-icon {
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 0.3s ease;
  }

  .github-link:hover .github-icon {
    transform: rotate(5deg) scale(1.1);
  }

  @keyframes githubShine {
    0% { left: -100%; }
    20% { left: 100%; }
    100% { left: 100%; }
  }

  /* Legacy styles */
  .bmi-section { margin: 3rem 0; }
  .bmi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem; margin-bottom: 3rem; }

  @media (max-width: 768px) {
    .bmi-grid { grid-template-columns: 1fr; gap: 2rem; }
    .bmi-section { margin: 2rem 0; }
  }

  @media (max-width: 480px) {
    .bmi-grid { gap: 1.5rem; }
  }
</style>
