// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The wasm Argon2id engine wrapper (night-enhance-1).
 *
 * Loads the embedded Rust engine (engine/argon2id -> wasm32 + simd128,
 * shipped as base64 in kdf-wasm-embedded.ts) and exposes it behind a
 * noble-shaped derive call so the KDF worker can swap engines without
 * touching the protocol. The module is a dependency leaf: it imports
 * nothing from the app, so the worker bundle stays minimal.
 *
 * Honesty contract, fail-closed in both directions:
 *   - The embedded bytes are digest-verified (SHA-256 via WebCrypto)
 *     before instantiation; a mismatch means the artifact was tampered
 *     with or corrupted, and the engine is refused (the worker falls
 *     back to the pure-JS engine - slower, byte-identical keys).
 *   - Every derivation maps engine error codes onto thrown Errors, so
 *     a hostile or malformed input can never yield a wrong key: it
 *     either throws or produces the same bytes the JS engine would.
 *
 * Byte-identity: the engine implements standard Argon2id (RFC 9106,
 * version 0x13). The known-answer suite pins the RFC section 5.3 tag
 * and a randomized cross-check matrix against @noble/hashes, so keys
 * derived here are bit-for-bit the keys the main-thread fallback
 * derives. The envelope format and the at-rest seal do not change.
 */

import { ARGON2ID_WASM_BASE64, ARGON2ID_WASM_SHA256 } from './kdf-wasm-embedded';

/** Engine error codes, mirrored from engine/argon2id/src/lib.rs. */
const ERR = {
	NULL: 1,
	PARAMS: 2,
	DERIVE: 3,
	KEYSLOT: 4
} as const;

const ERR_MESSAGES: Record<number, string> = {
	[ERR.NULL]: 'engine received a null buffer for a non-empty region',
	[ERR.PARAMS]: 'argon2id parameters rejected (memory/lanes/iterations/output/salt bounds)',
	[ERR.DERIVE]: 'argon2id derivation failed inside the engine',
	[ERR.KEYSLOT]: 'keystore refusal (bad handle, slot not armed, no free slot, or use after wipe)'
};

/** Derive options, mirroring the KDF worker protocol (and noble's opts). */
export interface WasmEngineOptions {
	m: number;
	t: number;
	p: number;
	dkLen: number;
	/** Optional secret (Argon2 "key" input); the app never uses it, the KAT does. */
	key?: Uint8Array;
	/** Optional associated data; the app never uses it, the KAT does. */
	personalization?: Uint8Array;
}

/** The loaded engine: derives through the C ABI over the linear memory. */
export interface Argon2idWasmEngine {
	readonly abiVersion: number;
	derive(password: Uint8Array, salt: Uint8Array, options: WasmEngineOptions): Uint8Array;
	/** Keystore capacity (night-frontier-Z6). */
	keystoreSlots(): number;
	/** Install one 32-byte key; returns the 1-based handle (0 = refusal). The engine volatile-zeroizes the stage region it copies. */
	keystorePut(stage: Uint8Array): number;
	/** HMAC-SHA256 under an armed slot's key; the key never leaves the slot. Throws on refusal. */
	keystoreHmac(handle: number, msg: Uint8Array): Uint8Array;
	/** Volatile-zeroize a slot and disarm it. Throws on an invalid handle. */
	keystoreWipe(handle: number): void;
	/** The provable invariant: the slot self-reports all-zero from inside the sandbox. */
	keystoreIsZeroed(handle: number): boolean;
}

