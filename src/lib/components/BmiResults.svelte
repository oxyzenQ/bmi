<script lang="ts">
  import { BarChart3, CircleSlash2, TrendingUp, Info, AlertCircle, CheckCircle, Activity, Target, Scale, Flame, Share2, Copy, ImageDown } from 'lucide-svelte';
  import { onDestroy } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { browser } from '$app/environment';
  import { shareBmiResult, copyToClipboard, formatBmiText } from '$lib/utils/share';
  import { shareBmiCard, downloadBmiCard } from '$lib/utils/share-image';
  import { t as _t, localeVersion } from '$lib/i18n';
  import { KG_TO_LBS } from '$lib/utils/bmi-calculator';
  let _rv = $derived($localeVersion);
  // Reactive t() — reading _rv creates a dependency so template {t('key')} re-runs on locale change
  function t(key: string, params?: Record<string, string | number | undefined | null>): string { void _rv; return _t(key, params); }

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

  // Map English category → i18n key (same pattern as BmiRadialGauge)
  const CATEGORY_I18N_KEYS: Record<string, string> = {
    'Underweight': 'category.underweight',
    'Normal Weight': 'category.normal',
    'Overweight': 'category.overweight',
    'Obese': 'category.obese',
  };
  let translatedCategory = $derived(
    category ? t(CATEGORY_I18N_KEYS[category] ?? 'category.normal') : null
  );

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
    if (bmiPrime < 0.74) return t('results.prime_significantly_under');
    if (bmiPrime < 1.00) return t('results.prime_normal');
    if (bmiPrime <= 1.20) return t('results.prime_above');
    return t('results.prime_significantly_above');
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
    return 25.0 * hM * hM;
  });

  // Convert for display based on unit system
  let idealMinDisplay = $derived(idealMin !== null ? parseFloat((unitSystem === 'imperial' ? idealMin * KG_TO_LBS : idealMin).toFixed(1)) : null);
  let idealMaxDisplay = $derived(idealMax !== null ? parseFloat((unitSystem === 'imperial' ? idealMax * KG_TO_LBS : idealMax).toFixed(1)) : null);
  let weightUnit = $derived(unitSystem === 'imperial' ? 'lbs' : 'kg');

  // How far user is from ideal range
  let weightDelta = $derived.by(() => {
    if (bmiValue === null || height === null || height <= 0 || idealMin === null || idealMax === null) return null;
    const hM = height / 100;
    // Derive current weight from BMI: w = bmi * h^2
    const currentKg = bmiValue * hM * hM;
    if (currentKg < idealMin) return { amount: parseFloat((idealMin - currentKg).toFixed(1)), direction: 'below' as const, unit: 'kg' };
    if (currentKg > idealMax) return { amount: parseFloat((currentKg - idealMax).toFixed(1)), direction: 'above' as const, unit: 'kg' };
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

  // Reactive activity labels — re-evaluates when locale changes via _rv dependency
  let activityLabels = $derived({
    sedentary: t('results.activity_sedentary'),
    light: t('results.activity_light'),
    moderate: t('results.activity_moderate'),
    active: t('results.activity_very'),
    very_active: t('results.activity_extremely')
  });

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
    if (tdee === null || bmr === null) return null;
    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      activityLabel: activity ? activityLabels[activity] ?? '' : '',
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
    if (result.ok) flashToast(t('results.copied'));
  }

  async function handleCopy() {
    if (!browser) return;
    const text = formatBmiText(getShareData());
    const ok = await copyToClipboard(text);
    flashToast(ok ? t('results.copied_short') : t('results.copy_failed'));
  }

  async function handleDownloadCard() {
    if (!browser) return;
    const ok = await downloadBmiCard(getCardData());
    flashToast(ok ? t('results.image_saved') : t('results.image_failed'));
  }

  async function handleShareCard() {
    if (!browser) return;
    const result = await shareBmiCard(getCardData());
    if (result.method === 'share') return;
    if (result.ok) flashToast(t('results.image_downloaded'));
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
        return t('results.advice_underweight');
      case 'normal weight':
        return t('results.advice_normal');
      case 'overweight':
        return t('results.advice_overweight');
      case 'obese':
        return t('results.advice_obese');
      default:
        return t('results.advice_default');
    }
  }

  function getAgeAdvisory(a: number): string {
    if (a < 18) {
      return t('results.age_under_18');
    } else if (a >= 65) {
      return t('results.age_over_65');
    } else {
      return t('results.age_default');
    }
  }
