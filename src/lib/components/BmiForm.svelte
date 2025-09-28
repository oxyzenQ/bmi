<script lang="ts">
  import { Orbit, User, Ruler, Weight, Zap, Trash2 } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  // Inputs as strings for empty default UX
  export let age: string = '';
  export let height: string = '';
  export let weight: string = '';
  export let onClear: () => void;
  export let onCalculate: () => void;

  const dispatch = createEventDispatcher();

  // Sanitizers: age as integer, height/weight as decimals (one dot)
  function sanitizeInteger(value: string): string {
    // keep digits only
    return value.replace(/\D+/g, '').slice(0, 3); // cap length reasonably
  }

  function sanitizeDecimal(value: string): string {
    // remove invalid chars, allow one dot
    let v = value.replace(/[^0-9.]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      // remove additional dots
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
    }
    // trim leading zeros sensibly (but keep "0." cases)
    if (v.startsWith('00')) {
      v = v.replace(/^0+/, '0');
    }
    return v.slice(0, 6); // cap length
  }

  // Enhanced validation with better accuracy and ordering
  let ageInputEl: HTMLInputElement;
  let heightInputEl: HTMLInputElement;
  let weightInputEl: HTMLInputElement;

  $: parsedAge = age !== '' ? parseInt(age) : null;
  $: parsedHeight = height !== '' ? parseFloat(height) : null;
  $: parsedWeight = weight !== '' ? parseFloat(weight) : null;
  // Require realistic ranges
  $: ageValid = parsedAge !== null && !isNaN(parsedAge) && parsedAge > 0 && parsedAge <= 120;
  $: heightValid = parsedHeight !== null && !isNaN(parsedHeight) && parsedHeight > 0 && parsedHeight <= 300;
  $: weightValid = parsedWeight !== null && !isNaN(parsedWeight) && parsedWeight > 0 && parsedWeight <= 1000;
  // Calculation only allowed when all three are valid
  $: canCalculate = ageValid && heightValid && weightValid;

  // Only trigger calculate when button is pressed and inputs are valid
  function handleCalculate() {
    if (canCalculate && parsedHeight && parsedWeight) {
      // Clean and validate values before calculation
      const cleanHeight = Math.round(parsedHeight * 100) / 100; // Round to 2 decimals
      const cleanWeight = Math.round(parsedWeight * 100) / 100; // Round to 2 decimals
      
      // Optional: dispatch event if parent listens; keep for extensibility
      dispatch('calculate', { age: parsedAge, height: cleanHeight, weight: cleanWeight });
      onCalculate();
    }
  }

  function handleClear() {
    age = '';
    height = '';
    weight = '';
    onClear();
  }
</script>

<div class="form-inner">
  <div class="card-header">
    <div class="icon-container">
      <Orbit class="Orbit" />
      <div class="icon-glow"></div>
    </div>
    <h2 class="card-title">BMI Calculator</h2>
    <p class="card-subtitle">Fill in order: Age → Height → Weight. Click Calculate BMI to see results.</p>

    <!-- status pill: indicates readiness -->
    <div class="status-row">
      <span
        class="pill-indicator"
        tabindex="0"
        role="button"
        aria-label={canCalculate ? 'Inputs valid. Ready to calculate.' : 'Incomplete inputs. Enter age, height and weight.'}
        data-color={canCalculate ? 'green' : 'gray'}
      >
        <span class="dot" aria-hidden="true"></span>
        {canCalculate ? 'Ready' : 'Enter all fields'}
      </span>
    </div>
  </div>

  <div class="bmi-form">
    <div class="input-group">
      <label for="age" class="input-label">
        <User class="User" />
        Age (years)
      </label>
      <input
        type="text"
        id="age"
        bind:this={ageInputEl}
        bind:value={age}
        class="form-input"
        inputmode="numeric"
        pattern="[0-9]*"
        placeholder="e.g., 25"
        aria-label="Age in years"
        aria-invalid={age !== '' && !ageValid}
        on:input={(e) => { const t = e.currentTarget as HTMLInputElement; age = sanitizeInteger(t.value); }}
      />
      {#if age !== '' && !ageValid}
        <div class="input-error" role="alert">Please enter a valid age between 1 and 120.</div>
      {/if}
    </div>

    <div class="input-group">
      <label for="height" class="input-label">
        <Ruler class="Ruler" />
        Height (cm)
      </label>
      <input
        type="text"
        id="height"
        bind:this={heightInputEl}
        bind:value={height}
        class="form-input"
        inputmode="decimal"
        placeholder={ageValid ? 'e.g., 170' : 'Enter age first'}
        aria-label="Height in centimeters"
        aria-invalid={height !== '' && !heightValid}
        disabled={!ageValid}
        aria-disabled={!ageValid}
        on:focus={() => { if (!ageValid) ageInputEl?.focus(); }}
        on:input={(e) => { const t = e.currentTarget as HTMLInputElement; height = sanitizeDecimal(t.value); }}
      />
      {#if height !== '' && !heightValid}
        <div class="input-error" role="alert">Height must be between 1-300 cm.</div>
      {/if}
    </div>

    <div class="input-group">
      <label for="weight" class="input-label">
        <Weight class="Weight" />
        Weight (kg)
      </label>
      <input
        type="text"
        id="weight"
        bind:this={weightInputEl}
        bind:value={weight}
        class="form-input"
        inputmode="decimal"
        placeholder={heightValid ? 'e.g., 70.5' : 'Enter height first'}
        aria-label="Weight in kilograms"
        aria-invalid={weight !== '' && !weightValid}
        disabled={!heightValid}
        aria-disabled={!heightValid}
        on:focus={() => { if (!heightValid) heightInputEl?.focus(); }}
        on:input={(e) => { const t = e.currentTarget as HTMLInputElement; weight = sanitizeDecimal(t.value); }}
      />
      {#if weight !== '' && !weightValid}
        <div class="input-error" role="alert">Weight must be between 1-1000 kg.</div>
      {/if}
    </div>

    <div class="button-group">
      <button
        type="button"
        on:click={handleCalculate}
        on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCalculate()}
        class="btn btn-primary"
        aria-label="Calculate BMI"
        aria-disabled={!canCalculate}
        disabled={!canCalculate}
      >
        <Zap class="Zap" />
        Calc BMI
      </button>
      
      <button
        type="button"
        on:click={handleClear}
        on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClear()}
        class="btn btn-danger"
        aria-label="Clear all data"
      >
        <Trash2 class="Trash2" />
        Clear All Data
      </button>
    </div>
  </div>
</div>

 

