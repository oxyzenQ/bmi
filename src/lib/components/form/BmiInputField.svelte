<!-- // Copyright (c) 2025 - 2026 rezky_nightky -->
<script lang="ts">
	import { Ruler, User, Weight } from 'lucide-svelte';

	interface Props {
		id: string;
		icon: 'age' | 'height' | 'weight';
		label: string;
		value?: string;
		placeholder: string;
		ariaLabel: string;
		inputmode: 'numeric' | 'decimal';
		pattern?: string;
		disabled?: boolean;
		showError?: boolean;
		errorText?: string;
		inputEl?: HTMLInputElement;
		onInput: (event: Event) => void;
		onBlockedFocus?: () => void;
	}

	let {
		id,
		icon,
		label,
		value = $bindable(''),
		placeholder,
		ariaLabel,
		inputmode,
		pattern,
		disabled = false,
		showError = false,
		errorText = '',
		inputEl = $bindable<HTMLInputElement | undefined>(),
		onInput,
		onBlockedFocus
	}: Props = $props();
</script>

<div class="input-group">
	<label for={id} class="input-label">
		{#if icon === 'age'}
			<User class="User" />
		{:else if icon === 'height'}
			<Ruler class="Ruler" />
		{:else}
			<Weight class="Weight" />
		{/if}
		{label}
	</label>
	<input
		type="text"
		{id}
		bind:this={inputEl}
		bind:value
		class="form-input"
		{inputmode}
		{pattern}
		{placeholder}
		aria-label={ariaLabel}
		aria-invalid={showError}
		{disabled}
		aria-disabled={disabled}
		onfocus={() => {
			if (disabled) onBlockedFocus?.();
		}}
		oninput={onInput}
	/>
	{#if showError}
		<div class="input-error" role="alert">{errorText}</div>
	{/if}
</div>
