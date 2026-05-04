/**
 * Optional passphrase-based encryption for BMI Calculator.
 *
 * Uses Web Crypto API (AES-GCM) to encrypt/decrypt stored data
 * and exported files. Encryption is entirely optional — the user
 * can enable/disable it at any time.
 *
 * Key derivation (new): Argon2id — memory-hard KDF, resistant to GPU attacks
 *   Params (mobile-safe): 32 MB memory, 2 iterations, parallelism 1
 * Key derivation (legacy): PBKDF2 with 600k iterations + random salt
 * Encryption: AES-256-GCM with 12-byte IV
 * Integrity: SHA-256 checksum of plaintext stored in meta (explicit tamper detection)
 * Storage: salt + IV + ciphertext + checksum (base64-encoded in JSON)
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

// ── Constants ──
const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16; // 128-bit salt
const IV_LENGTH = 12; // 96-bit IV for AES-GCM

/**
 * Argon2id parameters — tuned for mobile safety (max ~32 MB RAM).
 * Uses @noble/hashes (pure JS, no WASM overhead).
 * 32 MB memory, 2 iterations, parallelism 1.
 */
const ARGON2_OPTIONS = {
  m: 32 * 1024,   // 32 MB memory cost (Kibibytes)
  t: 2,            // 2 iterations (time cost)
  p: 1,            // parallelism (single thread for mobile)
  dkLen: 32,       // 256-bit output → AES-256 key
};

const META_ENCRYPTION_KEY = '__encryption_enabled';
const META_ENCRYPTION_SALT = '__encryption_salt';
// Passphrase hint stored in localStorage (see setPassphraseHint / getPassphraseHint below)

// ── Types ──
export interface EncryptedPayload {
  /** Format identifier — always 'bmi-encrypted-v1' */
  format: 'bmi-encrypted-v1';
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
    hashBytes.buffer as ArrayBuffer,
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
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
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
    } catch {
      // Argon2 unavailable — fall back to PBKDF2
      console.warn('[crypto] Argon2id unavailable, falling back to PBKDF2');
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
  } catch {
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
  } catch { /* localStorage unavailable */ }
}

/**
 * Load the passphrase hint from localStorage.
 * Returns empty string if no hint is stored.
 */
export function getPassphraseHint(): string {
  if (!browser) return '';
  try {
    return localStorage.getItem(HINT_KEY) || '';
  } catch {
    return '';
  }
}

// ── Passphrase strength analysis ──

export interface StrengthResult {
  /** 0–4 score (0=very weak, 4=very strong) */
  score: number;
  /** Estimated entropy in bits (log10 scale from zxcvbn) */
  entropy: number;
  /** Crack time display string */
  crackTimeDisplay: string;
  /** User-facing feedback (suggestions) */
  warning?: string;
  suggestions: string[];
}

/**
 * Analyze passphrase strength using zxcvbn.
 * Returns score (0-4), entropy, crack time, and feedback.
 * Uses dynamic import to keep bundle small until needed.
 */
export async function analyzeStrength(passphrase: string): Promise<StrengthResult> {
  if (!passphrase) {
    return { score: 0, entropy: 0, crackTimeDisplay: 'instant', suggestions: [] };
  }

  try {
    const { zxcvbn } = await import('zxcvbn-ts');
    const result = zxcvbn(passphrase);

    return {
      score: result.score,
      entropy: result.guesses_log10,
      crackTimeDisplay: result.crack_times_display.offline_slow_hashing_1e5_per_second,
      warning: result.feedback.warning || undefined,
      suggestions: [...(result.feedback.suggestions || [])],
    };
  } catch {
    // zxcvbn load failure — fall back to basic scoring
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
  return { score, entropy: 0, crackTimeDisplay: '', suggestions: [] };
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
  } catch {
    // Argon2 unavailable — fall back to PBKDF2
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

    if (payload.format !== 'bmi-encrypted-v1') return null;

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
  } catch {
    // Wrong passphrase or corrupted data — AES-GCM auth tag mismatch
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
  } catch {
    return false;
  }
}

// ── Encryption preference persistence ──

/**
 * Enable encryption and store the passphrase salt in IndexedDB meta.
 * The passphrase itself is NEVER stored — only the salt for key derivation.
 * The user must re-enter the passphrase on each session.
 */
export async function enableEncryption(passphrase: string): Promise<boolean> {
  if (!browser || !isIndexedDbAvailable()) return false;

  try {
    const salt = randomBytes(SALT_LENGTH);
    await dbMetaSet(META_ENCRYPTION_SALT, toBase64(salt));
    await dbMetaSet(META_ENCRYPTION_KEY, '1');

    // Verify the passphrase works by encrypting/decrypting a test string
    const test = 'bmi-encryption-test';
    const encrypted = await encrypt(test, passphrase);
    const result = await decrypt(encrypted, passphrase);

    if (!result || result.plaintext !== test) {
      // Something went wrong — disable
      await disableEncryption();
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Disable encryption. Does NOT decrypt existing encrypted data —
 * the user must decrypt first or data will become unreadable.
 */
export async function disableEncryption(): Promise<void> {
  if (!browser || !isIndexedDbAvailable()) return;
  await dbMetaSet(META_ENCRYPTION_KEY, '0');
}

/**
 * Get the current encryption status.
 */
export async function getEncryptionStatus(): Promise<EncryptionStatus> {
  if (!browser || !isIndexedDbAvailable()) {
    return { enabled: false, hasPassphrase: false };
  }

  try {
    const enabled = await dbMetaGet(META_ENCRYPTION_KEY);
    const hasSalt = await dbMetaGet(META_ENCRYPTION_SALT);
    return {
      enabled: enabled === '1',
      hasPassphrase: hasSalt !== null,
    };
  } catch {
    return { enabled: false, hasPassphrase: false };
  }
}

/**
 * Verify a passphrase against the stored salt.
 * Returns true if the passphrase can successfully encrypt/decrypt.
 */
export async function verifyPassphrase(passphrase: string): Promise<boolean> {
  try {
    const test = 'bmi-verify-test';
    const encrypted = await encrypt(test, passphrase);
    const result = await decrypt(encrypted, passphrase);
    return result !== null && result.plaintext === test;
  } catch {
    return false;
  }
}
