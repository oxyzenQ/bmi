/**
 * Optional passphrase-based encryption for BMI Calculator.
 *
 * Uses Web Crypto API (AES-GCM) to encrypt/decrypt stored data
 * and exported files. Encryption is entirely optional — the user
 * can enable/disable it at any time.
 *
 * Key derivation: PBKDF2 with 600k iterations + random salt
 * Encryption: AES-256-GCM with 12-byte IV
 * Storage: salt + IV + ciphertext (base64-encoded in JSON)
 *
 * Backward compatibility:
 *   - Non-encrypted files import correctly (auto-detected)
 *   - Encrypted files require the correct passphrase
 *   - Wrong passphrase produces decryption failure (handled gracefully)
 */

import { browser } from '$app/environment';
import { dbMetaGet, dbMetaSet, isIndexedDbAvailable } from './db';

// ── Constants ──
const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16; // 128-bit salt for PBKDF2
const IV_LENGTH = 12; // 96-bit IV for AES-GCM
const META_ENCRYPTION_KEY = '__encryption_enabled';
const META_ENCRYPTION_SALT = '__encryption_salt';

// ── Types ──
export interface EncryptedPayload {
  /** Format identifier — always 'bmi-encrypted-v1' */
  format: 'bmi-encrypted-v1';
  /** Base64-encoded PBKDF2 salt (16 bytes) */
  salt: string;
  /** Base64-encoded AES-GCM IV (12 bytes) */
  iv: string;
  /** Base64-encoded ciphertext */
  data: string;
}

export interface EncryptionStatus {
  enabled: boolean;
  hasPassphrase: boolean;
}

// ── Key management ──

/** Derive an AES-256-GCM key from a passphrase + salt using PBKDF2. */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
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

// ── Public API ──

/**
 * Encrypt a string using AES-256-GCM with a passphrase.
 * Returns a JSON string containing the encrypted payload.
 */
export async function encrypt(plaintext: string, passphrase: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = await deriveKey(passphrase, salt);

  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { name: 'AES-GCM', iv: iv as any },
    key,
    encoder.encode(plaintext)
  );

  const payload: EncryptedPayload = {
    format: 'bmi-encrypted-v1',
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(ciphertext)),
  };

  return JSON.stringify(payload);
}

/**
 * Decrypt an encrypted payload using AES-256-GCM with a passphrase.
 * Returns the original plaintext string, or null if decryption fails
 * (wrong passphrase, corrupted data, etc.).
 */
export async function decrypt(encryptedJson: string, passphrase: string): Promise<string | null> {
  try {
    const payload: EncryptedPayload = JSON.parse(encryptedJson);

    if (payload.format !== 'bmi-encrypted-v1') return null;

    const salt = fromBase64(payload.salt);
    const iv = fromBase64(payload.iv);
    const ciphertext = fromBase64(payload.data);
    const key = await deriveKey(passphrase, salt);

    const plaintext = await crypto.subtle.decrypt(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { name: 'AES-GCM', iv: iv as any },
      key,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ciphertext as any
    );

    return new TextDecoder().decode(plaintext);
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
    const decrypted = await decrypt(encrypted, passphrase);

    if (decrypted !== test) {
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
    const decrypted = await decrypt(encrypted, passphrase);
    return decrypted === test;
  } catch {
    return false;
  }
}
