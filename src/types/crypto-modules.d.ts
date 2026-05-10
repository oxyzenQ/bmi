/**
 * Type declarations for dynamically-imported crypto modules.
 *
 * These exist because:
 *   - @noble/hashes ships .d.ts files that internally import './utils.ts',
 *     but only utils.js exists at runtime. Some TypeScript/svelte-check
 *     versions fail to resolve this, causing "Cannot find module" errors.
 *   - @zxcvbn-ts/core ESM types may not be found by the TS bundler
 *     resolver depending on the environment's TypeScript version.
 *
 * By declaring the modules here, svelte-check never needs to traverse
 * the packages' own (potentially broken) type declarations.
 */

declare module '@noble/hashes/argon2.js' {
  interface Argon2Opts {
    /** Time cost (iterations) */
    t: number;
    /** Memory cost in kibibytes */
    m: number;
    /** Parallelism */
    p: number;
    /** Output length in bytes */
    dkLen?: number;
    /** Argon2 version (default 0x13) */
    version?: number;
  }

  /**
   * Argon2id key derivation function (RFC 9106).
   * Returns raw derived key bytes synchronously.
   */
  export function argon2id(
    password: Uint8Array | string,
    salt: Uint8Array | string,
    opts: Argon2Opts
  ): Uint8Array;
}

declare module '@zxcvbn-ts/core' {
  export interface ZxcvbnOptions {
    setOptions(options: { dictionary?: Record<string, Record<string, number>> }): void;
  }

  export const zxcvbnOptions: ZxcvbnOptions;

  export interface ZxcvbnResult {
    /** Password strength score: 0 (very weak) to 4 (very strong) */
    score: 0 | 1 | 2 | 3 | 4;
    /** Estimated guesses (base-10 logarithm) */
    guessesLog10: number;
    /** Estimated guesses (raw number) */
    guesses: number;
    /** Crack time estimates in seconds */
    crackTimesSeconds: {
      readonly onlineThrottling100PerHour: number;
      readonly onlineNoThrottling10PerSecond: number;
      readonly offlineSlowHashing1e4PerSecond: number;
      readonly offlineFastHashing1e10PerSecond: number;
    };
    /** Crack time estimates in human-readable format */
    crackTimesDisplay: {
      readonly onlineThrottling100PerHour: string;
      readonly onlineNoThrottling10PerSecond: string;
      readonly offlineSlowHashing1e4PerSecond: string;
      readonly offlineFastHashing1e10PerSecond: string;
    };
    /** User-facing feedback with suggestions */
    feedback: {
      readonly warning: string;
      readonly suggestions: readonly string[];
    };
    /** Calculation time in milliseconds */
    calcTime: number;
  }

  /**
   * Analyze password/passphrase strength.
   * Returns score, entropy estimate, crack times, and feedback suggestions.
   */
  export function zxcvbn(password: string): ZxcvbnResult;
}

declare module '@zxcvbn-ts/language-common' {
  /** Standard password frequency dictionaries (English) */
  export const dictionary: Record<string, Record<string, number>>;
  /** Keyboard adjacency graphs for spatial pattern detection */
  export const adjacencyGraphs: Record<string, Record<string, string[]>>;
}
