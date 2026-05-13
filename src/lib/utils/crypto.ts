/**
 * Optional passphrase-based encryption for BMI Calculator.
 *
 * Uses Web Crypto API (AES-GCM) to encrypt/decrypt stored data
 * and exported files. Encryption is entirely optional — the user
 * can enable/disable it at any time.
 *
 * Key derivation (new): Argon2id — memory-hard KDF, resistant to GPU attacks
 *   Params (mobile-safe): 64 MB memory, 3 iterations, parallelism 1
 * Key derivation (legacy): PBKDF2 with 600k iterations + random salt
 * Encryption: AES-256-GCM with 12-byte IV
 * Integrity: SHA-256 checksum of plaintext stored in meta (explicit tamper detection)
 * Storage: salt + IV + ciphertext + checksum (base64-encoded in JSON)
 *
 * Passphrase verification (v18.1):
 *   - enableEncryption() stores a verifier (encrypted known plaintext)
 *   - verifyPassphrase() decrypts the stored verifier (not a self-test)
 *   - Wrong passphrase → AES-GCM auth tag mismatch → false
 *
 * Backward compatibility:
 *   - Files encrypted with PBKDF2 (no kdf field) auto-detected and still decryptable
 *   - Non-encrypted files import correctly (auto-detected)
 *   - Encrypted files require the correct passphrase
 *   - Wrong passphrase produces decryption failure (handled gracefully)
 *   - Tampered files produce explicit integrity_failed error (not generic decrypt error)
 */

import { browser } from '$app/environment';
import { dbMetaGet, dbMetaSet, isIndexedDbAvailable } from './db';
import { warnDev } from './warn-dev';

// ── Constants ──
const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16; // 128-bit salt
const IV_LENGTH = 12; // 96-bit IV for AES-GCM

/**
 * Argon2id parameters — tuned for mobile safety.
 * Based on OWASP 2023 recommendations for password hashing.
 *
 * In test mode (`vitest`), uses lightweight params (1 MiB, 1 iteration) so
 * CI crypto tests finish deterministically without timeouts.
 *
 * Production params:
 *   m:  64 MiB memory cost — resistant to GPU attacks
 *   t:  3 iterations — harder for brute force
 *   p:  1 parallelism — single thread for mobile compatibility
 *   dkLen: 32 bytes (256-bit → AES-256 key)
 */
const IS_TEST = import.meta.env?.MODE === 'test';

const ARGON2_OPTIONS = IS_TEST
  ? { m: 1024, t: 1, p: 1, dkLen: 32 }   // lightweight — CI-friendly
  : {
      m: 64 * 1024,   // 64 MiB memory cost (OWASP 2023)
      t: 3,            // 3 iterations
      p: 1,            // parallelism (single thread for mobile)
      dkLen: 32,       // 256-bit output → AES-256 key
    };

const META_ENCRYPTION_KEY = '__encryption_enabled';
const META_ENCRYPTION_VERIFIER = '__encryption_verifier';
// Passphrase hint stored in localStorage (see setPassphraseHint / getPassphraseHint below)

/** Known plaintext encrypted during enableEncryption() for later passphrase verification. */
const VERIFIER_PLAINTEXT = 'BMI_STELLAR_VERIFIER_V1';

// ── Types ──
export interface EncryptedPayload {
  /** Format identifier — always 'bmi-encrypted-v1' */
  format: 'bmi-encrypted-v1';
  /** Cipher algorithm used: always 'aes-256-gcm' */
  cipher?: 'aes-256-gcm';
  /** Key derivation function used: 'argon2id' or 'pbkdf2' (legacy) */
  kdf?: 'argon2id' | 'pbkdf2';
  /** Argon2id parameters (only when kdf === 'argon2id') */
  kdfParams?: {
    type: number;
    mem: number;
    time: number;
    parallelism: number;
    hashLen: number;
  };
  /** Base64-encoded salt (16 bytes) */
  salt: string;
  /** Base64-encoded AES-GCM IV (12 bytes) */
  iv: string;
  /** Base64-encoded ciphertext */
  data: string;
  /** Unencrypted metadata for preview before decryption */
  meta?: {
    /** ISO timestamp of when the export was created */
    exportedAt?: string;
    /** Number of records in the encrypted payload */
    recordCount?: number;
    /** Envelope version (0–3) */
    version?: number;
    /** SHA-256 checksum of plaintext — explicit tamper detection */
    checksum?: string;
  };
}

