# Security Policy

Security and user privacy are foundational pillars of BMI Stellar. This document defines the scope of our security commitments, how to report vulnerabilities, and the cryptographic architecture that protects user data.

## Table of Contents

- [Supported Versions](#supported-versions)
- [Reporting a Vulnerability](#reporting-a-vulnerability)
- [Expected Response Timeline](#expected-response-timeline)
- [Scope](#scope)
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

## Security Architecture

BMI Stellar is engineered with a strict **Local-First, Zero-Trust** model:

- **Data Locality:** All health metrics are computed and stored entirely on the user's device. There are no tracking pixels, no external telemetry servers, and no server-side storage of BMI data. The only network requests are for static assets (fonts, icons) and Vercel analytics (aggregated, non-personal).
- **Export Encryption:** All backups are encrypted using AES-256-GCM authenticated encryption before leaving the browser. Unencrypted exports are never written to disk.
- **Key Derivation:** We use Argon2id (the winner of the Password Hashing Competition) to derive encryption keys from user passphrases. The production parameters (64 MiB memory, 3 iterations, parallelism 1) follow OWASP 2023 recommendations and are highly resistant to GPU-based cracking.
- **Zero Knowledge:** Passphrases are never stored, cached, or transmitted. The passphrase verifier stored in IndexedDB is an AES-GCM ciphertext of a known plaintext — it can confirm a passphrase is correct but cannot be reversed to recover the passphrase.
- **Integrity Verification:** Every backup includes a SHA-256 checksum of the ciphertext. Import validates this checksum before attempting decryption, rejecting tampered or corrupted payloads.

## Cryptographic Details

### Argon2id (Primary KDF)

Used for all new encryptions. Parameters follow OWASP 2023 recommendations.

| Parameter     | Production             | Test (CI)        |
| ------------- | ---------------------- | ---------------- |
| Memory        | 64 MiB (65536 KiB)     | 1 MiB (1024 KiB) |
| Iterations    | 3                      | 1                |
| Parallelism   | 1                      | 1                |
| Salt length   | 16 bytes (128-bit)     | 16 bytes         |
| Output length | 32 bytes (AES-256 key) | 32 bytes         |

Implementation: `@noble/hashes/argon2.js` — pure JavaScript, no WASM, auditable source, minimal bundle.

### PBKDF2 (Legacy KDF)

Supported for importing backups created with older versions. Not used for new encryptions.

| Parameter     | Value              |
| ------------- | ------------------ |
| Iterations    | 600,000            |
| Hash function | SHA-256            |
| Salt length   | 16 bytes (128-bit) |

### AES-256-GCM Encryption Envelope

| Field               | Value                                               |
| ------------------- | --------------------------------------------------- |
| Format identifier   | `bmi-encrypted-v1`                                  |
| Cipher              | AES-256-GCM (authenticated)                         |
| IV length           | 12 bytes (96-bit), random per encryption            |
| Auth tag            | 16 bytes (128-bit), handled by Web Crypto API       |
| Ciphertext checksum | SHA-256, stored in `meta.checksum`                  |
| KDF auto-detection  | `kdf` field: `'argon2id'` or absent (legacy PBKDF2) |

### Passphrase Verification (v18.1)

When encryption is enabled, a known verifier string (`BMI_STELLAR_VERIFIER_V1`) is encrypted with the user's passphrase and stored in IndexedDB. The `verifyPassphrase()` function attempts decryption — a wrong passphrase causes AES-GCM auth tag mismatch, returning `false`. The passphrase itself is never stored anywhere.

### Password Strength Estimation

Uses `@zxcvbn-ts/core` with `@zxcvbn-ts/language-common` dictionary for realistic strength scoring. Falls back to basic length/character-class heuristics if zxcvbn is unavailable.

---

If you identify a flaw in this cryptographic implementation, please report it immediately via the [GitHub Security Advisories](https://github.com/oxyzenQ/bmi/security/advisories/new) page.
