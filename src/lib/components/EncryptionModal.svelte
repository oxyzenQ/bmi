<!-- // Copyright (c) 2025 - 2026 rezky_nightky -->
<script lang="ts">
	/**
	 * Encryption Modal for Secure Export/Import
	 * - Export: Passphrase + Confirm (mandatory) + Hint (optional) + Strength meter
	 * - Import: Passphrase only (auto-detect encrypted file) + Hint display
	 *
	 * Strength meter uses zxcvbn (entropy-based, pattern detection).
	 * Passphrase hint stored in localStorage only (never exported).
	 */
	import { tick, untrack, onMount } from 'svelte';
	import { t as _t, localeVersion } from '$lib/i18n';
	import { analyzeStrength, getPassphraseHint, setPassphraseHint } from '$lib/utils/crypto';
	import type { StrengthResult } from '$lib/utils/crypto';
	import {
		getEncryptionErrorDescriptionKey,
		getEncryptionErrorSeverity
	} from '$lib/utils/encryption-modal-helpers';
	import type {
		EncryptionErrorSeverity,
		EncryptionImportMeta,
		EncryptionMode
	} from '$lib/types/encryption-modal';
	import { warnDev } from '$lib/utils/warn-dev';
	import EncryptionActions from './encryption/EncryptionActions.svelte';
	import EncryptionErrorMessage from './encryption/EncryptionErrorMessage.svelte';
	import EncryptionModalHeader from './encryption/EncryptionModalHeader.svelte';
	import EncryptionProgress from './encryption/EncryptionProgress.svelte';
	import EncryptionTrustMeta from './encryption/EncryptionTrustMeta.svelte';
	import ExportSummary from './encryption/ExportSummary.svelte';
	import ImportHintDisplay from './encryption/ImportHintDisplay.svelte';
	import ImportMetaPanel from './encryption/ImportMetaPanel.svelte';
	import PasswordFields from './encryption/PasswordFields.svelte';
	let _rv = $derived($localeVersion);
	function t(key: string, params?: Record<string, string | number | undefined | null>): string {
		void _rv;
		return _t(key, params);
	}

	interface Props {
		show?: boolean;
		mode: EncryptionMode;
		error?: string;
		/** Structured error code for severity-based styling */
		errorCode?: string;
		importMeta?: EncryptionImportMeta;
		/** Number of records that will be exported (shown in export summary) */
		exportRecordCount?: number;
		onConfirm: (passphrase: string) => void;
		onCancel: () => void;
	}

	let {
		show = false,
		mode,
		error = '',
		errorCode,
		importMeta,
		exportRecordCount = 0,
		onConfirm,
		onCancel
	}: Props = $props();

	// Local state - NOT reset via $effect to avoid infinite loops
	let passphrase = $state('');
	let confirmPassphrase = $state('');
	let passphraseHint = $state('');
	let visible = $state(false);
	let modalKey = $state(0);
	let backdropEl: HTMLDivElement | null = $state(null);
	let localError = $state('');
	let loading = $state(false);
	let focusTrapHandler: ((e: KeyboardEvent) => void) | null = null;
	let isTouchDevice = $state(false);

	// Passphrase visibility toggles (separate states for each field)
	let showPassphrase = $state(false);
	let showConfirmPassphrase = $state(false);

	// Real strength analysis (zxcvbn-based, async)
	let strengthResult = $state<StrengthResult | null>(null);
	let strengthScore = $derived(strengthResult?.score ?? 0);

	// Debounced strength analysis (avoid heavy zxcvbn on every keystroke)
	let strengthTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		// Read passphrase to create dependency
		const pw = passphrase;
		if (strengthTimer) clearTimeout(strengthTimer);
		if (!pw) {
			strengthResult = null;
			return;
		}
		if (isTouchDevice && pw.length < 8) {
			strengthResult = null;
			return;
		}
		const delay = isTouchDevice ? 700 : 200;
		strengthTimer = setTimeout(async () => {
			try {
				strengthResult = await analyzeStrength(pw);
			} catch (err) {
				warnDev('EncryptionModal', 'strengthEffect', 'Strength analysis failed', err);
				strengthResult = null;
			}
		}, delay);

		return () => {
			if (strengthTimer) clearTimeout(strengthTimer);
		};
	});

	// Load hint on mount
	onMount(() => {
		isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
		passphraseHint = getPassphraseHint();
	});

	// Derive error severity from errorCode for differentiated UX
	let errorSeverity: EncryptionErrorSeverity = $derived(
		getEncryptionErrorSeverity(errorCode, Boolean(localError))
	);

	let errorDescription = $derived.by(() => {
		if (localError) return '';
		const descriptionKey = getEncryptionErrorDescriptionKey(errorCode);
		return descriptionKey ? t(descriptionKey) : '';
	});

	// Combine local error with parent error prop (reactive)
	let errorMsg = $derived(localError || error);

	// Track previous show value to detect changes without causing reactive loops
	let prevShow = $state(false);

	// Handle modal open/close transition - runs when show changes
	$effect(() => {
		const currentShow = show;
		const wasShown = untrack(() => prevShow);

		if (currentShow && !wasShown) {
			// Modal is opening - reset form state
			untrack(() => {
				passphrase = '';
				confirmPassphrase = '';
				localError = '';
				loading = false;
				showPassphrase = false;
				showConfirmPassphrase = false;
				strengthResult = null;
				passphraseHint = getPassphraseHint();
				modalKey += 1;
			});
			// Trigger animation with micro-delay token for smoother UX
			const openTimer = setTimeout(() => {
				visible = true;
			}, 120); /* --delay-open */
			return () => {
				clearTimeout(openTimer);
			};
		} else if (!currentShow && wasShown) {
			// Modal is closing
			visible = false;
		}

		prevShow = currentShow;
	});

	// Handle focus trap when visible changes
	$effect(() => {
		if (!visible || !backdropEl || !backdropEl.isConnected) {
			if (focusTrapHandler) {
				document.removeEventListener('keydown', focusTrapHandler);
				focusTrapHandler = null;
			}
			return;
		}

		// Setup focus trap
		focusTrapHandler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				handleCancel();
				return;
			}
			if (e.key !== 'Tab' || !backdropEl) return;

			const focusable = Array.from(
				backdropEl.querySelectorAll<HTMLElement>(
					'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
				)
			).filter((el) => !el.hasAttribute('disabled') && el.tabIndex >= 0);

			if (focusable.length === 0) return;

			const first = focusable[0];
			const last = focusable[focusable.length - 1];

			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		};

		document.addEventListener('keydown', focusTrapHandler);

		// Auto-focus first input
		const focusTimer = setTimeout(() => {
			if (backdropEl) {
				const firstInput = backdropEl.querySelector('input');
				firstInput?.focus();
			}
		}, 120); /* --delay-open */

		return () => {
			clearTimeout(focusTimer);
			if (focusTrapHandler) {
				document.removeEventListener('keydown', focusTrapHandler);
				focusTrapHandler = null;
			}
		};
	});

	function validate(): boolean {
		if (!passphrase.trim()) {
			localError = t('crypto.error_empty');
			return false;
		}
		if (mode === 'export' && passphrase !== confirmPassphrase) {
			localError = t('crypto.error_mismatch');
			return false;
		}
		localError = '';
		return true;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (loading) return; // prevent double submit
		if (!validate()) return;

		loading = true;
		localError = '';

		// Save hint locally (export only)
		if (mode === 'export') {
			setPassphraseHint(passphraseHint);
		}

		// Force DOM flush so the loading spinner renders before async work.
		await tick();

		// Minimum spinner visible time
		const MIN_SPINNER_TIME = 300;
		const start = performance.now();

		try {
			await onConfirm(passphrase);
		} catch (err) {
			localError = err instanceof Error ? err.message : t('form.import_failed');
		} finally {
			const elapsed = performance.now() - start;
			const remaining = MIN_SPINNER_TIME - elapsed;
			if (remaining > 0) {
				await new Promise((r) => setTimeout(r, remaining));
			}
			loading = false;
		}
	}

	function handleCancel() {
		passphrase = '';
		confirmPassphrase = '';
		localError = '';
		loading = false;
		onCancel();
	}

	const title = $derived(mode === 'export' ? t('crypto.export_title') : t('crypto.import_title'));
	const iconColor = $derived(mode === 'export' ? 'var(--cosmic-purple)' : 'var(--cat-green-90)');
