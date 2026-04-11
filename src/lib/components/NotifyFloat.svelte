<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { CheckCircle, Trash2, X, ShieldAlert } from 'lucide-svelte';

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
    type === 'success' ? 'var(--cat-normal)' :
    type === 'warn' ? 'var(--cat-overweight)' :
    'var(--cat-obese)'
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
  /* ── Backdrop overlay ── */
  .notify-backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(9, 9, 11, 0.72);
    backdrop-filter: blur(16px) saturate(120%);
    -webkit-backdrop-filter: blur(16px) saturate(120%);
    z-index: 9999;
    opacity: 0;
    transition: opacity var(--dur-slow) var(--ease-out);
    pointer-events: none;
  }

  .notify-backdrop.visible {
    opacity: 1;
    pointer-events: auto;
  }

  /* ── Modal card ── */
  .notify-float-box {
    position: relative;
    background: rgba(17, 17, 19, 0.92);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-2xl);
    padding: var(--sp-10) var(--sp-8);
    min-width: 320px;
    max-width: 90vw;
    text-align: center;
    backdrop-filter: blur(16px) saturate(120%);
    -webkit-backdrop-filter: blur(16px) saturate(120%);
    box-shadow: var(--shadow-xl);
    transform: scale(0.92) translateY(16px);
    transition: transform var(--dur-slow) var(--ease-spring);
  }

  .notify-backdrop.visible .notify-float-box {
    transform: scale(1) translateY(0);
  }

  /* ── Close button ── */
  .notify-close {
    position: absolute;
    top: var(--sp-3);
    right: var(--sp-3);
    background: transparent;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-full);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    cursor: pointer;
    transition: all var(--dur-fast) var(--ease-out);
    z-index: 10;
  }

  .notify-close:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-secondary);
    border-color: var(--border-default);
  }

  .notify-close :global(svg) {
    display: none;
  }

  .close-icon {
    font-size: 16px;
    font-weight: 500;
    color: inherit;
    line-height: 1;
    display: block;
  }

  /* ── Icon ── */
  .notify-icon {
    margin-bottom: var(--sp-5);
    animation: iconPop 0.5s var(--ease-spring);
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
      transform: scale(1.15);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* ── Message ── */
  .notify-message {
    font-size: 1rem;
    color: var(--text-primary);
    margin: 0 0 var(--sp-6);
    line-height: 1.6;
    font-weight: 500;
  }

  /* ── Shared button base ── */
  .notify-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    height: var(--btn-height);
    padding-inline: var(--sp-6);
    font-family: var(--font-sans);
    font-size: 0.9rem;
    font-weight: 600;
    border: none;
    border-radius: var(--btn-radius);
    cursor: pointer;
    transition:
      transform var(--dur-fast) var(--ease-out),
      box-shadow var(--dur-fast) var(--ease-out),
      background var(--dur-fast) var(--ease-out);
    min-width: 140px;
  }

  .notify-btn:active {
    transform: translateY(0) scale(0.97);
    transition-duration: 80ms;
  }

  /* ── Success (green) ── */
  .btn-success {
    background: var(--cat-normal);
    color: #052e16;
    box-shadow: 0 2px 12px rgba(52, 211, 153, 0.25);
  }

  .btn-success:hover {
    transform: translateY(-1px);
    background: #4ade80;
    box-shadow: 0 4px 16px rgba(52, 211, 153, 0.35);
  }

  /* ── Delete (red) ── */
  .btn-delete {
    background: var(--cat-obese);
    color: #450a0a;
    box-shadow: 0 2px 12px rgba(248, 113, 113, 0.25);
  }

  .btn-delete:hover {
    transform: translateY(-1px);
    background: #fca5a5;
    box-shadow: 0 4px 16px rgba(248, 113, 113, 0.35);
  }

  /* ── Warn (amber) ── */
  .btn-warn {
    background: var(--cat-overweight);
    color: #451a03;
    box-shadow: 0 2px 12px rgba(251, 191, 36, 0.25);
  }

  .btn-warn:hover {
    transform: translateY(-1px);
    background: #fcd34d;
    box-shadow: 0 4px 16px rgba(251, 191, 36, 0.35);
  }

  /* ── Cancel (neutral) ── */
  .btn-cancel {
    background: var(--bg-elevated);
    color: var(--text-secondary);
    border: 1px solid var(--border-default);
    box-shadow: var(--shadow-sm);
  }

  .btn-cancel:hover {
    transform: translateY(-1px);
    background: var(--bg-overlay);
    border-color: var(--border-strong);
    color: var(--text-primary);
    box-shadow: var(--shadow-md);
  }

  /* ── Button group ── */
  .notify-btn-group {
    display: flex;
    gap: var(--sp-3);
    justify-content: center;
    flex-wrap: wrap;
  }

  .notify-btn-group .notify-btn {
    min-width: 120px;
  }

  /* ── Mobile ── */
  @media (max-width: 480px) {
    .notify-float-box {
      padding: var(--sp-8) var(--sp-6);
      min-width: 280px;
      margin: 0 var(--sp-4);
      border-radius: var(--radius-xl);
    }

    .notify-message {
      font-size: 0.9rem;
    }

    .notify-btn {
      padding-inline: var(--sp-5);
      min-width: 120px;
    }
  }
</style>
