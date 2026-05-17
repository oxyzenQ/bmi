<!-- // Copyright (c) 2025 - 2026 rezky_nightky -->
<script lang="ts">
  import { AlertTriangle, Download, X } from 'lucide-svelte';
  import { dismissPwaInstallCard, promptPwaInstall, pwaInstallState } from '$lib/stores/pwa-install';
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

  {#if $pwaInstallState.checked && !$pwaInstallState.isInstalled && !$pwaInstallState.dismissed}
    <section class="pwa-install-card" aria-labelledby="pwa-install-title">
      <button class="pwa-install-dismiss" onclick={dismissPwaInstallCard} aria-label={t('pwa.dismiss')}>
        <X size={18} aria-hidden="true" />
      </button>
      <div class="pwa-install-icon" aria-hidden="true">
        <Download size={28} />
      </div>
      <div class="pwa-install-copy">
        <h2 id="pwa-install-title">{t('pwa.install_title')}</h2>
        <p>{t('pwa.install_description')}</p>
      </div>
      <button class="pwa-install-action" onclick={promptPwaInstall} disabled={!$pwaInstallState.canInstall}>
        <Download size={18} aria-hidden="true" />
        <span>{t('pwa.install_btn')}</span>
      </button>
    </section>
  {/if}

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
