<script lang="ts">
  import { Orbit, User, Ruler, Weight, Zap, Trash2, ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, PersonStanding, Flame, FileSpreadsheet, Settings } from 'lucide-svelte';
  import { exportBmiHistory, exportBmiHistoryCsv, validateBmiImport, importBmiHistory, peekImportMeta, MAX_IMPORT_SIZE, type ImportFileMeta, type ImportError } from '$lib/utils/history-io';
  import { STORAGE_KEYS, storageGetJSON } from '$lib/utils/storage';
  import { warnDev } from '$lib/utils/warn-dev';
  import { tick } from 'svelte';
  import { t as _t, localeVersion } from '$lib/i18n';
  import EncryptionModal from './EncryptionModal.svelte';
  import FeedbackModal from './FeedbackModal.svelte';
  let _rv = $derived($localeVersion);
  // Reactive t() — reading _rv creates a dependency so template {t('key')} re-runs on locale change
  function t(key: string, params?: Record<string, string | number | undefined | null>): string { void _rv; return _t(key, params); }

  type Gender = 'male' | 'female' | '';
  type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | '';

  interface ImportNotifyResult {
    action: 'import-validate' | 'import-error';
    text?: string;
    recordCount?: number;
    integrityVerified?: boolean;
    error?: string;
  }

  interface Props {
    age?: string;
    height?: string;
    weight?: string;
    gender?: Gender;
    activity?: Activity;
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
    gender = $bindable<Gender>(''),
    activity = $bindable<Activity>(''),
    unitSystem = $bindable<'metric' | 'imperial'>('metric'),
    calculating = false,
    onClear,
    onCalculate,
    onNotify
  }: Props = $props();
  // NOTE: Unit system persistence is managed by the parent (+page.svelte)
  // via bind:unitSystem. Do NOT read/write localStorage here — it causes
  // a race condition where child overwrites parent's value on mount.

  // Activity level metadata — reactive so labels update on locale change
  let activityLevels = $derived([
    { value: 'sedentary' as Activity, label: t('form.sedentary'), factor: 1.2 },
    { value: 'light' as Activity, label: t('form.light'), factor: 1.375 },
    { value: 'moderate' as Activity, label: t('form.moderate'), factor: 1.55 },
    { value: 'active' as Activity, label: t('form.active'), factor: 1.725 },
    { value: 'very_active' as Activity, label: t('form.very_active'), factor: 1.9 }
  ]);

  // Derived unit-specific labels, placeholders, and validation bounds
  let heightLabel = $derived(unitSystem === 'metric' ? t('form.height_metric') : t('form.height_imperial'));
  let weightLabel = $derived(unitSystem === 'metric' ? t('form.weight_metric') : t('form.weight_imperial'));
  let heightExample = $derived(unitSystem === 'metric' ? t('form.height_placeholder_metric') : t('form.height_placeholder_imperial'));
  let weightExample = $derived(unitSystem === 'metric' ? t('form.weight_placeholder_metric') : t('form.weight_placeholder_imperial'));
  let heightAriaLabel = $derived(unitSystem === 'metric' ? t('form.height_aria_metric') : t('form.height_aria_imperial'));
  let weightAriaLabel = $derived(unitSystem === 'metric' ? t('form.weight_aria_metric') : t('form.weight_aria_imperial'));
  let heightErrorText = $derived(
    unitSystem === 'metric' ? t('form.height_error_metric') : t('form.height_error_imperial')
  );
  let weightErrorText = $derived(
    unitSystem === 'metric' ? t('form.weight_error_metric') : t('form.weight_error_imperial')
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
  let fileInputEl: HTMLInputElement | null = $state(null);

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


  // Encryption modal state
  let showEncryptModal = $state(false);
  let encryptModalMode = $state<'export' | 'import'>('export');
  let encryptError = $state('');
  let encryptErrorCode = $state<string | undefined>(undefined);
  let pendingImportText = $state('');
  let pendingImportMeta = $state<ImportFileMeta | undefined>(undefined);
  let exportRecordCount = $state(0);

  // Staging spinner overlay (shown before/after modal transitions)
  let stagingLoading = $state(false);
  const STAGING_DELAY = 1500;
  const STAGING_POST_DELAY = 800;

  // Feedback modal state (blocking confirmation)
  let showFeedbackModal = $state(false);
  let feedbackType = $state<'success' | 'error'>('success');
  let feedbackMessage = $state('');

  /**
   * Svelte action: portal the element to document.body.
   * Escapes ancestor containing-block created by backdrop-filter / transform.
   */
  function portal(node: HTMLElement): { destroy(): void } {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      }
    };
  }

  function formatDate(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async function handleExportClick() {
    // Read current history count from storage for export summary
    const history = storageGetJSON<Array<unknown>>(STORAGE_KEYS.HISTORY, []);
    exportRecordCount = Array.isArray(history) ? history.length : 0;
    encryptModalMode = 'export';
    encryptError = '';
    encryptErrorCode = undefined;

    // Show staging spinner before opening modal
    stagingLoading = true;
    await tick();
    await new Promise(r => setTimeout(r, STAGING_DELAY));
    stagingLoading = false;

    showEncryptModal = true;
  }

  async function handleExportConfirm(passphrase: string) {
    const json = await exportBmiHistory(passphrase);
    if (!json) {
      encryptError = t('crypto.export_failed');
      return;
    }
    showEncryptModal = false;

    // Brief staging spinner after export completes
    stagingLoading = true;
    await tick();
    await new Promise(r => setTimeout(r, STAGING_POST_DELAY));
    stagingLoading = false;

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

  function handleExportCsv() {
    const csv = exportBmiHistoryCsv();
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bmi-history-${formatDate()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    // Open file picker directly — browser requires synchronous call within
    // user gesture. Spinner shows AFTER dialog closes (in handleFileInputChange
    // → handleFileChange via await tick()).
    fileInputEl?.click();
  }

  function processFile(file: File) {
    // Reuse the existing file processing logic
    const fakeEvent = { target: { files: [file] } } as unknown as Event;
    handleFileChange(fakeEvent);
  }

  function handleDropZoneClick() {
    // Same as handleImportClick — spinner shows after dialog closes.
    fileInputEl?.click();
  }

  function handleFileInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      // File selected — show spinner during processing.
      // handleFileChange will call await tick() first so the DOM
      // actually renders the gear overlay before any heavy work.
      stagingLoading = true;
      processFile(file);
    }
    input.value = ''; // Reset so same file can be re-selected
  }

  /** Map ImportError code → i18n key for user-friendly FeedbackModal message */
  function importErrorKey(code: ImportError): string {
    const map: Record<ImportError, string> = {
      empty_file: 'history.empty_file',
      file_too_large: 'history.file_too_large',
      invalid_json: 'history.invalid_json',
      invalid_format: 'history.invalid_format',
      unsupported_version: 'history.unsupported_version',
      encrypted_no_passphrase: 'history.encrypted_no_passphrase',
      wrong_passphrase: 'history.wrong_passphrase',
      corrupted_file: 'history.corrupted_file',
      no_valid_records: 'history.no_valid_records',
      integrity_failed: 'history.integrity_failed',
      save_failed: 'history.save_failed',
    };
    return map[code] ?? 'form.import_failed';
  }

  async function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // ── File size guards ──
    if (file.size === 0) {
      stagingLoading = false;
      onNotify?.({
        action: 'import-error',
        error: t('history.empty_file')
      });
      return;
    }
    if (file.size > MAX_IMPORT_SIZE) {
      stagingLoading = false;
      onNotify?.({
        action: 'import-error',
        error: t('history.file_too_large')
      });
      return;
    }

    try {
      // Let the browser render the staging spinner overlay before
      // doing any async I/O (file.text, crypto import, validation).
      await tick();
      const text = await file.text();

      // Check if file is encrypted
      const { isEncrypted } = await import('$lib/utils/crypto');
      if (isEncrypted(text)) {
        pendingImportText = text;
        pendingImportMeta = peekImportMeta(text);
        encryptModalMode = 'import';
        encryptError = '';
        encryptErrorCode = undefined;

        // Show staging spinner before opening modal
        stagingLoading = true;
        await tick();
        await new Promise(r => setTimeout(r, STAGING_DELAY));
        stagingLoading = false;

        showEncryptModal = true;
        return;
      }

      // Normal unencrypted validation
      const validation = await validateBmiImport(text);

      if (validation.valid && validation.recordCount) {
        stagingLoading = false;
        onNotify?.({
          action: 'import-validate',
          text,
          recordCount: validation.recordCount,
          integrityVerified: validation.integrityVerified ?? false
        });
      } else {
        // Notify parent to show error via NotifyFloat (single source of truth)
        stagingLoading = false;
        const code = validation.errorCode ?? 'invalid_format';
        onNotify?.({
          action: 'import-error',
          error: t(importErrorKey(code))
        });
      }
    } catch (err) {
      // Notify parent to show error via NotifyFloat
      warnDev('BmiForm', 'handleImport', 'Import processing failed unexpectedly', err);
      stagingLoading = false;
      onNotify?.({
        action: 'import-error',
        error: t('form.could_not_read')
      });
    }
  }

  async function handleImportConfirm(passphrase: string) {
    // Guard: prevent duplicate modal triggers
    if (showFeedbackModal) return;

    // Import with passphrase - will decrypt if needed
    const result = await importBmiHistory(pendingImportText, passphrase);

    if (result.success) {
      // Close encryption modal first
      showEncryptModal = false;
      pendingImportText = '';
      pendingImportMeta = undefined;
      encryptError = '';
      encryptErrorCode = undefined;

      // Brief staging spinner after import completes
      stagingLoading = true;
      await tick();
      await new Promise(r => setTimeout(r, STAGING_POST_DELAY));
      stagingLoading = false;

      // Show success feedback modal (blocking)
      feedbackType = 'success';
      feedbackMessage = t('history.import_success', { count: result.count });
      showFeedbackModal = true;

      // Also notify parent for any additional UI updates
      onNotify?.({
        action: 'import-validate',
        text: '',
        recordCount: result.count,
        integrityVerified: result.integrityVerified ?? false
      });
    } else {
      // Show error inline in EncryptionModal for immediate retry
      const code = result.errorCode ?? 'invalid_format';
      encryptError = t(importErrorKey(code));
      encryptErrorCode = code;
      return;
    }
  }

  function handleFeedbackClose() {
    showFeedbackModal = false;
    feedbackMessage = '';
  }

  function handleModalCancel() {
    showEncryptModal = false;
    pendingImportText = '';
    pendingImportMeta = undefined;
    encryptError = '';
    encryptErrorCode = undefined;
  }

  // ── Drag & Drop import (Phase 4: UX Upgrade) ──
  let isDragOver = $state(false);

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.types.includes('Files')) {
      isDragOver = true;
    }
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragOver = false;
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    processImportFile(file);
  }

  function processImportFile(file: File) {
    if (file.size === 0) {
      onNotify?.({ action: 'import-error', error: t('history.empty_file') });
      return;
    }
    if (file.size > MAX_IMPORT_SIZE) {
      onNotify?.({ action: 'import-error', error: t('history.file_too_large') });
      return;
    }
    // Reuse the existing file processing logic
    const fakeEvent = { target: { files: [file] } } as unknown as Event;
    handleFileChange(fakeEvent);
  }
