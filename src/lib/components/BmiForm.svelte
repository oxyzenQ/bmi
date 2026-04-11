<script lang="ts">
  import { Orbit, User, Ruler, Weight, Zap, Trash2, ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine } from 'lucide-svelte';
  import { exportBmiHistory, validateBmiImport } from '$lib/utils/history-io';

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
  // NOTE: Unit system persistence is managed by the parent (+page.svelte)
  // via bind:unitSystem. Do NOT read/write localStorage here — it causes
  // a race condition where child overwrites parent's value on mount.

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

  async function handleExport() {
    const json = await exportBmiHistory();
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
      const validation = await validateBmiImport(text);

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
  /* ── Outer wrapper ────────────────────────────────────────── */
  .form-inner {
    display: flex;
    flex-direction: column;
    gap: var(--sp-6);
  }

  /* ── Card header ─────────────────────────────────────────── */
  .card-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-3);
  }

  .icon-container {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
  }

  .icon-container :global(.Orbit) {
    width: 28px;
    height: 28px;
    color: var(--accent);
    position: relative;
    z-index: 1;
  }

  .icon-glow {
    position: absolute;
    inset: 0;
    border-radius: var(--radius-full);
    background: var(--accent-muted);
    filter: blur(12px);
    pointer-events: none;
  }

  .card-title {
    font-family: var(--font-sans);
    font-size: 1.35rem;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    margin: 0;
  }

  /* ── Status pill ─────────────────────────────────────────── */
  .status-row {
    margin-top: var(--sp-1);
  }

  .pill-indicator {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-1) var(--sp-3);
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.01em;
    cursor: default;
    user-select: none;
    border: 1px solid transparent;
    transition: all var(--dur-fast) var(--ease-out);
  }

  .pill-indicator[data-color='green'] {
    color: #34d399;
    background: rgba(52, 211, 153, 0.08);
    border-color: rgba(52, 211, 153, 0.15);
  }

  .pill-indicator[data-color='grey'] {
    color: var(--text-muted);
    background: rgba(113, 113, 122, 0.08);
    border-color: rgba(113, 113, 122, 0.1);
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-full);
    flex-shrink: 0;
  }

  .pill-indicator[data-color='green'] .dot {
    background: #34d399;
    box-shadow: 0 0 6px rgba(52, 211, 153, 0.5);
  }

  .pill-indicator[data-color='grey'] .dot {
    background: var(--text-muted);
  }

  /* ── Unit toggle ─────────────────────────────────────────── */
  .unit-toggle {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 2px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-full);
    padding: 3px;
    width: fit-content;
    margin: 0 auto;
    background: var(--bg-elevated);
  }

  .unit-toggle-segment {
    font-family: var(--font-sans);
    font-size: 0.8rem;
    font-weight: 500;
    padding: var(--sp-1) var(--sp-4);
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    transition: background var(--dur-fast) var(--ease-out),
                color var(--dur-fast) var(--ease-out),
                box-shadow var(--dur-fast) var(--ease-out);
    white-space: nowrap;
    line-height: 1.4;
  }

  .unit-toggle-segment:hover:not(.active) {
    color: var(--text-secondary);
    background: rgba(255, 255, 255, 0.03);
  }

  .unit-toggle-segment.active {
    background: var(--accent);
    color: #fff;
    box-shadow: 0 1px 4px rgba(139, 92, 246, 0.25);
  }

  /* ── Form layout ─────────────────────────────────────────── */
  .bmi-form {
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
  }

  /* ── Input groups ────────────────────────────────────────── */
  .input-group {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }

  .input-label {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    font-family: var(--font-sans);
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-secondary);
    letter-spacing: 0.01em;
  }

  .input-label :global(.User),
  .input-label :global(.Ruler),
  .input-label :global(.Weight) {
    width: 14px;
    height: 14px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .form-input {
    width: 100%;
    padding: var(--sp-3) var(--sp-4);
    font-family: var(--font-sans);
    font-size: 0.9rem;
    font-weight: 400;
    color: var(--text-primary);
    background: var(--bg-surface);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    outline: none;
    transition: border-color var(--dur-fast) var(--ease-out),
                box-shadow var(--dur-fast) var(--ease-out),
                background var(--dur-fast) var(--ease-out);
    box-sizing: border-box;
  }

  .form-input::placeholder {
    color: var(--text-muted);
    font-weight: 400;
  }

  .form-input:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .form-input:focus:not(:disabled) {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-muted);
    background: var(--bg-elevated);
  }

  .form-input:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    background: var(--bg-base);
    border-color: var(--border-subtle);
  }

  .form-input[aria-invalid='true'] {
    border-color: #f87171;
  }

  .form-input[aria-invalid='true']:focus {
    box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.15);
    border-color: #f87171;
  }

  /* ── Validation errors ───────────────────────────────────── */
  .input-error {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 400;
    color: #f87171;
    padding-left: var(--sp-1);
    line-height: 1.4;
  }

  /* ── Button group ────────────────────────────────────────── */
  .button-group {
    display: flex;
    gap: var(--sp-3);
    padding-top: var(--sp-2);
  }

  .button-group :global(.btn) {
    flex: 1;
    justify-content: center;
  }

  /* ── Primary button ──────────────────────────────────────── */
  .button-group :global(.btn-primary) {
    font-family: var(--font-sans);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    padding: var(--sp-3) var(--sp-5);
    font-size: 0.875rem;
    font-weight: 600;
    color: #fff;
    background: var(--accent);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-out),
                box-shadow var(--dur-fast) var(--ease-out),
                transform var(--dur-fast) var(--ease-out);
  }

  .button-group :global(.btn-primary:hover:not(:disabled)) {
    background: var(--accent-hover);
    box-shadow: 0 2px 12px rgba(139, 92, 246, 0.3);
  }

  .button-group :global(.btn-primary:active:not(:disabled)) {
    transform: scale(0.985);
  }

  .button-group :global(.btn-primary:disabled) {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .button-group :global(.btn-primary .Zap) {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  /* ── Calculating state ───────────────────────────────────── */
  :global(.is-calculating) {
    position: relative;
    pointer-events: none;
  }

  .btn-dots {
    display: inline-flex;
    gap: 3px;
    margin-left: 2px;
    vertical-align: middle;
  }

  .btn-dot {
    display: block;
    width: 4px;
    height: 4px;
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.7);
    animation: dot-pulse 1.2s ease-in-out infinite;
  }

  .btn-dot:nth-child(2) {
    animation-delay: 0.15s;
  }

  .btn-dot:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes dot-pulse {
    0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
    40% { opacity: 1; transform: scale(1); }
  }

  /* ── Danger button ───────────────────────────────────────── */
  .button-group :global(.btn-danger) {
    font-family: var(--font-sans);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    padding: var(--sp-3) var(--sp-5);
    font-size: 0.875rem;
    font-weight: 500;
    color: #f87171;
    background: rgba(248, 113, 113, 0.06);
    border: 1px solid rgba(248, 113, 113, 0.12);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-out),
                border-color var(--dur-fast) var(--ease-out);
  }

  .button-group :global(.btn-danger:hover) {
    background: rgba(248, 113, 113, 0.1);
    border-color: rgba(248, 113, 113, 0.2);
  }

  .button-group :global(.btn-danger .Trash2) {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
  }

  /* ── History actions ─────────────────────────────────────── */
  .history-actions {
    display: flex;
    gap: var(--sp-3);
    justify-content: center;
    flex-wrap: wrap;
    padding-top: var(--sp-1);
    border-top: 1px solid var(--border-subtle);
    margin-top: var(--sp-2);
  }

  .history-actions :global(.btn-secondary) {
    font-family: var(--font-sans);
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-4);
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-muted);
    background: transparent;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: color var(--dur-fast) var(--ease-out),
                background var(--dur-fast) var(--ease-out),
                border-color var(--dur-fast) var(--ease-out);
  }

  .history-actions :global(.btn-secondary:hover) {
    color: var(--text-secondary);
    background: rgba(255, 255, 255, 0.03);
    border-color: var(--border-default);
  }

  /* ── Screen-reader only ──────────────────────────────────── */
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
