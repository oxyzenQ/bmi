<!-- SPDX-License-Identifier: AGPL-3.0-only -->

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
| assets/bmi-original-logo-2026.png               | 1319986 | `beecdc5c4e68ac0a1e2cd7f83604c00400fb4b327028e60906f007d4bd541002` |
| assets/demo-bmi-stellar-gauge-active.png        | 328909  | `7b5ccec1c4c15df8cace7861584555d0cf37d70799f3f3fdc6ae1f3f8009eb24` |
| assets/demo-bmi-stellar-gauge.png               | 332711  | `d2d4b7c66652232dde530b47b3b61e96cedf80b3776c29a7692313999ab48db5` |
| assets/demo-bmi-stellar-home-page.png           | 450617  | `c504240b579c2619377f550e72585c2cf1a153703b0733acfeadd07eb6bca5f0` |
| assets/demo-bmi-stellar-results.png             | 544385  | `5d7f252adde912c8f5f3a1ecdf4d480d00923d216caecbbf9063f77367b3a5a0` |
| assets/demo-bmi-stellar-snapshot.png            | 345672  | `f0bb57ae882c4dd5079997594fd06116f98ddd78ed98932f20006e2323119df5` |
| static/assets/bmi-logo-masters-1024.png         | 1015126 | `e874e2237038e33fddc917cdada0911336a2ac6e9d17b270eea03480779ea47a` |
| static/assets/bmi-logo-masters-128.png          | 20534   | `810583dfaafafd8453f8012068ede30e67a16f90474dcb10618c661bcd2293b3` |
| static/assets/bmi-logo-masters-180.png          | 38561   | `d55cbdb8eaa7c55e72e08eec20e28f3706d46028339e79802262ffa4c1bd75f8` |
| static/assets/bmi-logo-masters-192.png          | 43622   | `54f4dcf9e27b52b486bce5e7dd5947d47f7e1563276b562534ce2e86e7e14eb4` |
| static/assets/bmi-logo-masters-216.png          | 54754   | `b3d879a744054ed25ab3cd2725c5e3d26d59448558cda06f32c41f9f2c5099ac` |
| static/assets/bmi-logo-masters-256.png          | 76265   | `316a5e49fe473d4aeca9300be47619b118b0f1100ee29a0429fa8aa761436a1a` |
| static/assets/bmi-logo-masters-512-maskable.png | 140031  | `89cd98ade7b7200dc00064b06ddc9bf4c4174d3d5db3953082c2ab1cc8221215` |
| static/assets/bmi-logo-masters-512.png          | 289391  | `c1f27acf3b0ab25e405966a6a91b20c7b27982ab5f8848d98ee3cba679c80744` |
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
