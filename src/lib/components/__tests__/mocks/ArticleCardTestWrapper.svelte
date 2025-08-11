<script lang="ts">
  import ArticleCard from '../../ArticleCard.svelte';
  export let title = 'Test Article';
  export let description = 'Test description';
  export let icon = 'fa6-solid:heart';
  export let onCardOpen: (e: CustomEvent<{ title: string; description: string }>) => void = () => {};
</script>

<ArticleCard {title} {description} {icon} on:openModal={onCardOpen} />
