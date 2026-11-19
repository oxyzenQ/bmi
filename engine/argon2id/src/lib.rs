// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only

//! The bmi-stellar Argon2id key-derivation engine, compiled to WebAssembly.
//!
//! This crate is the Rust seat of the KDF worker (innovation 6): the
//! derivation itself runs here instead of in pure JavaScript, while every
//! surrounding contract stays byte-identical. The engine implements the
//! standard Argon2id (RFC 9106, version 0x13) through the RustCrypto
//! `argon2` crate and is proven byte-equivalent to the `@noble/hashes`
//! implementation by the known-answer and cross-check suites:
//!
//!   - the RFC 9106 section 5.3 Argon2id known-answer vector, and
//!   - a randomized noble cross-check matrix over passphrases, salts,
//!     parameters, and output lengths.
//!
//! Because both engines produce the same key bytes for the same inputs,
//! the envelope format (`bmi-encrypted-v3`), the at-rest seal
//! (`bmi-at-rest-v1:`), and every stored value keep their exact meaning;
//! files written before the swap decrypt unchanged and files written
//! after it stay readable everywhere.
//!
//! # ABI
//!
//! Plain C-ABI exports, no wasm-bindgen runtime: the host (the KDF
//! worker wrapper) copies inputs into the instance linear memory through
//! `engine_alloc` / `engine_free` and reads the output in place.
//!
//! ```text
//! engine_alloc(len)                      -> ptr (0 on refusal)
//! engine_free(ptr, len)                  -> void
//! engine_argon2id(
//!   pass_ptr, pass_len,
//!   salt_ptr, salt_len,
//!   secret_ptr, secret_len,              // secret: len 0 means none
//!   ad_ptr, ad_len,                      // associated data: len 0 means none
//!   m_cost, t_cost, p_cost,              // m_cost in KiB, as the app records it
//!   out_ptr, out_len,                    // caller-allocated output buffer
//! ) -> u32                               // ERR_* code, 0 = success
//! ```
//!
//! Night-frontier-Z6 adds the keystore seat - the engine is no longer
//! only a key forge, it is also key custody. The witness attestation
//! key lives in fixed slots inside the linear memory and NEVER travels
//! back through the ABI as raw bytes: the host installs it once and
//! every later use is an in-engine HMAC-SHA256 over host-provided
//! messages.
//!
//! ```text
//! engine_keystore_slots() -> u32                       // capacity
//! engine_keystore_put(stage_ptr, stage_len) -> handle  // opaque; 0 refusal
//! engine_keystore_hmac(handle, msg_ptr, msg_len, out_ptr, out_len) -> ERR_*
//! engine_keystore_wipe(handle) -> ERR_*                // volatile zeroize
//! engine_keystore_is_zeroed(handle) -> 1 | 0 | ERR_*   // the provable invariant
//! ```
//!
//! Night-frontier-Z8 adds the seal seat - the keystore becomes a
//! two-kind custody: HMAC-SHA256 slots (the witness attestation key,
//! Z6) and AES-256-GCM slots (the at-rest session seal key). The seal
//! key is installed into its own slot and every later use is an
//! in-engine GCM operation: the raw key bytes NEVER travel back through
//! the ABI, and the lock wipe is the same volatile zeroization with the
//! same self-reported all-zero proof. The seat implements the standard
//! GCM construction (RustCrypto `aes-gcm`), so a sealed envelope is
//! byte-identical no matter which side sealed it - the parity battery
//! pins the engine against the WebCrypto fallback over a randomized
//! matrix and both directions of the envelope interop.
//!
//! ```text
//! engine_seal_put(stage_ptr, stage_len) -> handle       // 32-byte AES key; opaque
//! engine_seal_seal(handle, nonce_ptr, nonce_len, aad_ptr, aad_len,
//!                  msg_ptr, msg_len, out_ptr, out_len) -> ERR_*
//!                 // out = ciphertext ++ 16-byte tag (the WebCrypto layout)
//! engine_seal_open(handle, nonce_ptr, nonce_len, aad_ptr, aad_len,
//!                  msg_ptr, msg_len, out_ptr, out_len) -> ERR_*
//!                 // msg = ciphertext ++ tag; out = plaintext on success
//! ```
//!
//! The seat kinds are fail-closed against each other: a GCM slot refuses
//! every `engine_keystore_hmac` call and an HMAC slot refuses every seal
//! call - the witness key can never be used as an AES key and the seal
//! key can never sign. `nonce_len` must be exactly 12 (the GCM standard
//! nonce; the at-rest envelope's IV length). The seal call volatile-
//! zeroizes the plaintext region before returning; the open call
//! volatile-zeroizes the output region before an ERR_AUTH refusal, so a
//! failed open never leaves readable garbage behind.
//!
//! Handles are OPAQUE TOKENS, not slot indices: each carries its slot
//! plus the install generation, so a stale handle from a replaced
//! generation refuses everywhere (a wiped-then-rearmed slot can never
//! be reached by an old closure - the "never signs again" property the
//! witness-key battery pins). 0 means refusal, mirroring `engine_alloc`.
//! `put` accepts exactly 32 bytes (one HMAC-SHA256 key), copies them
//! into the slot, zeroizes the stage region the host handed over, and
//! arms the slot. `wipe` volatile-zeroizes the slot bytes and disarms
//! it; a wiped or never-armed slot refuses every `hmac` call
//! (fail-closed: use after wipe is impossible by ABI contract, not by
//! convention). `is_zeroed` lets the host PROVE the wipe: the slot
//! self-reports all-zero from inside the sandbox where the bytes live -
//! an invariant no dropped-reference JS object can offer. Honest
//! boundary: the linear memory itself stays readable from the host by
//! wasm design (that is how the ABI passes data at all), so custody
//! here means the wrapper code never handles the key and the
//! zeroization is deterministic and provable - not resistance to a
//! host-level reader.
//!
//! All pointers are offsets into the instance linear memory (u32-sized
//! on wasm32); the host passes indices returned by `engine_alloc`.
//!
//! # Error codes
//!
//! | Code | Meaning                                            |
//! |------|----------------------------------------------------|
//! | 0    | success                                            |
//! | 1    | a non-null pointer with a zero length, or null ptr |
//! | 2    | parameters rejected (m below the 8*p floor, t or p |
//! |      | zero, output below the 4-byte minimum, salt below  |
//! |      | the 8-byte minimum, an oversized request, or a     |
//! |      | keystore length that is not exactly 32 bytes)      |
//! | 3    | the derivation itself failed                       |
//! | 4    | keystore refusal (bad handle, slot not armed, no   |
//! |      | free slot, or a use-after-wipe attempt)            |
//! | 5    | the GCM authentication failed (wrong key or a      |
//! |      | tampered ciphertext; the output region is zeroed)  |
//!
//! Any panic would abort the instance (`panic = "abort"`); the wrapper
//! treats a trap like any other engine failure and falls back to the
//! JavaScript engine, so a hostile input can never produce a wrong key —
//! it can only lose the speedup.
//!
//! # Hygiene
//!
//! The passphrase and secret regions are zeroized inside the engine
//! before returning: the linear-memory copies of the raw inputs do not
//! outlive the call. The caller wipes its own copies; the derived key
//! bytes are the caller's responsibility (imported into a
//! non-extractable CryptoKey and wiped there). The keystore slot is
//! volatile-zeroized by `engine_keystore_wipe` and self-reports its
//! zero state; the stage region handed to `engine_keystore_put` is
//! zeroized before the call returns. The seal seat (Z8) adds two more:
//! the plaintext region handed to `engine_seal_seal` is zeroized before
//! the call returns, and the output region handed to `engine_seal_open`
//! is zeroized before an auth-failure refusal - a failed open never
//! leaves readable garbage behind.