export interface EncryptionStatus {
  enabled: boolean;
  hasPassphrase: boolean;
}

// ── Key management ──

/**
 * Extract a clean ArrayBuffer from a Uint8Array.
 * WebCrypto (both browser and Node.js) sometimes rejects Uint8Array.buffer
 * when the backing store is SharedArrayBuffer or has an offset.
 * Copying into a fresh ArrayBuffer guarantees a valid BufferSource.
 */
function toAB(src: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(src.length);
  new Uint8Array(ab).set(src);
  return ab;
}

/**
 * Derive an AES-256-GCM key from a passphrase + salt using Argon2id.
 * Uses @noble/hashes (pure JS, no WASM, tiny bundle footprint).
 */
async function deriveKeyArgon2(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const { argon2id } = await import('@noble/hashes/argon2.js');
  const hashBytes = argon2id(
    new TextEncoder().encode(passphrase),
    salt,
    ARGON2_OPTIONS
  );

  return crypto.subtle.importKey(
    'raw',
    toAB(hashBytes),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Derive an AES-256-GCM key from a passphrase + salt using PBKDF2 (legacy). */
async function deriveKeyPBKDF2(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    toAB(encoder.encode(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toAB(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive a key using the KDF specified in the payload.
 * Falls back to PBKDF2 for legacy payloads (no kdf field).
 */
async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  kdf?: 'argon2id' | 'pbkdf2'
): Promise<CryptoKey> {
  if (kdf === 'argon2id') {
    try {
      return await deriveKeyArgon2(passphrase, salt);
    } catch (err) {
      // Argon2 unavailable — fall back to PBKDF2
      warnDev('crypto', 'deriveKey', 'Argon2id unavailable, falling back to PBKDF2', err);
      return deriveKeyPBKDF2(passphrase, salt);
    }
  }
  // Default / legacy: PBKDF2
  return deriveKeyPBKDF2(passphrase, salt);
}

/** Generate cryptographically random bytes. */
function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Convert Uint8Array to base64 string. */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Convert base64 string to Uint8Array. */
function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── SHA-256 checksum (explicit integrity) ──

/**
 * Compute SHA-256 checksum of plaintext for explicit tamper detection.
 * Stored unencrypted in meta.checksum so import can detect tampering
 * BEFORE attempting decryption (clear error UX).
 */
export async function computeChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return toBase64(new Uint8Array(hashBuffer));
}

/**
 * Verify plaintext against stored checksum.
 * Returns true if the data matches, false if tampered.
 */
export async function verifyChecksum(data: string, checksum: string): Promise<boolean> {
  const computed = await computeChecksum(data);
  // Constant-time comparison (Web Crypto has no timingSafeEqual on SubtleCrypto)
  try {
    const a = Uint8Array.from(atob(computed), c => c.charCodeAt(0));
    const b = Uint8Array.from(atob(checksum), c => c.charCodeAt(0));
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i]; // XOR — accumulates differences without early exit
    }
    return result === 0;
  } catch (err) {
    warnDev('crypto', 'verifyChecksum', 'Checksum comparison failed — possibly corrupted base64', err);
    return false;
  }
}

// ── Passphrase hint (local only) ──

const STORAGE_PREFIX = 'bmi.';
const HINT_KEY = `${STORAGE_PREFIX}passphrase_hint`;

/**
 * Save a passphrase hint to localStorage (device-local only).
 * NEVER exported to encrypted files.
 */
export function setPassphraseHint(hint: string): void {
  if (!browser) return;
  try {
    if (hint && hint.trim()) {
      localStorage.setItem(HINT_KEY, hint.trim());
    } else {
      localStorage.removeItem(HINT_KEY);
    }
  } catch (err) { warnDev('crypto', 'setPassphraseHint', 'Failed to persist hint', err); }
}

/**
 * Load the passphrase hint from localStorage.
 * Returns empty string if no hint is stored.
 */
export function getPassphraseHint(): string {
  if (!browser) return '';
  try {
    return localStorage.getItem(HINT_KEY) || '';
  } catch (err) {
    warnDev('crypto', 'getPassphraseHint', 'Failed to read hint', err);
    return '';
  }
}

// ── Passphrase strength analysis ──

export interface StrengthResult {
  /** 0–4 score (0=very weak, 4=very strong) */
  score: number;
  /** Estimated entropy in bits (log10 scale from zxcvbn) */
  entropy: number;
  /** Crack time in seconds (raw, for i18n formatting in UI) */
  crackTimeSeconds: number;
  /** User-facing feedback (suggestions) */
  warning?: string;
  suggestions: string[];
}

/**
 * Analyze passphrase strength using @zxcvbn-ts/core.
 * Returns score (0-4), entropy, crack time, and feedback.
 * Uses dynamic import to keep bundle small until needed.
 * Dictionary is loaded once and reused across calls.
 */
let _zxcvbnReady: Promise<boolean> | null = null;

async function initZxcvbn(): Promise<boolean> {
  try {
    const { zxcvbnOptions } = await import('@zxcvbn-ts/core');
    const { dictionary } = await import('@zxcvbn-ts/language-common');
    zxcvbnOptions.setOptions({ dictionary });
    return true;
  } catch (err) {
    warnDev('crypto', 'initZxcvbn', '@zxcvbn-ts/core init failed, using fallback scoring', err);
    return false;
  }
}

export async function analyzeStrength(passphrase: string): Promise<StrengthResult> {
  if (!passphrase) {
    return { score: 0, entropy: 0, crackTimeSeconds: 0, suggestions: [] };
  }

  try {
    // Initialize dictionary once (subsequent calls reuse cached promise)
    if (!_zxcvbnReady) {
      _zxcvbnReady = initZxcvbn();
    }
    const ready = await _zxcvbnReady;

    if (!ready) {
      return fallbackStrength(passphrase);
    }

    const { zxcvbn } = await import('@zxcvbn-ts/core');
    const result = zxcvbn(passphrase);

    return {
      score: result.score,
      entropy: result.guessesLog10,
      crackTimeSeconds: result.crackTimesSeconds.offlineSlowHashing1e4PerSecond,
      warning: result.feedback.warning || undefined,
      suggestions: [...(result.feedback.suggestions || [])],
    };
  } catch (err) {
    // zxcvbn load failure — fall back to basic scoring
    warnDev('crypto', 'analyzeStrength', 'zxcvbn unavailable, using fallback scoring', err);
    return fallbackStrength(passphrase);
  }
}

/** Basic strength scoring fallback if zxcvbn is unavailable. */
function fallbackStrength(pw: string): StrengthResult {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  return { score, entropy: 0, crackTimeSeconds: 0, suggestions: [] };
}

// ── Public API ──

/**
 * Encrypt a string using AES-256-GCM with a passphrase.
 * Uses Argon2id for key derivation (new format).
 * Falls back to PBKDF2 only if Argon2 WASM fails.
 * Returns a JSON string containing the encrypted payload.
 * Optional meta is stored unencrypted for preview before decryption.
 */
export async function encrypt(plaintext: string, passphrase: string, meta?: EncryptedPayload['meta']): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const checksum = await computeChecksum(plaintext);

  let key: CryptoKey;
  let kdf: 'argon2id' | 'pbkdf2' = 'argon2id';
  let kdfParams: EncryptedPayload['kdfParams'];

  try {
    key = await deriveKeyArgon2(passphrase, salt);
    kdfParams = {
      type: 2,
      mem: ARGON2_OPTIONS.m,
      time: ARGON2_OPTIONS.t,
      parallelism: ARGON2_OPTIONS.p,
      hashLen: ARGON2_OPTIONS.dkLen,
    };
  } catch (err) {
    // Argon2 unavailable — fall back to PBKDF2
    warnDev('crypto', 'encrypt', 'Argon2id unavailable, falling back to PBKDF2', err);
    key = await deriveKeyPBKDF2(passphrase, salt);
    kdf = 'pbkdf2';
  }

  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { name: 'AES-GCM', iv: iv as any },
    key,
    encoder.encode(plaintext)
  );

  const payload: EncryptedPayload = {
    format: 'bmi-encrypted-v1',
    cipher: 'aes-256-gcm',
    kdf,
    ...(kdfParams && { kdfParams }),
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(ciphertext)),
    meta: {
      ...meta,
      checksum,
    },
  };

  return JSON.stringify(payload);
}

