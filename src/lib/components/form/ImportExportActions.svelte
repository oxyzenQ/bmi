<!-- Copyright (C) 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script lang="ts">
	import { ArrowDownToLine, ArrowUpFromLine, FileSpreadsheet } from 'lucide-svelte';

	interface Props {
		fileInputEl?: HTMLInputElement | null;
		isDragOver: boolean;
		importLabel: string;
		dropFileHereLabel: string;
		orChooseFileLabel: string;
		importAria: string;
		exportLabel: string;
		exportAria: string;
		exportCsvLabel: string;
		exportCsvAria: string;
		onFileInputChange: (event: Event) => void;
		onDragOver: (event: DragEvent) => void;
		onDragLeave: (event: DragEvent) => void;
		onDrop: (event: DragEvent) => void;
		onDropZoneClick: () => void;
		onExportClick: () => void;
		onExportCsv: () => void;
	}

	let {
		fileInputEl = $bindable<HTMLInputElement | null>(null),
		isDragOver,
		importLabel,
		dropFileHereLabel,
		orChooseFileLabel,
		importAria,
		exportLabel,
		exportAria,
		exportCsvLabel,
		exportCsvAria,
		onFileInputChange,
		onDragOver,
		onDragLeave,
		onDrop,
		onDropZoneClick,
		onExportClick,
		onExportCsv
	}: Props = $props();
</script>

<input
	type="file"
	accept=".json"
	bind:this={fileInputEl}
	onchange={onFileInputChange}
	class="sr-only"
	tabindex="-1"
	aria-hidden="true"
/>
<div
	class="bmi-drop-zone"
	class:bmi-drop-zone--active={isDragOver}
	role="button"
	tabindex="0"
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDrop}
	onclick={onDropZoneClick}
	onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onDropZoneClick()}
	aria-label={importAria}
>
	<div class="bmi-drop-zone__icon">
		<ArrowDownToLine size={28} />
	</div>
	<div class="bmi-drop-zone__text">
		{isDragOver ? dropFileHereLabel : importLabel}
	</div>
	<div class="bmi-drop-zone__subtext">{orChooseFileLabel}</div>
</div>

<div class="history-actions">
	<button type="button" class="btn btn-secondary" onclick={onExportClick} aria-label={exportAria}>
		<ArrowUpFromLine size={16} aria-hidden="true" />
		{exportLabel}
	</button>
	<button type="button" class="btn btn-secondary" onclick={onExportCsv} aria-label={exportCsvAria}>
		<FileSpreadsheet size={16} aria-hidden="true" />
		{exportCsvLabel}
	</button>
</div>

<style>
	.history-actions {
		display: flex;
		gap: 0.75rem;
		margin-top: 0.75rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.history-actions .btn {
		min-width: 120px;
		font-size: 0.8rem;
	}

	@media (hover: none) and (pointer: coarse) {
		.history-actions {
			contain: layout style;
		}
	}
</style>
