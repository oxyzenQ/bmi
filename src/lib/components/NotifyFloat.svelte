<script lang="ts">
  /**
   * NotifyFloat — Blocking notification dialog.
   *
   * v18.0: Migrated to use ModalShell for consistent backdrop, focus trap,
   * Escape handling, and spring animation. Eliminates ~80 lines of duplicated
   * modal infrastructure code.
   *
   * NotifyFloat manages its own show/visible state transitions to support
   * re-opening with different content while already mounted (e.g., import
   * flow: warn → success).
   */
  import { onMount, untrack, onDestroy } from 'svelte';
  import { CheckCircle, Trash2, X, ShieldAlert } from 'lucide-svelte';
  import { COLORS } from '$lib/utils/bmi-category';
  import { t as _t, localeVersion } from '$lib/i18n';
  import ModalShell from './ModalShell.svelte';
  let _rv = $derived($localeVersion);
  // Reactive t() — reading _rv creates a dependency so template {t('key')} re-runs on locale change
  function t(key: string, params?: Record<string, string | number | undefined | null>): string { void _rv; return _t(key, params); }

  interface Props {
    show?: boolean;
    type?: 'success' | 'delete' | 'warn' | 'error';
    message?: string;
    buttonText?: string;
    onContinue?: () => void;
    onClose?: () => void;
    onCancel?: () => void;
  }

  let {
    show = false,
    type = 'success',
    message = '',
    buttonText = t('notify.continue'),
    onContinue = () => {},
    onClose = () => {},
    onCancel = () => {}
  }: Props = $props();

  let shellVisible = $state(false);
  let mounted = $state(false);
  let actionTimer: ReturnType<typeof setTimeout> | null = null;

  onDestroy(() => {
    if (actionTimer) clearTimeout(actionTimer);
  });

  // Effect handles three triggers:
  //   1. show: false → true (open)
  //   2. type or message change while show is true (content change)
  //   3. mounted: false → true while show is true (mount race condition)
  $effect(() => {
    if (!mounted) return;

    if (!show) {
      shellVisible = false;
      return;
    }

    // Track type and message so content changes re-trigger animation
    void type;
    void message;

    shellVisible = false;

    const timer = setTimeout(() => { shellVisible = true; }, 60);
    return () => { clearTimeout(timer); };
  });

  onMount(() => {
    mounted = true;
    return () => {
      if (actionTimer) clearTimeout(actionTimer);
    };
  });

  function handleModalClose() {
    shellVisible = false;
    if (actionTimer) clearTimeout(actionTimer);
    actionTimer = setTimeout(() => {
      onClose();
      actionTimer = null;
    }, 200);
  }

  function handleContinue() {
    shellVisible = false;
    if (actionTimer) clearTimeout(actionTimer);
    actionTimer = setTimeout(() => {
      onContinue();
      actionTimer = null;
    }, 200);
  }

  function handleCancel() {
    shellVisible = false;
    if (actionTimer) clearTimeout(actionTimer);
    actionTimer = setTimeout(() => {
      onCancel();
      actionTimer = null;
    }, 200);
  }

  const Icon = $derived(
    type === 'success' ? CheckCircle :
    type === 'warn' ? ShieldAlert :
    type === 'error' ? X :
    Trash2
  );
  const iconColor = $derived(
    type === 'success' ? COLORS.GREEN :
    type === 'warn' ? COLORS.AMBER :
    type === 'error' ? COLORS.RED :
    COLORS.RED
  );
  const buttonClass = $derived(
    type === 'success' ? 'btn-success' :
    type === 'warn' ? 'btn-warn' :
    type === 'error' ? 'btn-error' :
    'btn-delete'
  );
</script>

<ModalShell
  show={shellVisible}
  closeOnEscape={true}
  closeOnBackdropClick={false}
  backdropBlur="24px"
  backdropSat="180%"
  onclose={handleModalClose}
  panelClass="notify-float-box"
