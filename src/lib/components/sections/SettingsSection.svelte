<!-- // Copyright (c) 2025 - 2026 rezky_nightky -->
<script lang="ts">
  import { AlertTriangle } from 'lucide-svelte';
  import { t as _t, localeVersion } from '$lib/i18n';

  let { currentYear }: { currentYear: number } = $props();
  let _rv = $derived($localeVersion);
  function t(key: string, params?: Record<string, string | number | undefined | null>): string { void _rv; return _t(key, params); }
</script>

{#key $localeVersion}
<div class="main-container">
  <footer class="footer-disclaimer">
    <div class="disclaimer-icon">
      <AlertTriangle class="AlertTriangle" />
    </div>
    <p>
      {t('info.disclaimer')}
    </p>
  </footer>

  <div class="github-footer">
    <a
      href="https://github.com/oxyzenq/bmi"
      target="_blank"
      rel="noopener noreferrer"
      class="github-link"
    >
      <span>
        {t('info.copyright', { n: currentYear })}
      </span>
    </a>
  </div>
</div>
{/key}