use aes_gcm::aead::AeadInPlace;
use aes_gcm::{Aes256Gcm, Nonce, Tag};
use argon2::{Algorithm, Argon2, AssociatedData, ParamsBuilder, Version};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::cell::Cell;
use std::sync::atomic::{AtomicU32, AtomicU8, Ordering};

/// Success.
pub const ERR_OK: u32 = 0;
/// A non-zero length was paired with a null pointer.
pub const ERR_NULL: u32 = 1;
/// Parameters rejected by the Argon2 core.
pub const ERR_PARAMS: u32 = 2;
/// The derivation itself failed.
pub const ERR_DERIVE: u32 = 3;
/// Keystore refusal: bad handle, slot not armed, no free slot, or use
/// after wipe.
pub const ERR_KEYSLOT: u32 = 4;
/// The GCM authentication failed (wrong key or tampered ciphertext).
pub const ERR_AUTH: u32 = 5;

/// Allocate `len` bytes of scratch space in the linear memory.
///
/// Returns 0 (a null offset) when `len` is zero; the host treats that as
/// "no buffer" and passes 0 pointers for optional inputs. Allocation
/// failures abort the instance (the default allocator behavior), which
/// the wrapper catches and falls back from.
#[no_mangle]
pub extern "C" fn engine_alloc(len: usize) -> *mut u8 {
	if len == 0 {
		return std::ptr::null_mut();
	}
	let mut buf = Vec::<u8>::with_capacity(len);
	let ptr = buf.as_mut_ptr();
	core::mem::forget(buf);
	ptr
}

