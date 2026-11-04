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
| assets/demo-bmi-stellar-gauge-active.png        | 328909  | `7b5ccec1c4c15df8cace7861584555d0cf37d70799f3f3fdc6ae1f3f8009eb24` |
| assets/demo-bmi-stellar-gauge.png               | 332711  | `d2d4b7c66652232dde530b47b3b61e96cedf80b3776c29a7692313999ab48db5` |
| assets/demo-bmi-stellar-home-page.png           | 450617  | `c504240b579c2619377f550e72585c2cf1a153703b0733acfeadd07eb6bca5f0` |
| assets/demo-bmi-stellar-results.png             | 544385  | `5d7f252adde912c8f5f3a1ecdf4d480d00923d216caecbbf9063f77367b3a5a0` |
| assets/demo-bmi-stellar-snapshot.png            | 345672  | `f0bb57ae882c4dd5079997594fd06116f98ddd78ed98932f20006e2323119df5` |
| docs/assets/bmi-logo-masters.png                | 1319986 | `beecdc5c4e68ac0a1e2cd7f83604c00400fb4b327028e60906f007d4bd541002` |
| static/assets/bmi-logo-masters-1024.png         | 1015126 | `e874e2237038e33fddc917cdada0911336a2ac6e9d17b270eea03480779ea47a` |
| static/assets/bmi-logo-masters-128.png          | 20534   | `810583dfaafafd8453f8012068ede30e67a16f90474dcb10618c661bcd2293b3` |
| static/assets/bmi-logo-masters-180.png          | 38561   | `d55cbdb8eaa7c55e72e08eec20e28f3706d46028339e79802262ffa4c1bd75f8` |
| static/assets/bmi-logo-masters-192.png          | 43622   | `54f4dcf9e27b52b486bce5e7dd5947d47f7e1563276b562534ce2e86e7e14eb4` |
| static/assets/bmi-logo-masters-216.png          | 54754   | `b3d879a744054ed25ab3cd2725c5e3d26d59448558cda06f32c41f9f2c5099ac` |
| static/assets/bmi-logo-masters-256.png          | 76265   | `316a5e49fe473d4aeca9300be47619b118b0f1100ee29a0429fa8aa761436a1a` |
| static/assets/bmi-logo-masters-512-maskable.png | 140031  | `89cd98ade7b7200dc00064b06ddc9bf4c4174d3d5db3953082c2ab1cc8221215` |
| static/assets/bmi-logo-masters-512.png          | 289391  | `c1f27acf3b0ab25e405966a6a91b20c7b27982ab5f8848d98ee3cba679c80744` |

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
