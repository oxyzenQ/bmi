<script lang="ts">
  /**
   * Encryption Modal for Secure Export/Import
   * - Export: Passphrase + Confirm (mandatory)
   * - Import: Passphrase only (auto-detect encrypted file)
   */
  import { untrack } from 'svelte';
  import { Lock, Unlock, AlertCircle, Eye, EyeOff } from 'lucide-svelte';
  import { t as _t, localeVersion } from '$lib/i18n';
  let _rv = $derived($localeVersion);
  function t(key: string, params?: Record<string, string | number | undefined | null>): string { void _rv; return _t(key, params); }

  interface Props {
    show?: boolean;
    mode: 'export' | 'import';
    error?: string;
    onConfirm: (passphrase: string) => void;
    onCancel: () => void;
  }

  let {
    show = false,
    mode,
    error = '',
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

  // Password visibility toggles (separate states for each field)
  let showPassword = $state(false);
  let showConfirmPassword = $state(false);

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
        showPassword = false;
        showConfirmPassword = false;
        modalKey += 1;
      });
      // Trigger animation
      setTimeout(() => { visible = true; }, 60);
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
    }, 100);

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
      </div>

      <form onsubmit={handleSubmit} class="encrypt-form">
        <div class="encrypt-fields">
          <div class="field-group">
            <label for="passphrase">{t('crypto.passphrase_label')}</label>
            <div class="input-wrapper">
              <input
                id="passphrase"
                type={showPassword ? 'text' : 'password'}
                bind:value={passphrase}
                placeholder={t('crypto.passphrase_placeholder')}
                class="encrypt-input"
                autocomplete="new-password"
                disabled={loading}
              />
              <button
                type="button"
                class="eye-btn"
                onclick={() => showPassword = !showPassword}
                aria-label={showPassword ? t('crypto.hide_passphrase') : t('crypto.show_passphrase')}
                tabindex="-1"
              >
                {#if showPassword}
                  <EyeOff size={18} />
                {:else}
                  <Eye size={18} />
                {/if}
              </button>
            </div>
          </div>

          {#if mode === 'export'}
            <div class="field-group">
              <label for="confirm-passphrase">{t('crypto.confirm_label')}</label>
              <div class="input-wrapper">
                <input
                  id="confirm-passphrase"
                  type={showConfirmPassword ? 'text' : 'password'}
                  bind:value={confirmPassphrase}
                  placeholder={t('crypto.confirm_placeholder')}
                  class="encrypt-input"
                  autocomplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  class="eye-btn"
                  onclick={() => showConfirmPassword = !showConfirmPassword}
                  aria-label={showConfirmPassword ? t('crypto.hide_passphrase') : t('crypto.show_passphrase')}
                  tabindex="-1"
                >
                  {#if showConfirmPassword}
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
    background: var(--k-50);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    backdrop-filter: blur(24px) saturate(180%);
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
  }

  .encrypt-backdrop.visible {
    opacity: 1;
    pointer-events: auto;
  }

  .encrypt-box {
    background: var(--k-50);
    border: var(--border-by-rezky);
    border-radius: 20px;
    padding: 2rem;
    min-width: 340px;
    max-width: 90vw;
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    backdrop-filter: blur(24px) saturate(180%);
    box-shadow: 0 25px 50px -12px var(--k-50);
    transform: scale(0.95) translateY(10px);
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .encrypt-backdrop.visible .encrypt-box {
    transform: scale(1) translateY(0);
  }

  .encrypt-header {
    display: flex;
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
    background: none;
    border: none;
    border-radius: 6px;
    color: var(--w-50);
    cursor: pointer;
    transition: all 0.15s ease;
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
    justify-content: flex-end;
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
