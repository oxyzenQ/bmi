<script lang="ts">
  import {
    Lightbulb, Users, GitBranch, GitCompare,
    PackageCheck, ShieldCheck, Activity, Scale
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
      <!-- What is BMI Card -->
      <div class="about-card">
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

      <!-- About Our App Card -->
      <div class="about-card">
        <div class="about-card-header">
          <Users class="Users" />
          <h3>{t('about.app_title')}</h3>
        </div>
        <div class="about-card-content">
          <p>
            {@html t('about.app_desc')}
          </p>
          <div class="app-info">
            <p class="info-row">
              <PackageCheck class="PackageCheck" />
              <strong>{t('about.version')}:</strong>Stellar v18.0 <span class="commit-id">({gitCommitId})</span>
            </p>
            <p class="info-row">
              <GitBranch class="GitBranch" />
              <strong>{t('about.branch')}:</strong>{gitBranch}
            </p>
            <p class="info-row">
              <GitCompare class="GitCompare" />
              <strong>{t('about.type_apps')}:</strong><span class="text-gradient-elegant">{t('about.open_source')}</span>
            </p>
            <p class="info-row">
              <ShieldCheck class="ShieldCheck" />
              <strong>{t('about.status')}:</strong>{t('about.status_stable')}
            </p>
            <p class="info-row">
              <Activity class="Activity" />
              <strong>{t('about.maintenance')}:</strong>{t('about.maintenance_active')}
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