</script>
<div class="bmi-results-card {catClass}">
  <div class="card-header">
    <div class="icon-container">
      <CircleSlash2 class="CircleSlash2" />
    </div>
    <h2 class="card-title">{t('results.title')}</h2>
    <p class="card-subtitle">{t('results.subtitle')}</p>
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
            {translatedCategory}
          </span>
        </div>
      </div>

      <!-- BMI Prime Stat -->
      <div class="stat-row-grid">
        <div class="stat-block prime-block">
          <div class="stat-block-header">
            <Target class="stat-icon" />
            <span class="stat-label">{t('results.bmi_prime')}</span>
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
            <span class="stat-label">{t('results.ideal_range')}</span>
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
                {deltaDisplay.direction === 'above' ? '+' : '−'}{deltaDisplay.amount} {deltaDisplay.unit} {t('results.from_range')}
              </p>
            {:else if deltaDisplay}
              <p class="stat-desc delta-within">{t('results.within_range')}</p>
            {/if}
          {:else}
            <p class="stat-desc">{t('results.enter_height')}</p>
          {/if}
        </div>
      </div>

      <!-- TDEE Estimation -->
      {#if showTdee}
        <div class="tdee-card">
          <div class="tdee-header">
            <div class="stat-block-header">
              <Flame class="stat-icon tdee-icon" />
              <span class="stat-label">{t('results.tdee_label')}</span>
            </div>
          </div>
          <div class="tdee-grid">
            <div class="tdee-stat">
              <span class="tdee-stat-label">{t('results.bmr')}</span>
              <span class="tdee-stat-value">{tdeeDisplay!.bmr}</span>
              <span class="tdee-stat-unit">{t('results.kcal_day')}</span>
            </div>
            <div class="tdee-stat tdee-highlight">
              <span class="tdee-stat-label">{t('results.tdee')}</span>
              <span class="tdee-stat-value">{$animatedTdee.toFixed(0)}</span>
              <span class="tdee-stat-unit">{t('results.kcal_day')}</span>
            </div>
          </div>
          <div class="tdee-meta">
            <span class="tdee-activity-badge">{tdeeDisplay!.activityLabel}</span>
            <span class="tdee-gender-badge">{gender === 'male' ? t('results.male') : t('results.female')}</span>
          </div>
          <div class="tdee-ranges">
            <div class="tdee-range tdee-cut">
              <span class="tdee-range-label">{t('results.weight_loss')}</span>
              <span class="tdee-range-value">{tdeeDisplay!.deficit500}</span>
              <span class="tdee-range-unit">{t('results.kcal')}</span>
            </div>
            <div class="tdee-range tdee-maintain">
              <span class="tdee-range-label">{t('results.maintain')}</span>
              <span class="tdee-range-value">{tdeeDisplay!.tdee}</span>
              <span class="tdee-range-unit">{t('results.kcal')}</span>
            </div>
            <div class="tdee-range tdee-gain">
              <span class="tdee-range-label">{t('results.weight_gain')}</span>
              <span class="tdee-range-value">{tdeeDisplay!.surplus500}</span>
              <span class="tdee-range-unit">{t('results.kcal')}</span>
            </div>
          </div>
          <p class="tdee-disclaimer">{t('results.tdee_disclaimer')}</p>
        </div>
      {/if}

      <div class="health-advice">
        <h3 class="advice-title">
          <Info class="Info" />
          {t('results.health_advice_title')}
        </h3>
        <p class="advice-text">{getHealthAdvice(category!)}</p>
      </div>

      {#if age}
        <div class="age-advisory">
          <h4 class="advisory-title">
            <AlertCircle class="AlertCircle" />
            {t('results.age_advisory_title')}
          </h4>
          <p class="advisory-text">{getAgeAdvisory(age)}</p>
        </div>
      {/if}

      <!-- C-1/C-2/C-3: Share & Action Buttons -->
      <div class="action-buttons-row">
        <button type="button" class="action-btn" onclick={handleShare} aria-label={t('results.share_aria')}>
          <Share2 size={16} />
          <span>{t('results.share')}</span>
        </button>
        <button type="button" class="action-btn" onclick={handleCopy} aria-label={t('results.copy_aria')}>
          <Copy size={16} />
          <span>{t('results.copy')}</span>
        </button>
        <button type="button" class="action-btn" onclick={handleDownloadCard} aria-label={t('results.download_aria')}>
          <ImageDown size={16} />
          <span>{t('results.save_image')}</span>
        </button>
      </div>

      {#if shareToast}
        <div class="share-toast">{shareToast}</div>
      {/if}

      <div class="bmi-explanation">
        <h4 class="explanation-title">{t('results.what_this_means')}</h4>
        <p class="explanation-text">
          {t('results.explanation', { n: $animatedBmi.toFixed(2), category: translatedCategory ?? '' })}
        </p>
      </div>
    {:else}
      <div class="empty-state">
        <div class="empty-icon">
          <BarChart3 class="BarChart3" />
          <div class="empty-glow"></div>
        </div>
        <p class="empty-text">{t('results.empty')}</p>
      </div>
    {/if}
  </div>
</div>

<!-- styles in global-styles.css -->
