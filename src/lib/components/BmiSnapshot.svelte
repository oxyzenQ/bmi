<script lang="ts">
  import { Target, TrendingDown, TrendingUp, Award, Scale, Activity } from 'lucide-svelte';
  import { browser } from '$app/environment';
  import BmiHistorySparkline from './BmiHistorySparkline.svelte';
  import { COLORS, BMI_THRESHOLDS } from '$lib/utils/bmi-category';
  import { t, localeVersion } from '$lib/i18n';
  let _rv = $derived(localeVersion);

  interface Props {
    currentBmi?: number | null;
    category?: string | null;
  }

  let { currentBmi = null, category = null }: Props = $props();

  interface BMIRecord {
    timestamp: number;
    bmi: number;
    height: number;
    weight: number;
  }

  // Ideal BMI is 22 (middle of normal range 18.5-25)
  const IDEAL_BMI = 22;

  // Best BMI state — updated via $effect (side effect isolated from derived)
  let bestBmiState: number | null = $state(null);

  // Pure derived from state (no side effects)
  let bestBmi = $derived<number | null>(bestBmiState);

  function refreshBestBmi() {
    if (!browser) return;
    try {
      const stored = localStorage.getItem('bmi.history');
      if (!stored) { bestBmiState = null; return; }
      const history: BMIRecord[] = JSON.parse(stored);
      if (history.length === 0) { bestBmiState = null; return; }

      // Find best BMI - closest to ideal (22) within or near normal range
      const best = history.reduce((best, record) => {
        const bestDistance = Math.abs(best.bmi - IDEAL_BMI);
        const currentDistance = Math.abs(record.bmi - IDEAL_BMI);
        return currentDistance < bestDistance ? record : best;
      });

      bestBmiState = best.bmi;
    } catch {
      bestBmiState = null;
    }
  }

  // Side-effect: read localStorage when currentBmi changes
  $effect(() => {
    if (currentBmi === null) {
      bestBmiState = null;
    } else {
      refreshBestBmi();
    }
  });

  let stats = $derived.by(() => {
    if (currentBmi === null) {
      return {
        diffFromIdeal: 0,
        diffFromBest: 0,
        targetWeight: null,
        progressPercent: 0,
        isImprovement: false
      };
    }

    const diffFromIdeal = currentBmi - IDEAL_BMI;
    const diffFromBest = bestBmi !== null ? currentBmi - bestBmi : 0;

    // Calculate progress to ideal (for overweight) or from underweight
    let progressPercent = 0;
    // Use fixed reference bounds for consistent progress calculation
    const BMI_MIN_REF = 1;   // Extreme underweight reference (absolute minimum)
    const BMI_MAX_REF = 50;  // Extreme obese reference (absolute maximum)

    if (currentBmi > IDEAL_BMI) {
      // Overweight - progress is reducing toward ideal
      // Progress = how far from max reference we've come toward ideal
      const totalRange = BMI_MAX_REF - IDEAL_BMI;
      const currentDistance = currentBmi - IDEAL_BMI;
      progressPercent = Math.round(((totalRange - currentDistance) / totalRange) * 100);
    } else if (currentBmi < IDEAL_BMI) {
      // Underweight - progress is gaining toward ideal
      // Progress = how far from min reference we've come toward ideal
      const totalRange = IDEAL_BMI - BMI_MIN_REF;
      const currentDistance = currentBmi - BMI_MIN_REF;
      progressPercent = Math.round((currentDistance / totalRange) * 100);
    } else {
      progressPercent = 100;
    }

    return {
      diffFromIdeal,
      diffFromBest,
      targetWeight: null,
      progressPercent: Math.max(0, Math.min(100, progressPercent)),
      isImprovement: diffFromBest < 0 // Current is better than best (lower BMI if overweight)
    };
  });

  function getStatusColor(bmi: number): string {
    if (bmi < BMI_THRESHOLDS.UNDERWEIGHT_MAX) return COLORS.BLUE;
    if (bmi < BMI_THRESHOLDS.NORMAL_MAX) return COLORS.GREEN;
    if (bmi < BMI_THRESHOLDS.OVERWEIGHT_MAX) return COLORS.YELLOW;
    return COLORS.RED;
  }

  function getStatusBg(bmi: number): string {
    if (bmi < 18.5) return 'status-underweight';
    if (bmi < 25) return 'status-normal';
    if (bmi < 30) return 'status-overweight';
    return 'status-obese';
  }