/// Free a region returned by `engine_alloc`.
///
/// # Safety
///
/// `ptr` must be an offset returned by `engine_alloc(len)` with the same
/// `len`, not previously freed, and not aliased by live engine state.
#[no_mangle]
pub unsafe extern "C" fn engine_free(ptr: *mut u8, len: usize) {
	if ptr.is_null() || len == 0 {
		return;
	}
	drop(Vec::from_raw_parts(ptr, 0, len));
}

/// Slice a raw pointer/length pair into a byte slice.
///
/// # Safety
///
/// `ptr` must be valid for `len` bytes of initialized data in the
/// instance linear memory (an `engine_alloc` region the host filled, or
/// a region the host intends to write into for the output).
unsafe fn raw_slice<'a>(ptr: *const u8, len: usize) -> Result<&'a [u8], u32> {
	if len == 0 {
		if ptr.is_null() {
			Ok(&[])
		} else {
			Err(ERR_NULL)
		}
	} else if ptr.is_null() {
		Err(ERR_NULL)
	} else {
		Ok(core::slice::from_raw_parts(ptr, len))
	}
}

/// Mutable variant of `raw_slice` for the caller-allocated output.
///
/// # Safety
///
/// Same contract as `raw_slice`, plus the region must not alias any
/// input region and must stay writable for the call duration.
unsafe fn raw_slice_mut<'a>(ptr: *mut u8, len: usize) -> Result<&'a mut [u8], u32> {
	if len == 0 {
		if ptr.is_null() {
			Err(ERR_PARAMS)
		} else {
			Err(ERR_NULL)
		}
	} else if ptr.is_null() {
		Err(ERR_NULL)
	} else {
		Ok(core::slice::from_raw_parts_mut(ptr, len))
	}
}

/// Zeroize the linear-memory copy of a raw input after the call.
///
/// # Safety
///
/// `ptr` must be valid for `len` bytes (an input region handed to
/// `engine_argon2id`).
unsafe fn zeroize_raw(ptr: *const u8, len: usize) {
	if !ptr.is_null() && len > 0 {
		let mut p = ptr as *mut u8;
		for _ in 0..len {
			core::ptr::write_volatile(p, 0u8);
			p = p.add(1);
		}
	}
}

