// Copyright (c) 2025 - 2026 rezky_nightky
/**
 * Generic lazy-loader for Svelte 5 dynamic component imports.
 *
 * Eliminates the repetitive ensureXxx() boilerplate in +page.svelte
 * by providing a factory that manages the import promise deduplication,
 * component caching, and null-guard pattern.
 *
 * Usage:
 *   const { ensure, component } = createLazyLoader({
 *     importer: () => import('$lib/components/Foo.svelte'),
 *     onLoad: (comp) => { FooComponent = comp; }  // bridges to Svelte 5 $state
 *   });
 *   // In $effect:
 *   await ensure();
 *   // In template:
 *   {#if FooComponent} <FooComponent /> {/if}
 */

import { browser } from '$app/environment';

interface LazyLoaderOptions<T> {
  /** Dynamic import function returning the module */
  importer: () => Promise<{ default: T }>;
  /** Skip loading on server (default: true) */
  ssrDisabled?: boolean;
  /**
   * Callback invoked when the component is loaded.
   * Use this to bridge the loaded component into a Svelte 5 `$state` variable.
   */
  onLoad?: (component: T) => void;
}

interface LazyLoaderResult<T> {
  /** Triggers the import if not already loaded. Returns resolved promise. */
  ensure: () => Promise<void>;
  /** The loaded component (null until ensure() resolves) */
  component: { value: T | null };
}

/**
 * Creates a reusable lazy-loader for a single component.
 *
 * @param opts.importer - Dynamic `import()` that returns `{ default: Component }`
 * @param opts.ssrDisabled - Whether to skip on server-side rendering (default true)
 * @returns Object with `ensure()` function and reactive `component` ref
 */
export function createLazyLoader<T>(
  opts: LazyLoaderOptions<T>
): LazyLoaderResult<T> {
  const { importer, ssrDisabled = true, onLoad } = opts;

  let loaded: T | null = null;
  let pending: Promise<void> | null = null;

  const ref: { value: T | null } = { value: null };

  function ensure(): Promise<void> {
    if (ssrDisabled && !browser) return Promise.resolve();
    if (loaded) {
      ref.value = loaded;
      return Promise.resolve();
    }
    if (!pending) {
      pending = importer()
        .then((mod) => {
          loaded = mod.default;
          ref.value = loaded;
          if (onLoad) onLoad(loaded);
        })
        .finally(() => {
          pending = null;
        });
    }
    return pending;
  }

  return { ensure, component: ref };
}

/**
 * Creates a paired lazy-loader that loads two components together.
 * Useful when form + results, or gauge + chart are always loaded as a pair.
 */
export function createPairedLazyLoader<A, B>(
  importA: () => Promise<{ default: A }>,
  importB: () => Promise<{ default: B }>,
  onLoadA?: (component: A) => void,
  onLoadB?: (component: B) => void
): {
  ensure: () => Promise<void>;
  componentA: { value: A | null };
  componentB: { value: B | null };
} {
  let loadedA: A | null = null;
  let loadedB: B | null = null;
  let pending: Promise<void> | null = null;

  const refA: { value: A | null } = { value: null };
  const refB: { value: B | null } = { value: null };

  function ensure(): Promise<void> {
    if (!browser) return Promise.resolve();
    if (loadedA && loadedB) {
      refA.value = loadedA;
      refB.value = loadedB;
      return Promise.resolve();
    }
    if (!pending) {
      pending = Promise.all([importA(), importB()])
        .then(([modA, modB]) => {
          loadedA = modA.default;
          loadedB = modB.default;
          refA.value = loadedA;
          refB.value = loadedB;
          if (onLoadA) onLoadA(loadedA);
          if (onLoadB) onLoadB(loadedB);
        })
        .finally(() => {
          pending = null;
        });
    }
    return pending;
  }

  return { ensure, componentA: refA, componentB: refB };
}