</script>

{#if show}
	{#key modalKey}
		<div
			bind:this={backdropEl}
			class="encrypt-backdrop"
			class:visible
			role="dialog"
			aria-modal="true"
			aria-label={title}
		>
			<div class="encrypt-box">
				<EncryptionModalHeader {mode} {title} {iconColor} />

				{#if mode === 'export'}
					<EncryptionTrustMeta
						badgeLabel={t('crypto.encryption_badge')}
						warningLabel={t('crypto.strong_warning')}
						warningHighlight={t('crypto.strong_warning_highlight')}
					/>
				{/if}

				<form onsubmit={handleSubmit} class="encrypt-form">
					{#if mode === 'import' && importMeta}
						<ImportMetaPanel
							meta={importMeta}
							statusLabel={t('crypto.meta_status')}
							encryptedLabel={t('crypto.meta_encrypted')}
							unencryptedLabel={t('crypto.meta_unencrypted')}
							dateLabel={t('crypto.meta_date')}
							recordsLabel={t('crypto.meta_records')}
							versionLabel={t('crypto.meta_version')}
						/>
					{/if}

					<!-- Import hint display (local only) -->
					{#if mode === 'import' && passphraseHint}
						<ImportHintDisplay label={t('crypto.hint_import_label')} hint={passphraseHint} />
					{/if}

					<PasswordFields
						{mode}
						bind:passphrase
						bind:confirmPassphrase
						bind:passphraseHint
						bind:showPassphrase
						bind:showConfirmPassphrase
						{loading}
						{strengthScore}
						{strengthResult}
						passphraseLabel={t('crypto.passphrase_label')}
						passphrasePlaceholder={t('crypto.passphrase_placeholder')}
						confirmLabel={t('crypto.confirm_label')}
						confirmPlaceholder={t('crypto.confirm_placeholder')}
						hintLabel={t('crypto.hint_label')}
						hintPlaceholder={t('crypto.hint_placeholder')}
						showPassphraseLabel={t('crypto.show_passphrase')}
						hidePassphraseLabel={t('crypto.hide_passphrase')}
					/>

					{#if errorMsg}
						<EncryptionErrorMessage
							message={errorMsg}
							description={errorDescription}
							severity={errorSeverity}
						/>
					{/if}

					{#if loading}
						<EncryptionProgress />
					{/if}

					{#if mode === 'export' && !loading}
						<ExportSummary
							recordCount={exportRecordCount}
							recordsLabel={t('crypto.export_summary_records')}
							encryptedLabel={t('crypto.export_summary_encrypted')}
							kdfLabel={t('crypto.export_summary_kdf')}
							versionLabel={t('crypto.export_summary_version')}
						/>
					{/if}

					<EncryptionActions
						{mode}
						{loading}
						cancelLabel={t('notify.cancel')}
						exportLabel={t('form.export')}
						unlockImportLabel={t('crypto.unlock_import')}
						processingLabel={t('crypto.processing')}
						onCancel={handleCancel}
					/>
				</form>
			</div>
		</div>
	{/key}
{/if}

<style>
	.encrypt-backdrop {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--glass-bg-nightky, rgba(0, 0, 0, 0.65));
		-webkit-backdrop-filter: blur(24px) saturate(140%);
		backdrop-filter: blur(24px) saturate(140%);
		z-index: var(--z-modal);
		opacity: 0;
		transition: opacity var(--modal-backdrop-dur, 0.15s) ease;
		pointer-events: none;
		/* Ensure full viewport coverage on mobile */
		min-height: 100vh;
		min-height: 100dvh;
		min-width: 100vw;
	}

	.encrypt-backdrop.visible {
		opacity: 1;
		pointer-events: auto;
	}

	/* iOS Safari: stronger blur for mobile */
	@supports (-webkit-touch-callout: none) {
		.encrypt-backdrop {
			-webkit-backdrop-filter: blur(32px) saturate(160%);
			backdrop-filter: blur(32px) saturate(160%);
			background: var(--glass-bg-nightky, rgba(0, 0, 0, 0.65));
		}
	}

	.encrypt-box {
		background: var(--glass-bg-nightky, rgba(0, 0, 0, 0.65));
		border: var(--border-by-rezky);
		border-radius: var(--modal-panel-radius);
		padding: 2rem;
		min-width: 340px;
		max-width: 90vw;
		max-height: min(calc(100dvh - 2rem), 760px);
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		touch-action: pan-y pinch-zoom;
		scrollbar-width: none;
		-webkit-backdrop-filter: blur(24px) saturate(140%);
		backdrop-filter: blur(24px) saturate(140%);

		opacity: 0;
		transform: var(--modal-panel-scale-from, scale(0.96) translateY(8px));
		transition:
			transform var(--modal-dur, 0.22s) var(--modal-ease, cubic-bezier(0.34, 1.56, 0.64, 1)),
			opacity var(--modal-dur, 0.22s) var(--modal-ease, cubic-bezier(0.34, 1.56, 0.64, 1));
	}

	.encrypt-backdrop.visible .encrypt-box {
		opacity: 1;
		transform: var(--modal-panel-scale-to, scale(1) translateY(0));
	}

	.encrypt-box::-webkit-scrollbar {
		display: none;
	}

	@media (max-width: 480px) {
		.encrypt-box {
			min-width: auto;
			width: calc(100vw - 2rem);
			max-height: calc(100dvh - 2rem);
			margin: 0 1rem;
			padding: 1.5rem;
		}
	}

	@media (hover: none) and (pointer: coarse) {
		.encrypt-backdrop {
			background: rgba(0, 0, 0, 0.68) !important;
			-webkit-backdrop-filter: none !important;
			backdrop-filter: none !important;
			transition: none !important;
		}

		.encrypt-box {
			background: rgba(0, 0, 0, 0.8) !important;
			-webkit-backdrop-filter: none !important;
			backdrop-filter: none !important;
			transform: none !important;
			transition: none !important;
			contain: none !important;
			overflow-y: auto;
		}

		.encrypt-backdrop.visible .encrypt-box {
			transform: none !important;
		}
	}
</style>