/// Derive a key with Argon2id (RFC 9106, version 0x13).
///
/// # Safety
///
/// Every pointer must be a valid offset in the instance linear memory
/// with at least its length bytes usable: inputs readable, `out_ptr`
/// writable for `out_len` bytes. Regions must not overlap.
#[no_mangle]
pub unsafe extern "C" fn engine_argon2id(
	pass_ptr: *const u8,
	pass_len: usize,
	salt_ptr: *const u8,
	salt_len: usize,
	secret_ptr: *const u8,
	secret_len: usize,
	ad_ptr: *const u8,
	ad_len: usize,
	m_cost: u32,
	t_cost: u32,
	p_cost: u32,
	out_ptr: *mut u8,
	out_len: usize,
) -> u32 {
	let pass = match raw_slice(pass_ptr, pass_len) {
		Ok(v) => v,
		Err(e) => return e,
	};
	let salt = match raw_slice(salt_ptr, salt_len) {
		Ok(v) => v,
		Err(e) => return e,
	};
	let secret = match raw_slice(secret_ptr, secret_len) {
		Ok(v) => v,
		Err(e) => return e,
	};
	let ad = match raw_slice(ad_ptr, ad_len) {
		Ok(v) => v,
		Err(e) => return e,
	};
	let out = match raw_slice_mut(out_ptr, out_len) {
		Ok(v) => v,
		Err(e) => return e,
	};

	let params = {
		let mut builder = ParamsBuilder::new();
		builder
			.m_cost(m_cost)
			.t_cost(t_cost)
			.p_cost(p_cost)
			.output_len(out.len());
		if !ad.is_empty() {
			match AssociatedData::new(ad) {
				Ok(data) => {
					builder.data(data);
				}
				Err(_) => return ERR_PARAMS,
			}
		}
		match builder.build() {
			Ok(p) => p,
			Err(_) => return ERR_PARAMS,
		}
	};
	// The RustCrypto core enforces the RFC salt floor (8 bytes) and the
	// lane/memory floors through the params builder; anything it rejects
	// maps to ERR_PARAMS, anything that fails mid-derivation maps to
	// ERR_DERIVE.
	let engine = match Argon2::new_with_secret(secret, Algorithm::Argon2id, Version::V0x13, params)
	{
		Ok(e) => e,
		Err(_) => return ERR_PARAMS,
	};
	match engine.hash_password_into(pass, salt, out) {
		Ok(()) => {}
		Err(_) => return ERR_DERIVE,
	}

	// The raw input copies do not outlive the call.
	zeroize_raw(pass_ptr, pass_len);
	zeroize_raw(secret_ptr, secret_len);

	ERR_OK
}

/// Engine identity for honest diagnostics: returns the engine abi
/// version so the wrapper can assert it speaks the same protocol before
/// the first derivation.
#[no_mangle]
pub extern "C" fn engine_abi_version() -> u32 {
	2
}

// ── The keystore seat (night-frontier-Z6) ──
// Key custody inside the engine's linear memory. Slots are fixed-size
// static variables; the only door is the ABI below. The wasm32-unknown-unknown
// target is single-threaded by definition (no atomics, no threads), so
// a Cell-backed slot with a target-scoped Sync promise is sound here:
// there is no second thread to race, and the artifact is never built
// with wasm threads enabled.

/// One 32-byte key per slot (the witness attestation key length and the
/// AES-256 seal key length - both custody seats use the same width).
const SLOT_KEY_LEN: usize = 32;
/// Fixed capacity: eight concurrent custody slots is generous for a
/// single-ledger app and keeps the surface auditable.
const SLOT_COUNT: usize = 8;
/// Slot state: 0 free, 1 armed, 2 wiped (a wiped slot refuses use).
const SLOT_FREE: u8 = 0;
const SLOT_ARMED: u8 = 1;
const SLOT_WIPED: u8 = 2;
/// Slot kind (night-frontier-Z8): what an armed slot holds. The kinds
/// are fail-closed against each other - an HMAC slot refuses every seal
/// call, a GCM slot refuses every hmac call, so the witness key can
/// never be used as an AES key and the seal key can never sign.
const SLOT_KIND_NONE: u8 = 0;
const SLOT_KIND_HMAC: u8 = 1;
const SLOT_KIND_GCM: u8 = 2;

/// A key slot: interior mutability over a fixed byte array.
struct KeySlot(Cell<[u8; SLOT_KEY_LEN]>);
// SAFETY: the wasm32-unknown-unknown target is single-threaded by
// definition - the crate is never built with threads or atomics, so no
// concurrent access to a slot can exist inside the instance.
unsafe impl Sync for KeySlot {}

static KEYSTORE_KEYS: [KeySlot; SLOT_COUNT] =
	[const { KeySlot(Cell::new([0u8; SLOT_KEY_LEN])) }; SLOT_COUNT];
