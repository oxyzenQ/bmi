/**
 * Type declarations for dynamically-imported crypto modules.
 *
 * These exist because:
 *   - @noble/hashes ships .d.ts files that internally import './utils.ts',
 *     but only utils.js exists at runtime. Some TypeScript/svelte-check
 *     versions fail to resolve this, causing "Cannot find module" errors.
 *   - zxcvbn-ts ESM types may not be found by the TS bundler resolver
 *     depending on the environment's TypeScript version.
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

declare module 'zxcvbn-ts' {
  export interface ZxcvbnResult {
    /** Password strength score: 0 (very weak) to 4 (very strong) */
    score: 0 | 1 | 2 | 3 | 4;
    /** Estimated guesses (base-10 logarithm) */
    guesses_log10: number;
    /** Estimated guesses (raw number) */
    guesses: number;
    /** Crack time estimates in human-readable format */
    crack_times_display: {
      readonly online_throttling_100_per_hour: string;
      readonly online_no_throttling_10_per_second: string;
      readonly offline_slow_hashing_1e5_per_second: string;
      readonly offline_fast_hashing_1e11_per_second: string;
    };
    /** User-facing feedback with suggestions */
    feedback: {
      readonly warning: string;
      readonly suggestions: readonly string[];
    };
    /** Calculation time in milliseconds */
    calc_time: number;
  }

  /**
   * Analyze password/passphrase strength.
   * Returns score, entropy estimate, crack times, and feedback suggestions.
   */
  export function zxcvbn(password: string): ZxcvbnResult;
}
