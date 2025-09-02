<script lang="ts">
  import { onMount } from 'svelte';

  let particlesContainer: HTMLDivElement;
  let particles: HTMLDivElement[] = [];

  onMount(() => {
    createParticles();
    refreshParticles();
  });

  function createParticle() {
    const particle = document.createElement('div');
    particle.className = 'particle';
    return particle;
  }

  function createParticles() {
    if (!particlesContainer) return;

    particlesContainer.innerHTML = '';
    particles = [];

    // Create particles
    const particleCount = 20 + Math.floor(Math.random() * 6);
    for (let i = 0; i < particleCount; i++) {
      const particle = createParticle();
      const opacity = 0.25 + Math.random() * 0.6; // depth cue
      const scale = 0.8 + Math.random() * 0.9; // 0.8x - 1.7x
      const drift = (Math.random() - 0.5) * 40; // -20px to 20px horizontal drift
      const left = Math.random() * 100; // 0% to 100%
      const size = 2 + Math.floor(Math.random() * 4); // 2px to 6px
      const delay = Math.random() * 2; // 0s to 2s
      const duration = 10 + Math.random() * 10; // 10s to 20s

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
