<script lang="ts">
  import { ChevronLeft, ChevronRight } from 'lucide-svelte';

  interface Props {
    activeIndex: number;
    totalSections: number;
    onPrev: () => void;
    onNext: () => void;
    visible?: boolean;
  }

  let {
    activeIndex,
    totalSections,
    onPrev,
    onNext,
    visible = true
  }: Props = $props();
</script>

<div class="bottom-nav-shell" class:hidden={!visible}>
  <nav class="bottom-nav" aria-label="Section navigation">
    {#if activeIndex > 0}
      <button
        type="button"
        class="nav-btn nav-btn-prev"
        aria-label="Previous section"
        onclick={onPrev}
      >
        <ChevronLeft aria-hidden="true" size={24} />
      </button>
    {:else}
      <div class="nav-btn-spacer" aria-hidden="true"></div>
    {/if}

    {#if activeIndex < totalSections - 1}
      <button
        type="button"
        class="nav-btn nav-btn-next"
        aria-label="Next section"
        onclick={onNext}
      >
        <ChevronRight aria-hidden="true" size={24} />
      </button>
    {:else}
      <div class="nav-btn-spacer" aria-hidden="true"></div>
    {/if}
  </nav>
</div>

<style>
  .bottom-nav-shell {
    width: calc(100% - 1.5rem);
    max-width: 820px;
    min-width: 0;
    overflow: visible;
    background: transparent;
    margin-inline: auto;
    position: fixed;
    bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
  }

  .bottom-nav-shell.hidden {
    transform: translateX(-50%) translateY(calc(100% + 1rem));
    opacity: 0;
    pointer-events: none;
  }

  .bottom-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    padding: 0;
    position: relative;
    z-index: 1;
  }

  .nav-btn {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    color: rgba(255, 255, 255, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .nav-btn:hover {
    transform: scale(1.06) translateY(-1px);
    background: rgba(147, 112, 219, 0.15);
    border-color: rgba(147, 112, 219, 0.3);
    box-shadow:
      0 12px 40px rgba(147, 112, 219, 0.15),
      0 8px 32px rgba(0, 0, 0, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }

  .nav-btn:active {
    transform: scale(0.98) translateY(0);
    background: rgba(147, 112, 219, 0.25);
    box-shadow:
      0 4px 16px rgba(147, 112, 219, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .nav-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 50%);
    pointer-events: none;
    opacity: 0.6;
  }

  .nav-btn-spacer {
    width: 56px;
    height: 56px;
  }

  @media (max-width: 480px) {
    .nav-btn,
    .nav-btn-spacer {
      width: 52px;
      height: 52px;
    }
  }
</style>
