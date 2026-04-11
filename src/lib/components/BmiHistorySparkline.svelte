<script lang="ts">
  import { browser } from '$app/environment';
  import { TrendingUp, TrendingDown, Minus } from 'lucide-svelte';

  interface Props {
    currentBmi?: number | null;
  }

  let { currentBmi = null }: Props = $props();

  interface BMIRecord {
    timestamp: number;
    bmi: number;
  }

  const MAX_POINTS = 12;
  const CHART_WIDTH = 280;
  const CHART_HEIGHT = 60;
  const PADDING = 4;

  function loadHistory(): BMIRecord[] {
    if (!browser) return [];
    try {
      const stored = localStorage.getItem('bmi.history');
      if (!stored) return [];
      const history: BMIRecord[] = JSON.parse(stored);
      return history.slice(-MAX_POINTS);
    } catch {
      return [];
    }
  }

  // History state — intentionally $state + $effect instead of writable $derived
  // because loadHistory() reads localStorage (side effect). Using $derived here
  // would reintroduce the Svelte 5 reactive graph desync bug (see PERF-06 / Bug 3).
  // eslint-disable-next-line svelte/prefer-writable-derived
  let historyState: BMIRecord[] = $state([]);

  // Side-effect: read localStorage when currentBmi changes
  $effect(() => {
    historyState = currentBmi === null ? [] : loadHistory();
  });

  let chartData = $derived.by(() => {
    if (historyState.length === 0) return null;

    const values = historyState.map(r => r.bmi);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const yPad = range * 0.15;

    const yMin = Math.max(0, min - yPad);
    const yMax = max + yPad;
    const yRange = yMax - yMin;

    const points = values.map((v, i) => {
      const x = PADDING + (i / Math.max(values.length - 1, 1)) * (CHART_WIDTH - PADDING * 2);
      const y = PADDING + (1 - (v - yMin) / yRange) * (CHART_HEIGHT - PADDING * 2);
      return { x, y, bmi: v };
    });

    // Build SVG path
    let pathD = '';
    let areaD = '';
    if (points.length > 1) {
      pathD = `M ${points[0].x} ${points[0].y}`;
      areaD = `M ${points[0].x} ${CHART_HEIGHT} L ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        pathD += ` L ${points[i].x} ${points[i].y}`;
        areaD += ` L ${points[i].x} ${points[i].y}`;
      }
      areaD += ` L ${points[points.length - 1].x} ${CHART_HEIGHT} Z`;
    }

    // Calculate trend
    const first = values[0];
    const last = values[values.length - 1];
    const diff = last - first;
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (diff > 0.3) trend = 'up';
    else if (diff < -0.3) trend = 'down';

    return { points, pathD, areaD, trend, diff, yMin, yMax, first, last, count: values.length };
  });

  function getBmiColor(bmi: number): string {
    if (bmi < 18.5) return 'var(--cat-underweight)';
    if (bmi < 25) return 'var(--cat-normal)';
    if (bmi < 30) return 'var(--cat-overweight)';
    return 'var(--cat-obese)';
  }

  function formatDate(ts: number): string {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
</script>

{#if chartData}
  <div class="sparkline-container">
    <div class="sparkline-header">
      <div class="sparkline-title">
        <TrendingUp size={16} />
        <span>History Trend</span>
      </div>
      <div class="sparkline-badge" class:trend-up={chartData.trend === 'down'} class:trend-down={chartData.trend === 'up'}>
        {#if chartData.trend === 'down'}
          <TrendingDown size={14} />
          <span>{chartData.diff.toFixed(1)}</span>
        {:else if chartData.trend === 'up'}
          <TrendingUp size={14} />
          <span>+{chartData.diff.toFixed(1)}</span>
        {:else}
          <Minus size={14} />
          <span>Stable</span>
        {/if}
      </div>
    </div>

    <div class="sparkline-chart">
      <svg viewBox="0 0 {CHART_WIDTH} {CHART_HEIGHT}" preserveAspectRatio="none" class="sparkline-svg" role="img" aria-label="BMI history sparkline chart">
        <!-- Gradient fill -->
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color={getBmiColor(chartData.last)} stop-opacity="0.3" />
            <stop offset="100%" stop-color={getBmiColor(chartData.last)} stop-opacity="0.02" />
          </linearGradient>
        </defs>

        {#if chartData.points.length > 1}
          <!-- Area fill -->
          <path d={chartData.areaD} fill="url(#sparkGrad)" />

          <!-- Line -->
          <path d={chartData.pathD} fill="none" stroke={getBmiColor(chartData.last)} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        {/if}

        <!-- Data points -->
        {#each chartData.points as pt, i (i)}
          <circle
            cx={pt.x}
            cy={pt.y}
            r={i === chartData.points.length - 1 ? 4 : 2.5}
            fill={getBmiColor(pt.bmi)}
            stroke="rgba(255,255,255,0.3)"
            stroke-width="1"
            class="spark-point"
          />
        {/each}
      </svg>

      <!-- Y-axis labels -->
      <div class="sparkline-labels">
        <span class="label-y">{chartData.yMax.toFixed(0)}</span>
        <span class="label-y">{chartData.yMin.toFixed(0)}</span>
      </div>
    </div>

    <!-- Bottom info -->
    <div class="sparkline-footer">
      <span class="sparkline-stat">
        First: <strong>{chartData.first.toFixed(1)}</strong>
      </span>
      <span class="sparkline-stat">
        Latest: <strong style="color: {getBmiColor(chartData.last)}">{chartData.last.toFixed(1)}</strong>
      </span>
      <span class="sparkline-stat">
        Entries: <strong>{chartData.count}</strong>
      </span>
    </div>
  </div>
{:else if currentBmi !== null}
  <div class="sparkline-container sparkline-empty">
    <p>No history yet. Calculate your BMI to start tracking trends.</p>
  </div>
{/if}

<style>
  .sparkline-container {
    background: var(--surface-subtle);
    border: 1px solid var(--border-slate);
    border-radius: var(--radius-lg);
    padding: 1.25rem;
    margin-top: 1rem;
  }

  .sparkline-empty {
    text-align: center;
    color: var(--text-slate);
    font-size: 0.875rem;
    padding: 1.5rem;
  }

  .sparkline-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .sparkline-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-label);
    font-weight: 500;
  }

  .sparkline-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.6rem;
    border-radius: var(--radius-full);
    background: rgba(148, 163, 184, 0.15);
    color: var(--text-label);
  }

  .sparkline-badge.trend-down {
    background: rgba(0, 200, 83, 0.15);
    color: var(--cat-normal);
  }

  .sparkline-badge.trend-up {
    background: rgba(213, 0, 0, 0.15);
    color: var(--cat-obese);
  }

  .sparkline-chart {
    position: relative;
    height: 60px;
    margin: 0 -0.25rem;
  }

  .sparkline-svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .spark-point {
    transition: r 0.2s ease;
  }

  .sparkline-labels {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    pointer-events: none;
  }

  .label-y {
    font-size: 0.6rem;
    color: #475569;
    font-family: var(--font-mono);
  }

  .sparkline-footer {
    display: flex;
    justify-content: space-between;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(148, 163, 184, 0.08);
  }

  .sparkline-stat {
    font-size: 0.75rem;
    color: var(--text-slate);
  }

  .sparkline-stat strong {
    color: var(--text-primary);
    font-weight: 600;
  }

  @media (max-width: 640px) {
    .sparkline-footer {
      flex-direction: column;
      gap: 0.25rem;
      align-items: center;
    }
  }
</style>
