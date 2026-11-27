#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
# SPDX-License-Identifier: AGPL-3.0-only OR Commercial
# PLATFORM: the CI runners (Linux); any Python 3 host with stdlib works.
#
# BMI STELLAR AXP1-ZNQ REFRESHER - the Sunday repos-for-ci catalog pass
# (Architect's eXecution Protocol 1)
#
"""The catalog half of AXP1-ZnQ (Architect's eXecution Protocol 1,
night-learning-into-darkness-1): every Sunday 10:00 WIB the
maintenance lane re-probes the whole repos-for-ci catalog, keeps the
addresses that answer AND serve a fresh index, and writes the file
back so the next week's failover starts from a tested pool - the same
cadence the dependency update rides, sequenced after it so the one
weekly commit carries both.

The write law (mature LTS, minimal owner intervention):

  - survivors keep their authored order - the catalog's shape is the
    owner's trust ranking (canonical first, mirrors after), never a
    latency leaderboard a noisy runner reshuffles weekly;
  - a dead or stale address becomes a dated comment in place
    (`# down 2026-11-27 (unreachable ...) - https://...`), so the
    history stays readable and the owner's next edit can revive it
    by deleting one line;
  - the file is bounded by the 100-line law: over the cap, the OLDEST
    dated dead comments are pruned first, an active address is never
    pruned;
  - the floor law: after a rewrite, fewer active addresses than
    --min-lines (the owner's minimum, 10) is a warning state - the
    pool is thinning and the owner must know; the survivors are real
    so the file still rewrites, the warning rides the summary and the
    CI log, and only a zero-alive pool escalates to the critical
    never-empty guard below;
  - the never-empty guard: a catalog with zero live addresses is NOT
    rewritten (a flaky runner probe must never erase the owner's
    pool) - the lane warns (::warning:: in CI) and names CALL THE
    OWNER in the note, the only critical it escalates;
  - idempotent: unchanged catalog, unchanged file - no write, no
    commit-note, no churn;
  - freshness: an HTTP address probed through --probe-path reads the
    index's own Date header; an index older than --max-age-days is
    STALE and fails the write (the owner asked for repos that are
    updated AND connect stably - alive-but-frozen is a lie the
    catalog must not keep);
  - the refresher never blocks the ship lane: it exits 0 with its
    warnings recorded, exit 1 only when the bot itself cannot run.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from axp1znq_probe import (
    VERDICT_DOWN,
    VERDICT_PASS,
    parse_catalog,
    probe_entry,
)

DOWN_LINE = re.compile(r"^# down (\d{4}-\d{2}-\d{2}) ")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "AXP1-ZnQ (Architect's eXecution Protocol 1) refresher: re-probe a "
            "repos-for-ci catalog tree and write back the tested survivors."
        )
    )
    parser.add_argument("--root", default="repos-for-ci", help="catalog directory")
    parser.add_argument(
        "--probe-path",
        default="",
        help="path appended to every HTTP address (e.g. dists/resolute/InRelease)",
    )
    parser.add_argument("--max-age-days", type=int, default=14, help="index age ceiling (d)")
    parser.add_argument("--max-lines", type=int, default=100, help="per-file line cap")
    parser.add_argument(
        "--min-lines",
        type=int,
        default=10,
        help="active-address floor; below it the lane warns (0 disables)",
    )
    parser.add_argument("--attempts", type=int, default=2, help="probe attempts per address")
    parser.add_argument("--connect-timeout", type=float, default=4.0, help="TCP-kind connect timeout s (HTTP probes ride the total timeout)")
    parser.add_argument("--total-timeout", type=float, default=15.0, help="whole-request timeout s")
    parser.add_argument("--workers", type=int, default=8, help="concurrent probes")
    parser.add_argument(
        "--note-file",
        default="",
        help="commit-note path to write when the catalog moved (maintenance lane)",
    )
    parser.add_argument("--dry-run", action="store_true", help="report only, write nothing")
    return parser


def dated_comment(today: str, detail: str, target: str) -> str:
    """The in-place tombstone a failed address leaves behind."""
    compact = " ".join(str(detail).split())
    return f"# down {today} ({compact}) - {target}"


def prune_oldest_dead(lines: list, cap: int) -> list:
    """Drop dated tombstones oldest-first until the file fits the cap."""
    while len([line for line in lines if line.strip()]) > cap:
        dated = [
            (index, match.group(1))
            for index, line in enumerate(lines)
            if (match := DOWN_LINE.match(line.strip()))
        ]
        if not dated:
            break
        oldest = min(dated, key=lambda pair: pair[1])[0]
        del lines[oldest]
    return lines


def refresh_one(
    path: Path,
    args: argparse.Namespace,
    today: str,
) -> dict:
    """Probe one catalog file; return the result record (and the new body)."""
    original = path.read_text(encoding="utf-8")
    entries = parse_catalog(original)
    banner = "AXP1-ZnQ (Architect's eXecution Protocol 1) refresher"
    if not entries:
        return {"path": path, "changed": False, "critical": True, "wrote": False,
                "warn": False,
                "summary": f"{banner}: {path.name} carries no active address - CALL THE OWNER"}

    with concurrent.futures.ThreadPoolExecutor(max_workers=min(args.workers, len(entries))) as pool:
        futures = {
            pool.submit(
                probe_entry,
                entry,
                args.probe_path,
                args.connect_timeout,
                args.total_timeout,
                args.attempts,
                args.max_age_days,
            ): entry
            for entry in entries
        }
        verdicts = {futures[future]: future.result() for future in concurrent.futures.as_completed(futures)}

    alive = sum(1 for r in verdicts.values() if r.verdict == VERDICT_PASS)
    stale = sum(1 for r in verdicts.values() if r.verdict not in (VERDICT_PASS, VERDICT_DOWN))
    down = sum(1 for r in verdicts.values() if r.verdict == VERDICT_DOWN)

    if alive == 0:
        return {"path": path, "changed": False, "critical": True, "wrote": False,
                "warn": False,
                "summary": (f"{banner}: {path.name} 0 alive of {len(entries)} probed "
                            f"({down} down, {stale} stale) - catalog untouched, CALL THE OWNER")}

    new_lines = []
    for raw in original.splitlines():
        entry = next((e for e in entries if e.raw == raw), None)
        if entry is None:
            new_lines.append(raw)
            continue
        result = verdicts[entry]
        if result.verdict == VERDICT_PASS:
            new_lines.append(raw)
        else:
            new_lines.append(dated_comment(today, result.detail, entry.target))
    new_lines = prune_oldest_dead(new_lines, args.max_lines)
    new_text = "\n".join(new_lines) + ("\n" if original.endswith("\n") else "")

    changed = new_text != original
    summary = (
        f"{banner}: {path.name} {alive} alive, {down} down, {stale} stale "
        f"({'rewrote' if changed else 'no change'})"
    )
    warn = 0 < alive < args.min_lines
    if warn:
        summary += (
            f" (the active pool {alive} is below the "
            f"{args.min_lines}-address floor - CALL THE OWNER)"
        )
    wrote = False
    if changed and not args.dry_run:
        path.write_text(new_text, encoding="utf-8")
        wrote = True
    return {"path": path, "changed": changed, "critical": False, "wrote": wrote,
            "warn": warn, "summary": summary}


def main() -> int:
    args = build_parser().parse_args()
    root = Path(args.root)
    if not root.is_dir():
        print(f"AXP1-ZnQ refresher: {root} is not a directory", file=sys.stderr)
        return 1
    catalogs = sorted(root.glob("*.txt"))
    if not catalogs:
        print(f"AXP1-ZnQ refresher: no *.txt catalog under {root}", file=sys.stderr)
        return 1

    today = datetime.now(timezone.utc).date().isoformat()
    records = [refresh_one(path, args, today) for path in catalogs]

    for record in records:
        print(record["summary"])
        if record["critical"]:
            print("::warning::AXP1-ZnQ address refresh hit a critical state - CALL THE OWNER")
        elif record.get("warn"):
            print(
                f"::warning::AXP1-ZnQ address refresh: {record['path'].name} active pool "
                f"below the {args.min_lines}-address floor - CALL THE OWNER"
            )

    moved = [r for r in records if r["changed"]]
    if moved and not args.dry_run and args.note_file:
        note = "\n".join(r["summary"] for r in moved)
        Path(args.note_file).write_text(note + "\n", encoding="utf-8")
        print(f"AXP1-ZnQ refresher: commit note written to {args.note_file}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