/**
 * Decrypt an encrypted payload using AES-256-GCM with a passphrase.
 * Auto-detects KDF (argon2id or pbkdf2) from payload.
 * Returns `{ plaintext, integrityOk }` on success, or `null` on failure.
 *
 * Error differentiation (v16.0 — Reliability):
 *   - `OperationError`: AES-GCM auth tag mismatch → wrong passphrase (most likely)
 *   - Other errors: corrupted payload, invalid base64, etc.
 *   All failures are logged via warnDev with specific context.
 *
 * Integrity check: verifies SHA-256 checksum of decrypted plaintext
 * against stored checksum. Separate from AES-GCM auth tag — provides
 * explicit tamper detection with clear error messages.
 */
export async function decrypt(
  encryptedJson: string,
  passphrase: string
): Promise<{ plaintext: string; integrityOk: boolean } | null> {
  try {
    const payload: EncryptedPayload = JSON.parse(encryptedJson);

    if (payload.format !== 'bmi-encrypted-v1') {
      warnDev('crypto', 'decrypt', 'Unknown encrypted format — expected bmi-encrypted-v1');
      return null;
    }

    // Validate payload structure before attempting crypto operations
    if (!payload.salt || !payload.iv || !payload.data) {
      warnDev('crypto', 'decrypt', 'Encrypted payload is missing required fields (salt, iv, or data)');
      return null;
    }

    // Validate base64 integrity before decoding
    try {
      fromBase64(payload.salt);
      fromBase64(payload.iv);
      fromBase64(payload.data);
    } catch (err) {
      warnDev('crypto', 'decrypt', 'Encrypted payload contains invalid base64 — data may be corrupted', err);
      return null;
    }

    const salt = fromBase64(payload.salt);
    const iv = fromBase64(payload.iv);
    const ciphertext = fromBase64(payload.data);
    const kdf = payload.kdf || 'pbkdf2'; // Default to PBKDF2 for legacy

    const key = await deriveKey(passphrase, salt, kdf);

    const plaintextBuf = await crypto.subtle.decrypt(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { name: 'AES-GCM', iv: iv as any },
      key,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ciphertext as any
    );

    const plaintext = new TextDecoder().decode(plaintextBuf);

    // Verify checksum if present (explicit tamper detection)
    let integrityOk = true;
    if (payload.meta?.checksum) {
      integrityOk = await verifyChecksum(plaintext, payload.meta.checksum);
    }

    return { plaintext, integrityOk };
  } catch (err) {
    // Differentiate AES-GCM auth tag mismatch (wrong passphrase) from other errors
    if (err instanceof DOMException && err.name === 'OperationError') {
      warnDev('crypto', 'decrypt', 'AES-GCM auth tag mismatch — likely wrong passphrase');
    } else {
      warnDev('crypto', 'decrypt', 'Decryption failed (corrupted data or crypto error)', err);
    }
    return null;
  }
}

