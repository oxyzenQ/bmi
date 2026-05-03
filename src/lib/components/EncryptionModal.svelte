<script lang="ts">
  /**
   * Encryption Modal for Secure Export/Import
   * - Export: Passphrase + Confirm (mandatory)
   * - Import: Passphrase only (auto-detect encrypted file)
   */
  import { untrack } from 'svelte';
  import { Lock, Unlock, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-svelte';
  import { t as _t, localeVersion } from '$lib/i18n';
  let _rv = $derived($localeVersion);
  function t(key: string, params?: Record<string, string | number | undefined | null>): string { void _rv; return _t(key, params); }

  interface ImportMeta {
    encrypted: boolean;
    format?: string;
    exportedAt?: string;
    recordCount?: number;
    version?: number;
  }

  interface Props {
    show?: boolean;
    mode: 'export' | 'import';
    error?: string;
    importMeta?: ImportMeta;
    onConfirm: (passphrase: string) => void;
    onCancel: () => void;
  }

  let {
    show = false,
    mode,
    error = '',
    importMeta,
    onConfirm,
    onCancel
  }: Props = $props();

  // Local state - NOT reset via $effect to avoid infinite loops
  let passphrase = $state('');
  let confirmPassphrase = $state('');
  let visible = $state(false);
  let modalKey = $state(0);
  let backdropEl: HTMLDivElement | null = $state(null);
  let localError = $state('');
  let loading = $state(false);
  let focusTrapHandler: ((e: KeyboardEvent) => void) | null = null;

  // Passphrase visibility toggles (separate states for each field)
  let showPassphrase = $state(false);
  let showConfirmPassphrase = $state(false);

  // Passphrase strength
  type StrengthLevel = 'weak' | 'medium' | 'strong';
  let strengthLevel = $derived<StrengthLevel>(computeStrength(passphrase));
  let strengthPercent = $derived(strengthLevel === 'weak' ? 33 : strengthLevel === 'medium' ? 66 : 100);
  let strengthColor = $derived(strengthLevel === 'weak' ? '#ef4444' : strengthLevel === 'medium' ? '#f59e0b' : '#22c55e');

  function computeStrength(pw: string): StrengthLevel {
    if (!pw) return 'weak';
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    if (pw.length >= 12) score++;
    if (score <= 1) return 'weak';
    if (score <= 2) return 'medium';
    return 'strong';
  }

  // Combine local error with parent error prop (reactive)
  let errorMsg = $derived(localError || error);

  // Track previous show value to detect changes without causing reactive loops
  let prevShow = $state(false);

  // Handle modal open/close transition - runs when show changes
  $effect(() => {
    const currentShow = show;
    const wasShown = untrack(() => prevShow);

    if (currentShow && !wasShown) {
      // Modal is opening - reset form state
      untrack(() => {
        passphrase = '';
        confirmPassphrase = '';
        localError = '';
        loading = false;
        showPassphrase = false;
        showConfirmPassphrase = false;
        modalKey += 1;
      });
      // Trigger animation with micro-delay token for smoother UX
      setTimeout(() => { visible = true; }, 120); /* --delay-open */
    } else if (!currentShow && wasShown) {
      // Modal is closing
      visible = false;
    }

    prevShow = currentShow;
  });

  // Handle focus trap when visible changes
  $effect(() => {
    if (!visible || !backdropEl) {
      if (focusTrapHandler) {
        document.removeEventListener('keydown', focusTrapHandler);
        focusTrapHandler = null;
      }
      return;
    }

    // Setup focus trap
    focusTrapHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleCancel();
        return;
      }
      if (e.key !== 'Tab' || !backdropEl) return;

      const focusable = Array.from(
        backdropEl.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex >= 0);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', focusTrapHandler);

    // Auto-focus first input
    setTimeout(() => {
      if (backdropEl) {
        const firstInput = backdropEl.querySelector('input');
        firstInput?.focus();
      }
    }, 120); /* --delay-open */

    return () => {
      if (focusTrapHandler) {
        document.removeEventListener('keydown', focusTrapHandler);
        focusTrapHandler = null;
      }
    };
  });

  function validate(): boolean {
    if (!passphrase.trim()) {
      localError = t('crypto.error_empty');
      return false;
    }
    if (mode === 'export' && passphrase !== confirmPassphrase) {
      localError = t('crypto.error_mismatch');
      return false;
    }
    localError = '';
    return true;
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (loading) return; // prevent double submit
    if (!validate()) return;

    loading = true;
    localError = '';

    try {
      await onConfirm(passphrase);
    } catch (err) {
      localError = err instanceof Error ? err.message : t('form.import_failed');
    } finally {
      loading = false;
    }
  }

  function handleCancel() {
    passphrase = '';
    confirmPassphrase = '';
    localError = '';
    loading = false;
    onCancel();
  }

  const title = $derived(mode === 'export' ? t('crypto.export_title') : t('crypto.import_title'));
  const Icon = $derived(mode === 'export' ? Lock : Unlock);
  const iconColor = $derived(mode === 'export' ? 'var(--cosmic-purple)' : 'var(--cat-green-90)');
