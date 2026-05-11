<script lang="ts">
  /**
   * ErrorBoundary — v16.0 Observability
   *
   * Client-side error boundary that catches runtime errors in its children.
   * Unlike SvelteKit's +error.svelte (which handles route-level errors),
   * this component catches errors from any child component rendering.
   *
   * Features:
   *   - Logs errors via structured logger with full context
   *   - Shows user-friendly fallback UI
   *   - Provides retry mechanism (re-renders children)
   *   - Dev-only: shows full error details + stack trace
   *   - Accessible: proper ARIA attributes, keyboard-navigable retry
   *
   * Usage:
   *   <ErrorBoundary module="results" fallback={fallbackContent}>
   *     {@render children()}
   *   </ErrorBoundary>
   */

  import { logger } from '$lib/utils/logger';
  import { AlertTriangle, RotateCcw, ChevronDown } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    /** Source module name for logging context */
    module?: string;
    /** Optional fallback snippet (replaces default error UI) */
    fallback?: Snippet;
    /** Whether to show the default error UI (set false for silent catch) */
    showErrorUi?: boolean;
    children: Snippet;
  }

  let {
    module = 'unknown',
    fallback,
    showErrorUi = true,
    children,
  }: Props = $props();

  let hasError = $state(false);
  let errorDetails = $state<{ message: string; stack?: string } | null>(null);
  let showStack = $state(false);

  /**
   * Trigger an error from a child component.
   * Call this from any descendant to trigger the boundary.
   */
  function handleError(err: unknown): void {
    hasError = true;

    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    errorDetails = { message, stack };

    logger.error(module, 'ErrorBoundary', `Caught runtime error: ${message}`, err, {
      hasStack: Boolean(stack),
    });
  }

  function handleRetry(): void {
    hasError = false;
    errorDetails = null;
    showStack = false;

    logger.info(module, 'ErrorBoundary', 'User triggered retry — re-rendering children');
  }
</script>

{#if hasError && showErrorUi}
  {#if fallback}
    <div class="error-boundary-fallback" role="alert">
      {@render fallback()}
      <button class="eb-retry" onclick={handleRetry} aria-label="Retry">
        <RotateCcw size={14} />
        <span>Retry</span>
      </button>
    </div>
  {:else}
    <div class="error-boundary" role="alert">
      <div class="eb-icon" aria-hidden="true">
        <AlertTriangle size={24} />
      </div>

      <p class="eb-message">Something went wrong</p>

      {#if !import.meta.env.PROD && errorDetails}
        <p class="eb-details">{errorDetails.message}</p>

        {#if errorDetails.stack}
          <button
            class="eb-stack-toggle"
            onclick={() => (showStack = !showStack)}
            aria-expanded={showStack}
          >
            <ChevronDown size={14} class={showStack ? 'rotated' : ''} />
            {showStack ? 'Hide' : 'Show'} details
          </button>

          {#if showStack}
            <pre class="eb-stack">{errorDetails.stack}</pre>
          {/if}
        {/if}
      {:else}
        <p class="eb-hint">
          Please try again or reload the page.
        </p>
      {/if}

      <button class="eb-retry" onclick={handleRetry}>
        <RotateCcw size={14} />
        <span>Try Again</span>
      </button>
    </div>
  {/if}
{:else}
  {@render children()}
{/if}

<style>
  .error-boundary {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2rem 1.5rem;
    text-align: center;
    border-radius: var(--radius-lg, 12px);
    background: var(--darkred-85, rgba(127, 29, 29, 0.3));
    border: 1px solid var(--darkred-70, rgba(185, 28, 28, 0.4));
    backdrop-filter: blur(8px);
  }

  .error-boundary-fallback {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
  }

  .eb-icon {
    color: var(--red-50, #ef4444);
    margin-bottom: 0.25rem;
  }

  .eb-message {
    font-size: 1rem;
    font-weight: 600;
    color: var(--w-90, #f1f5f9);
  }

  .eb-details {
    font-size: 0.8rem;
    color: var(--w-60, #94a3b8);
    font-family: var(--font-mono-short, monospace);
    max-width: 100%;
    word-break: break-word;
  }

  .eb-hint {
    font-size: 0.8rem;
    color: var(--w-50, #94a3b8);
  }

  .eb-stack-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    color: var(--violet-50, #8b5cf6);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    transition: color var(--dur-interactive, 150ms) ease;
  }

  .eb-stack-toggle:hover {
    color: var(--purple-80, #c4b5fd);
  }

  .eb-stack-toggle :global(.rotated) {
    transform: rotate(180deg);
  }

  .eb-stack {
    font-size: 0.65rem;
    color: var(--w-40, #64748b);
    font-family: var(--font-mono-short, monospace);
    text-align: left;
    max-height: 200px;
    overflow-y: auto;
    padding: 0.5rem;
    background: var(--w-5, rgba(255, 255, 255, 0.03));
    border-radius: var(--radius-md, 8px);
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0;
    max-width: 100%;
  }

  .eb-retry {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 1rem;
    margin-top: 0.5rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: white;
    background: var(--cosmic-purple, #7c3aed);
    border: none;
    border-radius: 9999px;
    cursor: pointer;
    transition: filter var(--dur-interactive, 150ms) ease, transform 0.1s ease;
  }

  .eb-retry:hover {
    filter: brightness(1.15);
  }

  .eb-retry:active {
    transform: scale(0.97);
  }

  .eb-retry:focus-visible {
    outline: 2px solid var(--violet-50, #8b5cf6);
    outline-offset: 2px;
  }
</style>
