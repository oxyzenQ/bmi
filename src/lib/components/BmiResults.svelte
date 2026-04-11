<script lang="ts">
  import { BarChart3, CircleSlash2, TrendingUp, Info, AlertCircle, CheckCircle, Activity } from 'lucide-svelte';
  import { onDestroy } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  interface Props {
    bmiValue?: number | null;
    category?: string | null;
    age?: number | null;
    reducedMotion?: boolean;
  }

  let {
    bmiValue = null,
    category = null,
    age = null,
    reducedMotion = false
  }: Props = $props();

  let hasResults = $derived(bmiValue !== null && category !== null);

  const animatedBmi = tweened(0, { duration: 0, easing: cubicOut });

  // Cleanup tweened store subscription to prevent memory leak
  onDestroy(() => {
    animatedBmi.set(0, { duration: 0 });
  });

  // Animate BMI value when results change
  $effect(() => {
    if (hasResults) {
      animatedBmi.set(bmiValue!, { duration: reducedMotion ? 0 : 720, easing: cubicOut });
    } else {
      animatedBmi.set(0, { duration: 0 });
    }
  });

  let catClass = $derived(
    category
      ? ({
          'underweight': 'cat-underweight',
          'normal weight': 'cat-normal',
          'overweight': 'cat-overweight',
          'obese': 'cat-obese'
        }[category.toLowerCase()] || '')
      : ''
  );

  // Dynamic icon component for the category (Svelte 5 runes: components are dynamic by default)
  let CategoryIcon = $derived.by(() => {
    if (!category) return BarChart3;
    switch (category.toLowerCase()) {
      case 'underweight': return AlertCircle;
      case 'normal weight': return CheckCircle;
      case 'overweight': return TrendingUp;
      case 'obese': return Activity;
      default: return BarChart3;
    }
  });

  function getHealthAdvice(cat: string): string {
    switch (cat.toLowerCase()) {
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

  function getAgeAdvisory(a: number): string {
    if (a < 18) {
      return 'For users under 18, BMI interpretation differs; consult a healthcare professional for age-appropriate guidance.';
    } else if (a >= 65) {
      return 'For older adults (65+), consider muscle mass and consult a healthcare professional for personalized advice.';
    } else {
      return 'This BMI assessment is for adults aged 18-64. For personalized health guidance, consult a healthcare professional.';
    }
  }
</script>

<div class="bmi-results-card {catClass}">
  <div class="card-header">
    <div class="icon-container">
      <CircleSlash2 class="CircleSlash2" />
      <div class="icon-glow"></div>
    </div>
    <h2 class="card-title">Your Results</h2>
    <p class="card-subtitle">Cosmic BMI analysis and personalized recommendations.</p>
  </div>

  <div class="results-content" role="status" aria-live="polite">
    {#if hasResults}
      <div class="bmi-display">
        <div class="bmi-value">
          {$animatedBmi.toFixed(2)}
        </div>
        <div class="bmi-category-container">
          <CategoryIcon class="category-icon" />
          <span class="bmi-category">
            {category}
          </span>
        </div>
      </div>

      <div class="health-advice">
        <h3 class="advice-title">
          <Info class="Info" />
          Health Advice
        </h3>
        <p class="advice-text">{getHealthAdvice(category!)}</p>
      </div>

      {#if age}
        <div class="age-advisory">
          <h4 class="advisory-title">
            <AlertCircle class="AlertCircle" />
            Age-Specific Note
          </h4>
          <p class="advisory-text">{getAgeAdvisory(age)}</p>
        </div>
      {/if}

      <div class="bmi-explanation">
        <h4 class="explanation-title">What this means:</h4>
        <p class="explanation-text">
          Your BMI of <strong>{$animatedBmi.toFixed(2)}</strong> falls in the <strong>{category}</strong> category.
          BMI is a screening tool that helps assess weight-related health risks.
        </p>
      </div>
    {:else}
      <div class="empty-state">
        <div class="empty-icon">
          <BarChart3 class="BarChart3" />
          <div class="empty-glow"></div>
        </div>
        <p class="empty-text">Enter your measurements to see your BMI results</p>
      </div>
    {/if}
  </div>
</div>

<style>
  /* ── Card Container ── */
  .bmi-results-card {
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-md);
    padding: var(--sp-6);
    transition: border-color var(--dur-normal) var(--ease-out),
                box-shadow var(--dur-normal) var(--ease-out);
  }

  .bmi-results-card.cat-underweight {
    border-color: color-mix(in srgb, var(--cat-underweight) 25%, var(--border-subtle));
  }
  .bmi-results-card.cat-normal {
    border-color: color-mix(in srgb, var(--cat-normal) 25%, var(--border-subtle));
  }
  .bmi-results-card.cat-overweight {
    border-color: color-mix(in srgb, var(--cat-overweight) 25%, var(--border-subtle));
  }
  .bmi-results-card.cat-obese {
    border-color: color-mix(in srgb, var(--cat-obese) 25%, var(--border-subtle));
  }

  /* ── Card Header ── */
  .card-header {
    margin-bottom: var(--sp-6);
    text-align: center;
  }

  .icon-container {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin-bottom: var(--sp-4);
    border-radius: var(--radius-md);
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
  }

  .icon-container :global(svg) {
    width: 20px;
    height: 20px;
    position: relative;
    z-index: 1;
  }

  .icon-glow {
    display: none; /* Subtle glow removed for clean premium look */
  }

  .card-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 var(--sp-1) 0;
    letter-spacing: -0.01em;
  }

  .card-subtitle {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ── Results Content ── */
  .results-content {
    animation: fadeIn var(--dur-normal) var(--ease-out);
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── BMI Display ── */
  .bmi-display {
    text-align: center;
    padding: var(--sp-6) var(--sp-4);
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    margin-bottom: var(--sp-5);
  }

  .bmi-value {
    font-size: 3.5rem;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.03em;
    margin-bottom: var(--sp-3);
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
    transition: color var(--dur-normal) var(--ease-out);
  }

  .bmi-results-card.cat-underweight .bmi-value {
    color: var(--cat-underweight);
  }
  .bmi-results-card.cat-normal .bmi-value {
    color: var(--cat-normal);
  }
  .bmi-results-card.cat-overweight .bmi-value {
    color: var(--cat-overweight);
  }
  .bmi-results-card.cat-obese .bmi-value {
    color: var(--cat-obese);
  }

  .bmi-category-container {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-1) var(--sp-4);
    border-radius: 100px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    transition: border-color var(--dur-normal) var(--ease-out);
  }

  .bmi-results-card.cat-underweight .bmi-category-container {
    border-color: color-mix(in srgb, var(--cat-underweight) 30%, transparent);
    color: var(--cat-underweight);
  }
  .bmi-results-card.cat-normal .bmi-category-container {
    border-color: color-mix(in srgb, var(--cat-normal) 30%, transparent);
    color: var(--cat-normal);
  }
  .bmi-results-card.cat-overweight .bmi-category-container {
    border-color: color-mix(in srgb, var(--cat-overweight) 30%, transparent);
    color: var(--cat-overweight);
  }
  .bmi-results-card.cat-obese .bmi-category-container {
    border-color: color-mix(in srgb, var(--cat-obese) 30%, transparent);
    color: var(--cat-obese);
  }

  .category-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .bmi-category {
    font-size: 0.8125rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* ── Health Advice ── */
  .health-advice {
    padding: var(--sp-5);
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    margin-bottom: var(--sp-4);
  }

  .advice-title {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 var(--sp-3) 0;
  }

  .advice-title :global(svg) {
    width: 16px;
    height: 16px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .advice-text {
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--text-secondary);
    margin: 0;
  }

  /* ── Age Advisory ── */
  .age-advisory {
    padding: var(--sp-4) var(--sp-5);
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    margin-bottom: var(--sp-4);
  }

  .advisory-title {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 var(--sp-2) 0;
  }

  .advisory-title :global(svg) {
    width: 14px;
    height: 14px;
    color: var(--cat-overweight);
    flex-shrink: 0;
  }

  .advisory-text {
    font-size: 0.8125rem;
    line-height: 1.6;
    color: var(--text-secondary);
    margin: 0;
  }

  /* ── BMI Explanation ── */
  .bmi-explanation {
    padding: var(--sp-4) var(--sp-5);
    border-top: 1px solid var(--border-subtle);
    margin-top: var(--sp-4);
  }

  .explanation-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 var(--sp-2) 0;
  }

  .explanation-text {
    font-size: 0.8125rem;
    line-height: 1.6;
    color: var(--text-muted);
    margin: 0;
  }

  .explanation-text :global(strong) {
    color: var(--text-secondary);
    font-weight: 600;
  }

  /* ── Empty State ── */
  .empty-state {
    text-align: center;
    padding: var(--sp-8) var(--sp-4);
  }

  .empty-icon {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    margin-bottom: var(--sp-4);
    color: var(--text-muted);
    opacity: 0.5;
  }

  .empty-icon :global(svg) {
    width: 28px;
    height: 28px;
    position: relative;
    z-index: 1;
  }

  .empty-glow {
    display: none; /* Minimal empty state — no glow */
  }

  .empty-text {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.5;
  }
</style>