/**
 * Check if a string is an encrypted payload.
 */
export function isEncrypted(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    return parsed?.format === 'bmi-encrypted-v1';
  } catch (err) {
    warnDev('crypto', 'isEncrypted', 'Failed to parse payload for encryption detection', err);
    return false;
  }
}

// ── Encryption preference persistence ──

/**
 * Enable encryption and create a verifier for passphrase validation.
 *
 * Flow:
 *   1. Encrypt a known test string (VERIFIER_PLAINTEXT) with the passphrase
 *   2. Store the encrypted verifier in IndexedDB
 *   3. Later, verifyPassphrase() decrypts this stored verifier to validate
 *
 * The passphrase itself is NEVER stored — only the verifier ciphertext.
 * A wrong passphrase will fail AES-GCM authentication (auth tag mismatch).
 */
export async function enableEncryption(passphrase: string): Promise<boolean> {
  if (!browser || !isIndexedDbAvailable()) return false;

  try {
    // Create a verifier by encrypting the known plaintext
    const verifier = await encrypt(VERIFIER_PLAINTEXT, passphrase);
    await dbMetaSet(META_ENCRYPTION_VERIFIER, verifier);
    await dbMetaSet(META_ENCRYPTION_KEY, '1');
    return true;
  } catch (err) {
    warnDev('crypto', 'enableEncryption', 'Failed to enable encryption (verifier creation or DB write)', err);
    return false;
  }
}

