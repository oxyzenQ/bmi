#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
# SPDX-License-Identifier: AGPL-3.0-only OR Commercial

"""Provenance word generator for the depth-matrix signature (night-signature-advanced-2).

Why this exists: the ownership claim must NOT exist as plaintext in the
compiled artifact, because a thief can run strings(1), rg, or a custom
scanner over the artifact, find the wording, and patch it out. This tool
converts the two provenance truths (the Signature manifest and the
Copyright authors string) into XOR-masked 64-bit words. The masks come
from a splitmix64 stream keyed by per-layer seeds, so the constants in
src/lib/utils/signature.ts look like opaque checksum material ("nobody
knows what this is") and no contiguous ASCII fragment of the identity
survives into the bundle. At runtime the module unmasks the words and
materializes the plaintext on the -V/--version surface (and the About
Depth-matrix row) only.

This file is the committed truth source for those constants: the
identity appears here ONCE by design, exactly the way TRADEMARK.md
carries it as the legal layer (the same law as the cosmostrix
generator). Rotating the identity (or the seeds) is one edit plus one
paste of the emitted TypeScript block.

The masking/unmasking algorithm is mirrored byte-exactly in
src/lib/utils/signature.ts (sigSplitmix64Mix + maskFor). If you change
one side, change both, and re-run this tool. The emitted block is
self-checked below: it unmasks its own words, asserts the round-trip
equals the input, asserts the strings(1)-invisibility floor, and
cross-checks the BLAKE3 digests against the canonical CLI (b3sum) - so
a paste mistake or an algorithm drift fails here before it can ship.

D3 (night-netrunner-Z1): masking hides the claim and BLAKE3 proves the
bytes did not change, but neither proves WHO wrote them - a thief can
re-run this very tool on a stolen identity and mint a self-consistent
matrix. D3 closes that hole with an Ed25519 signature over the framed
clear bytes. The private seed never enters the repository: the owner
keeps it offline and signs with --signing-key, or with any Ed25519
tool over the bytes written by --payload-out (the result goes back in
through --signature-in). The module carries the public key and the
signature; everything else only verifies.

Usage:
    python3 scripts/release/generate-provenance-words.py
        Emit the TypeScript block for the current truths. The D3 pair is
        carried over from the committed module while it still verifies;
        otherwise the signature is emitted empty (status=unsigned).
    python3 scripts/release/generate-provenance-words.py --signing-key KEY.pem
        Emit the block with a fresh D3 signature (identity or key rotation).
    python3 scripts/release/generate-provenance-words.py --payload-out FILE
        Also write the framed D3 bytes, for signing with another tool.
    python3 scripts/release/generate-provenance-words.py --signature-in FILE
        Emit the block with a signature made elsewhere (64 raw bytes or
        128 hex characters); it must verify under the gate's pinned key.
    python3 scripts/release/generate-provenance-words.py --check
        Verify the committed tree: the module constants equal this
        tool's output, the digests match b3sum, the module key equals
        the pin in scripts/gates/check-signature.ts, and the signature
        passes the RFC 8032 reference verifier below (stdlib only, runs
        in CI). Exit non-zero on any drift.

Tool: b3sum (the BLAKE3 team's canonical CLI) for the D2 digest
oracles. A missing tool fails an emit run loudly; --check reports the
skip and leaves the digests to the TypeScript gate.
"""

import argparse
import base64
import hashlib
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "src" / "lib" / "utils" / "signature.ts"
GATE_PATH = ROOT / "scripts" / "gates" / "check-signature.ts"

# The provenance truths. Byte-level truth: UTF-8 (the em dash is three
# bytes, E2 80 94, and every layer below operates on bytes, not chars).
#
# night-remake-1 (the contact rekey, byte-aligned with the zejtron
# estate): the authors claim drops the trailing year and carries the
# proton contact in the Cargo authors shape - identity, then the
# address in angle brackets. The manifest keeps its year suffix: the
# D0 display strips it through the identity-core contract, and the
# binding (authors starts with the core) holds with the contact riding
# after it. The sig surfaces render the identity and the contact as
# separate facts; nothing else moves.
MANIFEST = "BMI Stellar — Official Build by rezky_nightky (oxyzenQ) 2026"
AUTHORS = "rezky_nightky (oxyzenQ) <oxyzenQ@proton.me>"

# Per-layer seeds. Decoys with no external meaning; rotating them is a
# supported operation (re-run this tool, paste the new block). Both must
# differ so the two layers never produce identical constants. Kept in
# lockstep with the cosmostrix generator (same tool lineage).
SEED_MANIFEST = 0x9D3A_7C1E_44B2_6F08
SEED_AUTHORS = 0x1F4E_6B8A_C27D_53A1

