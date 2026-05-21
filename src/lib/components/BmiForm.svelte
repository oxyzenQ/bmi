<!-- // Copyright (c) 2025 - 2026 rezky_nightky -->
<script lang="ts">
	import { Settings } from 'lucide-svelte';
	import {
		exportBmiHistory,
		exportBmiHistoryCsv,
		validateBmiImport,
		importBmiHistory,
		peekImportMeta,
		MAX_IMPORT_SIZE,
		type ImportFileMeta
	} from '$lib/utils/history-io';
	import { STORAGE_KEYS, storageGetJSON } from '$lib/utils/storage';
	import {
		formatBmiExportDate,
		importErrorKey,
		sanitizeDecimal,
		sanitizeInteger
	} from '$lib/utils/bmi-form-helpers';
	import type { Activity, Gender, ImportNotifyResult } from '$lib/types/bmi-form';
	import { warnDev } from '$lib/utils/warn-dev';
	import { portal } from '$lib/actions/portal';
	import { tick } from 'svelte';
	import { t as _t, localeVersion } from '$lib/i18n';
	import BmiFormHeader from './form/BmiFormHeader.svelte';
	import BmiInputField from './form/BmiInputField.svelte';
	import FormActions from './form/FormActions.svelte';
	import ImportExportActions from './form/ImportExportActions.svelte';
	import OptionalMetrics from './form/OptionalMetrics.svelte';
	import UnitSystemToggle from './form/UnitSystemToggle.svelte';
	import EncryptionModal from './EncryptionModal.svelte';
	import FeedbackModal from './FeedbackModal.svelte';
	let _rv = $derived($localeVersion);
	// Reactive t() — reading _rv creates a dependency so template {t('key')} re-runs on locale change
	function t(key: string, params?: Record<string, string | number | undefined | null>): string {
		void _rv;
		return _t(key, params);
	}

	interface Props {
		age?: string;
		height?: string;
		weight?: string;
		gender?: Gender;
		activity?: Activity;
		unitSystem?: 'metric' | 'imperial';
		calculating?: boolean;
		onClear: () => void;
		onCalculate: () => void;
		onNotify?: (result: ImportNotifyResult) => void;
	}

	let {
		age = $bindable(''),
		height = $bindable(''),
		weight = $bindable(''),
		gender = $bindable<Gender>(''),
		activity = $bindable<Activity>(''),
		unitSystem = $bindable<'metric' | 'imperial'>('metric'),
		calculating = false,
		onClear,
		onCalculate,
		onNotify
	}: Props = $props();
	// NOTE: Unit system persistence is managed by the parent (+page.svelte)
	// via bind:unitSystem. Do NOT read/write localStorage here — it causes
	// a race condition where child overwrites parent's value on mount.

	// Activity level metadata — reactive so labels update on locale change
	let activityLevels = $derived([
		{ value: 'sedentary' as Activity, label: t('form.sedentary'), factor: 1.2 },
		{ value: 'light' as Activity, label: t('form.light'), factor: 1.375 },
		{ value: 'moderate' as Activity, label: t('form.moderate'), factor: 1.55 },
		{ value: 'active' as Activity, label: t('form.active'), factor: 1.725 },
		{ value: 'very_active' as Activity, label: t('form.very_active'), factor: 1.9 }
	]);

	// Derived unit-specific labels, placeholders, and validation bounds
	let heightLabel = $derived(
		unitSystem === 'metric' ? t('form.height_metric') : t('form.height_imperial')
	);
	let weightLabel = $derived(
		unitSystem === 'metric' ? t('form.weight_metric') : t('form.weight_imperial')
	);
	let heightExample = $derived(
		unitSystem === 'metric'
			? t('form.height_placeholder_metric')
			: t('form.height_placeholder_imperial')
	);
	let weightExample = $derived(
		unitSystem === 'metric'
			? t('form.weight_placeholder_metric')
			: t('form.weight_placeholder_imperial')
	);
	let heightAriaLabel = $derived(
		unitSystem === 'metric' ? t('form.height_aria_metric') : t('form.height_aria_imperial')
	);
	let weightAriaLabel = $derived(
		unitSystem === 'metric' ? t('form.weight_aria_metric') : t('form.weight_aria_imperial')
	);
	let heightErrorText = $derived(
		unitSystem === 'metric' ? t('form.height_error_metric') : t('form.height_error_imperial')
	);
	let weightErrorText = $derived(
		unitSystem === 'metric' ? t('form.weight_error_metric') : t('form.weight_error_imperial')
	);
	let heightMax = $derived(unitSystem === 'metric' ? 300 : 120);
	let weightMax = $derived(unitSystem === 'metric' ? 1000 : 1500);

	let ageInputEl: HTMLInputElement | undefined = $state(undefined);
	let heightInputEl: HTMLInputElement | undefined = $state(undefined);
	let weightInputEl: HTMLInputElement | undefined = $state(undefined);
	let fileInputEl: HTMLInputElement | null = $state(null);

	let { parsedAge, parsedHeight, parsedWeight, ageValid, heightValid, weightValid, canCalculate } =
		$derived.by(() => {
			const pa = age !== '' ? parseInt(age) : null;
			const ph = height !== '' ? parseFloat(height) : null;
			const pw = weight !== '' ? parseFloat(weight) : null;
			const av = pa !== null && !isNaN(pa) && pa > 0 && pa <= 120;
			const hv = ph !== null && !isNaN(ph) && ph > 0 && ph <= heightMax;
			const wv = pw !== null && !isNaN(pw) && pw > 0 && pw <= weightMax;
			return {
				parsedAge: pa,
				parsedHeight: ph,
				parsedWeight: pw,
				ageValid: av,
				heightValid: hv,
				weightValid: wv,
				canCalculate: av && hv && wv
			};
		});

	function handleAgeInput(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		const nextAge = sanitizeInteger(target.value);
		if (target.value !== nextAge) target.value = nextAge;
		if (age !== nextAge) age = nextAge;
	}

	function handleHeightInput(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		const nextHeight = sanitizeDecimal(target.value);
		if (target.value !== nextHeight) target.value = nextHeight;
		if (height !== nextHeight) height = nextHeight;
	}

	function handleWeightInput(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		const nextWeight = sanitizeDecimal(target.value);
		if (target.value !== nextWeight) target.value = nextWeight;
		if (weight !== nextWeight) weight = nextWeight;
	}

	function handleCalculate() {
		if (calculating) return;
		if (canCalculate && parsedHeight && parsedWeight) {
			onCalculate();
		}
	}

	function handleClear() {
		onClear();
	}

	function focusAgeIfDesktop() {
		if (!ageValid && !window.matchMedia('(hover: none)').matches) {
			ageInputEl?.focus();
		}
	}

	function focusHeightIfDesktop() {
		if (!heightValid && !window.matchMedia('(hover: none)').matches) {
			heightInputEl?.focus();
		}
	}

	// Encryption modal state
	let showEncryptModal = $state(false);
	let encryptModalMode = $state<'export' | 'import'>('export');
	let encryptError = $state('');
	let encryptErrorCode = $state<string | undefined>(undefined);
	let pendingImportText = $state('');
	let pendingImportMeta = $state<ImportFileMeta | undefined>(undefined);
	let exportRecordCount = $state(0);

	// Staging spinner overlay (shown before/after modal transitions)
	let stagingLoading = $state(false);
	const STAGING_DELAY = 800;
	const STAGING_POST_DELAY = 800;

	// Feedback modal state (blocking confirmation)
	let showFeedbackModal = $state(false);
	let feedbackType = $state<'success' | 'error'>('success');
	let feedbackMessage = $state('');

	async function handleExportClick() {
		// Read current history count from storage for export summary
		const history = storageGetJSON<Array<unknown>>(STORAGE_KEYS.HISTORY, []);
		exportRecordCount = Array.isArray(history) ? history.length : 0;
		encryptModalMode = 'export';
		encryptError = '';
		encryptErrorCode = undefined;

		// Show staging spinner before opening modal
		stagingLoading = true;
		await tick();
		await new Promise((r) => setTimeout(r, STAGING_DELAY));
		stagingLoading = false;

		showEncryptModal = true;
	}

	async function handleExportConfirm(passphrase: string) {
		if (stagingLoading) return; // prevent double-trigger during encryption
		const json = await exportBmiHistory(passphrase);
		if (!json) {
			encryptError = t('crypto.export_failed');
			return;
		}
		showEncryptModal = false;

		// Brief staging spinner after export completes
		stagingLoading = true;
		await tick();
		await new Promise((r) => setTimeout(r, STAGING_POST_DELAY));
		stagingLoading = false;

		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `bmi-history-${formatBmiExportDate()}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function handleExportCsv() {
		const csv = exportBmiHistoryCsv();
		if (!csv) return;
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `bmi-history-${formatBmiExportDate()}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function handleImportClick() {
		if (stagingLoading) return; // prevent double-trigger during processing
		// Open file picker directly — browser requires synchronous call within
		// user gesture. Spinner shows AFTER dialog closes (in handleFileInputChange
		// → handleFileChange via await tick()).
		fileInputEl?.click();
	}

	async function processFile(file: File) {
		stagingLoading = true;
		await tick();
		const fakeEvent = { target: { files: [file] } } as unknown as Event;
		handleFileChange(fakeEvent);
	}

	function handleFileInputChange(e: Event) {
		if (stagingLoading) return; // prevent overlapping import flows
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			// File selected — show spinner during processing.
			// handleFileChange will call await tick() first so the DOM
			// actually renders the gear overlay before any heavy work.
			stagingLoading = true;
			processFile(file);
		}
		input.value = ''; // Reset so same file can be re-selected
	}

	async function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		// ── File size guards ──
		if (file.size === 0) {
			stagingLoading = false;
			onNotify?.({
				action: 'import-error',
				error: t('history.empty_file')
			});
			return;
		}
		if (file.size > MAX_IMPORT_SIZE) {
			stagingLoading = false;
			onNotify?.({
				action: 'import-error',
				error: t('history.file_too_large')
			});
			return;
		}

		try {
			// Let the browser render the staging spinner overlay before
			// doing any async I/O (file.text, crypto import, validation).
			await tick();
			const text = await file.text();

			// Check if file is encrypted
			const { isEncrypted } = await import('$lib/utils/crypto');
			if (isEncrypted(text)) {
				pendingImportText = text;
				pendingImportMeta = peekImportMeta(text);
				encryptModalMode = 'import';
				encryptError = '';
				encryptErrorCode = undefined;

				// Show staging spinner before opening modal
				stagingLoading = true;
				await tick();
				await new Promise((r) => setTimeout(r, STAGING_DELAY));
				stagingLoading = false;

				showEncryptModal = true;
				return;
			}

			// Normal unencrypted validation
			const validation = await validateBmiImport(text);

			if (validation.valid && validation.recordCount) {
				stagingLoading = false;
				onNotify?.({
					action: 'import-validate',
					text,
					recordCount: validation.recordCount,
					integrityVerified: validation.integrityVerified ?? false
				});
			} else {
				// Notify parent to show error via NotifyFloat (single source of truth)
				stagingLoading = false;
				const code = validation.errorCode ?? 'invalid_format';
				onNotify?.({
					action: 'import-error',
					error: t(importErrorKey(code))
				});
			}
		} catch (err) {
			// Notify parent to show error via NotifyFloat
			warnDev('BmiForm', 'handleImport', 'Import processing failed unexpectedly', err);
			stagingLoading = false;
			onNotify?.({
				action: 'import-error',
				error: t('form.could_not_read')
			});
		}
	}

	async function handleImportConfirm(passphrase: string) {
		// Guard: prevent duplicate modal triggers
		if (showFeedbackModal) return;

		// Import with passphrase - will decrypt if needed
		const result = await importBmiHistory(pendingImportText, passphrase);

		if (result.success) {
			// Close encryption modal first
			showEncryptModal = false;
			pendingImportText = '';
			pendingImportMeta = undefined;
			encryptError = '';
			encryptErrorCode = undefined;

			// Brief staging spinner after import completes
			stagingLoading = true;
			await tick();
			await new Promise((r) => setTimeout(r, STAGING_POST_DELAY));
			stagingLoading = false;

			// Show success feedback modal (blocking)
			feedbackType = 'success';
			feedbackMessage = t('history.import_success', { count: result.count });
			showFeedbackModal = true;

			// Also notify parent for any additional UI updates
			onNotify?.({
				action: 'import-success',
				recordCount: result.count,
				integrityVerified: result.integrityVerified ?? false
			});
		} else {
			// Show error inline in EncryptionModal for immediate retry
			const code = result.errorCode ?? 'invalid_format';
			encryptError = t(importErrorKey(code));
			encryptErrorCode = code;
			return;
		}
	}

	function handleFeedbackClose() {
		showFeedbackModal = false;
		feedbackMessage = '';
	}

	function handleModalCancel() {
		showEncryptModal = false;
		pendingImportText = '';
		pendingImportMeta = undefined;
		encryptError = '';
		encryptErrorCode = undefined;
	}

	// ── Drag & Drop import (Phase 4: UX Upgrade) ──
	let isDragOver = $state(false);

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer?.types.includes('Files')) {
			isDragOver = true;
		}
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		isDragOver = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		isDragOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (!file) return;
		processFile(file);
	}

	// Alias — drop zone click opens same file picker
	const handleDropZoneClick = handleImportClick;
