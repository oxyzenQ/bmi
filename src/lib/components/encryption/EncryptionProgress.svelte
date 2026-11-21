<!-- Copyright (C) 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
	import DnaHelix from '$lib/components/DnaHelix.svelte';
</script>

<div class="encrypt-progress-wrap">
	<DnaHelix size={36} />
</div>

<style>
	.encrypt-progress-wrap {
		display: flex;
		justify-content: center;
		margin-bottom: 1rem;
	}
</style>