</script>
<div class="form-inner">
  <div class="card-header">
    <div class="icon-container">
      <Orbit class="Orbit" />
    </div>
    <h2 class="card-title">{t('form.title')}</h2>

    <div class="status-row">
      <span
        class="pill-indicator"
        tabindex="0"
        role="button"
        aria-label={canCalculate ? t('form.ready_aria') : t('form.incomplete_aria')}
        data-color={canCalculate ? 'green' : 'grey'}
      >
        <span class="dot" aria-hidden="true"></span>
        {canCalculate ? t('form.ready') : t('form.enter_all')}
      </span>
    </div>
  </div>

  <div class="unit-toggle" role="radiogroup" aria-label={t('form.unit_system_aria')}>
    <button
      type="button"
      class="unit-toggle-segment"
      class:active={unitSystem === 'metric'}
      role="radio"
      aria-checked={unitSystem === 'metric'}
      onclick={() => { unitSystem = 'metric'; height = ''; weight = ''; }}
    >
      <ArrowLeftRight size={14} aria-hidden="true" />
      {t('form.metric')}
    </button>
    <button
      type="button"
      class="unit-toggle-segment"
      class:active={unitSystem === 'imperial'}
      role="radio"
      aria-checked={unitSystem === 'imperial'}
      onclick={() => { unitSystem = 'imperial'; height = ''; weight = ''; }}
    >
      {t('form.imperial')}
    </button>
  </div>

  <div class="bmi-form">
    <div class="input-group">
      <label for="age" class="input-label">
        <User class="User" />
        {t('form.age_label')}
      </label>
      <input
        type="text"
        id="age"
        bind:this={ageInputEl}
        bind:value={age}
        class="form-input"
        inputmode="numeric"
        pattern="[0-9]*"
        placeholder={t('form.age_placeholder')}
        aria-label={t('form.age_aria')}
        aria-invalid={age !== '' && !ageValid}
        oninput={handleAgeInput}
      />
      {#if age !== '' && !ageValid}
        <div class="input-error" role="alert">{t('form.age_error')}</div>
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
        placeholder={ageValid ? heightExample : t('form.enter_age_first')}
        aria-label={heightAriaLabel}
        aria-invalid={height !== '' && !heightValid}
        disabled={!ageValid}
        aria-disabled={!ageValid}
        onfocus={() => {
          if (!ageValid) {
            // On touch devices, don't steal focus — just show the disabled state
            // to avoid keyboard flash/jank from focus redirect
            if (!window.matchMedia('(hover: none)').matches) {
              ageInputEl?.focus();
            }
          }
        }}
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
        placeholder={heightValid ? weightExample : t('form.enter_height_first')}
        aria-label={weightAriaLabel}
        aria-invalid={weight !== '' && !weightValid}
        disabled={!heightValid}
        aria-disabled={!heightValid}
        onfocus={() => {
          if (!heightValid) {
            if (!window.matchMedia('(hover: none)').matches) {
              heightInputEl?.focus();
            }
          }
        }}
        oninput={handleWeightInput}
      />
      {#if weight !== '' && !weightValid}
        <div class="input-error" role="alert">{weightErrorText}</div>
      {/if}
    </div>

    <!-- Optional: Gender toggle -->
    <div class="input-group">
      <label class="input-label">
        <PersonStanding size={16} />
        {t('form.gender')} <span class="optional-tag">{t('form.optional')}</span>
      </label>
      <div class="segmented-control" role="radiogroup" aria-label={t('form.gender_aria')}>
        <button
          type="button"
          class="seg-btn"
          class:seg-active={gender === 'male'}
          role="radio"
          aria-checked={gender === 'male'}
          onclick={() => { gender = gender === 'male' ? '' : 'male'; }}
        >
          {t('form.male')}
        </button>
        <button
          type="button"
          class="seg-btn"
          class:seg-active={gender === 'female'}
          role="radio"
          aria-checked={gender === 'female'}
          onclick={() => { gender = gender === 'female' ? '' : 'female'; }}
        >
          {t('form.female')}
        </button>
      </div>
    </div>

    <!-- Optional: Activity level -->
    <div class="input-group">
      <label class="input-label">
        <Flame size={16} />
        {t('form.activity')} <span class="optional-tag">{t('form.optional')}</span>
      </label>
      <div class="activity-grid" role="radiogroup" aria-label={t('form.activity_aria')}>
        {#each activityLevels as lvl (lvl.value)}
          <button
            type="button"
            class="act-btn"
            class:act-active={activity === lvl.value}
            role="radio"
            aria-checked={activity === lvl.value}
            onclick={() => { activity = activity === lvl.value ? '' : lvl.value; }}
          >
            <span class="act-label">{lvl.label}</span>
            <span class="act-factor">{lvl.factor}x</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="button-group">
      <button
        type="button"
        onclick={handleCalculate}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCalculate()}
        class="btn btn-primary"
        class:is-calculating={calculating}
        aria-label={t('form.calculate_aria')}
        aria-disabled={!canCalculate || calculating}
        aria-busy={calculating}
        disabled={!canCalculate || calculating}
      >
        <Zap class="Zap" />
        {#if calculating}
          {t('form.calculating')}
          <span class="btn-dots" aria-hidden="true">
            <span class="btn-dot"></span>
            <span class="btn-dot"></span>
            <span class="btn-dot"></span>
          </span>
        {:else}
          {t('form.calc_bmi')}
        {/if}
      </button>

      <button
        type="button"
        onclick={handleClear}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClear()}
        class="btn btn-danger"
        aria-label={t('form.clear_aria')}
      >
        <Trash2 class="Trash2" />
        {t('form.clear_all')}
      </button>
    </div>

    <!-- Drag & Drop import zone (Phase 4) -->
    <input
      type="file"
      accept=".json"
      bind:this={fileInputEl}
      onchange={handleFileInputChange}
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
    />
    <div
      class="bmi-drop-zone"
      class:bmi-drop-zone--active={isDragOver}
      role="button"
      tabindex="0"
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
      onclick={handleDropZoneClick}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleDropZoneClick()}
      aria-label={t('form.import_aria')}
    >
      <div class="bmi-drop-zone__icon">
        <ArrowDownToLine size={28} />
      </div>
      <div class="bmi-drop-zone__text">{isDragOver ? t('form.drop_file_here') : t('form.import')}</div>
      <div class="bmi-drop-zone__subtext">{t('form.or_choose_file')}</div>
    </div>

    <div class="history-actions">
      <button type="button" class="btn btn-secondary" onclick={handleExportClick} aria-label={t('form.export_aria')}>
        <ArrowUpFromLine size={16} aria-hidden="true" />
        {t('form.export')}
      </button>
      <button type="button" class="btn btn-secondary" onclick={handleExportCsv} aria-label={t('form.export_csv_aria')}>
        <FileSpreadsheet size={16} aria-hidden="true" />
        {t('form.export_csv')}
      </button>
    </div>

  </div>
</div>

<!-- Modals: Portal to body to avoid parent transform issues -->
{#if stagingLoading}
  <div use:portal class="modal-portal">
    <div class="staging-backdrop staging-visible">
      <div class="staging-spinner-wrap">
        <Settings class="staging-gear-icon" size={48} />
        <span class="staging-text">{t('crypto.preparing')}</span>
      </div>
    </div>
  </div>
{/if}

{#if showEncryptModal}
  <div use:portal class="modal-portal">
    <EncryptionModal
      show={showEncryptModal}
      mode={encryptModalMode}
      error={encryptError}
      errorCode={encryptErrorCode}
      importMeta={encryptModalMode === 'import' ? pendingImportMeta : undefined}
      exportRecordCount={encryptModalMode === 'export' ? exportRecordCount : undefined}
      onConfirm={encryptModalMode === 'export' ? handleExportConfirm : handleImportConfirm}
      onCancel={handleModalCancel}
    />
  </div>
{/if}

{#if showFeedbackModal}
  <div use:portal class="modal-portal">
    <FeedbackModal
      show={showFeedbackModal}
      type={feedbackType}
      message={feedbackMessage}
      onClose={handleFeedbackClose}
    />
  </div>
{/if}

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
    color: var(--w-50);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    transition: background 0.2s ease, color 0.2s ease;
    white-space: nowrap;
  }

  .unit-toggle-segment:hover {
    color: var(--w-70);
  }

  .unit-toggle-segment.active {
    background: var(--cosmic-purple);
    color: white;
  }

  /* Segmented control (gender) */
  .segmented-control {
    display: flex;
    justify-content: center;
    gap: 2px;
    border: var(--btn-border);
    border-radius: 9999px;
    padding: 2px;
    width: fit-content;
    max-width: 320px;
  }

  .seg-btn {
    flex: 1;
    font-size: 0.8rem;
    padding: 0.35rem 0.8rem;
    border: none;
    border-radius: 9999px;
    background: transparent;
    color: var(--w-50);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    transition: background 0.2s ease, color 0.2s ease;
    white-space: nowrap;
    min-width: 80px;
  }

  .seg-btn:hover {
    color: var(--w-70);
  }

  .seg-btn.seg-active {
    background: var(--cosmic-purple);
    color: white;
  }

  .optional-tag {
    font-size: 0.65rem;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.7;
  }

  /* Activity level grid */
  .activity-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.35rem;
    width: 100%;
    max-width: 320px;
    border: var(--btn-border);
    border-radius: 0.75rem;
    padding: 3px;
    background: var(--sd-55);
  }

  @media (max-width: 380px) {
    .activity-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .act-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    padding: 0.4rem 0.25rem;
    border: none;
    border-radius: 0.55rem;
    background: transparent;
    color: var(--w-50);
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease;
    white-space: nowrap;
  }

  .act-btn:hover {
    color: var(--w-70);
    background: var(--w-4);
  }

  .act-btn.act-active {
    background: var(--cosmic-purple);
    color: white;
  }

  .act-label {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .act-factor {
    font-size: 0.55rem;
    font-family: var(--font-mono-short);
    opacity: 0.6;
  }

  .act-btn.act-active .act-factor {
    opacity: 0.8;
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
</style>