interface EngineExports {
	memory: WebAssembly.Memory;
	engine_abi_version(): number;
	engine_alloc(len: number): number;
	engine_free(ptr: number, len: number): void;
	// The C ABI returns u32; wasm exports surface it as number.
	engine_argon2id(
		passPtr: number,
		passLen: number,
		saltPtr: number,
		saltLen: number,
		secretPtr: number,
		secretLen: number,
		adPtr: number,
		adLen: number,
		mCost: number,
		tCost: number,
		pCost: number,
		outPtr: number,
		outLen: number
	): number;
	engine_keystore_slots(): number;
	engine_keystore_put(stagePtr: number, stageLen: number): number;
	engine_keystore_hmac(
		handle: number,
		msgPtr: number,
		msgLen: number,
		outPtr: number,
		outLen: number
	): number;
	engine_keystore_wipe(handle: number): number;
	engine_keystore_is_zeroed(handle: number): number;
}

let enginePromise: Promise<Argon2idWasmEngine | null> | null = null;

/**
 * Load and verify the embedded engine once per JS realm (the KDF worker).
 * Resolves to null when anything refuses to load or verify - the caller
 * falls back to the pure-JS engine and availability never trumps
 * correctness.
 */
export function loadArgon2idEngine(): Promise<Argon2idWasmEngine | null> {
	if (!enginePromise) {
		enginePromise = instantiateEmbeddedEngine().catch((err: unknown) => {
			console.warn('[kdf-wasm-engine] engine load failed; using the JS engine', err);
			return null;
		});
	}
	return enginePromise;
}

/** Test-only: drop the cached engine promise so a fresh load can run. */
export function _resetArgon2idEngineForTesting(): void {
	enginePromise = null;
}

function base64ToBytes(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * Extract a clean ArrayBuffer from a Uint8Array - the same WebCrypto
 * hygiene as crypto-primitives.ts: a fresh buffer guarantees a valid
 * BufferSource regardless of the backing store.
 */
function toArrayBuffer(src: Uint8Array): ArrayBuffer {
	const ab = new ArrayBuffer(src.length);
	new Uint8Array(ab).set(src);
	return ab;
}

async function digestHex(bytes: Uint8Array): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes));
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

