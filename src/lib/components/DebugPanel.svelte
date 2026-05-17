<!-- // Copyright (c) 2025 - 2026 rezky_nightky -->
<script lang="ts">
  /**
   * DebugPanel — v16.0 Observability
   *
   * Dev-only floating debug panel with three tabs:
   *   1. Logs — Real-time log viewer from structured logger ring buffer
   *   2. System — App info (version, git, storage, encryption, perf tier)
   *   3. Storage — Live key-value browser with expandable values
   *
   * Only rendered in development mode. Completely eliminated in production.
   * Toggled via floating button or `window.__bmi_debug_panel.toggle()`.
   */

  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { logger, type LogEntry, type LogLevel } from '$lib/utils/logger';
  import { getSessionTraceId } from '$lib/utils/trace';
  import { STORAGE_KEYS, storageGet, isStorageAvailable } from '$lib/utils/storage';
  import { isIndexedDbAvailable } from '$lib/utils/db';
  import { getEncryptionStatus } from '$lib/utils/crypto';
  import { getBackupStatus } from '$lib/utils/backup';
  import { getPerformanceTier } from '$lib/utils/animation-config';
  import { FileText, Cpu, Database, Trash2, ChevronRight, X } from 'lucide-svelte';

  // Guard: never render in production
  if (import.meta.env.PROD || !browser) {
    // Empty stub — Svelte compiler will tree-shake this
  }

  type Tab = 'logs' | 'system' | 'storage';

  let isOpen = $state(false);
  let activeTab = $state<Tab>('logs');
  let logFilter = $state<LogLevel | 'ALL'>('ALL');
  let logs = $state<LogEntry[]>([]);
  let autoScroll = $state(true);
  let expandedKeys = $state<Set<string>>(new Set());
  let systemInfo = $state<SystemInfo | null>(null);
  let storageEntries = $state<Array<{ key: string; value: string | null }>>([]);
  let panelEl: HTMLDivElement | undefined = $state(undefined);

  interface SystemInfo {
    appVersion: string;
    gitCommit: string;
    gitBranch: string;
    buildTime: string;
    sessionTraceId: string;
    localStorageAvailable: boolean;
    indexedDbAvailable: boolean;
    encryptionEnabled: boolean;
    encryptionHasPassphrase: boolean;
    performanceTier: string;
    backupStatus: {
      hasBackup: boolean;
      lastBackupAgo: string | null;
      totalBackups: number;
    };
    logCount: number;
    bufferMax: number;
  }

  function refreshLogs(): void {
    const entries = logFilter === 'ALL' ? logger.getEntries() : logger.getEntriesByLevel(logFilter);
    logs = [...entries];
  }

  async function refreshSystemInfo(): Promise<void> {
    try {
      const encStatus = await getEncryptionStatus();
      const backupStat = await getBackupStatus();
      systemInfo = {
        appVersion: '18.0.0',
        gitCommit: typeof __GIT_COMMIT_ID__ !== 'undefined' ? __GIT_COMMIT_ID__ : 'unknown',
        gitBranch: typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : 'unknown',
        buildTime: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'unknown',
        sessionTraceId: getSessionTraceId(),
        localStorageAvailable: isStorageAvailable(),
        indexedDbAvailable: isIndexedDbAvailable(),
        encryptionEnabled: encStatus.enabled,
        encryptionHasPassphrase: encStatus.hasPassphrase,
        performanceTier: getPerformanceTier(),
        backupStatus: {
          hasBackup: backupStat.hasBackup,
          lastBackupAgo: backupStat.lastBackupAgo,
          totalBackups: backupStat.totalBackups,
        },
        logCount: logger.getEntries().length,
        bufferMax: 200,
      };
    } catch (err) {
      logger.warn('debug-panel', 'refreshSystemInfo', 'Failed to refresh system info', err);
    }
  }

  function refreshStorage(): void {
    try {
      storageEntries = Object.values(STORAGE_KEYS)
        .map((key) => ({ key, value: storageGet(key) }))
        .sort((a, b) => a.key.localeCompare(b.key));
    } catch (err) {
      logger.warn('debug-panel', 'refreshStorage', 'Failed to refresh storage', err);
    }
  }

  function toggleKey(key: string): void {
    if (expandedKeys.has(key)) {
      expandedKeys.delete(key);
    } else {
      expandedKeys.add(key);
    }
    expandedKeys = expandedKeys; // trigger reactivity
  }

  function formatValue(val: string | null): string {
    if (val === null) return '(null)';
    try {
      const parsed = JSON.parse(val);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return val;
    }
  }

  function togglePanel(): void {
    isOpen = !isOpen;
    if (isOpen) {
      refreshLogs();
      refreshSystemInfo();
      refreshStorage();
      // Auto-scroll to bottom on open
      requestAnimationFrame(() => {
        if (autoScroll && panelEl) {
          const logContainer = panelEl.querySelector('.dp-logs-list');
          if (logContainer) {
            logContainer.scrollTop = logContainer.scrollHeight;
          }
        }
      });
    }
  }

  function switchTab(tab: Tab): void {
    activeTab = tab;
    if (tab === 'logs') refreshLogs();
    if (tab === 'system') refreshSystemInfo();
    if (tab === 'storage') refreshStorage();
  }

  function clearLogs(): void {
    logger.clear();
    logs = [];
  }

  const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
    DEBUG: 'var(--cyan-60, #06b6d4)',
    INFO: 'var(--green-50, #22c55e)',
    WARN: 'var(--amber-50, #f59e0b)',
    ERROR: 'var(--red-50, #ef4444)',
  };

  onMount(() => {
    if (import.meta.env.PROD || !browser) return;

    // Expose toggle on window for console access
    (window as unknown as Record<string, { toggle: () => void }>).__bmi_debug_panel = { toggle: togglePanel };

    // Auto-refresh logs every 2s when panel is open
    const interval = setInterval(() => {
      if (isOpen && activeTab === 'logs') {
        refreshLogs();
      }
    }, 2000);

    return () => clearInterval(interval);
  });
