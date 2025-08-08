<script lang="ts">
  import { onMount } from 'svelte';

  let particlesContainer: HTMLDivElement;
  let particles: HTMLDivElement[] = [];

  onMount(() => {
    createParticles();
  });

  function createParticles() {
    if (!particlesContainer) return;

    // Clear existing particles
    particlesContainer.innerHTML = '';
    particles = [];

    // Create 20-30 particles
    const particleCount = Math.floor(Math.random() * 10) + 20;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      
      // Random positioning and timing
      const left = Math.random() * 100;
      const size = Math.random() * 3 + 1;
      const delay = Math.random() * 20;
      const duration = Math.random() * 10 + 15;
      
      particle.style.cssText = `
        left: ${left}%;
        width: ${size}px;
        height: ${size}px;
        animation-delay: ${delay}s;
        animation-duration: ${duration}s;
        opacity: ${Math.random() * 0.6 + 0.2};
      `;
      
      particlesContainer.appendChild(particle);
      particles.push(particle);
    }
  }

  // Recreate particles periodically for variety
  function refreshParticles() {
    setTimeout(() => {
      createParticles();
      refreshParticles();
    }, 30000); // Refresh every 30 seconds
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
  <!-- Particles will be dynamically created here -->
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
  }

  .particle {
    position: absolute;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 50%;
    animation: float 20s infinite linear;
    filter: blur(0.5px);
  }

  @keyframes float {
    0% {
      transform: translateY(100vh) translateX(0);
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    90% {
      opacity: 1;
    }
    100% {
      transform: translateY(-100px) translateX(100px);
      opacity: 0;
    }
  }

  /* Reduce motion for users who prefer it */
  @media (prefers-reduced-motion: reduce) {
    .particle {
      animation: none;
    }
  }
</style>
