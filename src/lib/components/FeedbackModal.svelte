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
    box-shadow: 0 25px 50px -12px var(--k-50);
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
    padding: var(--space-3) 2rem;
    font-size: var(--text-md);
    font-weight: 500;
    border-radius: var(--btn-radius);
    cursor: pointer;
    transition: all var(--dur-micro) ease;
    border: none;
    min-width: 120px;
  }

  .feedback-btn.success {
    background: var(--cat-green-90);
    color: white;
  }

  .feedback-btn.success:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  .feedback-btn.error {
    background: var(--error-color, #ef4444);
    color: white;
  }

  .feedback-btn.error:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }
</style>
