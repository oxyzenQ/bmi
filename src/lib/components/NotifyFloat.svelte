<script lang="ts">
  import { onMount, untrack, onDestroy } from 'svelte';
  import { CheckCircle, Trash2, X, ShieldAlert } from 'lucide-svelte';
  import { COLORS } from '$lib/utils/bmi-category';

  interface Props {
    show?: boolean;
    type?: 'success' | 'delete' | 'warn';
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
    buttonText = 'Continue',
    onContinue = () => {},
    onClose = () => {},
    onCancel = () => {}
  }: Props = $props();

  let visible = $state(false);
  let mounted = $state(false);
  let notifyKey = $state(0);
  let actionTimer: ReturnType<typeof setTimeout> | null = null;
  let backdropEl: HTMLDivElement | null = $state(null);
  let focusTrapHandler: ((e: KeyboardEvent) => void) | null = null;

  // B-2: Focus trap + Escape key for accessibility
  function getFocusableElements(): HTMLElement[] {
    if (!backdropEl) return [];
    return Array.from(
      backdropEl.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex >= 0);
  }

  function trapFocus(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
      return;
    }
    if (e.key !== 'Tab') return;

    const focusable = getFocusableElements();
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
  }

  $effect(() => {
    if (visible && backdropEl) {
      // Activate focus trap
      focusTrapHandler = trapFocus;
      document.addEventListener('keydown', focusTrapHandler);

      // Autofocus first button
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        // Slight delay to let animation start
        setTimeout(() => focusable[0].focus(), 100);
      }
    } else {
      // Deactivate focus trap
      if (focusTrapHandler) {
        document.removeEventListener('keydown', focusTrapHandler);
        focusTrapHandler = null;
      }
    }
  });

  onDestroy(() => {
    if (focusTrapHandler) {
      document.removeEventListener('keydown', focusTrapHandler);
    }
    if (actionTimer) clearTimeout(actionTimer);
  });

  // Effect handles three triggers:
  //   1. show: false → true (open)
  //   2. type or message change while show is true (content change)
  //   3. mounted: false → true while show is true (mount race condition)
  // Using untrack on notifyKey to prevent infinite loop (+= reads the value).
  $effect(() => {
    if (!mounted) return;

    if (!show) {
      visible = false;
      return;
    }

    // Track type and message so content changes re-trigger animation
    void type;
    void message;

    visible = false;
    untrack(() => { notifyKey += 1; });

    const timer = setTimeout(() => { visible = true; }, 60);
    return () => { clearTimeout(timer); };
  });

  onMount(() => {
    mounted = true;
    return () => {
      if (actionTimer) clearTimeout(actionTimer);
    };
  });

  function handleContinue() {
    visible = false;
    if (actionTimer) clearTimeout(actionTimer);
    actionTimer = setTimeout(() => {
      onContinue();
      actionTimer = null;
    }, 200);
  }

  function handleCancel() {
    visible = false;
    if (actionTimer) clearTimeout(actionTimer);
    actionTimer = setTimeout(() => {
      onCancel();
      actionTimer = null;
    }, 200);
  }

  function handleClose() {
    visible = false;
    if (actionTimer) clearTimeout(actionTimer);
    actionTimer = setTimeout(() => {
      onClose();
      actionTimer = null;
    }, 200);
  }

  const Icon = $derived(
    type === 'success' ? CheckCircle :
    type === 'warn' ? ShieldAlert :
    Trash2
  );
  const iconColor = $derived(
    type === 'success' ? COLORS.GREEN :
    type === 'warn' ? COLORS.AMBER :
    COLORS.RED
  );
  const buttonClass = $derived(
    type === 'success' ? 'btn-success' :
    type === 'warn' ? 'btn-warn' :
    'btn-delete'
  );
</script>