</script>

<div class="gauge-container bmi-snapshot">
  <div class="gauge-header">
    <div class="gauge-title">
      <Target class="Gauge" />
      <h3>{t('snapshot.title')}</h3>
    </div>
    <div class="gauge-subtitle">{t('snapshot.subtitle')}</div>
  </div>

  <div class="snapshot-cards">
    <!-- Current BMI Card -->
    <div class="snapshot-card current {currentBmi !== null ? getStatusBg(currentBmi) : 'status-unknown'}">
      <div class="card-label">
        <Scale size={16} />
        <span>{t('snapshot.current')}</span>
      </div>
      <div class="card-value" style={currentBmi !== null ? `color: ${getStatusColor(currentBmi)}` : ''}>
        {currentBmi !== null ? currentBmi.toFixed(2) : '—'}
      </div>
      <div class="card-category">{category ?? t('snapshot.na')}</div>
    </div>

    <!-- Best BMI Card -->
    <div class="snapshot-card best {bestBmi !== null ? getStatusBg(bestBmi) : 'status-unknown'}">
      <div class="card-label">
        <Award size={16} />
        <span>{t('snapshot.best')}</span>
      </div>
      <div class="card-value" style={bestBmi !== null ? `color: ${getStatusColor(bestBmi)}` : ''}>
        {bestBmi !== null ? bestBmi.toFixed(2) : '—'}
      </div>
      <div class="card-category">
        {#if bestBmi !== null}
          {#if bestBmi < 18.5}
            {t('category.underweight')}
          {:else if bestBmi < 25}
            {t('category.normal')}
          {:else if bestBmi < 30}
            {t('category.overweight')}
          {:else}
            {t('category.obese')}
          {/if}
        {:else}
          {t('snapshot.na')}
        {/if}
      </div>
    </div>

    <!-- Target Card -->
    <div class="snapshot-card target {currentBmi !== null ? '' : 'status-unknown'}">
      <div class="card-label">
        <Activity size={16} />
        <span>{t('snapshot.target')}</span>
      </div>
      <div class="card-value" style={currentBmi !== null ? 'color: #00C853' : ''}>
        {currentBmi !== null ? IDEAL_BMI.toFixed(2) : '—'}
      </div>
      <div class="card-category">{currentBmi !== null ? t('snapshot.optimal') : t('snapshot.na')}</div>
    </div>
  </div>

  {#if currentBmi !== null}
    <div class="progress-section">
      <div class="progress-header">
        <span class="progress-label">{t('snapshot.progress')}</span>
        <span class="progress-value">{stats.progressPercent}%</span>
      </div>

      <div class="progress-bar">
        <div class="progress-track">
          <div
            class="progress-fill {currentBmi > IDEAL_BMI ? 'progress-lose' : 'progress-gain'}"
            style="width: {stats.progressPercent}%"
          ></div>
        </div>
        <!-- Markers for reference -->
        <div class="progress-markers">
          <span class="marker">0%</span>
          <span class="marker ideal">{t('snapshot.ideal')}</span>
          <span class="marker">100%</span>
        </div>
      </div>

      <div class="progress-insights">
        {#if currentBmi > IDEAL_BMI}
          <div class="insight-item">
            <TrendingDown size={16} />
            <span>{t('snapshot.need_lose', { n: (currentBmi - IDEAL_BMI).toFixed(2) })}</span>
          </div>
        {:else if currentBmi < IDEAL_BMI}
          <div class="insight-item">
            <TrendingUp size={16} />
            <span>{t('snapshot.need_gain', { n: (IDEAL_BMI - currentBmi).toFixed(2) })}</span>
          </div>
        {:else}
          <div class="insight-item success">
            <Award size={16} />
            <span>{t('snapshot.at_optimal')}</span>
          </div>
        {/if}

        {#if bestBmi !== null && Math.abs(stats.diffFromBest) > 0.1}
          <div class="insight-item comparison">
            {#if stats.isImprovement}
              <TrendingDown size={16} class="trend-good" />
              <span>{t('snapshot.improvement', { n: Math.abs(stats.diffFromBest).toFixed(2) })}</span>
            {:else}
              <TrendingUp size={16} class="trend-bad" />
              <span>{t('snapshot.regression', { n: Math.abs(stats.diffFromBest).toFixed(2) })}</span>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <!-- BMI History Trend Sparkline -->
    <BmiHistorySparkline {currentBmi} />
  {:else}
    <div class="empty-snapshot">
      <Activity size={48} />
      <p>{t('snapshot.empty')}</p>
    </div>
  {/if}
</div>

<style>
  .bmi-snapshot {
    padding-top: 20px !important;
  }

  .snapshot-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin: 2rem 0;
  }

  .snapshot-card {
    background: var(--sd-60);
    border: 1px solid var(--sg-15);
    border-radius: 16px;
    padding: 1.25rem;
    text-align: center;
    transition: all 0.3s ease;
  }

  .snapshot-card:hover {
    transform: translateY(-4px);
    border-color: var(--sg-30);
  }

  .snapshot-card.status-underweight {
    border-color: var(--cat-blue-30);
    background: var(--cat-blue-8);
  }

  .snapshot-card.status-normal {
    border-color: var(--cat-green-30);
    background: var(--cat-green-8);
  }

  .snapshot-card.status-overweight {
    border-color: var(--cat-yellow-30);
    background: var(--cat-yellow-8);
  }

  .snapshot-card.status-obese {
    border-color: var(--cat-red-30);
    background: var(--cat-red-8);
  }

  .snapshot-card.status-unknown {
    opacity: 0.7;
  }

  .snapshot-card.target {
    border-color: var(--cat-green-30);
    background: var(--cat-green-8);
  }

  .card-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--cat-slate-50, #94a3b8);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 0.75rem;
  }

  .card-value {
    font-size: 2.5rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 0.5rem;
    color: white;
  }

  .card-category {
    font-size: 0.875rem;
    color: var(--cat-slate-50, #94a3b8);
  }

  .progress-section {
    background: var(--sd-40);
    border: 1px solid var(--sg-10);
    border-radius: 16px;
    padding: 1.5rem;
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .progress-label {
    font-size: 0.875rem;
    color: var(--cat-slate-50, #94a3b8);
  }

  .progress-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: white;
  }

  .progress-bar {
    margin-bottom: 1.5rem;
  }

  .progress-track {
    height: 12px;
    background: var(--sg-15);
    border-radius: 6px;
    overflow: hidden;
    position: relative;
  }

  .progress-fill {
    height: 100%;
    border-radius: 6px;
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .progress-fill.progress-lose {
    background: linear-gradient(90deg, var(--cat-red-90) 0%, var(--cat-yellow-40) 50%, var(--cat-green-90) 100%);
  }

  .progress-fill.progress-gain {
    background: linear-gradient(90deg, var(--cat-blue-40) 0%, var(--cat-green-90) 100%);
  }

  .progress-markers {
    display: flex;
    justify-content: space-between;
    margin-top: 0.5rem;
    font-size: 0.625rem;
    color: var(--cat-slate-50, #94a3b8);
  }

  .progress-markers .marker.ideal {
    color: var(--cat-green-90);
    font-weight: 500;
  }

  .progress-insights {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .insight-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: var(--sd-60);
    border-radius: 12px;
    font-size: 0.875rem;
    color: var(--cat-slate-50, #94a3b8);
  }

  .insight-item.success {
    background: var(--cat-green-10);
    border: 1px solid var(--cat-green-20);
    color: var(--cat-green-90);
  }

  .insight-item :global(svg) {
    flex-shrink: 0;
    color: var(--cat-slate-50, #94a3b8);
  }

  .insight-item.success :global(svg) {
    color: var(--cat-green-90);
  }

  .insight-item strong {
    color: white;
  }

  .trend-good {
    color: var(--cat-green-90) !important;
  }

  .trend-bad {
    color: var(--cat-red-90) !important;
  }

  .empty-snapshot {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
    color: var(--cat-slate-50, #94a3b8);
  }

  .empty-snapshot :global(svg) {
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  @media (max-width: 640px) {
    .snapshot-cards {
      grid-template-columns: 1fr;
    }

    .card-value {
      font-size: 2rem;
    }
  }
</style>
