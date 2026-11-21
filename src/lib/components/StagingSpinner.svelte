<!-- Copyright (C) 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
	import { t } from '$lib/i18n';
	import DnaHelix from '$lib/components/DnaHelix.svelte';

	let { show = false, label = '' }: { show: boolean; label?: string } = $props();
</script>

{#if show}
	<div class="staging-backdrop staging-visible">
		<div class="staging-spinner-wrap">
			<DnaHelix size={48} />
			<span class="staging-text">{label || t('crypto.preparing')}</span>
		</div>
	</div>
{/if}
