<!--
  SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
  SPDX-License-Identifier: AGPL-3.0-only OR Commercial
-->

# Security Policy

Security and user privacy are foundational pillars of BMI Stellar. This document defines the scope of our security commitments, how to report vulnerabilities, and the privacy/cryptographic architecture that protects user data.

## Table of Contents

- [Supported Versions](#supported-versions)
- [Reporting a Vulnerability](#reporting-a-vulnerability)
- [Expected Response Timeline](#expected-response-timeline)
- [Scope](#scope)
- [Privacy Boundary](#privacy-boundary)
- [Security Architecture](#security-architecture)
- [Cryptographic Details](#cryptographic-details)

---

## Supported Versions

We actively maintain and provide security patches for the following versions:

| Version        | Supported | Notes                                          |
| -------------- | --------- | ---------------------------------------------- |
| `main` branch  | Yes       | Continuous rolling updates                     |
| Latest Release | Yes       | Primary target for immediate security hotfixes |
| Older Releases | No        | Please upgrade to the latest stable release    |

## Reporting a Vulnerability

We deeply appreciate responsible disclosure and take all reports seriously.

### Sensitive Security Issues

1. Use the [GitHub Security Advisories](https://github.com/oxyzenQ/bmi/security/advisories/new) feature to report issues privately.
2. Provide detailed steps to reproduce the vulnerability.
3. Include environment details: browser, OS, Node/Bun version.
4. If applicable, describe the potential impact (data exposure, privilege escalation, etc.).

> [!WARNING]
> Please **do not** disclose security vulnerabilities publicly (e.g., via standard GitHub issues, social media, or blog posts) until a patch has been released and users have had reasonable time to update.

### Non-Sensitive Issues

For bugs that do not involve security vulnerabilities (e.g., visual glitches, incorrect calculations, accessibility issues), open a standard [GitHub Issue](https://github.com/oxyzenQ/bmi/issues).

## Expected Response Timeline

Our maintenance team is committed to addressing security concerns promptly:

- **Initial Acknowledgment:** Within 48 hours of report submission.
- **Triage & Assessment:** Within 72 hours — we will confirm the vulnerability, assess severity, and communicate our planned response.
- **Patch Development:** Prioritized above all feature development. Critical vulnerabilities (data exposure, auth bypass) target a patch within 7 days. Lower-severity issues are scheduled for the next release.

## Scope

### In Scope

- Cryptographic implementation flaws in backup encryption/decryption
- Cross-site scripting (XSS) or injection vulnerabilities
- Data leakage or unintended data transmission
- Authentication or authorization bypasses
- Service worker or PWA security issues
- Dependency vulnerabilities in production code

### Out of Scope

- Denial-of-service attacks against the Vercel-hosted demo
- Social engineering attacks
- Issues in development-only tools (DebugPanel, dev diagnostics)
- Theoretical vulnerabilities without a practical exploit
- Issues in third-party services (Vercel, GitHub) outside our control

## Privacy Boundary

BMI Stellar is local-first. BMI inputs, BMI history, goals, body-composition values, encrypted verifier data, and backup contents are stored and processed in the browser.

The hosted production demo may load Vercel Analytics and Speed Insights for aggregate product/performance telemetry. Those integrations must never receive BMI values, history records, passphrases, encryption keys, backup payloads, or decrypted import contents.

The app also checks for updates at most once every 12 hours per device by fetching two public GitHub URLs: this repository's `package.json` on `raw.githubusercontent.com` and the latest commit SHA on `api.github.com`. These are unauthenticated GET requests with no body, no credentials, and no health data; a failed or offline attempt is not counted toward the throttle window, and manual checks in About are immediate. Both endpoints are pinned in the production CSP `connect-src` allowlist, which is the complete set of third-party endpoints the app may contact.

Users can explicitly export or share data:

- **PNG share cards** contain only the visible result information rendered into the image.
- **Unencrypted exports** are portable history backups and should be treated like sensitive personal files by the user.
- **Encrypted exports** protect backup contents with passphrase-derived encryption before download.

## Security Architecture

BMI Stellar is engineered with a strict **Local-First, Zero-Trust** model:

- **Data Locality:** Health metrics are computed and stored on the user's device. There is no account system and no app backend that stores BMI data.
- **Export Encryption:** Encrypted backups use AES-256-GCM authenticated encryption before download. Unencrypted export remains available for portability and is intentionally user-controlled.
- **Key Derivation:** We use Argon2id (the winner of the Password Hashing Competition) to derive encryption keys from user passphrases. The production parameters (64 MiB memory, 3 iterations, parallelism 1) follow OWASP 2023 recommendations and are highly resistant to GPU-based cracking.
- **Zero Knowledge:** Passphrases are never stored, cached, or transmitted. The derived at-rest session key lives in volatile memory only while an unlocked session is active, and sessions register only through the explicit passphrase-verified doors (`enableEncryption`, the verified unlock battery, and the night-cafe-10 cold-load unlock door) — decryption never registers one (night-cafe-9) — never persisted or transmitted. Raw Argon2id output is wiped at the single ownership point after it is imported into a non-extractable CryptoKey, the KDF worker transfers its hash buffer (detaching the worker-side copy), and the PBKDF2 path derives inside WebCrypto without ever exposing material to JavaScript. Both integrity compares (ciphertext checksum, export-file signature) are constant-time. The passphrase verifier stored in IndexedDB is an AES-GCM ciphertext of a known plaintext — it can confirm a passphrase is correct but cannot be reversed to recover the passphrase.
- **Integrity Verification:** Every backup includes a SHA-256 checksum of the ciphertext. Import validates this checksum before attempting decryption, rejecting tampered or corrupted payloads.
- **CSP Strictness:** The production Content Security Policy is explicitly allowlisted per directive. `img-src` is pinned to `'self' data: blob:` — no wildcard domains (such as `https:`) are permitted — so even a hypothetical XSS cannot exfiltrate health data by loading attacker-hosted images. The only remote hosts in the policy are the two GitHub update-check endpoints in `connect-src` and, on non-production Vercel previews, the named Vercel toolbar origins.

## Cryptographic Details

### Provenance Depth Matrix (build attribution)

The build carries an ownership claim that survives rebranding attempts:
the claim text exists only as XOR-masked 64-bit words (D0/D1) with
BLAKE3-256 digests over the clear bytes (D2), and — since
night-netrunner-Z1 — an Ed25519 publisher signature over the
length-framed clear bytes (D3). The runtime verifies all three legs
before reporting `status=verified`; the CI gates re-verify
independently (the TypeScript gate, the Python RFC 8032 reference),
the built artifact is scanned for plaintext leaks and D3 survival
(`audit:artifact`), and the release channel refuses to publish a tag
that is not GPG-signed by the pinned release key, with the archives
additionally bound to the repository through GitHub attestations.
This is provenance marking and tamper evidence, not DRM.

### Argon2id (Primary KDF)

Used for all new encryptions. Parameters follow OWASP 2023 recommendations.

| Parameter     | Production             | Test (CI)        |
| ------------- | ---------------------- | ---------------- |
| Memory        | 64 MiB (65536 KiB)     | 1 MiB (1024 KiB) |
| Iterations    | 3                      | 1                |
| Parallelism   | 1                      | 1                |
| Salt length   | 16 bytes (128-bit)     | 16 bytes         |
| Output length | 32 bytes (AES-256 key) | 32 bytes         |

Implementation: the digest-verified Rust wasm engine (`engine/argon2id`, RFC 9106 through RustCrypto, provenance-checked in CI) is the primary derivation seat; `@noble/hashes/argon2.js` is the byte-identical JavaScript fallback — auditable source, minimal bundle.

### PBKDF2 (Legacy KDF)

Supported for importing backups created with older versions. Not used for new encryptions.

| Parameter     | Value              |
| ------------- | ------------------ |
| Iterations    | 600,000            |
| Hash function | SHA-256            |
| Salt length   | 16 bytes (128-bit) |

### AES-256-GCM Encryption Envelope

| Field               | Value                                                         |
| ------------------- | ------------------------------------------------------------- |
| Format identifier   | `bmi-encrypted-v3` (legacy `bmi-encrypted-v1` still readable) |
| Cipher              | AES-256-GCM (authenticated)                                   |
| IV length           | 12 bytes (96-bit), random per encryption                      |
| Auth tag            | 16 bytes (128-bit), handled by Web Crypto API                 |
| Ciphertext checksum | SHA-256, stored in `meta.checksum`                            |
| KDF auto-detection  | `kdf` field: `'argon2id'` or absent (legacy PBKDF2)           |

### Passphrase Verification (v18.1)

When encryption is enabled, a known verifier string (`BMI_STELLAR_VERIFIER_V1`) is encrypted with the user's passphrase and stored in IndexedDB. The `verifyPassphrase()` function attempts decryption — a wrong passphrase causes AES-GCM auth tag mismatch, returning `false`. The passphrase itself is never stored anywhere.

### Password Strength Estimation

Uses `@zxcvbn-ts/core` with `@zxcvbn-ts/language-common` dictionary for realistic strength scoring. Falls back to basic length/character-class heuristics if zxcvbn is unavailable.

### Operational Safety Rules

- Never log passphrases, derived keys, verifier plaintext, decrypted backups, encrypted backup payloads, or raw health history.
- Do not weaken Argon2id/AES-GCM parameters without a security-focused PR and test coverage.
- Do not change the encrypted backup format without a compatibility plan.
- Treat service worker changes as security-sensitive because stale caches and update prompts can affect what users run.

---

If you identify a flaw in this cryptographic implementation, please report it immediately via the [GitHub Security Advisories](https://github.com/oxyzenQ/bmi/security/advisories/new) page.

<!-- BMI-DISCLAIMER -->
<!--
  Documentation Disclaimer — read before relying on any data point.

  This document may contain stale data, hardcoded counts, or outdated
  file paths and symbol names. Maintainers update source code but may
  forget to sync every doc — perfect sync across every .md file is a
  known maintenance burden with diminishing returns.

  Source code (`src/**/*.ts`, `src/**/*.svelte`) is the single source
  of truth. Always cross-check against the actual source files before
  relying on any specific number (test count, record bound, key
  length), file path, function name, or config key.

  If you find a discrepancy, please open a PR — the doc is wrong, not
  the source.
-->
