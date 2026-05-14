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
    background: var(--w-10);
    border: 1px solid var(--w-20);
    border-radius: 50%;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--w-80);
    cursor: pointer;
    transition: background var(--dur-micro) ease, color var(--dur-micro) ease, transform var(--dur-micro) ease;
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    z-index: var(--z-inner-control);
  }

  .notify-close:hover {
    background: var(--w-15);
    color: var(--stellar-white);
    transform: rotate(90deg) scale(1.1);
    border-color: var(--w-25);
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
    padding: 0.875rem 2rem;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: transform var(--dur-micro) ease, background var(--dur-micro) ease;
    min-width: 160px;
  }

  .btn-success {
    background: linear-gradient(135deg, var(--cat-green-90) 0%, var(--dkgreen-90) 100%);
    color: var(--stellar-white);
    
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    border: 1px solid var(--w-15);
  }

  .btn-success:hover {
    transform: translateY(-2px) scale(1.02);
    
    background: linear-gradient(135deg, var(--cat-green-95) 0%, var(--dkgreen-95) 100%);
  }

  .btn-delete,
  .btn-error {
    background: linear-gradient(135deg, var(--cat-red-90) 0%, var(--darkred-90) 100%);
    color: var(--stellar-white);
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    border: 1px solid var(--w-15);
  }

  .btn-delete:hover,
  .btn-error:hover {
    transform: translateY(-2px) scale(1.02);
    background: linear-gradient(135deg, var(--cat-red-95) 0%, var(--darkred-95) 100%);
  }

  .btn-cancel {
    background: linear-gradient(135deg, var(--cat-red-90) 0%, var(--darkred-90) 100%);
    color: var(--stellar-white);
    
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    border: 1px solid var(--w-15);
  }

  .btn-cancel:hover {
    transform: translateY(-2px) scale(1.02);
    
    background: linear-gradient(135deg, var(--cat-red-95) 0%, var(--darkred-95) 100%);
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
    background: linear-gradient(135deg, var(--cat-amber-90) 0%, var(--dkamber-90) 100%);
    color: var(--stellar-white);
    
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    border: 1px solid var(--w-15);
  }

  .btn-warn:hover {
    transform: translateY(-2px) scale(1.02);
    
    background: linear-gradient(135deg, var(--cat-amber-95) 0%, var(--dkamber-95) 100%);
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
      padding: 0.75rem 1.5rem;
      min-width: 140px;
    }
  }
</style>