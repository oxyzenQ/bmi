<script lang="ts">
  import ArticleCard from '../../ArticleCard.svelte';
  import { Heart } from 'lucide-svelte';
  export let title = 'Test Article';
  export let description = 'Test description';
  export let icon: any = Heart;
  export let onCardOpen: (e: CustomEvent<{ title: string; description: string }>) => void = () => {};
</script>

<ArticleCard {title} {description} {icon} on:openModal={onCardOpen} />
