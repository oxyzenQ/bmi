<script lang="ts">
  import { onMount } from 'svelte';
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

  onMount(() => {
    // Randomize background position effect
    const randomizeBackgroundPosition = () => {
      const xPos = Math.floor(Math.random() * 101);
      const yPos = Math.floor(Math.random() * 101);
      document.body.style.backgroundPosition = `${xPos}% ${yPos}%`;
    };

    randomizeBackgroundPosition();
    
    let isScrolling = false;
    const handleScroll = () => {
      if (!isScrolling) {
        isScrolling = true;
        requestAnimationFrame(() => {
          randomizeBackgroundPosition();
          isScrolling = false;
        });
      }
    };

    window.addEventListener('scroll', handleScroll);
    
    return () => window.removeEventListener('scroll', handleScroll);
  });

  // Function removed as it's not used - form binding handles input changes

  async function calculateBMI(e: Event) {
    e.preventDefault();
    
    const { age, gender, height, weight } = formData;
    
    if (!age || !gender || !height || !weight) {
      alert('Please fill in all fields');
      return;
    }

    isLoading = true;
    
    // Simulate calculation delay for better UX
    await new Promise(resolve => setTimeout(resolve, 800));

    const heightInMeters = parseFloat(height) / 100;
    const bmi = parseFloat(weight) / (heightInMeters * heightInMeters);
    
    let category = '';
    let categoryClass = '';

    if (bmi < 18.5) {
      category = 'Underweight';
      categoryClass = 'text-blue-400';
    } else if (bmi >= 18.5 && bmi < 24.9) {
      category = 'Healthy weight';
      categoryClass = 'text-green-400';
    } else if (bmi >= 25 && bmi < 29.9) {
      category = 'Overweight';
      categoryClass = 'text-yellow-400';
    } else {
      category = 'Obesity';
      categoryClass = 'text-red-400';
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

<div class="min-h-screen py-8">
  <div class="space-container max-w-2xl">
    <div class="flex items-center justify-between mb-8">
      <a href="/" class="text-white hover:text-blue-400 transition-colors">
        <i class="fa-solid fa-arrow-left mr-2"></i>
        Back to Home
      </a>
      <img 
        src="/assets/logobmii.png" 
        alt="BMI Logo" 
        width="60" 
        height="60"
        loading="lazy"
        decoding="async"
      />
    </div>

    <h1 class="text-3xl font-bold text-white mb-2 text-center">
      BMI Calculator
    </h1>
    <p class="text-gray-300 text-center mb-8">
      Calculate your Body Mass Index and learn about your health status
    </p>

    <form on:submit={calculateBMI} class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label for="age" class="block text-white font-medium mb-2">
            Age (years)
          </label>
          <input
            type="number"
            id="age"
            name="age"
            bind:value={formData.age}
            class="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-400 transition-colors"
            placeholder="Enter your age"
            min="1"
            max="120"
          />
        </div>

        <div>
          <fieldset>
            <legend class="block text-white font-medium mb-2">
              Gender
            </legend>
            <div class="flex gap-4">
              <label class="flex items-center text-white cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  bind:group={formData.gender}
                  class="mr-2 accent-blue-400"
                />
                <i class="fa-solid fa-person mr-1"></i>
                Male
              </label>
              <label class="flex items-center text-white cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  bind:group={formData.gender}
                  class="mr-2 accent-blue-400"
                />
                <i class="fa-solid fa-person-dress mr-1"></i>
                Female
              </label>
            </div>
          </fieldset>
        </div>

        <div>
          <label for="height" class="block text-white font-medium mb-2">
            Height (cm)
          </label>
          <input
            type="number"
            id="height"
            name="height"
            bind:value={formData.height}
            class="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-400 transition-colors"
            placeholder="Enter your height"
            min="50"
            max="300"
          />
        </div>

        <div>
          <label for="weight" class="block text-white font-medium mb-2">
            Weight (kg)
          </label>
          <input
            type="number"
            id="weight"
            name="weight"
            bind:value={formData.weight}
            class="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-400 transition-colors"
            placeholder="Enter your weight"
            min="10"
            max="500"
            step="0.1"
          />
        </div>
      </div>

      <div class="flex gap-4 justify-center">
        <button
          type="submit"
          class="space-button text-lg"
          disabled={isLoading}
        >
          {#if isLoading}
            <LoadingSpinner size="small" color="#ffffff" />
            Calculating...
          {:else}
            <i class="fa-solid fa-calculator"></i>
            Calculate BMI
          {/if}
        </button>
        <button
          type="button"
          on:click={resetForm}
          class="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
        >
          <i class="fa-solid fa-refresh"></i>
          Reset
        </button>
      </div>
    </form>

    {#if bmiResult}
      <div class="mt-8 p-6 bg-gray-800 rounded-lg border border-gray-600 text-center">
        <h3 class="text-xl font-semibold text-white mb-4">Your BMI Result</h3>
        <div class="text-4xl font-bold mb-2">
          <span class={bmiResult.categoryClass}>{bmiResult.value}</span>
        </div>
        <div class={`text-lg font-medium ${bmiResult.categoryClass}`}>
          {bmiResult.category}
        </div>
        
        <!-- BMI Chart -->
        <div class="mt-6">
          <BmiChart 
            bmiValue={bmiResult.value}
            category={bmiResult.category}
            categoryClass={bmiResult.categoryClass}
          />
        </div>
        
        <div class="mt-4 text-sm text-gray-400">
          <p>BMI Categories:</p>
          <div class="mt-2 text-left max-w-md mx-auto">
            <p class="text-blue-400">• Underweight: Below 18.5</p>
            <p class="text-green-400">• Healthy weight: 18.5 - 24.9</p>
            <p class="text-yellow-400">• Overweight: 25.0 - 29.9</p>
            <p class="text-red-400">• Obesity: 30.0 and above</p>
          </div>
        </div>
      </div>
    {/if}

    <div class="mt-8 text-center">
      <a href="/about" class="text-blue-400 hover:text-purple-400 transition-colors">
        Learn more about BMI <i class="fa-solid fa-arrow-right ml-1"></i>
      </a>
    </div>
  </div>
</div>
