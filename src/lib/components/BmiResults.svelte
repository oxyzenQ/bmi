<script lang="ts">
  import { BarChart3, TrendingUp, Info, AlertCircle, CheckCircle, Activity } from 'lucide-svelte';

  export let bmiValue: number | null = null;
  export let category: string | null = null;
  export let age: number | null = null;

  $: hasResults = bmiValue !== null && category !== null;

  // Map category to global CSS class for colors
  $: catClass = category
    ? ({
        'underweight': 'cat-underweight',
        'normal weight': 'cat-normal',
        'overweight': 'cat-overweight',
        'obese': 'cat-obese'
      }[category.toLowerCase()] || '')
    : '';

  function getCategoryColor(category: string): string {
    switch (category.toLowerCase()) {
      case 'underweight': return '#60a5fa';
      case 'normal weight': return '#10b981';
      case 'overweight': return '#f59e0b';
      case 'obese': return '#ef4444';
      default: return '#6b7280';
    }
  }

  function getCategoryIcon(category: string) {
    switch (category.toLowerCase()) {
      case 'underweight': return AlertCircle;
      case 'normal weight': return CheckCircle;
      case 'overweight': return TrendingUp;
      case 'obese': return Activity;
      default: return BarChart3;
    }
  }

  function getHealthAdvice(category: string): string {
    switch (category.toLowerCase()) {
      case 'underweight':
        return 'Consider consulting a healthcare provider about healthy weight gain strategies.';
      case 'normal weight':
        return 'Great! Maintain your healthy lifestyle with balanced nutrition and regular exercise.';
      case 'overweight':
        return 'Focus on gradual weight loss through diet and exercise. Consult a healthcare provider.';
      case 'obese':
        return 'Seek professional medical advice for a comprehensive weight management plan.';
      default:
        return 'Please enter valid measurements to get personalized health advice.';
    }
  }

  function getAgeAdvisory(age: number): string {
    if (age < 18) {
      return 'For users under 18, BMI interpretation differs; consult a healthcare professional for age-appropriate guidance.';
    } else if (age >= 65) {
      return 'For older adults (65+), consider muscle mass and consult a healthcare professional for personalized advice.';
    } else {
      return 'This BMI assessment is for adults aged 18-64. For personalized health guidance, consult a healthcare professional.';
    }
  }
</script>

<div class="bmi-results-card liquid-glass {catClass}">
  <div class="card-header">
    <div class="icon-container">
      <BarChart3 class="w-12 h-12 text-cosmic-blue" />
      <div class="icon-glow"></div>
    </div>
    <h2 class="card-title">Your Results</h2>
    <p class="card-subtitle">Cosmic BMI analysis and personalized recommendations.</p>
  </div>

  <div class="results-content" role="status" aria-live="polite">
    {#if hasResults}
      <div class="bmi-display">
        <div class="bmi-value">
          {bmiValue!.toFixed(1)}
        </div>
        <div class="bmi-category-container">
          <svelte:component this={getCategoryIcon(category!)} class="category-icon" />
          <span class="bmi-category">
            {category}
          </span>
        </div>
      </div>

      <div class="health-advice">
        <h3 class="advice-title">
          <Info class="w-5 h-5" />
          Health Advice
        </h3>
        <p class="advice-text">{getHealthAdvice(category!)}</p>
      </div>

      {#if age}
        <div class="age-advisory">
          <h4 class="advisory-title">
            <AlertCircle class="w-4 h-4" />
            Age-Specific Note
          </h4>
          <p class="advisory-text">{getAgeAdvisory(age)}</p>
        </div>
      {/if}

      <div class="bmi-explanation">
        <h4 class="explanation-title">What this means:</h4>
        <p class="explanation-text">
          Your BMI of <strong>{bmiValue!.toFixed(1)}</strong> falls in the <strong>{category}</strong> category. 
          BMI is a screening tool that helps assess weight-related health risks.
        </p>
      </div>
    {:else}
      <div class="empty-state">
        <div class="empty-icon">
          <BarChart3 class="w-16 h-16 text-gray-400 opacity-50" />
          <div class="empty-glow"></div>
        </div>
        <p class="empty-text">Enter your measurements to see your cosmic BMI results</p>
      </div>
    {/if}
  </div>
</div>

<!-- styles moved to app.css -->
