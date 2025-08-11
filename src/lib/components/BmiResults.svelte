<script lang="ts">
  import { BarChart3, TrendingUp, Info, AlertCircle, CheckCircle, Activity } from 'lucide-svelte';

  export let bmiValue: number | null = null;
  export let category: string | null = null;
  export let age: number | null = null;

  $: hasResults = bmiValue !== null && category !== null;

  function getCategoryColor(category: string): string {
    switch (category.toLowerCase()) {
      case 'underweight': return '#60a5fa';
      case 'normal weight': return '#10b981';
      case 'overweight': return '#f59e0b';
      case 'obese': return '#ef4444';
      default: return '#6b7280';
    }
  }

  function getCategoryIcon(category: string) {
    switch (category.toLowerCase()) {
      case 'underweight': return AlertCircle;
      case 'normal weight': return CheckCircle;
      case 'overweight': return TrendingUp;
      case 'obese': return Activity;
      default: return BarChart3;
    }
  }

  function getHealthAdvice(category: string): string {
    switch (category.toLowerCase()) {
      case 'underweight':
        return 'Consider consulting a healthcare provider about healthy weight gain strategies.';
      case 'normal weight':
        return 'Great! Maintain your healthy lifestyle with balanced nutrition and regular exercise.';
      case 'overweight':
        return 'Focus on gradual weight loss through diet and exercise. Consult a healthcare provider.';
      case 'obese':
        return 'Seek professional medical advice for a comprehensive weight management plan.';
      default:
        return 'Please enter valid measurements to get personalized health advice.';
    }
  }

  function getAgeAdvisory(age: number): string {
    if (age < 18) {
      return 'For users under 18, BMI interpretation differs; consult a healthcare professional for age-appropriate guidance.';
    } else if (age >= 65) {
      return 'For older adults (65+), consider muscle mass and consult a healthcare professional for personalized advice.';
    } else {
      return 'This BMI assessment is for adults aged 18-64. For personalized health guidance, consult a healthcare professional.';
    }
  }
</script>