static KEYSTORE_STATE: [AtomicU8; SLOT_COUNT] = [const { AtomicU8::new(SLOT_FREE) }; SLOT_COUNT];
/// What each slot last held (kind is armed-scoped: it only matters while
/// SLOT_ARMED, and it rides the generation so a replaced installation
/// cannot be reached by a stale closure anyway).
static KEYSTORE_KIND: [AtomicU8; SLOT_COUNT] =
	[const { AtomicU8::new(SLOT_KIND_NONE) }; SLOT_COUNT];
/// The install generation each slot last armed under. Handles carry the
/// generation, so a handle from a replaced installation is refused even
/// though the slot index itself was reused.
static KEYSTORE_GEN: [AtomicU32; SLOT_COUNT] = [const { AtomicU32::new(0) }; SLOT_COUNT];
/// The global generation counter: every install mints a fresh handle.
static NEXT_GEN: AtomicU32 = AtomicU32::new(0);

/// The low 4 bits hold the slot index + 1 (SLOT_COUNT is 8); the rest
/// is the generation.
const HANDLE_SLOT_MASK: u32 = 0xf;

/// Decode an opaque handle into its slot and expected generation.
/// Returns none for a zero handle, a slot past capacity, or a slot
/// whose recorded generation does not match the handle's.
fn decode_handle(handle: u32) -> Option<usize> {
	if handle == 0 {
		return None;
	}
	let idx = (handle & HANDLE_SLOT_MASK) as usize - 1;
	if idx >= SLOT_COUNT {
		return None;
	}
	let gen = handle >> 4;
	if KEYSTORE_GEN[idx].load(Ordering::Relaxed) != gen {
		return None;
	}
	Some(idx)
}

/// Volatile-zeroize a slot: the same discipline as `zeroize_raw`, over
/// a slot the engine owns. The write goes through `write_volatile`, so
/// the compiler may not elide it - the zeroing is deterministic, which
/// is what makes the invariant provable rather than conventional.
fn zeroize_slot(idx: usize) {
	let slot = &KEYSTORE_KEYS[idx].0;
	// SAFETY: a shared reference into a static slot, mutated through a
	// volatile pointer write - sound on the single-threaded target and
	// required for the elision-proof zeroing.
	let ptr = slot.as_ptr() as *mut u8;
	for i in 0..SLOT_KEY_LEN {
		// SAFETY: in-bounds by construction (i < SLOT_KEY_LEN).
		unsafe {
			core::ptr::write_volatile(ptr.add(i), 0u8);
		}
	}
}

/// Total keystore capacity, so the wrapper can assert the protocol
/// before the first install.
#[no_mangle]
pub extern "C" fn engine_keystore_slots() -> u32 {
	SLOT_COUNT as u32
}

/// Install one 32-byte key into a free slot and zero the stage region.
///
/// Returns the 1-based handle, or 0 on every refusal (the handle-space
/// contract: "0 means refusal, mirroring `engine_alloc"`). A refusal
/// must never collide with a valid handle shape - error codes 1..5 all
/// share the low nibble with gen-0 handles, so the refusal values cannot
/// leak into the handle space. The stage region the host handed over is
/// volatile-zeroized before this call returns, so the JS-side copy of
/// the material dies here inside the sandbox.
///
/// # Safety
///
/// `stage_ptr` must be valid for `stage_len` bytes of initialized data.
#[no_mangle]
pub unsafe extern "C" fn engine_keystore_put(stage_ptr: *const u8, stage_len: usize) -> u32 {
	if stage_len != SLOT_KEY_LEN {
		return 0;
	}
	let stage = match raw_slice(stage_ptr, stage_len) {
		Ok(v) => v,
		Err(_) => return 0,
	};
	let idx =
		match (0..SLOT_COUNT).find(|&i| KEYSTORE_STATE[i].load(Ordering::Relaxed) != SLOT_ARMED) {
			Some(i) => i,
			None => return 0,
		};
	let mut key = [0u8; SLOT_KEY_LEN];
	key.copy_from_slice(stage);
	KEYSTORE_KEYS[idx].0.set(key);
	KEYSTORE_STATE[idx].store(SLOT_ARMED, Ordering::Relaxed);
	KEYSTORE_KIND[idx].store(SLOT_KIND_HMAC, Ordering::Relaxed);
	// Mint a fresh opaque handle: slot + generation. Any stale handle
	// for this slot (from a replaced installation) refuses everywhere.
	let gen = NEXT_GEN.fetch_add(1, Ordering::Relaxed);
	KEYSTORE_GEN[idx].store(gen, Ordering::Relaxed);
	// The stage copy does not outlive the call.
	zeroize_raw(stage_ptr, stage_len);
	(gen << 4) | (idx as u32 + 1)
}

