<script lang="ts">
  import { onMount } from 'svelte';
  import { Orbit, User, Ruler, Weight, Zap, Trash2, ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine } from 'lucide-svelte';
  import { exportBmiHistory, validateBmiImport } from '$lib/utils/history-io';

  const isBrowser = typeof window !== 'undefined';

  interface Props {
    age?: string;
    height?: string;
    weight?: string;
    unitSystem?: 'metric' | 'imperial';
    calculating?: boolean;
    onClear: () => void;
    onCalculate: () => void;
    onNotify?: (result: ImportNotifyResult) => void;
  }

  let {
    age = $bindable(''),
    height = $bindable(''),
    weight = $bindable(''),
    unitSystem = $bindable<'metric' | 'imperial'>('metric'),
    calculating = false,
    onClear,
    onCalculate,
    onNotify
  }: Props = $props();

  // Persist unit system preference in localStorage
  onMount(() => {
    if (!isBrowser) return;
    try {
      const stored = localStorage.getItem('bmi.unitSystem');
      if (stored === 'imperial' || stored === 'metric') {
        unitSystem = stored;
      }
    } catch {
      // localStorage unavailable
    }
  });

  $effect(() => {
    if (!isBrowser) return;
    try {
      localStorage.setItem('bmi.unitSystem', unitSystem);
    } catch {
      // localStorage unavailable
    }
  });

  // Derived unit-specific labels, placeholders, and validation bounds
  let heightLabel = $derived(unitSystem === 'metric' ? 'Height (cm)' : 'Height (in)');
  let weightLabel = $derived(unitSystem === 'metric' ? 'Weight (kg)' : 'Weight (lbs)');
  let heightExample = $derived(unitSystem === 'metric' ? 'e.g., 170' : 'e.g., 66');
  let weightExample = $derived(unitSystem === 'metric' ? 'e.g., 70.5' : 'e.g., 154');
  let heightAriaLabel = $derived(unitSystem === 'metric' ? 'Height in centimeters' : 'Height in inches');
  let weightAriaLabel = $derived(unitSystem === 'metric' ? 'Weight in kilograms' : 'Weight in pounds');
  let heightErrorText = $derived(
    unitSystem === 'metric' ? 'Height must be between 1-300 cm.' : 'Height must be between 1-120 in.'
  );
  let weightErrorText = $derived(
    unitSystem === 'metric' ? 'Weight must be between 1-1000 kg.' : 'Weight must be between 1-1500 lbs.'
  );
  let heightMax = $derived(unitSystem === 'metric' ? 300 : 120);
  let weightMax = $derived(unitSystem === 'metric' ? 1000 : 1500);

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
    const hv = ph !== null && !isNaN(ph) && ph > 0 && ph <= heightMax;
    const wv = pw !== null && !isNaN(pw) && pw > 0 && pw <= weightMax;
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

  // Export / Import history
  let fileInputEl: HTMLInputElement | undefined = $state();

  interface ImportNotifyResult {
    action: 'import-validate' | 'import-error';
    text?: string;
    recordCount?: number;
    checksumVerified?: boolean;
    error?: string;
  }

  function formatDate(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function handleExport() {
    const json = exportBmiHistory();
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bmi-history-${formatDate()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputEl?.click();
  }

  async function handleFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const validation = validateBmiImport(text);

      if (validation.valid && validation.recordCount) {
        onNotify?.({
          action: 'import-validate',
          text,
          recordCount: validation.recordCount,
          checksumVerified: validation.checksumVerified ?? false
        });
      } else {
        onNotify?.({
          action: 'import-error',
          error: validation.error || 'Import failed. Please check the file format.'
        });
      }
    } catch {
      onNotify?.({
        action: 'import-error',
        error: 'Could not read the file.'
      });
    }
    input.value = '';
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

  <div class="unit-toggle" role="radiogroup" aria-label="Unit system">
    <button
      type="button"
      class="unit-toggle-segment"
      class:active={unitSystem === 'metric'}
      role="radio"
      aria-checked={unitSystem === 'metric'}
      onclick={() => { unitSystem = 'metric'; height = ''; weight = ''; }}
    >
      <ArrowLeftRight size={14} aria-hidden="true" />
      Metric (kg/cm)
    </button>
    <button
      type="button"
      class="unit-toggle-segment"
      class:active={unitSystem === 'imperial'}
      role="radio"
      aria-checked={unitSystem === 'imperial'}
      onclick={() => { unitSystem = 'imperial'; height = ''; weight = ''; }}
    >
      Imperial (lb/in)
    </button>
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
        {heightLabel}
      </label>
      <input
        type="text"
        id="height"
        bind:this={heightInputEl}
        bind:value={height}
        class="form-input"
        inputmode="decimal"
        placeholder={ageValid ? heightExample : 'Enter age first'}
        aria-label={heightAriaLabel}
        aria-invalid={height !== '' && !heightValid}
        disabled={!ageValid}
        aria-disabled={!ageValid}
        onfocus={() => { if (!ageValid) ageInputEl?.focus(); }}
        oninput={handleHeightInput}
      />
      {#if height !== '' && !heightValid}
        <div class="input-error" role="alert">{heightErrorText}</div>
      {/if}
    </div>

    <div class="input-group">
      <label for="weight" class="input-label">
        <Weight class="Weight" />
        {weightLabel}
      </label>
      <input
        type="text"
        id="weight"
        bind:this={weightInputEl}
        bind:value={weight}
        class="form-input"
        inputmode="decimal"
        placeholder={heightValid ? weightExample : 'Enter height first'}
        aria-label={weightAriaLabel}
        aria-invalid={weight !== '' && !weightValid}
        disabled={!heightValid}
        aria-disabled={!heightValid}
        onfocus={() => { if (!heightValid) heightInputEl?.focus(); }}
        oninput={handleWeightInput}
      />
      {#if weight !== '' && !weightValid}
        <div class="input-error" role="alert">{weightErrorText}</div>
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

    <div class="history-actions">
      <button type="button" class="btn btn-secondary" onclick={handleExport} aria-label="Export BMI history">
        <ArrowUpFromLine size={16} aria-hidden="true" />
        Export
      </button>
      <input
        type="file"
        bind:this={fileInputEl}
        accept=".json"
        class="sr-only"
        onchange={handleFileChange}
        tabindex="-1"
        aria-hidden="true"
      />
      <button type="button" class="btn btn-secondary" onclick={handleImportClick} aria-label="Import BMI history">
        <ArrowDownToLine size={16} aria-hidden="true" />
        Import
      </button>
    </div>
  </div>
</div>

<style>
  .unit-toggle {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 2px;
    border: var(--btn-border);
    border-radius: 9999px;
    padding: 2px;
    margin: 0 auto 1rem;
    width: fit-content;
  }

  .unit-toggle-segment {
    font-size: 0.8rem;
    padding: 0.3rem 0.7rem;
    border: none;
    border-radius: 9999px;
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    transition: background 0.2s ease, color 0.2s ease;
    white-space: nowrap;
  }

  .unit-toggle-segment:hover {
    color: rgba(255, 255, 255, 0.7);
  }

  .unit-toggle-segment.active {
    background: var(--cosmic-purple);
    color: white;
  }

  .history-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .history-actions .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    border-radius: 9999px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
