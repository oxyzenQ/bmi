<!--
  SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
  SPDX-License-Identifier: AGPL-3.0-only OR Commercial
-->

# AXP1-ZnQ (Architect's eXecution Protocol 1)

The maintenance bot's one protocol: no CI lane marries a hardcoded
server again. The owner named the bottleneck after weeks of CI lanes
dying on single hardcoded addresses - a timeout, an unreachable host,
a 404 on a moved path - with the fallback target itself another
hardcoded address one bad hour could sink. The answer is a tested
address pool the bot curates, not a hardcoded default the tree prays
for.

Identity: **AXP1-ZnQ** stands for **Architect's eXecution Protocol 1**

- the expansion rides every mention of the name across the docs, the
  workflows and the scripts, by the owner's standing law (the name was
  adopted by night-solid-defense-1 for the Sunday supply-chain defense
  sentinel; night-learning-into-darkness-1 adds the protocol's second
  half, the address catalog, documented here). The protocol now runs two
  halves on the same Sunday 10:00 WIB anchor: the defense verdict
  (`.github/workflows/axp1-znq.yml`, `bun run audit:axp1-znq`) that
  classifies dangerous advisories by remediability, and the address
  catalog this page describes.

## The catalog (repos-for-ci/*.txt)

`repos-for-ci/` at the repo root holds one `.txt` per address family
(`apt-mirrors.txt` ships today). The law of every catalog file:

- one candidate address per line, the whole trimmed line IS the
  address (no trailing comments - a comment occupies its own line,
  starting with `#`);
- `https://archive.ubuntu.com/ubuntu` - an HTTP(S) address, probed
  with a real GET, TLS verified with the runner's own CA store (a
  cert failure is DOWN, never ignored);
- `dns.example.com:53` - a host:port address, probed with a socket
  connect (the DNS-resolver catalog rides this kind when its lane
  adopts the resolver);
- the authored order is the owner's trust ranking - canonical archive
  first, the runner-native azure mirror second, then the wide mirrors.
  It is never a latency leaderboard; see the write law;
- bounded: 10 to 100 active lines per file, the owner's min and max
  - both halves enforced (the refresher prunes tombstones at the
    100-line file cap and warns when the alive pool drops under
    `--min-lines`, default 10, `0` disables);
- the shipped seed was probe-verified: 15 candidates answered with a
  same-day fresh index on `dists/resolute/InRelease` (the suite the
  ubuntu-26.04 runner fleet runs) at authoring time, and one
  candidate landed dead from the authoring sandbox and carries its
  dated tombstone in place. `security.ubuntu.com` is excluded on
  purpose - it serves the security pocket, not the whole archive,
  and the apt lanes install from the full pool.

## The two commands

Both live in `scripts/ci/`, stdlib-only Python (urllib, socket,
concurrent.futures - no third-party dependency joins the maintenance
surface, the LTS law), and share one probe core
(`scripts/ci/axp1znq_probe.py`) so a mirror the resolver picks and a
mirror the refresher keeps are measured the same way.

**The resolver - `axp1znq_resolve.py`** - is the failover half, the
consumer CI lanes call:

```
python3 scripts/ci/axp1znq_resolve.py \
  --file repos-for-ci/apt-mirrors.txt \
  --probe-path dists/resolute/InRelease \
  --first
```

It walks the catalog top to bottom, probes each address, narrates
every verdict to stderr (line number, reason, milliseconds - the CI
log keeps the audit trail), prints the first ALIVE address to stdout
and exits 0. Line 1 down, the lane moves on; line 5 answering is the
one the lane uses - the owner's scenario, verbatim. A catalog with no
live address is exit 1: a lane must never silently fall back to a
dead default. Freshness is reported in the narration but never blocks
the pick - a minutes-old index still serves the lane; curation is the
refresher's job. Report mode (no `--first`) prints the whole table or
`--json` for machines.

**The refresher - `axp1znq_refresh.py`** - is the catalog half, the
Sunday pass the maintenance lane runs:

```
python3 scripts/ci/axp1znq_refresh.py \
  --root repos-for-ci \
  --probe-path dists/resolute/InRelease \
  --note-file .axp1/axp1-address-note.txt
```

