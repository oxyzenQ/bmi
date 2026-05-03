<script lang="ts">
  import { Percent, Info, AlertCircle } from 'lucide-svelte';
  import { COLORS } from '$lib/utils/bmi-category';
  import { t as _t, localeVersion } from '$lib/i18n';
  let _rv = $derived($localeVersion);
  // Reactive t() — reading _rv creates a dependency so template {t('key')} re-runs on locale change
  function t(key: string, params?: Record<string, string | number | undefined | null>): string { void _rv; return _t(key, params); }

  interface Props {
    bmi?: number | null;
    age?: number | null;
  }

  let { bmi = null, age = null }: Props = $props();

  let sex = $state<'male' | 'female'>('male');

  // BMI-based body fat estimation using Deurenberg formula (1991):
  // Adult Body Fat % = (1.20 × BMI) + (0.23 × Age) − (10.8 × Sex) − 5.4
  // Sex: 1 for male, 0 for female
  // This is a population-level estimate, not clinical-grade.
  function estimateBodyFat(bmiVal: number, ageVal: number, isMale: boolean): number {
    const sexFactor = isMale ? 1 : 0;
    return (1.20 * bmiVal) + (0.23 * ageVal) - (10.8 * sexFactor) - 5.4;
  }

  function getCategory(bf: number, isMale: boolean): { label: string; color: string; desc: string } {
    if (isMale) {
      if (bf < 6) return { label: t('fat.essential'), color: COLORS.BLUE, desc: t('fat.essential_desc') };
      if (bf < 14) return { label: t('fat.athletic'), color: COLORS.GREEN, desc: t('fat.athletic_desc') };
      if (bf < 18) return { label: t('fat.fitness'), color: COLORS.GREEN, desc: t('fat.fitness_desc') };
      if (bf < 25) return { label: t('fat.average'), color: COLORS.YELLOW, desc: t('fat.average_desc') };
      return { label: t('fat.above_average'), color: COLORS.RED, desc: t('fat.above_average_desc') };
    } else {
      if (bf < 14) return { label: t('fat.essential'), color: COLORS.BLUE, desc: t('fat.essential_desc') };
      if (bf < 21) return { label: t('fat.athletic'), color: COLORS.GREEN, desc: t('fat.athletic_desc') };
      if (bf < 25) return { label: t('fat.fitness'), color: COLORS.GREEN, desc: t('fat.fitness_desc') };
      if (bf < 32) return { label: t('fat.average'), color: COLORS.YELLOW, desc: t('fat.average_desc') };
      return { label: t('fat.above_average'), color: COLORS.RED, desc: t('fat.above_average_desc') };
    }
  }

  let bodyFat = $derived.by(() => {
    if (bmi === null || age === null || bmi <= 0 || age <= 0) return null;
    const bf = estimateBodyFat(bmi, age, sex === 'male');
    return Math.round(bf * 10) / 10; // 1 decimal
  });

  let category = $derived.by(() => {
    if (bodyFat === null) return null;
    return getCategory(bodyFat, sex === 'male');
  });

  // Body composition estimate
  let leanMass = $derived.by(() => {
    if (bodyFat === null) return null;
    return Math.round((100 - bodyFat) * 10) / 10;
  });
