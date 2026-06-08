<!-- Copyright (C) 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script lang="ts">
	import { tick } from 'svelte';
	import NotifyFloat from '$lib/components/NotifyFloat.svelte';
	import { importBmiHistory } from '$lib/utils/history-io';

	type NotifyType = 'success' | 'delete' | 'warn' | 'error';

	interface Props {
		showNotify?: boolean;
		notifyType?: NotifyType;
		notifyMessage?: string;
		notifyButtonText?: string;
		pendingImportText?: string | null;
		onImportSuccess: () => void;
		onDeleteConfirmed: () => Promise<void>;
	}

	let {
		showNotify = $bindable(false),
		notifyType = $bindable<NotifyType>('success'),
		notifyMessage = $bindable(''),
		notifyButtonText = $bindable(''),
		pendingImportText = $bindable<string | null>(null),
		onImportSuccess,
		onDeleteConfirmed
	}: Props = $props();

	async function handleContinue() {
		if (notifyType === 'warn' && pendingImportText) {
			const result = await importBmiHistory(pendingImportText);
			pendingImportText = null;
			if (result.success) {
				const integrityMsg = result.integrityVerified
					? result.integrityVersion === 3
						? ' \u2713 Integrity verified (HMAC-SHA256)'
						: ' \u2713 Integrity verified (legacy)'
					: '';
				notifyType = 'success';
				notifyMessage = `Successfully imported ${result.count} record${result.count === 1 ? '' : 's'}!${integrityMsg}`;
				notifyButtonText = 'OK';
				onImportSuccess();
			} else {
				notifyType = 'delete';
				notifyMessage = result.error || 'Import failed.';
				notifyButtonText = 'OK';
			}
		} else if (notifyType === 'success') {
			showNotify = false;
		} else if (notifyType === 'error') {
			showNotify = false;
		} else if (notifyType === 'delete') {
			showNotify = false;
			await tick();
			await onDeleteConfirmed();
		}
	}

	function closeNotification() {
		pendingImportText = null;
		showNotify = false;
	}
</script>

{#if showNotify}
	<NotifyFloat
		show={showNotify}
		type={notifyType}
		message={notifyMessage}
		buttonText={notifyButtonText}
		onContinue={handleContinue}
		onClose={closeNotification}
		onCancel={closeNotification}
	/>
{/if}
