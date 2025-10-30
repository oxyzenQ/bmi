<script lang="ts">
  import Hero from '$lib/ui/Hero.svelte';
  import BmiForm from '$lib/components/BmiForm.svelte';
  import BmiResults from '$lib/components/BmiResults.svelte';
  import BmiRadialGauge from '$lib/components/BmiRadialGauge.svelte';
  import ReferenceTable from '$lib/components/ReferenceTable.svelte';
  import { onMount } from 'svelte';
  // icons for About BMI section
  import { Lightbulb, Users, GitCompare, PackageCheck, Brush, AlertTriangle, Scale } from 'lucide-svelte';

  let bmiValue: number | null = null;
  let category: string | null = null;

  // Form inputs default empty strings for validation UX
  let age: string = '';
  let height: string = '';
  let weight: string = '';
  // BMI history for tracking calculations
  let bmiHistory: Array<{bmi: number, timestamp: Date}> = [];

  function computeBMIFromInputs(h: string, w: string, _a: string) {
    const parsedHeight = parseFloat(h);
    const parsedWeight = parseFloat(w);

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

  onMount(() => {
    // Smooth scrolling optimization
    document.documentElement.style.scrollBehavior = 'smooth';
  });
</script>

<svelte:head>
  <title>BMI Calculator - Calculate Your Body Mass Index</title>
  <meta name="description" content="Calculate your BMI with our modern, accessible calculator. Get instant results, health recommendations, and learn about BMI categories." />
  <link rel="preload" as="image" href="/images/HDRstellar-v1.webp" fetchpriority="high" />
</svelte:head>

<div class="main-container">
  <div>
    <Hero />
  </div>

  <!-- BMI Calculator Section -->
  <section class="bmi-section">
    <div class="bmi-grid">
      <div class="form-card">
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

  <!-- About BMI Section -->
  <section id="about" class="about-bmi-section">
    <div class="main-container">
      <div class="section-header-v2">
        <h2 class="title">About BMI</h2>
        <p class="subtitle">Understanding Body Mass Index and our application</p>
      </div>

      <div class="about-bmi-grid">
        <!-- What is BMI Card -->
        <div class="about-card">
          <div class="about-card-header">
            <Lightbulb class="Lightbulb" />
            <h3>What is BMI?</h3>
          </div>
          <div class="about-card-content">
            <p>
              Body Mass Index (BMI) is a simple weight‑for‑height index: weight (kg) divided by height (m) squared.
              It’s a quick population‑level screening tool to gauge potential health risk.
            </p>
            <p>
              Adult ranges: <em>Underweight</em> (&lt; 18.5), <em>Normal</em> (18.5–24.9), <em>Overweight</em> (25.0–29.9),
              <em>Obese</em> (≥ 30).
            </p>
            <p>
              Limitations: BMI doesn’t distinguish fat vs muscle or fat distribution. Use it alongside waist circumference,
              body‑fat %, lifestyle factors, and clinical assessment.
            </p>
          </div>
        </div>

        <!-- About Our App Card -->
        <div class="about-card">
          <div class="about-card-header">
            <Users class="Users" />
            <h3>About Our BMI App</h3>
          </div>
          <div class="about-card-content">
            <p>
              Our BMI app features a modern and clean design, developed by <strong>Team LOGIGO</strong>.
              The team includes Rezky (Project Lead), Fiqih (Menu Design), Agus (Competitor Research),
              Virlan (Login Functionality), Andre (Graph and BMI Calculation Functions), and Ferdian (Website Testing).
              Thank you for your support!
            </p>
            <div class="app-info">
              <p class="info-row">
                <PackageCheck class="PackageCheck" />
                <strong>Version:</strong>Stellar-3.0
              </p>
              <p class="info-row">
                <GitCompare class="GitCompare" />
                <strong>Type Apps:</strong><span class="text-gradient-elegant">Open Source Project</span>
              </p>
              <p class="info-row">
                <Brush class="Brush" />
                <strong>Status:</strong>Maintenance
              </p>
              <p class="info-row">
                <Scale class="Scale" />
                <strong>License:</strong>GPL v3
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</div>

<footer class="footer-disclaimer">
  <div class="disclaimer-icon">
    <AlertTriangle class="AlertTriangle" />
  </div>
  <p>
    BMI is a screening tool and should not be used as a sole diagnostic method.
    Please consult healthcare professionals for comprehensive health assessment.
  </p>
</footer>

<div class="github-footer">
  <a
    href="https://github.com/oxyzenq/web-oxy"
    target="_blank"
    rel="noopener noreferrer"
    class="github-link"
  >
    <span>
      &copy; <span id="current-year"></span> Rezky Nightky. All rights reserved.
    </span>
    <script>
      document.getElementById('current-year').textContent = new Date().getFullYear();
    </script>
  </a>
</div>

<!-- styles moved to app.css -->
