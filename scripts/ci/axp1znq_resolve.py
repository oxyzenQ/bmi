#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
# SPDX-License-Identifier: AGPL-3.0-only OR Commercial
# PLATFORM: the CI runners (Linux); any Python 3 host with stdlib works.
#
# BMI STELLAR AXP1-ZNQ RESOLVER - the repos-for-ci failover pick
# (Architect's eXecution Protocol 1)
#
"""The failover half of AXP1-ZnQ (Architect's eXecution Protocol 1,
night-learning-into-darkness-1): read a repos-for-ci catalog top to
bottom and use the first address that actually answers, so no CI lane
ever marries one hardcoded server again.

The owner's scenario, verbatim: line 1 is down, the lane moves on, and
line 5 answering is the one the lane uses. This command walks the
catalog in authored order, probes each address with the shared probe
core (scripts/ci/axp1znq_probe.py), narrates every verdict to stderr
(the CI log keeps the audit trail: which line, which reason, how many
milliseconds), and hands the winner to stdout for a $(...) capture.

Verdict law: the failover pick is ALIVE (a real answer on the probe
path) - freshness is reported but never blocks the pick, because a
minutes-old index still serves the lane while a catalog curation is
the refresher's job (scripts/ci/axp1znq_refresh.py, the Sunday pass
that enforces the age policy). A catalog with no live address at all
is exit 1 - a lane must never silently fall back to a dead default.
"""

from __future__ import annotations

import argparse
import json
import sys

from axp1znq_probe import (
    VERDICT_DOWN,
    parse_catalog,
    probe_entry,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "AXP1-ZnQ (Architect's eXecution Protocol 1) resolver: pick the "
            "first live address from a repos-for-ci catalog."
        )
    )
    parser.add_argument("--file", required=True, help="path to one repos-for-ci catalog")
    parser.add_argument(
        "--probe-path",
        default="",
        help="path appended to every HTTP address (e.g. dists/resolute/InRelease)",
    )
    parser.add_argument(
        "--first",
        action="store_true",
        help="stop at the first live address and print it alone (for $(...) capture)",
    )
    parser.add_argument("--json", action="store_true", help="machine report instead of a table")
    parser.add_argument("--attempts", type=int, default=2, help="probe attempts per address")
    parser.add_argument("--connect-timeout", type=float, default=4.0, help="TCP-kind connect timeout s (HTTP probes ride the total timeout)")
    parser.add_argument("--total-timeout", type=float, default=15.0, help="whole-request timeout s")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.first and args.json:
        print("--first and --json cannot ride together", file=sys.stderr)
        return 2
    try:
        with open(args.file, "r", encoding="utf-8") as handle:
            text = handle.read()
    except OSError as why:
        print(f"AXP1-ZnQ resolver: cannot read {args.file}: {why}", file=sys.stderr)
        return 2

    entries = parse_catalog(text)
    if not entries:
        print(f"AXP1-ZnQ resolver: {args.file} carries no active address", file=sys.stderr)
        return 2

    banner = "AXP1-ZnQ (Architect's eXecution Protocol 1) resolver"
    print(f"{banner}: {args.file}, {len(entries)} candidate(s)", file=sys.stderr)

    results = []
    winner = None
    for entry in entries:
        result = probe_entry(
            entry,
            probe_path=args.probe_path,
            connect_timeout=args.connect_timeout,
            total_timeout=args.total_timeout,
            attempts=args.attempts,
        )
        results.append((entry, result))
        if result.verdict == VERDICT_DOWN:
            print(
                f"{banner}: line {entry.lineno} DOWN ({result.detail}) - moving on",
                file=sys.stderr,
            )
            continue
        age = f", index age {result.age_days}d" if result.age_days is not None else ""
        print(
            f"{banner}: line {entry.lineno} alive in {result.latency_ms} ms{age} "
            f"({entry.target})",
            file=sys.stderr,
        )
        if winner is None:
            winner = (entry, result)
            if args.first:
                break

    if args.first:
        if winner is None:
            print(
                f"{banner}: no address in {args.file} answered - the lane must fail loud, "
                f"never fall back to a dead default",
                file=sys.stderr,
            )
            return 1
        print(winner[0].target)
        return 0

    alive = sum(1 for _, r in results if r.verdict != VERDICT_DOWN)
    if args.json:
        payload = [
            {
                "line": entry.lineno,
                "address": entry.target,
                "kind": entry.kind,
                "verdict": result.verdict,
                "latency_ms": result.latency_ms,
                "age_days": result.age_days,
                "detail": result.detail,
            }
            for entry, result in results
        ]
        print(json.dumps(payload, indent=2))
    else:
        print(f"{'line':>5}  {'verdict':<7} {'ms':>7}  {'age':>5}  address")
        for entry, result in results:
            age = str(result.age_days) if result.age_days is not None else "-"
            latency = str(result.latency_ms) if result.latency_ms is not None else "-"
            print(f"{entry.lineno:>5}  {result.verdict:<7} {latency:>7}  {age:>5}  {entry.target}")
        print(f"{banner}: {alive}/{len(results)} alive")
    return 0 if alive > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
