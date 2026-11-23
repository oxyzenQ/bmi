<!-- SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ) -->
<!-- SPDX-License-Identifier: AGPL-3.0-only OR Commercial -->

<script lang="ts">
	import { AlertTriangle } from 'lucide-svelte';
	import { t as _t, localeVersion } from '$lib/i18n';
	import { BMI_STELLAR_SIGNATURE_BUILDER } from '$lib/utils/signature';

	let { currentYear }: { currentYear: number } = $props();
	let _rv = $derived($localeVersion);
	function t(key: string, params?: Record<string, string | number | undefined | null>): string {
		void _rv;
		return _t(key, params);
	}
</script>

{#key $localeVersion}
	<div class="main-container">
		<footer class="footer-disclaimer">
			<div class="disclaimer-icon">
				<AlertTriangle class="AlertTriangle" />
			</div>
			<p>
				{t('info.disclaimer')}
			</p>
		</footer>

		<div class="github-footer">
			<a
				href="https://github.com/oxyzenQ/bmi"
				target="_blank"
				rel="noopener noreferrer"
				class="github-link"
			>
				<span>
					{t('info.copyright', { n: currentYear, author: BMI_STELLAR_SIGNATURE_BUILDER })}
				</span>
			</a>
		</div>
	</div>
{/key}
