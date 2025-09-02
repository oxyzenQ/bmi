<script lang="ts">
  import { onMount } from 'svelte';
  import { TrendingUp, Activity, Target } from 'lucide-svelte';

  export let age: number = 0;
  export let height: number = 0;
  export let weight: number = 0;
  export let showChart: boolean = false;

  let wrapperEl: HTMLDivElement;
  let chartWidth = 640;
  let chartHeight = 320;
  const margin = { top: 20, right: 40, bottom: 40, left: 60 };

  // BMI categories with colors matching the theme
  const bmiCategories = [
    { min: 0, max: 18.5, label: 'Underweight', color: '#60a5fa', fill: 'rgba(96, 165, 250, 0.15)' },
    { min: 18.5, max: 24.9, label: 'Normal', color: '#10b981', fill: 'rgba(16, 185, 129, 0.15)' },
    { min: 25, max: 29.9, label: 'Overweight', color: '#f59e0b', fill: 'rgba(245, 158, 11, 0.15)' },
    { min: 30, max: 34.9, label: 'Obese I', color: '#ef4444', fill: 'rgba(239, 68, 68, 0.15)' },
    { min: 35, max: 39.9, label: 'Obese II', color: '#dc2626', fill: 'rgba(220, 38, 38, 0.15)' },
    { min: 40, max: 50, label: 'Obese III', color: '#991b1b', fill: 'rgba(153, 27, 27, 0.15)' }
  ];

  // Reactive calculations - only when data is valid
  $: hasValidData = age > 0 && height > 0 && weight > 0 && showChart;
  $: heightInM = hasValidData ? height / 100 : 1;
  $: currentBMI = hasValidData ? weight / (heightInM * heightInM) : 0;
  $: currentCategory = getBmiCategory(currentBMI);
  $: chartData = hasValidData ? generateChartData(height, weight) : [];
  $: innerWidth = chartWidth - margin.left - margin.right;
  $: innerHeight = chartHeight - margin.top - margin.bottom;

  // Dynamic Y domain based on data with better precision
  $: yMin = chartData.length > 0 ? Math.max(0, Math.min(...chartData.map(d => d.bmi)) - 2) : 0;
  $: yMax = chartData.length > 0 ? Math.min(50, Math.max(...chartData.map(d => d.bmi)) + 2) : 30;

  function getBmiCategory(bmi: number) {
    return bmiCategories.find(cat => bmi >= cat.min && bmi < cat.max) || bmiCategories[0];
  }

  function generateChartData(userHeight: number, userWeight: number) {
    if (!userHeight || !userWeight) return [];
    
    const heightM = userHeight / 100;
    const data = [];
    
    // Generate BMI curve for weight range around current weight
    const weightRange = Math.max(25, userWeight * 0.5);
    const minWeight = Math.max(40, userWeight - weightRange);
    const maxWeight = userWeight + weightRange;
    
    for (let w = minWeight; w <= maxWeight; w += 1.5) {
      const bmi = w / (heightM * heightM);
      data.push({
        weight: w,
        bmi: parseFloat(bmi.toFixed(2)),
        isCurrent: Math.abs(w - userWeight) < 0.5
      });
    }
    
    return data;
  }

  function getXPosition(weight: number) {
    const minWeight = Math.min(...chartData.map(d => d.weight));
    const maxWeight = Math.max(...chartData.map(d => d.weight));
    return ((weight - minWeight) / (maxWeight - minWeight)) * innerWidth;
  }

  function getYPosition(bmi: number) {
    if (!hasValidData || yMax === yMin) return innerHeight / 2;
    const clampedBmi = Math.max(yMin, Math.min(yMax, bmi));
    return innerHeight - ((clampedBmi - yMin) / (yMax - yMin)) * innerHeight;
  }

  function updateSize() {
    if (!wrapperEl) return;
    const containerWidth = wrapperEl.clientWidth;
    chartWidth = Math.max(320, containerWidth);
    chartHeight = Math.max(280, Math.min(400, containerWidth * 0.5));
  }

  onMount(() => {
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (wrapperEl) ro.observe(wrapperEl);
    return () => ro.disconnect();
  });
</script>

