<!--
  SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
  SPDX-License-Identifier: AGPL-3.0-only OR Commercial
-->

# asset signature checksums

The LTS supply-chain lock for the brand surface: every image under
`assets/`, `static/assets/`, and `static/images/` (the five demo
captures, the 1254x1254 logo master plate, the eight PWA logo
derivatives the manifest and the service worker ship, and the four web
images the client serves) carries a recorded BLAKE3 digest, so a
future swap, duplicate, or re-encoded fake of the logo is detectable
against the committed bytes. The digests were produced with
`b3sum 1.8.7` (the BLAKE3 team's canonical CLI) and cross-verified
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
b3sum assets/*.png static/assets/*.png static/images/*.webp | sort -k2
```

| file                                            | bytes   | blake3                                                             |
| ----------------------------------------------- | ------- | ------------------------------------------------------------------ |
| assets/bmi-original-logo-2026.png               | 1283020 | `bfedb9d4d6ee31889ce6e147cefdc920d93da11d255b0ab530e74ce9458abeeb` |
| assets/demo-bmi-stellar-gauge-active.png        | 328909  | `7b5ccec1c4c15df8cace7861584555d0cf37d70799f3f3fdc6ae1f3f8009eb24` |
| assets/demo-bmi-stellar-gauge.png               | 332711  | `d2d4b7c66652232dde530b47b3b61e96cedf80b3776c29a7692313999ab48db5` |
| assets/demo-bmi-stellar-home-page.png           | 450617  | `c504240b579c2619377f550e72585c2cf1a153703b0733acfeadd07eb6bca5f0` |
| assets/demo-bmi-stellar-results.png             | 544385  | `5d7f252adde912c8f5f3a1ecdf4d480d00923d216caecbbf9063f77367b3a5a0` |
| assets/demo-bmi-stellar-snapshot.png            | 345672  | `f0bb57ae882c4dd5079997594fd06116f98ddd78ed98932f20006e2323119df5` |
| static/assets/bmi-logo-masters-1024.png         | 1019660 | `39c4ec2c078c443e80ae22659ca0e20267efcecfdcc9eac9941548cf7fe4086f` |
| static/assets/bmi-logo-masters-128.png          | 20557   | `3eb4700003c1fdd55fabc0fc5aedfdbdac7632a5fa5f24bd720a47cc314d650f` |
| static/assets/bmi-logo-masters-180.png          | 39310   | `61c81a74e7e56164cd7966142a3688aafc29bf52d0d0a127cd429567a2b4f0a7` |
| static/assets/bmi-logo-masters-192.png          | 44341   | `0bf408bba8cfbdcae8ac092f8b8837398fde08a95d8fdc39e84e7d3c771e2e4c` |
| static/assets/bmi-logo-masters-216.png          | 55260   | `2bf67a70e2ab481e888bbb4bfaed34885d9b8d99fbb75a03065e0fd193eb3a07` |
| static/assets/bmi-logo-masters-256.png          | 78777   | `62bda501016421a43f31417a993f16933394303421dda4b232aff246d3aaf41b` |
| static/assets/bmi-logo-masters-512-maskable.png | 146943  | `e21deac5d808c2e92f7172deafa389d6b915ea47542aa33238e95ee80ea43566` |
| static/assets/bmi-logo-masters-512.png          | 297182  | `e0f6f9e0954702fbffb0e25397ae473314bfa4113b0d46d71e86b0a99b0f1e02` |
| static/images/blackhole.webp                    | 153758  | `c51255529083bea7237fa118c0e312ad2d999ae4c0f593d00c698ade8b031282` |
| static/images/oxyzenq-lite.webp                 | 59084   | `b042d738542bfd8f50bbbe848ccb41bd1a8aa9971ecce12de0b6fb86b54ecf37` |
| static/images/spaceshipx.webp                   | 125202  | `04581864cc1dc5d5d14e921d49eafcef29353024616c36b100996de9adf9bea9` |
| static/images/telescopic-cosmic.webp            | 234142  | `4fefb2c5c0d370f76e64e66aaa4d91eb015e0ae7697c68e8597553b81c0ee5ac` |

The scope is the whole brand surface, not only the root `assets/`
directory: the web-facing PWA derivatives live in `static/assets/` and
the shipped web images live in `static/images/`, and a substituted icon
or background ships to every installed client exactly like a
substituted demo capture would. The master plate itself lives at the
repository root, `assets/bmi-original-logo-2026.png`, beside its
signature manifest — the same layout and naming pattern the sibling
zelynic project uses (`zelynic-original-logo-2026.png`) — kept out of
the deployed client on purpose because the service worker precaches
`static/` only (see BRANDING 3.1).

When an asset legitimately changes, refresh the matching row and the
matching `signature.b3sum` line in the same commit that replaces the
file. `scripts/gates/check-signature-assets.sh` enforces both
directions in the gate-keepers lane: a modified or unlisted image
fails the gate, and so does a listed file that vanished.

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