<div class="bmi-results-card liquid-glass">
  <div class="card-header">
    <div class="icon-container">
      <BarChart3 class="w-12 h-12 text-cosmic-blue" />
      <div class="icon-glow"></div>
    </div>
    <h2 class="card-title">Your Results</h2>
    <p class="card-subtitle">Cosmic BMI analysis and personalized recommendations.</p>
  </div>

  <div class="results-content" role="status" aria-live="polite">
    {#if hasResults}
      <div class="bmi-display">
        <div class="bmi-value" style="color: {getCategoryColor(category!)}">
          {bmiValue!.toFixed(1)}
        </div>
        <div class="bmi-category-container">
          <svelte:component this={getCategoryIcon(category!)} class="category-icon" style="color: {getCategoryColor(category!)}" />
          <span class="bmi-category" style="color: {getCategoryColor(category!)}">
            {category}
          </span>
        </div>
      </div>

      <div class="health-advice">
        <h3 class="advice-title">
          <Info class="w-5 h-5" />
          Health Advice
        </h3>
        <p class="advice-text">{getHealthAdvice(category!)}</p>
      </div>

      {#if age}
        <div class="age-advisory">
          <h4 class="advisory-title">
            <AlertCircle class="w-4 h-4" />
            Age-Specific Note
          </h4>
          <p class="advisory-text">{getAgeAdvisory(age)}</p>
        </div>
      {/if}

      <div class="bmi-explanation">
        <h4 class="explanation-title">What this means:</h4>
        <p class="explanation-text">
          Your BMI of <strong>{bmiValue!.toFixed(1)}</strong> falls in the <strong>{category}</strong> category. 
          BMI is a screening tool that helps assess weight-related health risks.
        </p>
      </div>
    {:else}
      <div class="empty-state">
        <div class="empty-icon">
          <BarChart3 class="w-16 h-16 text-gray-400 opacity-50" />
          <div class="empty-glow"></div>
        </div>
        <p class="empty-text">Enter your measurements to see your cosmic BMI results</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .bmi-results-card {
    padding: 2.5rem;
    border-radius: 1.5rem;
    position: relative;
    overflow: hidden;
    min-height: 450px;
    display: flex;
    flex-direction: column;
    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .bmi-results-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, 
      rgba(96, 165, 250, 0.05), 
      rgba(168, 85, 247, 0.05)
    );
    border-radius: inherit;
    z-index: -1;
  }

  .card-header {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .icon-container {
    position: relative;
    display: inline-block;
    margin-bottom: 1rem;
  }

  .icon-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60px;
    height: 60px;
    background: radial-gradient(circle, rgba(96, 165, 250, 0.2), transparent);
    border-radius: 50%;
    filter: blur(15px);
    animation: iconGlow 3s ease-in-out infinite alternate;
  }

  @keyframes iconGlow {
    0% {
      opacity: 0.3;
      transform: translate(-50%, -50%) scale(1);
    }
    100% {
      opacity: 0.6;
      transform: translate(-50%, -50%) scale(1.1);
    }
  }

  .card-title {
    font-size: 1.75rem;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 0.75rem;
    background: linear-gradient(135deg, #60a5fa, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .card-subtitle {
    color: #9ca3af;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .results-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    animation: fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .bmi-display {
    text-align: center;
    margin-bottom: 2.5rem;
    animation: scaleIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.2s both;
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .bmi-value {
    font-size: 4.5rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 1rem;
    text-shadow: 0 0 20px currentColor;
    animation: valueGlow 2s ease-in-out infinite alternate;
  }

  @keyframes valueGlow {
    0% {
      text-shadow: 0 0 20px currentColor;
    }
    100% {
      text-shadow: 0 0 30px currentColor, 0 0 40px currentColor;
    }
  }

  .bmi-category-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }

  :global(.category-icon) {
    width: 1.5rem;
    height: 1.5rem;
  }

  .bmi-category {
    font-size: 1.5rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .health-advice {
    background: rgba(15, 23, 42, 0.4);
    border-radius: 1rem;
    padding: 1.75rem;
    margin-bottom: 1.75rem;
    border: 1px solid rgba(255, 255, 255, 0.05);
    animation: slideInLeft 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.4s both;
    transition: all 0.3s ease;
  }

  .health-advice:hover {
    background: rgba(15, 23, 42, 0.6);
    border-color: rgba(255, 255, 255, 0.1);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  }

  @keyframes slideInLeft {
    from {
      opacity: 0;
      transform: translateX(-30px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .advice-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .advice-text {
    color: #d1d5db;
    line-height: 1.6;
  }

  .age-advisory {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 1rem;
    padding: 1.75rem;
    margin-bottom: 1.75rem;
    animation: slideInRight 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.6s both;
    transition: all 0.3s ease;
  }

  .age-advisory:hover {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.1);
  }

  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(30px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .advisory-title {
    font-size: 1rem;
    font-weight: 600;
    color: #60a5fa;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .advisory-text {
    color: #d1d5db;
    line-height: 1.6;
    font-size: 0.875rem;
  }

  .bmi-explanation {
    background: rgba(15, 23, 42, 0.4);
    border-radius: 1rem;
    padding: 1.75rem;
    border: 1px solid rgba(255, 255, 255, 0.05);
    animation: fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.8s both;
    transition: all 0.3s ease;
  }

  .bmi-explanation:hover {
    background: rgba(15, 23, 42, 0.6);
    border-color: rgba(255, 255, 255, 0.1);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  }

  .explanation-title {
    font-size: 1rem;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 1rem;
  }

  .explanation-text {
    color: #d1d5db;
    line-height: 1.6;
    font-size: 0.875rem;
  }

  .empty-state {
    text-align: center;
    color: #9ca3af;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .empty-icon {
    position: relative;
    margin-bottom: 1.5rem;
  }

  .empty-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 80px;
    height: 80px;
    background: radial-gradient(circle, rgba(156, 163, 175, 0.1), transparent);
    border-radius: 50%;
    filter: blur(20px);
  }

  .empty-text {
    font-size: 1rem;
    max-width: 250px;
    line-height: 1.5;
  }

  @media (max-width: 768px) {
    .bmi-results-card {
      padding: 2rem 1.5rem;
      border-radius: 1.25rem;
      min-height: 400px;
    }

    .card-title {
      font-size: 1.5rem;
    }

    .bmi-value {
      font-size: 3.5rem;
    }

    .bmi-category {
      font-size: 1.25rem;
    }

    .health-advice,
    .age-advisory,
    .bmi-explanation {
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
  }

  @media (max-width: 480px) {
    .bmi-results-card {
      padding: 1.5rem 1rem;
    }

    .card-title {
      font-size: 1.25rem;
    }

    .bmi-value {
      font-size: 3rem;
    }

    .health-advice,
    .age-advisory,
    .bmi-explanation {
      padding: 1.25rem;
      margin-bottom: 1.25rem;
    }
  }

  /* Reduce motion for users who prefer it */
  @media (prefers-reduced-motion: reduce) {
    .icon-glow,
    .empty-glow,
    .results-content,
    .bmi-display,
    .health-advice,
    .age-advisory,
    .bmi-explanation {
      animation: none;
    }

    .bmi-value {
      animation: none;
    }

    .health-advice:hover,
    .age-advisory:hover,
    .bmi-explanation:hover {
      transform: none;
    }
  }
</style>
