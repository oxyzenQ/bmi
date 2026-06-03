<!-- Copyright (C) 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script lang="ts">
	import { Eye, EyeOff, Lightbulb } from 'lucide-svelte';
	import type { StrengthResult } from '$lib/utils/crypto';
	import type { EncryptionMode } from '$lib/types/encryption-modal';
	import StrengthMeter from '../StrengthMeter.svelte';

	interface Props {
		mode: EncryptionMode;
		passphrase?: string;
		confirmPassphrase?: string;
		passphraseHint?: string;
		showPassphrase?: boolean;
		showConfirmPassphrase?: boolean;
		loading: boolean;
		strengthScore: number;
		strengthResult: StrengthResult | null;
		passphraseLabel: string;
		passphrasePlaceholder: string;
		confirmLabel: string;
		confirmPlaceholder: string;
		hintLabel: string;
		hintPlaceholder: string;
		showPassphraseLabel: string;
		hidePassphraseLabel: string;
	}

	let {
		mode,
		passphrase = $bindable(''),
		confirmPassphrase = $bindable(''),
		passphraseHint = $bindable(''),
		showPassphrase = $bindable(false),
		showConfirmPassphrase = $bindable(false),
		loading,
		strengthScore,
		strengthResult,
		passphraseLabel,
		passphrasePlaceholder,
		confirmLabel,
		confirmPlaceholder,
		hintLabel,
		hintPlaceholder,
		showPassphraseLabel,
		hidePassphraseLabel
	}: Props = $props();
</script>

<div class="encrypt-fields">
	<input type="text" name="username" autocomplete="username" class="sr-only" tabindex="-1" />
	<div class="field-group">
		<label for="passphrase">{passphraseLabel}</label>
		<div class="input-wrapper">
			<input
				id="passphrase"
				type={showPassphrase ? 'text' : 'password'}
				bind:value={passphrase}
				placeholder={passphrasePlaceholder}
				class="encrypt-input"
				autocomplete="new-password"
				disabled={loading}
			/>
			<button
				type="button"
				class="eye-btn"
				onclick={() => (showPassphrase = !showPassphrase)}
				aria-label={showPassphrase ? hidePassphraseLabel : showPassphraseLabel}
			>
				{#if showPassphrase}
					<EyeOff size={18} />
				{:else}
					<Eye size={18} />
				{/if}
			</button>
		</div>
		<StrengthMeter
			visible={Boolean(passphrase) && mode === 'export'}
			score={strengthScore}
			result={strengthResult}
		/>
	</div>

	{#if mode === 'export'}
		<div class="field-group">
			<label for="confirm-passphrase">{confirmLabel}</label>
			<div class="input-wrapper">
				<input
					id="confirm-passphrase"
					type={showConfirmPassphrase ? 'text' : 'password'}
					bind:value={confirmPassphrase}
					placeholder={confirmPlaceholder}
					class="encrypt-input"
					autocomplete="new-password"
					disabled={loading}
				/>
				<button
					type="button"
					class="eye-btn"
					onclick={() => (showConfirmPassphrase = !showConfirmPassphrase)}
					aria-label={showConfirmPassphrase ? hidePassphraseLabel : showPassphraseLabel}
				>
					{#if showConfirmPassphrase}
						<EyeOff size={18} />
					{:else}
						<Eye size={18} />
					{/if}
				</button>
			</div>
		</div>

		<div class="field-group">
			<label for="passphrase-hint">
				<Lightbulb size={14} style="display: inline; vertical-align: -2px; margin-right: 4px;" />
				{hintLabel}
			</label>
			<input
				id="passphrase-hint"
				type="text"
				bind:value={passphraseHint}
				placeholder={hintPlaceholder}
				class="encrypt-input encrypt-input--hint"
				disabled={loading}
			/>
		</div>
	{/if}
</div>

<style>
	.encrypt-fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.field-group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.field-group label {
		font-size: var(--text-base);
		font-weight: 500;
		color: var(--w-70);
	}

	.input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.encrypt-input {
		width: 100%;
		padding: var(--space-3) 1rem;
		padding-right: 2.75rem;
		font-size: var(--text-md);
		line-height: 1.5;
		border: 1px solid var(--w-20);
		border-radius: var(--btn-radius);
		background: var(--w-4);
		color: var(--w-95);
		transition: border-color var(--dur-micro) ease;
	}

	.encrypt-input--hint {
		padding-right: 1rem;
		font-size: var(--text-base);
	}

	.encrypt-input:disabled {
		opacity: 0.5;
		background: var(--w-8);
	}

	.encrypt-input:focus {
		outline: none;
		border-color: var(--violet-50);
	}

	.encrypt-input::placeholder {
		color: var(--w-40);
	}

	.eye-btn {
		position: absolute;
		right: 0.5rem;
		top: calc(50% - 1rem);
		transform: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		background: var(--btn-bg);
		border: 1px solid rgba(130, 130, 130, 0.3);
		border-radius: var(--control-radius);
		color: var(--stellar-white);
		cursor: pointer;
		transition: all var(--dur-micro) ease;
		z-index: var(--z-inner-control);
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
	}

	.eye-btn :global(svg) {
		width: 18px !important;
		height: 18px !important;
		display: block !important;
		visibility: visible !important;
		stroke: white !important;
		stroke-width: 2;
		fill: none;
		flex-shrink: 0;
		overflow: visible;
	}

	.eye-btn:hover {
		color: var(--stellar-white);
		background: var(--btn-bg-hover);
		border-color: rgba(130, 130, 130, 0.45);
	}

	.eye-btn:active {
		transform: none;
	}

	@media (hover: none) and (pointer: coarse) {
		.encrypt-input,
		.eye-btn {
			-webkit-backdrop-filter: none !important;
			backdrop-filter: none !important;
			transition: none !important;
			transform: none !important;
			filter: none !important;
			text-shadow: none !important;
		}

		.encrypt-input {
			background: rgba(255, 255, 255, 0.055) !important;
			font-size: 16px;
			touch-action: manipulation;
		}

		.eye-btn {
			top: calc(50% - 1rem);
			transform: none !important;
			touch-action: manipulation;
		}

		.eye-btn:active {
			transform: none !important;
		}
	}
</style>
