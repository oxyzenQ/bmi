<script lang="ts">
  /**
   * Feedback Modal - Blocking feedback for success/error states
   * Used AFTER encryption modal closes to show explicit confirmation
   */
  import { untrack } from 'svelte';
  import { CheckCircle, XCircle } from 'lucide-svelte';
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

  let visible = $state(false);
  let modalKey = $state(0);
  let backdropEl: HTMLDivElement | null = $state(null);
  let focusTrapHandler: ((e: KeyboardEvent) => void) | null = null;

  // Track previous show value
  let prevShow = $state(false);

  // Handle modal open/close
  $effect(() => {
    const currentShow = show;
    const wasShown = untrack(() => prevShow);

    if (currentShow && !wasShown) {
      // Opening
      untrack(() => { modalKey += 1; });
      setTimeout(() => { visible = true; }, 60);
    } else if (!currentShow && wasShown) {
      visible = false;
    }

    prevShow = currentShow;
  });

  // Focus trap + auto-focus OK button
  $effect(() => {
    if (!visible || !backdropEl) {
      if (focusTrapHandler) {
        document.removeEventListener('keydown', focusTrapHandler);
        focusTrapHandler = null;
      }
      return;
    }

    focusTrapHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !backdropEl) return;

      const focusable = Array.from(
        backdropEl.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
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

    // Auto-focus OK button
    setTimeout(() => {
      if (backdropEl) {
        const okBtn = backdropEl.querySelector('[data-ok-button]') as HTMLElement;
        okBtn?.focus();
      }
    }, 100);

    return () => {
      if (focusTrapHandler) {
        document.removeEventListener('keydown', focusTrapHandler);
        focusTrapHandler = null;
      }
    };
  });

  const Icon = $derived(type === 'success' ? CheckCircle : XCircle);
  const iconColor = $derived(type === 'success' ? 'var(--cat-green-90)' : 'var(--error-color, #ef4444)');
  const defaultTitle = $derived(type === 'success' ? t('notify.success_title') : t('notify.error_title'));
  const displayTitle = $derived(title || defaultTitle);
</script>

{#if show}
  {#key modalKey}
    <div
      class="feedback-backdrop"
      class:visible
      bind:this={backdropEl}
      onclick={(e) => { if (e.target === backdropEl) onClose(); }}
      onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
      tabindex="-1"
    >
      <div class="feedback-box">
        <div class="feedback-header">
          <div class="feedback-icon" style:color={iconColor}>
            <Icon size={48} />
          </div>
          <h3 id="feedback-title" class="feedback-title">{displayTitle}</h3>
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
    </div>
  {/key}
{/if}

<style>
  .feedback-backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--glass-bg-backdrop, rgba(0, 0, 0, 0.80));
    -webkit-backdrop-filter: blur(24px) saturate(140%);
    backdrop-filter: blur(24px) saturate(140%);
    z-index: var(--z-modal-top);
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
    /* Ensure full viewport coverage on mobile */
    min-height: 100vh;
    min-height: 100dvh;
    min-width: 100vw;
  }

  .feedback-backdrop.visible {
    opacity: 1;
    pointer-events: auto;
  }

  .feedback-box {
    background: var(--k-50);
    border: var(--border-by-rezky);
    border-radius: var(--radius-lg);
    padding: 2rem;
    min-width: 320px;
    width: 100%;
    max-width: min(400px, 90vw);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    backdrop-filter: blur(24px) saturate(180%);
    box-shadow: 0 25px 50px -12px var(--k-50);
    text-align: center;
    animation: feedbackIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  @keyframes feedbackIn {
    from {
      opacity: 0;
      transform: scale(0.96) translateY(8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* iOS Safari: stronger blur for mobile */
  @supports (-webkit-touch-callout: none) {
    .feedback-backdrop {
      -webkit-backdrop-filter: blur(32px) saturate(200%);
      backdrop-filter: blur(32px) saturate(200%);
      background: var(--glass-bg-strong, rgba(0, 0, 0, 0.70));
    }
  }

  .feedback-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .feedback-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.75rem;
  }

  .feedback-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--w-95);
    margin: 0 0 0.5rem 0;
  }

  .feedback-message {
    font-size: 0.9rem;
    color: var(--w-70);
    line-height: 1.5;
    margin: 0 0 1.25rem 0;
    opacity: 0.85;
  }

  .feedback-actions {
    display: flex;
    justify-content: center;
    width: 100%;
  }

  .feedback-btn {
    padding: 0.75rem 2rem;
    font-size: 0.95rem;
    font-weight: 500;
    border-radius: 10px;
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

  @media (max-width: 480px) {
    .feedback-box {
      min-width: auto;
      width: calc(100vw - 2rem);
      margin: 0 1rem;
      padding: 1.5rem;
    }

    .feedback-title {
      font-size: 1.2rem;
    }
  }
</style>