async function instantiateEmbeddedEngine(): Promise<Argon2idWasmEngine | null> {
	const bytes = base64ToBytes(ARGON2ID_WASM_BASE64);

	// Fail-closed artifact gate: the embedded bytes must match the
	// recorded digest before they are ever instantiated.
	const digest = await digestHex(bytes);
	if (digest !== ARGON2ID_WASM_SHA256) {
		console.warn(
			`[kdf-wasm-engine] artifact digest mismatch (${digest} != ${ARGON2ID_WASM_SHA256}); refusing the engine`
		);
		return null;
	}

	const instance = (await WebAssembly.instantiate(toArrayBuffer(bytes), {})).instance;
	const e = instance.exports as unknown as EngineExports;
	if (
		typeof e.engine_argon2id !== 'function' ||
		typeof e.engine_alloc !== 'function' ||
		typeof e.engine_keystore_put !== 'function'
	) {
		console.warn('[kdf-wasm-engine] artifact does not expose the expected ABI; refusing');
		return null;
	}

	function put(view: WebAssembly.Memory, data: Uint8Array): number {
		const ptr = e.engine_alloc(data.length);
		if (!ptr) throw new Error(`engine scratch alloc failed for ${data.length} bytes`);
		new Uint8Array(view.buffer, ptr, data.length).set(data);
		return ptr;
	}

	const engine: Argon2idWasmEngine = {
		abiVersion: e.engine_abi_version(),
		derive(password: Uint8Array, salt: Uint8Array, options: WasmEngineOptions): Uint8Array {
			const { m, t, p, dkLen } = options;
			// Parameter sanity mirrors the engines: fail here with a clear
			// message instead of a bare engine code for the obviously invalid.
			if (!Number.isInteger(m) || !Number.isInteger(t) || !Number.isInteger(p)) {
				throw new Error('argon2id parameters must be integers');
			}
			if (!Number.isInteger(dkLen) || dkLen < 4 || dkLen > 0xffffffff) {
				throw new Error('argon2id output length must be an integer in [4, 2^32-1]');
			}
			if (salt.length < 8) {
				throw new Error('"salt" must be of length 8..4Gb');
			}

			const mem = e.memory;
			// The engine aborts on OOM rather than returning null, but treat
			// both refusals the same: throw and let the worker fall back.
			// An empty passphrase is valid Argon2 input: no region, null ptr.
			const passPtr = password.length > 0 ? put(mem, password) : 0;
			const saltPtr = put(mem, salt);
			const outPtr = e.engine_alloc(dkLen);
			if (!outPtr) throw new Error('engine output alloc failed');
			let secretPtr = 0;
			let adPtr = 0;
			if (options.key && options.key.length > 0) secretPtr = put(mem, options.key);
			if (options.personalization && options.personalization.length > 0) {
				adPtr = put(mem, options.personalization);
			}

			try {
				// memory.buffer can detach on growth during alloc; take fresh
				// views after every allocation, never hold one across calls.
				const rc = e.engine_argon2id(
					passPtr,
					password.length,
					saltPtr,
					salt.length,
					secretPtr,
					options.key ? options.key.length : 0,
					adPtr,
					options.personalization ? options.personalization.length : 0,
					m,
					t,
					p,
					outPtr,
					dkLen
				);
				if (rc !== 0) {
					throw new Error(ERR_MESSAGES[rc] ?? `engine error code ${rc}`);
				}
				// Copy out before freeing: the output region dies with free().
				const out = new Uint8Array(e.memory.buffer, outPtr, dkLen).slice();
				return out;
			} finally {
				// Engine-owned copies die here; the engine zeroized the
				// passphrase and secret regions before returning.
				if (passPtr) e.engine_free(passPtr, password.length);
				if (saltPtr) e.engine_free(saltPtr, salt.length);
				if (outPtr) e.engine_free(outPtr, dkLen);
				if (secretPtr) e.engine_free(secretPtr, options.key!.length);
				if (adPtr) e.engine_free(adPtr, options.personalization!.length);
			}
		},
		// ── The keystore seat (night-frontier-Z6) ──
		keystoreSlots(): number {
			return e.engine_keystore_slots();
		},
		keystorePut(stage: Uint8Array): number {
			if (stage.length !== 32) {
				throw new Error('keystore install requires exactly 32 bytes');
			}
			const mem = e.memory;
			const stagePtr = put(mem, stage);
			try {
				const handle = e.engine_keystore_put(stagePtr, stage.length);
				return handle;
			} finally {
				// The engine volatile-zeroized the linear-memory stage copy
				// before returning; the region dies with the free.
				e.engine_free(stagePtr, stage.length);
			}
		},
		keystoreHmac(handle: number, msg: Uint8Array): Uint8Array {
			const mem = e.memory;
			const msgPtr = msg.length > 0 ? put(mem, msg) : 0;
			const outPtr = e.engine_alloc(32);
			if (!outPtr) throw new Error('keystore output alloc failed');
			try {
				const rc = e.engine_keystore_hmac(handle, msgPtr, msg.length, outPtr, 32);
				if (rc !== 0) {
					throw new Error(ERR_MESSAGES[rc] ?? `engine error code ${rc}`);
				}
				return new Uint8Array(e.memory.buffer, outPtr, 32).slice();
			} finally {
				if (msgPtr) e.engine_free(msgPtr, msg.length);
				e.engine_free(outPtr, 32);
			}
		},
		keystoreWipe(handle: number): void {
			const rc = e.engine_keystore_wipe(handle);
			if (rc !== 0) {
				throw new Error(ERR_MESSAGES[rc] ?? `engine error code ${rc}`);
			}
		},
		keystoreIsZeroed(handle: number): boolean {
			const rc = e.engine_keystore_is_zeroed(handle);
			if (rc === ERR.KEYSLOT) {
				throw new Error(ERR_MESSAGES[rc]);
			}
			return rc === 1;
		}
	};
	return engine;
}
