<script lang="ts">
  import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-svelte';
  import { exportBmiHistory, importBmiHistory } from '$lib/utils/history-io';

  interface Props {
    onNotify?: (type: 'success' | 'delete', message: string) => void;
  }

  let { onNotify }: Props = $props();

  let fileInputEl: HTMLInputElement | undefined = $state();

  function formatDate(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async function handleExport() {
    const json = await exportBmiHistory();
    if (!json) {
      onNotify?.('delete', 'No history to export.');
      return;
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bmi-history-${formatDate()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputEl?.click();
  }

  async function handleFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await importBmiHistory(text);

      if (result.success) {
        onNotify?.('success', `Imported ${result.count} record${result.count === 1 ? '' : 's'} successfully.`);
      } else {
        onNotify?.('delete', `Import failed: ${result.error}`);
      }
    } catch {
      onNotify?.('delete', 'Import failed: Could not read the file.');
    }

    // Reset file input so same file can be re-imported
    input.value = '';
  }
</script>

<div class="history-actions">
  <button type="button" class="btn btn-secondary" onclick={handleExport} aria-label="Export BMI history">
    <ArrowDownToLine size={16} aria-hidden="true" />
    Export
  </button>

  <input
    type="file"
    bind:this={fileInputEl}
    accept=".json"
    class="sr-only"
    onchange={handleFileChange}
    tabindex="-1"
    aria-hidden="true"
  />

  <button type="button" class="btn btn-secondary" onclick={handleImportClick} aria-label="Import BMI history">
    <ArrowUpFromLine size={16} aria-hidden="true" />
    Import
  </button>
</div>

<style>
  .history-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .history-actions .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