MASK64 = (1 << 64) - 1
GOLDEN = 0x9E3779B97F4A7C15

# D3: the signed domain separates this payload from every other Ed25519
# message. The trusted key lives in ONE place outside the module - the
# EXPECTED_OWNER_PUBLIC_KEY pin in scripts/gates/check-signature.ts.
D3_DOMAIN = "bmi-stellar/depth-matrix/v1"


def splitmix64_mix(z: int) -> int:
    """Byte-exact mirror of signature.ts sigSplitmix64Mix."""
    a = (z + GOLDEN) & MASK64
    b = ((a ^ (a >> 30)) * 0xBF58476D1CE4E5B9) & MASK64
    c = ((b ^ (b >> 27)) * 0x94D049BB133111EB) & MASK64
    return (c ^ (c >> 31)) & MASK64


def mask_for(seed: int, index: int) -> int:
    """Mask stream for word `index`: mix(seed + (index+1) * GOLDEN)."""
    return splitmix64_mix((seed + (index + 1) * GOLDEN) & MASK64)


def chunk_words(data: bytes) -> list:
    """Split bytes into little-endian u64 words, zero-padded."""
    words = []
    for i in range(0, len(data), 8):
        words.append(int.from_bytes(data[i : i + 8], "little"))
    return words


def mask_words(words: list, seed: int) -> list:
    return [w ^ mask_for(seed, i) for i, w in enumerate(words)]


def unmask_words(words: list, seed: int, byte_len: int) -> bytes:
    out = bytearray()
    for i, w in enumerate(words):
        out += ((w ^ mask_for(seed, i)) & MASK64).to_bytes(8, "little")
    return bytes(out[:byte_len])


def longest_ascii_run(words: list) -> int:
    """Longest run of printable ASCII bytes across all masked words.

    The at-rest invisibility contract: strings(1) reports runs of four
    or more printable bytes. The emitted constants must stay below that
    floor everywhere, or the identity becomes greppable again.
    """
    longest = 0
    run = 0
    for w in words:
        for byte in (w & MASK64).to_bytes(8, "little"):
            if 0x20 <= byte <= 0x7E:
                run += 1
                longest = max(longest, run)
            else:
                run = 0
    return longest


def find_b3sum():
    tool = shutil.which("b3sum") or (Path.home() / ".local" / "bin" / "b3sum")
    return str(tool) if tool and Path(tool).exists() else None


def b3sum_hex(data: bytes, tool: str) -> str:
    """BLAKE3-256 through the canonical CLI, hex-encoded."""
    proc = subprocess.run([tool], input=data, capture_output=True, check=True)
    return proc.stdout.decode().split()[0]


def signable_payload(manifest_bytes: bytes, authors_bytes: bytes) -> bytes:
    """The D3 message: u32le length + bytes, for the domain and each layer.

    Mirrored byte-exactly by signature.ts signablePayload. Every part is
    length-prefixed, so no boundary can be read two ways.
    """

    def frame(part: bytes) -> bytes:
        return len(part).to_bytes(4, "little") + part

    return frame(D3_DOMAIN.encode("ascii")) + frame(manifest_bytes) + frame(authors_bytes)


# --- Ed25519 (RFC 8032 reference arithmetic, slow bigint form) ---------
#
# The independent D3 oracle. Deliberately naive: the standard's own
# formulas over Python integers, no library, nothing clever to get
# wrong. Too slow for bulk work and exactly right for verifying ONE
# signature per run, in a different language than the bundled verifier.

