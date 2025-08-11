<script lang="ts">
  import { onMount } from 'svelte';
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
  const margin = { top: 40, right: 40, bottom: 60, left: 60 };
  $: innerWidth = chartWidth - margin.left - margin.right;
  $: innerHeight = chartHeight - margin.top - margin.bottom;

  // Generate sample data points for trend visualization
  $: chartData = generateChartData(bmiValue, age, height, weight);
  $: hasData = Boolean(bmiValue && age && height && weight && chartData.length);

  function generateChartData(bmi: number | null, userAge: number | null, userHeight: number | null, userWeight: number | null) {
    // If missing inputs, return a default series with BMI=0 across a safe weight range
    if (!bmi || !userAge || !userHeight || !userWeight) {
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
    if (!chartData.length) return 0;
    const minWeight = Math.min(...chartData.map(d => d.weight));
    const maxWeight = Math.max(...chartData.map(d => d.weight));
    return ((weight - minWeight) / (maxWeight - minWeight)) * innerWidth;
  }

  function getYPosition(bmi: number) {
    // When we don't have data, allow 0 baseline so the default series sits at bottom
    const minBmi = hasData ? 15 : 0;
    const maxBmi = 45;
    const clamped = Math.max(minBmi, Math.min(maxBmi, bmi));
    return innerHeight - ((clamped - minBmi) / (maxBmi - minBmi)) * innerHeight;
  }

  function updateSize() {
    if (!wrapperEl) return;
    const w = wrapperEl.clientWidth;
    // Maintain a comfortable aspect ratio while filling available space
    const h = Math.max(320, Math.min(640, Math.round(w * 0.6)));
    chartWidth = Math.max(360, w);
    chartHeight = h;
  }

  onMount(() => {
    // Observe container size for responsive chart
    updateSize();
    const ro = new ResizeObserver(() => updateSize());
    if (wrapperEl) ro.observe(wrapperEl);

    return () => {
      ro.disconnect();
    };
  });

  // Chart always visible by design
 </script>
  <div class="chart-container rounded-xl p-6 shadow-2xl border border-slate-800">
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
      <svg 
        class="dynamic-chart"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
      >
        <defs>
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
        {#each bmiCategories as category (category.label)}
          <rect
            x={margin.left}
            y={margin.top + getYPosition(category.max)}
            width={innerWidth}
            height={getYPosition(category.min) - getYPosition(category.max)}
            fill={category.bgColor}
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
        {#if chartData.length > 1}
          <polyline 
            points={chartData.map(d => `${margin.left + getXPosition(d.weight)},${margin.top + getYPosition(d.bmi)}`).join(' ')} 
            fill="none" 
            stroke="url(#lineGradient)" 
            stroke-width="3" 
            filter="url(#softGlow)"
            class="bmi-line"
          />
          
          <!-- Fill area under curve -->
          <path
            d="M {margin.left + getXPosition(chartData[0].weight)},${margin.top + innerHeight} L {chartData.map(d => `${margin.left + getXPosition(d.weight)},${margin.top + getYPosition(d.bmi)}`).join(' L ')} L ${margin.left + getXPosition(chartData[chartData.length - 1].weight)},${margin.top + innerHeight} Z"
            fill="url(#chartGradient)"
            opacity="0.2"
          />
        {/if}

        <!-- Data points -->
        {#each chartData as point (point.weight + '-' + point.bmi)}
          <circle
            cx={margin.left + getXPosition(point.weight)}
            cy={margin.top + getYPosition(point.bmi)}
            r={point.isCurrentPoint ? 6 : 3}
            fill={point.isCurrentPoint ? getBmiCategory(point.bmi).color : '#64748b'}
            stroke={point.isCurrentPoint ? '#ffffff' : 'none'}
            stroke-width={point.isCurrentPoint ? 2 : 0}
            class={point.isCurrentPoint ? 'current-point' : 'data-point'}
            filter={point.isCurrentPoint ? 'url(#neonGlow)' : 'none'}
          />
          {#if point.isCurrentPoint}
            <text
              x={margin.left + getXPosition(point.weight)}
              y={margin.top + getYPosition(point.bmi) - 12}
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
        {#each Array(5) as _unused, i (i)}
          <line 
            x1="60" 
            y1={60 + i * 60} 
            x2="540" 
            y2={60 + i * 60} 
            stroke="#1e293b" 
            stroke-width="1" 
            opacity="0.4"
          />
        {/each}
        
        {#each Array(9) as _unused, i (i)}
          <line 
            x1={60 + i * 60} 
            y1="60" 
            x2={60 + i * 60} 
            y2="300" 
            stroke="#1e293b" 
            stroke-width="1" 
            opacity="0.4"
          />
        {/each}

        <!-- Axis labels -->
        <div class="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-sm text-slate-300 font-medium">
          Weight (kg)
        </div>
        <div class="absolute left-2 top-1/2 transform -translate-y-1/2 -rotate-90 text-sm text-slate-300 font-medium">
          BMI
        </div>
      </svg>
    </div>

    <div class="chart-insights">
      <div class="insight-card">
        <Activity class="w-5 h-5 text-green-400" />
        <div>
          <div class="insight-title">Current Status</div>
          <div class="insight-value">{category}</div>
        </div>
      </div>
      
      <div class="insight-card">
        <Target class="w-5 h-5 text-blue-400" />
        <div>
          <div class="insight-title">Target Range</div>
          <div class="insight-value">18.5 - 24.9</div>
        </div>
      </div>
      
      <div class="insight-card">
        <TrendingUp class="w-5 h-5 text-purple-400" />
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
  .chart-container {
    background: radial-gradient(1200px 600px at 20% 0%, rgba(37, 99, 235, 0.18), transparent 50%),
                radial-gradient(1000px 700px at 80% 100%, rgba(99, 102, 241, 0.18), transparent 52%),
                linear-gradient(180deg, #030712 0%, #0a0f1e 50%, #0b1220 100%);
    border: 1px solid #334155;
    border-radius: 1.5rem;
    padding: 2rem;
    margin-top: 2rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
    animation: slideUp var(--dur-slow) var(--easing-smooth);
    will-change: transform, opacity;
    transform: translateZ(0);
    contain: layout style paint;
  }

  .chart-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .chart-title {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    font-size: 1.5rem;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 0.5rem;
    background: linear-gradient(135deg, #60a5fa, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .chart-subtitle {
    color: #9ca3af;
    font-size: 0.95rem;
  }

  .chart-wrapper {
    position: relative;
    width: 100%;
    height: clamp(320px, 56vw, 600px);
    margin: 2rem 0;
    will-change: width, height;
    contain: layout style paint;
  }

  .dynamic-chart {
    background: radial-gradient(800px 400px at 30% 0%, rgba(37,99,235,0.12), transparent 55%),
                radial-gradient(700px 500px at 90% 90%, rgba(168,85,247,0.12), transparent 60%),
                #020617;
    border-radius: 1rem;
    padding: 1rem;
    will-change: transform;
    transform: translateZ(0);
    contain: layout style;
  }

  /* Ensure minimum readable size and numeric mono for all SVG text */
  :global(.dynamic-chart text) {
    font-size: 14px;
  }



  .current-point {
    animation: pulse 2s infinite;
  }

  .data-point {
    transition: all 0.3s ease;
  }

  .data-point:hover {
    r: 5;
    opacity: 0.8;
  }

  .chart-insights {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-top: 2rem;
  }

  .insight-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 0.75rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform, background-color;
    transform: translateZ(0);
  }

  .insight-card:hover {
    background: #1e293b;
    transform: translateY(-2px) translateZ(0);
    box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.2);
  }

  .insight-title {
    font-size: 0.8rem;
    color: #9ca3af;
    font-weight: 500;
  }

  .insight-value {
    font-size: 0.95rem;
    color: #ffffff;
    font-weight: 600;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(30px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes drawLine {
    from {
      stroke-dasharray: 1000;
      stroke-dashoffset: 1000;
    }
    to {
      stroke-dasharray: 1000;
      stroke-dashoffset: 0;
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.2);
    }
  }

  @media (max-width: 768px) {
    .chart-container {
      padding: 1.5rem;
    }

    .chart-title {
      font-size: 1.25rem;
    }

    .chart-insights {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chart-container,
    .current-point {
      animation: none;
    }
    
    .insight-card:hover {
      transform: none;
    }
  }
</style>
