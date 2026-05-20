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

Users can explicitly export or share data:

- **PNG share cards** contain only the visible result information rendered into the image.
- **Unencrypted exports** are portable history backups and should be treated like sensitive personal files by the user.
- **Encrypted exports** protect backup contents with passphrase-derived encryption before download.

## Security Architecture

BMI Stellar is engineered with a strict **Local-First, Zero-Trust** model:

- **Data Locality:** Health metrics are computed and stored on the user's device. There is no account system and no app backend that stores BMI data.
- **Export Encryption:** Encrypted backups use AES-256-GCM authenticated encryption before download. Unencrypted export remains available for portability and is intentionally user-controlled.
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

### Operational Safety Rules

- Never log passphrases, derived keys, verifier plaintext, decrypted backups, encrypted backup payloads, or raw health history.
- Do not weaken Argon2id/AES-GCM parameters without a security-focused PR and test coverage.
- Do not change the encrypted backup format without a compatibility plan.
- Treat service worker changes as security-sensitive because stale caches and update prompts can affect what users run.

---

If you identify a flaw in this cryptographic implementation, please report it immediately via the [GitHub Security Advisories](https://github.com/oxyzenQ/bmi/security/advisories/new) page.