/**
 * Disable encryption. Clears the verifier so stored passphrase can no longer be validated.
 * Does NOT decrypt existing encrypted data — the user must decrypt first.
 */
export async function disableEncryption(): Promise<void> {
  if (!browser || !isIndexedDbAvailable()) return;
  await dbMetaSet(META_ENCRYPTION_KEY, '0');
  await dbMetaSet(META_ENCRYPTION_VERIFIER, '');
}

/**
 * Get the current encryption status.
 * `hasPassphrase` is true only when a real verifier exists in storage.
 */
export async function getEncryptionStatus(): Promise<EncryptionStatus> {
  if (!browser || !isIndexedDbAvailable()) {
    return { enabled: false, hasPassphrase: false };
  }

  try {
    const enabled = await dbMetaGet(META_ENCRYPTION_KEY);
    const verifier = await dbMetaGet(META_ENCRYPTION_VERIFIER);
    return {
      enabled: enabled === '1',
      hasPassphrase: Boolean(verifier), // true only if a verifier record exists
    };
  } catch (err) {
    warnDev('crypto', 'getEncryptionStatus', 'Failed to read encryption status from IndexedDB', err);
    return { enabled: false, hasPassphrase: false };
  }
}

/**
 * Verify a passphrase against the previously stored verifier.
 *
 * Unlike the previous (broken) implementation that created a new encrypted blob
 * with the same passphrase and immediately decrypted it (always true), this
 * version decrypts the VERIFIER stored by enableEncryption().
 *
 * - Correct passphrase → decrypt succeeds → plaintext matches → true
 * - Wrong passphrase → AES-GCM auth tag mismatch → null → false
 * - No verifier stored → returns false (encryption not enabled)
 */
export async function verifyPassphrase(passphrase: string): Promise<boolean> {
  if (!browser || !isIndexedDbAvailable()) return false;

  try {
    const storedVerifier = await dbMetaGet(META_ENCRYPTION_VERIFIER);
    if (!storedVerifier) {
      warnDev('crypto', 'verifyPassphrase', 'No verifier found — encryption may not be enabled');
      return false;
    }

    const result = await decrypt(storedVerifier, passphrase);
    if (!result || result.plaintext !== VERIFIER_PLAINTEXT) {
      return false;
    }

    return true;
  } catch (err) {
    warnDev('crypto', 'verifyPassphrase', 'Passphrase verification failed', err);
    return false;
  }
}
