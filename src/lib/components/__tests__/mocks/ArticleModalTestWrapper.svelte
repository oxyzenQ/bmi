<script lang="ts">
  import ArticleModal from '../../ArticleModal.svelte';
  export let title = 'Test Article';
  export let content = '<p>Test content</p>';
  let isOpen = true;
  function handleClose() {
    isOpen = false;
    // Also re-dispatch on document for optional spying
    document.dispatchEvent(new CustomEvent('close'));
  }
</script>

<ArticleModal {isOpen} {title} {content} on:close={handleClose} />
