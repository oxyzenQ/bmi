<!-- // Copyright (c) 2025 - 2026 rezky_nightky -->
<script lang="ts">
  import {
    Lightbulb, AlertTriangle, ListChecks, Database,
    LockKeyhole, HeartPulse, GitBranch, GitCompare,
    PackageCheck, ShieldCheck, Scale, Download
  } from 'lucide-svelte';
  import StagingSpinner from '$lib/components/StagingSpinner.svelte';
  import { promptPwaInstall, pwaInstallState } from '$lib/stores/pwa-install';
  import { applyPwaUpdate, checkForPwaUpdate, pwaUpdateState } from '$lib/stores/pwa-update';
  import { t as _t, localeVersion } from '$lib/i18n';
  import { getStellarVersionLabel, getAppVersionShort } from '$lib/utils/app-version';

  let { gitCommitId, gitBranch }: { gitCommitId: string; gitBranch: string } = $props();
  const appVersionTag = `v${getAppVersionShort()}`;
  let updateCheckingOverlay = $state(false);
  let _rv = $derived($localeVersion);
  function t(key: string, params?: Record<string, string | number | undefined | null>): string { void _rv; return _t(key, params); }

  async function handleManualUpdateCheck(): Promise<void> {
    if (updateCheckingOverlay) return;

    updateCheckingOverlay = true;
    await Promise.all([
      checkForPwaUpdate('manual'),
      new Promise((resolve) => setTimeout(resolve, 3000))
    ]);
    updateCheckingOverlay = false;
  }
</script>