<div class="chart-container">
  <div class="chart-header">
    <div class="chart-title">
      <TrendingUp class="w-6 h-6 text-blue-400" />
      <h3>Real-time BMI Analysis</h3>
    </div>
    <div class="chart-subtitle">
      Interactive visualization updating as you type
    </div>
  </div>

  <div class="chart-wrapper" bind:this={wrapperEl}>
    <svg 
      class="bmi-chart"
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
    >
      <defs>
        <!-- BMI zone gradients -->
        {#each bmiCategories as category, i (category.label)}
          <linearGradient id="zone{i}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color={category.color} stop-opacity="0.2"/>
            <stop offset="100%" stop-color={category.color} stop-opacity="0.05"/>
          </linearGradient>
        {/each}
        
        <!-- Chart line gradient -->
        <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#60a5fa"/>
          <stop offset="50%" stop-color="#a78bfa"/>
          <stop offset="100%" stop-color="#f472b6"/>
        </linearGradient>
        
        <!-- Glow filter -->
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/> 
          </feMerge>
        </filter>
      </defs>

      <!-- BMI category background zones -->
      {#each bmiCategories as category, i (category.label)}
        <rect
          x={margin.left}
          y={margin.top + getYPosition(category.max)}
          width={innerWidth}
          height={getYPosition(category.min) - getYPosition(category.max)}
          fill="url(#zone{i})"
          opacity="0.6"
        />
        <text
          x={margin.left - 10}
          y={margin.top + getYPosition((category.min + category.max) / 2) + 5}
          text-anchor="end"
          class="category-label"
          fill={category.color}
        >
          {category.label}
        </text>
      {/each}

      {#if hasValidData && chartData.length > 0}
        <!-- Chart line -->
        <polyline 
          points={chartData.map(d => `${margin.left + getXPosition(d.weight)},${margin.top + getYPosition(d.bmi)}`).join(' ')} 
          fill="none" 
          stroke="url(#lineGradient)" 
          stroke-width="3"
          filter="url(#glow)"
          class="chart-line"
        />

        <!-- Data points - only show current BMI point -->
        {#each chartData.filter(d => d.isCurrent) as point (point.weight)}
          <circle
            cx={margin.left + getXPosition(point.weight)}
            cy={margin.top + getYPosition(point.bmi)}
            r="6"
            fill="#ffffff"
            stroke={currentCategory.color}
            stroke-width="3"
            filter="url(#glow)"
            class="current-bmi-point"
          />
          <text
            x={margin.left + getXPosition(point.weight)}
            y={margin.top + getYPosition(point.bmi) - 15}
            text-anchor="middle"
            class="bmi-value-label"
            fill="#ffffff"
          >
            {currentBMI.toFixed(1)}
          </text>
        {/each}
      {:else}
        <!-- Empty state -->
        <text
          x={margin.left + innerWidth/2}
          y={margin.top + innerHeight/2}
          text-anchor="middle"
          class="empty-state-text"
          fill="#64748b"
        >
          Enter your data and click "Calc BMI" to see your chart
        </text>
      {/if}

      <!-- Axes -->
      <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + innerHeight} stroke="#475569" stroke-width="1"/>
      <line x1={margin.left} y1={margin.top + innerHeight} x2={margin.left + innerWidth} y2={margin.top + innerHeight} stroke="#475569" stroke-width="1"/>
      
      <!-- Axis labels -->
      <text x={margin.left + innerWidth/2} y={chartHeight - 10} text-anchor="middle" class="axis-label">Weight (kg)</text>
      <text x={20} y={margin.top + innerHeight/2} text-anchor="middle" transform="rotate(-90, 20, {margin.top + innerHeight/2})" class="axis-label">BMI</text>
    </svg>
  </div>

  <!-- Current stats -->
  <div class="chart-stats">
    <div class="stat-card">
        <Activity class="w-6 h-6" />
      <div>
        <div class="stat-label">Current BMI</div>
        <div class="stat-value">{currentBMI.toFixed(1)}</div>
      </div>
    </div>
    
    <div class="stat-card">
        <Target class="w-6 h-6" />
      <div>
        <div class="stat-label">Category</div>
        <div class="stat-value" style="color: {currentCategory.color}">{currentCategory.label}</div>
      </div>
    </div>
    
    <div class="stat-card">
        <TrendingUp class="w-6 h-6" />
      <div>
        <div class="stat-label">Target Range</div>
        <div class="stat-value">18.5 - 24.9</div>
      </div>
    </div>
  </div>
</div>
 