ED_P = 2**255 - 19
ED_L = 2**252 + 27742317777372353535851937790883648493
ED_D = (-121665 * pow(121666, ED_P - 2, ED_P)) % ED_P
ED_I = pow(2, (ED_P - 1) // 4, ED_P)


def ed_xrecover(y: int) -> int:
    xx = (y * y - 1) * pow(ED_D * y * y + 1, ED_P - 2, ED_P)
    x = pow(xx, (ED_P + 3) // 8, ED_P)
    if (x * x - xx) % ED_P != 0:
        x = (x * ED_I) % ED_P
    if x % 2 != 0:
        x = ED_P - x
    return x


ED_BY = 4 * pow(5, ED_P - 2, ED_P)
ED_B = [ed_xrecover(ED_BY) % ED_P, ED_BY % ED_P]


def ed_add(p: list, q: list) -> list:
    x1, y1 = p
    x2, y2 = q
    x3 = (x1 * y2 + x2 * y1) * pow(1 + ED_D * x1 * x2 * y1 * y2, ED_P - 2, ED_P)
    y3 = (y1 * y2 + x1 * x2) * pow(1 - ED_D * x1 * x2 * y1 * y2, ED_P - 2, ED_P)
    return [x3 % ED_P, y3 % ED_P]


def ed_mul(point: list, scalar: int) -> list:
    result = [0, 1]
    addend = list(point)
    while scalar > 0:
        if scalar & 1:
            result = ed_add(result, addend)
        addend = ed_add(addend, addend)
        scalar >>= 1
    return result


def ed_encode(point: list) -> bytes:
    x, y = point
    return (y | ((x & 1) << 255)).to_bytes(32, "little")


def ed_decode(raw: bytes) -> list:
    value = int.from_bytes(raw, "little")
    y = value & ((1 << 255) - 1)
    x = ed_xrecover(y)
    if x & 1 != (value >> 255) & 1:
        x = ED_P - x
    if (-x * x + y * y - 1 - ED_D * x * x * y * y) % ED_P != 0:
        raise ValueError("not a curve point")
    return [x, y]


def ed_scalar(seed: bytes) -> int:
    scalar = int.from_bytes(hashlib.sha512(seed).digest()[:32], "little")
    return (scalar & ((1 << 254) - 8)) | (1 << 254)


def ed_public_key(seed: bytes) -> bytes:
    return ed_encode(ed_mul(ED_B, ed_scalar(seed)))


def ed_sign(seed: bytes, message: bytes) -> bytes:
    scalar = ed_scalar(seed)
    public = ed_encode(ed_mul(ED_B, scalar))
    digest = hashlib.sha512(seed).digest()
    nonce = int.from_bytes(hashlib.sha512(digest[32:] + message).digest(), "little") % ED_L
    r_point = ed_encode(ed_mul(ED_B, nonce))
    challenge = int.from_bytes(
        hashlib.sha512(r_point + public + message).digest(), "little"
    ) % ED_L
    return r_point + ((nonce + challenge * scalar) % ED_L).to_bytes(32, "little")


def ed_verify(public: bytes, message: bytes, signature: bytes) -> bool:
    if len(public) != 32 or len(signature) != 64:
        return False
    try:
        a_point = ed_decode(public)
        r_point = ed_decode(signature[:32])
    except ValueError:
        return False
    scalar_s = int.from_bytes(signature[32:], "little")
    if scalar_s >= ED_L:
        return False
    challenge = int.from_bytes(
        hashlib.sha512(signature[:32] + public + message).digest(), "little"
    ) % ED_L
    return ed_add(r_point, ed_mul(a_point, challenge)) == ed_mul(ED_B, scalar_s)


def ed_self_test() -> None:
    """RFC 8032 section 7.1, test vector 1 (empty message)."""
    seed = bytes.fromhex(
        "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60"
    )
    public = bytes.fromhex(
        "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a"
    )
    signature = bytes.fromhex(
        "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e06522490155"
        "5fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b"
    )
    if (
        ed_public_key(seed) != public
        or ed_sign(seed, b"") != signature
        or not ed_verify(public, b"", signature)
        or ed_verify(public, b"x", signature)
    ):
        sys.exit("FAIL: the RFC 8032 reference verifier disagrees with test vector 1")


def seed_from_pem(path: Path) -> bytes:
    """The 32-byte seed of an OpenSSL Ed25519 PKCS#8 private key."""
    match = re.search(
        r"-----BEGIN PRIVATE KEY-----(.*?)-----END PRIVATE KEY-----",
        path.read_text(encoding="ascii"),
        re.S,
    )
    der = base64.b64decode("".join(match.group(1).split())) if match else b""
    # SEQ { INT 0, SEQ { OID 1.3.6.1.4.1.11591.15.1 }, OCTET STRING { OCTET STRING seed } }
    if not der.startswith(bytes.fromhex("302e020100300506032b657004220420")) or len(der) != 48:
        sys.exit("FAIL: not an Ed25519 PKCS#8 private key (openssl genpkey -algorithm ed25519)")
    return der[16:]


# --- the committed block, read back for carry-over and --check ---------

def module_value(text: str, name: str, pattern: str):
    match = re.search(rf"export const {name} =\s*\n?\s*{pattern}", text)
    return match.group(1) if match else None


def module_int(text: str, name: str):
    value = module_value(text, name, r"(0x[0-9a-fA-F]+n)")
    return int(value[2:-1], 16) if value else None


def module_words(text: str, name: str):
    match = re.search(rf"export const {name} = \[(.*?)\] as const", text, re.S)
    return [int(w, 16) for w in re.findall(r"0x([0-9a-fA-F]+)n", match.group(1))] if match else None


def module_hex(text: str, name: str, length: int):
    value = module_value(text, name, r"'([0-9a-f]*)'")
    return value if value is not None and len(value) == length else None


def gate_pin(gate_text: str) -> str:
    match = re.search(r"EXPECTED_OWNER_PUBLIC_KEY =\s*\n?\s*'([0-9a-f]*)'", gate_text)
    return match.group(1) if match else ""


def ts_word(value: int) -> str:
    return f"0x{value:016x}n"


def ts_array(name: str, words: list, comment: str) -> str:
    body = ", ".join(ts_word(w) for w in words)
    return f"export const {name} = [{body}] as const; // {comment}"


def check_committed(
    manifest_digest,
    authors_digest,
    masked_manifest: list,
    masked_authors: list,
    authors_field: str,
    payload: bytes,
) -> int:
    """The committed tree against this tool. Returns the failure count."""
    module_text = MODULE_PATH.read_text(encoding="utf-8")
    gate_text = GATE_PATH.read_text(encoding="utf-8")
    failures = 0

    def expect(label: str, committed, expected) -> None:
        nonlocal failures
        if committed == expected:
            print(f"ok:   {label}")
        else:
            print(f"FAIL: {label}: committed {committed!r} != generator {expected!r}")
            failures += 1

    expect("MANIFEST_SEED", module_int(module_text, "MANIFEST_SEED"), SEED_MANIFEST)
    expect("MASKED_MANIFEST_WORDS", module_words(module_text, "MASKED_MANIFEST_WORDS"), masked_manifest)
    if manifest_digest is None:
        print("note: b3sum not installed - D2 digest cross-check skipped (check-signature.ts covers the digests)")
    else:
        expect("MANIFEST_FINGERPRINT", module_hex(module_text, "MANIFEST_FINGERPRINT", 64), manifest_digest)
        expect("AUTHORS_FINGERPRINT", module_hex(module_text, "AUTHORS_FINGERPRINT", 64), authors_digest)
    expect("AUTHORS_SEED", module_int(module_text, "AUTHORS_SEED"), SEED_AUTHORS)
    expect("MASKED_AUTHORS_WORDS", module_words(module_text, "MASKED_AUTHORS_WORDS"), masked_authors)
    expect("MASKED_AUTHORS_FIELD", module_hex(module_text, "MASKED_AUTHORS_FIELD", 96), authors_field)
    expect("D3_DOMAIN", module_value(module_text, "D3_DOMAIN", r"'([^']*)'"), D3_DOMAIN)

    pin = gate_pin(gate_text)
    expect("OWNER_PUBLIC_KEY equals the gate pin", module_hex(module_text, "OWNER_PUBLIC_KEY", 64), pin)
    signature = module_hex(module_text, "OWNER_SIGNATURE", 128)
    if signature is None or pin == "" or not ed_verify(bytes.fromhex(pin), payload, bytes.fromhex(signature)):
        print("FAIL: the committed D3 signature does not verify under the pinned key (RFC 8032 reference)")
        failures += 1
    else:
        print("ok:   D3 signature verifies under the pinned key (RFC 8032 reference)")
    return failures


def main() -> None:
    parser = argparse.ArgumentParser(description="Emit, sign, or check the depth-matrix constants.")
    parser.add_argument("--signing-key", type=Path, help="Ed25519 PKCS#8 private key (PEM)")
    parser.add_argument("--signature-in", type=Path, help="64 raw bytes or 128 hex characters")
    parser.add_argument("--payload-out", type=Path, help="write the framed D3 bytes here")
    parser.add_argument("--check", action="store_true", help="verify the committed tree")
    args = parser.parse_args()

    ed_self_test()

    manifest_bytes = MANIFEST.encode("utf-8")
    authors_bytes = AUTHORS.encode("utf-8")

    manifest_words = chunk_words(manifest_bytes)
    authors_words = chunk_words(authors_bytes)
    masked_manifest = mask_words(manifest_words, SEED_MANIFEST)
    masked_authors = mask_words(authors_words, SEED_AUTHORS)
    authors_field = "".join(f"{w & MASK64:016x}" for w in masked_authors)

    # Self-checks: round-trip, strings-invisibility, and the b3sum
    # cross-check. Any failure here means the block must not ship.
    assert unmask_words(masked_manifest, SEED_MANIFEST, len(manifest_bytes)) == manifest_bytes
    assert unmask_words(masked_authors, SEED_AUTHORS, len(authors_bytes)) == authors_bytes
    assert longest_ascii_run(masked_manifest) < 4, "manifest words leak ASCII"
    assert longest_ascii_run(masked_authors) < 4, "authors words leak ASCII"
    tool = find_b3sum()
    manifest_digest = b3sum_hex(manifest_bytes, tool) if tool else None
    authors_digest = b3sum_hex(authors_bytes, tool) if tool else None

    payload = signable_payload(manifest_bytes, authors_bytes)
    if args.payload_out:
        args.payload_out.write_bytes(payload)

    if args.check:
        failures = check_committed(
            manifest_digest, authors_digest, masked_manifest, masked_authors, authors_field, payload
        )
        if failures:
            sys.exit(f"FAIL: {failures} provenance check(s) above failed")
        print("OK: committed provenance block matches the generator output and the D3 signature verifies under the pinned key.")
        return

    if manifest_digest is None:
        sys.exit("FAIL: b3sum not installed - the generator cannot pin the BLAKE3 digests")

    public_hex, signature_hex = module_hex_or_empty("OWNER_PUBLIC_KEY", 64), module_hex_or_empty("OWNER_SIGNATURE", 128)
    if args.signing_key:
        seed = seed_from_pem(args.signing_key)
        public_hex = ed_public_key(seed).hex()
        signature_hex = ed_sign(seed, payload).hex()
    elif args.signature_in:
        raw = args.signature_in.read_bytes().strip()
        signature = bytes.fromhex(raw.decode("ascii")) if len(raw) == 128 else raw
        public_hex = gate_pin(GATE_PATH.read_text(encoding="utf-8")) if GATE_PATH.exists() else ""
        if not public_hex or not ed_verify(bytes.fromhex(public_hex), payload, signature):
            sys.exit("FAIL: --signature-in does not verify under the gate's pinned key")
        signature_hex = signature.hex()
    elif public_hex and signature_hex and not ed_verify(
        bytes.fromhex(public_hex), payload, bytes.fromhex(signature_hex)
    ):
        signature_hex = ""
        print(
            "NOTE: the committed D3 signature does not cover the current truths; emitting an empty signature "
            "(status=unsigned). Sign with --signing-key and paste the block.",
            file=sys.stderr,
        )

    print("// --- Generated by scripts/release/generate-provenance-words.py ---")
    print("// Paste over the constants of the same names in")
    print("// src/lib/utils/signature.ts. Do not hand-edit the words or")
    print("// digests: rotate via the generator (edit the truth strings")
    print("// there, re-run, paste).")
    print()
    print(f"export const MANIFEST_SEED = {ts_word(SEED_MANIFEST)};")
    print(f"export const MANIFEST_BYTE_LEN = {len(manifest_bytes)};")
    print(ts_array("MASKED_MANIFEST_WORDS", masked_manifest, "D0, masked"))
    print(f"export const MANIFEST_FINGERPRINT = '{manifest_digest}'; // D2, BLAKE3-256")
    print()
    print(f"export const AUTHORS_SEED = {ts_word(SEED_AUTHORS)};")
    print(f"export const AUTHORS_BYTE_LEN = {len(authors_bytes)};")
    print(ts_array("MASKED_AUTHORS_WORDS", masked_authors, "D1, masked"))
    print(f"export const AUTHORS_FINGERPRINT = '{authors_digest}'; // D2, BLAKE3-256")
    print()
    print(f"export const MASKED_AUTHORS_FIELD = '{authors_field}'; // machine-readable D1 field")
    print()
    print(f"export const D3_DOMAIN = '{D3_DOMAIN}';")
    print(f"export const OWNER_PUBLIC_KEY = '{public_hex}'; // D3, Ed25519 publisher key")
    print(
        f"export const OWNER_SIGNATURE = '{signature_hex}';"
        " // D3, Ed25519 over the framed clear bytes"
    )
    print()
    print(f"# oracle: manifest digest  = {manifest_digest}")
    print(f"# oracle: authors digest   = {authors_digest}")
    print(
        f"# longest ASCII run (both layers) below 4: "
        f"{longest_ascii_run(masked_manifest)} / {longest_ascii_run(masked_authors)}"
    )
    if not signature_hex:
        print("# UNSIGNED BLOCK: paste it and the module reports status=unsigned")
    elif not args.signing_key and not args.signature_in:
        print(f"# D3 carried over from the committed module: verified for the current truths (key {public_hex[:16]}...)")


def module_hex_or_empty(name: str, length: int) -> str:
    if not MODULE_PATH.exists():
        return ""
    return module_hex(MODULE_PATH.read_text(encoding="utf-8"), name, length) or ""


if __name__ == "__main__":
    main()
