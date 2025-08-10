<script lang="ts">
  import { onMount } from 'svelte';
  import Hero from '$lib/ui/Hero.svelte';
  import BmiForm from '$lib/components/BmiForm.svelte';
  import BmiResults from '$lib/components/BmiResults.svelte';
  import ReferenceTable from '$lib/components/ReferenceTable.svelte';
  import ArticleCard from '$lib/components/ArticleCard.svelte';
  import ArticleModal from '$lib/components/ArticleModal.svelte';

  let bmiValue: number | null = null;
  let category: string | null = null;
  let categoryClass: string | null = null;
  let age: number | null = null;
  let isModalOpen = false;
  let modalTitle = '';
  let modalContent = '';

  function calculateBMI(ageInput: number, height: number, weight: number) {
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);
    
    let categoryResult = '';
    let categoryClassResult = '';

    if (bmi < 18.5) {
      categoryResult = 'Underweight';
      categoryClassResult = 'text-blue-400';
    } else if (bmi >= 18.5 && bmi < 24.9) {
      categoryResult = 'Normal Weight';
      categoryClassResult = 'text-green-400';
    } else if (bmi >= 25 && bmi < 29.9) {
      categoryResult = 'Overweight';
      categoryClassResult = 'text-yellow-400';
    } else {
      categoryResult = 'Obese';
      categoryClassResult = 'text-red-400';
    }

    bmiValue = parseFloat(bmi.toFixed(1));
    category = categoryResult;
    categoryClass = categoryClassResult;
    age = ageInput;
  }

  function resetResults() {
    bmiValue = null;
    category = null;
    categoryClass = null;
    age = null;
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
    // Smooth background scrolling without jitter
    let ticking = false;
    let lastScrollY = window.scrollY;

    function updateBackgroundPosition() {
      const scrolled = window.scrollY;
      const rate = scrolled * -0.5;
      document.body.style.backgroundPosition = `center ${rate}px`;
      ticking = false;
    }

    function requestTick() {
      if (!ticking) {
        requestAnimationFrame(updateBackgroundPosition);
        ticking = true;
      }
    }

    function handleScroll() {
      lastScrollY = window.scrollY;
      requestTick();
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => window.removeEventListener('scroll', handleScroll);
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
        {categoryClass}
        {age}
      />
    </div>
  </section>

  <!-- Reference Table -->
  <ReferenceTable />

  <!-- Health Articles Section -->
  <section class="articles-section">
    <div class="section-header">
      <h2 class="section-title">Health & Wellness Articles</h2>
      <p class="section-subtitle">Evidence-based health information and tips for your cosmic journey.</p>
    </div>

    <div class="articles-grid">
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

<!-- Article Modal -->
<ArticleModal 
  isOpen={isModalOpen}
  title={modalTitle}
  content={modalContent}
  on:close={handleCloseModal}
/>

<style>
  .bmi-section {
    margin: 3rem 0;
  }

  .bmi-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2.5rem;
    margin-bottom: 3rem;
  }

  .articles-section {
    margin: 4rem 0;
  }

  .section-header {
    text-align: center;
    margin-bottom: 3rem;
  }

  .section-title {
    font-size: 2.5rem;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 1rem;
    background: linear-gradient(135deg, #60a5fa, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .section-subtitle {
    color: #9ca3af;
    font-size: 1.125rem;
    line-height: 1.6;
    max-width: 600px;
    margin: 0 auto;
  }

  .articles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 2rem;
  }

  @media (max-width: 768px) {
    .bmi-grid {
      grid-template-columns: 1fr;
      gap: 2rem;
    }

    .articles-grid {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .section-title {
      font-size: 2rem;
    }

    .section-subtitle {
      font-size: 1rem;
    }

    .bmi-section {
      margin: 2rem 0;
    }

    .articles-section {
      margin: 3rem 0;
    }
  }

  @media (max-width: 480px) {
    .section-title {
      font-size: 1.75rem;
    }

    .bmi-grid {
      gap: 1.5rem;
    }

    .articles-grid {
      gap: 1rem;
    }
  }
</style>
