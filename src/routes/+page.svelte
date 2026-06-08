<!-- Copyright (C) 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { backOut, cubicOut } from 'svelte/easing';
	import { tweened } from 'svelte/motion';
	import { browser } from '$app/environment';
	import {
		getPerformanceTier,
		prefersReducedMotion as checkReducedMotion
	} from '$lib/utils/animation-config';
	import { createLazyLoader, createPairedLazyLoader } from '$lib/utils/lazy-load';
	import {
		STORAGE_KEYS,
		storageGet,
		storageSet,
		storageRemove,
		storageInvalidate
	} from '$lib/utils/storage';
	import { BMI_THRESHOLDS } from '$lib/utils/bmi-category';
	import { calculateBmi, isBmiResult } from '$lib/utils/bmi-calculator';
	import { warnDev, warnDevOnce } from '$lib/utils/warn-dev';
	import { MARKER_ANIM, PAGER, SCROLL, HAPTIC, SECTIONS } from '$lib/utils/animation-config';
	import { isEditableTarget } from '$lib/utils/dom';
	import { saveBmiToHistory } from '$lib/utils/bmi-history';
	import {
		clampSectionIndex,
		findSectionScroller,
		indexFromSectionHash,
		replaceSectionHash
	} from '$lib/utils/page-sections';
	import { nextTheme, THEMES, THEME_URLS, type ThemeKey } from '$lib/utils/page-theme';
	import { getPagerWheelDirection } from '$lib/utils/scroll-helpers';
	import { createTouchPager } from '$lib/utils/touch-pager';
	import type { ImportNotifyResult } from '$lib/types/bmi-form';
	import NotificationHost from '$lib/components/page/NotificationHost.svelte';
	import PagerNavigation from '$lib/components/page/PagerNavigation.svelte';
	import PagerControls from '$lib/components/page/PagerControls.svelte';
	import PagerSections from '$lib/components/page/PagerSections.svelte';
	import StagingSpinner from '$lib/components/StagingSpinner.svelte';
	import { t as _t, initLocale, localeVersion } from '$lib/i18n';
	import { getAppVersionShort } from '$lib/utils/app-version';
	let _rv = $derived($localeVersion);
	function t(key: string, params?: Record<string, string | number | undefined | null>): string {
		void _rv;
		return _t(key, params);
	}
	const appVersionTag = `v${getAppVersionShort()}`;
	let metaTitle = $derived(t('meta.title', { version: appVersionTag }));
	type BmiFormComponentType = typeof import('$lib/components/BmiForm.svelte').default;
	type BmiResultsComponentType = typeof import('$lib/components/BmiResults.svelte').default;
	type BmiRadialGaugeComponentType = typeof import('$lib/components/BmiRadialGauge.svelte').default;
	type BmiHealthRiskComponentType = typeof import('$lib/components/BmiHealthRisk.svelte').default;
	type BmiSnapshotComponentType = typeof import('$lib/components/BmiSnapshot.svelte').default;
	type BodyFatEstimateComponentType =
		typeof import('$lib/components/BodyFatEstimate.svelte').default;
	type ReferenceTableComponentType = typeof import('$lib/components/ReferenceTable.svelte').default;
	type BmiGoalTrackerComponentType = typeof import('$lib/components/BmiGoalTracker.svelte').default;
	let BmiFormComponent: BmiFormComponentType | null = $state(null);
	let BmiResultsComponent: BmiResultsComponentType | null = $state(null);
	let BmiRadialGaugeComponent: BmiRadialGaugeComponentType | null = $state(null);
	let BmiHealthRiskComponent: BmiHealthRiskComponentType | null = $state(null);
	let BmiSnapshotComponent: BmiSnapshotComponentType | null = $state(null);
	let BodyFatEstimateComponent: BodyFatEstimateComponentType | null = $state(null);
	let ReferenceTableComponent: ReferenceTableComponentType | null = $state(null);
	let BmiGoalTrackerComponent: BmiGoalTrackerComponentType | null = $state(null);

	const calculatorLoader = createPairedLazyLoader<BmiFormComponentType, BmiResultsComponentType>(
		() => import('$lib/components/BmiForm.svelte'),
		() => import('$lib/components/BmiResults.svelte'),
		(comp) => {
			BmiFormComponent = comp;
		},
		(comp) => {
			BmiResultsComponent = comp;
		}
	);
	const gaugeLoader = createLazyLoader<BmiRadialGaugeComponentType>({
		importer: () => import('$lib/components/BmiRadialGauge.svelte'),
		onLoad: (comp) => {
			BmiRadialGaugeComponent = comp;
		}
	});
	const healthRiskLoader = createLazyLoader<BmiHealthRiskComponentType>({
		importer: () => import('$lib/components/BmiHealthRisk.svelte'),
		onLoad: (comp) => {
			BmiHealthRiskComponent = comp;
		}
	});
	const snapshotLoader = createLazyLoader<BmiSnapshotComponentType>({
		importer: () => import('$lib/components/BmiSnapshot.svelte'),
		onLoad: (comp) => {
			BmiSnapshotComponent = comp;
		}
	});
	const bodyFatLoader = createLazyLoader<BodyFatEstimateComponentType>({
		importer: () => import('$lib/components/BodyFatEstimate.svelte'),
		onLoad: (comp) => {
			BodyFatEstimateComponent = comp;
		}
	});
	const referenceLoader = createLazyLoader<ReferenceTableComponentType>({
		importer: () => import('$lib/components/ReferenceTable.svelte'),
		onLoad: (comp) => {
			ReferenceTableComponent = comp;
		}
	});
	const goalTrackerLoader = createLazyLoader<BmiGoalTrackerComponentType>({
		importer: () => import('$lib/components/BmiGoalTracker.svelte'),
		onLoad: (comp) => {
			BmiGoalTrackerComponent = comp;
		}
	});
	let lastSavedHistorySignature: string | null = $state(null);

	let bmiValue: number | null = $state(null);
	let category: string | null = $state(null);

	// Form inputs default empty strings for validation UX
	let age: string = $state('');
	let height: string = $state('');
	let weight: string = $state('');
	let gender: 'male' | 'female' | '' = $state('');
	let activity: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | '' = $state('');
	let unitSystem = $state<'metric' | 'imperial'>('metric');
	let unitSystemInitialized = $state(false);

	let calculating = $state(false);
	let resultsRunId = $state(0);

	// Notification state
	let showNotify = $state(false);
	let notifyType = $state<'success' | 'delete' | 'warn' | 'error'>('success');
	let notifyMessage = $state('');
	let notifyButtonText = $state('');
	let pendingImportText = $state<string | null>(null);

	// Staging spinner state (gear overlay before notifications)
	let stagingLoading = $state(false);
	const STAGING_NOTIFY_DELAY = 600;

	const currentYear = new Date().getFullYear();

	const gitCommitId =
		typeof __GIT_COMMIT_ID__ !== 'undefined' ? __GIT_COMMIT_ID__.slice(0, 7) : 'dev';
	const gitBranch = typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : 'main';

	const sections = SECTIONS;

	let activeIndex = $state(0);
	let lastIndex = $state(0);
	let prefersReducedMotion = $state(false);
	let perfTier = $state<'high' | 'medium' | 'low'>('medium');

	let pagerNavEl: HTMLElement | null = $state(null);
	let pagerNavShellEl: HTMLElement | null = $state(null);
	let pagerNavCentered = $state(false);
	let pagerNavAlignRaf: number | null = null;
	let navDragPointerId: number | null = null;
	let navDragStartX = 0;
	let navDragStartScrollLeft = 0;
	let navDidDrag = false;
	let suppressNextNavClick = false;
	let suppressNextNavClickTimer: ReturnType<typeof setTimeout> | null = null;
	const NAV_DRAG_THRESHOLD = 6;

	let lastScrollY = 0;

	let activePointerId: number | null = null;
	let lastWheelNavAt = 0;
	let switchingTimer: ReturnType<typeof setTimeout> | null = null;
	let pageDestroyed = $state(false);
	let showScrollTopFab = $state(false);
	let isTouchDevice = $state(false);
	let activeScroller: HTMLElement | null = null;
	let scrollRafId: number | null = null;
	let pendingScrollTarget: HTMLElement | null = null;
	let pendingScrollY = 0;
	let lastTouchScrollAt = 0;
	let lastActiveScrollAt = 0;

	function triggerHaptic(pattern: number | number[] = HAPTIC.NAV) {
		if (!browser) return;
		try {
			if ('vibrate' in navigator) navigator.vibrate(pattern);
		} catch (err) {
			warnDevOnce('page', 'triggerHaptic', 'Vibration API not supported', err);
		}
	}

	function scrollToTop() {
		if (!browser) return;
		const scroller = getActiveSectionScroller();
		if (!scroller) return;

		scroller.scrollTo({
			top: 0,
			behavior: isTouchDevice || reducedMotionEffective ? 'auto' : 'smooth'
		});
		triggerHaptic(5);
	}

	function getActiveSectionScroller(): HTMLElement | null {
		return activeScroller ?? findSectionScroller(pagerEl, sections[activeIndex].id);
	}

	let reducedMotionEffective = $derived(prefersReducedMotion);
	let contentReducedMotion = $derived(
		reducedMotionEffective || isTouchDevice || perfTier !== 'high'
	);

	const THEME_LABELS: Record<ThemeKey, () => string> = {
		blackhole: () => t('nav.blackhole'),
		spaceship: () => t('nav.spaceship'),
		space: () => t('nav.space')
	};
	let currentTheme = $state<ThemeKey>('blackhole');
	let themeLabel = $derived(THEME_LABELS[currentTheme]());

	function toggleWallpaperTheme() {
		currentTheme = nextTheme(currentTheme);
		if (browser) {
			storageSet(STORAGE_KEYS.WALLPAPER_THEME, currentTheme);
			document.documentElement.style.setProperty('--wallpaper-current', THEME_URLS[currentTheme]);
		}
	}

	function selectSection(index: number) {
		triggerHaptic(5);
		goTo(index);
	}

	$effect(() => {
		if (browser && unitSystemInitialized) {
			try {
				storageSet(STORAGE_KEYS.UNIT_SYSTEM, unitSystem);
			} catch (err) {
				warnDev('page', 'unitSystemEffect', 'Failed to persist unit system', err);
			}
		}
	});

	const BMI_BAR_MIN = BMI_THRESHOLDS.MIN;
	const BMI_BAR_MAX = BMI_THRESHOLDS.MAX;

	let rangeMarker = $derived(
		bmiValue === null
			? 0
			: Math.max(0, Math.min(100, ((bmiValue - BMI_BAR_MIN) / (BMI_BAR_MAX - BMI_BAR_MIN)) * 100))
	);
	const animatedMarker = tweened(0, { duration: 0, easing: cubicOut });
	let lastMarker = 0;
	let markerTimer: ReturnType<typeof setTimeout> | null = null;

	function animateRangeMarker(target: number) {
		if (markerTimer) {
			clearTimeout(markerTimer);
			markerTimer = null;
		}

		if (reducedMotionEffective) {
			lastMarker = target;
			animatedMarker.set(target, { duration: 0 });
			return;
		}

		const base =
			perfTier === 'high'
				? MARKER_ANIM.HIGH
				: perfTier === 'medium'
					? MARKER_ANIM.MEDIUM
					: MARKER_ANIM.LOW;
		const overshootDur = Math.round(base * MARKER_ANIM.OVERSHOOT_RATIO);
		const settleDur = Math.round(base * MARKER_ANIM.SETTLE_RATIO);
		const delta = target - lastMarker;
		const overshoot = Math.max(0, Math.min(100, target + delta * 0.08));

		lastMarker = target;
		animatedMarker.set(overshoot, { duration: overshootDur, easing: backOut });
		markerTimer = setTimeout(
			() => {
				animatedMarker.set(target, { duration: settleDur, easing: cubicOut });
				markerTimer = null;
			},
			Math.max(0, overshootDur - MARKER_ANIM.SETTLE_DELAY_OFFSET)
		);
	}

	let pagerDirection = $derived(activeIndex >= lastIndex ? 1 : -1);
	let pagerMotionDuration = $derived(
		reducedMotionEffective
			? 0
			: perfTier === 'high'
				? PAGER.DUR_HIGH
				: perfTier === 'medium'
					? PAGER.DUR_MEDIUM
					: PAGER.DUR_LOW
	);
	let pagerMotionDistance = $derived(
		reducedMotionEffective
			? 0
			: perfTier === 'high'
				? PAGER.DIST_HIGH
				: perfTier === 'medium'
					? PAGER.DIST_MEDIUM
					: PAGER.DIST_LOW
	);

	let pagerEl: HTMLDivElement | null = null;
	let pointerStartX: number | null = null;
	let pointerStartY: number | null = null;

	async function resetSectionScroll() {
		await tick();
		const scroller = findSectionScroller(pagerEl, sections[activeIndex].id);
		if (scroller) scroller.scrollTo({ top: 0, left: 0, behavior: 'auto' });
	}

	function setHash(id: string) {
		if (!browser) return;
		replaceSectionHash(id);
	}

	function goTo(index: number, opts?: { skipHash?: boolean; skipSwitching?: boolean }) {
		const next = clampSectionIndex(index, sections.length);
		if (next === activeIndex) {
			if (!opts?.skipHash) setHash(sections[activeIndex].id);
			void resetSectionScroll();
			return;
		}

		if (browser && !reducedMotionEffective && !opts?.skipSwitching) {
			if (switchingTimer) clearTimeout(switchingTimer);
			document.body.classList.add('is-switching');
			const ms = Math.max(240, pagerMotionDuration) + PAGER.SWITCHING_DELAY;
			switchingTimer = setTimeout(() => {
				document.body.classList.remove('is-switching');
				switchingTimer = null;
			}, ms);
		}

		lastIndex = activeIndex;
		activeIndex = next;
		showScrollTopFab = false;
		if (!opts?.skipHash) setHash(sections[activeIndex].id);
		void resetSectionScroll();

		/* Scroll active tab into view inside the horizontal-scrolling navbar */
		if (browser && pagerNavEl) {
			const activeTab = pagerNavEl.querySelector('.pager-tab.active') as HTMLElement | null;
			if (activeTab) {
				activeTab.scrollIntoView({
					inline: 'center',
					behavior: isTouchDevice || reducedMotionEffective ? 'auto' : 'smooth',
					block: 'nearest'
				});
			}
		}
	}

	function prevSection() {
		if (activeIndex <= 0) return;
		triggerHaptic(5);
		goTo(activeIndex - 1);
	}

	function nextSection() {
		if (activeIndex >= sections.length - 1) return;
		triggerHaptic(5);
		goTo(activeIndex + 1);
	}

	const touchPager = createTouchPager({
		getPagerEl: () => pagerEl,
		getActiveScroller: getActiveSectionScroller,
		getLastTouchScrollAt: () => lastTouchScrollAt,
		triggerHaptic,
		prevSection,
		nextSection
	});

	function handleNavPointerDown(event: PointerEvent) {
		if (event.button !== 0 || event.pointerType === 'touch') return;
		const shell = pagerNavShellEl;
		if (!shell || shell.scrollWidth <= shell.clientWidth + 1) return;

		navDragPointerId = event.pointerId;
		navDragStartX = event.clientX;
		navDragStartScrollLeft = shell.scrollLeft;
		navDidDrag = false;
	}

	function handleNavPointerMove(event: PointerEvent) {
		if (navDragPointerId === null || event.pointerId !== navDragPointerId) return;
		const shell = pagerNavShellEl;
		if (!shell) return;

		const dx = event.clientX - navDragStartX;
		if (!navDidDrag && Math.abs(dx) < NAV_DRAG_THRESHOLD) return;

		if (!navDidDrag) {
			navDidDrag = true;
			suppressNextNavClick = true;
			shell.classList.add('is-dragging');

			try {
				shell.setPointerCapture(event.pointerId);
			} catch (err) {
				warnDevOnce('page', 'handleNavPointerMove', 'Navbar pointer capture failed', err);
			}
		}

		shell.scrollLeft = navDragStartScrollLeft - dx;
		event.preventDefault();
	}

	function endNavPointerDrag(event?: PointerEvent) {
		const shell = pagerNavShellEl;
		if (event && navDragPointerId !== null && event.pointerId !== navDragPointerId) return;

		if (shell && navDragPointerId !== null) {
			try {
				shell.releasePointerCapture(navDragPointerId);
			} catch (err) {
				void err;
			}
		}

		shell?.classList.remove('is-dragging');
		if (navDidDrag) {
			if (suppressNextNavClickTimer) clearTimeout(suppressNextNavClickTimer);
			suppressNextNavClickTimer = setTimeout(() => {
				suppressNextNavClick = false;
				suppressNextNavClickTimer = null;
			}, 220);
		}
		navDragPointerId = null;
		navDidDrag = false;
	}

	function handleNavClickCapture(event: MouseEvent) {
		if (!suppressNextNavClick) return;
		suppressNextNavClick = false;
		event.preventDefault();
		event.stopPropagation();
	}

	function handlePointerDown(event: PointerEvent) {
		// Touch is handled by dedicated touch handlers below;
		// pointer events only manage mouse/stylus input.
		if (event.pointerType === 'touch') return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('button, a, input, textarea, select, label, [role="button"]')) return;
		if (target?.closest('.pager-nav, .pager-nav-shell, .pager-controls, .pager-controls-shell'))
			return;
		pointerStartX = event.clientX;
		pointerStartY = event.clientY;
		activePointerId = event.pointerId;
		try {
			pagerEl?.setPointerCapture(event.pointerId);
		} catch (e) {
			void e;
		}
	}

	function handlePointerUp(event: PointerEvent) {
		if (activePointerId !== null && event.pointerId !== activePointerId) return;
		if (pointerStartX === null || pointerStartY === null) {
			if (activePointerId !== null) {
				try {
					pagerEl?.releasePointerCapture(activePointerId);
				} catch (e) {
					void e;
				}
			}
			activePointerId = null;
			return;
		}

		const dx = event.clientX - pointerStartX;
		const dy = event.clientY - pointerStartY;
		pointerStartX = null;
		pointerStartY = null;

		if (
			Math.abs(dx) < SCROLL.SWIPE_DX_MIN ||
			Math.abs(dx) < Math.abs(dy) * SCROLL.SWIPE_ANGLE_RATIO
		) {
			if (activePointerId !== null) {
				try {
					pagerEl?.releasePointerCapture(activePointerId);
				} catch (e) {
					void e;
				}
			}
			activePointerId = null;
			return;
		}

		if (dx < 0) nextSection();
		else prevSection();

		if (activePointerId !== null) {
			try {
				pagerEl?.releasePointerCapture(activePointerId);
			} catch (e) {
				void e;
			}
		}
		activePointerId = null;
	}

	function handleWheel(event: WheelEvent) {
		if (isEditableTarget(event.target)) return;
		const target = event.target as HTMLElement | null;

		const now = Date.now();
		const direction = getPagerWheelDirection({
			pagerEl,
			target,
			dx: event.deltaX,
			dy: event.deltaY,
			now,
			lastNavAt: lastWheelNavAt,
			lastScrollAt: lastActiveScrollAt,
			cooldownMs: SCROLL.WHEEL_COOLDOWN,
			recentScrollBlockMs: SCROLL.WHEEL_RECENT_SCROLL_BLOCK_MS,
			dxThreshold: SCROLL.WHEEL_DX_THRESHOLD,
			dyMax: SCROLL.WHEEL_DY_MAX,
			ratio: SCROLL.WHEEL_RATIO
		});
		if (!direction) return;

		lastWheelNavAt = now;
		if (direction === 'next') nextSection();
		else prevSection();
	}

	function passiveWheel(node: HTMLElement) {
		node.addEventListener('wheel', handleWheel, { passive: true });
		return {
			destroy() {
				node.removeEventListener('wheel', handleWheel);
			}
		};
	}

	function markTouchScrolling() {
		if (!browser || !isTouchDevice) return;
		lastTouchScrollAt = Date.now();
	}

	function flushScrollState() {
		scrollRafId = null;
		if (!pendingScrollTarget) return;

		const currentScrollY = pendingScrollY;
		const delta = currentScrollY - lastScrollY;
		lastActiveScrollAt = Date.now();
		const deltaEpsilon = isTouchDevice
			? SCROLL.TOUCH_SCROLL_DELTA_EPSILON
			: SCROLL.SCROLL_DELTA_EPSILON;

		if (Math.abs(delta) < deltaEpsilon) {
			pendingScrollTarget = null;
			return;
		}

		if (isTouchDevice) {
			markTouchScrolling();
			lastScrollY = currentScrollY;
			pendingScrollTarget = null;
			return;
		}

		const shouldShowFab = currentScrollY > SCROLL.SCROLL_TOP_THRESHOLD;
		if (showScrollTopFab !== shouldShowFab) {
			showScrollTopFab = shouldShowFab;
		}

		lastScrollY = currentScrollY;
		pendingScrollTarget = null;
	}

	function onActiveScroll(event: Event) {
		const target = event.currentTarget as HTMLElement | null;
		if (!target) return;

		pendingScrollTarget = target;
		pendingScrollY = target.scrollTop;
		if (scrollRafId === null) {
			scrollRafId = requestAnimationFrame(flushScrollState);
		}
	}

	function detachActiveScroller() {
		if (!activeScroller) return;
		activeScroller.removeEventListener('scroll', onActiveScroll);
		activeScroller = null;
	}

	function attachActiveScroller() {
		if (!browser || !pagerEl) return;

		const activeId = sections[activeIndex].id;
		const nextScroller = findSectionScroller(pagerEl, activeId);

		if (activeScroller === nextScroller) return;

		detachActiveScroller();
		activeScroller = nextScroller;
		lastScrollY = activeScroller?.scrollTop ?? 0;

		if (activeScroller) {
			activeScroller.addEventListener('scroll', onActiveScroll, { passive: true });
		}
	}

	function schedulePagerNavAlignment() {
		if (!browser) return;
		if (pagerNavAlignRaf !== null) return;
		if (pageDestroyed) return;
		pagerNavAlignRaf = requestAnimationFrame(() => {
			pagerNavAlignRaf = null;
			if (pageDestroyed) return;
			updatePagerNavAlignment();
		});
	}

	function updatePagerNavAlignment() {
		if (!pagerNavEl) return;
		/* Scroll is on the shell (.pager-nav-shell), not the inner nav.
       Check if the shell's content overflows. */
		const shell = pagerNavShellEl ?? pagerNavEl.parentElement;
		if (!shell) return;
		const overflow = shell.scrollWidth > shell.clientWidth + 1;
		const nextCentered = !overflow;
		if (pagerNavCentered !== nextCentered) pagerNavCentered = nextCentered;
	}

	// Lazy-load components when section becomes active
	$effect(() => {
		if (!browser) return;
		if (activeIndex === 1) {
			void calculatorLoader.ensure();
		}
		if (activeIndex === 2) {
			void gaugeLoader.ensure();
			void healthRiskLoader.ensure();
			void snapshotLoader.ensure();
			void bodyFatLoader.ensure();
			void goalTrackerLoader.ensure();
		}
		if (activeIndex === 3) void referenceLoader.ensure();
	});

	$effect(() => {
		if (!browser) return;
		const currentActiveIndex = activeIndex;
		void tick().then(() => {
			if (currentActiveIndex === activeIndex) attachActiveScroller();
		});
	});

	onMount(() => {
		if (!browser) return;
		perfTier = getPerformanceTier();
		initLocale();
		prefersReducedMotion = checkReducedMotion();

		// Enhancement #12: Live listener for prefers-reduced-motion changes
		// If user toggles reduced-motion in OS settings while app is open,
		// animations update immediately without page reload.
		const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		const onMotionChange = (e: MediaQueryListEvent) => {
			prefersReducedMotion = e.matches;
		};
		motionQuery.addEventListener('change', onMotionChange);

		document.documentElement.dataset.performanceTier = perfTier;

		try {
			const storedUnit = storageGet(STORAGE_KEYS.UNIT_SYSTEM);
			if (storedUnit === 'imperial' || storedUnit === 'metric') {
				unitSystem = storedUnit;
			}
		} catch (err) {
			warnDev('page', 'onMount:unitSystem', 'Failed to read stored unit system', err);
		}
		unitSystemInitialized = true;

		try {
			const storedTheme = storageGet(STORAGE_KEYS.WALLPAPER_THEME);
			if (storedTheme && THEMES.includes(storedTheme as ThemeKey)) {
				currentTheme = storedTheme as ThemeKey;
				document.documentElement.style.setProperty('--wallpaper-current', THEME_URLS[currentTheme]);
			}
		} catch (err) {
			warnDev('page', 'onMount:wallpaperTheme', 'Failed to read wallpaper theme', err);
		}

		const idx = indexFromSectionHash(window.location.hash, sections);
		if (idx !== null) goTo(idx, { skipHash: true, skipSwitching: true });
		setHash(sections[activeIndex].id);

		const onHashChange = () => {
			const next = indexFromSectionHash(window.location.hash, sections);
			if (next !== null && next !== activeIndex) goTo(next, { skipHash: true });
		};

		const onStorage = (e: StorageEvent) => {
			if (e.key === STORAGE_KEYS.UNIT_SYSTEM) {
				if (e.newValue === 'imperial' || e.newValue === 'metric') {
					unitSystem = e.newValue;
				} else if (e.newValue === null) {
					unitSystem = 'metric';
				}
				storageInvalidate(STORAGE_KEYS.UNIT_SYSTEM);
			}
		};
		window.addEventListener('storage', onStorage);

		window.addEventListener('hashchange', onHashChange);

		const onResize = () => schedulePagerNavAlignment();
		window.addEventListener('resize', onResize, { passive: true });
		const navShell = pagerNavShellEl;
		const enableNavPointerDrag = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
		if (enableNavPointerDrag) {
			navShell?.addEventListener('pointerdown', handleNavPointerDown);
			navShell?.addEventListener('pointermove', handleNavPointerMove);
			navShell?.addEventListener('pointerup', endNavPointerDrag);
			navShell?.addEventListener('pointercancel', endNavPointerDrag);
			navShell?.addEventListener('lostpointercapture', endNavPointerDrag);
			navShell?.addEventListener('click', handleNavClickCapture, true);
			window.addEventListener('pointerup', endNavPointerDrag);
			window.addEventListener('pointercancel', endNavPointerDrag);
		}

		// Mobile touch swipe listeners for horizontal page navigation.
		// Passive listeners keep native vertical scroll off the JS critical path.
		// Vertical scrolling is handled natively by the browser via
		// CSS touch-action on .pager-shell. We detect horizontal swipes
		// in passive touch events without blocking the scroll thread.
		pagerEl?.addEventListener('touchstart', touchPager.handleTouchStart, { passive: true });
		pagerEl?.addEventListener('touchmove', touchPager.handleTouchMove, { passive: true });
		pagerEl?.addEventListener('touchend', touchPager.handleTouchEnd, { passive: true });

		// Unified scroll listener: scroll-top FAB + touch-scroll rendering mode
		isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

		void tick().then(schedulePagerNavAlignment);
		void tick().then(attachActiveScroller);

		return () => {
			motionQuery.removeEventListener('change', onMotionChange);
			window.removeEventListener('hashchange', onHashChange);
			window.removeEventListener('resize', onResize);
			window.removeEventListener('storage', onStorage);
			if (enableNavPointerDrag) {
				navShell?.removeEventListener('pointerdown', handleNavPointerDown);
				navShell?.removeEventListener('pointermove', handleNavPointerMove);
				navShell?.removeEventListener('pointerup', endNavPointerDrag);
				navShell?.removeEventListener('pointercancel', endNavPointerDrag);
				navShell?.removeEventListener('lostpointercapture', endNavPointerDrag);
				navShell?.removeEventListener('click', handleNavClickCapture, true);
				window.removeEventListener('pointerup', endNavPointerDrag);
				window.removeEventListener('pointercancel', endNavPointerDrag);
			}
			navShell?.classList.remove('is-dragging');
			detachActiveScroller();
			touchPager.reset();
			pagerEl?.removeEventListener('touchstart', touchPager.handleTouchStart);
			pagerEl?.removeEventListener('touchmove', touchPager.handleTouchMove);
			pagerEl?.removeEventListener('touchend', touchPager.handleTouchEnd);
			if (pagerNavAlignRaf !== null) cancelAnimationFrame(pagerNavAlignRaf);
			if (scrollRafId !== null) cancelAnimationFrame(scrollRafId);
			if (suppressNextNavClickTimer !== null) clearTimeout(suppressNextNavClickTimer);
		};
	});

	function computeBMIFromInputs(h: string, w: string, _a: string) {
		const result = calculateBmi(h, w, unitSystem);

		if (isBmiResult(result)) {
			bmiValue = result.bmi;
			category = result.category;
			lastSavedHistorySignature = saveBmiToHistory({
				bmi: result.bmi,
				heightCm: result.heightCm,
				weightKg: result.weightKg,
				age: _a,
				lastSignature: lastSavedHistorySignature
			});
		} else {
			bmiValue = null;
			category = null;
		}
	}

	async function handleCalculate() {
		if (calculating) return;
		calculating = true;

		triggerHaptic(HAPTIC.CALCULATE);

		// Calculate BMI synchronously (before any await) so that
		// bmiValue / category are available for the Gauge page.
		computeBMIFromInputs(height, weight, age);
		resultsRunId += 1;
		calculating = false;

		// Navigate to Gauge NOW — still in the synchronous click-handler
		// context so Svelte 5's {#key activeIndex} structural re-render
		// triggers reliably.
		goTo(2);

		// Show staging gear spinner during page transition
		stagingLoading = true;
		await tick();
		await new Promise((r) => setTimeout(r, STAGING_NOTIFY_DELAY));
		stagingLoading = false;

		// Show success notification (overlaid on the Gauge page)
		notifyType = 'success';
		notifyMessage = t('notify.success_msg');
		notifyButtonText = t('notify.continue_btn');
		showNotify = true;
	}

	async function confirmClearData() {
		// Show staging gear spinner before confirmation dialog
		stagingLoading = true;
		await tick();
		await new Promise((r) => setTimeout(r, STAGING_NOTIFY_DELAY));
		stagingLoading = false;

		// Show confirmation dialog
		notifyType = 'delete';
		notifyMessage = t('notify.delete_confirm');
		notifyButtonText = t('notify.delete');
		showNotify = true;
	}

	function handleImportNotify(result: ImportNotifyResult) {
		if (result.action === 'import-validate' && result.text) {
			pendingImportText = result.text;
			notifyType = 'warn';
			notifyMessage = t('notify.import_confirm', {
				n: result.recordCount ?? 0
			});
			notifyButtonText = t('notify.import_keep');
			showNotify = true;
		} else if (result.action === 'import-success') {
			lastSavedHistorySignature = null;
			resultsRunId += 1;
		} else if (result.action === 'import-error') {
			notifyType = 'error';
			notifyMessage = result.error || t('notify.import_error');
			notifyButtonText = t('notify.ok');
			showNotify = true;
		}
	}

	function markImportSuccess() {
		lastSavedHistorySignature = null;
		resultsRunId += 1;
	}

	async function confirmDeleteData() {
		stagingLoading = true;
		await new Promise((resolve) => setTimeout(resolve, 800));
		stagingLoading = false;
		clearAllData();
	}

	function clearAllData() {
		calculating = false;
		age = '';
		height = '';
		weight = '';
		gender = '';
		activity = '';
		bmiValue = null; // Gauge will show empty/neutral state
		category = null;
		resultsRunId += 1;

		if (browser) {
			storageRemove(STORAGE_KEYS.HISTORY);
			lastSavedHistorySignature = null;
		}
	}

	// Animate range marker when BMI value changes
	$effect(() => {
		if (bmiValue !== null) {
			animateRangeMarker(rangeMarker);
		} else {
			lastMarker = 0;
			animatedMarker.set(0, { duration: 0 });
		}
	});

	onDestroy(() => {
		pageDestroyed = true;
		if (markerTimer) clearTimeout(markerTimer);
		if (switchingTimer) clearTimeout(switchingTimer);
		if (browser) document.body.classList.remove('is-switching');
	});
