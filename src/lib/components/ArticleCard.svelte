<script lang="ts">
  import { createEventDispatcher, type ComponentType } from 'svelte';
  import { ArrowRight } from 'lucide-svelte';

  export let title: string;
  export let description: string;
  // Pass a Svelte component (e.g., a lucide-svelte icon component)
  export let icon: ComponentType | null = null;
  export let iconClass: string = '';

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
  class="article-card" 
  on:click={handleClick} 
  on:keydown={handleKeydown}
  aria-label="Read full article: {title}"
>
  <div class="icon-slot">
    {#if icon}
      <svelte:component this={icon} class={iconClass} />
    {/if}
  </div>
  
  <h3 class="card-title">{title}</h3>
  
  <p class="card-description">
    {description}
  </p>
  
  <div class="card-link">
    <span>Read Full Article</span>
    <ArrowRight class="ArrowRight" />
  </div>
</button>