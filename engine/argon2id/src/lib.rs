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
//! |      | the 8-byte minimum, or an oversized request)       |
//! | 3    | the derivation itself failed                       |
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
//! non-extractable CryptoKey and wiped there).

use argon2::{Algorithm, Argon2, AssociatedData, ParamsBuilder, Version};

/// Success.
pub const ERR_OK: u32 = 0;
/// A non-zero length was paired with a null pointer.
pub const ERR_NULL: u32 = 1;
/// Parameters rejected by the Argon2 core.
pub const ERR_PARAMS: u32 = 2;
/// The derivation itself failed.
pub const ERR_DERIVE: u32 = 3;

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
	1
}