It probes every catalog concurrently, keeps an address only when it
answers AND serves a fresh index (the InRelease file's own `Date:`
header is the freshness witness; older than `--max-age-days`, default
14, is STALE - the owner asked for repos that are updated AND connect
stably, and alive-but-frozen is a lie the catalog must not keep), and
writes the survivors back. The write law:

- survivors keep their authored order - the catalog's shape is the
  owner's trust ranking, never a weekly reshuffle a noisy runner
  would churn;
- a dead or stale address becomes a dated tombstone in place
  (`# down 2026-11-27 (unreachable ...) - https://...`), readable
  history the owner can revive by deleting one line;
- the 100-line cap prunes the OLDEST tombstones first; an active
  address is never pruned;
- the never-empty guard: zero live addresses means the file is NOT
  rewritten (a flaky runner probe must never erase the owner's pool)
  - the lane warns (`::warning::` in CI) and the note names CALL THE
    OWNER, the one critical the refresher escalates;
- idempotent: unchanged catalog, unchanged file - no write, no
  commit-note, no churn;
- `--dry-run` reports the verdicts and writes nothing.

## The wiring (the Sunday cadence and the apt lanes)

The maintenance lane (`Stellar Guard - Dependency Maintenance`, cron
`0 3 * * 0` - Sunday 03:00 UTC = 10:00 WIB) runs the refresher as the
step right after `Update all dependencies` and before the diff law,
gated on nothing extra - it probes every Sunday even when the
lockfile did not move, because a stale pool is its own weekly risk.
The owner's sequencing law: the address refresh rides AFTER the
dependency update finishes, and the commit job stages both, so the
one weekly commit carries deps AND addresses - a lockfile-only week
keeps its `chore(deps): maintenance deps weekly` title, an
address-catalog-only week gets its own honest title, and the
refresher's note lands in the commit body either way. The refresher
never blocks the ship lane: it exits 0 with warnings recorded.

Every apt lane in the CI estate walks the resolver: no repoint target
is a hardcoded server anymore. Two lanes wired on
night-learning-into-darkness-1 - the runtime proof lane (shared
libraries for the pinned headless browser,
`runtime-proof.yml`) and the release lane (the b3sum digest tool,
`release.yml`) - each repoint the runner's apt sources to the first
catalog address that answers before `apt-get update` runs, and fail
loud when nothing alive answers.

## What stays hardcoded on purpose (the honest boundary)

The digest-pinned GitHub release downloads do NOT join the address
pool: the cargo-deny installer (`scripts/ci/install-cargo-deny.sh`),
the actionlint fetch in the gate-keepers lane and the
chrome-for-testing binary (`scripts/proof/download-chrome.sh`) each
verify the exact downloaded bytes against a committed digest. One
trusted host with pinned digests beats an untrusted mirror that could
serve different bytes - the supply-chain law works FOR those lanes,
not against them, and their failure mode is a red lane, never a
compromised tool. The GitHub API callers
(`scripts/ci/actions-version-sweep.sh`, the release attestations) talk
to api.github.com itself, which has no alternate address family. These
are the open adoption surface: a lane adopts by adding its address
family as a new `repos-for-ci/*.txt` and swapping its address for a
resolver call, the same way the apt lanes moved.

## The probe laws are proven, not claimed

`scripts/dev/axp1znq_edge_proof.py` serves a loopback InRelease whose
`Date:` header the harness controls and walks the verdict paths end
to end - the stale refusal (a frozen index fails the max-age law, the
never-empty guard keeps the catalog untouched, the lane calls the
owner), the failover pick ignoring a reported-but-nonblocking age,
the all-dead exit-1 loud, and the fresh survivor written back. The
harness doubles as the probe core's regression gate: any future probe
change must keep all four green.

## The honest edges

- Probe verdicts are network-relative: the authoring sandbox verified
  15 of the 16 shipped candidates, and a runner-region difference is
  exactly what the weekly curation exists to reconcile (the Sunday
  refresher judges the pool from the runner network, where the owner
  actually ships).
- The fresh-index probe path is `dists/resolute/InRelease` - the
  suite the ubuntu-26.04 runner fleet runs. When the fleet moves to
  the next suite, the probe path moves with it (one flag, both
  commands).
- `--first` worst case on a dead-first catalog is bounded by attempts
  x timeout per address (both are flags); an HTTP probe rides the
  whole-request timeout alone (urllib's one-socket law), the connect
  timeout binds only the host:port kind, and on proxied networks the
  total timeout is what bites.

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