</script>

<div class="form-inner">
	<BmiFormHeader
		ready={canCalculate}
		title={t('form.title')}
		readyLabel={t('form.ready')}
		incompleteLabel={t('form.enter_all')}
		readyAria={t('form.ready_aria')}
		incompleteAria={t('form.incomplete_aria')}
	/>

	<UnitSystemToggle
		bind:unitSystem
		bind:height
		bind:weight
		ariaLabel={t('form.unit_system_aria')}
		metricLabel={t('form.metric')}
		imperialLabel={t('form.imperial')}
	/>

	<form
		class="bmi-form"
		onsubmit={(e) => {
			e.preventDefault();
			if (canCalculate && !calculating) onCalculate();
		}}
	>
		<BmiInputField
			id="age"
			icon="age"
			bind:inputEl={ageInputEl}
			bind:value={age}
			label={t('form.age_label')}
			placeholder={t('form.age_placeholder')}
			ariaLabel={t('form.age_aria')}
			inputmode="numeric"
			pattern="[0-9]*"
			showError={age !== '' && !ageValid}
			errorText={t('form.age_error')}
			onInput={handleAgeInput}
		/>

		<BmiInputField
			id="height"
			icon="height"
			bind:inputEl={heightInputEl}
			bind:value={height}
			label={heightLabel}
			placeholder={ageValid ? heightExample : t('form.enter_age_first')}
			ariaLabel={heightAriaLabel}
			inputmode="decimal"
			disabled={!ageValid}
			showError={height !== '' && !heightValid}
			errorText={heightErrorText}
			onInput={handleHeightInput}
			onBlockedFocus={focusAgeIfDesktop}
		/>

		<BmiInputField
			id="weight"
			icon="weight"
			bind:inputEl={weightInputEl}
			bind:value={weight}
			label={weightLabel}
			placeholder={heightValid ? weightExample : t('form.enter_height_first')}
			ariaLabel={weightAriaLabel}
			inputmode="decimal"
			disabled={!heightValid}
			showError={weight !== '' && !weightValid}
			errorText={weightErrorText}
			onInput={handleWeightInput}
			onBlockedFocus={focusHeightIfDesktop}
		/>

		<OptionalMetrics
			bind:gender
			bind:activity
			{activityLevels}
			genderLabel={t('form.gender')}
			activityLabel={t('form.activity')}
			optionalLabel={t('form.optional')}
			genderAria={t('form.gender_aria')}
			activityAria={t('form.activity_aria')}
			maleLabel={t('form.male')}
			femaleLabel={t('form.female')}
		/>

		<FormActions
			{calculating}
			{canCalculate}
			calculateAria={t('form.calculate_aria')}
			clearAria={t('form.clear_aria')}
			calculatingLabel={t('form.calculating')}
			calculateLabel={t('form.calc_bmi')}
			clearLabel={t('form.clear_all')}
			onClear={handleClear}
		/>

		<ImportExportActions
			bind:fileInputEl
			{isDragOver}
			importLabel={t('form.import')}
			dropFileHereLabel={t('form.drop_file_here')}
			orChooseFileLabel={t('form.or_choose_file')}
			importAria={t('form.import_aria')}
			exportLabel={t('form.export')}
			exportAria={t('form.export_aria')}
			exportCsvLabel={t('form.export_csv')}
			exportCsvAria={t('form.export_csv_aria')}
			onFileInputChange={handleFileInputChange}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			onDropZoneClick={handleDropZoneClick}
			onExportClick={handleExportClick}
			onExportCsv={handleExportCsv}
		/>
	</form>
