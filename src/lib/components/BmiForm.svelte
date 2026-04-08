<script lang="ts">
  import { Orbit, User, Ruler, Weight, Zap, Trash2 } from 'lucide-svelte';

  interface Props {
    age?: string;
    height?: string;
    weight?: string;
    calculating?: boolean;
    onClear: () => void;
    onCalculate: () => void;
  }

  let {
    age = $bindable(''),
    height = $bindable(''),
    weight = $bindable(''),
    calculating = false,
    onClear,
    onCalculate
  }: Props = $props();

  // Sanitizers: age as integer, height/weight as decimals (one dot)
  function sanitizeInteger(value: string): string {
    return value.replace(/\D+/g, '').slice(0, 3);
  }

  function sanitizeDecimal(value: string): string {
    let v = value.replace(/[^0-9.]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
    }
    if (v.startsWith('00')) {
      v = v.replace(/^0+/, '0');
    }
    return v.slice(0, 6);
  }

  let ageInputEl: HTMLInputElement;
  let heightInputEl: HTMLInputElement;
  let weightInputEl: HTMLInputElement;

  let {
    parsedAge,
    parsedHeight,
    parsedWeight,
    ageValid,
    heightValid,
    weightValid,
    canCalculate
  } = $derived.by(() => {
    const pa = age !== '' ? parseInt(age) : null;
    const ph = height !== '' ? parseFloat(height) : null;
    const pw = weight !== '' ? parseFloat(weight) : null;
    const av = pa !== null && !isNaN(pa) && pa > 0 && pa <= 120;
    const hv = ph !== null && !isNaN(ph) && ph > 0 && ph <= 300;
    const wv = pw !== null && !isNaN(pw) && pw > 0 && pw <= 1000;
    return {
      parsedAge: pa,
      parsedHeight: ph,
      parsedWeight: pw,
      ageValid: av,
      heightValid: hv,
      weightValid: wv,
      canCalculate: av && hv && wv
    };
  });

  function handleAgeInput(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    age = sanitizeInteger(target.value);
  }

  function handleHeightInput(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    height = sanitizeDecimal(target.value);
  }

  function handleWeightInput(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    weight = sanitizeDecimal(target.value);
  }

  function handleCalculate() {
    if (calculating) return;
    if (canCalculate && parsedHeight && parsedWeight) {
      onCalculate();
    }
  }

  function handleClear() {
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

    <div class="status-row">
      <span
        class="pill-indicator"
        tabindex="0"
        role="button"
        aria-label={canCalculate ? 'Inputs valid. Ready to calculate.' : 'Incomplete inputs. Enter age, height and weight.'}
        data-color={canCalculate ? 'green' : 'grey'}
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
        oninput={handleAgeInput}
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
        onfocus={() => { if (!ageValid) ageInputEl?.focus(); }}
        oninput={handleHeightInput}
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
        onfocus={() => { if (!heightValid) heightInputEl?.focus(); }}
        oninput={handleWeightInput}
      />
      {#if weight !== '' && !weightValid}
        <div class="input-error" role="alert">Weight must be between 1-1000 kg.</div>
      {/if}
    </div>

    <div class="button-group">
      <button
        type="button"
        onclick={handleCalculate}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCalculate()}
        class="btn btn-primary"
        class:is-calculating={calculating}
        aria-label="Calculate BMI"
        aria-disabled={!canCalculate || calculating}
        aria-busy={calculating}
        disabled={!canCalculate || calculating}
      >
        <Zap class="Zap" />
        {#if calculating}
          Calculating…
          <span class="btn-dots" aria-hidden="true">
            <span class="btn-dot"></span>
            <span class="btn-dot"></span>
            <span class="btn-dot"></span>
          </span>
        {:else}
          Calc BMI
        {/if}
      </button>

      <button
        type="button"
        onclick={handleClear}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClear()}
        class="btn btn-danger"
        aria-label="Clear all data"
      >
        <Trash2 class="Trash2" />
        Clear All Data
      </button>
    </div>
  </div>
</div>
