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
    height?: number;
    weight?: number;
    age?: number;
  }

  const MAX_POINTS = 20;
  const CHART_WIDTH = 400;
  const CHART_HEIGHT = 140;
  const PAD_LEFT = 32;
  const PAD_RIGHT = 8;
  const PAD_TOP = 8;
  const PAD_BOTTOM = 22;

  const BMI_MIN = 12;
  const BMI_MAX = 42;

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

  // Hover state
  let hoveredIndex: number | null = $state(null);

  function getBmiColor(bmi: number): string {
    if (bmi < 18.5) return '#60a5fa';
    if (bmi < 25) return '#4ade80';
    if (bmi < 30) return '#fbbf24';
    return '#f87171';
  }

  function getBmiLabel(bmi: number): string {
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  }

  function formatDate(ts: number): string {
    const d = new Date(ts);
    return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
  }

  function formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' });
  }

  // BMI category zone boundaries (y positions)
  const plotHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const plotWidth = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;

  function bmiToY(bmi: number): number {
    return PAD_TOP + (1 - (bmi - BMI_MIN) / (BMI_MAX - BMI_MIN)) * plotHeight;
  }

  function indexToX(i: number, total: number): number {
    if (total <= 1) return PAD_LEFT + plotWidth / 2;
    return PAD_LEFT + (i / (total - 1)) * plotWidth;
  }

  let chartData = $derived.by(() => {
    if (historyState.length === 0) return null;

    const values = historyState.map(r => r.bmi);
    const first = values[0];
    const last = values[values.length - 1];
    const diff = last - first;
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (diff > 0.3) trend = 'up';
    else if (diff < -0.3) trend = 'down';

    // Build points
    const points = values.map((v, i) => ({
      x: indexToX(i, values.length),
      y: bmiToY(v),
      bmi: v,
      record: historyState[i]
    }));

    // Build SVG path using smooth cubic bezier curves
    let pathD = '';
    let areaD = '';
    // Clamp Y to prevent bezier overshoot escaping chart bounds
    const minY = PAD_TOP;
    const maxY = CHART_HEIGHT - PAD_BOTTOM;
    const clampY = (y: number) => Math.max(minY, Math.min(maxY, y));

    if (points.length > 1) {
      pathD = `M ${points[0].x} ${clampY(points[0].y)}`;
      areaD = `M ${points[0].x} ${maxY} L ${points[0].x} ${clampY(points[0].y)}`;

      if (points.length === 2) {
        // Only 2 points — simple line
        pathD += ` L ${points[1].x} ${clampY(points[1].y)}`;
        areaD += ` L ${points[1].x} ${clampY(points[1].y)}`;
      } else {
        // Catmull-Rom → cubic bezier for smooth curves through all points
        const tension = 0.25;
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[Math.max(0, i - 1)];
          const p1 = points[i];
          const p2 = points[i + 1];
          const p3 = points[Math.min(points.length - 1, i + 2)];

          const cp1x = p1.x + (p2.x - p0.x) * tension;
          const cp1y = clampY(p1.y + (p2.y - p0.y) * tension);
          const cp2x = p2.x - (p3.x - p1.x) * tension;
          const cp2y = clampY(p2.y - (p3.y - p1.y) * tension);

          pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${clampY(p2.y)}`;
          areaD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${clampY(p2.y)}`;
        }
      }
      areaD += ` L ${points[points.length - 1].x} ${CHART_HEIGHT - PAD_BOTTOM} Z`;
    }

    // BMI zone bands
    const zones = [
      { min: BMI_MIN, max: 18.5, color: 'rgba(96,165,250,0.06)', label: '' },
      { min: 18.5, max: 25, color: 'rgba(74,222,128,0.06)', label: 'Normal' },
      { min: 25, max: 30, color: 'rgba(251,191,36,0.06)', label: '' },
      { min: 30, max: BMI_MAX, color: 'rgba(248,113,113,0.06)', label: '' }
    ];

    return { points, pathD, areaD, trend, diff, first, last, count: values.length, zones };
  });

  function handlePointerMove(e: PointerEvent) {
    if (!chartData || !chartData.points.length) return;
    const svg = (e.currentTarget as SVGSVGElement);
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const scaleX = CHART_WIDTH / rect.width;
    const scaleY = CHART_HEIGHT / rect.height;
    const svgX = mx * scaleX;
    const svgY = my * scaleY;

    let closest = -1;
    let closestDist = Infinity;
    chartData.points.forEach((pt, i) => {
      const dist = Math.abs(pt.x - svgX);
      if (dist < closestDist && dist < 20) {
        closestDist = dist;
        closest = i;
      }
    });
    hoveredIndex = closest >= 0 ? closest : null;
  }

  // Clamp tooltip position to stay within chart bounds
  let tooltipStyle = $derived.by(() => {
    if (!hoveredPoint) return '';
    const pctX = (hoveredPoint.x / CHART_WIDTH) * 100;
    const pctY = (hoveredPoint.y / CHART_HEIGHT) * 100;
    // Clamp horizontal: keep tooltip at least 20% from edges
    const clampedX = Math.max(22, Math.min(78, pctX));
    // If tooltip would go above chart, flip it below the point
    const flipBelow = pctY < 25;
    const clampedY = flipBelow ? pctY + 8 : pctY;
    const transform = flipBelow ? 'translate(-50%, 12px)' : 'translate(-50%, -110%)';
    return `left: ${clampedX}%; top: ${clampedY}%; transform: ${transform};`;
  });

  function handlePointerLeave() {
    hoveredIndex = null;
  }

  let hoveredPoint = $derived.by(() => {
    if (hoveredIndex === null || !chartData) return null;
    return chartData.points[hoveredIndex] ?? null;
  });
