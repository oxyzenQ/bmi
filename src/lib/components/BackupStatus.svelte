<script lang="ts">
  /**
   * Backup Status Indicator — Shows last backup time and provides restore option.
   * Intended for use in the About section as a privacy/data management feature.
   */
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { t as _t, localeVersion } from '$lib/i18n';
  let _rv = $derived($localeVersion);
  // Reactive t() — reading _rv creates a dependency so template {t('key')} re-runs on locale change
  function t(key: string, params?: Record<string, string | number | undefined | null>): string { void _rv; return _t(key, params); }
  import { getBackupStatus, restoreLatestBackup, type BackupStatus } from '$lib/utils/backup';
  import { ShieldCheck, Database, RotateCcw, AlertTriangle } from 'lucide-svelte';

  let status = $state<BackupStatus | null>(null);
  let loading = $state(true);
  let showConfirm = $state(false);
  let restoreResult = $state<{ success: boolean; message: string } | null>(null);

  onMount(() => {
    if (!browser) return;
    void loadStatus();
  });

  async function loadStatus() {
    status = await getBackupStatus();
    loading = false;
  }

  async function handleRestore() {
    if (!showConfirm) {
      showConfirm = true;
      return;
    }

    showConfirm = false;
    loading = true;

    const success = await restoreLatestBackup();
    restoreResult = {
      success,
      message: success ? t('backup.restore_success') : t('backup.restore_failed')
    };

    if (success) {
      // Reload to show restored data
      window.location.reload();
    }

    loading = false;
  }

  function cancelRestore() {
    showConfirm = false;
  }
</script>

<div class="backup-status-container">
  <div class="backup-header">
    <Database size={18} aria-hidden="true" />
    <span class="backup-title">{t('backup.stored_locally')}</span>
  </div>

  {#if loading}
    <div class="backup-loading">{t('backup.checking')}</div>
  {:else if status?.hasBackup}
    <div class="backup-info">
      <span class="backup-icon-ok"><ShieldCheck size={16} aria-hidden="true" /></span>
      <span class="backup-time">
        {t('backup.last', { time: status.lastBackupAgo ?? 'unknown' })}
        {#if status.lastBackupRecordCount > 0}
          <span class="backup-records">({t('backup.records', { n: status.lastBackupRecordCount })})</span>
        {/if}
      </span>
    </div>

    {#if showConfirm}
      <div class="backup-confirm">
        <span class="backup-icon-warning"><AlertTriangle size={16} aria-hidden="true" /></span>
        <p class="backup-confirm-text">{t('backup.restore_confirm')}</p>
        <div class="backup-actions">
          <button class="backup-btn backup-btn-cancel" onclick={cancelRestore}>
            {t('notify.cancel')}
          </button>
          <button class="backup-btn backup-btn-confirm" onclick={handleRestore}>
            {t('backup.restore')}
          </button>
        </div>
      </div>
    {:else}
      <button class="backup-restore-btn" onclick={handleRestore}>
        <RotateCcw size={14} aria-hidden="true" />
        {t('backup.restore')}
      </button>
    {/if}

    {#if restoreResult}
      <div class="backup-result" class:success={restoreResult.success} class:error={!restoreResult.success}>
        {restoreResult.message}
      </div>
    {/if}
  {:else}
    <div class="backup-info backup-none">
      <span class="backup-time">{t('backup.none')}</span>
    </div>
    <div class="backup-hint">
      {t('backup.auto_hint')}
    </div>
  {/if}
</div>

<style>
  .backup-status-container {
    padding: 1rem;
    background: var(--k-50);
    border: var(--border-by-rezky);
    border-radius: 1rem;
    backdrop-filter: blur(8px) saturate(140%);
  }

  .backup-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    color: var(--cosmic-purple);
    font-weight: 500;
  }

  .backup-title {
    font-size: 0.9rem;
  }

  .backup-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--w-70);
  }

  .backup-icon-ok {
    display: inline-flex;
    color: var(--cat-green-90);
  }

  .backup-time {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .backup-records {
    color: var(--w-50);
    font-size: 0.8rem;
  }

  .backup-none {
    color: var(--w-50);
    font-style: italic;
  }

  .backup-hint {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--w-40);
    line-height: 1.4;
  }

  .backup-restore-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-top: 0.75rem;
    padding: 0.4rem 0.75rem;
    font-size: 0.8rem;
    color: var(--cosmic-purple);
    background: var(--w-6);
    border: 1px solid var(--w-12);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .backup-restore-btn:hover {
    background: var(--w-10);
    border-color: var(--w-20);
  }

  .backup-confirm {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: var(--darkred-10);
    border: 1px solid var(--darkred-30);
    border-radius: 0.5rem;
  }

  .backup-icon-warning {
    display: inline-flex;
    color: #f59e0b;
    margin-bottom: 0.25rem;
  }

  .backup-confirm-text {
    margin: 0 0 0.75rem 0;
    font-size: 0.8rem;
    color: var(--w-70);
    line-height: 1.4;
  }

  .backup-actions {
    display: flex;
    gap: 0.5rem;
  }

  .backup-btn {
    padding: 0.35rem 0.65rem;
    font-size: 0.75rem;
    border-radius: 0.4rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .backup-btn-cancel {
    color: var(--w-60);
    background: transparent;
    border: 1px solid var(--w-20);
  }

  .backup-btn-cancel:hover {
    background: var(--w-8);
  }

  .backup-btn-confirm {
    color: white;
    background: var(--cosmic-purple);
    border: 1px solid var(--cosmic-purple);
  }

  .backup-btn-confirm:hover {
    filter: brightness(1.15);
  }

  .backup-result {
    margin-top: 0.75rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
    border-radius: 0.4rem;
  }

  .backup-result.success {
    color: var(--cat-green-90);
    background: rgba(34, 197, 94, 0.1);
  }

  .backup-result.error {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .backup-loading {
    font-size: 0.85rem;
    color: var(--w-50);
    font-style: italic;
  }
</style>
