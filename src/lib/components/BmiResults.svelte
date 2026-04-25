<script lang="ts">
  import { BarChart3, CircleSlash2, TrendingUp, Info, AlertCircle, CheckCircle, Activity, Target, Scale, Flame, Share2, Copy, ImageDown } from 'lucide-svelte';
  import { onDestroy } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { browser } from '$app/environment';
  import { shareBmiResult, copyToClipboard, formatBmiText } from '$lib/utils/share';
  import { shareBmiCard, downloadBmiCard } from '$lib/utils/share-image';

  interface Props {
    bmiValue?: number | null;
    category?: string | null;
    age?: number | null;
    height?: number | null;
    weight?: number | null;
    gender?: 'male' | 'female' | null;
    activity?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | null;
    unitSystem?: 'metric' | 'imperial';
    reducedMotion?: boolean;
  }

  let {
    bmiValue = null,
    category = null,
    age = null,
    height = null,
    weight = null,
    gender = null,
    activity = null,
    unitSystem = 'metric',
    reducedMotion = false
  }: Props = $props();

  let hasResults = $derived(bmiValue !== null && category !== null);

  const animatedBmi = tweened(0, { duration: 0, easing: cubicOut });
  const animatedPrime = tweened(0, { duration: 0, easing: cubicOut });
  const animatedTdee = tweened(0, { duration: 0, easing: cubicOut });

  // Cleanup tweened store subscriptions to prevent memory leak
  onDestroy(() => {
    animatedBmi.set(0, { duration: 0 });
    animatedPrime.set(0, { duration: 0 });
    animatedTdee.set(0, { duration: 0 });
    if (shareTimer) clearTimeout(shareTimer);
  });

  // ── BMI Prime ──
  let bmiPrime = $derived(bmiValue !== null ? bmiValue / 25 : null);
  let primePercent = $derived(bmiPrime !== null ? ((bmiPrime - 1) * 100) : null);
  let primeLabel = $derived.by(() => {
    if (bmiPrime === null) return '';
    if (bmiPrime < 0.74) return 'Significantly Underweight';
    if (bmiPrime < 1.00) return 'Within Normal Range';
    if (bmiPrime <= 1.20) return 'Above Normal Range';
    return 'Significantly Above Normal';
  });

  // ── Ideal Weight Range ──
  let idealMin = $derived.by(() => {
    if (height === null || height <= 0) return null;
    const hM = height / 100;
    return 18.5 * hM * hM;
  });
  let idealMax = $derived.by(() => {
    if (height === null || height <= 0) return null;
    const hM = height / 100;
    return 24.9 * hM * hM;
  });

  // Convert for display based on unit system
  const KG_TO_LBS = 2.20462;
  let idealMinDisplay = $derived(idealMin !== null ? parseFloat((unitSystem === 'imperial' ? idealMin * KG_TO_LBS : idealMin).toFixed(1)) : null);
  let idealMaxDisplay = $derived(idealMax !== null ? parseFloat((unitSystem === 'imperial' ? idealMax * KG_TO_LBS : idealMax).toFixed(1)) : null);
  let weightUnit = $derived(unitSystem === 'imperial' ? 'lbs' : 'kg');

  // How far user is from ideal range
  let weightDelta = $derived.by(() => {
    if (bmiValue === null || height === null || height <= 0) return null;
    const hM = height / 100;
    // Derive current weight from BMI: w = bmi * h^2
    const currentKg = bmiValue * hM * hM;
    if (currentKg < idealMin!) return { amount: parseFloat((idealMin! - currentKg).toFixed(1)), direction: 'below' as const, unit: 'kg' };
    if (currentKg > idealMax!) return { amount: parseFloat((currentKg - idealMax!).toFixed(1)), direction: 'above' as const, unit: 'kg' };
    return { amount: 0, direction: 'within' as const, unit: 'kg' };
  });
  let deltaDisplay = $derived.by(() => {
    if (weightDelta === null) return null;
    const amt = unitSystem === 'imperial' ? parseFloat((weightDelta.amount * KG_TO_LBS).toFixed(1)) : weightDelta.amount;
    const u = unitSystem === 'imperial' ? 'lbs' : 'kg';
    return { amount: amt, direction: weightDelta.direction, unit: u };
  });

  // ── TDEE Estimation ──
  const ACTIVITY_FACTORS: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9
  };

  const ACTIVITY_LABELS: Record<string, string> = {
    sedentary: 'Sedentary',
    light: 'Lightly Active',
    moderate: 'Moderately Active',
    active: 'Very Active',
    very_active: 'Extremely Active'
  };

  let bmr = $derived.by(() => {
    if (gender !== 'male' && gender !== 'female') return null;
    if (age === null || height === null || weight === null) return null;
    if (age <= 0 || height <= 0 || weight <= 0) return null;
    // Mifflin-St Jeor equation (metric inputs)
    let wKg = weight;
    let hCm = height;
    // Convert imperial to metric if needed
    if (unitSystem === 'imperial') {
      wKg = weight * 0.453592;
      hCm = height * 2.54;
    }
    const base = 10 * wKg + 6.25 * hCm - 5 * age;
    return gender === 'male' ? base + 5 : base - 161;
  });

  let tdee = $derived.by(() => {
    if (bmr === null || activity === null) return null;
    const factor = ACTIVITY_FACTORS[activity] ?? null;
    if (factor === null) return null;
    return bmr * factor;
  });

  let tdeeDisplay = $derived.by(() => {
    if (tdee === null) return null;
    return {
      bmr: Math.round(bmr!),
      tdee: Math.round(tdee),
      activityLabel: activity ? ACTIVITY_LABELS[activity] ?? '' : '',
      deficit500: Math.round(tdee - 500),
      surplus500: Math.round(tdee + 500)
    };
  });

  let showTdee = $derived(tdeeDisplay !== null);

  // Animate BMI value when results change
  $effect(() => {
    if (hasResults) {
      animatedBmi.set(bmiValue!, { duration: reducedMotion ? 0 : 720, easing: cubicOut });
      animatedPrime.set(bmiPrime!, { duration: reducedMotion ? 0 : 720, easing: cubicOut });
      if (tdeeDisplay) {
        animatedTdee.set(tdeeDisplay.tdee, { duration: reducedMotion ? 0 : 720, easing: cubicOut });
      } else {
        animatedTdee.set(0, { duration: 0 });
      }
    } else {
      animatedBmi.set(0, { duration: 0 });
      animatedPrime.set(0, { duration: 0 });
      animatedTdee.set(0, { duration: 0 });
    }
  });

  // ── C-1/C-2/C-3: Share & Clipboard state ──
  let shareToast = $state('');
  let shareTimer: ReturnType<typeof setTimeout> | null = null;

  function flashToast(msg: string) {
    shareToast = msg;
    if (shareTimer) clearTimeout(shareTimer);
    shareTimer = setTimeout(() => { shareToast = ''; }, 2000);
  }

  function getShareData() {
    return {
      bmi: bmiValue!,
      category: category!,
      height,
      weight,
      unitSystem,
      bmiPrime,
      tdee
    };
  }

  function getCardData() {
    return {
      bmi: bmiValue!,
      category: category!,
      bmiPrime,
      tdee,
      idealMin: idealMinDisplay,
      idealMax: idealMaxDisplay,
      weightUnit
    };
  }

  async function handleShare() {
    if (!browser) return;
    const result = await shareBmiResult(getShareData());
    if (result.method === 'share') return; // native share sheet handled it
    if (result.ok) flashToast('Copied to clipboard!');
  }

  async function handleCopy() {
    if (!browser) return;
    const text = formatBmiText(getShareData());
    const ok = await copyToClipboard(text);
    flashToast(ok ? 'Copied!' : 'Failed to copy');
  }

  async function handleDownloadCard() {
    if (!browser) return;
    const ok = await downloadBmiCard(getCardData());
    flashToast(ok ? 'Image saved!' : 'Failed to generate image');
  }

  async function handleShareCard() {
    if (!browser) return;
    const result = await shareBmiCard(getCardData());
    if (result.method === 'share') return;
    if (result.ok) flashToast('Image downloaded!');
  }

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

      <!-- BMI Prime Stat -->
      <div class="stat-row-grid">
        <div class="stat-block prime-block">
          <div class="stat-block-header">
            <Target class="stat-icon" />
            <span class="stat-label">BMI Prime</span>
          </div>
          <div class="stat-value-row">
            <span class="stat-number">{$animatedPrime.toFixed(2)}</span>
            {#if primePercent !== null && primePercent !== 0}
              <span class="stat-badge" class:badge-above={primePercent! > 0} class:badge-below={primePercent! < 0}>
                {primePercent! > 0 ? '+' : ''}{primePercent!.toFixed(0)}%
              </span>
            {/if}
          </div>
          <p class="stat-desc">{primeLabel}</p>
          <div class="prime-bar-track">
            <div
              class="prime-bar-fill"
              class:fill-under={$animatedPrime < 1.0}
              class:fill-normal={$animatedPrime >= 0.74 && $animatedPrime <= 1.0}
              class:fill-over={$animatedPrime > 1.0 && $animatedPrime <= 1.2}
              class:fill-obese={$animatedPrime > 1.2}
              style="width: {Math.min(100, Math.max(0, ($animatedPrime / 1.6) * 100))}%"
            ></div>
            <div class="prime-bar-marker" style="left: 62.5%"></div>
          </div>
          <div class="prime-bar-labels">
            <span>0</span>
            <span class="label-marker">1.0</span>
            <span>1.6</span>
          </div>
        </div>

        <!-- Ideal Weight Range Stat -->
        <div class="stat-block ideal-block">
          <div class="stat-block-header">
            <Scale class="stat-icon" />
            <span class="stat-label">Ideal Range</span>
          </div>
          {#if idealMinDisplay !== null && idealMaxDisplay !== null}
            <div class="stat-value-row">
              <span class="stat-number range-num">{idealMinDisplay}</span>
              <span class="range-sep">&mdash;</span>
              <span class="stat-number range-num">{idealMaxDisplay}</span>
              <span class="stat-unit">{weightUnit}</span>
            </div>
            {#if deltaDisplay && deltaDisplay.direction !== 'within'}
              <p class="stat-desc delta-desc" class:delta-above={deltaDisplay.direction === 'above'} class:delta-below={deltaDisplay.direction === 'below'}>
                {deltaDisplay.direction === 'above' ? '+' : '−'}{deltaDisplay.amount} {deltaDisplay.unit} from range
              </p>
            {:else if deltaDisplay}
              <p class="stat-desc delta-within">You are within range</p>
            {/if}
          {:else}
            <p class="stat-desc">Enter height to see ideal range</p>
          {/if}
        </div>
      </div>

      <!-- TDEE Estimation -->
      {#if showTdee}
        <div class="tdee-card">
          <div class="tdee-header">
            <div class="stat-block-header">
              <Flame class="stat-icon tdee-icon" />
              <span class="stat-label">TDEE Estimator</span>
            </div>
          </div>
          <div class="tdee-grid">
            <div class="tdee-stat">
              <span class="tdee-stat-label">BMR</span>
              <span class="tdee-stat-value">{tdeeDisplay!.bmr}</span>
              <span class="tdee-stat-unit">kcal/day</span>
            </div>
            <div class="tdee-stat tdee-highlight">
              <span class="tdee-stat-label">TDEE</span>
              <span class="tdee-stat-value">{$animatedTdee.toFixed(0)}</span>
              <span class="tdee-stat-unit">kcal/day</span>
            </div>
          </div>
          <div class="tdee-meta">
            <span class="tdee-activity-badge">{tdeeDisplay!.activityLabel}</span>
            <span class="tdee-gender-badge">{gender === 'male' ? 'Male' : 'Female'}</span>
          </div>
          <div class="tdee-ranges">
            <div class="tdee-range tdee-cut">
              <span class="tdee-range-label">Weight Loss</span>
              <span class="tdee-range-value">{tdeeDisplay!.deficit500}</span>
              <span class="tdee-range-unit">kcal</span>
            </div>
            <div class="tdee-range tdee-maintain">
              <span class="tdee-range-label">Maintain</span>
              <span class="tdee-range-value">{tdeeDisplay!.tdee}</span>
              <span class="tdee-range-unit">kcal</span>
            </div>
            <div class="tdee-range tdee-gain">
              <span class="tdee-range-label">Weight Gain</span>
              <span class="tdee-range-value">{tdeeDisplay!.surplus500}</span>
              <span class="tdee-range-unit">kcal</span>
            </div>
          </div>
          <p class="tdee-disclaimer">Based on Mifflin-St Jeor equation. Estimates only; consult a professional for personalized advice.</p>
        </div>
      {/if}

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

      <!-- C-1/C-2/C-3: Share & Action Buttons -->
      <div class="action-buttons-row">
        <button type="button" class="action-btn" onclick={handleShare} aria-label="Share result">
          <Share2 size={16} />
          <span>Share</span>
        </button>
        <button type="button" class="action-btn" onclick={handleCopy} aria-label="Copy to clipboard">
          <Copy size={16} />
          <span>Copy</span>
        </button>
        <button type="button" class="action-btn" onclick={handleDownloadCard} aria-label="Download result card">
          <ImageDown size={16} />
          <span>Save Image</span>
        </button>
      </div>

      {#if shareToast}
        <div class="share-toast">{shareToast}</div>
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
        <p class="empty-text">Enter your measurements to see your cosmic BMI results</p>
      </div>
    {/if}
  </div>
</div>

<!-- styles in global-styles.css -->