</script>

{#if show}
  {#key modalKey}
  <div
    bind:this={backdropEl}
    class="encrypt-backdrop"
    class:visible
    role="dialog"
    aria-modal="true"
  >
    <div class="encrypt-box">
      <div class="encrypt-header">
        <div class="encrypt-icon" style="color: {iconColor}">
          <Icon size={32} strokeWidth={1.5} />
        </div>
        <h2 class="encrypt-title">{title}</h2>
        {#if mode === 'export'}
          <!-- Encryption badge: trust indicator -->
          <div class="bmi-encryption-badge">
            <span class="bmi-encryption-badge__icon"><ShieldCheck size={14} /></span>
            <span class="bmi-encryption-badge__label">{t('crypto.encryption_badge')}</span>
            <span class="bmi-encryption-badge__algo">AES-256-GCM</span>
          </div>
          <div class="bmi-strong-warning">
            <span class="bmi-strong-warning__icon"><AlertCircle size={16} /></span>
            <span class="bmi-strong-warning__text">{t('crypto.strong_warning')}</span>
          </div>
        {/if}
      </div>

      <form onsubmit={handleSubmit} class="encrypt-form">
        {#if mode === 'import' && importMeta}
          <div class="import-meta">
            {#if importMeta.encrypted}
              <div class="meta-row">
                <span class="meta-key">{t('crypto.meta_status')}</span>
                <span class="meta-val meta-encrypted">{t('crypto.meta_encrypted')}</span>
              </div>
            {:else}
              <div class="meta-row">
                <span class="meta-key">{t('crypto.meta_status')}</span>
                <span class="meta-val">{t('crypto.meta_unencrypted')}</span>
              </div>
            {/if}
            {#if importMeta.exportedAt}
              <div class="meta-row">
                <span class="meta-key">{t('crypto.meta_date')}</span>
                <span class="meta-val">{importMeta.exportedAt}</span>
              </div>
            {/if}
            {#if importMeta.recordCount != null}
              <div class="meta-row">
                <span class="meta-key">{t('crypto.meta_records')}</span>
                <span class="meta-val">{importMeta.recordCount}</span>
              </div>
            {/if}
            {#if importMeta.version != null}
              <div class="meta-row">
                <span class="meta-key">{t('crypto.meta_version')}</span>
                <span class="meta-val">v{importMeta.version}</span>
              </div>
            {/if}
          </div>
        {/if}
        <div class="encrypt-fields">
          <!-- Hidden username field to prevent browser password warning -->
          <input type="text" name="username" autocomplete="username" class="sr-only" tabindex="-1" />
          <div class="field-group">
            <label for="passphrase">{t('crypto.passphrase_label')}</label>
            <div class="input-wrapper">
              <input
                id="passphrase"
                type={showPassphrase ? 'text' : 'password'}
                bind:value={passphrase}
                placeholder={t('crypto.passphrase_placeholder')}
                class="encrypt-input"
                autocomplete="new-password"
                disabled={loading}
              />
              <button
                type="button"
                class="eye-btn"
                onclick={() => showPassphrase = !showPassphrase}
                aria-label={showPassphrase ? t('crypto.hide_passphrase') : t('crypto.show_passphrase')}
              >
                {#if showPassphrase}
                  <EyeOff size={18} />
                {:else}
                  <Eye size={18} />
                {/if}
              </button>
            </div>
            {#if passphrase && mode === 'export'}
              <div class="strength-bar-wrap">
                <div class="strength-bar">
                  <div class="strength-fill" style="width: {strengthPercent}%; background: {strengthColor};"></div>
                </div>
                <span class="strength-label" style="color: {strengthColor};">
                  {strengthLevel === 'weak' ? t('crypto.strength_weak') : strengthLevel === 'medium' ? t('crypto.strength_medium') : t('crypto.strength_strong')}
                </span>
              </div>
              <p class="strength-hint">{t('crypto.strength_hint')}</p>
            {/if}
          </div>

          {#if mode === 'export'}
            <div class="field-group">
              <label for="confirm-passphrase">{t('crypto.confirm_label')}</label>
              <div class="input-wrapper">
                <input
                  id="confirm-passphrase"
                  type={showConfirmPassphrase ? 'text' : 'password'}
                  bind:value={confirmPassphrase}
                  placeholder={t('crypto.confirm_placeholder')}
                  class="encrypt-input"
                  autocomplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  class="eye-btn"
                  onclick={() => showConfirmPassphrase = !showConfirmPassphrase}
                  aria-label={showConfirmPassphrase ? t('crypto.hide_passphrase') : t('crypto.show_passphrase')}
                >
                  {#if showConfirmPassphrase}
                    <EyeOff size={18} />
                  {:else}
                    <Eye size={18} />
                  {/if}
                </button>
              </div>
            </div>
          {/if}
        </div>

        {#if errorMsg}
          <div class="encrypt-error">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        {/if}

        <div class="encrypt-actions">
          <button type="button" class="encrypt-btn btn-cancel" onclick={handleCancel} disabled={loading}>
            {t('notify.cancel')}
          </button>
          <button type="submit" class="encrypt-btn btn-confirm" disabled={loading}>
            {#if loading}
              <span class="btn-spinner"></span>
              {t('crypto.processing')}
            {:else}
              {mode === 'export' ? t('form.export') : t('crypto.unlock_import')}
            {/if}
          </button>
          {#if loading}
            <div class="bmi-progress bmi-progress--indeterminate">
              <div class="bmi-progress__fill" style="width: 100%;"></div>
            </div>
          {/if}
          {#if mode === 'export' && !loading}
            <!-- Export summary preview -->
            <div class="bmi-export-summary">
              <div class="bmi-export-summary__row">
                <span class="bmi-export-summary__key">{t('crypto.export_summary_records')}</span>
                <span class="bmi-export-summary__val">...</span>
              </div>
              <div class="bmi-export-summary__row">
                <span class="bmi-export-summary__key">{t('crypto.export_summary_encrypted')}</span>
                <span class="bmi-export-summary__val bmi-export-summary__val--encrypted">AES-256-GCM</span>
              </div>
              <div class="bmi-export-summary__row">
                <span class="bmi-export-summary__key">{t('crypto.export_summary_version')}</span>
                <span class="bmi-export-summary__val">v1</span>
              </div>
            </div>
          {/if}
        </div>
      </form>
    </div>
  </div>
  {/key}
{/if}

<style>
  .encrypt-backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--cosmic-dark-82, rgba(10, 2, 28, 0.82));
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    backdrop-filter: blur(24px) saturate(180%);
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
    /* Ensure full viewport coverage on mobile */
    min-height: 100vh;
    min-height: 100dvh;
    min-width: 100vw;
  }

  .encrypt-backdrop.visible {
    opacity: 1;
    pointer-events: auto;
  }

  /* iOS Safari: stronger blur for mobile */
  @supports (-webkit-touch-callout: none) {
    .encrypt-backdrop {
      -webkit-backdrop-filter: blur(32px) saturate(200%);
      backdrop-filter: blur(32px) saturate(200%);
      background: var(--cosmic-dark-92, rgba(10, 2, 28, 0.92));
    }
  }

  .encrypt-box {
    background: var(--k-50);
    border: var(--border-by-rezky);
    border-radius: var(--radius-lg);
    padding: 2rem;
    min-width: 340px;
    max-width: 90vw;
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    backdrop-filter: blur(24px) saturate(180%);
    box-shadow: 0 25px 50px -12px var(--k-50);
    animation: modalIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  @keyframes modalIn {
    from {
      opacity: 0;
      transform: scale(0.96) translateY(8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .encrypt-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .encrypt-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .encrypt-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--w-95);
    margin: 0;
  }

  .encrypt-fields {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .import-meta {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    background: var(--w-8);
    border: 1px solid var(--w-15);
    border-radius: 10px;
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
  }

  .meta-key {
    color: var(--w-50);
    font-weight: 500;
  }

  .meta-val {
    color: var(--w-80);
    font-weight: 600;
  }

  .meta-encrypted {
    color: var(--cosmic-purple);
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .field-group label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--w-70);
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .encrypt-input {
    width: 100%;
    padding: 0.75rem 1rem;
    padding-right: 2.75rem;
    font-size: 0.95rem;
    border: 1px solid var(--w-20);
    border-radius: 10px;
    background: var(--w-4);
    color: var(--w-95);
    transition: border-color 0.15s ease;
  }

  .eye-btn {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    transition: all 0.15s ease;
    z-index: 10;
  }

  /* Fix: ensure SVG icons render correctly - WHITE color for dark modal */
  .eye-btn :global(svg) {
    width: 18px !important;
    height: 18px !important;
    display: block !important;
    visibility: visible !important;
    stroke: white !important;
    stroke-width: 2;
    fill: none;
    flex-shrink: 0;
    overflow: visible;
  }

  .eye-btn:hover {
    color: var(--w-80);
    background: var(--w-10);
  }

  .eye-btn:active {
    transform: translateY(-50%) scale(0.95);
  }

  .encrypt-input:focus {
    outline: none;
    border-color: var(--cosmic-purple);
  }

  .encrypt-input::placeholder {
    color: var(--w-40);
  }

  .strength-bar-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .strength-bar {
    flex: 1;
    height: 4px;
    background: var(--w-15);
    border-radius: 2px;
    overflow: hidden;
  }

  .strength-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease, background 0.3s ease;
  }

  .strength-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  .strength-hint {
    font-size: 0.8rem;
    color: var(--w-60);
    margin-top: 0.5rem;
    line-height: 1.5;
    font-weight: 400;
  }

  .encrypt-error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    margin-bottom: 1.25rem;
    background: var(--darkred-10);
    border: 1px solid var(--darkred-30);
    border-radius: 8px;
    color: #ef4444;
    font-size: 0.85rem;
  }

  .encrypt-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }

  .encrypt-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    font-size: 0.9rem;
    font-weight: 600;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    min-width: 100px;
  }

  .btn-cancel {
    background: var(--w-10);
    color: var(--w-80);
    border: 1px solid var(--w-20);
  }

  .btn-cancel:hover {
    background: var(--w-15);
    color: white;
  }

  .btn-confirm {
    background: var(--cosmic-purple);
    color: white;
    border: 1px solid var(--cosmic-purple);
  }

  .btn-confirm:hover {
    filter: brightness(1.15);
    transform: translateY(-1px);
  }

  .btn-confirm:disabled,
  .btn-cancel:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .encrypt-input:disabled {
    opacity: 0.5;
    background: var(--w-8);
  }

  .btn-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-right: 6px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 480px) {
    .encrypt-box {
      min-width: auto;
      width: calc(100vw - 2rem);
      margin: 0 1rem;
      padding: 1.5rem;
    }

    .encrypt-title {
      font-size: 1.1rem;
    }

    .encrypt-actions {
      flex-direction: column;
    }

    .encrypt-btn {
      width: 100%;
    }
  }
</style>
