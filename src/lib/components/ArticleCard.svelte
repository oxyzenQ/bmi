<script lang="ts">
  import { createEventDispatcher, type ComponentType } from 'svelte';
  import { ArrowRight } from 'lucide-svelte';

  export let title: string;
  export let description: string;
  // Pass a Svelte component (e.g., a lucide-svelte icon component)
  export let icon: ComponentType | null = null;

  const dispatch = createEventDispatcher();

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
    {#if icon}
      <svelte:component this={icon} class="w-8 h-8" />
    {/if}
    <div class="icon-glow"></div>
  </div>
  
  <h3 class="card-title">{title}</h3>
  
  <p class="card-description">
    {description}
  </p>
  
  <div class="card-link">
    <span>Read Full Article</span>
    <ArrowRight class="w-5 h-5" />
  </div>
</button>