</div>

<!-- Modals: Portal to body to avoid parent transform issues -->
{#if stagingLoading}
	<div use:portal class="modal-portal">
		<div class="staging-backdrop staging-visible">
			<div class="staging-spinner-wrap">
				<Settings class="staging-gear-icon" size={48} />
				<span class="staging-text">{t('crypto.preparing')}</span>
			</div>
		</div>
	</div>
{/if}

{#if showEncryptModal}
	<div use:portal class="modal-portal">
		<EncryptionModal
			show={showEncryptModal}
			mode={encryptModalMode}
			error={encryptError}
			errorCode={encryptErrorCode}
			importMeta={encryptModalMode === 'import' ? pendingImportMeta : undefined}
			exportRecordCount={encryptModalMode === 'export' ? exportRecordCount : undefined}
			onConfirm={encryptModalMode === 'export' ? handleExportConfirm : handleImportConfirm}
			onCancel={handleModalCancel}
		/>
	</div>
{/if}

{#if showFeedbackModal}
	<div use:portal class="modal-portal">
		<FeedbackModal
			show={showFeedbackModal}
			type={feedbackType}
			message={feedbackMessage}
			onClose={handleFeedbackClose}
		/>
	</div>
{/if}

<style>
	@media (hover: none) and (pointer: coarse) {
		:global(#calculator .form-card) {
			min-height: auto;
			overflow: visible;
			contain: none;
			background: var(--sd-80);
			-webkit-backdrop-filter: none;
			backdrop-filter: none;
			touch-action: pan-y pinch-zoom;
		}

		:global(#calculator .form-card::before),
		:global(#calculator .form-card::after),
		:global(#calculator .pill-indicator::after) {
			content: none !important;
			display: none !important;
		}

		.form-inner,
		:global(#calculator .bmi-form),
		:global(#calculator .input-group) {
			contain: none !important;
			touch-action: pan-y pinch-zoom;
		}

		:global(#calculator .btn),
		:global(#calculator .form-input),
		:global(#calculator .pill-indicator),
		:global(#calculator .bmi-drop-zone),
		:global(#calculator .bmi-drop-zone__icon),
		:global(#calculator .bmi-drop-zone__text),
		:global(#calculator .bmi-drop-zone__subtext) {
			animation: none !important;
			transition: none !important;
			transform: none !important;
			filter: none !important;
			text-shadow: none !important;
			-webkit-backdrop-filter: none !important;
			backdrop-filter: none !important;
		}

		:global(#calculator .btn),
		:global(#calculator .bmi-drop-zone) {
			touch-action: manipulation;
		}

		:global(#calculator .form-input) {
			touch-action: manipulation;
		}

		:global(#calculator .btn:hover),
		:global(#calculator .pill-indicator:hover),
		:global(#calculator .bmi-drop-zone:hover),
		:global(#calculator .bmi-drop-zone--active) {
			transform: none !important;
		}
	}
</style>
