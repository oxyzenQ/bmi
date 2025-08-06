<script lang="ts">
  export let bmiValue: number;
  export let category: string;
  export let categoryClass: string;

  let chartContainer: HTMLElement;
  let chartWidth = 300;
  let chartHeight = 200;

  // BMI ranges for visualization
  const bmiRanges = [
    { min: 0, max: 18.5, label: 'Underweight', color: '#60a5fa', class: 'text-blue-400' },
    { min: 18.5, max: 24.9, label: 'Healthy', color: '#4ade80', class: 'text-green-400' },
    { min: 25, max: 29.9, label: 'Overweight', color: '#fbbf24', class: 'text-yellow-400' },
    { min: 30, max: 50, label: 'Obesity', color: '#f87171', class: 'text-red-400' }
  ];

  function getBmiPosition(value: number): number {
    const maxBmi = 50;
    return Math.min((value / maxBmi) * chartWidth, chartWidth);
  }

  function getCategoryColor(value: number): string {
    const range = bmiRanges.find(r => value >= r.min && value <= r.max);
    return range ? range.color : '#60a5fa';
  }

  $: bmiPosition = getBmiPosition(bmiValue);
  $: bmiColor = getCategoryColor(bmiValue);
</script>

<div class="bmi-chart-container" bind:this={chartContainer}>
  <h3 class="text-xl font-semibold text-white mb-4 text-center">BMI Visualization</h3>
  
  <div class="chart-wrapper">
    <svg width={chartWidth} height={chartHeight} class="bmi-chart">
      <!-- Background ranges -->
      {#each bmiRanges as range (range.label)}
        <rect
          x={getBmiPosition(range.min)}
          y="20"
          width={getBmiPosition(range.max) - getBmiPosition(range.min)}
          height="40"
          fill={range.color}
          opacity="0.3"
          rx="4"
        />
        <text
          x={getBmiPosition(range.min) + (getBmiPosition(range.max) - getBmiPosition(range.min)) / 2}
          y="45"
          text-anchor="middle"
          fill="white"
          font-size="10"
          font-weight="500"
        >
          {range.label}
        </text>
      {/each}
      
      <!-- BMI value indicator -->
      <circle
        cx={bmiPosition}
        cy="40"
        r="8"
        fill={bmiColor}
        stroke="white"
        stroke-width="2"
        class="bmi-indicator"
      />
      
      <!-- BMI value label -->
      <text
        x={bmiPosition}
        y="65"
        text-anchor="middle"
        fill="white"
        font-size="12"
        font-weight="bold"
      >
        {bmiValue}
      </text>
      
      <!-- Scale markers -->
      {#each [0, 10, 20, 30, 40, 50] as marker (marker)}
        <line
          x1={getBmiPosition(marker)}
          y1="70"
          x2={getBmiPosition(marker)}
          y2="75"
          stroke="white"
          stroke-width="1"
          opacity="0.6"
        />
        <text
          x={getBmiPosition(marker)}
          y="90"
          text-anchor="middle"
          fill="white"
          font-size="10"
          opacity="0.8"
        >
          {marker}
        </text>
      {/each}
      
      <!-- Scale line -->
      <line
        x1="0"
        y1="70"
        x2={chartWidth}
        y2="70"
        stroke="white"
        stroke-width="2"
        opacity="0.8"
      />
    </svg>
  </div>
  
  <!-- Category info -->
  <div class="category-info mt-4 text-center">
    <div class="text-lg font-medium {categoryClass} mb-2">
      {category}
    </div>
    <div class="text-sm text-gray-300">
      Your BMI of <span class="font-bold {categoryClass}">{bmiValue}</span> falls in the {category.toLowerCase()} range
    </div>
  </div>
  
  <!-- Health tips -->
  <div class="health-tips mt-6 p-4 bg-gray-800 rounded-lg border border-gray-600">
    <h4 class="text-white font-semibold mb-2">Health Tips:</h4>
    {#if bmiValue < 18.5}
      <p class="text-gray-300 text-sm">Consider consulting a healthcare provider about healthy weight gain strategies.</p>
    {:else if bmiValue >= 18.5 && bmiValue < 25}
      <p class="text-gray-300 text-sm">Great! You're in a healthy BMI range. Maintain your current lifestyle.</p>
    {:else if bmiValue >= 25 && bmiValue < 30}
      <p class="text-gray-300 text-sm">Consider lifestyle changes like diet and exercise to reach a healthier weight.</p>
    {:else}
      <p class="text-gray-300 text-sm">Consult with a healthcare provider about weight management strategies.</p>
    {/if}
  </div>
</div>

<style>
  .bmi-chart-container {
    max-width: 400px;
    margin: 0 auto;
  }
  
  .chart-wrapper {
    display: flex;
    justify-content: center;
    margin: 20px 0;
  }
  
  .bmi-chart {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    padding: 10px;
  }
  
  .bmi-indicator {
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.1);
    }
  }
  
  .category-info {
    margin-top: 1rem;
  }
  
  .health-tips {
    margin-top: 1.5rem;
    padding: 1rem;
    background: rgba(31, 41, 55, 0.8);
    border-radius: 0.5rem;
    border: 1px solid rgba(75, 85, 99, 0.6);
  }
  
  .text-lg {
    font-size: 1.125rem;
    line-height: 1.75rem;
  }
  
  .text-sm {
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
  
  .font-semibold {
    font-weight: 600;
  }
  
  .font-medium {
    font-weight: 500;
  }
  
  .font-bold {
    font-weight: 700;
  }
  
  .text-center {
    text-align: center;
  }
  
  .text-white {
    color: #ffffff;
  }
  
  .text-gray-300 {
    color: #d1d5db;
  }
  
  .mt-4 {
    margin-top: 1rem;
  }
  
  .mt-6 {
    margin-top: 1.5rem;
  }
  
  .mb-2 {
    margin-bottom: 0.5rem;
  }
  
  .p-4 {
    padding: 1rem;
  }
  
  .rounded-lg {
    border-radius: 0.5rem;
  }
  
  .bg-gray-800 {
    background-color: rgba(31, 41, 55, 0.8);
  }
  
  .border {
    border-width: 1px;
  }
  
  .border-gray-600 {
    border-color: rgba(75, 85, 99, 0.6);
  }
</style>
