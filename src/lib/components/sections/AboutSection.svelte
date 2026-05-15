<script lang="ts">
  import {
    Lightbulb, AlertTriangle, ListChecks, Database,
    LockKeyhole, HeartPulse, GitBranch, GitCompare,
    PackageCheck, ShieldCheck, Scale
  } from 'lucide-svelte';
  import { t as _t, localeVersion } from '$lib/i18n';

  let { gitCommitId, gitBranch }: { gitCommitId: string; gitBranch: string } = $props();
  let _rv = $derived($localeVersion);
  function t(key: string, params?: Record<string, string | number | undefined | null>): string { void _rv; return _t(key, params); }
</script>

{#key $localeVersion}
<!-- About BMI Section -->
<section class="about-bmi-section">
  <div class="main-container">
    <div class="section-header-v2">
      <h2 class="title">{t('about.title')}</h2>
      <p class="subtitle">{t('about.subtitle')}</p>
    </div>

    <div class="about-bmi-grid">
      <!-- Merged info card: About BMI through Encrypted Backup -->
      <div class="about-card about-card-merged">
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

      <!-- Open Source & Release (separate card) -->
      <div class="about-card">
        <div class="about-card-header">
          <HeartPulse class="HeartPulse" />
          <h3>{t('about.opensource_title')}</h3>
        </div>
        <div class="about-card-content">
          <p>{@html t('about.opensource_p1')}</p>
          <p>{@html t('about.opensource_p2')}</p>
          <div class="app-info">
            <p class="info-row">
              <PackageCheck class="PackageCheck" />
              <strong>{t('about.version')}:</strong>Stellar v20.0 <span class="commit-id">({gitCommitId})</span>
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
{/key}