/// HMAC-SHA256 under an armed slot's key. The key bytes never leave the
/// slot; the message comes in through the ABI, the 32-byte tag goes out.
///
/// # Safety
///
/// `msg_ptr` readable for `msg_len` bytes; `out_ptr` writable for
/// `out_len` bytes; regions must not overlap.
#[no_mangle]
pub unsafe extern "C" fn engine_keystore_hmac(
	handle: u32,
	msg_ptr: *const u8,
	msg_len: usize,
	out_ptr: *mut u8,
	out_len: usize,
) -> u32 {
	let Some(idx) = decode_handle(handle) else {
		return ERR_KEYSLOT;
	};
	if KEYSTORE_STATE[idx].load(Ordering::Relaxed) != SLOT_ARMED {
		// Use after wipe (or before install) is a refusal, not a zero-key
		// computation: a wiped slot can never sign anything.
		return ERR_KEYSLOT;
	}
	if KEYSTORE_KIND[idx].load(Ordering::Relaxed) != SLOT_KIND_HMAC {
		// Kind cross-use is a refusal: a GCM (seal) slot can never sign.
		return ERR_KEYSLOT;
	}
	let msg = match raw_slice(msg_ptr, msg_len) {
		Ok(v) => v,
		Err(e) => return e,
	};
	let out = match raw_slice_mut(out_ptr, out_len) {
		Ok(v) => v,
		Err(e) => return e,
	};
	if out.len() != SLOT_KEY_LEN {
		return ERR_PARAMS;
	}
	let mut mac = match Hmac::<Sha256>::new_from_slice(&KEYSTORE_KEYS[idx].0.get()) {
		Ok(m) => m,
		Err(_) => return ERR_KEYSLOT,
	};
	mac.update(msg);
	let tag = mac.finalize().into_bytes();
	out.copy_from_slice(&tag);
	ERR_OK
}

/// Wipe a slot: volatile-zeroize the key bytes and disarm the slot.
/// The operation is idempotent over valid handles; an invalid handle
/// refuses.
///
/// # Safety
///
/// This function dereferences no host pointers - the unsafe surface is
/// the ABI itself (the host must hold a valid handle).
#[no_mangle]
pub unsafe extern "C" fn engine_keystore_wipe(handle: u32) -> u32 {
	let Some(idx) = decode_handle(handle) else {
		return ERR_KEYSLOT;
	};
	zeroize_slot(idx);
	KEYSTORE_STATE[idx].store(SLOT_WIPED, Ordering::Relaxed);
	ERR_OK
}

/// The provable invariant: 1 when the slot's bytes are all zero, 0 when
/// any byte differs, `ERR_KEYSLOT` for an invalid handle. The self-report
/// runs inside the sandbox where the bytes live - the host can pin this
/// across a put/wipe cycle and hold the artifact to it.
///
/// # Safety
///
/// This function dereferences no host pointers - the unsafe surface is
/// the ABI itself (the host must hold a valid handle).
#[no_mangle]
pub unsafe extern "C" fn engine_keystore_is_zeroed(handle: u32) -> u32 {
	let Some(idx) = decode_handle(handle) else {
		return ERR_KEYSLOT;
	};
	let key = KEYSTORE_KEYS[idx].0.get();
	if key.iter().all(|&b| b == 0) {
		1
	} else {
		0
	}
}

// ── The seal seat (night-frontier-Z8) ──
// AES-256-GCM custody for the at-rest session seal key. The construction
// is the standard GCM (RustCrypto `aes-gcm`), so the output layout is the
// WebCrypto layout - ciphertext followed by the 16-byte tag - and the
// envelope the at-rest seal writes does not change with the engine.
// Refusals follow the keystore discipline: wrong kind, wiped, or unknown
// handle never produces bytes, they produce an error code.