</script>
<div class="gauge-container body-fat-container">
  <div class="gauge-header">
    <div class="gauge-title">
      <Percent class="Gauge" />
      <h3>{t('fat.title')}</h3>
    </div>
    <div class="gauge-subtitle">{t('fat.subtitle')}</div>
  </div>

  <!-- Sex toggle -->
  <div class="sex-toggle" role="radiogroup" aria-label={t('fat.sex_aria')}>
    <button
      type="button"
      class="sex-btn"
      class:active={sex === 'male'}
      role="radio"
      aria-checked={sex === 'male'}
      onclick={() => (sex = 'male')}
    >
      {t('fat.male')}
    </button>
    <button
      type="button"
      class="sex-btn"
      class:active={sex === 'female'}
      role="radio"
      aria-checked={sex === 'female'}
      onclick={() => (sex = 'female')}
    >
      {t('fat.female')}
    </button>
  </div>

  {#if bodyFat !== null && category}
    <div class="bf-result">
      <div class="bf-value" style="color: {category.color}">
        {bodyFat}%
      </div>
      <div class="bf-category" style="color: {category.color}">
        {category.label}
      </div>
    </div>

    <!-- Body composition bar -->
    <div class="composition-bar">
      <div class="comp-header">
        <span>{t('fat.composition')}</span>
      </div>
      <div class="comp-track">
        <div class="comp-fill fat" style="width: {bodyFat}%"></div>
        <div class="comp-fill lean" style="width: {leanMass}%"></div>
      </div>
      <div class="comp-legend">
        <span class="legend-item">
          <span class="legend-dot fat-dot"></span>
          {t('fat.fat_pct', { n: bodyFat })}
        </span>
        <span class="legend-item">
          <span class="legend-dot lean-dot"></span>
          {t('fat.lean_pct', { n: leanMass })}
        </span>
      </div>
    </div>

    <div class="bf-desc">{category.desc}</div>

    <!-- Info box -->
    <div class="bf-info-box">
      <Info size={14} />
      <p>{t('fat.disclaimer')}</p>
    </div>

    <!-- Category ranges -->
    <div class="bf-ranges">
      <h4>{sex === 'male' ? t('fat.men_ranges') : t('fat.women_ranges')}</h4>
      {#if sex === 'male'}
        <div class="range-row">
          <span class="range-label">{t('fat.range_essential')}</span>
          <div class="range-bar"><div class="range-fill" style="width: 24%; background: var(--cat-blue-40);"></div></div>
          <span class="range-val">2-5%</span>
        </div>
        <div class="range-row">
          <span class="range-label">{t('fat.range_athletic')}</span>
          <div class="range-bar"><div class="range-fill" style="width: 32%; background: var(--cat-green-40);"></div></div>
          <span class="range-val">6-13%</span>
        </div>
        <div class="range-row">
          <span class="range-label">{t('fat.range_fitness')}</span>
          <div class="range-bar"><div class="range-fill" style="width: 36%; background: var(--cat-green-40);"></div></div>
          <span class="range-val">14-17%</span>
        </div>
        <div class="range-row">
          <span class="range-label">{t('fat.range_average')}</span>
          <div class="range-bar"><div class="range-fill" style="width: 56%; background: var(--cat-amber-40);"></div></div>
          <span class="range-val">18-24%</span>
        </div>
        <div class="range-row">
          <span class="range-label">{t('fat.range_obese')}</span>
          <div class="range-bar"><div class="range-fill" style="width: 75%; background: var(--cat-red-40);"></div></div>
          <span class="range-val">25%+</span>
        </div>
      {:else}
        <div class="range-row">
          <span class="range-label">{t('fat.range_essential')}</span>
          <div class="range-bar"><div class="range-fill" style="width: 28%; background: var(--cat-blue-40);"></div></div>
          <span class="range-val">10-13%</span>
        </div>
        <div class="range-row">
          <span class="range-label">{t('fat.range_athletic')}</span>
          <div class="range-bar"><div class="range-fill" style="width: 42%; background: var(--cat-green-40);"></div></div>
          <span class="range-val">14-20%</span>
        </div>
        <div class="range-row">
          <span class="range-label">{t('fat.range_fitness')}</span>
          <div class="range-bar"><div class="range-fill" style="width: 42%; background: var(--cat-green-40);"></div></div>
          <span class="range-val">21-24%</span>
        </div>
        <div class="range-row">
          <span class="range-label">{t('fat.range_average')}</span>
          <div class="range-bar"><div class="range-fill" style="width: 56%; background: var(--cat-amber-40);"></div></div>
          <span class="range-val">25-31%</span>
        </div>
        <div class="range-row">
          <span class="range-label">{t('fat.range_obese')}</span>
          <div class="range-bar"><div class="range-fill" style="width: 75%; background: var(--cat-red-40);"></div></div>
          <span class="range-val">32%+</span>
        </div>
      {/if}
    </div>
  {:else if bmi !== null}
    <div class="bf-empty">
      <AlertCircle size={32} />
      <p>{t('fat.empty_age')}</p>
    </div>
  {:else}
    <div class="bf-empty">
      <Percent size={32} />
      <p>{t('fat.empty_bmi')}</p>
    </div>
  {/if}
</div>

<style>
  .body-fat-container {
    padding-top: 20px !important;
  }

  .sex-toggle {
    display: flex;
    justify-content: center;
    gap: 2px;
    border: var(--border-by-rezky);
    border-radius: 9999px;
    padding: 2px;
    margin: 1rem auto;
    width: fit-content;
  }

  .sex-btn {
    font-size: 0.8rem;
    padding: 0.35rem 1rem;
    border: none;
    border-radius: 9999px;
    background: transparent;
    color: var(--w-50);
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 500;
  }

  .sex-btn:hover {
    color: var(--w-70);
  }

  .sex-btn.active {
    background: var(--cosmic-purple);
    color: white;
  }

  .bf-result {
    text-align: center;
    margin: 1.5rem 0;
  }

  .bf-value {
    font-family: 'JetBrains Mono Variable', monospace;
    font-size: 3rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 0.25rem;
    text-shadow: 0 0 20px currentColor;
  }

  .bf-category {
    font-size: 1.1rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .composition-bar {
    margin: 1.5rem 0;
  }

  .comp-header {
    font-size: 0.8rem;
    color: var(--cat-slate-50, #94a3b8);
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .comp-track {
    display: flex;
    height: 16px;
    border-radius: 8px;
    overflow: hidden;
    background: var(--sg-10);
  }

  .comp-fill {
    height: 100%;
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .comp-fill.fat {
    background: linear-gradient(90deg, var(--cat-amber-40), var(--cat-amber-90));
  }

  .comp-fill.lean {
    background: linear-gradient(90deg, var(--cat-green-40), var(--cat-blue-40));
  }

  .comp-legend {
    display: flex;
    justify-content: center;
    gap: 1.25rem;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--cat-slate-50, #94a3b8);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .fat-dot {
    background: var(--cat-amber-90);
  }

  .lean-dot {
    background: var(--cat-green-90);
  }

  .bf-desc {
    text-align: center;
    font-size: 0.875rem;
    color: var(--cat-slate-50, #94a3b8);
    margin-bottom: 1rem;
    line-height: 1.5;
  }

  .bf-info-box {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--cat-blue-8);
    border: 1px solid var(--cat-blue-15);
    border-radius: 12px;
    margin-bottom: 1.25rem;
    font-size: 0.78rem;
    color: var(--cat-slate-50, #94a3b8);
    line-height: 1.5;
  }

  .bf-info-box :global(svg) {
    flex-shrink: 0;
    color: var(--cat-blue-40);
    margin-top: 1px;
  }

  .bf-info-box p {
    margin: 0;
  }

  .bf-ranges {
    padding: 1rem;
    background: var(--sd-40);
    border-radius: 12px;
    border: 1px solid var(--sg-10);
  }

  .bf-ranges h4 {
    margin: 0 0 0.75rem;
    font-size: 0.85rem;
    color: #e2e8f0;
    text-align: center;
  }

  .range-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.4rem;
  }

  .range-row:last-child {
    margin-bottom: 0;
  }

  .range-label {
    font-size: 0.72rem;
    color: var(--cat-slate-50, #94a3b8);
    width: 60px;
    flex-shrink: 0;
    text-align: right;
  }

  .range-bar {
    flex: 1;
    height: 8px;
    background: var(--sg-8);
    border-radius: 4px;
    overflow: hidden;
  }

  .range-fill {
    height: 100%;
    border-radius: 4px;
    opacity: 0.7;
  }

  .range-val {
    font-size: 0.7rem;
    color: var(--cat-slate-50, #94a3b8);
    width: 40px;
    flex-shrink: 0;
    font-family: 'JetBrains Mono Variable', monospace;
  }

  .bf-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2.5rem;
    text-align: center;
    color: var(--cat-slate-50, #94a3b8);
  }

  .bf-empty :global(svg) {
    margin-bottom: 0.75rem;
    opacity: 0.4;
  }

  .bf-empty p {
    font-size: 0.875rem;
    margin: 0;
  }
</style>
