<!-- // Copyright (c) 2025 - 2026 rezky_nightky -->
<script lang="ts">
	interface Props {
		recordCount: number;
		recordsLabel: string;
		encryptedLabel: string;
		kdfLabel: string;
		versionLabel: string;
	}

	let { recordCount, recordsLabel, encryptedLabel, kdfLabel, versionLabel }: Props = $props();
</script>

<div class="encrypt-summary">
	<div class="bmi-export-summary">
		<div class="bmi-export-summary__row">
			<span class="bmi-export-summary__key">{recordsLabel}</span>
			<span class="bmi-export-summary__val">{recordCount}</span>
		</div>
		<div class="bmi-export-summary__row">
			<span class="bmi-export-summary__key">{encryptedLabel}</span>
			<span class="bmi-export-summary__val bmi-export-summary__val--encrypted">AES-256-GCM</span>
		</div>
		<div class="bmi-export-summary__row">
			<span class="bmi-export-summary__key">{kdfLabel}</span>
			<span class="bmi-export-summary__val">Argon2id</span>
		</div>
		<div class="bmi-export-summary__row">
			<span class="bmi-export-summary__key">{versionLabel}</span>
			<span class="bmi-export-summary__val">v3</span>
		</div>
	</div>
</div>

<style>
	.encrypt-summary {
		margin-bottom: var(--space-4);
	}

	@media (hover: none) and (pointer: coarse) {
		:global(.bmi-export-summary) {
			-webkit-backdrop-filter: none !important;
			backdrop-filter: none !important;
			transition: none !important;
			transform: none !important;
			filter: none !important;
			text-shadow: none !important;
		}
	}
</style>