/// Install one 32-byte AES-256-GCM key into a free slot and zero the
/// stage region. Returns the 1-based opaque handle (the same handle
/// space as the HMAC keystore: `engine_keystore_wipe` and
/// `engine_keystore_is_zeroed` operate on both kinds), or 0 on every
/// refusal (the same no-collision contract as `engine_keystore_put`).
///
/// # Safety
///
/// `stage_ptr` must be valid for `stage_len` bytes of initialized data.
#[no_mangle]
pub unsafe extern "C" fn engine_seal_put(stage_ptr: *const u8, stage_len: usize) -> u32 {
	if stage_len != SLOT_KEY_LEN {
		return 0;
	}
	let stage = match raw_slice(stage_ptr, stage_len) {
		Ok(v) => v,
		Err(_) => return 0,
	};
	let idx =
		match (0..SLOT_COUNT).find(|&i| KEYSTORE_STATE[i].load(Ordering::Relaxed) != SLOT_ARMED) {
			Some(i) => i,
			None => return 0,
		};
	let mut key = [0u8; SLOT_KEY_LEN];
	key.copy_from_slice(stage);
	KEYSTORE_KEYS[idx].0.set(key);
	KEYSTORE_STATE[idx].store(SLOT_ARMED, Ordering::Relaxed);
	KEYSTORE_KIND[idx].store(SLOT_KIND_GCM, Ordering::Relaxed);
	let gen = NEXT_GEN.fetch_add(1, Ordering::Relaxed);
	KEYSTORE_GEN[idx].store(gen, Ordering::Relaxed);
	// The stage copy does not outlive the call.
	zeroize_raw(stage_ptr, stage_len);
	(gen << 4) | (idx as u32 + 1)
}

/// Resolve an armed GCM slot for the seal operations: the shared
/// handle/state checks plus the kind gate (an HMAC slot refuses).
fn seal_slot(handle: u32) -> Result<usize, u32> {
	let Some(idx) = decode_handle(handle) else {
		return Err(ERR_KEYSLOT);
	};
	if KEYSTORE_STATE[idx].load(Ordering::Relaxed) != SLOT_ARMED {
		// Use after wipe (or before install): a wiped slot can never seal.
		return Err(ERR_KEYSLOT);
	}
	if KEYSTORE_KIND[idx].load(Ordering::Relaxed) != SLOT_KIND_GCM {
		// Kind cross-use is a refusal: an HMAC slot can never seal.
		return Err(ERR_KEYSLOT);
	}
	Ok(idx)
}

/// Arm the GCM cipher over an armed GCM slot. The `KeyInit` import is
/// function-local on purpose: at module scope it would make the HMAC
/// seat's `new_from_slice` ambiguous between the `KeyInit` and `Mac`
/// traits (both exist in the digest/aead pair).
fn arm_cipher(idx: usize) -> Result<Aes256Gcm, u32> {
	use aes_gcm::aead::KeyInit;
	Aes256Gcm::new_from_slice(&KEYSTORE_KEYS[idx].0.get()).map_err(|_| ERR_KEYSLOT)
}

