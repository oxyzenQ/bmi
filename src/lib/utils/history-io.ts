// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial
/**
 * BMI History Export/Import utilities with HMAC-SHA256 integrity checksum.
 *
 * Export wraps records in a versioned envelope with an HMAC-SHA256 signature.
 * The signature provides integrity verification — it detects accidental
 * corruption and casual tampering of export files. It is NOT a security
 * mechanism against determined attackers: the HMAC key is embedded in the
 * client-side JS bundle and can be extracted by inspection. A per-export
 * random salt mixes into the MAC so identical records still produce
 * different signatures; the key is split into two base64 fragments and
 * XOR-assembled at runtime as a minor deterrent against trivial
 * extraction — obfuscation only, not encryption. For actual secret
 * protection, the optional AES-256-GCM encryption layer (separate from
 * this checksum) is used with a user-provided passphrase.
 *
 * Envelope format:
 *   v0 (checksum 8-ch)  — FNV-1a 32-bit on records only        [legacy import only]
 *   v1 (checksum 16-ch) — FNV-1a+DJB2 64-bit on envelope       [legacy import only]
 *   v2 (checksum 64-ch) — SHA-256 256-bit on envelope           [legacy import only]
 *   v3 (signature 64-ch)— HMAC-SHA256 + salt + algorithm field  [legacy import]
 *   v4 (signature 64-ch)— HMAC-SHA256 + salt + the continuity chain
 *                         head (Z3: a backup taken earlier witnesses later tampering)
 *
 * All five formats are accepted on import for backward compatibility.
 *
 * NOTE: every storage read/write rides the centralized storage.ts module.
 */

import { t } from '$lib/i18n';
import { STORAGE_KEYS, storageGet } from './storage';
import { warnDev } from './warn-dev';
import type { BmiRecord } from '$lib/types/bmi-record';
import { fnv1a, dualHash } from './legacy-hash';
import { computeLedgerChain } from './ledger-continuity';
import { INPUT_LIMITS } from './bmi-calculator';
import { bytesToHex } from './hex';

// ── Import error codes — structured, specific, no silent failures ──

export type ImportError =
	| 'empty_file'
	| 'file_too_large'
	| 'too_many_records'
	| 'invalid_json'
	| 'invalid_format'
	| 'unsupported_version'
	| 'encrypted_no_passphrase'
	| 'wrong_passphrase'
	| 'corrupted_file'
	| 'no_valid_records'
	| 'integrity_failed'
	| 'save_failed';

/** Max allowed import file size (5 MB) */
export const MAX_IMPORT_SIZE = 5 * 1024 * 1024;

/** Max records an import may carry (night-depth-hardening-5). The
 * ledger's save floor is O(N) sync hashes (ledger-chain), so one
 * uncapped hostile file becomes a durable per-save tax forever; 10k
 * records is roughly 27 years of daily entries — a burn bound, not a
 * feature limit. */
export const MAX_IMPORT_RECORDS = 10_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of the exported JSON file.
 *  v0–v2 use `checksum`; v3 uses `signature` + `algorithm` + `salt`;
 *  v4 adds `chain` — the continuity head anchoring the records, riding
 *  the user's own export as the zero-cloud witness (night-frontier-Z3).
 *  Legacy fields (`checksum`) are still read on import for backward compat.
 */
