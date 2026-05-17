<!-- // Copyright (c) 2025 - 2026 rezky_nightky -->
<script lang="ts">
  import { Settings } from 'lucide-svelte';
  import { t } from '$lib/i18n';

  let { show = false, label = '' }: { show: boolean; label?: string } = $props();
</script>

{#if show}
  <div class="staging-backdrop staging-visible">
    <div class="staging-spinner-wrap">
      <Settings class="staging-gear-icon" size={48} />
      <span class="staging-text">{label || t('crypto.preparing')}</span>
    </div>
  </div>
{/if}
