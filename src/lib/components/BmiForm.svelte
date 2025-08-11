<script lang="ts">
  import { Calculator, User, Ruler, Weight, Send, RotateCcw, Loader2 } from 'lucide-svelte';

  export let onCalculate: (age: number, height: number, weight: number) => void;
  export let onReset: () => void;

  let age = '';
  let height = '';
  let weight = '';
  let isCalculating = false;

  function handleCalculate() {
    const ageNum = parseFloat(age);
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);
    
    if (ageNum && heightNum && weightNum && ageNum > 0 && heightNum > 0 && weightNum > 0) {
      isCalculating = true;
      // Smooth transition handled via class binding
      // Simulate calculation with realistic delay
      setTimeout(() => {
        onCalculate(ageNum, heightNum, weightNum);
        isCalculating = false;
      }, 800);
    }
  }

  function handleReset() {
    age = '';
    height = '';
    weight = '';
    onReset();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleCalculate();
    }
  }
</script>

<div class="bmi-form-card liquid-glass" class:calculating={isCalculating}>
  <div class="card-header">
    <div class="icon-container">
      <Calculator class="w-12 h-12 text-cosmic-blue" />
      <div class="icon-glow"></div>
    </div>
    <h2 class="card-title">Calculate Your BMI</h2>
    <p class="card-subtitle">Enter your measurements below to discover your cosmic balance.</p>
  </div>

  <form on:submit|preventDefault={handleCalculate} class="bmi-form">
    <div class="input-group">
      <label for="age" class="input-label">
        <User class="w-4 h-4" />
        Age (years)
      </label>
      <input
        type="number"
        id="age"
        bind:value={age}
        on:keydown={handleKeydown}
        class="form-input"
        placeholder="e.g., 25"
        min="1"
        max="120"
        required
      />
    </div>

    <div class="input-group">
      <label for="height" class="input-label">
        <Ruler class="w-4 h-4" />
        Height (cm)
      </label>
      <input
        type="number"
        id="height"
        bind:value={height}
        on:keydown={handleKeydown}
        class="form-input"
        placeholder="e.g., 170"
        min="50"
        max="300"
        step="0.1"
        required
      />
    </div>

    <div class="input-group">
      <label for="weight" class="input-label">
        <Weight class="w-4 h-4" />
        Weight (kg)
      </label>
      <input
        type="number"
        id="weight"
        bind:value={weight}
        on:keydown={handleKeydown}
        class="form-input"
        placeholder="e.g., 70.5"
        min="10"
        max="500"
        step="0.1"
        required
      />
    </div>

    <div class="button-group">
      <button
        type="submit"
        class="btn-primary space-button"
        disabled={isCalculating || !age || !height || !weight}
      >
        {#if isCalculating}
          <Loader2 class="w-5 h-5 animate-spin" />
          Calculating...
        {:else}
          <Send class="w-5 h-5" />
          Calculate BMI
        {/if}
      </button>
      
      <button
        type="button"
        on:click={handleReset}
        class="btn-secondary space-button"
      >
        <RotateCcw class="w-5 h-5" />
        Reset Form
      </button>
    </div>
  </form>
</div>

<style>
  .bmi-form-card {
    padding: 2.5rem;
    border-radius: 1.5rem;
    position: relative;
    overflow: hidden;
    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    background: rgba(15, 23, 42, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(18px) saturate(150%);
    -webkit-backdrop-filter: blur(18px) saturate(150%);
    will-change: transform, background-color, box-shadow;
    contain: layout style paint;
  }

  /* svelte-ignore css-unused-selector */
  .bmi-form-card.calculating {
    transform: scale(1.02) translateZ(0);
    box-shadow: 0 20px 40px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(59, 130, 246, 0.2);
    will-change: transform, box-shadow;
    backface-visibility: hidden;
  }

  .bmi-form-card::before {
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
    background: radial-gradient(closest-side, rgba(59, 130, 246, 0.15), transparent 70%);
    transform: translate(-50%, -50%);
    filter: blur(25px);
    pointer-events: none;
    will-change: transform, opacity;
  }

  .bmi-form-card::after {
    content: '';
    position: absolute;
    top: 12%;
    left: 14%;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.2) 60%, rgba(255,255,255,0) 70%);
    filter: blur(0.6px);
    opacity: 0;
    transform: translateZ(0);
    animation: sparkle 1s infinite ease-out;
    will-change: transform, opacity;
    pointer-events: none;
  }

  @keyframes sparkle {
    0% { opacity: 0; transform: translate(0, 0) scale(0.8); }
    6% { opacity: 0.75; transform: translate(5px, -6px) scale(1); }
    12% { opacity: 0; transform: translate(12px, -12px) scale(1.15); }
    100% { opacity: 0; transform: translate(12px, -12px) scale(1.15); }
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

  .bmi-form {
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .input-label {
    font-weight: 500;
    color: #e5e7eb;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .form-input {
    padding: 1rem 1.25rem;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.75rem;
    color: #ffffff;
    font-size: 1rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(10px);
  }

  .form-input:focus {
    outline: none;
    border-color: #60a5fa;
    box-shadow: 
      0 0 0 3px rgba(96, 165, 250, 0.1),
      0 0 20px rgba(96, 165, 250, 0.1);
    background: rgba(15, 23, 42, 0.8);
  }

  .form-input::placeholder {
    color: #6b7280;
  }

  .form-input:hover:not(:focus) {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(15, 23, 42, 0.7);
  }

  .button-group {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .btn-primary,
  .btn-secondary {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.75rem;
    border: none;
    border-radius: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    flex: 1;
    justify-content: center;
    font-size: 0.95rem;
    position: relative;
    overflow: hidden;
  }

  .btn-primary {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    color: white;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .btn-primary::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
  }

  .btn-primary:hover:not(:disabled)::before {
    left: 100%;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .btn-secondary {
    background: rgba(75, 85, 99, 0.6);
    color: #e5e7eb;
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
  }

  .btn-secondary:hover {
    background: rgba(75, 85, 99, 0.8);
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  @media (max-width: 768px) {
    .bmi-form-card {
      padding: 2rem 1.5rem;
      border-radius: 1.25rem;
    }

    .card-title {
      font-size: 1.5rem;
    }

    .button-group {
      flex-direction: column;
      gap: 0.75rem;
    }

    .btn-primary,
    .btn-secondary {
      padding: 0.875rem 1.5rem;
    }
  }

  @media (max-width: 480px) {
    .bmi-form-card {
      padding: 1.5rem 1rem;
    }

    .card-title {
      font-size: 1.25rem;
    }

    .form-input {
      padding: 0.875rem 1rem;
    }
  }

  /* Reduce motion for users who prefer it */
  @media (prefers-reduced-motion: reduce) {
    .icon-glow {
      animation: none;
    }

    .bmi-form-card::after {
      animation: none;
      opacity: 0;
    }

    .btn-primary::before {
      display: none;
    }

    .btn-primary:hover:not(:disabled),
    .btn-secondary:hover {
      transform: none;
    }
    /* svelte-ignore css-unused-selector */
    .bmi-form-card.calculating {
      transform: scale(0.98);
    }
  }
</style>