</script>

{#if !import.meta.env.PROD && browser}
  <!-- Panel Overlay -->
  {#if isOpen}
    <div class="dp-overlay" onclick={togglePanel} onkeydown={(e) => e.key === 'Escape' && togglePanel()} role="presentation"></div>

    <!-- Panel -->
    <div class="dp-panel" bind:this={panelEl} role="dialog" aria-label="Debug Panel">
      <!-- Header -->
      <div class="dp-header">
        <div class="dp-title">
        <span>Debug Panel</span>
          <span class="dp-badge">v16.0</span>
        </div>
        <button class="dp-close" onclick={togglePanel} aria-label="Close">
          <X size={14} />
        </button>
      </div>

      <!-- Tabs -->
      <div class="dp-tabs">
        <button class="dp-tab" class:active={activeTab === 'logs'} onclick={() => switchTab('logs')}>
          <FileText size={12} />
          <span>Logs</span>
          {#if logs.length > 0}
            <span class="dp-tab-count">{logs.length}</span>
          {/if}
        </button>
        <button class="dp-tab" class:active={activeTab === 'system'} onclick={() => switchTab('system')}>
          <Cpu size={12} />
          <span>System</span>
        </button>
        <button class="dp-tab" class:active={activeTab === 'storage'} onclick={() => switchTab('storage')}>
          <Database size={12} />
          <span>Storage</span>
        </button>
      </div>

      <!-- Tab Content -->
      <div class="dp-content">
        {#if activeTab === 'logs'}
          <!-- Log Controls -->
          <div class="dp-controls">
            <select class="dp-select" value={logFilter} onchange={(e) => { logFilter = (e.target as HTMLSelectElement).value as LogLevel | 'ALL'; refreshLogs(); }}>
              <option value="ALL">All Levels</option>
              <option value="DEBUG">Debug</option>
              <option value="INFO">Info</option>
              <option value="WARN">Warn</option>
              <option value="ERROR">Error</option>
            </select>
            <label class="dp-auto-scroll">
              <input type="checkbox" checked={autoScroll} onchange={() => (autoScroll = !autoScroll)} />
              <span>Auto-scroll</span>
            </label>
            <button class="dp-btn-clear" onclick={clearLogs} title="Clear all logs">
              <Trash2 size={12} />
            </button>
          </div>

          <!-- Log Entries -->
          <div class="dp-logs-list">
            {#if logs.length === 0}
              <div class="dp-empty">No log entries yet.</div>
            {:else}
              {#each logs.slice().reverse() as entry (entry.timestamp + entry.seq)}
                <div class="dp-log-entry" class:dp-log-error={entry.level === 'ERROR'}>
                  <div class="dp-log-header">
                    <span class="dp-log-level" style="color:{LOG_LEVEL_COLORS[entry.level]}">{entry.level}</span>
                    <span class="dp-log-module">[{entry.module}:{entry.fn}]</span>
                    {#if entry.spanId}
                      <span class="dp-log-span" title="Trace span">{entry.spanId.slice(0, 16)}</span>
                    {/if}
                    <span class="dp-log-seq">#{entry.seq}</span>
                  </div>
                  <div class="dp-log-message">{entry.message}</div>
                  {#if entry.error}
                    <div class="dp-log-error-detail">
                      <span class="dp-log-error-name">{entry.error.name}:</span> {entry.error.message}
                    </div>
                  {/if}
                  {#if entry.data}
                    <div class="dp-log-data">{JSON.stringify(entry.data)}</div>
                  {/if}
                  <div class="dp-log-time">{entry.timestamp}</div>
                </div>
              {/each}
            {/if}
          </div>

        {:else if activeTab === 'system'}
          {#if systemInfo}
            <div class="dp-system-grid">
              <div class="dp-system-row">
                <span class="dp-label">App Version</span>
                <span class="dp-value">{systemInfo.appVersion}</span>
              </div>
              <div class="dp-system-row">
                <span class="dp-label">Git Commit</span>
                <span class="dp-value mono">{systemInfo.gitCommit}</span>
              </div>
              <div class="dp-system-row">
                <span class="dp-label">Git Branch</span>
                <span class="dp-value mono">{systemInfo.gitBranch}</span>
              </div>
              <div class="dp-system-row">
                <span class="dp-label">Build Time</span>
                <span class="dp-value mono">{systemInfo.buildTime}</span>
              </div>
              <div class="dp-system-row">
                <span class="dp-label">Session Trace</span>
                <span class="dp-value mono">{systemInfo.sessionTraceId}</span>
              </div>
              <div class="dp-system-divider"></div>
              <div class="dp-system-row">
                <span class="dp-label">localStorage</span>
                <span class="dp-value" class:ok={systemInfo.localStorageAvailable} class:err={!systemInfo.localStorageAvailable}>
                  {systemInfo.localStorageAvailable ? 'Available' : 'Unavailable'}
                </span>
              </div>
              <div class="dp-system-row">
                <span class="dp-label">IndexedDB</span>
                <span class="dp-value" class:ok={systemInfo.indexedDbAvailable} class:err={!systemInfo.indexedDbAvailable}>
                  {systemInfo.indexedDbAvailable ? 'Available' : 'Unavailable'}
                </span>
              </div>
              <div class="dp-system-row">
                <span class="dp-label">Encryption</span>
                <span class="dp-value" class:ok={systemInfo.encryptionEnabled}>
                  {systemInfo.encryptionEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div class="dp-system-row">
                <span class="dp-label">Perf Tier</span>
                <span class="dp-value">{systemInfo.performanceTier}</span>
              </div>
              <div class="dp-system-row">
                <span class="dp-label">Backups</span>
                <span class="dp-value">
                  {systemInfo.backupStatus.hasBackup
                    ? `${systemInfo.backupStatus.totalBackups} backup(s), last: ${systemInfo.backupStatus.lastBackupAgo ?? 'unknown'}`
                    : 'No backups'}
                </span>
              </div>
              <div class="dp-system-divider"></div>
              <div class="dp-system-row">
                <span class="dp-label">Log Buffer</span>
                <span class="dp-value">{systemInfo.logCount} / {systemInfo.bufferMax}</span>
              </div>
            </div>
          {:else}
            <div class="dp-empty">Loading system info...</div>
          {/if}

        {:else if activeTab === 'storage'}
          <div class="dp-storage-list">
            {#if storageEntries.length === 0}
              <div class="dp-empty">No storage entries.</div>
            {:else}
              {#each storageEntries as entry (entry.key)}
                <div class="dp-storage-item">
                  <button class="dp-storage-key" onclick={() => toggleKey(entry.key)} aria-expanded={expandedKeys.has(entry.key)}>
                    <ChevronRight size={12} style={expandedKeys.has(entry.key) ? 'transform: rotate(90deg)' : ''} />
                    <span class="mono">{entry.key}</span>
                  </button>
                  {#if expandedKeys.has(entry.key)}
                    <pre class="dp-storage-value">{formatValue(entry.value)}</pre>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
{/if}

<style>
  /* ── Overlay ── */
  .dp-overlay {
    position: fixed;
    inset: 0;
    z-index: 9998;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(2px);
  }

  /* ── Panel ── */
  .dp-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: var(--z-modal);
    max-height: 60vh;
    display: flex;
    flex-direction: column;
    background: var(--cosmic-base-95, #0f0b1e);
    border-top: 1px solid var(--w-10, rgba(255, 255, 255, 0.1));
    border-radius: var(--container-radius) var(--container-radius) 0 0;
    
    animation: dpSlideUp 0.2s ease-out;
    font-size: 0.8rem;
  }

  @keyframes dpSlideUp {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  /* ── Header ── */
  .dp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 1rem;
    border-bottom: 1px solid var(--w-10, rgba(255, 255, 255, 0.06));
    flex-shrink: 0;
  }

  .dp-title {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--w-90, #f1f5f9);
    font-weight: 600;
    font-size: 0.85rem;
  }

  .dp-badge {
    font-size: 0.6rem;
    font-weight: 500;
    padding: 0.1rem 0.35rem;
    border-radius: var(--radius-pill);
    background: var(--violet-80, rgba(139, 92, 246, 0.3));
    color: var(--violet-40, #c4b5fd);
  }

  .dp-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: var(--radius-xs);
    background: transparent;
    color: var(--w-50, #94a3b8);
    cursor: pointer;
    transition: background var(--dur-micro) ease, color var(--dur-micro) ease;
  }

  .dp-close:hover {
    background: var(--w-10, rgba(255, 255, 255, 0.06));
    color: var(--w-90, #f1f5f9);
  }

  .dp-close:focus-visible {
    outline: 2px solid var(--violet-42);
    outline-offset: 1px;
  }

  /* ── Tabs ── */
  .dp-tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0.4rem 1rem;
    border-bottom: 1px solid var(--w-10, rgba(255, 255, 255, 0.06));
    flex-shrink: 0;
  }

  .dp-tab {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.7rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--w-50, #94a3b8);
    background: transparent;
    border: none;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: background var(--dur-micro) ease, color var(--dur-micro) ease;
  }

  .dp-tab:hover {
    background: var(--w-8, rgba(255, 255, 255, 0.05));
    color: var(--w-70, #cbd5e1);
  }

  .dp-tab.active {
    background: var(--violet-80, rgba(139, 92, 246, 0.2));
    color: var(--violet-40, #c4b5fd);
  }

  .dp-tab-count {
    font-size: 0.6rem;
    padding: 0 0.3rem;
    border-radius: var(--radius-pill);
    background: var(--w-10, rgba(255, 255, 255, 0.1));
    color: var(--w-60, #94a3b8);
    min-width: 16px;
    text-align: center;
  }

  /* ── Content ── */
  .dp-content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 0;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y pinch-zoom;
  }

  /* ── Log Controls ── */
  .dp-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 1rem 0.5rem;
  }

  .dp-select {
    font-size: 0.7rem;
    padding: 0.2rem 0.4rem;
    border-radius: var(--radius-xs);
    border: 1px solid var(--w-15, rgba(255, 255, 255, 0.12));
    background: var(--w-8, rgba(255, 255, 255, 0.05));
    color: var(--w-80, #e2e8f0);
  }

  .dp-auto-scroll {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.7rem;
    color: var(--w-50, #94a3b8);
    cursor: pointer;
    user-select: none;
  }

  .dp-auto-scroll input {
    accent-color: var(--violet-50, #8b5cf6);
  }

  .dp-btn-clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: var(--radius-xs);
    background: transparent;
    color: var(--w-40, #64748b);
    cursor: pointer;
    margin-left: auto;
    transition: background var(--dur-micro) ease, color var(--dur-micro) ease;
  }

  .dp-btn-clear:hover {
    background: var(--red-80, rgba(239, 68, 68, 0.15));
    color: var(--red-50, #ef4444);
  }

  /* ── Log List ── */
  .dp-logs-list {
    padding: 0 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-height: 35vh;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y pinch-zoom;
  }

  .dp-log-entry {
    padding: 0.4rem 0.5rem;
    border-radius: var(--radius-xs);
    background: var(--w-5, rgba(255, 255, 255, 0.02));
    border: 1px solid transparent;
    transition: border-color var(--dur-instant) ease;
  }

  .dp-log-entry:hover {
    border-color: var(--w-10, rgba(255, 255, 255, 0.06));
  }

  .dp-log-entry.dp-log-error {
    border-color: rgba(239, 68, 68, 0.15);
    background: rgba(239, 68, 68, 0.04);
  }

  .dp-log-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .dp-log-level {
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    min-width: 36px;
  }

  .dp-log-module {
    font-size: 0.7rem;
    color: var(--violet-50, #8b5cf6);
    font-family: var(--font-mono-short, monospace);
  }

  .dp-log-span {
    font-size: 0.6rem;
    color: var(--cyan-60, #06b6d4);
    font-family: var(--font-mono-short, monospace);
    opacity: 0.6;
  }

  .dp-log-seq {
    font-size: 0.6rem;
    color: var(--w-30, #64748b);
    margin-left: auto;
  }

  .dp-log-message {
    font-size: 0.75rem;
    color: var(--w-80, #e2e8f0);
    margin-top: 0.15rem;
    word-break: break-word;
  }

  .dp-log-error-detail {
    font-size: 0.65rem;
    color: var(--red-50, #ef4444);
    margin-top: 0.15rem;
  }

  .dp-log-error-name {
    font-weight: 600;
  }

  .dp-log-data {
    font-size: 0.6rem;
    color: var(--w-40, #64748b);
    font-family: var(--font-mono-short, monospace);
    margin-top: 0.15rem;
    word-break: break-all;
  }

  .dp-log-time {
    font-size: 0.55rem;
    color: var(--w-25, #475569);
    margin-top: 0.1rem;
  }

  /* ── System Grid ── */
  .dp-system-grid {
    padding: 0.5rem 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .dp-system-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .dp-label {
    font-size: 0.75rem;
    color: var(--w-50, #94a3b8);
    flex-shrink: 0;
  }

  .dp-value {
    font-size: 0.75rem;
    color: var(--w-80, #e2e8f0);
    text-align: right;
    word-break: break-all;
  }

  .dp-value.mono {
    font-family: var(--font-mono-short, monospace);
    font-size: 0.7rem;
  }

  .dp-value.ok {
    color: var(--green-50, #22c55e);
  }

  .dp-value.err {
    color: var(--red-50, #ef4444);
  }

  .dp-system-divider {
    height: 1px;
    background: var(--w-10, rgba(255, 255, 255, 0.06));
    margin: 0.2rem 0;
  }

  /* ── Storage List ── */
  .dp-storage-list {
    padding: 0.5rem 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .dp-storage-item {
    border-radius: var(--radius-xs);
    overflow: hidden;
  }

  .dp-storage-key {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    width: 100%;
    padding: 0.35rem 0.5rem;
    font-size: 0.75rem;
    color: var(--violet-40, #c4b5fd);
    background: transparent;
    border: none;
    border-radius: var(--radius-xs);
    cursor: pointer;
    text-align: left;
    transition: background var(--dur-micro) ease;
  }

  .dp-storage-key:hover {
    background: var(--w-8, rgba(255, 255, 255, 0.05));
  }

  .dp-storage-value {
    font-size: 0.65rem;
    color: var(--w-50, #94a3b8);
    background: var(--w-5, rgba(255, 255, 255, 0.02));
    border-radius: var(--radius-xs);
    padding: 0.4rem 0.5rem 0.4rem 1.5rem;
    margin: 0.15rem 0 0.25rem;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 150px;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y pinch-zoom;
    margin: 0;
  }

  /* ── Empty state ── */
  .dp-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    font-size: 0.8rem;
    color: var(--w-30, #64748b);
  }

  /* ── Utilities ── */
  .mono {
    font-family: var(--font-mono-short, monospace);
  }

  @media (prefers-reduced-motion: reduce) {
    .dp-panel {
      animation: none;
    }
  }

  @media (hover: none) and (pointer: coarse) {
    .dp-overlay {
      background: rgba(0, 0, 0, 0.68);
      backdrop-filter: none;
    }

    .dp-panel {
      background: rgba(0, 0, 0, 0.80);
      animation: none;
      transform: none;
      transition: none;
      contain: none;
    }

    .dp-close,
    .dp-tab,
    .dp-btn-clear,
    .dp-storage-key {
      transition: none;
      transform: none;
      touch-action: manipulation;
    }

    .dp-content,
    .dp-logs-list,
    .dp-storage-value {
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      touch-action: pan-y pinch-zoom;
    }
  }

  /* ── Responsive: on wider screens, dock to bottom-right ── */
  @media (min-width: 640px) {
    .dp-panel {
      right: 1rem;
      left: auto;
      bottom: 1rem;
      width: 420px;
      max-height: 50vh;
      border-radius: var(--container-radius);
      border-top: 1px solid var(--w-10, rgba(255, 255, 255, 0.1));
    }

    @keyframes dpSlideUp {
      from {
        transform: translateY(20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  }
</style>