{#if show}
  {#key notifyKey}
  <div
    bind:this={backdropEl}
    class="notify-backdrop"
    class:visible
    role="dialog"
    aria-modal="true"
  >
    <div class="notify-float-box">
      <button class="notify-close" onclick={handleClose} aria-label="Close notification">
        <span class="close-icon">✕</span>
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
            Cancel
          </button>
          <button
            class="notify-btn {buttonClass}"
            onclick={handleContinue}
          >
            {buttonText}
          </button>
        </div>
      {:else}
        <button
          class="notify-btn {buttonClass}"
          onclick={handleContinue}
        >
          {buttonText}
        </button>
      {/if}
    </div>
  </div>
  {/key}
{/if}

<style>
  .notify-backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--k-65);
    backdrop-filter: blur(12px) saturate(180%);
    -webkit-backdrop-filter: blur(12px) saturate(180%);
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }

  .notify-backdrop.visible {
    opacity: 1;
    pointer-events: auto;
  }

  .notify-float-box {
    position: relative;
    background: var(--k-50);
    border: var(--border-by-rezky);
    border-radius: 24px;
    padding: 2.5rem 2rem;
    min-width: 320px;
    max-width: 90vw;
    text-align: center;
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    box-shadow: 0 25px 50px -12px var(--k-50);
    transform: scale(0.9) translateY(20px);
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .notify-backdrop.visible .notify-float-box {
    transform: scale(1) translateY(0);
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
    transition: all 0.25s ease;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    z-index: 10;
  }

  .notify-close:hover {
    background: var(--w-15);
    color: white;
    transform: rotate(90deg) scale(1.1);
    border-color: var(--w-25);
  }

  .notify-close :global(svg) {
    display: none;
  }

  .close-icon {
    font-size: 18px;
    font-weight: 600;
    color: inherit;
    line-height: 1;
    display: block;
  }

  .notify-icon {
    margin-bottom: 1.25rem;
    animation: iconPop 0.5s ease;
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
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 160px;
  }

  .btn-success {
    background: linear-gradient(135deg, var(--cat-green-90) 0%, var(--dkgreen-90) 100%);
    color: white;
    box-shadow:
      0 4px 20px var(--cat-green-30),
      0 0 0 1px var(--w-10) inset;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--w-15);
  }

  .btn-success:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow:
      0 8px 25px var(--cat-green-40),
      0 0 0 1px var(--w-15) inset;
    background: linear-gradient(135deg, var(--cat-green-95) 0%, var(--dkgreen-95) 100%);
  }

  .btn-delete {
    background: linear-gradient(135deg, var(--cat-red-90) 0%, var(--darkred-90) 100%);
    color: white;
    box-shadow:
      0 4px 20px var(--cat-red-30),
      0 0 0 1px var(--w-10) inset;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--w-15);
  }

  .btn-delete:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow:
      0 8px 25px var(--cat-red-40),
      0 0 0 1px var(--w-15) inset;
    background: linear-gradient(135deg, var(--cat-red-95) 0%, var(--darkred-95) 100%);
  }

  .btn-cancel {
    background: linear-gradient(135deg, var(--coolgray-90) 0%, var(--dkgray-90) 100%);
    color: white;
    box-shadow:
      0 4px 20px var(--coolgray-30),
      0 0 0 1px var(--w-10) inset;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--w-15);
  }

  .btn-cancel:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow:
      0 8px 25px var(--coolgray-40),
      0 0 0 1px var(--w-15) inset;
    background: linear-gradient(135deg, var(--coolgray-95) 0%, var(--dkgray-95) 100%);
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
    color: white;
    box-shadow:
      0 4px 20px var(--cat-amber-30),
      0 0 0 1px var(--w-10) inset;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--w-15);
  }

  .btn-warn:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow:
      0 8px 25px var(--cat-amber-40),
      0 0 0 1px var(--w-15) inset;
    background: linear-gradient(135deg, var(--cat-amber-95) 0%, var(--dkamber-95) 100%);
  }

  @media (max-width: 480px) {
    .notify-float-box {
      padding: 2rem 1.5rem;
      min-width: 300px;
      margin: 0 1rem;
      border-radius: 20px;
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
