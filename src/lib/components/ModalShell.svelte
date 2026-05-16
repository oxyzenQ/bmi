<script lang="ts">
  import { untrack, onDestroy } from 'svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    show: boolean;
    /** Delay before showing visible (ms) — default 60 */
    openDelay?: number;
    /** backdrop-filter blur amount — default 24px */
    backdropBlur?: string;
    /** backdrop-filter saturation — default 180% */
    backdropSat?: string;
    /** panel min-width — default 320px */
    panelMinWidth?: string;
    /** Additional CSS class for backdrop */
    backdropClass?: string;
    /** Additional CSS class for panel */
    panelClass?: string;
    /** Close on Escape key — default true */
    closeOnEscape?: boolean;
    /** Close on Enter key — default false */
    closeOnEnter?: boolean;
    /** Close on backdrop click — default false */
    closeOnBackdropClick?: boolean;
    /** Auto-focus first focusable element — default true */
    autoFocus?: boolean;
    /** Override z-index — default uses --modal-z */
    zIndex?: string;
    onclose?: () => void;
    children?: Snippet;
  }

  let {
    show = false,
    openDelay = 60,
    backdropBlur = '24px',
    backdropSat = '180%',
    panelMinWidth = '320px',
    backdropClass = '',
    panelClass = '',
    closeOnEscape = true,
    closeOnEnter = false,
    closeOnBackdropClick = false,
    autoFocus = true,
    zIndex = undefined,
    onclose = () => {},
    children,
  }: Props = $props();

  let visible = $state(false);
  let shellKey = $state(0);
  let backdropEl: HTMLDivElement | null = $state(null);
  let focusTrapHandler: ((e: KeyboardEvent) => void) | null = null;
  let prevShow = $state(false);

  function getFocusableElements(): HTMLElement[] {
    if (!backdropEl) return [];
    return Array.from(
      backdropEl.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex >= 0);
  }

  $effect(() => {
    const currentShow = show;
    const wasShown = untrack(() => prevShow);
    if (currentShow && !wasShown) {
      untrack(() => { shellKey += 1; });
      const timer = setTimeout(() => { visible = true; }, openDelay);
      return () => clearTimeout(timer);
    } else if (!currentShow && wasShown) {
      visible = false;
    }
    prevShow = currentShow;
  });

  $effect(() => {
    if (!visible || !backdropEl) {
      if (focusTrapHandler) {
        document.removeEventListener('keydown', focusTrapHandler);
        focusTrapHandler = null;
      }
      return;
    }
    focusTrapHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.preventDefault();
        e.stopPropagation();
        onclose();
        return;
      }
      if (e.key === 'Enter' && closeOnEnter) {
        e.preventDefault();
        e.stopPropagation();
        onclose();
        return;
      }
      if (e.key !== 'Tab' || !backdropEl) return;
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
    };
    document.addEventListener('keydown', focusTrapHandler);
    if (autoFocus) {
      const timer = setTimeout(() => {
        if (backdropEl) {
          const focusable = getFocusableElements();
          if (focusable.length > 0) focusable[0].focus();
        }
      }, openDelay);
      return () => {
        clearTimeout(timer);
        if (focusTrapHandler) {
          document.removeEventListener('keydown', focusTrapHandler);
          focusTrapHandler = null;
        }
      };
    }
    return () => {
      if (focusTrapHandler) {
        document.removeEventListener('keydown', focusTrapHandler);
        focusTrapHandler = null;
      }
    };
  });

  onDestroy(() => {
    if (focusTrapHandler) {
      document.removeEventListener('keydown', focusTrapHandler);
    }
  });

  function handleBackdropClick(e: MouseEvent) {
    if (closeOnBackdropClick && e.target === backdropEl) {
      onclose();
    }
  }
</script>

{#if show}
  {#key shellKey}
    <div
      bind:this={backdropEl}
      class="modal-shell-backdrop {backdropClass}"
      class:visible
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onclick={handleBackdropClick}
      onkeydown={(e: KeyboardEvent) => { if (e.key === 'Escape') onclose(); }}
      style="--ms-backdrop-blur: {backdropBlur}; --ms-backdrop-sat: {backdropSat};{zIndex ? ` z-index: ${zIndex};` : ''}"
    >
      <div class="modal-shell-panel {panelClass}" style="--ms-panel-min-w: {panelMinWidth};">
        {@render children?.()}
      </div>
    </div>
  {/key}
{/if}

<style>
  .modal-shell-backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--glass-bg-nightky, rgba(0, 0, 0, 0.65));
    -webkit-backdrop-filter: blur(var(--ms-backdrop-blur, 24px)) saturate(var(--ms-backdrop-sat, 180%));
    backdrop-filter: blur(var(--ms-backdrop-blur, 24px)) saturate(var(--ms-backdrop-sat, 180%));
    z-index: var(--modal-z);
    opacity: 0;
    transition: opacity var(--modal-backdrop-dur, 0.15s) ease;
    pointer-events: none;
    isolation: isolate;
    min-height: 100vh;
    min-height: 100dvh;
    min-width: 100vw;
  }
  .modal-shell-backdrop.visible {
    opacity: 1;
    pointer-events: auto;
  }
  .modal-shell-panel {
    position: relative;
    background: var(--glass-bg-nightky, rgba(0, 0, 0, 0.65));
    border: var(--border-by-rezky);
    border-radius: var(--modal-panel-radius, var(--radius-lg));
    padding: 2rem;
    min-width: var(--ms-panel-min-w, 320px);
    max-width: 90vw;
    max-height: min(calc(100dvh - 2rem), 760px);
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y pinch-zoom;
    scrollbar-width: none;
    -webkit-backdrop-filter: blur(var(--ms-backdrop-blur, 24px)) saturate(var(--ms-backdrop-sat, 180%));
    backdrop-filter: blur(var(--ms-backdrop-blur, 24px)) saturate(var(--ms-backdrop-sat, 180%));
    
    transform: var(--modal-panel-scale-from, scale(0.96) translateY(8px));
    transition: transform var(--modal-dur, 0.22s) var(--modal-ease, cubic-bezier(0.34, 1.56, 0.64, 1));
  }
  .modal-shell-panel::-webkit-scrollbar {
    display: none;
  }
  .modal-shell-backdrop.visible .modal-shell-panel {
    transform: var(--modal-panel-scale-to, scale(1) translateY(0));
  }
  /* iOS Safari: stronger blur */
  @supports (-webkit-touch-callout: none) {
    .modal-shell-backdrop {
      -webkit-backdrop-filter: blur(32px) saturate(200%);
      backdrop-filter: blur(32px) saturate(200%);
      background: var(--glass-bg-nightky, rgba(0, 0, 0, 0.65));
    }
  }
  @media (max-width: 480px) {
    .modal-shell-panel {
      min-width: auto;
      width: calc(100vw - 2rem);
      max-height: calc(100dvh - 2rem);
      margin: 0 1rem;
      padding: 1.5rem;
    }
  }
  @media (hover: none) and (pointer: coarse) {
    .modal-shell-backdrop {
      -webkit-backdrop-filter: blur(10px) saturate(130%) !important;
      backdrop-filter: blur(10px) saturate(130%) !important;
    }

    .modal-shell-panel {
      -webkit-backdrop-filter: blur(8px) saturate(120%) !important;
      backdrop-filter: blur(8px) saturate(120%) !important;
    }
  }
</style>
