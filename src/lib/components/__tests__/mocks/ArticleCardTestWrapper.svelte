<script lang="ts">
  import ArticleCard from '../../ArticleCard.svelte';
  import { Heart } from 'lucide-svelte';
  import type { ComponentType } from 'svelte';
  export let title = 'Test Article';
  export let description = 'Test description';
  export let icon: ComponentType = Heart;
  export let onCardOpen: (e: CustomEvent<{ title: string; description: string }>) => void = () => {};
</script>

<ArticleCard {title} {description} {icon} on:openModal={onCardOpen} />
