<script lang="ts">
  /**
   * Feedback Modal - Blocking feedback for success/error states
   * Used AFTER encryption modal closes to show explicit confirmation.
   *
   * Phase 4: Refactored to use ModalShell (shared modal infrastructure).
   * Eliminates duplicated focus-trap, backdrop animation, and responsive CSS.
   */
  import { CheckCircle, XCircle } from 'lucide-svelte';
  import ModalShell from './ModalShell.svelte';
  import { t as _t, localeVersion } from '$lib/i18n';
  let _rv = $derived($localeVersion);
  function t(key: string, params?: Record<string, string | number | undefined | null>): string { void _rv; return _t(key, params); }

  interface Props {
    show?: boolean;
    type?: 'success' | 'error';
    title?: string;
    message: string;
    onClose: () => void;
  }

  let {
    show = false,
    type = 'success',
    title = '',
    message,
    onClose
  }: Props = $props();

  const Icon = $derived(type === 'success' ? CheckCircle : XCircle);
  const iconColor = $derived(type === 'success' ? 'var(--cat-green-90)' : 'var(--error-color, #ef4444)');
  const defaultTitle = $derived(type === 'success' ? t('notify.success_title') : t('notify.error_title'));
  const displayTitle = $derived(title || defaultTitle);
</script>

<ModalShell
  {show}
  onclose={onClose}
  closeOnEscape={true}
  closeOnEnter={true}
  closeOnBackdropClick={true}
  backdropBlur="24px"
  backdropSat="140%"
  panelMinWidth="320px"
  panelClass="feedback-box"
  backdropClass="feedback-shell"
  zIndex="var(--z-modal-top)"
>
  <div class="feedback-content">
    <div class="feedback-header">
      <div class="feedback-icon" style:color={iconColor}>
        <Icon size={48} />
      </div>
      <h3 class="feedback-title">{displayTitle}</h3>
    </div>

    <p class="feedback-message">{message}</p>

    <div class="feedback-actions">
      <button
        type="button"
        class="feedback-btn"
        class:success={type === 'success'}
        class:error={type === 'error'}
        data-ok-button
        onclick={onClose}
      >
        {t('notify.ok')}
      </button>
    </div>
  </div>
</ModalShell>

<style>
  .feedback-content {
    text-align: center;
    max-width: min(400px, 90vw);
    width: 100%;
  }

  /* Override ModalShell panel styles for feedback-specific appearance */
  :global(.feedback-box) {
    background: var(--k-50);
    
  }

  .feedback-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-bottom: var(--space-5);
  }

  .feedback-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: var(--space-3);
  }

  .feedback-title {
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--w-95);
    margin: 0 0 var(--space-2) 0;
  }

  .feedback-message {
    font-size: var(--text-md);
    color: var(--w-70);
    line-height: 1.5;
    margin: 0 0 var(--space-5) 0;
    opacity: 0.85;
  }

  .feedback-actions {
    display: flex;
    justify-content: center;
    width: 100%;
  }

  .feedback-btn {
    padding: 0 2rem;
    height: var(--btn-height);
    font-size: 0.95rem;
    font-weight: 600;
    border-radius: var(--btn-radius);
    cursor: pointer;
    transition: transform var(--dur-micro) ease, background var(--dur-micro) ease, border-color var(--dur-micro) ease;
    border: 1px solid rgba(130, 130, 130, 0.30);
    min-width: 120px;
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
  }

  .feedback-btn.success {
    background: linear-gradient(135deg, rgba(5, 46, 22, 0.80), rgba(22, 101, 52, 0.60));
    color: var(--stellar-white);
    border: 1px solid rgba(74, 222, 128, 0.30);
  }

  .feedback-btn.success:hover {
    transform: translateY(-2px);
    background: linear-gradient(135deg, rgba(5, 46, 22, 0.90), rgba(22, 101, 52, 0.70));
    border-color: rgba(74, 222, 128, 0.45);
  }

  .feedback-btn.error {
    background: var(--btn-danger-bg);
    color: var(--stellar-white);
    border: var(--btn-danger-border);
  }

  .feedback-btn.error:hover {
    transform: translateY(-2px);
    background: var(--btn-danger-bg-hover);
    border: var(--btn-danger-border-hover);
  }
</style>