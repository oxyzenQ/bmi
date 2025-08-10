<script lang="ts">
  import { onMount } from 'svelte';

  let particlesContainer: HTMLDivElement;
  let particles: HTMLDivElement[] = [];

  onMount(() => {
    createParticles();
  });

  function createParticles() {
    if (!particlesContainer) return;

    particlesContainer.innerHTML = '';
    particles = [];

    // Create 12-20 lightweight particles
    const particleCount = 12 + Math.floor(Math.random() * 9);

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';

      const left = Math.random() * 100; // percentage
      const size = Math.random() * 2 + 1; // 1px - 3px
      const delay = Math.random() * 8; // 0s - 8s
      const duration = 12 + Math.random() * 10; // 12s - 22s
      const opacity = 0.2 + Math.random() * 0.6; // depth cue
      const scale = 0.8 + Math.random() * 0.8; // 0.8x - 1.6x

      particle.style.cssText = `
        left: ${left}%;
        width: ${size}px;
        height: ${size}px;
        animation-delay: ${delay}s;
        animation-duration: ${duration}s;
        opacity: ${opacity};
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

  onMount(() => {
    refreshParticles();
  });
</script>

<div 
  bind:this={particlesContainer}
  class="cosmic-particles"
  aria-hidden="true"
>
</div>

<style>
  .cosmic-particles {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
    contain: layout paint;
  }

  :global(.particle) {
    position: absolute;
    bottom: -5vh;
    left: 0;
    background: rgba(255, 255, 255, 0.7);
    border-radius: 50%;
    will-change: transform;
    animation-name: rise;
    animation-iteration-count: infinite;
    animation-timing-function: linear;
    filter: blur(0.4px);
  }

  @keyframes rise {
    0% {
      transform: translateY(100vh);
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    90% {
      opacity: 1;
    }
    100% {
      transform: translateY(-10vh);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.particle) {
      animation: none;
    }
  }
</style>
