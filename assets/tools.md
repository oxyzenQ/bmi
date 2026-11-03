<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<!-- Copyright (C) 2026 rezky_nightky -->

# local tools

Local tooling notes for the repo's own assets — the commands the owner
runs by hand when an asset changes, written down so the next asset pass
does not re-derive them.

## rounded corners for the PWA logo derivatives

The master logo ships 1254x1254 at
[`docs/assets/bmi-logo-masters.png`](../docs/assets/bmi-logo-masters.png);
the manifest and `src/app.html` render the derivatives at 128-1024. Cut
the rounded alpha mask once at the master size (68 px corner radius, the
same recipe as the sibling zelynic notes) and resize afterwards, so every
derivative shares one rounded master:

```sh
magick docs/assets/bmi-logo-masters.png \
        \( -size 1254x1254 xc:none -fill white -draw 'roundrectangle 0,0 1253,1253 68,68' \) \
        -alpha off -compose CopyOpacity -composite /tmp/bmi-stellar-round-1254.png

for size in 128 180 192 216 256 512 1024; do
        magick /tmp/bmi-stellar-round-1254.png -filter Lanczos \
                -resize "${size}x${size}" -strip \
                "static/assets/bmi-logo-masters-${size}.png"
done
```

The corners come out fully transparent — probe one to confirm the mask
bit before shipping:

```sh
magick static/assets/bmi-logo-masters-512.png -format '%[pixel:p{0,0}]' info:
# srgba(0,0,0,0)
```

## maskable icon (static/assets/bmi-logo-masters-512-maskable.png)

A maskable icon is cropped to a circle by the launcher, so the emblem
must sit inside the PWA safe zone: scale the square master to 368 px
(72% of the 512 tile, inside the d = 0.8 circular safe area), center it
on a canvas filled with the master's own corner color, and keep the
result fully opaque and square-cornered — rounded alpha has no business
in a maskable tile:

```sh
bg=$(magick docs/assets/bmi-logo-masters.png -format '%[pixel:p{2,2}]' info:)
magick -size 512x512 xc:"$bg" \
        \( docs/assets/bmi-logo-masters.png -filter Lanczos -resize 368x368 \) \
        -gravity center -composite -strip -depth 8 \
        static/assets/bmi-logo-masters-512-maskable.png
```

The `-depth 8` matters: the Q16-HDRI build writes 16-bit PNGs by default
when a `xc:` canvas leads the command, and the tile nearly triples in
size for zero visual gain.

## after any asset change

Every image under `assets/`, `docs/assets/`, and `static/assets/`
carries a recorded BLAKE3 digest — see
[signature-assets.md](signature-assets.md). Refresh the matching row and
the matching `signature.b3sum` line in the same commit that replaces the
bytes:

```sh
b3sum assets/*.png docs/assets/*.png static/assets/*.png | sort -k2
```

<!-- BMI-STELLAR-DISCLAIMER -->
<!--
  Documentation Disclaimer — read before relying on any data point.

  This document may contain stale data, hardcoded sizes, or outdated
  file paths and command flags. Maintainers update source code but may
  forget to sync every doc — perfect sync across every .md file is a
  known maintenance burden with diminishing returns.

  Source code (`src/**/*.ts`, `src/**/*.svelte`) is the single source
  of truth. Always cross-check against the actual files before relying
  on any specific number (size, radius, scale factor), file path, or
  command.

  If you find a discrepancy, please open a PR — the doc is wrong, not
  the asset.
-->
