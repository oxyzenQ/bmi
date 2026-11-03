<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# asset signature checksums

The LTS supply-chain lock for the brand surface: every image under
`assets/`, `docs/assets/`, and `static/assets/` (the five demo
captures, the logo master plate, and the eight PWA logo derivatives
the manifest and the service worker ship) carries a recorded BLAKE3
digest, so a future swap, duplicate, or re-encoded fake of the logo
is detectable against the committed bytes. The digests were produced
with `b3sum 1.8.7` (the BLAKE3 team's canonical CLI) and cross-verified
against an independent BLAKE3 implementation before landing; the CLI
binary itself was proven against the published BLAKE3 known-answer
vectors (the empty string and `abc` digests) because the 1.8.7 release
ships no checksum asset of its own.

Verify every signed asset against the committed digests:

```bash
b3sum -c assets/signature.b3sum
```

Or regenerate the digests by hand and compare against the table:

```bash
b3sum assets/*.png docs/assets/*.png static/assets/*.png | sort -k2
```

| file                                            | bytes   | blake3                                                             |
| ----------------------------------------------- | ------- | ------------------------------------------------------------------ |
| assets/demo-bmi-stellar-gauge-active.png        | 500186  | `88c603a03d39dd5fbd1f9cb7e7fdb458d9b178debe7f3caa0e0e1f4dc0b1822f` |
| assets/demo-bmi-stellar-gauge.png               | 514050  | `e1994ff6ce44c34fbc2d525a858dd9109ef5276a38d24224bfddc96f9ee70d29` |
| assets/demo-bmi-stellar-home-page.png           | 614809  | `4f03380f001aa8d1f13a66176e9bcf86aabccc5013b781708df51bce1cbaffac` |
| assets/demo-bmi-stellar-results.png             | 534130  | `a02f955d4e006520197924093162ec78ab699e4dba7db2fb5d177a8a55b89d0e` |
| assets/demo-bmi-stellar-snapshot.png            | 487954  | `5aca81df38015413a1ba9fb042905b8329c14e65c4c0d02843f55adf7e248aa5` |
| docs/assets/bmi-logo-masters.png                | 1037058 | `717160d5a2dfb0e3ba7224030715d52316f6b8e9abff6797613e8b6bdc3c6e0a` |
| static/assets/bmi-logo-masters-1024.png         | 741736  | `7962be268abe15d75e2e5c7f23e1923ed9a08114ded91152e2ea1894d0868274` |
| static/assets/bmi-logo-masters-128.png          | 14786   | `b9e3f4393cc5c9160f37afc4c31cd373a3fc584f91ad0e923b11c86085cd829f` |
| static/assets/bmi-logo-masters-180.png          | 27415   | `883434ff930980e75cd8daad1bbc6e50061280aece243c27997dd12fc3bb7180` |
| static/assets/bmi-logo-masters-192.png          | 30823   | `48a18cadc03f5556b0efddd671f4896e5aa31c32f75b65885dcfa2659389f516` |
| static/assets/bmi-logo-masters-216.png          | 38115   | `094c3fe3206657462037b53fb8af780d80f0c3e51e273bcfcc97d5d7af41d6a9` |
| static/assets/bmi-logo-masters-256.png          | 55000   | `550598629990407a750f03e0b702b2b1545f582f8d0c3600715fb0dc4ffd6f1a` |
| static/assets/bmi-logo-masters-512-maskable.png | 148656  | `b011327fb673fc437f54d02b21b17d345be9bd987d6bf4f4fcd67c22f7200595` |
| static/assets/bmi-logo-masters-512.png          | 211755  | `ec8d4538ce241dcca40273c78b78b7fd1de24f8f606a6a43c1058d12e72a0c51` |

The scope is the whole brand surface, not only the root `assets/`
directory: the logo master lives in `docs/assets/` (kept out of the
deployed client on purpose, see BRANDING 3.1) and the web-facing PWA
derivatives live in `static/assets/`, and a substituted icon ships to
every installed client exactly like a substituted demo capture would.

When an asset legitimately changes, refresh the matching row and the
matching `signature.b3sum` line in the same commit that replaces the
file. `scripts/gates/check-signature-assets.sh` enforces both
directions in the gate-keepers lane: a modified or unlisted image
fails the gate, and so does a listed file that vanished.
