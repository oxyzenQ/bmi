<script lang="ts">
  import { ArrowRight, Heart, Activity, Utensils, Brain, Apple, Moon, Droplet, BedDouble, Stethoscope, Sun, Wind, Dna, FlaskConical, Leaf } from 'lucide-svelte';
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
      case 'fa6-solid:dna':
        return Dna;
      case 'fa6-solid:flask':
        return FlaskConical;
      case 'fa6-solid:leaf':
        return Leaf;
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

