<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher, afterUpdate } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { quintOut, backOut } from 'svelte/easing';
  import { Rocket } from 'lucide-svelte';

  export let show = true;
  export let duration = 10000;

  let visible = show;
  let lastShow = show;

  let splashPhase = 'loading'; // 'loading' -> 'content' -> 'exit'
  let showTitle = false;
  let showSubtitle = false;
  let showLoader = true;
  let showSkipButton = false;
  let showRocket = false;
  let titleText = "Hey...welcome";
  let subtitleText = "Copyright by rezky nightky 2025";
  let currentTitleText = "";
  let currentSubtitleText = "";
  const dispatch = createEventDispatcher();

  let mounted = false;
  let started = false;
  let cancelled = false;
  const timers: Array<ReturnType<typeof setTimeout>> = [];

  function clearTimers() {
    for (const t of timers) clearTimeout(t);
    timers.length = 0;
  }

  function schedule(fn: () => void, delay: number) {
    const id = setTimeout(() => {
      if (cancelled) return;
      fn();
    }, delay);
    timers.push(id);
    return id;
  }

  // Typewriter effect for title
  async function typewriterEffect(text: string, callback: (char: string) => void, speed = 80) {
    for (let i = 0; i <= text.length; i++) {
      if (cancelled) return;
      callback(text.slice(0, i));
      await new Promise(resolve => setTimeout(resolve, speed));
    }
  }

  function resetVisualState() {
    splashPhase = 'loading';
    showTitle = false;
    showSubtitle = false;
    showLoader = true;
    showSkipButton = false;
    showRocket = false;
    currentTitleText = "";
    currentSubtitleText = "";
  }

  function start() {
    if (started || cancelled || !mounted) return;
    started = true;
    cancelled = false;
    visible = true;

    const r = {
      titleStart: 1 / 6,
      subtitleStart: 2.5 / 6,
      skipStart: 2 / 6,
      loaderHide: 4.5 / 6,
      exitStart: 5.5 / 6
    };

    const titleDelay = Math.round(duration * r.titleStart);
    const subtitleDelay = Math.round(duration * r.subtitleStart);
    const skipDelay = Math.round(duration * r.skipStart);
    const loaderHideDelay = Math.round(duration * r.loaderHide);
    const exitDelay = Math.round(duration * r.exitStart);
    const rocketDelay = titleDelay + Math.min(600, Math.round(duration * 0.05));

    const speedScale = duration / 6000;
    const titleSpeed = Math.max(40, Math.round(80 * speedScale));
    const subtitleSpeed = Math.max(30, Math.round(60 * speedScale));

    schedule(async () => {
      showTitle = true;
      await typewriterEffect(titleText, (text) => {
        currentTitleText = text;
      }, titleSpeed);
    }, titleDelay);

    schedule(() => {
      showRocket = true;
    }, rocketDelay);

    schedule(async () => {
      showSubtitle = true;
      await typewriterEffect(subtitleText, (text) => {
        currentSubtitleText = text;
      }, subtitleSpeed);
    }, subtitleDelay);

    schedule(() => {
      showSkipButton = true;
    }, skipDelay);

    schedule(() => {
      showLoader = false;
    }, loaderHideDelay);

    schedule(() => {
      splashPhase = 'exit';
    }, exitDelay);

    schedule(() => {
      visible = false;
      dispatch('complete');
    }, duration);
  }

  onMount(() => {
    mounted = true;
    visible = show;
    lastShow = show;
    if (show) start();
  });

  afterUpdate(() => {
    if (!mounted) return;
    if (show === lastShow) return;

    if (!show) {
      cancelled = true;
      clearTimers();
      started = false;
      visible = false;
    } else {
      cancelled = false;
      resetVisualState();
      start();
    }

    lastShow = show;
  });

  onDestroy(() => {
    cancelled = true;
    mounted = false;
    clearTimers();
  });

  function skipSplash() {
    cancelled = true;
    clearTimers();
    started = false;
    splashPhase = 'exit';
    visible = false;
    dispatch('complete');
  }
</script>

{#if visible}
  <div
    class="splash-screen"
    class:exit-phase={splashPhase === 'exit'}
    transition:fade={{ duration: 800, easing: quintOut }}
  >
    <!-- Skip button -->
    {#if showSkipButton}
      <button
        class="skip-button"
        on:click={skipSplash}
        transition:fade={{ duration: 400, delay: 200 }}
      >
        Skip
      </button>
    {/if}

    <div class="splash-content">
      <!-- Subtle plasma glow effect -->
      <div class="plasma-glow"></div>

      <!-- Main title with typewriter effect -->
      {#if showTitle}
        <h1
          class="splash-title"
          transition:fly={{ y: 30, duration: 1000, easing: backOut }}
        >
          {currentTitleText}<span class="cursor" class:blink={currentTitleText.length < titleText.length}>|</span>
        </h1>
      {/if}

      {#if showRocket}
        <div class="splash-rocket" aria-hidden="true" transition:scale={{ duration: 500, easing: quintOut }}>
          <Rocket size={36} />
        </div>
      {/if}

      <!-- Subtitle with slide-up effect -->
      {#if showSubtitle}
        <p
          class="splash-subtitle"
          transition:fly={{ y: 20, duration: 800, easing: quintOut, delay: 100 }}
        >
          {currentSubtitleText}<span class="cursor" class:blink={currentSubtitleText.length < subtitleText.length}>|</span>
        </p>
      {/if}

      <!-- Enhanced loading indicator -->
      {#if showLoader}
        <div class="loading-indicator" transition:scale={{ duration: 600, easing: backOut }}>
          <div class="plasma-ring"></div>
          <div class="loading-dots">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Subtle floating particles -->
    <div class="plasma-particles">
      {#each Array(8) as _, i (i)}
        <div
          class="particle"
          style="--delay: {i * 0.5}s; --duration: {4 + (i % 2)}s;"
        ></div>
      {/each}
    </div>
  </div>
{/if}

<!-- styles moved to app-clean-by-claude.css -->
