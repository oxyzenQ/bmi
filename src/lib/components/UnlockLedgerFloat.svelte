<!-- SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ) -->
<!-- SPDX-License-Identifier: AGPL-3.0-only OR Commercial -->

<script lang="ts">
	/**
	 * UnlockLedgerFloat (night-cafe-10): the cold-load door for a
	 * sealed, locked ledger. One passphrase field, one honest verb -
	 * the passphrase is proven against the stored verifier through
	 * unlockAtRestSessionIfVerified before any seat installs. A wrong
	 * passphrase keeps the ledger exactly as locked as before.
	 */
	import { tick, untrack } from 'svelte';
	import { LockKeyhole } from 'lucide-svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import { t as _t, localeVersion } from '$lib/i18n';
	import { attemptLedgerUnlock } from '$lib/utils/at-rest-unlock';
	import { warnDev } from '$lib/utils/warn-dev';

	let _rv = $derived($localeVersion);
	function t(key: string): string {
		void _rv;
		return _t(key);
	}

	interface Props {
		show: boolean;
		onUnlocked: () => void;
		onDismiss: () => void;
	}

	let { show, onUnlocked, onDismiss }: Props = $props();

	let passphrase = $state('');
	let error = $state('');
	let loading = $state(false);
	let visible = $state(false);
	let shellKey = $state(0);
	let backdropEl: HTMLDivElement | null = $state(null);
	let prevShow = $state(false);

	$effect(() => {
		const currentShow = show;
		const wasShown = untrack(() => prevShow);
		if (currentShow && !wasShown) {
			untrack(() => {
				passphrase = '';
				error = '';
				loading = false;
				shellKey += 1;
			});
			const timer = setTimeout(() => {
				visible = true;
			}, 60);
			return () => clearTimeout(timer);
		} else if (!currentShow && wasShown) {
			visible = false;
		}
		prevShow = currentShow;
	});

	$effect(() => {
		if (!visible) return;
		const timer = setTimeout(() => {
			// The field carries a stable id, so the focus pass does not
			// need to hold a typed element reference across the tick.
			document.getElementById('unlock-passphrase')?.focus();
		}, 120);
		return () => clearTimeout(timer);
	});

	async function handleSubmit(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (loading) return;
		if (!passphrase.trim()) {
			error = t('crypto.error_empty');
			return;
		}
		loading = true;
		error = '';
		await tick();
		try {
			const unlocked = await attemptLedgerUnlock(passphrase);
			if (unlocked) {
				passphrase = '';
				onUnlocked();
			} else {
				error = t('crypto.error_wrong_passphrase_desc');
			}
		} catch (err) {
			warnDev('UnlockLedgerFloat', 'handleSubmit', 'Ledger unlock failed', err);
			error = t('crypto.error_wrong_passphrase_desc');
		} finally {
			loading = false;
		}
	}

	function handleCancel(): void {
		passphrase = '';
		error = '';
		loading = false;
		onDismiss();
	}
</script>

<ModalShell
	{show}
	onclose={handleCancel}
	panelMinWidth="min(420px, 92vw)"
	ariaLabel={t('crypto.unlock_title')}
>
	{#key shellKey}
		<div class="unlock-float">
			<div class="unlock-header">
				<div class="unlock-icon" aria-hidden="true">
					<LockKeyhole size={28} strokeWidth={1.5} />
				</div>
				<h2 class="unlock-title">{t('crypto.unlock_title')}</h2>
				<p class="unlock-description">{t('crypto.unlock_description')}</p>
			</div>

			<form class="unlock-form" onsubmit={handleSubmit}>
				<label class="unlock-label" for="unlock-passphrase">{t('crypto.passphrase_label')}</label>
				<input
					id="unlock-passphrase"
					class="unlock-input"
					type="password"
					autocomplete="current-password"
					bind:value={passphrase}
					placeholder={t('crypto.passphrase_placeholder')}
					disabled={loading}
				/>

				{#if error}
					<p class="unlock-error" role="alert">{error}</p>
				{/if}

				<div class="unlock-actions">
					<button type="button" class="unlock-later" onclick={handleCancel} disabled={loading}>
						<span>{t('crypto.unlock_later')}</span>
					</button>
					<button type="submit" class="unlock-submit" disabled={loading || !passphrase.trim()}>
						<span>{loading ? t('crypto.processing') : t('crypto.unlock_action')}</span>
					</button>
				</div>
			</form>
		</div>
	{/key}
</ModalShell>

<style>
	.unlock-float {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.unlock-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		text-align: center;
	}
	.unlock-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--violet-300-solid);
	}
	.unlock-title {
		font-size: var(--text-2xl);
		font-weight: 600;
		color: var(--w-95);
		margin: 0;
	}
	.unlock-description {
		font-size: var(--text-base);
		line-height: 1.55;
		color: var(--w-50);
		margin: 0;
		max-width: 34ch;
	}
	.unlock-form {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.unlock-label {
		font-size: var(--text-sm);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--w-50);
	}
	.unlock-input {
		width: 100%;
		padding: 0.7rem 0.9rem;
		font-size: var(--text-base);
		color: var(--w-95);
		background: var(--w-5);
		border: 1px solid var(--w-15);
		border-radius: var(--radius-lg);
		outline: none;
		transition: border-color 0.15s ease;
	}
	.unlock-input:focus {
		border-color: var(--violet-300-solid);
	}
	.unlock-error {
		font-size: var(--text-sm);
		color: var(--cat-red-solid);
		margin: 0;
	}
	.unlock-actions {
		display: flex;
		justify-content: center;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}
	.unlock-later,
	.unlock-submit {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.6rem 1.4rem;
		font-size: var(--text-base);
		font-weight: 600;
		border-radius: var(--radius-pill);
		cursor: pointer;
		white-space: nowrap;
		transition:
			opacity 0.15s ease,
			background 0.15s ease;
	}
	.unlock-later {
		color: var(--w-70);
		background: var(--w-10);
		border: 1px solid var(--w-15);
	}
	.unlock-submit {
		color: var(--stellar-white);
		background: var(--violet-300-solid);
		border: 1px solid transparent;
	}
	.unlock-submit:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.unlock-later:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
</style>