</script>

{#if chartData}
  <div class="sparkline-container interactive">
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

    <div class="sparkline-chart interactive-chart">
      <svg
        viewBox="0 0 {CHART_WIDTH} {CHART_HEIGHT}"
        preserveAspectRatio="xMidYMid meet"
        class="sparkline-svg"
        role="img"
        aria-label="BMI history trend chart"
        onpointermove={handlePointerMove}
        onpointerleave={handlePointerLeave}
      >
        <!-- BMI zone bands -->
        {#each chartData.zones as zone (zone.min)}
          <rect
            x={PAD_LEFT}
            y={bmiToY(zone.max)}
            width={plotWidth}
            height={Math.max(0, bmiToY(zone.min) - bmiToY(zone.max))}
            fill={zone.color}
            rx="2"
          />
        {/each}

        <!-- BMI zone boundary lines -->
        <line x1={PAD_LEFT} y1={bmiToY(18.5)} x2={CHART_WIDTH - PAD_RIGHT} y2={bmiToY(18.5)} stroke="rgba(96,165,250,0.2)" stroke-width="1" stroke-dasharray="4 3" />
        <line x1={PAD_LEFT} y1={bmiToY(25)} x2={CHART_WIDTH - PAD_RIGHT} y2={bmiToY(25)} stroke="rgba(74,222,128,0.2)" stroke-width="1" stroke-dasharray="4 3" />
        <line x1={PAD_LEFT} y1={bmiToY(30)} x2={CHART_WIDTH - PAD_RIGHT} y2={bmiToY(30)} stroke="rgba(251,191,36,0.2)" stroke-width="1" stroke-dasharray="4 3" />

        <!-- Y-axis labels -->
        <text x={PAD_LEFT - 4} y={bmiToY(18.5) + 3} text-anchor="end" class="axis-label">18.5</text>
        <text x={PAD_LEFT - 4} y={bmiToY(25) + 3} text-anchor="end" class="axis-label">25</text>
        <text x={PAD_LEFT - 4} y={bmiToY(30) + 3} text-anchor="end" class="axis-label">30</text>

        <!-- Zone labels (right side, inside plot) -->
        <text x={CHART_WIDTH - PAD_RIGHT - 2} y={bmiToY(18.5) + (bmiToY(25) - bmiToY(18.5)) / 2 + 3} text-anchor="end" class="zone-label">Normal</text>

        <!-- Gradient fill + clip path -->
        <defs>
          <clipPath id="sparkClip">
            <rect x={PAD_LEFT} y={PAD_TOP} width={plotWidth} height={plotHeight} />
          </clipPath>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color={getBmiColor(chartData.last)} stop-opacity="0.25" />
            <stop offset="100%" stop-color={getBmiColor(chartData.last)} stop-opacity="0.02" />
          </linearGradient>
        </defs>

        {#if chartData.points.length > 1}
          <!-- Clipped chart content -->
          <g clip-path="url(#sparkClip)">
            <!-- Area fill -->
            <path d={chartData.areaD} fill="url(#sparkGrad)" />

            <!-- Line -->
            <path d={chartData.pathD} fill="none" stroke={getBmiColor(chartData.last)} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </g>
        {/if}

        <!-- Data points -->
        {#each chartData.points as pt, i (i)}
          <circle
            cx={pt.x}
            cy={pt.y}
            r={hoveredIndex === i ? 6 : (i === chartData.points.length - 1 ? 4 : 2.5)}
            fill={getBmiColor(pt.bmi)}
            stroke="var(--w-30)"
            stroke-width={hoveredIndex === i ? 2 : 1}
            class="spark-point"
            opacity={hoveredIndex !== null && hoveredIndex !== i ? 0.4 : 1}
          />
        {/each}

        <!-- Hover crosshair -->
        {#if hoveredPoint}
          <line
            x1={hoveredPoint.x}
            y1={PAD_TOP}
            x2={hoveredPoint.x}
            y2={CHART_HEIGHT - PAD_BOTTOM}
            stroke="rgba(255,255,255,0.15)"
            stroke-width="1"
            stroke-dasharray="3 3"
          />
          <line
            x1={PAD_LEFT}
            y1={hoveredPoint.y}
            x2={CHART_WIDTH - PAD_RIGHT}
            y2={hoveredPoint.y}
            stroke="rgba(255,255,255,0.1)"
            stroke-width="1"
            stroke-dasharray="3 3"
          />
        {/if}
      </svg>

      <!-- Tooltip -->
      {#if hoveredPoint}
        <div
          class="chart-tooltip"
          style={tooltipStyle}
        >
          <div class="tooltip-bmi" style="color: {getBmiColor(hoveredPoint.bmi)}">{hoveredPoint.bmi.toFixed(1)}</div>
          <div class="tooltip-cat">{getBmiLabel(hoveredPoint.bmi)}</div>
          <div class="tooltip-date">{formatDate(hoveredPoint.record.timestamp)}</div>
          <div class="tooltip-time">{formatTime(hoveredPoint.record.timestamp)}</div>
          <div class="tooltip-arrow"></div>
        </div>
      {/if}
    </div>

    <!-- X-axis date labels (first, middle, last) -->
    <div class="x-axis-labels">
      {#if chartData.points.length >= 2}
        <span class="x-label">{formatDate(chartData.points[0].record.timestamp)}</span>
        {#if chartData.points.length >= 3}
          <span class="x-label">{formatDate(chartData.points[Math.floor(chartData.points.length / 2)].record.timestamp)}</span>
        {/if}
        <span class="x-label">{formatDate(chartData.points[chartData.points.length - 1].record.timestamp)}</span>
      {/if}
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
  .sparkline-container.interactive {
    cursor: crosshair;
  }

  .sparkline-container {
    background: var(--sd-40);
    border: 1px solid var(--sg-10);
    border-radius: 16px;
    padding: 1.25rem;
    margin-top: 1rem;
  }

  .sparkline-empty {
    text-align: center;
    color: #64748b;
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
    color: #94a3b8;
    font-weight: 500;
  }

  .sparkline-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    background: var(--sg-15);
    color: #94a3b8;
  }

  .sparkline-badge.trend-down {
    background: var(--cat-green-15);
    color: #00C853;
  }

  .sparkline-badge.trend-up {
    background: var(--cat-red-15);
    color: #D50000;
  }

  .sparkline-chart {
    position: relative;
    height: 60px;
    margin: 0 -0.25rem;
  }

  .interactive-chart {
    height: 140px;
    margin: 0;
  }

  .sparkline-svg {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .spark-point {
    transition: r 0.15s ease, opacity 0.15s ease;
  }

  .axis-label {
    font-size: 8px;
    fill: #475569;
    font-family: 'JetBrains Mono Variable', monospace;
    dominant-baseline: middle;
  }

  .zone-label {
    font-size: 7px;
    fill: rgba(74, 222, 128, 0.4);
    font-family: 'JetBrains Mono Variable', monospace;
    dominant-baseline: middle;
  }

  .x-axis-labels {
    display: flex;
    justify-content: space-between;
    padding: 0.15rem 0.25rem 0;
    margin: 0 0.25rem;
  }

  .x-label {
    font-size: 0.55rem;
    color: #475569;
    font-family: 'JetBrains Mono Variable', monospace;
  }

  /* Tooltip */
  .chart-tooltip {
    position: absolute;
    pointer-events: none;
    z-index: 10;
    background: rgba(15, 23, 42, 0.92);
    backdrop-filter: blur(8px);
    border: 1px solid var(--w-10);
    border-radius: 10px;
    padding: 0.5rem 0.65rem;
    text-align: center;
    white-space: nowrap;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    animation: tooltipIn 0.15s ease-out;
  }

  @keyframes tooltipIn {
    from { opacity: 0; scale: 0.9; }
    to { opacity: 1; scale: 1; }
  }

  .tooltip-arrow {
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 8px;
    height: 8px;
    background: rgba(15, 23, 42, 0.92);
    border-right: 1px solid var(--w-10);
    border-bottom: 1px solid var(--w-10);
  }

  .tooltip-bmi {
    font-family: 'JetBrains Mono Variable', monospace;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .tooltip-cat {
    font-size: 0.6rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #94a3b8;
  }

  .tooltip-date {
    font-size: 0.6rem;
    color: #64748b;
    margin-top: 0.15rem;
  }

  .tooltip-time {
    font-size: 0.55rem;
    color: #475569;
    font-family: 'JetBrains Mono Variable', monospace;
  }

  .sparkline-footer {
    display: flex;
    justify-content: space-between;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--sg-8);
  }

  .sparkline-stat {
    font-size: 0.75rem;
    color: #64748b;
  }

  .sparkline-stat strong {
    color: #e2e8f0;
    font-weight: 600;
  }

  @media (max-width: 640px) {
    .sparkline-footer {
      flex-direction: column;
      gap: 0.25rem;
      align-items: center;
    }

    .interactive-chart {
      height: 110px;
    }
  }
</style>
