# 🛡️ Security Policy

Security and user privacy are foundational pillars of BMI Stellar. We take the protection of health data and cryptographic integrity extremely seriously.

## 📑 Table of Contents

- [Supported Versions](#-supported-versions)
- [Reporting a Vulnerability](#-reporting-a-vulnerability)
- [Expected Response Timeline](#-expected-response-timeline)
- [Security Architecture](#-security-architecture)

---

## ✅ Supported Versions

We actively maintain and provide security patches for the following versions:

| Version        | Supported | Notes                                           |
| -------------- | --------- | ----------------------------------------------- |
| `main` branch  | ✅ Yes    | Continuous rolling updates.                     |
| Latest Release | ✅ Yes    | Primary target for immediate security hotfixes. |
| Older Releases | ❌ No     | Please upgrade to the latest stable release.    |

## 🚨 Reporting a Vulnerability

We deeply appreciate responsible disclosure.

**For Sensitive Security Issues:**

1. Please use the [GitHub Security Advisories](https://github.com/oxyzenq/bmi/security/advisories/new) feature to report issues privately.
2. Provide detailed steps to reproduce the vulnerability.
3. Include the environment details (Browser, OS, Node/Bun version).

> [!WARNING]
> Please **do not** disclose security vulnerabilities publicly (e.g., via standard GitHub issues or social media) until a patch has been released.

**For Non-Sensitive Issues:**
You may open a standard [GitHub Issue](https://github.com/oxyzenq/bmi/issues) detailing the bug or improvement.

## ⏱️ Expected Response Timeline

Our maintenance team is committed to addressing security concerns promptly:

- **Initial Acknowledgment:** Within 48 hours.
- **Triage & Assessment:** Within 72 hours.
- **Patch Development:** Prioritized above all feature development.

## 🏛️ Security Architecture

BMI Stellar is engineered with a strict **Local-First, Zero-Trust** model:

- **Data Locality:** Your health metrics never leave your device unless explicitly exported by you. There are no tracking pixels or external telemetry servers capturing BMI data.
- **Export Encryption:** All backups are encrypted using **AES-256-GCM** authenticated encryption.
- **Key Derivation:** We utilize **Argon2id** (the winner of the Password Hashing Competition) to derive encryption keys, highly resistant to GPU cracking.
- **Zero Knowledge:** Passphrases are never stored, cached, or transmitted.

If you identify a flaw in this cryptographic implementation, please report it immediately via the private channels outlined above.