{#key $localeVersion}
<!-- About BMI Section -->
<section class="about-bmi-section">
  <div class="main-container">

    <div class="about-bmi-grid">
      <!-- Merged info card: About BMI title through Encrypted Backup -->
      <div class="about-card about-card-merged">
        <!-- Section header: About BMI title -->
        <div class="about-section-block about-section-hero">
          <h2 class="about-hero-title">{t('about.title')}</h2>
          <p class="about-hero-subtitle">{t('about.subtitle')}</p>
        </div>

        <div class="about-section-divider"></div>

        <!-- What is BMI -->
        <div class="about-section-block">
          <div class="about-card-header">
            <Lightbulb class="Lightbulb" />
            <h3>{t('about.what_is_title')}</h3>
          </div>
          <div class="about-card-content">
            <p>
              {@html t('about.what_is_p1')}
            </p>
            <p>
              {@html t('about.what_is_p2')}
            </p>
            <p>
              {@html t('about.what_is_p3')}
            </p>
          </div>
        </div>

        <div class="about-section-divider"></div>

        <!-- About BMI Stellar -->
        <div class="about-section-block">
          <div class="about-card-header">
            <HeartPulse class="HeartPulse" />
            <h3>{t('about.app_title')}</h3>
          </div>
          <div class="about-card-content">
            <p>{@html t('about.app_desc')}</p>
          </div>
        </div>

        <div class="about-section-divider"></div>

        <!-- What BMI Can and Cannot Tell You -->
        <div class="about-section-block">
          <div class="about-card-header">
            <AlertTriangle class="AlertTriangle" />
            <h3>{t('about.limit_title')}</h3>
          </div>
          <div class="about-card-content">
            <p>{@html t('about.limit_p1')}</p>
            <p>{@html t('about.limit_p2')}</p>
          </div>
        </div>

        <div class="about-section-divider"></div>

        <!-- What BMI Stellar Calculates -->
        <div class="about-section-block">
          <div class="about-card-header">
            <ListChecks class="ListChecks" />
            <h3>{t('about.features_title')}</h3>
          </div>
          <div class="about-card-content">
            <p>{@html t('about.features_p1')}</p>
            <p>{@html t('about.features_p2')}</p>
          </div>
        </div>

        <div class="about-section-divider"></div>

        <!-- Privacy & Local Data -->
        <div class="about-section-block">
          <div class="about-card-header">
            <Database class="Database" />
            <h3>{t('about.privacy_title')}</h3>
          </div>
          <div class="about-card-content">
            <p>{@html t('about.privacy_p1')}</p>
            <p>{@html t('about.privacy_p2')}</p>
          </div>
        </div>

        <div class="about-section-divider"></div>

        <!-- Encrypted Backups -->
        <div class="about-section-block">
          <div class="about-card-header">
            <LockKeyhole class="LockKeyhole" />
            <h3>{t('about.backup_title')}</h3>
          </div>
          <div class="about-card-content">
            <p>{@html t('about.backup_p1')}</p>
            <p>{@html t('about.backup_p2')}</p>
          </div>
        </div>
      </div>

      {#if $pwaInstallState.checked}
        <section class="pwa-install-card" aria-labelledby="pwa-install-title">
          <div class="pwa-install-icon" class:pwa-installed={$pwaInstallState.isInstalled} aria-hidden="true">
            {#if $pwaInstallState.isInstalled}
              <PackageCheck size={30} />
            {:else}
              <Download size={30} />
            {/if}
          </div>
          <div class="pwa-install-copy">
            <h3 id="pwa-install-title">
              {$pwaInstallState.isInstalled ? t('pwa.installed_title') : t('pwa.install_title')}
            </h3>
            <p>
              {$pwaInstallState.isInstalled ? t('pwa.installed_description') : t('pwa.not_installed_description')}
            </p>
          </div>
          <div class="pwa-install-actions">
            {#if $pwaInstallState.isInstalled}
              <div class="pwa-install-status" aria-label={t('pwa.installed_title')}>
                <PackageCheck size={18} aria-hidden="true" />
                <span>{t('pwa.installed_btn')}</span>
              </div>
            {:else}
              <button class="pwa-install-action" onclick={promptPwaInstall} disabled={!$pwaInstallState.canInstall}>
                <Download size={18} aria-hidden="true" />
                <span>{t('pwa.install_btn')}</span>
              </button>
            {/if}

            {#if $pwaUpdateState.updateAvailable}
              <button class="pwa-install-action pwa-update-action" onclick={applyPwaUpdate}>
                <PackageCheck size={18} aria-hidden="true" />
                <span>{t('pwa.update_now')}</span>
              </button>
            {:else}
              <button class="pwa-install-action" onclick={handleManualUpdateCheck} disabled={$pwaUpdateState.checking || updateCheckingOverlay}>
                <PackageCheck size={18} aria-hidden="true" />
                <span>{$pwaUpdateState.checking || updateCheckingOverlay ? t('pwa.update_checking') : t('pwa.check_update')}</span>
              </button>
            {/if}
          </div>
        </section>
      {/if}

      <!-- Open Source & Release (separate card) -->
      <div class="about-card">
        <div class="about-card-header">
          <HeartPulse class="HeartPulse" />
          <h3>{t('about.opensource_title')}</h3>
        </div>
        <div class="about-card-content">
          <p>{@html t('about.opensource_p1')}</p>
          <p>{@html t('about.opensource_p2', { version: appVersionTag })}</p>
          <div class="app-info">
            <p class="info-row">
              <PackageCheck class="PackageCheck" />
              <strong>{t('about.version')}:</strong>{getStellarVersionLabel()} <span class="commit-id">({gitCommitId})</span>
            </p>
            {#if gitBranch !== 'main'}
            <p class="info-row">
              <GitBranch class="GitBranch" />
              <strong>{t('about.branch')}:</strong>{gitBranch}
            </p>
            {/if}
            <p class="info-row">
              <GitCompare class="GitCompare" />
              <strong>{t('about.type_apps')}:</strong><span class="text-gradient-elegant">{t('about.pwa_type')}</span>
            </p>
            <p class="info-row">
              <Database class="Database" />
              <strong>{t('about.data_model')}:</strong>{t('about.local_first')}
            </p>
            <p class="info-row">
              <LockKeyhole class="LockKeyhole" />
              <strong>{t('about.backup')}:</strong>{t('about.backup_optional')}
            </p>
            <p class="info-row">
              <ShieldCheck class="ShieldCheck" />
              <strong>{t('about.status')}:</strong>{t('about.status_release')}
            </p>
            <p class="info-row">
              <Scale class="Scale" />
              <strong>{t('about.license')}:</strong>GPL v3
            </p>
          </div>
        </div>
      </div>
    </div>

  </div>
</section>
<StagingSpinner show={updateCheckingOverlay} label={t('pwa.update_checking')} />
{/key}
