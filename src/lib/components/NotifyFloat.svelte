<script lang="ts">
  import { onMount } from 'svelte';
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

  // Track previous values to detect content changes while show stays true
  let prevShow = false;
  let prevType = '';
  let prevMessage = '';

  $effect(() => {
    const contentChanged = (show && prevShow) && (type !== prevType || message !== prevMessage);
    const justOpened = show && !prevShow;

    prevShow = show;
    prevType = type;
    prevMessage = message;

    if ((justOpened || contentChanged) && mounted) {
      // Reset animation
      visible = false;
      notifyKey += 1;
      setTimeout(() => { visible = true; }, 50);
    } else if (!show) {
      visible = false;
    }
  });

  onMount(() => {
    mounted = true;
  });

  function handleContinue() {
    visible = false;
    setTimeout(() => {
      onContinue();
    }, 200);
  }

  function handleCancel() {
    visible = false;
    setTimeout(() => {
      onCancel();
    }, 200);
  }

  function handleClose() {
    visible = false;
    setTimeout(() => {
      onClose();
    }, 200);
  }

  const Icon = $derived(
    type === 'success' ? CheckCircle :
    type === 'warn' ? ShieldAlert :
    Trash2
  );
  const iconColor = $derived(
    type === 'success' ? '#00C853' :
    type === 'warn' ? '#F59E0B' :
    '#D50000'
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
    background: rgba(0, 0, 0, 0.65);
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
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0.05) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 24px;
    padding: 2.5rem 2rem;
    min-width: 320px;
    max-width: 90vw;
    text-align: center;
    backdrop-filter: blur(20px) saturate(200%);
    -webkit-backdrop-filter: blur(20px) saturate(200%);
    box-shadow:
      0 25px 50px -12px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.1) inset,
      0 0 60px rgba(128, 0, 255, 0.15);
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
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    transition: all 0.25s ease;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    z-index: 10;
  }

  .notify-close:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
    transform: rotate(90deg) scale(1.1);
    border-color: rgba(255, 255, 255, 0.25);
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
    color: rgba(255, 255, 255, 0.95);
    margin: 0 0 1.5rem;
    line-height: 1.5;
    font-weight: 500;
    letter-spacing: -0.01em;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
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
    background: linear-gradient(135deg, rgba(0, 200, 83, 0.9) 0%, rgba(0, 168, 71, 0.9) 100%);
    color: white;
    box-shadow:
      0 4px 20px rgba(0, 200, 83, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.1) inset;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .btn-success:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow:
      0 8px 25px rgba(0, 200, 83, 0.4),
      0 0 0 1px rgba(255, 255, 255, 0.15) inset;
    background: linear-gradient(135deg, rgba(0, 200, 83, 0.95) 0%, rgba(0, 168, 71, 0.95) 100%);
  }

  .btn-delete {
    background: linear-gradient(135deg, rgba(213, 0, 0, 0.9) 0%, rgba(183, 28, 28, 0.9) 100%);
    color: white;
    box-shadow:
      0 4px 20px rgba(213, 0, 0, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.1) inset;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .btn-delete:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow:
      0 8px 25px rgba(213, 0, 0, 0.4),
      0 0 0 1px rgba(255, 255, 255, 0.15) inset;
    background: linear-gradient(135deg, rgba(213, 0, 0, 0.95) 0%, rgba(183, 28, 28, 0.95) 100%);
  }

  .btn-cancel {
    background: linear-gradient(135deg, rgba(100, 116, 139, 0.9) 0%, rgba(71, 85, 105, 0.9) 100%);
    color: white;
    box-shadow:
      0 4px 20px rgba(100, 116, 139, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.1) inset;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .btn-cancel:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow:
      0 8px 25px rgba(100, 116, 139, 0.4),
      0 0 0 1px rgba(255, 255, 255, 0.15) inset;
    background: linear-gradient(135deg, rgba(100, 116, 139, 0.95) 0%, rgba(71, 85, 105, 0.95) 100%);
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
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.9) 0%, rgba(217, 119, 6, 0.9) 100%);
    color: white;
    box-shadow:
      0 4px 20px rgba(245, 158, 11, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.1) inset;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .btn-warn:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow:
      0 8px 25px rgba(245, 158, 11, 0.4),
      0 0 0 1px rgba(255, 255, 255, 0.15) inset;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.95) 0%, rgba(217, 119, 6, 0.95) 100%);
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
