<script lang="ts">
  import { onMount } from 'svelte';

  let particlesContainer: HTMLDivElement;
  let particles: HTMLDivElement[] = [];

  onMount(() => {
    createParticles();
    refreshParticles();
  });

  function createParticles() {
    if (!particlesContainer) return;

    particlesContainer.innerHTML = '';
    particles = [];

    // Create 20–25 lightweight particles
    const particleCount = 20 + Math.floor(Math.random() * 6);

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';

      const left = Math.random() * 100; // percentage
      const size = 2 + Math.random() * 6; // 2px - 8px
      const delay = Math.random() * 6; // 0s - 6s
      const duration = 14 + Math.random() * 12; // 14s - 26s
      const opacity = 0.25 + Math.random() * 0.6; // depth cue
      const scale = 0.8 + Math.random() * 0.9; // 0.8x - 1.7x
      const drift = (Math.random() - 0.5) * 40; // -20px to 20px horizontal drift

      particle.style.cssText = `
        left: ${left}%;
        width: ${size}px;
        height: ${size}px;
        animation-delay: ${delay}s;
        animation-duration: ${duration}s;
        opacity: ${opacity};
        --drift: ${drift}px;
        transform: translateZ(0) scale(${scale});
      `;

      particlesContainer.appendChild(particle);
      particles.push(particle);
    }
  }

  function refreshParticles() {
    setTimeout(() => {
      createParticles();
      refreshParticles();
    }, 30000);
  }
</script>

<div 
  bind:this={particlesContainer}
  class="cosmic-particles"
  aria-hidden="true"
></div>

<style>
  .cosmic-particles {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1; /* above background, below content */
    overflow: hidden;
    contain: layout paint;
  }

  :global(.particle) {
    position: absolute;
    bottom: -6vh;
    left: 0;
    background: rgba(255, 255, 255, 0.8);
    box-shadow: 0 0 6px rgba(255, 255, 255, 0.25);
    border-radius: 50%;
    will-change: transform;
    animation-name: rise;
    animation-iteration-count: infinite;
    animation-timing-function: cubic-bezier(0.33, 0, 0.2, 1); /* gentle ease */
    filter: blur(0.6px);
  }

  @keyframes rise {
    0% {
      transform: translateY(100vh) translateX(0);
      opacity: 0;
    }
    10% { opacity: 1; }
    50% {
      transform: translateY(50vh) translateX(var(--drift));
    }
    90% { opacity: 1; }
    100% {
      transform: translateY(-10vh) translateX(calc(var(--drift) * 1.5));
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.particle) { animation: none; }
  }
</style>
