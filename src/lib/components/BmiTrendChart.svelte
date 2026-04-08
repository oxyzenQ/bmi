<script lang="ts">
  import { browser } from '$app/environment';
  import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-svelte';

  interface Props {
    currentBmi?: number | null;
  }

  let { currentBmi = null }: Props = $props();

  interface BMIRecord {
    timestamp: number;
    bmi: number;
    height: number;
    weight: number;
    age?: number;
  }

  const MAX_POINTS = 30;
  const VIEW_W = 600;
  const VIEW_H = 300;
  const PAD = { left: 50, right: 20, top: 20, bottom: 40 };
  const PLOT_W = VIEW_W - PAD.left - PAD.right;
  const PLOT_H = VIEW_H - PAD.top - PAD.bottom;
  const Y_MIN_HARD = 12;
  const Y_MAX_HARD = 42;

  // BMI category boundaries
  const BMI_UNDERWEIGHT_MAX = 18.5;
  const BMI_NORMAL_MAX = 24.9;
  const BMI_OVERWEIGHT_MAX = 29.9;
  const GRID_LINES = [15, 18.5, 25, 30, 35, 40];

  // Hover tracking state
  let hoveredIndex: number | null = $state(null);
  let tooltipX: number = $state(0);
  let tooltipY: number = $state(0);

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

  let history = $derived.by(() => {
    if (currentBmi === null) return [];
    return loadHistory();
  });

  function getBmiCategory(bmi: number): string {
    if (bmi < BMI_UNDERWEIGHT_MAX) return 'Underweight';
    if (bmi < BMI_NORMAL_MAX + 0.1) return 'Normal';
    if (bmi < BMI_OVERWEIGHT_MAX + 0.1) return 'Overweight';
    return 'Obese';
  }

  function getBmiColor(bmi: number): string {
    if (bmi < BMI_UNDERWEIGHT_MAX) return '#4A90E2';
    if (bmi < BMI_NORMAL_MAX + 0.1) return '#00C853';
    if (bmi < BMI_OVERWEIGHT_MAX + 0.1) return '#FFD600';
    return '#D50000';
  }

  function formatShortDate(ts: number): string {
    const d = new Date(ts);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  }

  function formatFullDate(ts: number): string {
    const d = new Date(ts);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  // Simple linear regression: returns { slope, intercept, startVal, endVal } or null
  function linearRegression(values: number[]): { slope: number; intercept: number; startVal: number; endVal: number } | null {
    if (values.length < 2) return null;
    const n = values.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }
    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) return null;
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    return {
      slope,
      intercept,
      startVal: intercept,
      endVal: slope * (n - 1) + intercept
    };
  }

  let chartData = $derived.by(() => {
    if (history.length === 0) return null;

    const values = history.map((r) => r.bmi);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const range = dataMax - dataMin || 1;
    const yPad = range * 0.15;

    // Auto-scale Y axis with hard limits
    const yMin = Math.max(Y_MIN_HARD, Math.floor(dataMin - yPad));
    const yMax = Math.min(Y_MAX_HARD, Math.ceil(dataMax + yPad));
    const yRange = Math.max(yMax - yMin, 1);

    // Map BMI value to Y coordinate within plot area
    function yScale(val: number): number {
      return PAD.top + (1 - (val - yMin) / yRange) * PLOT_H;
    }

    // Map index to X coordinate within plot area
    function xScale(i: number): number {
      if (values.length === 1) return PAD.left + PLOT_W / 2;
      return PAD.left + (i / (values.length - 1)) * PLOT_W;
    }

    // Build polyline points
    const points = values.map((v, i) => ({
      x: xScale(i),
      y: yScale(v),
      bmi: v,
      timestamp: history[i].timestamp,
      index: i
    }));

    // Build SVG polyline string for the data line
    const linePoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    // Build area fill path
    let areaPath = '';
    if (points.length > 1) {
      areaPath = `M ${points[0].x.toFixed(1)},${VIEW_H - PAD.bottom}`;
      for (const p of points) {
        areaPath += ` L ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      }
      areaPath += ` L ${points[points.length - 1].x.toFixed(1)},${VIEW_H - PAD.bottom} Z`;
    }

    // Linear regression trend line
    const regression = linearRegression(values);
    let trendPath = '';
    if (regression && values.length >= 2) {
      const y1 = yScale(regression.startVal);
      const y2 = yScale(regression.endVal);
      trendPath = `M ${xScale(0).toFixed(1)},${y1.toFixed(1)} L ${xScale(values.length - 1).toFixed(1)},${y2.toFixed(1)}`;
    }

    // Statistics
    const first = values[0];
    const last = values[values.length - 1];
    const change = last - first;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = dataMin;
    const max = dataMax;
    const count = values.length;

    // Trend direction for display
    let trendDir: 'up' | 'down' | 'stable' = 'stable';
    if (regression) {
      if (regression.slope > 0.05) trendDir = 'up';
      else if (regression.slope < -0.05) trendDir = 'down';
    }

    // X-axis date labels — pick evenly spaced labels (max ~6 labels)
    const labelCount = Math.min(values.length, 6);
    const step = Math.max(1, Math.floor((values.length - 1) / (labelCount - 1)));
    const xLabels: { x: number; label: string }[] = [];
    for (let i = 0; i < values.length; i += step) {
      xLabels.push({ x: xScale(i), label: formatShortDate(history[i].timestamp) });
    }
    // Ensure last point is included
    if (xLabels[xLabels.length - 1]?.x !== xScale(values.length - 1)) {
      xLabels.push({ x: xScale(values.length - 1), label: formatShortDate(history[values.length - 1].timestamp) });
    }

    return {
      points,
      linePoints,
      areaPath,
      trendPath,
      yMin,
      yMax,
      yRange,
      xLabels,
      stats: { first, last, change, avg, min, max, count },
      trendDir
    };
  });

  function handlePointHover(event: MouseEvent, pt: { x: number; y: number; bmi: number; timestamp: number; index: number }) {
    if (!browser) return;
    const svgEl = (event.target as SVGElement).closest('svg');
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const svgWidth = rect.width;
    const svgHeight = rect.height;

    // Convert viewBox coordinates to screen coordinates for tooltip
    tooltipX = (pt.x / VIEW_W) * svgWidth;
    tooltipY = (pt.y / VIEW_H) * svgHeight;
    hoveredIndex = pt.index;
  }

  function handlePointLeave() {
    hoveredIndex = null;
  }
</script>

<div class="gauge-container trend-chart-container">
  <div class="gauge-header">
    <div class="gauge-title">
      <BarChart3 class="Gauge" />
      <h3>BMI Trend Chart</h3>
    </div>
    <div class="gauge-subtitle">Track your BMI over time with detailed analytics</div>
  </div>

  {#if chartData}
    <div class="trend-chart-wrapper">
      <!-- Trend indicator badge -->
      <div class="trend-badge" class:trend-up={chartData.trendDir === 'up'} class:trend-down={chartData.trendDir === 'down'}>
        {#if chartData.trendDir === 'down'}
          <TrendingDown size={14} />
          <span>Declining Trend</span>
        {:else if chartData.trendDir === 'up'}
          <TrendingUp size={14} />
          <span>Rising Trend</span>
        {:else}
          <span>Stable</span>
        {/if}
      </div>

      <!-- SVG Chart -->
      <div class="chart-area">
        <svg
          viewBox="0 0 {VIEW_W} {VIEW_H}"
          preserveAspectRatio="xMidYMid meet"
          class="chart-svg"
          role="img"
          aria-label="BMI trend chart showing {chartData.stats.count} data points"
        >
          <defs>
            <!-- Area gradient fill -->
            <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color={getBmiColor(chartData.stats.last)} stop-opacity="0.25" />
              <stop offset="100%" stop-color={getBmiColor(chartData.stats.last)} stop-opacity="0.02" />
            </linearGradient>
            <!-- Line gradient (left to right based on first/last colors) -->
            <linearGradient id="trendLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color={getBmiColor(chartData.stats.first)} />
              <stop offset="100%" stop-color={getBmiColor(chartData.stats.last)} />
            </linearGradient>
          </defs>

          <!-- BMI category zone bands -->
          {#if chartData.yMin < BMI_UNDERWEIGHT_MAX}
            <rect
              x={PAD.left}
              y={PAD.top + (1 - (Math.min(BMI_UNDERWEIGHT_MAX, chartData.yMax) - chartData.yMin) / chartData.yRange) * PLOT_H}
              width={PLOT_W}
              height={(Math.min(BMI_UNDERWEIGHT_MAX, chartData.yMax) - Math.max(chartData.yMin, Y_MIN_HARD)) / chartData.yRange * PLOT_H}
              fill="#4A90E2"
              opacity="0.08"
              class="zone-band"
            />
          {/if}
          {#if chartData.yMax > BMI_UNDERWEIGHT_MAX && chartData.yMin < BMI_NORMAL_MAX + 0.1}
            <rect
              x={PAD.left}
              y={PAD.top + (1 - (Math.min(BMI_NORMAL_MAX + 0.1, chartData.yMax) - chartData.yMin) / chartData.yRange) * PLOT_H}
              width={PLOT_W}
              height={(Math.min(BMI_NORMAL_MAX + 0.1, chartData.yMax) - Math.max(BMI_UNDERWEIGHT_MAX, chartData.yMin)) / chartData.yRange * PLOT_H}
              fill="#00C853"
              opacity="0.08"
              class="zone-band"
            />
          {/if}
          {#if chartData.yMax > BMI_NORMAL_MAX + 0.1 && chartData.yMin < BMI_OVERWEIGHT_MAX + 0.1}
            <rect
              x={PAD.left}
              y={PAD.top + (1 - (Math.min(BMI_OVERWEIGHT_MAX + 0.1, chartData.yMax) - chartData.yMin) / chartData.yRange) * PLOT_H}
              width={PLOT_W}
              height={(Math.min(BMI_OVERWEIGHT_MAX + 0.1, chartData.yMax) - Math.max(BMI_NORMAL_MAX + 0.1, chartData.yMin)) / chartData.yRange * PLOT_H}
              fill="#FFD600"
              opacity="0.08"
              class="zone-band"
            />
          {/if}
          {#if chartData.yMax > BMI_OVERWEIGHT_MAX + 0.1}
            <rect
              x={PAD.left}
              y={PAD.top + (1 - (Math.min(Y_MAX_HARD, chartData.yMax) - chartData.yMin) / chartData.yRange) * PLOT_H}
              width={PLOT_W}
              height={(Math.min(Y_MAX_HARD, chartData.yMax) - Math.max(BMI_OVERWEIGHT_MAX + 0.1, chartData.yMin)) / chartData.yRange * PLOT_H}
              fill="#D50000"
              opacity="0.08"
              class="zone-band"
            />
          {/if}

          <!-- Grid lines -->
          {#each GRID_LINES as gridVal (gridVal)}
            {#if gridVal >= chartData.yMin && gridVal <= chartData.yMax}
              <line
                x1={PAD.left}
                y1={PAD.top + (1 - (gridVal - chartData.yMin) / chartData.yRange) * PLOT_H}
                x2={VIEW_W - PAD.right}
                y2={PAD.top + (1 - (gridVal - chartData.yMin) / chartData.yRange) * PLOT_H}
                stroke="rgba(148, 163, 184, 0.15)"
                stroke-width="1"
                stroke-dasharray="4 4"
                class="grid-line"
              />
            {/if}
          {/each}

          <!-- Y-axis labels -->
          {#each GRID_LINES as gridVal (gridVal)}
            {#if gridVal >= chartData.yMin && gridVal <= chartData.yMax}
              <text
                x={PAD.left - 8}
                y={PAD.top + (1 - (gridVal - chartData.yMin) / chartData.yRange) * PLOT_H + 3.5}
                text-anchor="end"
                fill="#64748b"
                font-size="10"
                font-family="'JetBrains Mono Variable', monospace"
                class="y-label"
              >
                {gridVal}
              </text>
            {/if}
          {/each}

          <!-- X-axis date labels -->
          {#each chartData.xLabels as label (label.label)}
            <text
              x={label.x}
              y={VIEW_H - PAD.bottom + 20}
              text-anchor="middle"
              fill="#64748b"
              font-size="9"
              font-family="'JetBrains Mono Variable', monospace"
              class="x-label"
            >
              {label.label}
            </text>
          {/each}

          <!-- Area fill -->
          {#if chartData.points.length > 1}
            <path d={chartData.areaPath} fill="url(#trendAreaGrad)" class="area-fill" />
          {/if}

          <!-- Trend regression line -->
          {#if chartData.trendPath}
            <path
              d={chartData.trendPath}
              fill="none"
              stroke="rgba(148, 163, 184, 0.4)"
              stroke-width="1.5"
              stroke-dasharray="6 4"
              class="trend-line"
            />
          {/if}

          <!-- Data line -->
          {#if chartData.points.length > 1}
            <polyline
              points={chartData.linePoints}
              fill="none"
              stroke="url(#trendLineGrad)"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="data-line"
            />
          {/if}

          <!-- Data points -->
          {#each chartData.points as pt, i (i)}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={i === chartData.points.length - 1 ? 5 : 3}
              fill={getBmiColor(pt.bmi)}
              stroke="rgba(255,255,255,0.3)"
              stroke-width={i === chartData.points.length - 1 ? 2 : 1}
              class="data-point"
              class:highlighted={i === chartData.points.length - 1}
              onmouseenter={(e) => handlePointHover(e, pt)}
              onmouseleave={handlePointLeave}
              role="button"
              tabindex="0"
              aria-label="BMI {pt.bmi.toFixed(1)} on {formatFullDate(pt.timestamp)}"
            />
          {/each}

          <!-- Highlighted point glow ring -->
          {#if chartData.points.length > 0}
            {@const lastPt = chartData.points[chartData.points.length - 1]}
            <circle
              cx={lastPt.x}
              cy={lastPt.y}
              r="9"
              fill="none"
              stroke={getBmiColor(lastPt.bmi)}
              stroke-width="1"
              opacity="0.4"
              class="glow-ring"
            />
          {/if}
        </svg>

        <!-- Hover tooltip -->
        {#if hoveredIndex !== null && chartData.points[hoveredIndex]}
          {@const pt = chartData.points[hoveredIndex]}
          <div
            class="chart-tooltip"
            style="left: {tooltipX}px; top: {tooltipY}px;"
          >
            <div class="tooltip-date">{formatFullDate(pt.timestamp)}</div>
            <div class="tooltip-bmi" style="color: {getBmiColor(pt.bmi)}">
              BMI {pt.bmi.toFixed(1)}
            </div>
            <div class="tooltip-category">{getBmiCategory(pt.bmi)}</div>
          </div>
        {/if}
      </div>

      <!-- BMI Category Legend -->
      <div class="category-legend">
        <span class="legend-item"><span class="legend-swatch" style="background: #4A90E2;"></span>Underweight</span>
        <span class="legend-item"><span class="legend-swatch" style="background: #00C853;"></span>Normal</span>
        <span class="legend-item"><span class="legend-swatch" style="background: #FFD600;"></span>Overweight</span>
        <span class="legend-item"><span class="legend-swatch" style="background: #D50000;"></span>Obese</span>
      </div>

      <!-- Statistics bar -->
      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-label">First</span>
          <span class="stat-value" style="color: {getBmiColor(chartData.stats.first)}">{chartData.stats.first.toFixed(1)}</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-label">Latest</span>
          <span class="stat-value" style="color: {getBmiColor(chartData.stats.last)}">{chartData.stats.last.toFixed(1)}</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-label">Change</span>
          <span class="stat-value" class:positive={chartData.stats.change < 0} class:negative={chartData.stats.change > 0}>
            {chartData.stats.change >= 0 ? '+' : ''}{chartData.stats.change.toFixed(1)}
          </span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-label">Average</span>
          <span class="stat-value">{chartData.stats.avg.toFixed(1)}</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-label">Min</span>
          <span class="stat-value" style="color: {getBmiColor(chartData.stats.min)}">{chartData.stats.min.toFixed(1)}</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-label">Max</span>
          <span class="stat-value" style="color: {getBmiColor(chartData.stats.max)}">{chartData.stats.max.toFixed(1)}</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-label">Count</span>
          <span class="stat-value">{chartData.stats.count}</span>
        </div>
      </div>
    </div>
  {:else if currentBmi !== null}
    <div class="trend-empty">
      <BarChart3 size={40} />
      <p>No history yet. Calculate your BMI a few times to see your trend chart.</p>
    </div>
  {:else}
    <div class="trend-empty">
      <BarChart3 size={40} />
      <p>Calculate your BMI to see the trend chart.</p>
    </div>
  {/if}
</div>

<style>
  .trend-chart-container {
    padding-top: 20px !important;
  }

  .trend-chart-wrapper {
    margin-top: 1rem;
  }

  .trend-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    background: rgba(148, 163, 184, 0.15);
    color: #94a3b8;
    margin-bottom: 0.75rem;
  }

  .trend-badge.trend-down {
    background: rgba(0, 200, 83, 0.15);
    color: #00C853;
  }

  .trend-badge.trend-up {
    background: rgba(213, 0, 0, 0.15);
    color: #D50000;
  }

  .chart-area {
    position: relative;
    width: 100%;
    margin-bottom: 0.75rem;
  }

  .chart-svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .zone-band {
    pointer-events: none;
  }

  .grid-line {
    pointer-events: none;
  }

  .y-label {
    user-select: none;
    pointer-events: none;
  }

  .x-label {
    user-select: none;
    pointer-events: none;
  }

  .area-fill {
    pointer-events: none;
  }

  .trend-line {
    pointer-events: none;
  }

  .data-line {
    pointer-events: none;
  }

  .data-point {
    cursor: pointer;
    transition: r 0.15s ease, stroke-width 0.15s ease;
  }

  .data-point:hover {
    r: 6;
    stroke-width: 2;
  }

  .data-point.highlighted {
    r: 5;
  }

  .data-point.highlighted:hover {
    r: 7;
  }

  .glow-ring {
    pointer-events: none;
  }

  /* Tooltip */
  .chart-tooltip {
    position: absolute;
    transform: translate(-50%, -120%);
    pointer-events: none;
    background: rgba(15, 23, 42, 0.92);
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: 10px;
    padding: 0.5rem 0.75rem;
    text-align: center;
    white-space: nowrap;
    z-index: 10;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }

  .tooltip-date {
    font-size: 0.7rem;
    color: #64748b;
    font-family: 'JetBrains Mono Variable', monospace;
  }

  .tooltip-bmi {
    font-size: 1rem;
    font-weight: 700;
    font-family: 'JetBrains Mono Variable', monospace;
    margin: 0.15rem 0;
    text-shadow: 0 0 8px currentColor;
  }

  .tooltip-category {
    font-size: 0.7rem;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 500;
  }

  /* Category Legend */
  .category-legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    font-size: 0.7rem;
    color: #94a3b8;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .legend-swatch {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    flex-shrink: 0;
    opacity: 0.7;
  }

  /* Statistics bar */
  .stats-bar {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    gap: 0;
    padding: 0.75rem 0.5rem;
    background: rgba(15, 23, 42, 0.4);
    border: 1px solid rgba(148, 163, 184, 0.1);
    border-radius: 12px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.25rem 0.6rem;
  }

  .stat-label {
    font-size: 0.6rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.15rem;
  }

  .stat-value {
    font-size: 0.9rem;
    font-weight: 700;
    color: #e2e8f0;
    font-family: 'JetBrains Mono Variable', monospace;
  }

  .stat-value.positive {
    color: #00C853;
  }

  .stat-value.negative {
    color: #D50000;
  }

  .stat-divider {
    width: 1px;
    height: 28px;
    background: rgba(148, 163, 184, 0.12);
    margin: 0 0.25rem;
  }

  /* Empty state */
  .trend-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2.5rem;
    text-align: center;
    color: #64748b;
  }

  .trend-empty :global(svg) {
    margin-bottom: 0.75rem;
    opacity: 0.4;
  }

  .trend-empty p {
    font-size: 0.875rem;
    margin: 0;
  }

  @media (max-width: 640px) {
    .stats-bar {
      gap: 0;
    }

    .stat-item {
      padding: 0.25rem 0.35rem;
    }

    .stat-value {
      font-size: 0.8rem;
    }

    .stat-label {
      font-size: 0.55rem;
    }

    .stat-divider {
      margin: 0 0.15rem;
    }

    .category-legend {
      gap: 0.5rem;
      font-size: 0.65rem;
    }
  }
</style>
