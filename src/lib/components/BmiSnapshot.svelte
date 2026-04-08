<script lang="ts">
  import { Target, TrendingDown, TrendingUp, Award, Scale, Activity } from 'lucide-svelte';
  import { browser } from '$app/environment';

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

  // Cache best BMI to avoid re-reading localStorage on every reactive cycle
  let cachedBestBmi: number | null = null;

  function loadBestBmi(): number | null {
    if (!browser) return null;
    try {
      const stored = localStorage.getItem('bmi.history');
      if (!stored) return null;
      const history: BMIRecord[] = JSON.parse(stored);
      if (history.length === 0) return null;

      // Find best BMI - closest to ideal (22) within or near normal range
      const best = history.reduce((best, record) => {
        const bestDistance = Math.abs(best.bmi - IDEAL_BMI);
        const currentDistance = Math.abs(record.bmi - IDEAL_BMI);
        return currentDistance < bestDistance ? record : best;
      });

      return best.bmi;
    } catch {
      return null;
    }
  }

  // Load best BMI once and cache it; refresh when BMI changes
  let bestBmi = $derived.by(() => {
    if (currentBmi === null) {
      cachedBestBmi = null;
      return null;
    }
    // Refresh cache on each new BMI calculation
    cachedBestBmi = loadBestBmi();
    return cachedBestBmi;
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
    if (bmi < 18.5) return '#4A90E2';
    if (bmi < 25) return '#00C853';
    if (bmi < 30) return '#FFD600';
    return '#D50000';
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
      <h3>BMI Snapshot</h3>
    </div>
    <div class="gauge-subtitle">Your progress toward optimal health</div>
  </div>

  <div class="snapshot-cards">
    <!-- Current BMI Card -->
    <div class="snapshot-card current {currentBmi !== null ? getStatusBg(currentBmi) : 'status-unknown'}">
      <div class="card-label">
        <Scale size={16} />
        <span>Current</span>
      </div>
      <div class="card-value" style={currentBmi !== null ? `color: ${getStatusColor(currentBmi)}` : ''}>
        {currentBmi !== null ? currentBmi.toFixed(2) : '—'}
      </div>
      <div class="card-category">{category ?? 'N/A'}</div>
    </div>

    <!-- Best BMI Card -->
    <div class="snapshot-card best {bestBmi !== null ? getStatusBg(bestBmi) : 'status-unknown'}">
      <div class="card-label">
        <Award size={16} />
        <span>Your Best</span>
      </div>
      <div class="card-value" style={bestBmi !== null ? `color: ${getStatusColor(bestBmi)}` : ''}>
        {bestBmi !== null ? bestBmi.toFixed(2) : '—'}
      </div>
      <div class="card-category">
        {#if bestBmi !== null}
          {#if bestBmi < 18.5}
            Underweight
          {:else if bestBmi < 25}
            Normal Weight
          {:else if bestBmi < 30}
            Overweight
          {:else}
            Obese
          {/if}
        {:else}
          N/A
        {/if}
      </div>
    </div>

    <!-- Target Card -->
    <div class="snapshot-card target {currentBmi !== null ? '' : 'status-unknown'}">
      <div class="card-label">
        <Activity size={16} />
        <span>Target</span>
      </div>
      <div class="card-value" style={currentBmi !== null ? 'color: #00C853' : ''}>
        {currentBmi !== null ? IDEAL_BMI.toFixed(2) : '—'}
      </div>
      <div class="card-category">{currentBmi !== null ? 'Optimal BMI' : 'N/A'}</div>
    </div>
  </div>

  {#if currentBmi !== null}
    <div class="progress-section">
      <div class="progress-header">
        <span class="progress-label">Progress to Target</span>
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
          <span class="marker ideal">Ideal</span>
          <span class="marker">100%</span>
        </div>
      </div>

      <div class="progress-insights">
        {#if currentBmi > IDEAL_BMI}
          <div class="insight-item">
            <TrendingDown size={16} />
            <span>Need to lose <strong>{(currentBmi - IDEAL_BMI).toFixed(2)} BMI points</strong> to reach optimal</span>
          </div>
        {:else if currentBmi < IDEAL_BMI}
          <div class="insight-item">
            <TrendingUp size={16} />
            <span>Need to gain <strong>{(IDEAL_BMI - currentBmi).toFixed(2)} BMI points</strong> to reach optimal</span>
          </div>
        {:else}
          <div class="insight-item success">
            <Award size={16} />
            <span>You're at your optimal BMI! Great job maintaining your health.</span>
          </div>
        {/if}

        {#if bestBmi !== null && Math.abs(stats.diffFromBest) > 0.1}
          <div class="insight-item comparison">
            {#if stats.isImprovement}
              <TrendingDown size={16} class="trend-good" />
              <span>Better than your best recorded BMI by <strong class="trend-good">{Math.abs(stats.diffFromBest).toFixed(2)}</strong></span>
            {:else}
              <TrendingUp size={16} class="trend-bad" />
              <span>Above your best recorded BMI by <strong class="trend-bad">{Math.abs(stats.diffFromBest).toFixed(2)}</strong></span>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="empty-snapshot">
      <Activity size={48} />
      <p>Calculate your BMI to see your health snapshot</p>
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
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: 16px;
    padding: 1.25rem;
    text-align: center;
    transition: all 0.3s ease;
  }

  .snapshot-card:hover {
    transform: translateY(-4px);
    border-color: rgba(148, 163, 184, 0.3);
  }

  .snapshot-card.status-underweight {
    border-color: rgba(74, 144, 226, 0.3);
    background: rgba(74, 144, 226, 0.08);
  }

  .snapshot-card.status-normal {
    border-color: rgba(0, 200, 83, 0.3);
    background: rgba(0, 200, 83, 0.08);
  }

  .snapshot-card.status-overweight {
    border-color: rgba(255, 214, 0, 0.3);
    background: rgba(255, 214, 0, 0.08);
  }

  .snapshot-card.status-obese {
    border-color: rgba(213, 0, 0, 0.3);
    background: rgba(213, 0, 0, 0.08);
  }

  .snapshot-card.status-unknown {
    opacity: 0.7;
  }

  .snapshot-card.target {
    border-color: rgba(0, 200, 83, 0.3);
    background: rgba(0, 200, 83, 0.08);
  }

  .card-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: #64748b;
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
    color: #94a3b8;
  }

  .progress-section {
    background: rgba(15, 23, 42, 0.4);
    border: 1px solid rgba(148, 163, 184, 0.1);
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
    color: #94a3b8;
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
    background: rgba(148, 163, 184, 0.15);
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
    background: linear-gradient(90deg, #D50000 0%, #FFD600 50%, #00C853 100%);
  }

  .progress-fill.progress-gain {
    background: linear-gradient(90deg, #4A90E2 0%, #00C853 100%);
  }

  .progress-markers {
    display: flex;
    justify-content: space-between;
    margin-top: 0.5rem;
    font-size: 0.625rem;
    color: #64748b;
  }

  .progress-markers .marker.ideal {
    color: #00C853;
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
    background: rgba(15, 23, 42, 0.6);
    border-radius: 12px;
    font-size: 0.875rem;
    color: #94a3b8;
  }

  .insight-item.success {
    background: rgba(0, 200, 83, 0.1);
    border: 1px solid rgba(0, 200, 83, 0.2);
    color: #00C853;
  }

  .insight-item :global(svg) {
    flex-shrink: 0;
    color: #64748b;
  }

  .insight-item.success :global(svg) {
    color: #00C853;
  }

  .insight-item strong {
    color: white;
  }

  .trend-good {
    color: #00C853 !important;
  }

  .trend-bad {
    color: #D50000 !important;
  }

  .empty-snapshot {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
    color: #64748b;
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
