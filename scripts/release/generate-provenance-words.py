#!/usr/bin/env python3
# Copyright (C) 2026 rezky_nightky
# SPDX-License-Identifier: AGPL-3.0-only
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
src/lib/utils/signature.ts (sigSplitmix64Mix + sigMaskFor). If you
change one side, change both, and re-run this tool. The emitted block
is self-checked below: it unmasks its own words, asserts the round-trip
equals the input, asserts the strings(1)-invisibility floor, and
cross-checks the BLAKE3 digests against the canonical CLI (b3sum) — so
a paste mistake or an algorithm drift fails here before it can ship.

Usage:
    python3 scripts/release/generate-provenance-words.py

Tool: b3sum (the BLAKE3 team's canonical CLI) for the D2 digest
oracles. A missing tool fails the generator loudly.
"""

import shutil
import subprocess
import sys
from pathlib import Path

# The provenance truths. Byte-level truth: UTF-8 (the em dash is three
# bytes, E2 80 94, and every layer below operates on bytes, not chars).
MANIFEST = "BMI Stellar — Official Build by rezky_nightky (oxyzenQ) 2026"
AUTHORS = "rezky_nightky (oxyzenQ) 2026"

# Per-layer seeds. Decoys with no external meaning; rotating them is a
# supported operation (re-run this tool, paste the new block). Both must
# differ so the two layers never produce identical constants. Kept in
# lockstep with the cosmostrix generator (same tool lineage).
SEED_MANIFEST = 0x9D3A_7C1E_44B2_6F08
SEED_AUTHORS = 0x1F4E_6B8A_C27D_53A1

MASK64 = (1 << 64) - 1
GOLDEN = 0x9E3779B97F4A7C15


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


def b3sum_hex(data: bytes) -> str:
    """BLAKE3-256 through the canonical CLI, hex-encoded."""
    tool = shutil.which("b3sum") or (Path.home() / ".local" / "bin" / "b3sum")
    if not tool or not Path(tool).exists():
        sys.exit("FAIL: b3sum not installed - the generator cannot pin the BLAKE3 digests")
    proc = subprocess.run([str(tool)], input=data, capture_output=True, check=True)
    return proc.stdout.decode().split()[0]


def ts_word(value: int) -> str:
    return f"0x{value:016x}n"


def ts_array(name: str, words: list, comment: str) -> str:
    body = ", ".join(ts_word(w) for w in words)
    return f"export const {name} = [{body}] as const; // {comment}"


def main() -> None:
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
    manifest_digest = b3sum_hex(manifest_bytes)
    authors_digest = b3sum_hex(authors_bytes)

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
    print(f"# oracle: manifest digest  = {manifest_digest}")
    print(f"# oracle: authors digest   = {authors_digest}")
    print(f"# longest ASCII run (both layers) below 4: "
          f"{longest_ascii_run(masked_manifest)} / {longest_ascii_run(masked_authors)}")


if __name__ == "__main__":
    main()