interface ExportedEnvelope {
	version: number;
	source: string;
	exportedAt: string;
	/** v0–v2 only: hash/checksum string */
	checksum?: string;
	/** v3: HMAC-SHA256 hex signature */
	signature?: string;
	/** v3: algorithm identifier (e.g. "HMAC-SHA256") */
	algorithm?: string;
	/** v3: random 32-char hex nonce */
	salt?: string;
	/** v4: the ledger continuity chain over the records as exported */
	chain?: {
		/** Chain head (SHA-256 hex) at export time */
		head: string;
		/** Number of records the chain covers */
		length: number;
	};
	records: BmiRecord[];
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 — integrity checksum mechanism (v3+)
// ---------------------------------------------------------------------------
//
// Checksum key is split into two base64 fragments and XOR-assembled at runtime.
// This is a minor deterrent against trivial bundle extraction — it is obfuscation
// only. The assembled key exists in memory at runtime and provides integrity
// checksums for export files, not secret protection.
//
// For actual encryption/protection, use the AES-256-GCM layer with a passphrase.

const _FRAG_A = 'MEKV+5tbi5OA8YWGUdNl3FTLQ0tw1SyStvC1tnRvQkE=';
const _FRAG_B = '7arCbOk0/5qzGwk8EXwg4vvkEPm5E8i7i8hO0LejM4c=';
// Neither fragment alone produces the correct checksum key.
// At runtime the two are XOR-assembled: key = FRAG_A ^ FRAG_B.

function assembleKey(): Uint8Array {
	const a = Uint8Array.from(atob(_FRAG_A), (c) => c.charCodeAt(0));
	const b = Uint8Array.from(atob(_FRAG_B), (c) => c.charCodeAt(0));
	const raw = new Uint8Array(a.length);
	for (let i = 0; i < a.length; i++) raw[i] = a[i] ^ b[i];
	return raw;
}

let _hmacKey: CryptoKey | null = null;

async function getHmacKey(): Promise<CryptoKey> {
	if (_hmacKey) return _hmacKey;
	const raw = assembleKey();
	_hmacKey = await crypto.subtle.importKey(
		'raw',
		raw.buffer as ArrayBuffer,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
	return _hmacKey;
}

/** Generate a cryptographically random 16-byte salt (32 hex chars). */
function generateSalt(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return bytesToHex(bytes);
}

/** Compute HMAC-SHA256(salt || payload). Returns 64-char hex. */
async function computeHmac(payload: string, salt: string): Promise<string> {
	const key = await getHmacKey();
	const data = new TextEncoder().encode(salt + payload);
	const sig = await crypto.subtle.sign('HMAC', key, data);
	return bytesToHex(new Uint8Array(sig));
}

/** Verify an HMAC-SHA256 signature. Uses crypto.subtle.verify for constant-time comparison. */
async function verifyHmac(signature: string, payload: string, salt: string): Promise<boolean> {
	try {
		const key = await getHmacKey();
		const data = new TextEncoder().encode(salt + payload);
		const sigBytes = new Uint8Array(signature.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []);
		return await crypto.subtle.verify('HMAC', key, sigBytes, data);
	} catch (err) {
		warnDev('history-io', 'verifyHmac', 'HMAC verification failed', err);
		return false;
	}
}

// ---------------------------------------------------------------------------
// SHA-256 hash — legacy v2 verification (no secret key)
// ---------------------------------------------------------------------------
async function computeHash(data: string): Promise<string> {
	const encoder = new TextEncoder();
	const dataBuffer = encoder.encode(data);
	const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
	const hashArray = new Uint8Array(hashBuffer);
	return bytesToHex(hashArray);
}

// ---------------------------------------------------------------------------
// Helpers to validate individual record fields
// ---------------------------------------------------------------------------

// Bounds gate for untrusted import files. JSON has no NaN/Infinity literals,
// but numeric literals like 1e999 parse to Infinity and pass a typeof check,
// and legacy v0-v2 checksums are trivially forgeable (see legacy-hash.ts) —
// so per-record bounds validation is the real defense here. Limits mirror
// INPUT_LIMITS (the same bounds the calculator enforces), and timestamps get
// a 24-hour clock-skew allowance. Anything outside these bounds can never
// originate from this app and would corrupt Date handling, sparkline scaling,
// and downstream exports.
const MAX_TIMESTAMP_SKEW_MS = 24 * 60 * 60 * 1000;
const MAX_AGE = 999; // matches sanitizeInteger's 3-digit cap

export function isValidRecord(entry: unknown): entry is BmiRecord {
	if (typeof entry !== 'object' || entry === null) return false;
	const r = entry as Record<string, unknown>;
	if (
		typeof r.timestamp !== 'number' ||
		typeof r.bmi !== 'number' ||
		typeof r.height !== 'number' ||
		typeof r.weight !== 'number'
	) {
		return false;
	}
	// Reject non-finite values (Infinity/-Infinity arrive via 1e999-style literals)
	if (
		!Number.isFinite(r.timestamp) ||
		!Number.isFinite(r.bmi) ||
		!Number.isFinite(r.height) ||
		!Number.isFinite(r.weight)
	) {
		return false;
	}
	if (r.timestamp <= 0 || r.timestamp > Date.now() + MAX_TIMESTAMP_SKEW_MS) return false;
	if (r.bmi <= 0) return false;
	if (r.height <= 0 || r.height > INPUT_LIMITS.HEIGHT_MAX_CM) return false;
	if (r.weight <= 0 || r.weight > INPUT_LIMITS.WEIGHT_MAX_KG) return false;
	if (r.age != null) {
		if (typeof r.age !== 'number' || !Number.isFinite(r.age) || r.age < 0 || r.age > MAX_AGE) {
			return false;
		}
	}
	return true;
}

export function toRecord(entry: unknown): BmiRecord {
	const r = entry as Record<string, unknown>;
	return {
		timestamp: r.timestamp as number,
		bmi: r.bmi as number,
		height: r.height as number,
		weight: r.weight as number,
		age: typeof r.age === 'number' ? r.age : undefined
	};
}

/** Check if parsed JSON matches the envelope shape. */
function isEnvelope(obj: unknown): obj is ExportedEnvelope {
	if (typeof obj !== 'object' || obj === null) return false;
	const e = obj as Record<string, unknown>;
	return typeof e.version === 'number' && e.source === 'bmi-calculator' && Array.isArray(e.records);
}

// ---------------------------------------------------------------------------
// Internal parse + validate (single JSON.parse, shared by public API)
// ---------------------------------------------------------------------------

interface ParsedImportResult {
	valid: boolean;
	envelope: ExportedEnvelope;
	records: BmiRecord[];
	validation: ValidationResult;
}

async function parseAndValidate(json: string): Promise<ParsedImportResult | InvalidResult> {
	let incoming: unknown;
	try {
		incoming = JSON.parse(json);
	} catch (err) {
		warnDev('history-io', 'parseAndValidate', 'Failed to parse import JSON', err);
		return {
			valid: false,
			validation: { valid: false, error: t('history.invalid_json'), errorCode: 'invalid_json' }
		};
	}

	if (!isEnvelope(incoming)) {
		return {
			valid: false,
			validation: { valid: false, error: t('history.invalid_format'), errorCode: 'invalid_format' }
		};
	}

	const env = incoming;

	// Version guard — only v0–v4 are known formats
	if (typeof env.version === 'number' && env.version > 4) {
		return {
			valid: false,
			validation: {
				valid: false,
				error: t('history.unsupported_version'),
				errorCode: 'unsupported_version'
			}
		};
	}

	const records = env.records.filter(isValidRecord).map(toRecord);

	if (records.length === 0) {
		return {
			valid: false,
			validation: { valid: false, error: t('history.no_records'), errorCode: 'no_valid_records' }
		};
	}

	// The burn bound: refuse past the record cap BEFORE any integrity work.
	if (records.length > MAX_IMPORT_RECORDS) {
		return {
			valid: false,
			validation: {
				valid: false,
				error: t('history.too_many_records'),
				errorCode: 'too_many_records'
			}
		};
	}

	const recordsJson = JSON.stringify(records);
	const result = await verifyIntegrity(env, recordsJson, records);

	if (!result.valid) {
		return {
			valid: false,
			validation: {
				valid: false,
				error: t('history.integrity_failed'),
				errorCode: 'integrity_failed'
			}
		};
	}

	return {
		valid: true,
		envelope: env,
		records,
		validation: {
			valid: true,
			recordCount: records.length,
			integrityVerified: true,
			integrityVersion: result.integrityVersion,
			algorithm: result.algorithm
		}
	};
}

interface InvalidResult {
	valid: false;
	validation: ValidationResult;
}

// ---------------------------------------------------------------------------
// Export — produces v3 (HMAC-SHA256) envelopes
// ---------------------------------------------------------------------------

/**
 * Export BMI history from storage as an HMAC-signed JSON string.
 * Returns `null` if no history exists or data is invalid.
 *
 * Each export includes a unique random salt so that re-exporting the
 * same records produces a different (but still valid) signature.
 *
 * If a passphrase is provided, the envelope is additionally encrypted
 * with AES-256-GCM before being returned.
 */
export async function exportBmiHistory(passphrase?: string): Promise<string | null> {
	try {
		const stored = storageGet(STORAGE_KEYS.HISTORY);
		if (!stored) return null;

		const parsed: unknown = JSON.parse(stored);
		if (!Array.isArray(parsed) || parsed.length === 0) return null;

		const records = parsed.filter(isValidRecord).map(toRecord);
		if (records.length === 0) return null;

		const recordsJson = JSON.stringify(records);
		const exportedAt = new Date().toISOString();

		// v4: HMAC-SHA256 with random salt plus the continuity chain head —
		// the export doubles as the user-held anchor.
		const chain = await computeLedgerChain(records);
		const salt = generateSalt();
		const payload = JSON.stringify({
			version: 4,
			source: 'bmi-calculator',
			exportedAt,
			records: recordsJson,
			chain
		});
		const signature = await computeHmac(payload, salt);

		const envelope: ExportedEnvelope = {
			version: 4,
			source: 'bmi-calculator',
			exportedAt,
			algorithm: 'HMAC-SHA256',
			salt,
			signature,
			chain,
			records
		};

		const envelopeJson = JSON.stringify(envelope, null, 2);

		// Optional encryption — embed metadata outside encrypted payload for preview
		if (passphrase) {
			const { encrypt } = await import('./crypto');
			return await encrypt(envelopeJson, passphrase, {
				exportedAt,
				recordCount: records.length,
				version: 4
			});
		}

		return envelopeJson;
	} catch (err) {
		warnDev('history-io', 'exportBmiHistory', 'Export failed', err);
		return null;
	}
}

// ---------------------------------------------------------------------------
// Validate (no side-effects)
// ---------------------------------------------------------------------------

export interface ValidationResult {
	valid: boolean;
	recordCount?: number;
	integrityVerified?: boolean;
	integrityVersion?: number; // 0, 1, 2, or 3
	algorithm?: string;
	error?: string;
	/** Structured error code for UI mapping */
	errorCode?: ImportError;
}

/**
 * Build the envelope payload string for integrity verification.
 * For v0 (FNV-1a, 8-char): records only (legacy).
 * For v1/v2/v3: full envelope with JSON-stringified records.
 * For v4: the same plus the continuity chain the signature must cover.
 */
function buildPayload(
	version: number,
	source: string,
	exportedAt: string,
	recordsJson: string,
	chain?: { head: string; length: number }
): string {
	if (version === 0) {
		// Legacy v0: only records were hashed
		return recordsJson;
	}
	// v1, v2, v3: full envelope was hashed (chain undefined → omitted)
	// v4: the chain rides inside the signed payload
	return JSON.stringify({ version, source, exportedAt, records: recordsJson, chain });
}

/**
 * Verify integrity with backward compatibility for all five formats:
 * v4 (HMAC + chain) / v3 (HMAC) / v2 (SHA-256) / v1 (dual hash) / v0 (FNV-1a).
 */
async function verifyIntegrity(
	env: ExportedEnvelope,
	recordsJson: string,
	records: BmiRecord[]
): Promise<{ valid: boolean; integrityVersion: number; algorithm?: string }> {
	const { version, source, exportedAt } = env;

	// v4: HMAC over records + chain, PLUS the continuity cross-check —
	// the envelope's chain must recompute exactly from its records
	// (catches a producer bug independently of the HMAC).
	if (
		version === 4 &&
		env.salt &&
		env.signature &&
		env.signature.length === 64 &&
		env.chain &&
		typeof env.chain.head === 'string' &&
		typeof env.chain.length === 'number'
	) {
		const computed = await computeLedgerChain(records);
		if (computed.head !== env.chain.head || computed.length !== env.chain.length) {
			warnDev('history-io', 'verifyIntegrity', 'v4 chain does not recompute from its records');
			return { valid: false, integrityVersion: 4, algorithm: env.algorithm };
		}
		const payload = buildPayload(version, source, exportedAt, recordsJson, env.chain);
		const ok = await verifyHmac(env.signature, payload, env.salt);
		return { valid: ok, integrityVersion: 4, algorithm: env.algorithm };
	}

	// v3: HMAC-SHA256 with per-export salt
	if (version === 3 && env.salt && env.signature && env.signature.length === 64) {
		const payload = buildPayload(version, source, exportedAt, recordsJson);
		const ok = await verifyHmac(env.signature, payload, env.salt);
		return { valid: ok, integrityVersion: 3, algorithm: env.algorithm };
	}

	// Legacy v0/v1/v2: fall back to `checksum` field
	const checksum = env.checksum ?? '';
	if (!checksum) return { valid: false, integrityVersion: -1 };

	// v2: SHA-256 on full envelope (no salt)
	if (checksum.length === 64) {
		const payload = buildPayload(version, source, exportedAt, recordsJson);
		const expected = await computeHash(payload);
		return { valid: checksum === expected, integrityVersion: 2 };
	}

	// v1: dual-hash on full envelope
	if (checksum.length === 16) {
		const payload = buildPayload(version, source, exportedAt, recordsJson);
		const expected = dualHash(payload);
		return { valid: checksum === expected, integrityVersion: 1 };
	}

	// v0: FNV-1a on records only
	if (checksum.length === 8) {
		const expected = fnv1a(recordsJson);
		return { valid: checksum === expected, integrityVersion: 0 };
	}

	return { valid: false, integrityVersion: -1 };
}

/**
 * Validate an imported JSON string without touching storage.
 * Use this to pre-check a file before asking the user for confirmation.
 */
/**
 * Shared import pre-guard (night-depth-hardening-5): the size gate and,
 * for encrypted payloads, the structure pre-check + passphrase decrypt,
 * run once for both entry points (validate and import) instead of the
 * two drifted copies. A corrupted encrypted payload answers
 * corrupted_file instead of a misleading wrong_passphrase; a sound one
 * decrypts or refuses with the honest code. `decrypted` tells the
 * import path whether the at-rest unlock must actually run.
 */
async function importPlaintextOrFail(
	json: string,
	passphrase?: string
): Promise<
	| { ok: true; content: string; decrypted: boolean }
	| { ok: false; error: string; errorCode: ImportError }
> {
	// Size guard — reject files exceeding MAX_IMPORT_SIZE before any processing
	if (json.length > MAX_IMPORT_SIZE) {
		return { ok: false, error: t('history.file_too_large'), errorCode: 'file_too_large' };
	}

	const { isEncrypted } = await import('./crypto');
	if (!isEncrypted(json)) return { ok: true, content: json, decrypted: false };

	if (!passphrase) {
		return {
			ok: false,
			error: t('history.encrypted_no_passphrase'),
			errorCode: 'encrypted_no_passphrase'
		};
	}

	// Validate encrypted payload structure before attempting decryption
	let payload: Record<string, unknown>;
	try {
		payload = JSON.parse(json);
	} catch (err) {
		warnDev('history-io', 'importPlaintextOrFail', 'Failed to parse encrypted payload', err);
		return { ok: false, error: t('history.corrupted_file'), errorCode: 'corrupted_file' };
	}
	if (!payload.salt || !payload.iv || !payload.data) {
		return { ok: false, error: t('history.corrupted_file'), errorCode: 'corrupted_file' };
	}

	const { decrypt } = await import('./crypto');
	const result = await decrypt(json, passphrase);
	if (result === null) {
		return { ok: false, error: t('history.wrong_passphrase'), errorCode: 'wrong_passphrase' };
	}
	if (!result.integrityOk) {
		return { ok: false, error: t('history.tampered_file'), errorCode: 'integrity_failed' };
	}
	return { ok: true, content: result.plaintext, decrypted: true };
}

export async function validateBmiImport(
	json: string,
	passphrase?: string
): Promise<ValidationResult> {
	const guarded = await importPlaintextOrFail(json, passphrase);
	if (!guarded.ok) {
		return { valid: false, error: guarded.error, errorCode: guarded.errorCode };
	}
	const result = await parseAndValidate(guarded.content);
	return result.validation;
}

// ---------------------------------------------------------------------------
// Import (writes to storage — call only after user confirmation)
// ---------------------------------------------------------------------------

export interface ImportResult {
	success: boolean;
	count: number;
	integrityVerified?: boolean;
	integrityVersion?: number;
	algorithm?: string;
	error?: string;
	/** Structured error code for UI mapping */
	errorCode?: ImportError;
}

/** Lightweight metadata extracted from an import file without full parsing/decryption. */
export interface ImportFileMeta {
	encrypted: boolean;
	format?: string;
	exportedAt?: string;
	recordCount?: number;
	version?: number;
}

/**
 * Peek at import file metadata without decrypting or parsing records.
 * For encrypted files with embedded meta, exportedAt/recordCount/version are available.
 * For encrypted files without meta (legacy), only format and encrypted status are available.
 * For plain files, exportedAt, version, and recordCount are also extracted.
 *
 * Metadata fields are sanitized — values are not trusted blindly.
 */
export function peekImportMeta(json: string): ImportFileMeta {
	try {
		const parsed = JSON.parse(json);

		// Encrypted payload — meta is stored unencrypted for preview
		if (parsed?.format === 'bmi-encrypted-v3' || parsed?.format === 'bmi-encrypted-v1') {
			return {
				encrypted: true,
				format: parsed.format,
				exportedAt:
					typeof parsed.meta?.exportedAt === 'string' ? parsed.meta.exportedAt : undefined,
				recordCount:
					typeof parsed.meta?.recordCount === 'number' && parsed.meta.recordCount >= 0
						? parsed.meta.recordCount
						: undefined,
				version:
					typeof parsed.meta?.version === 'number' && parsed.meta.version >= 0
						? parsed.meta.version
						: undefined
			};
		}

		// Plain envelope
		if (typeof parsed?.version === 'number' && Array.isArray(parsed?.records)) {
			return {
				encrypted: false,
				exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : undefined,
				version: parsed.version >= 0 ? parsed.version : undefined,
				recordCount: parsed.records.length
			};
		}

		// Bare array (legacy)
		if (Array.isArray(parsed)) {
			return {
				encrypted: false,
				recordCount: parsed.length
			};
		}

		return { encrypted: false };
	} catch (err) {
		warnDev('history-io', 'peekImportMeta', 'Failed to peek import metadata', err);
		return { encrypted: false };
	}
}

/**
 * Import BMI history from a JSON string, **replacing** all existing data.
 * The caller is responsible for having already validated and confirmed with the user.
 *
 * If a passphrase is provided and the content is encrypted, it will be decrypted.
 *
 * Performance: JSON is parsed exactly once (shared between validation and extraction).
 */
export async function importBmiHistory(json: string, passphrase?: string): Promise<ImportResult> {
	// ── Pre-parse guards ──
	if (!json || json.trim().length === 0) {
		return { success: false, count: 0, error: t('history.empty_file'), errorCode: 'empty_file' };
	}

	const guarded = await importPlaintextOrFail(json, passphrase);
	if (!guarded.ok) {
		return { success: false, count: 0, error: guarded.error, errorCode: guarded.errorCode };
	}

	// Z3: await the unlock (30 s budget) - the write must never race the purge guard.
	if (guarded.decrypted && passphrase) {
		const { unlockAtRestSessionIfVerified } = await import('./crypto');
		await unlockAtRestSessionIfVerified(passphrase, 30_000);
	}

	const result = await parseAndValidate(guarded.content);

	if (!result.valid) {
		const code = result.validation.errorCode ?? 'invalid_format';
		return { success: false, count: 0, error: result.validation.error, errorCode: code };
	}

	const { records, validation } = result;

	if (records.length === 0) {
		return {
			success: false,
			count: 0,
			error: t('history.no_valid_records'),
			errorCode: 'no_valid_records'
		};
	}

	// Z3: the first passphrase-proven import on a device without a
	// verifier establishes it (crypto.establishLedgerVerifier). Encrypted
	// imports only — a plain import carries no passphrase to prove.
	if (passphrase) {
		const { establishLedgerVerifier } = await import('./crypto');
		await establishLedgerVerifier(passphrase);
	}

	// Sort by timestamp
	records.sort((a, b) => a.timestamp - b.timestamp);

	// Create backup before overwriting existing data (fire-and-forget, don't block)
	try {
		import('./backup')
			.then(({ createBackup }) => {
				void createBackup('before_import');
			})
			.catch((err) => {
				warnDev('history-io', 'importBmiHistory', 'Pre-import backup failed', err);
			});
	} catch (err) {
		warnDev('history-io', 'importBmiHistory', 'Pre-import backup block failed', err);
	}

	// Override (replace) through the single-writer commit (night-frontier-Z5):
	// freshness, the overwrite, and the witness re-anchor hold the ledger
	// lock as one critical section — a concurrent legit save in another tab
	// can never interleave. The commit lives one dynamic import below.
	const { commitImportedRecords } = await import('./bmi-history');
	const ok = await commitImportedRecords(records);
	if (!ok) {
		return { success: false, count: 0, error: t('history.save_failed'), errorCode: 'save_failed' };
	}
	return {
		success: true,
		count: records.length,
		integrityVerified: validation.integrityVerified,
		integrityVersion: validation.integrityVersion,
		algorithm: validation.algorithm
	};
}

// ---------------------------------------------------------------------------
// CSV export moved to history-csv.ts (night-frontier-Z3 domain split).
// ---------------------------------------------------------------------------
