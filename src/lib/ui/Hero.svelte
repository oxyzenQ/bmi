<script lang="ts">
  import { onMount } from 'svelte';
  import { Star, Sparkles } from 'lucide-svelte';

  let heroContent: HTMLDivElement;

  onMount(() => {
    if (heroContent) {
      heroContent.style.opacity = '0';
      heroContent.style.transform = 'translateY(20px)';
      setTimeout(() => {
        heroContent.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
        heroContent.style.opacity = '1';
        heroContent.style.transform = 'translateY(0)';
      }, 100);
    }
  });
</script>

<header class="hero-section">
  <div class="hero-background">
    <div class="cosmic-orbs">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>
  </div>
  
  <div bind:this={heroContent} class="hero-content liquid-glass">
    <div class="hero-avatar" aria-hidden="true">
      <img src="/assets/logobmii.webp" alt="BMI Logo" width="96" height="96" loading="lazy" decoding="async" />
      <div class="icon-glow"></div>
    </div>
    
    <h1 class="hero-title">
      <span class="title-gradient">BMI Calculator</span>
      <Sparkles class="sparkle-icon" />
    </h1>
    
    <p class="hero-subtitle">
      Explore the cosmos of your body — discover your balance under the stars or morning sun.
    </p>
    
    <div class="hero-features">
      <div class="feature">
        <Star class="w-5 h-5 text-cosmic-yellow" />
        <span>Accurate Calculations</span>
      </div>
      <div class="feature">
        <Star class="w-5 h-5 text-cosmic-green" />
        <span>Health Insights</span>
      </div>
      <div class="feature">
        <Star class="w-5 h-5 text-cosmic-purple" />
        <span>Modern Design</span>
      </div>
    </div>
    
    <p class="hero-copyright">
      © 2025 Rezky Nightky. All rights reserved.
    </p>
  </div>
</header>

<style>
  .hero-section { text-align: center; padding: 4rem 2rem 2rem; margin-bottom: 2rem; position: relative; min-height: 60vh; display: flex; align-items: center; justify-content: center; }
  .hero-background { position: absolute; inset: 0; z-index: -1; }
  .cosmic-orbs { position: relative; width: 100%; height: 100%; }
  .orb { position: absolute; border-radius: 50%; filter: blur(40px); opacity: 0.25; animation: orbFloat 20s ease-in-out infinite; }
  .orb-1 { width: 200px; height: 200px; background: radial-gradient(circle, rgba(96, 165, 250, 0.35), transparent); top: 20%; left: 10%; animation-delay: 0s; }
  .orb-2 { width: 150px; height: 150px; background: radial-gradient(circle, rgba(168, 85, 247, 0.35), transparent); top: 60%; right: 15%; animation-delay: -7s; }
  .orb-3 { width: 100px; height: 100px; background: radial-gradient(circle, rgba(6, 182, 212, 0.35), transparent); bottom: 20%; left: 20%; animation-delay: -14s; }
  @keyframes orbFloat { 0%, 100% { transform: translateY(0) translateX(0); } 33% { transform: translateY(-20px) translateX(10px); } 66% { transform: translateY(10px) translateX(-15px); } }

  .hero-content { max-width: 800px; margin: 0 auto; padding: 3rem 2rem; border-radius: 2rem; position: relative; overflow: hidden; }
  .hero-content::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(96, 165, 250, 0.1), rgba(168, 85, 247, 0.1)); border-radius: inherit; z-index: -1; }

  .hero-avatar {
    position: relative; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 1.5rem;
    width: 96px; height: 96px; border-radius: 9999px; padding: 2px;
    background: linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06));
    border: 1px solid var(--apple-border);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(10px) saturate(160%);
  }
  .hero-avatar img { width: 100%; height: 100%; border-radius: inherit; display: block; object-fit: cover; background: rgba(255,255,255,0.05); }
  .icon-glow { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 110px; height: 110px; background: radial-gradient(circle, rgba(96, 165, 250, 0.22), transparent); border-radius: 50%; filter: blur(18px); animation: iconGlow 3s ease-in-out infinite alternate; z-index: -1; }
  @keyframes iconGlow { 0% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); } 100% { opacity: 0.85; transform: translate(-50%, -50%) scale(1.08); } }

  .hero-title { font-size: 3.5rem; font-weight: 700; margin-bottom: 1rem; line-height: 1.2; position: relative; display: flex; align-items: center; justify-content: center; gap: 1rem; }
  .title-gradient { background: linear-gradient(135deg, #60a5fa, #a78bfa, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; position: relative; }
  .sparkle-icon { width: 2rem; height: 2rem; color: #fbbf24; animation: sparkle 2s ease-in-out infinite; }
  @keyframes sparkle { 0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; } 50% { transform: scale(1.2) rotate(180deg); opacity: 0.8; } }

  .hero-subtitle { font-size: 1.25rem; color: #d1d5db; margin-bottom: 2rem; line-height: 1.6; max-width: 600px; margin-left: auto; margin-right: auto; font-weight: 400; }
  .hero-features { display: flex; justify-content: center; gap: 2rem; margin-bottom: 2rem; flex-wrap: wrap; }
  .feature { display: flex; align-items: center; gap: 0.5rem; color: #e5e7eb; font-size: 0.875rem; font-weight: 500; padding: 0.5rem 1rem; background: rgba(255, 255, 255, 0.05); border-radius: 2rem; border: 1px solid rgba(255, 255, 255, 0.1); transition: all 0.3s ease; }
  .feature:hover { background: rgba(255, 255, 255, 0.1); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); }

  @media (max-width: 768px) {
    .hero-section { padding: 2rem 1rem 1rem; min-height: 50vh; }
    .hero-content { padding: 2rem 1.5rem; border-radius: 1.5rem; }
    .hero-title { font-size: 2.5rem; flex-direction: column; gap: 0.5rem; }
    .sparkle-icon { width: 1.5rem; height: 1.5rem; }
    .hero-subtitle { font-size: 1.125rem; }
    .hero-features { gap: 1rem; flex-direction: column; align-items: center; }
    .feature { font-size: 0.8rem; padding: 0.4rem 0.8rem; }
    .orb { display: none; }
  }

  @media (max-width: 480px) {
    .hero-title { font-size: 2rem; }
    .hero-subtitle { font-size: 1rem; }
    .hero-content { padding: 1.5rem 1rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    .orb { animation: none; }
    .icon-glow { animation: none; }
    .sparkle-icon { animation: none; }
    .feature:hover { transform: none; }
  }
</style>
