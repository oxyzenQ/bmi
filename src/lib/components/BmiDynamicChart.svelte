<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { TrendingUp, Activity, Target } from 'lucide-svelte';

  export let bmiValue: number | null = null;
  export let category: string | null = null;
  export let age: number | null = null;
  export let height: number | null = null;
  export let weight: number | null = null;

  let wrapperEl: HTMLDivElement;

  // BMI categories with enhanced data
  const bmiCategories = [
    { min: 0, max: 18.5, label: 'Underweight', color: '#60a5fa', bgColor: 'rgba(96, 165, 250, 0.1)' },
    { min: 18.5, max: 24.9, label: 'Normal', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' },
    { min: 25, max: 29.9, label: 'Overweight', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' },
    { min: 30, max: 34.9, label: 'Obese I', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)' },
    { min: 35, max: 39.9, label: 'Obese II', color: '#dc2626', bgColor: 'rgba(220, 38, 38, 0.1)' },
    { min: 40, max: 50, label: 'Obese III', color: '#991b1b', bgColor: 'rgba(153, 27, 27, 0.1)' }
  ];

  // Chart dimensions (responsive)
  let chartWidth = 640;
  let chartHeight = 400;
  const margin = { top: 0, right: 36, bottom: 0, left: 54 };
  $: innerWidth = chartWidth - margin.left - margin.right;
  $: innerHeight = chartHeight - margin.top - margin.bottom;

  // Direct reactive chart data generation
  $: chartData = generateChartData(bmiValue, height, weight);
  $: hasData = bmiValue !== null && age !== null && height !== null && weight !== null;

  const GRID_HORIZONTAL = 5;
  const GRID_VERTICAL = 9;

  function getMinWeight(data: Array<{ weight: number }>) {
    let min = Infinity;
    for (const d of data) {
      if (d.weight < min) min = d.weight;
    }
    return min === Infinity ? 0 : min;
  }

  function getMaxWeight(data: Array<{ weight: number }>) {
    let max = -Infinity;
    for (const d of data) {
      if (d.weight > max) max = d.weight;
    }
    return max === -Infinity ? 1 : max;
  }

  function getMinBmi(data: Array<{ bmi: number }>) {
    let min = Infinity;
    for (const d of data) {
      if (d.bmi < min) min = d.bmi;
    }
    return min === Infinity ? 0 : min;
  }

  function getMaxBmi(data: Array<{ bmi: number }>) {
    let max = -Infinity;
    for (const d of data) {
      if (d.bmi > max) max = d.bmi;
    }
    return max === -Infinity ? 1 : max;
  }

  $: minWeight = chartData.length ? getMinWeight(chartData) : 0;
  $: maxWeight = chartData.length ? getMaxWeight(chartData) : 1;

  // Always show chart with fallback domain [0,1] when no data
  $: yDataMin = chartData.length ? getMinBmi(chartData) : 0;
  $: yDataMax = chartData.length ? getMaxBmi(chartData) : 1;
  // Use exact data range, fallback to [0,1] for visibility
  $: yMin = chartData.length ? (yDataMin === yDataMax ? Math.max(0, yDataMin - 0.5) : yDataMin) : 0;
  $: yMax = chartData.length ? (yDataMin === yDataMax ? yDataMin + 0.5 : yDataMax) : 1;

  function generateChartData(bmi: number | null, userHeight: number | null, userWeight: number | null) {
    // If missing inputs, return a default series with BMI=0 across a safe weight range
    if (bmi === null || userHeight === null || userWeight === null) {
      const defaults = [] as { weight: number; bmi: number; isCurrentPoint: boolean }[];
      for (let w = 40; w <= 120; w += 5) {
        defaults.push({ weight: w, bmi: 0, isCurrentPoint: false });
      }
      return defaults;
    }

    const data = [];
    const baseWeight = userWeight;
    const heightInM = userHeight / 100;

    // Generate points showing BMI progression with weight changes
    for (let weightOffset = -20; weightOffset <= 20; weightOffset += 2) {
      const newWeight = Math.max(40, baseWeight + weightOffset);
      const newBmi = newWeight / (heightInM * heightInM);

      data.push({
        weight: newWeight,
        bmi: parseFloat(newBmi.toFixed(1)),
        isCurrentPoint: Math.abs(weightOffset) < 1
      });
    }

    return data;
  }

  function getBmiCategory(bmi: number) {
    return bmiCategories.find(cat => bmi >= cat.min && bmi < cat.max) || bmiCategories[0];
  }

  function getXPosition(weight: number) {
    if (!chartData.length || maxWeight === minWeight) return 0;
    return ((weight - minWeight) / (maxWeight - minWeight)) * innerWidth;
  }

  function getYPosition(bmi: number) {
    const minBmi = yMin;
    const maxBmi = yMax;
    const clamped = Math.max(minBmi, Math.min(maxBmi, bmi));
    if (maxBmi === minBmi) return innerHeight; // avoid divide by zero
    return innerHeight - ((clamped - minBmi) / (maxBmi - minBmi)) * innerHeight;
  }

  $: projectedPoints = chartData.map((point) => {
    const x = margin.left + getXPosition(point.weight);
    const y = margin.top + getYPosition(point.bmi);
    return { ...point, x, y };
  });

  $: linePoints = projectedPoints.map((p) => `${p.x},${p.y}`).join(' ');

  $: areaPath =
    projectedPoints.length > 1
      ? `M ${projectedPoints[0].x},${margin.top + innerHeight} L ${projectedPoints
          .map((p) => `${p.x},${p.y}`)
          .join(' L ')} L ${projectedPoints[projectedPoints.length - 1].x},${margin.top + innerHeight} Z`
      : '';

  // Tooltip state (lightweight, throttled)
  let showTooltip = false;
  let tooltipX = 0;
  let tooltipY = 0;
  let tooltipText = '';
  let rafId: number | null = null;
  let pendingClientX = 0;
  let pendingClientY = 0;
  let pendingSvg: SVGSVGElement | null = null;
  let sizeRafId: number | null = null;

  function getSuggestion(label: string) {
    switch (label) {
      case 'Underweight': return 'Increase calorie-dense foods and consult a dietitian.';
      case 'Normal': return 'Maintain balanced diet and regular activity.';
      case 'Overweight': return 'Prioritize calorie control and consistent movement.';
      case 'Obese I':
      case 'Obese II':
      case 'Obese III': return 'Seek medical guidance and gradual lifestyle changes.';
      default: return 'Follow healthy routines and monitor progress.';
    }
  }

  function getComparisonText(bmi: number) {
    const targetMin = 18.5;
    const targetMax = 24.9;
    if (bmi < targetMin) return `Below target by ${(targetMin - bmi).toFixed(1)}`;
    if (bmi > targetMax) return `Above target by ${(bmi - targetMax).toFixed(1)}`;
    const mid = ((targetMin + targetMax) / 2).toFixed(1);
    return `Within target (mid ~${mid})`;
  }

  function handleMove(e: MouseEvent) {
    if (!chartData.length) return;
    pendingSvg = e.currentTarget as SVGSVGElement;
    pendingClientX = e.clientX;
    pendingClientY = e.clientY;

    if (rafId !== null) return;

    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (!pendingSvg) return;
      const svg = pendingSvg;
      const rect = svg.getBoundingClientRect();
      const x = pendingClientX - rect.left;
      const y = pendingClientY - rect.top;

      const sx = rect.width > 0 ? chartWidth / rect.width : 1;
      const xSvg = x * sx;

      // Find nearest point by X
      let nearest = projectedPoints[0];
      let nearestDist = Infinity;
      for (const p of projectedPoints) {
        const dist = Math.abs(p.x - xSvg);
        if (dist < nearestDist) { nearestDist = dist; nearest = p; }
      }
      const cat = getBmiCategory(nearest.bmi);
      const cmp = getComparisonText(nearest.bmi);
      tooltipText = `BMI ${nearest.bmi} • ${cat.label}\n${cmp}\n${getSuggestion(cat.label)}`;
      const maxX = Math.max(10, rect.width - 220);
      tooltipX = Math.min(maxX, Math.max(10, x + 12));
      tooltipY = Math.max(10, y + 12);
      showTooltip = true;
    });
  }

  function handleLeave() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    pendingSvg = null;
    showTooltip = false;
  }

  function updateSize() {
    if (!wrapperEl) return;
    const w = wrapperEl.clientWidth;
    // Denser vertical presentation: slightly lower aspect with tighter clamps
    const h = Math.max(260, Math.min(520, Math.round(w * 0.5)));
    chartWidth = Math.max(360, w);
    chartHeight = h;
  }

  function scheduleSizeUpdate() {
    if (sizeRafId !== null) return;
    sizeRafId = requestAnimationFrame(() => {
      sizeRafId = null;
      updateSize();
    });
  }

  onMount(() => {
    // Observe container size for responsive chart
    scheduleSizeUpdate();
    const ro = new ResizeObserver(() => scheduleSizeUpdate());
    if (wrapperEl) ro.observe(wrapperEl);

    return () => {
      ro.disconnect();
    };
  });

  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (sizeRafId) cancelAnimationFrame(sizeRafId);
    sizeRafId = null;
  });

  // Chart always visible by design
 </script>
  <div class="chart-container">
    <div class="chart-header">
      <div class="chart-title">
      <TrendingUp class="w-6 h-6 text-cosmic-blue" />
      <h3>BMI Analysis & Trends</h3>
    </div>
      <div class="chart-subtitle">
        Interactive visualization of your BMI and health metrics
      </div>
    </div>

    <div class="chart-wrapper" bind:this={wrapperEl}>
      <!-- Always show chart, remove visibility blocking -->
      <svg
          class="dynamic-chart"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="xMidYMid meet"
          width="100%"
          height="100%"
          role="img"
          aria-label="BMI trend chart"
          on:mousemove={handleMove}
          on:mouseleave={handleLeave}
        >
        <defs>
          <!-- Gentle gradients for BMI zones -->
          <linearGradient id="zoneUnder" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#60a5fa" stop-opacity="0.08"/>
          </linearGradient>
          <linearGradient id="zoneNormal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#10b981" stop-opacity="0.08"/>
          </linearGradient>
          <linearGradient id="zoneOver" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.08"/>
          </linearGradient>
          <linearGradient id="zoneOb1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ef4444" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#ef4444" stop-opacity="0.08"/>
          </linearGradient>
          <linearGradient id="zoneOb2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#dc2626" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#dc2626" stop-opacity="0.08"/>
          </linearGradient>
          <linearGradient id="zoneOb3" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#991b1b" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#991b1b" stop-opacity="0.08"/>
          </linearGradient>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#60a5fa;stop-opacity:0.15" />
            <stop offset="50%" style="stop-color:#3b82f6;stop-opacity:0.1" />
            <stop offset="100%" style="stop-color:#1e40af;stop-opacity:0.05" />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#60a5fa;stop-opacity:0.8" />
            <stop offset="50%" style="stop-color:#3b82f6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:0.9" />
          </linearGradient>
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="neonGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <!-- Background BMI zones -->
        {#each bmiCategories as category, idx (category.label)}
          <rect
            x={margin.left}
            y={margin.top + getYPosition(category.max)}
            width={innerWidth}
            height={getYPosition(category.min) - getYPosition(category.max)}
            fill={idx === 0 ? 'url(#zoneUnder)'
              : idx === 1 ? 'url(#zoneNormal)'
              : idx === 2 ? 'url(#zoneOver)'
              : idx === 3 ? 'url(#zoneOb1)'
              : idx === 4 ? 'url(#zoneOb2)'
              : 'url(#zoneOb3)'}
            opacity="0.6"
          />
          <text
            x={margin.left + innerWidth - 10}
            y={margin.top + getYPosition(category.min) - 5}
            text-anchor="end"
            fill={category.color}
            font-size="12"
            font-weight="600"
            paint-order="stroke fill"
            stroke="#0b1220"
            stroke-width="0.6"
          >
            {category.label}
          </text>
        {/each}

        <!-- Chart line -->
        {#if projectedPoints.length > 1}
          <polyline
            points={linePoints}
            fill="none"
            stroke="url(#lineGradient)"
            stroke-width="3"
            filter="url(#softGlow)"
            class="bmi-line"
          />

          <!-- Fill area under curve -->
          <path
            d={areaPath}
            fill="url(#chartGradient)"
            opacity="0.2"
          />
        {/if}

        <!-- Data points -->
        {#each projectedPoints as point (point.weight + '-' + point.bmi)}
          <circle
            cx={point.x}
            cy={point.y}
            r={point.isCurrentPoint ? 6 : 3}
            fill={point.isCurrentPoint ? getBmiCategory(point.bmi).color : '#64748b'}
            stroke={point.isCurrentPoint ? '#ffffff' : 'none'}
            stroke-width={point.isCurrentPoint ? 2 : 0}
            class={point.isCurrentPoint ? 'current-point' : 'data-point'}
            filter={point.isCurrentPoint ? 'url(#neonGlow)' : 'none'}
          />
          {#if point.isCurrentPoint}
            <text
              x={point.x}
              y={point.y - 12}
              text-anchor="middle"
              fill="#ffffff"
              font-size="14"
              font-weight="800"
              paint-order="stroke fill"
              stroke="#0b1220"
              stroke-width="0.8"
            >
              {point.bmi}
            </text>
          {/if}
        {/each}

        <!-- Axes -->
        <line
          x1={margin.left}
          y1={margin.top + innerHeight}
          x2={margin.left + innerWidth}
          y2={margin.top + innerHeight}
          stroke="#64748b"
          stroke-width="2"
        />
        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={margin.top + innerHeight}
          stroke="#64748b"
          stroke-width="2"
        />

        <!-- Grid lines -->
        {#each Array(GRID_HORIZONTAL) as _unused, i (i)}
          <line
            x1={margin.left}
            y1={margin.top + (innerHeight / (GRID_HORIZONTAL + 1)) * (i + 1)}
            x2={margin.left + innerWidth}
            y2={margin.top + (innerHeight / (GRID_HORIZONTAL + 1)) * (i + 1)}
            stroke="#1e293b"
            stroke-width="1"
            opacity="0.4"
          />
        {/each}

        {#each Array(GRID_VERTICAL) as _unused, i (i)}
          <line
            x1={margin.left + (innerWidth / (GRID_VERTICAL + 1)) * (i + 1)}
            y1={margin.top}
            x2={margin.left + (innerWidth / (GRID_VERTICAL + 1)) * (i + 1)}
            y2={margin.top + innerHeight}
            stroke="#1e293b"
            stroke-width="1"
            opacity="0.4"
          />
        {/each}

      </svg>

      <div class="axis-label axis-x">Weight (kg)</div>
      <div class="axis-label axis-y">BMI</div>

      {#if !hasData}
        <div class="chart-loading">
          <div class="chart-loading-inner">Waiting for BMI calculation...</div>
        </div>
      {/if}

      {#if showTooltip}
        <div class="chart-tooltip" style={`left:${tooltipX}px; top:${tooltipY}px`}>
          <pre>{tooltipText}</pre>
        </div>
      {/if}
    </div>

    <div class="chart-insights">
      <div class="insight-card">
        <Activity class="w-6 h-6 text-green-400" />
        <div>
          <div class="insight-title">Current Status</div>
          <div class="insight-value">{category}</div>
        </div>
      </div>

      <div class="insight-card">
        <Target class="w-6 h-6 text-blue-400" />
        <div>
          <div class="insight-title">Target Range</div>
          <div class="insight-value">18.5 - 24.9</div>
        </div>
      </div>

      <div class="insight-card">
        <TrendingUp class="w-6 h-6 text-purple-400" />
        <div>
          <div class="insight-title">Health Score</div>
          <div class="insight-value">
            {#if (bmiValue ?? 0) >= 18.5 && (bmiValue ?? 0) < 25}
              Excellent
            {:else if (bmiValue ?? 0) >= 25 && (bmiValue ?? 0) < 30}
              Good
            {:else}
              Needs Attention
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>

<style>
  .chart-loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.75rem;
    background: rgba(2, 6, 23, 0.35);
  }

  .chart-loading-inner {
    color: #9ca3af;
    font-size: 0.95rem;
    font-weight: 600;
    text-align: center;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    background: rgba(15, 23, 42, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px) saturate(150%);
    -webkit-backdrop-filter: blur(10px) saturate(150%);
  }
</style>