/// AES-256-GCM seal under an armed GCM slot: `out` receives the
/// ciphertext followed by the 16-byte tag (the WebCrypto layout), so
/// `out_len` must equal `msg_len + 16`. The nonce must be exactly 12
/// bytes. The plaintext region the host handed over is volatile-zeroized
/// before this call returns - the linear-memory copy of the plaintext
/// does not outlive the call.
///
/// # Safety
///
/// `nonce_ptr` readable for `nonce_len` bytes, `aad_ptr` for `aad_len`,
/// `msg_ptr` for `msg_len`; `out_ptr` writable for `out_len` bytes.
/// Regions must not overlap.
#[no_mangle]
pub unsafe extern "C" fn engine_seal_seal(
	handle: u32,
	nonce_ptr: *const u8,
	nonce_len: usize,
	aad_ptr: *const u8,
	aad_len: usize,
	msg_ptr: *const u8,
	msg_len: usize,
	out_ptr: *mut u8,
	out_len: usize,
) -> u32 {
	let idx = match seal_slot(handle) {
		Ok(i) => i,
		Err(e) => return e,
	};
	let nonce = match raw_slice(nonce_ptr, nonce_len) {
		Ok(v) => v,
		Err(e) => return e,
	};
	if nonce.len() != 12 {
		return ERR_PARAMS;
	}
	let aad = match raw_slice(aad_ptr, aad_len) {
		Ok(v) => v,
		Err(e) => return e,
	};
	let msg = match raw_slice(msg_ptr, msg_len) {
		Ok(v) => v,
		Err(e) => return e,
	};
	let out = match raw_slice_mut(out_ptr, out_len) {
		Ok(v) => v,
		Err(e) => return e,
	};
	if out.len() != msg.len() + 16 {
		return ERR_PARAMS;
	}
	let cipher = match arm_cipher(idx) {
		Ok(c) => c,
		Err(e) => return e,
	};
	out[..msg.len()].copy_from_slice(msg);
	match cipher.encrypt_in_place_detached(Nonce::from_slice(nonce), aad, &mut out[..msg.len()]) {
		Ok(tag) => out[msg.len()..].copy_from_slice(&tag),
		Err(_) => return ERR_DERIVE,
	}
	// The plaintext copy does not outlive the call.
	zeroize_raw(msg_ptr, msg_len);
	ERR_OK
}

/// AES-256-GCM open under an armed GCM slot: `msg` carries the
/// ciphertext followed by the 16-byte tag, `out` receives the plaintext
/// (`out_len` must equal `msg_len - 16`). An authentication failure
/// volatile-zeroizes the output region and refuses with `ERR_AUTH` - a
/// failed open never leaves readable garbage behind. On success the
/// ciphertext region the host handed over is volatile-zeroized.
///
/// # Safety
///
/// `nonce_ptr` readable for `nonce_len` bytes, `aad_ptr` for `aad_len`,
/// `msg_ptr` for `msg_len`; `out_ptr` writable for `out_len` bytes.
/// Regions must not overlap.
#[no_mangle]
pub unsafe extern "C" fn engine_seal_open(
	handle: u32,
	nonce_ptr: *const u8,
	nonce_len: usize,
	aad_ptr: *const u8,
	aad_len: usize,
	msg_ptr: *const u8,
	msg_len: usize,
	out_ptr: *mut u8,
	out_len: usize,
) -> u32 {
	let idx = match seal_slot(handle) {
		Ok(i) => i,
		Err(e) => return e,
	};
	let nonce = match raw_slice(nonce_ptr, nonce_len) {
		Ok(v) => v,
		Err(e) => return e,
	};
	if nonce.len() != 12 {
		return ERR_PARAMS;
	}
	let aad = match raw_slice(aad_ptr, aad_len) {
		Ok(v) => v,
		Err(e) => return e,
	};
	let msg = match raw_slice(msg_ptr, msg_len) {
		Ok(v) => v,
		Err(e) => return e,
	};
	let out = match raw_slice_mut(out_ptr, out_len) {
		Ok(v) => v,
		Err(e) => return e,
	};
	if msg.len() < 16 || out.len() != msg.len() - 16 {
		return ERR_PARAMS;
	}
	let cipher = match arm_cipher(idx) {
		Ok(c) => c,
		Err(e) => return e,
	};
	let (ct, tag) = msg.split_at(msg.len() - 16);
	out[..ct.len()].copy_from_slice(ct);
	match cipher.decrypt_in_place_detached(
		Nonce::from_slice(nonce),
		aad,
		&mut out[..ct.len()],
		Tag::from_slice(tag),
	) {
		Ok(()) => {}
		Err(_) => {
			// The failed open leaves no readable garbage: the output
			// region is volatile-zeroized before the refusal.
			zeroize_raw(out_ptr, out_len);
			return ERR_AUTH;
		}
	}
	// The ciphertext copy does not outlive the call.
	zeroize_raw(msg_ptr, msg_len);
	ERR_OK
}
