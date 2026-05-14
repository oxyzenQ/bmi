<script lang="ts">
  import { Settings } from 'lucide-svelte';
  import { t } from '$lib/i18n';

  let { show = false }: { show: boolean } = $props();
</script>

{#if show}
  <div class="staging-backdrop staging-visible">
    <div class="staging-spinner-wrap">
      <Settings class="staging-gear-icon" size={48} />
      <span class="staging-text">{t('crypto.preparing')}</span>
    </div>
  </div>
{/if}