<script lang="ts">
  import { onMount } from 'svelte';
  import { Star, Sparkles } from 'lucide-svelte';

  let heroContent: HTMLDivElement;
  let bubbleContainer: HTMLDivElement;
  let deviceBubbleCount = 30;

  onMount(() => {
    // Device-adaptive bubble count based on performance capabilities
    const getDeviceBubbleCount = () => {
      const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
      const cores = navigator.hardwareConcurrency || 4;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      if (reducedMotion) return 0;
      if (memory <= 2 || cores <= 2) return 15;
      if (memory <= 4 || cores <= 4) return 25;
      return 35;
    };

    deviceBubbleCount = getDeviceBubbleCount();

    // Hero content animation
    if (heroContent) {
      heroContent.style.opacity = '0';
      heroContent.style.transform = 'translateY(20px)';
      setTimeout(() => {
        heroContent.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
        heroContent.style.opacity = '1';
        heroContent.style.transform = 'translateY(0)';
      }, 100);
    }

    // Dynamic bubble management for performance
    if (bubbleContainer && deviceBubbleCount > 0) {
      const bubbles = bubbleContainer.querySelectorAll('.bubble');
      bubbles.forEach((bubble, index) => {
        if (index >= deviceBubbleCount) {
          (bubble as HTMLElement).style.display = 'none';
        }
      });
    }

    // Pause animations when page is not visible
    const handleVisibilityChange = () => {
      const bubbles = document.querySelectorAll('.bubble');
      if (document.hidden) {
        bubbles.forEach(bubble => {
          (bubble as HTMLElement).style.animationPlayState = 'paused';
        });
      } else {
        bubbles.forEach(bubble => {
          (bubble as HTMLElement).style.animationPlayState = 'running';
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });
</script>

<header class="hero-section">
  <div class="hero-background">
    <div class="cosmic-orbs">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>
    
    <!-- Enhanced Bubble Effects -->
    <div class="bubble-container" bind:this={bubbleContainer}>
      <div class="bubble bubble-1"></div>
      <div class="bubble bubble-2"></div>
      <div class="bubble bubble-3"></div>
      <div class="bubble bubble-4"></div>
      <div class="bubble bubble-5"></div>
      <div class="bubble bubble-6"></div>
      <div class="bubble bubble-7"></div>
      <div class="bubble bubble-8"></div>
      <div class="bubble bubble-9"></div>
      <div class="bubble bubble-10"></div>
      <div class="bubble bubble-11"></div>
      <div class="bubble bubble-12"></div>
      <div class="bubble bubble-13"></div>
      <div class="bubble bubble-14"></div>
      <div class="bubble bubble-15"></div>
      <div class="bubble bubble-16"></div>
      <div class="bubble bubble-17"></div>
      <div class="bubble bubble-18"></div>
      <div class="bubble bubble-19"></div>
      <div class="bubble bubble-20"></div>
      <div class="bubble bubble-21"></div>
      <div class="bubble bubble-22"></div>
      <div class="bubble bubble-23"></div>
      <div class="bubble bubble-24"></div>
      <div class="bubble bubble-25"></div>
      <div class="bubble bubble-26"></div>
      <div class="bubble bubble-27"></div>
      <div class="bubble bubble-28"></div>
      <div class="bubble bubble-29"></div>
      <div class="bubble bubble-30"></div>
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
        <Star class="w-5 h-5 plasma-star star-1" />
        <span>Accurate Calculations</span>
      </div>
      <div class="feature">
        <Star class="w-5 h-5 plasma-star star-2" />
        <span>Health Insights</span>
      </div>
      <div class="feature">
        <Star class="w-5 h-5 plasma-star star-3" />
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

  /* Enhanced Bubble Effects */
  .bubble-container {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .bubble {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(96, 165, 250, 0.6), rgba(96, 165, 250, 0.2));
    animation: bubbleRise 12s linear infinite;
    pointer-events: none;
    will-change: transform;
    transform: translateZ(0);
    backface-visibility: hidden;
    contain: layout style paint;
    isolation: isolate;
    box-shadow: 0 0 20px rgba(96, 165, 250, 0.3), inset 0 0 10px rgba(255, 255, 255, 0.1);
    filter: blur(0.5px);
  }

  .bubble-1 {
    width: 28px;
    height: 28px;
    left: 8%;
    animation-delay: 0s;
  }

  .bubble-2 {
    width: 35px;
    height: 35px;
    left: 18%;
    animation-delay: -1.5s;
  }

  .bubble-3 {
    width: 40px;
    height: 40px;
    left: 28%;
    animation-delay: -3s;
  }

  .bubble-4 {
    width: 28px;
    height: 28px;
    left: 38%;
    animation-delay: -0.8s;
  }

  .bubble-5 {
    width: 20px;
    height: 20px;
    left: 48%;
    animation-delay: -2.2s;
  }

  .bubble-6 {
    width: 36px;
    height: 36px;
    left: 58%;
    animation-delay: -4.5s;
  }

  .bubble-7 {
    width: 26px;
    height: 26px;
    left: 68%;
    animation-delay: -1.2s;
  }

  .bubble-8 {
    width: 22px;
    height: 22px;
    left: 78%;
    animation-delay: -3.8s;
  }

  .bubble-9 {
    width: 30px;
    height: 30px;
    left: 88%;
    animation-delay: -0.4s;
  }

  .bubble-10 {
    width: 18px;
    height: 18px;
    left: 15%;
    animation-delay: -2.8s;
  }

  .bubble-11 {
    width: 34px;
    height: 34px;
    left: 42%;
    animation-delay: -1.8s;
  }

  .bubble-12 {
    width: 25px;
    height: 25px;
    left: 65%;
    animation-delay: -4.2s;
  }

  /* Additional bubbles for enhanced depth */
  .bubble-16 { width: 26px; height: 26px; left: 8%; animation-delay: -1.1s; }
  .bubble-17 { width: 32px; height: 32px; left: 22%; animation-delay: -3.6s; }
  .bubble-18 { width: 20px; height: 20px; left: 28%; animation-delay: -2.4s; }
  .bubble-19 { width: 24px; height: 24px; left: 36%; animation-delay: -4.8s; }
  .bubble-20 { width: 28px; height: 28px; left: 44%; animation-delay: -0.9s; }
  .bubble-21 { width: 22px; height: 22px; left: 52%; animation-delay: -2.7s; }
  .bubble-22 { width: 34px; height: 34px; left: 58%; animation-delay: -1.8s; }
  .bubble-23 { width: 18px; height: 18px; left: 66%; animation-delay: -3.2s; }
  .bubble-24 { width: 30px; height: 30px; left: 72%; animation-delay: -0.6s; }
  .bubble-25 { width: 24px; height: 24px; left: 79%; animation-delay: -2.1s; }
  .bubble-26 { width: 20px; height: 20px; left: 85%; animation-delay: -4.4s; }
  .bubble-27 { width: 36px; height: 36px; left: 12%; animation-delay: -1.5s; }
  .bubble-28 { width: 22px; height: 22px; left: 31%; animation-delay: -3.9s; }
  .bubble-29 { width: 26px; height: 26px; left: 47%; animation-delay: -2.0s; }
  .bubble-30 { width: 18px; height: 18px; left: 91%; animation-delay: -3.3s; }

  .bubble-13 {
    width: 29px;
    height: 29px;
    left: 82%;
    animation-delay: -0.6s;
  }

  .bubble-14 {
    width: 21px;
    height: 21px;
    left: 12%;
    animation-delay: -3.5s;
  }

  .bubble-15 {
    width: 33px;
    height: 33px;
    left: 72%;
    animation-delay: -2.5s;
  }

  @keyframes bubbleRise {
    0% {
      bottom: -80px;
      opacity: 0;
      transform: translateX(0) scale(0.2);
    }
    3% {
      opacity: 0.6;
      transform: translateX(8px) scale(0.4);
    }
    15% {
      opacity: 0.8;
      transform: translateX(-15px) scale(0.7);
    }
    35% {
      opacity: 0.9;
      transform: translateX(20px) scale(1);
    }
    55% {
      opacity: 0.85;
      transform: translateX(-10px) scale(1.1);
    }
    75% {
      opacity: 0.7;
      transform: translateX(12px) scale(0.9);
    }
    90% {
      opacity: 0.3;
      transform: translateX(-5px) scale(0.6);
    }
    100% {
      bottom: calc(120vh + 100px);
      opacity: 0;
      transform: translateX(0) scale(0.2);
    }
  }

  /* Blue Plasma Star Effects */
  :global(.plasma-star) {
    position: relative;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  :global(.plasma-star.star-1) {
    color: #60a5fa;
    filter: drop-shadow(0 0 6px rgba(96, 165, 250, 0.5));
    animation: plasmaStarGlow1 4s ease-in-out infinite;
  }

  :global(.plasma-star.star-2) {
    color: #3b82f6;
    filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.5));
    animation: plasmaStarGlow2 4s ease-in-out infinite 1.3s;
  }

  :global(.plasma-star.star-3) {
    color: #8b5cf6;
    filter: drop-shadow(0 0 6px rgba(139, 92, 246, 0.5));
    animation: plasmaStarGlow3 4s ease-in-out infinite 2.6s;
  }

  @keyframes plasmaStarGlow1 {
    0%, 100% {
      filter: drop-shadow(0 0 6px rgba(96, 165, 250, 0.5));
      transform: scale(1);
    }
    50% {
      filter: drop-shadow(0 0 12px rgba(96, 165, 250, 0.8)) drop-shadow(0 0 20px rgba(96, 165, 250, 0.4));
      transform: scale(1.05);
    }
  }

  @keyframes plasmaStarGlow2 {
    0%, 100% {
      filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.5));
      transform: scale(1);
    }
    50% {
      filter: drop-shadow(0 0 12px rgba(59, 130, 246, 0.8)) drop-shadow(0 0 20px rgba(59, 130, 246, 0.4));
      transform: scale(1.05);
    }
  }

  @keyframes plasmaStarGlow3 {
    0%, 100% {
      filter: drop-shadow(0 0 6px rgba(139, 92, 246, 0.5));
      transform: scale(1);
    }
    50% {
      filter: drop-shadow(0 0 12px rgba(139, 92, 246, 0.8)) drop-shadow(0 0 20px rgba(139, 92, 246, 0.4));
      transform: scale(1.05);
    }
  }

  .hero-content { max-width: 800px; margin: 0 auto; padding: 3rem 2rem; border-radius: 2rem; position: relative; overflow: hidden; }
  .hero-content::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(96, 165, 250, 0.1), rgba(168, 85, 247, 0.1)); border-radius: inherit; z-index: -1; }

  /* Glossy sweep overlay */
  .hero-content::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(135deg, rgba(96,165,250,0.06), rgba(168,85,247,0.04)),
      linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.12) 8%, rgba(255,255,255,0.28) 12%, rgba(255,255,255,0.12) 16%, transparent 24%);
    background-repeat: no-repeat, no-repeat;
    background-size: 100% 100%, 18% 140%;
    background-position: 0 0, -30% -20%;
    border-radius: inherit;
    pointer-events: none;
    animation: heroGloss 8s ease-in-out infinite;
    will-change: background-position;
    contain: layout style;
  }

  @keyframes heroGloss {
    0% { background-position: 0 0, -30% -20%; }
    10% { background-position: 0 0, 110% 120%; }
    100% { background-position: 0 0, 110% 120%; }
  }

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
  :global(.sparkle-icon) { 
    width: 2rem; height: 2rem; 
    color: #60a5fa; 
    filter: drop-shadow(0 0 8px rgba(96, 165, 250, 0.6)) drop-shadow(0 0 16px rgba(168, 85, 247, 0.4));
    animation: plasmaGlow 3s ease-in-out infinite;
    will-change: filter, transform;
    backface-visibility: hidden;
    transform: translateZ(0);
    contain: layout style paint;
  }


  @keyframes plasmaGlow {
    0%, 100% {
      filter: drop-shadow(0 0 8px rgba(96, 165, 250, 0.6)) drop-shadow(0 0 16px rgba(168, 85, 247, 0.4));
      transform: scale(1) translateZ(0);
    }
    50% {
      filter: drop-shadow(0 0 12px rgba(96, 165, 250, 0.8)) drop-shadow(0 0 24px rgba(168, 85, 247, 0.6));
      transform: scale(1.05) translateZ(0);
    }
  }

  .hero-subtitle { font-size: 1.25rem; color: #d1d5db; margin-bottom: 2rem; line-height: 1.6; max-width: 600px; margin-left: auto; margin-right: auto; font-weight: 400; }
  .hero-features { display: flex; justify-content: center; gap: 2rem; margin-bottom: 2rem; flex-wrap: wrap; }
  .feature { display: flex; align-items: center; gap: 0.5rem; color: #e5e7eb; font-size: 0.875rem; font-weight: 500; padding: 0.5rem 1rem; background: rgba(255, 255, 255, 0.05); border-radius: 2rem; border: 1px solid rgba(255, 255, 255, 0.1); transition: all 0.3s ease; }
  .feature:hover { background: rgba(255, 255, 255, 0.1); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); }

  @media (max-width: 768px) {
    .hero-section { padding: 2rem 1rem 1rem; min-height: 50vh; }
    .hero-content { padding: 2rem 1.5rem; border-radius: 1.5rem; }
    .hero-title { font-size: 2.5rem; flex-direction: column; gap: 0.5rem; }
    :global(.sparkle-icon) { width: 1.5rem; height: 1.5rem; }
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
    :global(.sparkle-icon) { animation: none; }
    :global(.plasma-star) { animation: none; }
    .bubble { animation: none; opacity: 0; }
    .feature:hover { transform: none; }
    .hero-content::after { animation: none; }
  }
</style>
