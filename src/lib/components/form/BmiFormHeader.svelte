<!-- // Copyright (c) 2025 - 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script lang="ts">
	import { Calculator } from 'lucide-svelte';

	interface Props {
		ready: boolean;
		title: string;
		readyLabel: string;
		incompleteLabel: string;
		readyAria: string;
		incompleteAria: string;
	}

	let { ready, title, readyLabel, incompleteLabel, readyAria, incompleteAria }: Props = $props();
</script>

<div class="card-header">
	<div class="icon-container">
		<Calculator class="Calculator" />
	</div>
	<h2 class="card-title">{title}</h2>

	<div class="status-row">
		<span
			class="pill-indicator"
			tabindex="0"
			role="button"
			aria-label={ready ? readyAria : incompleteAria}
			data-color={ready ? 'green' : 'grey'}
		>
			<span class="dot" aria-hidden="true"></span>
			{ready ? readyLabel : incompleteLabel}
		</span>
	</div>
</div>
