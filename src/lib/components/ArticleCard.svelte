<script lang="ts">
  import { ArrowRight, Heart, Activity, Utensils, Brain, Apple, Moon, Droplet, BedDouble, Stethoscope, Sun, Wind } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  export let title: string;
  export let description: string;
  export let icon: string;

  const dispatch = createEventDispatcher();

  function getIconComponent(iconName: string) {
    switch (iconName) {
      case 'fa6-solid:heart-pulse':
        return Heart;
      case 'fa6-solid:person-running':
        return Activity;
      case 'fa6-solid:utensils':
        return Utensils;
      case 'fa6-solid:brain':
        return Brain;
      case 'fa6-solid:apple-whole':
        return Apple;
      case 'fa6-solid:moon':
        return Moon;
      case 'fa6-solid:water':
        return Droplet;
      case 'fa6-solid:bed':
        return BedDouble;
      case 'fa6-solid:stethoscope':
        return Stethoscope;
      case 'fa6-solid:sun':
        return Sun;
      case 'fa6-solid:lungs':
        return Wind;
      default:
        return Heart;
    }
  }

  function handleClick() {
    dispatch('openModal', { title, description });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }
</script>

<button 
  type="button" 
  class="article-card liquid-glass" 
  on:click={handleClick} 
  on:keydown={handleKeydown}
  aria-label="Read full article: {title}"
>
  <div class="card-icon">
    <svelte:component this={getIconComponent(icon)} class="w-8 h-8" />
    <div class="icon-glow"></div>
  </div>
  
  <h3 class="card-title">{title}</h3>
  
  <p class="card-description">
    {description}
  </p>
  
  <div class="card-link">
    <span>Read Full Article</span>
    <ArrowRight class="w-4 h-4" />
  </div>
</button>

<style>
  .article-card {
    padding: 2rem;
    border-radius: 1.5rem;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    height: 100%;
    display: flex;
    flex-direction: column;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    position: relative;
    overflow: hidden;
  }

  .article-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, 
      rgba(96, 165, 250, 0.05), 
      rgba(168, 85, 247, 0.05)
    );
    border-radius: inherit;
    z-index: -1;
  }

  .article-card:hover {
    transform: translateY(-6px) scale(1.02);
  }

  .article-card:focus {
    outline: 2px solid #60a5fa;
    outline-offset: 2px;
  }

  .card-icon {
    position: relative;
    display: inline-block;
    margin-bottom: 1.5rem;
    color: #60a5fa;
  }

  .icon-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 50px;
    height: 50px;
    background: radial-gradient(circle, rgba(96, 165, 250, 0.2), transparent);
    border-radius: 50%;
    filter: blur(12px);
    animation: iconGlow 3s ease-in-out infinite alternate;
  }

  @keyframes iconGlow {
    0% {
      opacity: 0.3;
      transform: translate(-50%, -50%) scale(1);
    }
    100% {
      opacity: 0.6;
      transform: translate(-50%, -50%) scale(1.1);
    }
  }

  .card-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 1rem;
    line-height: 1.4;
    background: linear-gradient(135deg, #60a5fa, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .card-description {
    color: #d1d5db;
    font-size: 0.95rem;
    line-height: 1.6;
    margin-bottom: 2rem;
    flex: 1;
  }

  .card-link {
    color: #60a5fa;
    font-weight: 500;
    font-size: 0.9rem;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(96, 165, 250, 0.1);
    border-radius: 0.75rem;
    border: 1px solid rgba(96, 165, 250, 0.2);
    margin-top: auto;
  }

  .article-card:hover .card-link {
    color: #93c5fd;
    background: rgba(96, 165, 250, 0.15);
    border-color: rgba(96, 165, 250, 0.3);
    transform: translateX(4px);
  }

  @media (max-width: 768px) {
    .article-card {
      padding: 1.5rem;
      border-radius: 1.25rem;
    }

    .card-title {
      font-size: 1.125rem;
    }

    .card-description {
      font-size: 0.875rem;
    }

    .card-link {
      padding: 0.625rem 0.875rem;
      font-size: 0.85rem;
    }
  }

  @media (max-width: 480px) {
    .article-card {
      padding: 1.25rem;
    }

    .card-title {
      font-size: 1rem;
    }

    .card-description {
      font-size: 0.8rem;
    }
  }

  /* Reduce motion for users who prefer it */
  @media (prefers-reduced-motion: reduce) {
    .icon-glow {
      animation: none;
    }

    .article-card:hover {
      transform: none;
    }

    .article-card:hover .card-link {
      transform: none;
    }
  }
</style>