>
  <button class="notify-close" onclick={handleModalClose} aria-label={t('notify.close_aria')}>
    <span class="close-icon-text">✕</span>
  </button>

  <div class="notify-icon" style="color: {iconColor}">
    <Icon size={48} strokeWidth={1.5} />
  </div>

  <p class="notify-message">{message}</p>

  {#if type === 'delete' || type === 'warn'}
    <div class="notify-btn-group">
      <button
        class="notify-btn btn-cancel"
        onclick={handleCancel}
      >
        {t('notify.cancel')}
      </button>
      <button
        class="notify-btn {buttonClass}"
        onclick={handleContinue}
      >
        {buttonText}
      </button>
    </div>
  {:else if type === 'error'}
    <button
      class="notify-btn {buttonClass}"
      onclick={handleContinue}
    >
      {buttonText || t('notify.ok')}
    </button>
  {:else}
    <button
      class="notify-btn {buttonClass}"
      onclick={handleContinue}
    >
      {buttonText}
    </button>
  {/if}
</ModalShell>

<style>
  /* Panel override — NotifyFloat uses its own glass styling, not ModalShell's default */
  :global(.notify-float-box) {
    background: var(--k-50) !important;
    text-align: center;
    padding: 2rem;
  }

  .notify-close {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    background: var(--btn-bg);
    border: 1px solid rgba(130, 130, 130, 0.30);
    border-radius: 50%;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--w-80);
    cursor: pointer;
    transition: background var(--dur-micro) ease, color var(--dur-micro) ease, transform var(--dur-micro) ease, border-color var(--dur-micro) ease;
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    z-index: var(--z-inner-control);
  }

  .notify-close:hover {
    background: var(--btn-bg-hover);
    color: var(--stellar-white);
    transform: rotate(90deg) scale(1.1);
    border-color: rgba(130, 130, 130, 0.45);
  }

  .close-icon-text {
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 22px;
    font-weight: 400;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: -2px; /* Visual center adjustment */
    color: inherit;
    pointer-events: none;
  }

  .notify-icon {
    margin-bottom: 1.25rem;
    animation: iconPop var(--dur-normal) ease;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .notify-icon :global(svg) {
    display: block;
  }

  @keyframes iconPop {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .notify-message {
    font-size: 1.125rem;
    color: var(--w-95);
    margin: 0 0 1.5rem;
    line-height: 1.5;
    font-weight: 500;
    letter-spacing: -0.01em;
    text-shadow: 0 1px 2px var(--k-20);
  }

  .notify-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0 1.5rem;
    height: var(--btn-height);
    font-size: 0.95rem;
    font-weight: 600;
    border: 1px solid rgba(130, 130, 130, 0.30);
    border-radius: var(--btn-radius);
    cursor: pointer;
    transition: transform var(--dur-micro) ease, background var(--dur-micro) ease, border-color var(--dur-micro) ease;
    min-width: 160px;
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
  }

  .btn-success {
    background: linear-gradient(135deg, rgba(5, 46, 22, 0.80), rgba(22, 101, 52, 0.60));
    color: var(--stellar-white);
    border: 1px solid rgba(74, 222, 128, 0.30);
  }

  .btn-success:hover {
    transform: translateY(-2px) scale(1.02);
    background: linear-gradient(135deg, rgba(5, 46, 22, 0.90), rgba(22, 101, 52, 0.70));
    border-color: rgba(74, 222, 128, 0.45);
  }

  .btn-delete,
  .btn-error {
    background: var(--btn-danger-bg);
    color: var(--stellar-white);
    border: var(--btn-danger-border);
  }

  .btn-delete:hover,
  .btn-error:hover {
    transform: translateY(-2px) scale(1.02);
    background: var(--btn-danger-bg-hover);
    border: var(--btn-danger-border-hover);
  }

  .btn-cancel {
    background: var(--btn-bg);
    color: var(--stellar-white);
    border: 1px solid rgba(130, 130, 130, 0.30);
  }

  .btn-cancel:hover {
    transform: translateY(-2px) scale(1.02);
    background: var(--btn-bg-hover);
    border-color: rgba(130, 130, 130, 0.45);
  }

  .notify-btn-group {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .notify-btn-group .notify-btn {
    min-width: 120px;
  }

  .btn-warn {
    background: linear-gradient(135deg, rgba(69, 26, 3, 0.80), rgba(146, 64, 14, 0.60));
    color: var(--stellar-white);
    border: 1px solid rgba(245, 158, 11, 0.30);
  }

  .btn-warn:hover {
    transform: translateY(-2px) scale(1.02);
    background: linear-gradient(135deg, rgba(69, 26, 3, 0.90), rgba(146, 64, 14, 0.70));
    border-color: rgba(245, 158, 11, 0.45);
  }

  @media (max-width: 480px) {
    :global(.notify-float-box) {
      padding: 1.5rem;
      min-width: auto;
      width: calc(100vw - 2rem);
      margin: 0 1rem;
    }

    .notify-message {
      font-size: 1rem;
    }

    .notify-btn {
      padding: 0 1.25rem;
      min-width: 140px;
    }
  }

  @media (hover: none) and (pointer: coarse) {
    :global(.notify-float-box) {
      background: rgba(0, 0, 0, 0.80) !important;
      -webkit-backdrop-filter: none !important;
      backdrop-filter: none !important;
      transform: none !important;
      transition: none !important;
      contain: none !important;
    }

    .notify-close,
    .notify-btn,
    .notify-btn:hover,
    .notify-btn:active {
      -webkit-backdrop-filter: none !important;
      backdrop-filter: none !important;
      transition: none !important;
      transform: none !important;
      touch-action: manipulation;
    }
  }
</style>