</script>

<svelte:head>
	<title>{metaTitle}</title>
	<meta name="description" content={t('meta.description')} />
	<meta property="og:title" content={metaTitle} />
	<meta property="og:description" content={t('meta.og_description')} />
	<meta name="twitter:title" content={metaTitle} />
	<meta name="twitter:description" content={t('meta.og_description')} />
</svelte:head>
<div
	class="pager-shell"
	role="region"
	aria-label={t('nav.aria_label')}
	bind:this={pagerEl}
	onpointerdown={handlePointerDown}
	onpointerup={handlePointerUp}
	onpointercancel={handlePointerUp}
	use:passiveWheel
>
	<PagerNavigation
		{sections}
		{activeIndex}
		{currentTheme}
		{themeLabel}
		bind:pagerNavCentered
		bind:pagerNavEl
		bind:pagerNavShellEl
		localeVersion={$localeVersion}
		{t}
		onSelect={selectSection}
		onThemeToggle={toggleWallpaperTheme}
	/>

	<PagerSections
		{activeIndex}
		{sections}
		{pagerDirection}
		{pagerMotionDistance}
		{pagerMotionDuration}
		{reducedMotionEffective}
		{BmiFormComponent}
		{BmiResultsComponent}
		{BmiRadialGaugeComponent}
		{BmiHealthRiskComponent}
		{BmiSnapshotComponent}
		{BodyFatEstimateComponent}
		{ReferenceTableComponent}
		{BmiGoalTrackerComponent}
		bind:age
		bind:height
		bind:weight
		bind:gender
		bind:activity
		bind:unitSystem
		{calculating}
		{resultsRunId}
		{bmiValue}
		{category}
		{contentReducedMotion}
		{isTouchDevice}
		{gitCommitId}
		{gitBranch}
		{currentYear}
		onClear={confirmClearData}
		onCalculate={handleCalculate}
		onNotify={handleImportNotify}
	/>

	<PagerControls
		{activeIndex}
		sectionCount={sections.length}
		showScrollTopFab={isTouchDevice || showScrollTopFab}
		onPrev={prevSection}
		onNext={nextSection}
		onScrollTop={scrollToTop}
	/>
</div>

<NotificationHost
	bind:showNotify
	bind:notifyType
	bind:notifyMessage
	bind:notifyButtonText
	bind:pendingImportText
	onImportSuccess={markImportSuccess}
	onDeleteConfirmed={confirmDeleteData}
/>

<StagingSpinner show={stagingLoading} />
