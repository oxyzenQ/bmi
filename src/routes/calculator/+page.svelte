<script lang="ts">
  import BmiChart from '$lib/components/BmiChart.svelte';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

  let formData = {
    age: '',
    gender: '',
    height: '',
    weight: ''
  };

  let bmiResult: {
    value: number;
    category: string;
    categoryClass: string;
  } | null = null;

  let isLoading = false;

  async function calculateBMI(e: Event) {
    e.preventDefault();
    
    const { age, gender, height, weight } = formData;
    
    if (!age || !gender || !height || !weight) {
      alert('Please fill in all fields');
      return;
    }

    isLoading = true;
    
    await new Promise(resolve => setTimeout(resolve, 800));

    const heightInMeters = parseFloat(height) / 100;
    const bmi = parseFloat(weight) / (heightInMeters * heightInMeters);
    
    let category = '';
    let categoryClass = '';

    if (bmi < 18.5) {
      category = 'Underweight';
      categoryClass = 'status-blue';
    } else if (bmi >= 18.5 && bmi < 24.9) {
      category = 'Healthy weight';
      categoryClass = 'status-green';
    } else if (bmi >= 25 && bmi < 29.9) {
      category = 'Overweight';
      categoryClass = 'status-yellow';
    } else {
      category = 'Obesity';
      categoryClass = 'status-red';
    }

    bmiResult = {
      value: parseFloat(bmi.toFixed(2)),
      category,
      categoryClass
    };

    isLoading = false;
  }

  function resetForm() {
    formData = { age: '', gender: '', height: '', weight: '' };
    bmiResult = null;
  }
</script>

<svelte:head>
  <title>BMI Calculator - Calculate Your BMI</title>
  <meta name="description" content="Calculate your Body Mass Index and learn about your health status" />
</svelte:head>

<div class="main-container" style="padding-top: 2rem; padding-bottom: 2rem;">
  <div class="glass-panel" style="max-width: 860px; margin: 0 auto;">
    <div class="panel-header" style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 1rem;">
      <a href="/" class="btn btn-outline btn-sm" aria-label="Back to Home">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:6px"><path d="M15 18l-6-6 6-6" stroke="#dbeafe" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Back to Home
      </a>
      <div class="page-logo-avatar" aria-hidden="true">
        <img 
          src="/assets/logobmii.webp" 
          alt="BMI Logo" 
          width="60" 
          height="60"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>

    <h1 class="section-title" style="text-align:center; margin-bottom: 0.5rem;">
      BMI Calculator
    </h1>
    <p class="section-subtitle" style="text-align:center; margin-bottom: 1.5rem;">
      Calculate your Body Mass Index and learn about your health status
    </p>

    <form on:submit={calculateBMI}>
      <div class="form-grid" style="display:grid; grid-template-columns: 1fr; gap: 1rem;">
        <div>
          <label for="age" class="input-label">
            Age (years)
          </label>
          <input
            type="number"
            id="age"
            name="age"
            bind:value={formData.age}
            class="form-input"
            placeholder="Enter your age"
            min="1"
            max="120"
          />
        </div>

        <div>
          <fieldset>
            <legend class="input-label">
              Gender
            </legend>
            <div style="display:flex; gap:1rem;">
              <label style="display:flex; align-items:center; cursor:pointer; gap:0.35rem;">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  bind:group={formData.gender}
                />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 12a4 4 0 100-8 4 4 0 000 8z" fill="#93c5fd"/><path d="M6 20v-1a6 6 0 1112 0v1" stroke="#93c5fd" stroke-width="2" stroke-linecap="round"/></svg>
                Male
              </label>
              <label style="display:flex; align-items:center; cursor:pointer; gap:0.35rem;">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  bind:group={formData.gender}
                />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 8a3 3 0 100-6 3 3 0 000 6z" fill="#f9a8d4"/><path d="M7 21l2-7 3-2 3 2 2 7" stroke="#f9a8d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Female
              </label>
            </div>
          </fieldset>
        </div>

        <div>
          <label for="height" class="input-label">
            Height (cm)
          </label>
          <input
            type="number"
            id="height"
            name="height"
            bind:value={formData.height}
            class="form-input"
            placeholder="Enter your height"
            min="50"
            max="300"
          />
        </div>

        <div>
          <label for="weight" class="input-label">
            Weight (kg)
          </label>
          <input
            type="number"
            id="weight"
            name="weight"
            bind:value={formData.weight}
            class="form-input"
            placeholder="Enter your weight"
            min="10"
            max="500"
            step="0.1"
          />
        </div>
      </div>

      <div style="display:flex; gap:0.75rem; justify-content:center; margin-top: 1rem;">
        <button
          type="submit"
          class="btn btn-primary btn-lg"
          disabled={isLoading}
        >
          {#if isLoading}
            <LoadingSpinner size="small" color="#ffffff" />
            Calculating...
          {:else}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:6px"><rect x="5" y="3" width="14" height="18" rx="2" stroke="#e2e8f0" stroke-width="2"/><path d="M8 7h8M8 11h2m3 0h2M8 15h2m3 0h2M8 19h8" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round"/></svg>
            Calculate BMI
          {/if}
        </button>
        <button
          type="button"
          on:click={resetForm}
          class="btn btn-outline btn-lg"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:6px"><path d="M21 12a9 9 0 10-3.5 7.1" stroke="#dbeafe" stroke-width="2" stroke-linecap="round"/><path d="M21 12v6h-6" stroke="#dbeafe" stroke-width="2" stroke-linecap="round"/></svg>
          Reset
        </button>
      </div>
    </form>

    {#if bmiResult}
      <div class="glass-card" style="margin-top:1.25rem; text-align:center;">
        <h3 class="section-title" style="text-align:center; margin-bottom: 0.75rem;">Your BMI Result</h3>
        <div class="title" style="font-size:2rem; font-weight:800; margin-bottom:0.5rem;">
          <span class={bmiResult.categoryClass}>{bmiResult.value}</span>
        </div>
        <div class={`subtitle ${bmiResult.categoryClass}`}>
          {bmiResult.category}
        </div>
        
        <!-- BMI Chart -->
        <div style="margin-top: 1rem;">
          <BmiChart 
            bmiValue={bmiResult.value}
            category={bmiResult.category}
            categoryClass={bmiResult.categoryClass}
          />
        </div>
        
        <div class="subtitle" style="margin-top: 0.75rem;">
          <p>BMI Categories:</p>
          <div style="margin-top:0.5rem; text-align:left; max-width: 520px; margin-inline:auto;">
            <p class="status-blue">• Underweight: Below 18.5</p>
            <p class="status-green">• Healthy weight: 18.5 - 24.9</p>
            <p class="status-yellow">• Overweight: 25.0 - 29.9</p>
            <p class="status-red">• Obesity: 30.0 and above</p>
          </div>
        </div>
      </div>
    {/if}

    <div style="margin-top:1.25rem; text-align:center;">
      <a href="/about" class="btn btn-secondary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:6px"><path d="M5 12h14M13 5l7 7-7 7" stroke="#083344" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Learn more about BMI
      </a>
    </div>
  </div>
</div>


